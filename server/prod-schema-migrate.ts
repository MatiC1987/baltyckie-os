import { pool } from "./db";
import saldoSyncData from "./saldo-sync-data.json";

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

async function syncSaldoData() {
  const devData = saldoSyncData as any;
  if (!devData?.saldo_entries?.length) {
    console.log("[saldo-sync] No sync data available, skipping");
    return;
  }

  const { rows: existing } = await pool.query("SELECT COUNT(*)::int as cnt FROM saldo_entries");
  const devCount = devData.saldo_entries.length;

  if (existing[0].cnt >= devCount) {
    console.log(`[saldo-sync] Production has ${existing[0].cnt} entries (dev has ${devCount}), skipping`);
    return;
  }

  console.log(`[saldo-sync] Production has ${existing[0].cnt} entries, dev has ${devCount}. Syncing...`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("DELETE FROM saldo_entries");

    const entries = devData.saldo_entries;
    if (entries && entries.length > 0) {
      const batchSize = 50;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        const values: any[] = [];
        const valueSets: string[] = [];

        batch.forEach((row: any, batchIdx: number) => {
          const paramBase = batchIdx * 18;
          valueSets.push(`($${paramBase+1},$${paramBase+2},$${paramBase+3},$${paramBase+4},$${paramBase+5},$${paramBase+6},$${paramBase+7},$${paramBase+8},$${paramBase+9},$${paramBase+10},$${paramBase+11},$${paramBase+12},$${paramBase+13},$${paramBase+14},$${paramBase+15},$${paramBase+16},$${paramBase+17},$${paramBase+18})`);
          values.push(
            row.id, row.date, row.operation_name, row.reservation_number, row.guest_name,
            row.type, row.payment_method, row.kasa_fiskalna, row.faktura,
            row.cash_amount, row.saldo, row.auth_code, row.card_amount, row.notes,
            row.entry_kind, row.category, row.person_name, row.created_by
          );
        });

        await client.query(
          `INSERT INTO saldo_entries (id, date, operation_name, reservation_number, guest_name, type, payment_method, kasa_fiskalna, faktura, cash_amount, saldo, auth_code, card_amount, notes, entry_kind, category, person_name, created_by) VALUES ${valueSets.join(", ")} ON CONFLICT (id) DO NOTHING`,
          values
        );
      }

      await client.query(`SELECT setval(pg_get_serial_sequence('saldo_entries', 'id'), COALESCE((SELECT MAX(id) FROM saldo_entries), 1))`);
    }

    if (devData.saldo_initial_balances?.length > 0) {
      await client.query("DELETE FROM saldo_initial_balances");
      for (const b of devData.saldo_initial_balances) {
        await client.query(
          `INSERT INTO saldo_initial_balances (id, person_name, initial_balance) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET initial_balance = $3`,
          [b.id, b.person_name, b.initial_balance]
        );
      }
      await client.query(`SELECT setval(pg_get_serial_sequence('saldo_initial_balances', 'id'), COALESCE((SELECT MAX(id) FROM saldo_initial_balances), 1))`);
    }

    if (devData.saldo_categories?.length > 0) {
      await client.query("DELETE FROM saldo_categories");
      for (const c of devData.saldo_categories) {
        await client.query(
          `INSERT INTO saldo_categories (id, name, person_name, type) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
          [c.id, c.name, c.person_name, c.type || 'KOSZT']
        );
      }
      await client.query(`SELECT setval(pg_get_serial_sequence('saldo_categories', 'id'), COALESCE((SELECT MAX(id) FROM saldo_categories), 1))`);
    }

    await client.query("COMMIT");
    console.log(`[saldo-sync] Synced ${entries.length} saldo entries to production`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[saldo-sync] Sync failed:", err);
    throw err;
  } finally {
    client.release();
  }
}

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

  try {
    await syncSaldoData();
  } catch (e: any) {
    console.error("[saldo-sync] Error (non-fatal):", e.message);
  }
}
