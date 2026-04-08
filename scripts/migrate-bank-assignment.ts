import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Running bank assignment migration...");

  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS bank_mapping_rules (
      id SERIAL PRIMARY KEY,
      pattern TEXT NOT NULL,
      match_field TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_cat_id TEXT,
      target_item_idx INTEGER,
      target_entry_id TEXT,
      target_category TEXT,
      target_sublease_id INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `));
  console.log("  bank_mapping_rules table: OK");

  const cols = [
    { name: "cost_imported", type: "BOOLEAN DEFAULT FALSE" },
    { name: "cost_skipped", type: "BOOLEAN DEFAULT FALSE" },
    { name: "cost_target_type", type: "TEXT" },
    { name: "cost_target_cat_id", type: "TEXT" },
    { name: "cost_target_item_idx", type: "INTEGER" },
    { name: "cost_target_entry_id", type: "TEXT" },
    { name: "cost_target_category", type: "TEXT" },
    { name: "cost_target_sublease_payment_id", type: "INTEGER" },
  ];

  for (const col of cols) {
    try {
      await db.execute(sql.raw(
        `ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
      ));
      console.log(`  bank_transactions.${col.name}: OK`);
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log(`  bank_transactions.${col.name}: already exists`);
      } else {
        throw e;
      }
    }
  }

  console.log("Migration complete.");
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
