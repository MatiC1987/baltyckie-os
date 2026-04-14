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
  {
    name: "create_extra_revenues",
    sql: `CREATE TABLE IF NOT EXISTS extra_revenues (
      id SERIAL PRIMARY KEY,
      description TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'planowany',
      category TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );`,
  },
  {
    name: "add_employee_hide_from_rcp",
    sql: `ALTER TABLE employees ADD COLUMN IF NOT EXISTS hide_from_rcp boolean NOT NULL DEFAULT false;
          UPDATE employees SET hide_from_rcp = true WHERE position = 'ZARZADCA' AND hide_from_rcp = false;`,
  },
  {
    name: "add_issues_photo_urls",
    sql: `ALTER TABLE issues ADD COLUMN IF NOT EXISTS photo_urls text[];`,
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
