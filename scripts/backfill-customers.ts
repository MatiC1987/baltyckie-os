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

    // Parse name: HotRes format "LASTNAME FIRSTNAME" with support for multi-part surnames
    // e.g. "DE VRIES ANNA" → lastName="De Vries", firstName="Anna"
    const parts = guestName.split(/\s+/).filter(Boolean);
    if (parts.length < 2) { skipped++; continue; }

    const PARTICLES = new Set(["DE", "VAN", "DER", "VON", "DI", "DEL", "DELLA", "DOS", "DA", "LA", "LE", "LO", "ZU", "VOM", "TEN", "TER", "MC", "MAC", "O"]);
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

    // Accumulate leading particles + the first non-particle token as the last name
    let i = 0;
    while (i < parts.length - 1 && PARTICLES.has(parts[i].toUpperCase())) i++;
    // Ensure at least one token for last name and at least one for first name
    const lastNameParts = parts.slice(0, i + 1);
    const firstNameParts = parts.slice(i + 1);
    if (firstNameParts.length === 0) { skipped++; continue; }

    const lastName = lastNameParts.map(capitalize).join(" ");
    const firstName = firstNameParts.map(capitalize).join(" ");

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
