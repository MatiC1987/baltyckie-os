/**
 * One-time seed: registers the ANEKS document template in the database.
 * Runs at startup in production if the template doesn't exist yet.
 * The DOCX file is already uploaded to object storage during CI/CD.
 */

import { db } from "./db";
import { documentTemplates } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const ANEKS_OBJECT_PATH = "/objects/templates/szablon_aneksu_podnajmu.docx";

export async function seedAneksTemplate() {
  try {
    const existing = await db
      .select({ id: documentTemplates.id, objectPath: documentTemplates.objectPath, templateType: documentTemplates.templateType })
      .from(documentTemplates)
      .where(eq(documentTemplates.name, "Aneks do umowy podnajmu"));

    if (existing.length > 0) {
      const row = existing[0];
      // Self-heal: if existing row has wrong objectPath or templateType, re-seed
      const needsUpdate = row.objectPath !== ANEKS_OBJECT_PATH || row.templateType !== "ANEKS";
      if (!needsUpdate) {
        console.log(`[seed-aneks] ANEKS template ok (id=${row.id}), skipping`);
        // Fall through to NOTA fix
      } else {
        console.log(`[seed-aneks] Stale ANEKS template detected (id=${row.id}), replacing...`);
        await db.delete(documentTemplates).where(eq(documentTemplates.name, "Aneks do umowy podnajmu"));
        const [inserted] = await db
          .insert(documentTemplates)
          .values({
            name: "Aneks do umowy podnajmu",
            fileName: "szablon_aneksu_podnajmu.docx",
            objectPath: ANEKS_OBJECT_PATH,
            description:
              "Szablon aneksu — przedłużenie okresu i/lub zmiana czynszu. Paragraf §2 (harmonogram płatności) wypełnić ręcznie w edytorze tekstu.",
            templateType: "ANEKS",
          })
          .returning();
        console.log(`[seed-aneks] Re-seeded ANEKS template id=${inserted.id}`);
      }
    } else {
      const [inserted] = await db
        .insert(documentTemplates)
        .values({
          name: "Aneks do umowy podnajmu",
          fileName: "szablon_aneksu_podnajmu.docx",
          objectPath: ANEKS_OBJECT_PATH,
          description:
            "Szablon aneksu — przedłużenie okresu i/lub zmiana czynszu. Paragraf §2 (harmonogram płatności) wypełnić ręcznie w edytorze tekstu.",
          templateType: "ANEKS",
        })
        .returning();
      console.log(`[seed-aneks] Inserted ANEKS template id=${inserted.id}`);
    }

    // Fix Nota templateType if it was incorrectly set to UMOWA
    const notaUpdated = await db
      .update(documentTemplates)
      .set({ templateType: "NOTA" })
      .where(
        and(
          eq(documentTemplates.fileName, "nota_ksiegowa.docx"),
          eq(documentTemplates.templateType, "UMOWA")
        )
      )
      .returning();

    if (notaUpdated.length > 0) {
      console.log(`[seed-aneks] Fixed NOTA templateType for id=${notaUpdated[0].id}`);
    }
  } catch (err) {
    console.error("[seed-aneks] Seed error (non-fatal):", err);
  }
}
