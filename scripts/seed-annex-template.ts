import { Storage } from "@google-cloud/storage";
import { db } from "../server/db";
import { documentTemplates } from "../shared/schema";
import { eq } from "drizzle-orm";

const SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const objectStorageClient = new Storage({
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

/**
 * Parses PRIVATE_OBJECT_DIR to extract bucket name and base object path prefix.
 * PRIVATE_OBJECT_DIR = "/bucket-name/.private"
 * Returns { bucketName, privatePrefix: ".private" }
 */
function parsePrivateDir(): { bucketName: string; privatePrefix: string } {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR env var not set");
  const normalized = dir.startsWith("/") ? dir.slice(1) : dir;
  const parts = normalized.split("/");
  return { bucketName: parts[0], privatePrefix: parts.slice(1).join("/") };
}

/**
 * getObjectEntityFile() expects objectPath = "/objects/<entityId>"
 * where entityId is appended to PRIVATE_OBJECT_DIR to get the actual file:
 *   PRIVATE_OBJECT_DIR/<entityId>  →  bucket/.private/<entityId>
 *
 * So to store a file at `.private/templates/foo.docx`:
 *   - Upload to: bucket, objectName = ".private/templates/foo.docx"
 *   - Store objectPath = "/objects/templates/foo.docx"
 */

async function buildAnnexDocx(): Promise<Buffer> {
  const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    Table, TableRow, TableCell, WidthType, BorderStyle,
  } = await import("docx");

  const B = (text: string) => new TextRun({ text, bold: true, size: 24, font: "Times New Roman" });
  const N = (text: string) => new TextRun({ text, size: 24, font: "Times New Roman" });
  const P = (key: string) => new TextRun({ text: `[${key}]`, size: 24, font: "Times New Roman", underline: {} });

  const noBorder = {
    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideH: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
    insideV: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  };

  const sp = (after = 160) => ({ spacing: { after } });

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: "Times New Roman", size: 24 } },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: 1418, right: 1134, bottom: 1134, left: 1134 } },
      },
      children: [
        // City + date (right-aligned)
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [P("MIEJSCOWOSC"), N(", dnia "), P("DATA_ANEKSU"), N(" roku")],
          ...sp(400),
        }),

        // Title block
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [B("ANEKS NR "), P("NUMER_ANEKSU"), B(" do Umowy najmu")],
          ...sp(60),
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [B("pod warunkiem zawieszającym z dnia "), P("DATA_UMOWY_PIERWOTNEJ")],
          ...sp(400),
        }),

        // Preamble
        new Paragraph({
          children: [
            N("Zawarty w dniu "), P("DATA_ANEKSU"), N(" roku w "), P("MIEJSCOWOSC"),
            N(" pomiędzy"),
          ],
          ...sp(200),
        }),

        // Lessor block
        new Paragraph({
          children: [
            P("NAZWA_FIRMY_WYNAJMUJACEGO"),
            N(", z siedzibą w "),
            P("MIEJSCOWOSC"),
            N(" ("),
            P("KOD_POCZTOWY_WYNAJMUJACEGO"),
            N(") przy ul. "),
            P("ULICA_WYNAJMUJACEGO"),
            N(", NIP: "),
            P("NIP_WYNAJMUJACEGO"),
            N(", REGON: "),
            P("REGON_WYNAJMUJACEGO"),
            N(","),
          ],
          ...sp(60),
        }),
        new Paragraph({
          children: [N("zarządzane przez "), P("IMIE_NAZWISKO_WYNAJMUJACEGO"), N(", "), P("STANOWISKO_WYNAJMUJACEGO"), N(".")],
          ...sp(60),
        }),
        new Paragraph({
          children: [B("Zwanym dalej: \"Wynajmujacym\"")],
          ...sp(200),
        }),

        new Paragraph({ children: [N("a")], ...sp(200) }),

        // Lessee block
        new Paragraph({
          children: [
            P("NAZWA_FIRMY_NAJEMCY"),
            N(" z siedzibą "),
            P("ADRES_NAJEMCY"),
            N(", NIP: "),
            P("NIP_NAJEMCY"),
            N("; REGON: "),
            P("REGON_NAJEMCY"),
            N(","),
          ],
          ...sp(60),
        }),
        new Paragraph({ children: [B("Zwaną dalej: \"Najemcą\"")], ...sp(200) }),

        new Paragraph({
          children: [
            N("(dla osoby fizycznej: "),
            P("IMIE_I_NAZWISKO_NAJEMCY"),
            N(", zamieszkałym/ą "),
            P("ADRES_NAJEMCY"),
            N(", PESEL: "),
            P("PESEL"),
            N(", nr dowodu: "),
            P("NR_DOWODU"),
            N(")"),
          ],
          ...sp(200),
        }),

        new Paragraph({
          children: [N("Wynajmujący i Najemca są zwani dalej łącznie \"Stronami\".")],
          ...sp(400),
        }),

        // § 1
        new Paragraph({ alignment: AlignmentType.CENTER, children: [B("§ 1")], ...sp(200) }),
        new Paragraph({
          children: [
            N("Strony zgodnie oświadczają, że przedłużają okres trwania umowy najmu lokalu/lokali "),
            P("NUMER_LOKALU"),
            N(" od dnia "),
            P("DATA_OD"),
            N(" do dnia "),
            P("NOWA_DATA_DO"),
            N("."),
          ],
          ...sp(300),
        }),

        // § 2
        new Paragraph({ alignment: AlignmentType.CENTER, children: [B("§ 2")], ...sp(200) }),
        new Paragraph({
          children: [N("Strony ustaliły, że opłaty miesięczne najmu wynoszą:")],
          ...sp(80),
        }),
        new Paragraph({
          children: [P("NOWA_KWOTA_CZYNSZU"), N(" PLN + "), P("KWOTA_VAT"), N(" VAT")],
          ...sp(80),
        }),
        new Paragraph({
          children: [
            N("Płatność do "),
            P("DZIEN_PLATNOSCI"),
            N(". dnia każdego miesiąca, na rachunek bankowy Wynajmującego nr: "),
            P("NUMER_KONTA"),
          ],
          ...sp(300),
        }),

        // § 3
        new Paragraph({ alignment: AlignmentType.CENTER, children: [B("§ 3. Inne opłaty")], ...sp(200) }),
        new Paragraph({
          children: [
            N("Najemca zobowiązany jest do ponoszenia miesięcznych kosztów mediów zgodnie z warunkami określonymi w umowie pierwotnej lub ustalonych odrębnie."),
          ],
          ...sp(300),
        }),

        // § 4
        new Paragraph({ alignment: AlignmentType.CENTER, children: [B("§ 4")], ...sp(200) }),
        new Paragraph({
          children: [
            N("Strony oświadczają, że dotychczasowe warunki umowy pozostają bez zmian, o ile nie zostały zmienione niniejszym Aneksem."),
          ],
          ...sp(300),
        }),

        // § 5
        new Paragraph({ alignment: AlignmentType.CENTER, children: [B("§ 5")], ...sp(200) }),
        new Paragraph({
          children: [
            N("Aneks Nr "), P("NUMER_ANEKSU"),
            N(" sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron."),
          ],
          ...sp(600),
        }),

        // Signatures
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: noBorder,
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  children: [
                    new Paragraph({ children: [N("Wynajmujący")], ...sp(300) }),
                    new Paragraph({ children: [N("________________________")], ...sp(60) }),
                    new Paragraph({ children: [P("IMIE_NAZWISKO_WYNAJMUJACEGO")], ...sp(0) }),
                    new Paragraph({ children: [P("STANOWISKO_WYNAJMUJACEGO")], ...sp(0) }),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  children: [
                    new Paragraph({ children: [N("Najemca")], ...sp(300) }),
                    new Paragraph({ children: [N("________________________")], ...sp(60) }),
                    new Paragraph({ children: [P("IMIE_I_NAZWISKO_NAJEMCY")], ...sp(0) }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }],
  });

  return Packer.toBuffer(doc);
}

