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

    // The duplicate apartment names (lowercased) and the hotres_name prefix
    // to use when searching for the correct original.
    // ILIKE prefix match handles suffix differences like "mini" vs "min", "6os" vs "6".
    const nameToHotresPrefix: Record<string, string> = {
      "109 - 4os studio min": "109 - 4os Studio min",
      "208 - 4os studio min": "208 - 4os Studio min",
      "209 - 4os studio min": "209 - 4os Studio min",
      "słoneczna oaza 2 - 6":  "Słoneczna Oaza 2 - 6",
    };

    // The final hotres_name that HotRes actually sends for each prefix.
    // After moving reservations we must set this exactly on the original.
    const hotresPrefix: string[] = [
      "109 - 4os Studio min",
      "208 - 4os Studio min",
      "209 - 4os Studio min",
      "Słoneczna Oaza 2 - 6",
    ];

    // Log what originals look like before any changes (helps debug)
    for (const prefix of hotresPrefix) {
      const { rows } = await client.query(
        `SELECT id, name, location, hotres_name FROM apartments
         WHERE hotres_name ILIKE $1 AND (location IS NOT NULL AND location <> '') AND active = true`,
        [prefix + "%"]
      );
      console.log(`[fix-duplicates]  Original for prefix "${prefix}":`, rows);
    }

    await client.query("BEGIN");

    const toDeactivate: number[] = [];

    for (const dup of duplicates) {
      const key = dup.name.toLowerCase().trim();
      const hotresPrefix = nameToHotresPrefix[key];
      if (!hotresPrefix) {
        console.log(`[fix-duplicates]  Apt ${dup.id} "${dup.name}": no mapping, skipping.`);
        continue;
      }

      // Find the original using ILIKE prefix — handles "mini" vs "min", "6os" vs "6"
      const { rows: originals } = await client.query<{ id: number; name: string; location: string; hotres_name: string }>(
        `SELECT id, name, location, hotres_name
         FROM apartments
         WHERE hotres_name ILIKE $1
           AND (location IS NOT NULL AND location <> '')
           AND active = true
         LIMIT 1`,
        [hotresPrefix + "%"]
      );

      if (originals.length === 0) {
        console.log(`[fix-duplicates]  Apt ${dup.id}: no original found for prefix "${hotresPrefix}%", skipping.`);
        continue;
      }

      const original = originals[0];

      // Move all reservations from duplicate → original
      const moved = await client.query(
        "UPDATE reservations SET apartment_id = $1 WHERE apartment_id = $2",
        [original.id, dup.id]
      );
      console.log(`[fix-duplicates]  Moved ${moved.rowCount} reservations: apt ${dup.id} → ${original.id} (${original.name})`);

      // Set hotres_name on original to the EXACT value HotRes sends (the prefix itself)
      await client.query(
        "UPDATE apartments SET hotres_name = $1 WHERE id = $2",
        [hotresPrefix, original.id]
      );
      console.log(`[fix-duplicates]  Set hotres_name on apt ${original.id} → "${hotresPrefix}"`);

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
