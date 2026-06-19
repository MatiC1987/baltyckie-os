import { pool } from "../server/db";

async function run() {
  const client = await pool.connect();
  try {
    console.log("Checking current state of duplicate apartments...");

    const before = await client.query(`
      SELECT a.id, a.name, a.location, a.hotres_name, a.active,
        COUNT(r.id) as res_count, COALESCE(SUM(r.price),0) as sum_price
      FROM apartments a
      LEFT JOIN reservations r ON r.apartment_id = a.id
      WHERE (a.location IS NULL OR a.location = '') AND a.active = true
      GROUP BY a.id, a.name, a.location, a.hotres_name, a.active
      ORDER BY a.id
    `);
    console.log("Unassigned active apartments before fix:");
    console.table(before.rows);

    if (before.rows.length === 0) {
      console.log("No unassigned active apartments found — nothing to fix.");
      return;
    }

    await client.query("BEGIN");

    // Mapping: duplicate id → correct target id (derived from name matching)
    // 109 Studio min → 130 (109 - Studio mini, GRAND BALTIC)
    // 208 Studio min → 158 (208 - Studio mini, GRAND BALTIC)
    // 209 Studio min → 133 (209 - Studio mini, GRAND BALTIC)
    // Słoneczna Oaza 2 - 6 → 153 (Słoneczna Oaza 2, PRZEWŁOKA)

    const nameToTarget: Record<string, number> = {
      "109 - 4os studio min": 130,
      "208 - 4os studio min": 158,
      "209 - 4os studio min": 133,
      "słoneczna oaza 2 - 6": 153,
    };

    let totalMoved = 0;
    const toDeactivate: number[] = [];

    for (const row of before.rows) {
      const nameLower = row.name.toLowerCase().trim();
      const targetId = nameToTarget[nameLower];

      if (targetId) {
        const resCount = parseInt(row.res_count);
        if (resCount > 0) {
          const moved = await client.query(
            "UPDATE reservations SET apartment_id = $1 WHERE apartment_id = $2",
            [targetId, row.id]
          );
          console.log(`  Moved ${moved.rowCount} reservations: apt ${row.id} (${row.name}) → ${targetId}`);
          totalMoved += moved.rowCount ?? 0;
        } else {
          console.log(`  Apt ${row.id} (${row.name}): 0 reservations, will deactivate`);
        }
        toDeactivate.push(row.id);
      } else {
        console.log(`  Apt ${row.id} (${row.name}): no target mapping — skipping`);
      }
    }

    // Fix hotres_name on existing apartments to match exact HotRes room names
    const hotresUpdates: [string, number][] = [
      ["109 - 4os Studio min", 130],
      ["208 - 4os Studio min", 158],
      ["209 - 4os Studio min", 133],
      ["Słoneczna Oaza 2 - 6",  153],
    ];
    for (const [newName, aptId] of hotresUpdates) {
      const r = await client.query(
        "UPDATE apartments SET hotres_name = $1 WHERE id = $2",
        [newName, aptId]
      );
      console.log(`  Updated hotres_name on apt ${aptId} → "${newName}" (${r.rowCount} row)`);
    }

    // Deactivate duplicate apartments
    if (toDeactivate.length > 0) {
      const r = await client.query(
        "UPDATE apartments SET active = false WHERE id = ANY($1::int[])",
        [toDeactivate]
      );
      console.log(`  Deactivated ${r.rowCount} duplicate apartments: [${toDeactivate.join(", ")}]`);
    }

    await client.query("COMMIT");
    console.log(`\nDone! Moved ${totalMoved} reservations total.`);

    const after = await client.query(`
      SELECT a.id, a.name, a.location, a.active, COUNT(r.id) as res_count
      FROM apartments a
      LEFT JOIN reservations r ON r.apartment_id = a.id
      WHERE (a.location IS NULL OR a.location = '')
      GROUP BY a.id, a.name, a.location, a.active
      ORDER BY a.id
    `);
    console.log("\nUnassigned apartments after fix:");
    console.table(after.rows);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error — rolled back:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
