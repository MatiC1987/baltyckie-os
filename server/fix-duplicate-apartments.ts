import { pool } from "./db";

/**
 * One-time startup migration: merges duplicate no-location apartments into
 * their correct originals. Safe to run multiple times — exits immediately
 * if no unassigned active apartments are found.
 */
export async function fixDuplicateApartments() {
  const client = await pool.connect();
  try {
    const { rows: duplicates } = await client.query<{
      id: number;
      name: string;
    }>(`
      SELECT id, name
      FROM apartments
      WHERE (location IS NULL OR location = '') AND active = true
    `);

    if (duplicates.length === 0) {
      console.log("[fix-duplicates] No unassigned active apartments — skipping.");
      return;
    }

    console.log(`[fix-duplicates] Found ${duplicates.length} unassigned active apartments — fixing…`);

    // Name-based mapping (lowercase) to the correct hotres_name that should be
    // set on the existing original apartment.
    const nameToHotresName: Record<string, string> = {
      "109 - 4os studio min": "109 - 4os Studio min",
      "208 - 4os studio min": "208 - 4os Studio min",
      "209 - 4os studio min": "209 - 4os Studio min",
      "słoneczna oaza 2 - 6":  "Słoneczna Oaza 2 - 6",
    };

    await client.query("BEGIN");

    const toDeactivate: number[] = [];

    for (const dup of duplicates) {
      const key = dup.name.toLowerCase().trim();
      const correctHotresName = nameToHotresName[key];
      if (!correctHotresName) {
        console.log(`[fix-duplicates]  Apt ${dup.id} "${dup.name}": no mapping, skipping.`);
        continue;
      }

      // Find the "original" apartment: has the same hotres_name pattern,
      // a real location set, and is active.
      const { rows: originals } = await client.query<{ id: number; name: string; location: string }>(
        `SELECT id, name, location
         FROM apartments
         WHERE LOWER(hotres_name) = LOWER($1)
           AND (location IS NOT NULL AND location <> '')
           AND active = true
         LIMIT 1`,
        [correctHotresName]
      );

      if (originals.length === 0) {
        // No match by hotres_name yet — try partial name match as fallback
        console.log(`[fix-duplicates]  Apt ${dup.id}: no original by hotres_name "${correctHotresName}", skipping.`);
        continue;
      }

      const original = originals[0];

      // Move all reservations from duplicate → original
      const moved = await client.query(
        "UPDATE reservations SET apartment_id = $1 WHERE apartment_id = $2",
        [original.id, dup.id]
      );
      console.log(`[fix-duplicates]  Moved ${moved.rowCount} reservations: apt ${dup.id} → ${original.id} (${original.name})`);

      // Ensure original's hotres_name exactly matches what HotRes sends
      await client.query(
        "UPDATE apartments SET hotres_name = $1 WHERE id = $2",
        [correctHotresName, original.id]
      );
      console.log(`[fix-duplicates]  Set hotres_name on apt ${original.id} → "${correctHotresName}"`);

      toDeactivate.push(dup.id);
    }

    if (toDeactivate.length > 0) {
      const r = await client.query(
        "UPDATE apartments SET active = false WHERE id = ANY($1::int[])",
        [toDeactivate]
      );
      console.log(`[fix-duplicates]  Deactivated ${r.rowCount} duplicate apartments: [${toDeactivate.join(", ")}]`);
    }

    await client.query("COMMIT");
    console.log("[fix-duplicates] Done.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[fix-duplicates] Error — rolled back:", err);
    throw err;
  } finally {
    client.release();
  }
}
