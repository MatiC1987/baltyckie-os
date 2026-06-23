import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Running Vectra sync log migration...");

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS vectra_sync_log (
      id SERIAL PRIMARY KEY,
      synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
      mode TEXT NOT NULL DEFAULT 'manual',
      new_invoices INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      error_details TEXT,
      accounts TEXT
    )
  `));
  console.log("  vectra_sync_log table: OK");

  console.log("Vectra sync log migration complete.");
}

migrate().catch(e => { console.error(e); process.exit(1); });
