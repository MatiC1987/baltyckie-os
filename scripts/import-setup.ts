import { db } from '../server/db';
import { subleases, subleaseMeterSettings, subleaseMeterReadings } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  console.log('=== T001: Setup - sync subleases + clean test data ===\n');

  // 1. Clean test meter data for sublease 4 (Dulko)
  const deletedSettings = await db.delete(subleaseMeterSettings).where(eq(subleaseMeterSettings.subleaseId, 4)).returning();
  const deletedReadings = await db.delete(subleaseMeterReadings).where(eq(subleaseMeterReadings.subleaseId, 4)).returning();
  console.log(`Cleaned sublease 4 (Dulko): ${deletedSettings.length} settings, ${deletedReadings.length} readings deleted`);

  // 2. Check if subleases 14 and 15 already exist
  const existing14 = await db.select().from(subleases).where(eq(subleases.id, 14));
  const existing15 = await db.select().from(subleases).where(eq(subleases.id, 15));

  if (existing14.length > 0) {
    console.log('Sublease 14 (Momot) already exists, skipping');
  } else {
    await db.execute(sql`
      INSERT INTO subleases (id, apartment_id, tenant_type, first_name, last_name, start_date, end_date, media_by_meters, status, rent_amount, payment_day, phone, email)
      VALUES (14, 179, 'osoba_fizyczna', 'NATALIA', 'MOMOT', '2025-10-10', '2026-04-25', true, 'AKTYWNA', 2300.00, 10, '453 279 116', 'natashamomot74@icloud.com')
    `);
    console.log('Created sublease 14 (MOMOT NATALIA, Classic 1, apt=179)');
  }

  if (existing15.length > 0) {
    console.log('Sublease 15 (Nidzgorski) already exists, skipping');
  } else {
    await db.execute(sql`
      INSERT INTO subleases (id, apartment_id, tenant_type, first_name, last_name, start_date, end_date, media_by_meters, status, rent_amount, payment_day, phone, email)
      VALUES (15, 177, 'osoba_fizyczna', 'GRZEGORZ', 'NIDZGORSKI', '2025-10-01', '2026-04-20', true, 'AKTYWNA', 2100.00, 10, '729833270', 'elkantarr@gmail.com')
    `);
    console.log('Created sublease 15 (NIDZGORSKI GRZEGORZ, Samba, apt=177)');
  }

  // 3. Fix sequence
  await db.execute(sql`SELECT setval('subleases_id_seq', (SELECT COALESCE(MAX(id), 1) FROM subleases))`);
  console.log('Sequence reset to max(id)');

  // 4. Verify
  const all = await db.select({ id: subleases.id, apt: subleases.apartmentId, first: subleases.firstName, last: subleases.lastName, media: subleases.mediaByMeters })
    .from(subleases)
    .where(eq(subleases.mediaByMeters, true));
  console.log('\nSubleases with mediaByMeters=true:');
  for (const s of all) {
    console.log(`  ID: ${s.id}, apt: ${s.apt}, ${s.first} ${s.last}`);
  }

  console.log('\n=== T001 Complete ===');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
