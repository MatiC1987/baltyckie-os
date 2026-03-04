import { db } from '../server/db';
import { subleaseMeterSettings, subleaseMeterReadings } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import XLSX from 'xlsx';

const LOKAL_TO_SUBLEASE: Record<string, number> = {
  'NA WYDMIE 7/2': 4,
  'NA WYDMIE 8/21': 9,
  'NA WYDMIE 7/23': 9,
  'NA WYDMIE 8/32': 3,
  'NA WYDMIE 7/1': 14,
  'NA WYDMIE 8/36': 15,
  'NA WYDMIE 8/26': 15,
};

function excelDate(serial: number): string {
  const d = new Date((serial - 25569) * 86400000);
  return d.toISOString().slice(0, 10);
}

interface WaterRow {
  tenant: string;
  lokal: string;
  from: string;
  to: string;
  coldStart: number;
  coldEnd: number;
  hotStart: number;
  hotEnd: number;
}

interface EnergyRow {
  tenant: string;
  lokal: string;
  from: string;
  to: string;
  elecStart: number;
  elecEnd: number | null;
}

async function main() {
  console.log('=== T002: Import meter readings from Excel ===\n');

  const wb = XLSX.readFile('attached_assets/podnajem_1772620255156.xlsx');

  const waterData = parseWater(wb);
  const energyData = parseEnergy(wb);

  console.log(`Parsed: ${waterData.length} water rows, ${energyData.length} energy rows (from Sep 2025)\n`);

  const subleaseIds = new Set([...waterData.map(r => LOKAL_TO_SUBLEASE[r.lokal]), ...energyData.map(r => LOKAL_TO_SUBLEASE[r.lokal])]);

  for (const subleaseId of subleaseIds) {
    if (!subleaseId) continue;
    console.log(`--- Sublease ${subleaseId} ---`);

    const waterRows = waterData.filter(r => LOKAL_TO_SUBLEASE[r.lokal] === subleaseId).sort((a, b) => a.from.localeCompare(b.from));
    const energyRows = energyData.filter(r => LOKAL_TO_SUBLEASE[r.lokal] === subleaseId).sort((a, b) => a.from.localeCompare(b.from));

    await importMeterType(subleaseId, 'cold_water', waterRows.map(r => ({ from: r.from, to: r.to, start: r.coldStart, end: r.coldEnd })));
    await importMeterType(subleaseId, 'hot_water', waterRows.map(r => ({ from: r.from, to: r.to, start: r.hotStart, end: r.hotEnd })));
    await importMeterType(subleaseId, 'electricity', energyRows.map(r => ({ from: r.from, to: r.to, start: r.elecStart, end: r.elecEnd })));

    console.log('');
  }

  console.log('=== T002 Complete ===');
  process.exit(0);
}

async function importMeterType(
  subleaseId: number,
  meterType: string,
  rows: { from: string; to: string; start: number; end: number | null }[]
) {
  if (rows.length === 0) {
    console.log(`  ${meterType}: no data`);
    return;
  }

  const existing = await db.select().from(subleaseMeterSettings)
    .where(and(eq(subleaseMeterSettings.subleaseId, subleaseId), eq(subleaseMeterSettings.meterType, meterType)));

  if (existing.length > 0) {
    console.log(`  ${meterType}: settings already exist, skipping`);
    return;
  }

  const first = rows[0];
  await db.insert(subleaseMeterSettings).values({
    subleaseId,
    meterType,
    unitPrice: '0',
    initialReading: String(first.start) + '.000',
    initialDate: first.from,
  });
  console.log(`  ${meterType}: setting created (initial=${first.start}, date=${first.from})`);

  let readingsCount = 0;
  for (const row of rows) {
    if (row.end === null || row.end === undefined) {
      console.log(`  ${meterType}: skipping row with null end (from=${row.from}, current period)`);
      continue;
    }

    const existingReading = await db.select().from(subleaseMeterReadings)
      .where(and(
        eq(subleaseMeterReadings.subleaseId, subleaseId),
        eq(subleaseMeterReadings.meterType, meterType),
        eq(subleaseMeterReadings.readingDate, row.to)
      ));

    if (existingReading.length > 0) continue;

    await db.insert(subleaseMeterReadings).values({
      subleaseId,
      meterType,
      reading: String(row.end) + '.000',
      readingDate: row.to,
      status: 'confirmed',
    });
    readingsCount++;
  }
  console.log(`  ${meterType}: ${readingsCount} readings imported`);
}

function parseWater(wb: XLSX.WorkBook): WaterRow[] {
  const ws = wb.Sheets['woda'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  const result: WaterRow[] = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r || !r[0] || typeof r[0] !== 'string') continue;
    const from = excelDate(r[3]);
    if (from < '2025-09-01') continue;

    result.push({
      tenant: r[0],
      lokal: r[2],
      from,
      to: excelDate(r[4]),
      coldStart: r[5],
      coldEnd: r[6],
      hotStart: r[7],
      hotEnd: r[8],
    });
  }
  return result;
}

function parseEnergy(wb: XLSX.WorkBook): EnergyRow[] {
  const ws = wb.Sheets['energia'];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  const result: EnergyRow[] = [];

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r || !r[0] || typeof r[0] === 'number') continue;
    const tenant = String(r[0]).trim();
    if (!tenant) continue;

    const fromRaw = r[3];
    if (typeof fromRaw !== 'number') continue;
    const from = excelDate(fromRaw);
    if (from < '2025-09-01') continue;

    const toRaw = r[4];
    const to = typeof toRaw === 'number' ? excelDate(toRaw) : from;

    result.push({
      tenant,
      lokal: r[2],
      from,
      to,
      elecStart: r[5],
      elecEnd: r[6] != null ? r[6] : null,
    });
  }
  return result;
}

main().catch(e => { console.error(e); process.exit(1); });
