import { pool } from "./db";

const SCHEMA_MIGRATIONS = [
  {
    name: "add_saldo_entries_created_by",
    sql: `ALTER TABLE saldo_entries ADD COLUMN IF NOT EXISTS created_by text;
          UPDATE saldo_entries SET created_by = 'Małgorzata Latasiewicz' WHERE person_name = 'Małgorzata Latasiewicz' AND created_by IS NULL;`,
  },
  {
    name: "add_saldo_categories_type",
    sql: `ALTER TABLE saldo_categories ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'KOSZT';`,
  },
];

export async function runProdSchemaMigration() {
  console.log("[schema-migrate] Running production schema migrations...");
  for (const migration of SCHEMA_MIGRATIONS) {
    try {
      await pool.query(migration.sql);
      console.log(`[schema-migrate] Applied: ${migration.name}`);
    } catch (e: any) {
      console.error(`[schema-migrate] Failed: ${migration.name}: ${e.message}`);
    }
  }
  console.log("[schema-migrate] Schema migrations complete");
  console.log("[schema-migrate] Production data is protected, skipping destructive sync");
}
