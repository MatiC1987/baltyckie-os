import { db } from "../server/db";
import { expenses, revenueForecasts, apartments } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const EXCEL_FILE = path.resolve("attached_assets/BAŁTYCKIE_1771496530840.xlsx");

async function importCosts() {
  console.log("=== IMPORT KOSZTÓW ===");
  
  const fileBuffer = fs.readFileSync(EXCEL_FILE);
  const wb = XLSX.read(fileBuffer);
  const ws = wb.Sheets["KOSZTY"];
  if (!ws) throw new Error("Arkusz KOSZTY nie znaleziony");

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
  const allApartments = await db.select().from(apartments);
  const activeApts = allApartments.filter(a => a.active !== false);

  const dateRow = data[4];
  const monthColumns: { col: number; year: number; month: number }[] = [];
  const excelEpoch = new Date(1899, 11, 30).getTime();
  
  for (let c = 0; c < dateRow.length; c++) {
    if (typeof dateRow[c] === "number" && dateRow[c] > 40000) {
      const d = new Date(excelEpoch + dateRow[c] * 86400000);
      monthColumns.push({ col: c, year: d.getFullYear(), month: d.getMonth() });
    }
  }
  console.log(`Znaleziono ${monthColumns.length} kolumn miesięcznych`);
  console.log(`Lata: ${[...new Set(monthColumns.map(m => m.year))].sort().join(", ")}`);

  const GB_SUPERIOR = activeApts.filter(a => a.location === "GRAND BALTIC" && a.name.toLowerCase().includes("superior")).map(a => a.id);
  const GB_STUDIO = activeApts.filter(a => a.location === "GRAND BALTIC" && /^\d+\s*-\s*studio$/i.test(a.name)).map(a => a.id);
  const GB_STUDIO_MINI = activeApts.filter(a => a.location === "GRAND BALTIC" && a.name.toLowerCase().includes("studio mini")).map(a => a.id);
  const GB_2OS = activeApts.filter(a => a.location === "GRAND BALTIC" && a.name.toLowerCase().includes("2os")).map(a => a.id);
  const ALL_GB = [...GB_SUPERIOR, ...GB_STUDIO, ...GB_STUDIO_MINI, ...GB_2OS];

  console.log(`Grand Baltic kategoryzacja: Superior=${GB_SUPERIOR.length}, Studio=${GB_STUDIO.length}, Studio mini=${GB_STUDIO_MINI.length}, 2os=${GB_2OS.length}`);

  const aptNameVariants: Record<string, string> = {
    "BULWAR GRAND": "BULWAR GRAND", "BULWAR RODZINNY": "BULWAR RODZINNY",
    "BULWAR PRESTIGE": "BULWAR PRESTIGE", "BULWAR VIP": "BULWAR VIP",
    "BULWAR ZACISZE": "BULWAR ZACISZE", "BULWAR SUN": "BULWAR SUN",
    "BULWAR AMBER": "BULWAR AMBER", "BULWAR MODERN": "BULWAR MODERN",
    "BULWAR MARINA": "BULWAR MARINA", "BULWAR GLAMOUR": "BULWAR GLAMOUR",
    "BULWAR ELEGANCE": "BULWAR ELEGANCE", "BULWAR PANORAMA": "BULWAR PANORAMA",
    "BULWAR PANORAMA 2": "BULWAR PANORAMA 2", "BULWAR 7 MÓRZ": "BULWAR 7 MÓRZ",
    "BULWAR COMFORT": "BULWAR COMFORT", "BULWAR DELUXE": "BULWAR DELUXE",
    "BULWAR ZACISZE 2": "BULWAR ZACISZE 2", "BULWAR EXCLUSIVE": "BULWAR EXCLUSIVE",
    "BULWAR - SCANIA": "BULWAR SCANIA",
    "GARDEN 2": "GARDEN2", "SŁONECZNA OAZA 2": "SŁONECZNA OAZA 2",
    "49-1": "49-1", "49-2": "49-2", "51-1": "51-1", "51-2": "51-2",
  };

  function resolveApartment(excelName: string): { ids: number[]; divideBy: number } | null {
    const upper = excelName.toUpperCase().trim();

    if (upper === "GRAND BALTIC") return { ids: ALL_GB, divideBy: ALL_GB.length || 1 };
    if (upper === "SUPERIOR" || upper === "4-OSOBOWY SUPERIOR") return { ids: GB_SUPERIOR, divideBy: GB_SUPERIOR.length || 1 };
    if (upper === "STUDIO" || upper === "4-OSOBOWY STUDIO") return { ids: GB_STUDIO, divideBy: GB_STUDIO.length || 1 };
    if (upper === "STUDIO MINI" || upper === "4-OSOBOWY STUDIO MINI") return { ids: GB_STUDIO_MINI, divideBy: GB_STUDIO_MINI.length || 1 };
    if (upper.includes("2-OSOBOWY") || upper === "2-OS") return { ids: GB_2OS, divideBy: GB_2OS.length || 1 };

    const dbName = aptNameVariants[upper] ?? upper;
    if (dbName === "") return null;

    const matched = activeApts.filter(a => a.name.toUpperCase().trim() === dbName);
    if (matched.length > 0) return { ids: matched.map(a => a.id), divideBy: 1 };

    const fuzzy = activeApts.filter(a => {
      const n = a.name.toUpperCase().trim();
      return n.includes(dbName) || dbName.includes(n);
    });
    if (fuzzy.length === 1) return { ids: [fuzzy[0].id], divideBy: 1 };

    return null;
  }

  const companyCategories = new Set([
    "OPŁATY", "WYNAGRODZENIA", "ZUS", "PODATKI", "KREDYTY & POŻYCZKI",
    "NIERUCHOMOŚCI", "OBSŁUGA PRAWNO-KSIĘGOWA", "MARKETING & REKLAMA",
    "USŁUGI", "POZOSTAŁE"
  ]);

  const expensesToInsert: any[] = [];
  let imported = 0;
  let skipped = 0;
  const skippedNames: string[] = [];
  let currentSection = "COMPANY";

  for (let r = 6; r < data.length; r++) {
    const rowLabel = String(data[r][0] || "").trim();
    if (!rowLabel) continue;

    if (rowLabel === "APARTAMENTY") { currentSection = "APARTMENT"; continue; }
    if (["PODSUMOWANIE", "prognoza", "koszty", "saldo"].includes(rowLabel) || rowLabel.includes("RAZEM")) continue;

    const isCompanyCost = companyCategories.has(rowLabel.toUpperCase());
    let aptResolution: { ids: number[]; divideBy: number } | null = null;

    if (!isCompanyCost && currentSection === "APARTMENT") {
      aptResolution = resolveApartment(rowLabel);
      if (!aptResolution) {
        if (!skippedNames.includes(rowLabel)) skippedNames.push(rowLabel);
        skipped++;
        continue;
      }
    }

    for (const mc of monthColumns) {
      if (mc.year < 2022) continue;

      const realCol = mc.col + 1;
      const realVal = Number(data[r][realCol]) || 0;
      if (realVal === 0) continue;

      const dateStr = `${mc.year}-${String(mc.month + 1).padStart(2, "0")}-01`;

      if (isCompanyCost || currentSection === "COMPANY") {
        expensesToInsert.push({
          date: dateStr, category: rowLabel,
          amount: String(Math.round(realVal * 100) / 100),
          apartmentId: null, description: `Import: ${rowLabel}`,
          type: "FIXED", isForecast: false,
        });
        imported++;
      } else if (aptResolution) {
        const perApt = Math.round((realVal / aptResolution.divideBy) * 100) / 100;
        for (const aptId of aptResolution.ids) {
          expensesToInsert.push({
            date: dateStr, category: rowLabel,
            amount: String(perApt),
            apartmentId: aptId, description: `Import: ${rowLabel}`,
            type: "VARIABLE", isForecast: false,
          });
          imported++;
        }
      }
    }
  }

  console.log(`Przygotowano ${expensesToInsert.length} rekordów do importu`);
  if (skippedNames.length > 0) console.log(`Pominięto nierozpoznane: ${skippedNames.join(", ")}`);

  if (expensesToInsert.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < expensesToInsert.length; i += batchSize) {
      const batch = expensesToInsert.slice(i, i + batchSize);
      await db.insert(expenses).values(batch);
      process.stdout.write(`\r  Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(expensesToInsert.length / batchSize)}...`);
    }
    console.log("\n  Koszty zaimportowane!");
  }

  return { imported, skipped };
}

