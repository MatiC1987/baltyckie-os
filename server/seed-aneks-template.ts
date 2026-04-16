/**
 * One-time seed: registers the ANEKS document template in the database.
 * Runs at startup in production if the template doesn't exist yet.
 * Verifies the DOCX file exists in object storage before inserting DB record.
 */

import { db } from "./db";
import { documentTemplates } from "../shared/schema";
import { eq, and } from "drizzle-orm";
import { Storage } from "@google-cloud/storage";

const SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

function getObjectStorageClient() {
  return new Storage({
    credentials: {
      audience: "replit",
      subject_token_type: "access_token",
      token_url: `${SIDECAR_ENDPOINT}/token`,
      type: "external_account",
      credential_source: {
        url: `${SIDECAR_ENDPOINT}/credential`,
        format: { type: "json", subject_token_field_name: "access_token" },
      },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
}

async function verifyObjectExists(objectPath: string): Promise<boolean> {
  try {
    const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!privateDir) return false;
    const normalized = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
    const parts = normalized.split("/");
    const bucketName = parts[0];
    const privatePrefix = parts.slice(1).join("/");

    // objectPath is like /objects/templates/file.docx → entityId = templates/file.docx
    const entityId = objectPath.replace(/^\/objects\//, "");
    const objectName = `${privatePrefix}/${entityId}`;

    const client = getObjectStorageClient();
    const [exists] = await client.bucket(bucketName).file(objectName).exists();
    console.log(`[seed-aneks] Storage check: ${objectName} exists=${exists}`);
    return exists;
  } catch (err) {
    console.error("[seed-aneks] Storage check error:", err);
    return false;
  }
}

const ANEKS_OBJECT_PATH = "/objects/templates/szablon_aneksu_podnajmu.docx";

export async function seedAneksTemplate() {
  try {
    // Verify the DOCX file exists in object storage before touching the DB
    const fileExists = await verifyObjectExists(ANEKS_OBJECT_PATH);
    if (!fileExists) {
      console.error(
        `[seed-aneks] DOCX not found in object storage (${ANEKS_OBJECT_PATH}). ` +
        "Run scripts/seed-annex-template.ts to upload it first. Skipping DB seed."
      );
      return;
    }

    const existing = await db
      .select({ id: documentTemplates.id, objectPath: documentTemplates.objectPath, templateType: documentTemplates.templateType })
      .from(documentTemplates)
      .where(eq(documentTemplates.name, "Aneks do umowy podnajmu"));

    if (existing.length > 0) {
      const row = existing[0];
      // Self-heal: if row is correct, skip; otherwise delete ALL stale rows and re-insert
      const needsUpdate =
        existing.length > 1 ||
        row.objectPath !== ANEKS_OBJECT_PATH ||
        row.templateType !== "ANEKS";

      if (!needsUpdate) {
        console.log(`[seed-aneks] ANEKS template ok (id=${row.id}), skipping`);
        // Fall through to NOTA fix
      } else {
        console.log(`[seed-aneks] Replacing ${existing.length} stale ANEKS record(s)...`);
        // Delete ALL rows with this name (handles duplicates)
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

    // Fix Nota templateType unconditionally (regardless of current value)
    const notaUpdated = await db
      .update(documentTemplates)
      .set({ templateType: "NOTA" })
      .where(eq(documentTemplates.fileName, "nota_ksiegowa.docx"))
      .returning();

    if (notaUpdated.length > 0) {
      console.log(`[seed-aneks] Fixed NOTA templateType for id=${notaUpdated[0].id}`);
    }
  } catch (err) {
    console.error("[seed-aneks] Seed error (non-fatal):", err);
  }
}
