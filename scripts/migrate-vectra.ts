import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Running Vectra migration...");

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS vectra_accounts (
      id SERIAL PRIMARY KEY,
      label TEXT NOT NULL,
      username TEXT NOT NULL,
      password_encrypted TEXT NOT NULL,
      last_sync_at TIMESTAMP,
      last_sync_status TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `));
  console.log("  vectra_accounts table: OK");

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS vectra_invoices (
      id SERIAL PRIMARY KEY,
      vectra_account_id INTEGER NOT NULL REFERENCES vectra_accounts(id) ON DELETE CASCADE,
      invoice_number TEXT NOT NULL,
      invoice_date DATE,
      amount DECIMAL(10,2),
      period TEXT,
      object_path TEXT,
      downloaded_at TIMESTAMP DEFAULT NOW()
    )
  `));
  console.log("  vectra_invoices table: OK");

  console.log("Vectra migration complete.");
}

migrate().catch(e => { console.error(e); process.exit(1); });
