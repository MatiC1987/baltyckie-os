/**
 * One-time seed: registers the ANEKS document template in the database.
 * Runs at startup in production if the template doesn't exist yet.
 * The DOCX file is already uploaded to object storage during CI/CD.
 */

import { db } from "./db";
import { documentTemplates } from "../shared/schema";
import { eq, and } from "drizzle-orm";

export async function seedAneksTemplate() {
  try {
    const existing = await db
      .select({ id: documentTemplates.id, templateType: documentTemplates.templateType })
      .from(documentTemplates)
      .where(eq(documentTemplates.name, "Aneks do umowy podnajmu"));

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(documentTemplates)
        .values({
          name: "Aneks do umowy podnajmu",
          fileName: "szablon_aneksu_podnajmu.docx",
          objectPath: "/objects/templates/szablon_aneksu_podnajmu.docx",
          description:
            "Szablon aneksu — przedłużenie okresu i/lub zmiana czynszu. Paragraf §2 (harmonogram płatności) wypełnić ręcznie w edytorze tekstu.",
          templateType: "ANEKS",
        })
        .returning();
      console.log(`[seed-aneks] Inserted ANEKS template id=${inserted.id}`);
    } else {
      console.log(`[seed-aneks] ANEKS template already exists id=${existing[0].id}`);
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
