import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("Running saldo cost assignment migration...");

  const cols = [
    { name: "ai_category", type: "TEXT" },
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
        `ALTER TABLE saldo_entries ADD COLUMN IF NOT EXISTS ${col.name} ${col.type};`
      ));
      console.log(`  saldo_entries.${col.name}: OK`);
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log(`  saldo_entries.${col.name}: already exists`);
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
