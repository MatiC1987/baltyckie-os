import { pool } from "./db";
import { Storage } from "@google-cloud/storage";

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

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function getStorageClient() {
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
}

async function loadDataFromObjectStorage(): Promise<Record<string, any[]> | null> {
  try {
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    if (!bucketId || !privateDir) {
      console.log("[migrate] Object Storage env vars not set, skipping");
      return null;
    }

    let objectName = privateDir;
    if (objectName.startsWith('/')) objectName = objectName.slice(1);
    if (objectName.startsWith(bucketId + '/')) objectName = objectName.slice(bucketId.length + 1);
    if (objectName.startsWith('/')) objectName = objectName.slice(1);
    objectName = objectName + '/dev-data-export.json';

    console.log(`[migrate] Looking for data in bucket=${bucketId}, object=${objectName}`);
    const storage = getStorageClient();
    const bucket = storage.bucket(bucketId);
    const file = bucket.file(objectName);

    const [exists] = await file.exists();
    if (!exists) {
      console.log("[migrate] dev-data-export.json not found in Object Storage, skipping");
      return null;
    }

    console.log("[migrate] Loading data from Object Storage...");
    const [buffer] = await file.download();
    const data = JSON.parse(buffer.toString("utf-8"));
    console.log("[migrate] Data loaded from Object Storage successfully");
    return data;
  } catch (err) {
    console.error("[migrate] Failed to load from Object Storage:", err);
    return null;
  }
}

export async function runProdDataMigration() {
  const checkResult = await pool.query("SELECT count(*) as cnt FROM apartments");
  const existingCount = parseInt(checkResult.rows[0].cnt);
  if (existingCount > 10) {
    console.log(`[migrate] Production already has ${existingCount} apartments, skipping migration`);
    return;
  }

  const data = await loadDataFromObjectStorage();
  if (!data) {
    console.log("[migrate] No migration data available, skipping");
    return;
  }

  console.log("[migrate] Starting production data migration...");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const table of REVERSE_ORDER) {
      try {
        await client.query(`TRUNCATE TABLE "${table}" CASCADE`);
      } catch (e: any) {
        console.log(`[migrate] Warning: Could not truncate ${table}: ${e.message}`);
      }
    }
    console.log("[migrate] Cleared existing production data");

    for (const table of TABLES_IN_ORDER) {
      const rows = data[table];
      if (!rows || rows.length === 0) continue;

      const columns = Object.keys(rows[0]);
      const colList = columns.map(c => `"${c}"`).join(", ");

      const batchSize = 100;
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values: any[] = [];
        const valueSets: string[] = [];

        batch.forEach((row: any, batchIdx: number) => {
          const placeholders: string[] = [];
          columns.forEach((col, colIdx) => {
            const paramIdx = batchIdx * columns.length + colIdx + 1;
            placeholders.push(`$${paramIdx}`);
            const val = row[col];
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
          try {
            await client.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`);
          } catch (e: any) {
            console.log(`[migrate] Warning: Could not reset sequence for ${table}: ${e.message}`);
          }
        }
        console.log(`[migrate] ${table}: ${inserted} rows`);
      }
    }

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