async function importRevenueForecasts() {
  console.log("\n=== IMPORT PROGNOZ PRZYCHODÓW ===");
  
  const fileBuffer = fs.readFileSync(EXCEL_FILE);
  const wb = XLSX.read(fileBuffer);
  const ws = wb.Sheets["Przychody"];
  if (!ws) throw new Error("Arkusz Przychody nie znaleziony");

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
  const excelEpoch = new Date(1899, 11, 30).getTime();
  const headerRow = data[0];

  const yearBlocks: { year: number; months: { col: number; month: number }[] }[] = [];
  let currentMonths: { col: number; month: number }[] = [];
  let currentYear = 0;

  for (let c = 1; c < headerRow.length; c++) {
    const val = headerRow[c];
    if (typeof val === "number" && val >= 2022 && val <= 2030) {
      if (currentMonths.length > 0) {
        yearBlocks.push({ year: currentYear, months: currentMonths });
      }
      currentYear = val;
      currentMonths = [];
      continue;
    }
    if (typeof val === "number" && val > 40000) {
      const d = new Date(excelEpoch + val * 86400000);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      if (yr >= 2022) {
        if (currentYear === 0) currentYear = yr;
        currentMonths.push({ col: c, month: mo });
      }
    }
    if (val === "" && currentMonths.length >= 12) {
      yearBlocks.push({ year: currentYear, months: currentMonths });
      currentYear = 0;
      currentMonths = [];
    }
  }
  if (currentMonths.length > 0) {
    yearBlocks.push({ year: currentYear, months: currentMonths });
  }

  console.log(`Znaleziono bloki roczne: ${yearBlocks.map(b => `${b.year}(${b.months.length}m)`).join(", ")}`);

  const locationRows: { name: string; prognozaRow: number; przychodyRow: number }[] = [];
  for (let r = 1; r < data.length; r++) {
    const label = String(data[r][0] || "").trim();
    const labelUpper = label.toUpperCase();
    if (["GRAND BALTIC", "BULWAR PORTOWY", "WCZASOWA", "NA WYDMIE", "PRZEWŁOKA", "LUXURO PARK", "RAZEM:"].includes(labelUpper) || labelUpper === "RAZEM:") {
      const next1 = String(data[r + 1]?.[0] || "").trim().toLowerCase();
      const next2 = String(data[r + 2]?.[0] || "").trim().toLowerCase();
      if (next1 === "prognoza" && next2 === "przychody") {
        const name = labelUpper === "RAZEM:" ? "RAZEM" : labelUpper;
        locationRows.push({ name, prognozaRow: r + 1, przychodyRow: r + 2 });
      }
    }
  }
  console.log(`Lokalizacje: ${locationRows.map(l => l.name).join(", ")}`);

  await db.delete(revenueForecasts);
  console.log("  Wyczyszczono starą tabelę prognoz");

  const forecastsToInsert: any[] = [];
  let imported = 0;

  for (const loc of locationRows) {
    for (const block of yearBlocks) {
      for (const mc of block.months) {
        const forecastVal = Number(data[loc.prognozaRow]?.[mc.col]) || 0;
        const actualVal = Number(data[loc.przychodyRow]?.[mc.col]) || 0;
        if (forecastVal === 0 && actualVal === 0) continue;

        forecastsToInsert.push({
          year: block.year, month: mc.month,
          locationName: loc.name, apartmentId: null,
          forecast: String(Math.round(forecastVal * 100) / 100),
          actual: String(Math.round(actualVal * 100) / 100),
        });
        imported++;
      }
    }
  }

  if (forecastsToInsert.length > 0) {
    const batchSize = 500;
    for (let i = 0; i < forecastsToInsert.length; i += batchSize) {
      const batch = forecastsToInsert.slice(i, i + batchSize);
      await db.insert(revenueForecasts).values(batch);
    }
  }

  const yearSummary: Record<number, number> = {};
  for (const f of forecastsToInsert) {
    yearSummary[f.year] = (yearSummary[f.year] || 0) + 1;
  }
  console.log(`  Zaimportowano ${imported} rekordów prognoz`);
  console.log(`  Per rok: ${Object.entries(yearSummary).map(([y, c]) => `${y}: ${c}`).join(", ")}`);

  return { imported, yearSummary };
}

async function main() {
  try {
    const costResult = await importCosts();
    const forecastResult = await importRevenueForecasts();

    console.log("\n=== PODSUMOWANIE ===");
    console.log(`Koszty: ${costResult.imported} zaimportowanych, ${costResult.skipped} pominiętych`);
    console.log(`Prognozy: ${forecastResult.imported} zaimportowanych`);

    const expCount = await db.select({ count: sql<number>`count(*)` }).from(expenses);
    const rfCount = await db.select({ count: sql<number>`count(*)` }).from(revenueForecasts);
    console.log(`\nStan bazy: Expenses=${expCount[0].count}, Revenue Forecasts=${rfCount[0].count}`);
  } catch (err) {
    console.error("BŁĄD:", err);
  }
  process.exit(0);
}

main();