async function main() {
  console.log("=== Seed: Annex DOCX Template ===\n");

  const TEMPLATE_NAME = "Aneks do umowy podnajmu";
  const FILE_NAME = "szablon_aneksu_podnajmu.docx";

  // Clean up any previous runs
  const existing = await db.select().from(documentTemplates)
    .where(eq(documentTemplates.name, TEMPLATE_NAME));
  if (existing.length > 0) {
    console.log(`Removing existing template (id=${existing[0].id})...`);
    await db.delete(documentTemplates).where(eq(documentTemplates.name, TEMPLATE_NAME));
  }

  // Build DOCX buffer
  console.log("Generating annex DOCX...");
  const docxBuffer = await buildAnnexDocx();
  console.log(`DOCX buffer size: ${docxBuffer.length} bytes`);

  // Resolve storage paths
  const { bucketName, privatePrefix } = parsePrivateDir();
  const entityId = `templates/${FILE_NAME}`;                // e.g. "templates/szablon_aneksu_podnajmu.docx"
  const objectName = `${privatePrefix}/${entityId}`;        // e.g. ".private/templates/szablon_aneksu_podnajmu.docx"
  const objectPath = `/objects/${entityId}`;                // e.g. "/objects/templates/szablon_aneksu_podnajmu.docx"

  console.log(`Uploading to bucket=${bucketName}, object=${objectName}...`);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(docxBuffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  console.log(`Upload complete. objectPath=${objectPath}`);

  // Insert into document_templates
  const [inserted] = await db.insert(documentTemplates).values({
    name: TEMPLATE_NAME,
    fileName: FILE_NAME,
    objectPath,
    description: "Szablon aneksu — przedłużenie okresu i/lub zmiana czynszu do umowy podnajmu.",
    templateType: "ANEKS",
  }).returning();

  console.log(`\nTemplate inserted: id=${inserted.id}, name="${inserted.name}", templateType=${inserted.templateType}`);
  console.log(`objectPath: ${inserted.objectPath}`);
  console.log("Done!");
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
