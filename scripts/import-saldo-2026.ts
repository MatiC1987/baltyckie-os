import XLSX from "xlsx";
import { db } from "../server/db";
import { saldoEntries, saldoInitialBalances, saldoCategories } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PERSON_NAME = "Małgorzata Latasiewicz";
const INITIAL_BALANCE_2026 = "28950.70";
const JAN_1_2026_SERIAL = 46023;

const TYPO_MAP: Record<string, string> = {
  "WYPŁAZA": "WYPŁATA",
  "PRZYKAZD": "PRZYJAZD",
  "ZALKUPY": "ZAKUPY",
};

const PREDEFINED_CATEGORIES = [
  "SPRZĄTANIE", "ZAKUPY", "WYPŁATA", "PALIWO", "ZALICZKA",
  "ZWROT", "ENERGIA", "WODA", "MAGIEL", "MEDIA",
  "OPŁATA KLIMATYCZNA", "PRZYJAZD", "POBYT", "PRZEDPŁATA",
  "ZWROT PRZEDPŁATY",
];

function normalizeCategory(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let val = raw.trim().toUpperCase();
  if (TYPO_MAP[val]) val = TYPO_MAP[val];
  return val || null;
}

function serialToDateStr(serial: number): string {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return d.toISOString().split("T")[0];
}

async function main() {
  const filePath = path.resolve(__dirname, "../attached_assets/GOSIA_-_SALDO_1773914326025.xlsx");
  console.log("Reading file:", filePath);

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets["Saldo"];
  if (!ws) {
    console.error("Sheet 'Saldo' not found!");
    process.exit(1);
  }

  const range = XLSX.utils.decode_range(ws["!ref"]!);
  const entries: any[] = [];

  for (let r = 3; r <= range.e.r; r++) {
    const dateCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (!dateCell || typeof dateCell.v !== "number" || dateCell.v < JAN_1_2026_SERIAL) continue;

    const opCell = ws[XLSX.utils.encode_cell({ r, c: 1 })];
    const opName = opCell?.v ? String(opCell.v).trim() : "";
    if (!opName || opName === "SALDO POCZĄTKOWE") continue;

    const dateStr = serialToDateStr(dateCell.v);
    const resNum = ws[XLSX.utils.encode_cell({ r, c: 2 })]?.v;
    const guest = ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v;
    const rodzaj = ws[XLSX.utils.encode_cell({ r, c: 4 })]?.v;
    const payment = ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v;
    const kf = ws[XLSX.utils.encode_cell({ r, c: 6 })]?.v;
    const fv = ws[XLSX.utils.encode_cell({ r, c: 7 })]?.v;
    const cashRaw = ws[XLSX.utils.encode_cell({ r, c: 8 })]?.v;
    const saldoRaw = ws[XLSX.utils.encode_cell({ r, c: 9 })]?.v;
    const authCode = ws[XLSX.utils.encode_cell({ r, c: 10 })]?.v;
    const cardRaw = ws[XLSX.utils.encode_cell({ r, c: 11 })]?.v;
    const notes = ws[XLSX.utils.encode_cell({ r, c: 12 })]?.v;

    const cashAmount = cashRaw !== undefined && cashRaw !== "" && cashRaw !== null ? Number(cashRaw) : null;
    const cardAmount = cardRaw !== undefined && cardRaw !== "" && cardRaw !== null ? Number(cardRaw) : null;
    const saldoVal = saldoRaw !== undefined && saldoRaw !== "" && saldoRaw !== null ? Number(saldoRaw) : null;

    const normalizedType = normalizeCategory(rodzaj ? String(rodzaj) : null);
    const isCost = (cashAmount !== null && cashAmount < 0) || (cardAmount !== null && cardAmount < 0);
    const entryKind = isCost ? "KOSZT" : "PRZYCHOD";

    entries.push({
      date: dateStr,
      operationName: opName,
      reservationNumber: resNum ? String(resNum).trim() : null,
      guestName: guest ? String(guest).trim() : null,
      type: normalizedType,
      paymentMethod: payment ? String(payment).trim().toUpperCase() : null,
      kasaFiskalna: kf ? String(kf).trim().toUpperCase() : null,
      faktura: fv ? String(fv).trim().toUpperCase() : null,
      cashAmount: cashAmount !== null ? cashAmount.toFixed(2) : null,
      saldo: saldoVal !== null ? saldoVal.toFixed(2) : null,
      authCode: authCode ? String(authCode).trim() : null,
      cardAmount: cardAmount !== null ? cardAmount.toFixed(2) : null,
      notes: notes ? String(notes).trim() : null,
      entryKind,
      category: isCost ? normalizedType : null,
      personName: PERSON_NAME,
    });
  }

  console.log(`Found ${entries.length} entries from 2026`);

  console.log("Running import in a single transaction...");
  await db.transaction(async (tx) => {
    const existing = await tx.select().from(saldoEntries)
      .where(eq(saldoEntries.personName, PERSON_NAME));
    console.log(`  Existing entries for ${PERSON_NAME}: ${existing.length}`);

    if (existing.length > 0) {
      console.log("  Deleting existing entries...");
      await tx.delete(saldoEntries).where(eq(saldoEntries.personName, PERSON_NAME));
    }

    console.log("  Setting initial balance to", INITIAL_BALANCE_2026);
    const existingBal = await tx.select().from(saldoInitialBalances)
      .where(eq(saldoInitialBalances.personName, PERSON_NAME));
    if (existingBal.length > 0) {
      await tx.update(saldoInitialBalances)
        .set({ initialBalance: INITIAL_BALANCE_2026 })
        .where(eq(saldoInitialBalances.personName, PERSON_NAME));
    } else {
      await tx.insert(saldoInitialBalances).values({
        personName: PERSON_NAME,
        initialBalance: INITIAL_BALANCE_2026,
      });
    }

    console.log("  Inserting entries in batches...");
    const batchSize = 100;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      await tx.insert(saldoEntries).values(batch);
      console.log(`    Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entries.length / batchSize)}`);
    }

    console.log("  Setting up predefined categories...");
    await tx.delete(saldoCategories).where(eq(saldoCategories.personName, PERSON_NAME));
    for (const catName of PREDEFINED_CATEGORIES) {
      await tx.insert(saldoCategories).values({ name: catName, personName: PERSON_NAME });
    }
    console.log(`  Inserted ${PREDEFINED_CATEGORIES.length} predefined categories`);
  });

  console.log("\n=== IMPORT COMPLETE ===");
  console.log(`Entries imported: ${entries.length}`);
  console.log(`Initial balance: ${INITIAL_BALANCE_2026} PLN`);
  console.log(`Categories created: ${PREDEFINED_CATEGORIES.length}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
