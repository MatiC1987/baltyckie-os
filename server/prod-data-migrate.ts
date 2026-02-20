import { pool } from "./db";
import * as fs from "fs";
import * as path from "path";

const TABLES_IN_ORDER = [
  "locations", "owners", "apartments", "accounts", "saldo_categories",
  "employees", "document_categories", "service_contract_categories",
  "leases", "reservations", "subleases", "expenses",
  "sublease_payments", "sublease_attachments", "sublease_apartment_changes",
  "sublease_meter_settings", "sublease_meter_readings", "sublease_meter_prices",
  "account_snapshots", "accounting_notes", "activity_logs", "app_users",
  "attachments", "blockades", "company_settings",
  "cost_invoices", "cost_schedules", "cost_schedule_payments",
  "document_templates", "handover_protocols",
  "handover_protocol_items", "handover_protocol_meters", "handover_protocol_rooms",
  "import_metadata", "installment_schedules", "installment_payments",
  "invoices", "medical_exams", "media_settlement_reports",
  "notifications", "owner_payments", "revenue_forecasts",
  "saldo_entries", "saldo_initial_balances",
  "service_contracts", "service_contract_attachments",
  "technical_inspections", "user_preferences", "zip_download_history",
];

const REVERSE_ORDER = [...TABLES_IN_ORDER].reverse();

export async function runProdDataMigration() {
  const candidates = [
    path.resolve(process.cwd(), "dist", "dev-data-export.json"),
    path.resolve(process.cwd(), "server", "dev-data-export.json"),
    path.resolve(process.cwd(), "dev-data-export.json"),
    path.join(__dirname, "..", "server", "dev-data-export.json"),
    path.join(__dirname, "dev-data-export.json"),
    path.join(__dirname, "..", "dist", "dev-data-export.json"),
  ];
  
  let filePath: string | null = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { filePath = p; break; }
  }
  
  if (!filePath) {
    console.log("[migrate] No dev-data-export.json found, skipping migration");
    return;
  }

  const checkResult = await pool.query("SELECT count(*) as cnt FROM apartments");
  const existingCount = parseInt(checkResult.rows[0].cnt);
  if (existingCount > 10) {
    console.log(`[migrate] Production already has ${existingCount} apartments, skipping migration`);
    return;
  }

  console.log("[migrate] Starting production data migration...");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: Record<string, any[]> = JSON.parse(raw);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET session_replication_role = 'replica'");

    for (const table of REVERSE_ORDER) {
      await client.query(`DELETE FROM "${table}"`);
    }
    console.log("[migrate] Cleared existing production data");

    for (const table of TABLES_IN_ORDER) {
      const rows = data[table];
      if (!rows || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `"${c}"`).join(", ");

      const batchSize = 200;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values: any[] = [];
        const valueSets: string[] = [];

        batch.forEach((row, batchIdx) => {
          const placeholders: string[] = [];
          columns.forEach((col, colIdx) => {
            const paramIdx = batchIdx * columns.length + colIdx + 1;
            placeholders.push(`$${paramIdx}`);
            let val = row[col];
            if (Array.isArray(val)) {
              val = val;
            }
            values.push(val);
          });
          valueSets.push(`(${placeholders.join(", ")})`);
        });

        const sql = `INSERT INTO "${table}" (${colList}) VALUES ${valueSets.join(", ")} ON CONFLICT DO NOTHING`;
        await client.query(sql, values);
        inserted += batch.length;
      }

      if (inserted > 0) {
        const hasId = columns.includes("id");
        if (hasId) {
          await client.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`);
        }
        console.log(`[migrate] ${table}: ${inserted} rows`);
      }
    }

    await client.query("SET session_replication_role = 'origin'");
    await client.query("COMMIT");
    console.log("[migrate] Production data migration complete!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[migrate] Migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
