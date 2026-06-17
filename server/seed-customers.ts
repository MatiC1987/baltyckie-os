import { db } from "./db";
import { customers, reservations } from "@shared/schema";
import { eq, ilike, and, isNotNull, sql } from "drizzle-orm";

async function upsertCustomerLocal(data: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  source?: string;
  lastStayDate?: string;
}): Promise<{ id: number; isNew: boolean }> {
  if (data.phone && data.phone.replace(/\s+/g, "").length >= 7) {
    const phoneNorm = data.phone.replace(/[\s\-\(\)]+/g, "");
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

async function recalculateAllCustomerStats() {
  const allCustomers = await db.select().from(customers);
  const allRes = await db.select().from(reservations);

  let statsUpdated = 0;
  for (const customer of allCustomers) {
    const nameA = `${customer.lastName} ${customer.firstName}`.toUpperCase();
    const nameB = `${customer.firstName} ${customer.lastName}`.toUpperCase();
    const customerRes = allRes.filter(r =>
      r.customerId === customer.id ||
      (r.guestName || "").toUpperCase() === nameA ||
      (r.guestName || "").toUpperCase() === nameB
    );
    const confirmed = customerRes.filter(r => r.status !== "ANULOWANA");
    const totalStays = confirmed.length;
    const totalRevenue = confirmed.reduce((s, r) => s + parseFloat(r.price || "0"), 0);
    const lastStay = confirmed.map(r => r.endDate).sort().reverse()[0];

    await db.update(customers).set({
      totalStays,
      totalRevenue: totalRevenue.toFixed(2),
      ...(lastStay && { lastStayDate: lastStay }),
    }).where(eq(customers.id, customer.id));
    if (totalStays > 0) statsUpdated++;
  }
  return statsUpdated;
}

export { recalculateAllCustomerStats };

export async function seedCustomers() {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(customers);

  if (Number(count) >= 50) {
    console.log(`[seed-customers] Klienci już istnieją (${count}) — przeliczam statystyki...`);
    const updated = await recalculateAllCustomerStats();
    console.log(`[seed-customers] Statystyki zaktualizowane dla ${updated} klientów`);
    return;
  }

  console.log("[seed-customers] Start — budowanie bazy klientów z rezerwacji...");

  const allReservations = await db.select().from(reservations).orderBy(reservations.startDate);
  console.log(`[seed-customers] Znaleziono ${allReservations.length} rezerwacji`);

  let created = 0;
  let linked = 0;
  let skipped = 0;

  for (const res of allReservations) {
    if (res.status === "ANULOWANA") { skipped++; continue; }
    const guestName = (res.guestName || "").trim();
    if (!guestName || guestName.toUpperCase() === "NIEZNANY") { skipped++; continue; }

    const parts = guestName.split(/\s+/).filter(Boolean);
    if (parts.length < 2) { skipped++; continue; }

    const lastName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
    const firstName = parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");

    try {
      const { id: customerId, isNew } = await upsertCustomerLocal({
        firstName,
        lastName,
        source: "hotres",
        lastStayDate: res.endDate ?? undefined,
      });
      if (isNew) created++;

      if (!res.customerId) {
        await db.update(reservations).set({ customerId }).where(eq(reservations.id, res.id));
        linked++;
      }
    } catch (e: any) {
      console.warn(`[seed-customers] Błąd dla rez. ${res.reservationNumber}: ${e?.message}`);
      skipped++;
    }
  }

  const statsUpdated = await recalculateAllCustomerStats();

  console.log(`[seed-customers] Zakończono: nowi=${created}, powiązani=${linked}, pominięci=${skipped}, statystyki=${statsUpdated}`);
}
