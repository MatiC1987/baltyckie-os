import { db } from "../server/db";
import { reservations, customers } from "../shared/schema";
import { eq, ilike, and, isNotNull } from "drizzle-orm";

async function normalizePhone(p: string) {
  return p.replace(/[\s\-\(\)]+/g, "");
}

async function upsertCustomerLocal(data: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  lastStayDate?: string;
}): Promise<{ id: number; isNew: boolean }> {
  // Dedup: phone → email → firstName+lastName
  if (data.phone && data.phone.replace(/\s+/g, "").length >= 7) {
    const phoneNorm = await normalizePhone(data.phone);
    const all = await db.select().from(customers).where(isNotNull(customers.phone));
    const byPhone = all.find(c => c.phone && c.phone.replace(/[\s\-\(\)]+/g, "") === phoneNorm);
    if (byPhone) return { id: byPhone.id, isNew: false };
  }
  if (data.email && data.email.trim()) {
    const [byEmail] = await db.select().from(customers).where(ilike(customers.email, data.email.trim()));
    if (byEmail) return { id: byEmail.id, isNew: false };
  }
  if (data.firstName && data.lastName) {
    const [byName] = await db.select().from(customers).where(
      and(ilike(customers.firstName, data.firstName.trim()), ilike(customers.lastName, data.lastName.trim()))
    );
    if (byName) return { id: byName.id, isNew: false };
  }

  const [created] = await db.insert(customers).values({
    firstName: data.firstName,
    lastName: data.lastName,
    ...(data.email && { email: data.email }),
    ...(data.phone && { phone: data.phone }),
    source: data.source || "hotres",
    ...(data.lastStayDate && { lastStayDate: data.lastStayDate }),
    marketingConsent: true,
    preferredLang: "pl",
  }).returning();
  return { id: created.id, isNew: true };
}

async function main() {
  console.log("[backfill-customers] Start — budowanie bazy klientów z rezerwacji...");

  const allReservations = await db.select().from(reservations).orderBy(reservations.startDate);
  console.log(`[backfill-customers] Znaleziono ${allReservations.length} rezerwacji`);

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const res of allReservations) {
    if (res.status === "ANULOWANA") { skipped++; continue; }
    const guestName = (res.guestName || "").trim();
    if (!guestName || guestName === "NIEZNANY") { skipped++; continue; }

    // Parse name: assume "LASTNAME FIRSTNAME" or "FIRSTNAME LASTNAME"
    const parts = guestName.split(/\s+/).filter(Boolean);
    if (parts.length < 2) { skipped++; continue; }

    // Treat first token as lastName, rest as firstName (HotRes uses UPPERCASE LASTNAME)
    const lastName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const firstName = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");

    try {
      const { id: customerId, isNew } = await upsertCustomerLocal({
        firstName,
        lastName,
        source: "hotres",
        lastStayDate: res.endDate,
      });
      if (isNew) created++;

      // Link reservation → customer if not already linked
      if (!res.customerId) {
        await db.update(reservations).set({ customerId }).where(eq(reservations.id, res.id));
        linked++;
      }
    } catch (e: any) {
      console.warn(`[backfill-customers] Błąd dla rez. ${res.reservationNumber}: ${e.message}`);
      skipped++;
    }
  }

  // Now update denormalized stats for all customers
  const allCustomers = await db.select().from(customers);
  const allRes = await db.select().from(reservations);

  let statsUpdated = 0;
  for (const customer of allCustomers) {
    const name = `${customer.lastName} ${customer.firstName}`.toUpperCase();
    const customerRes = allRes.filter(r =>
      r.customerId === customer.id ||
      (r.guestName || "").toUpperCase() === name
    );
    const confirmed = customerRes.filter(r => r.status !== "ANULOWANA");
    const totalStays = confirmed.length;
    const totalRevenue = confirmed.reduce((s, r) => s + parseFloat(r.price || "0"), 0);
    const lastStay = confirmed.map(r => r.endDate).sort().reverse()[0];

    if (totalStays > 0) {
      await db.update(customers).set({
        totalStays,
        totalRevenue: totalRevenue.toFixed(2),
        ...(lastStay && { lastStayDate: lastStay }),
      }).where(eq(customers.id, customer.id));
      statsUpdated++;
    }
  }

  console.log(`[backfill-customers] Zakończono:`);
  console.log(`  Nowi klienci: ${created}`);
  console.log(`  Powiązanych rezerwacji: ${linked}`);
  console.log(`  Zaktualizowanych statystyk: ${statsUpdated}`);
  console.log(`  Pominiętych rezerwacji: ${skipped}`);
  process.exit(0);
}

main().catch(e => {
  console.error("[backfill-customers] Błąd krytyczny:", e);
  process.exit(1);
});
