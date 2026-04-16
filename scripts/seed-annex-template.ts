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

async function buildAnnexDocx(): Promise<Buffer> {
  const { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } = await import("docx");

  const bold = (text: string) => new TextRun({ text, bold: true, size: 24, font: "Times New Roman" });
  const normal = (text: string) => new TextRun({ text, size: 24, font: "Times New Roman" });
  const placeholder = (key: string) => new TextRun({ text: `[${key}]`, size: 24, font: "Times New Roman", underline: {} });

  const emptyLine = new Paragraph({ children: [normal("")], spacing: { after: 80 } });

  const noBorder = { top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 }, left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 }, insideH: { style: BorderStyle.NONE, size: 0 }, insideV: { style: BorderStyle.NONE, size: 0 } };

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24 },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      children: [
        // City and date header
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [placeholder("MIEJSCOWOSC"), normal(", dnia "), placeholder("DATA_ANEKSU")],
          spacing: { after: 400 },
        }),

        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [bold("ANEKS NR "), placeholder("NUMER_ANEKSU")],
          spacing: { after: 80 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [bold("do Umowy Podnajmu lokalu mieszkalnego")],
          spacing: { after: 80 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [bold("zawartej w dniu "), placeholder("DATA_UMOWY_PIERWOTNEJ")],
          spacing: { after: 400 },
        }),

        // Parties
        new Paragraph({
          children: [bold("Strony Umowy:")],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            bold("Wynajmujący: "),
            placeholder("NAZWA_FIRMY_WYNAJMUJACEGO"),
            normal(", NIP: "),
            placeholder("NIP_WYNAJMUJACEGO"),
            normal(", REGON: "),
            placeholder("REGON_WYNAJMUJACEGO"),
            normal(", adres: "),
            placeholder("ADRES_WYNAJMUJACEGO"),
            normal(", reprezentowany przez: "),
            placeholder("IMIE_NAZWISKO_WYNAJMUJACEGO"),
            normal(", "),
            placeholder("STANOWISKO_WYNAJMUJACEGO"),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            bold("Najemca: "),
            placeholder("IMIE_I_NAZWISKO_NAJEMCY"),
            normal(", zamieszkały/a: "),
            placeholder("ADRES_NAJEMCY"),
            normal(", nr dowodu: "),
            placeholder("NR_DOWODU"),
            normal(", NIP: "),
            placeholder("NIP_NAJEMCY"),
            normal(", REGON: "),
            placeholder("REGON_NAJEMCY"),
          ],
          spacing: { after: 400 },
        }),

        // Premises
        new Paragraph({
          children: [
            normal("Dotyczy lokalu: "),
            placeholder("NUMER_LOKALU"),
          ],
          spacing: { after: 400 },
        }),

        // Paragraph 1
        new Paragraph({
          children: [bold("§ 1")],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            normal("Strony postanawiają, że z dniem "),
            placeholder("DATA_OD"),
            normal(" Umowa Podnajmu zostaje zmieniona w następujący sposób:"),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            normal("1. Nowa kwota miesięcznego czynszu wynosi: "),
            placeholder("NOWA_KWOTA_CZYNSZU"),
            normal(" zł brutto"),
          ],
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            normal("2. Nowa data zakończenia umowy: "),
            placeholder("NOWA_DATA_DO"),
          ],
          spacing: { after: 400 },
        }),

        // Paragraph 2
        new Paragraph({
          children: [bold("§ 2")],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            normal("Pozostałe warunki Umowy Podnajmu pozostają bez zmian."),
          ],
          spacing: { after: 400 },
        }),

        // Paragraph 3
        new Paragraph({
          children: [bold("§ 3")],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),

        new Paragraph({
          children: [
            normal("Aneks sporządzono w dwóch jednobrzmiących egzemplarzach, po jednym dla każdej ze Stron."),
          ],
          spacing: { after: 600 },
        }),

        // Signatures table
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
                    new Paragraph({
                      children: [bold("WYNAJMUJĄCY")],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 400 },
                    }),
                    new Paragraph({
                      children: [normal("___________________________")],
                      alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                      children: [placeholder("IMIE_NAZWISKO_WYNAJMUJACEGO")],
                      alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                      children: [placeholder("STANOWISKO_WYNAJMUJACEGO")],
                      alignment: AlignmentType.CENTER,
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 50, type: WidthType.PERCENTAGE },
                  borders: noBorder,
                  children: [
                    new Paragraph({
                      children: [bold("NAJEMCA")],
                      alignment: AlignmentType.CENTER,
                      spacing: { after: 400 },
                    }),
                    new Paragraph({
                      children: [normal("___________________________")],
                      alignment: AlignmentType.CENTER,
                    }),
                    new Paragraph({
                      children: [placeholder("IMIE_I_NAZWISKO_NAJEMCY")],
                      alignment: AlignmentType.CENTER,
                    }),
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

  // Check if already exists
  const existing = await db.select().from(documentTemplates).where(eq(documentTemplates.name, "Szablon Aneksu do Umowy Podnajmu"));
  if (existing.length > 0) {
    console.log(`Template already exists (id=${existing[0].id}), skipping.`);
    process.exit(0);
  }

  const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR env var not set");

  // Build DOCX buffer
  console.log("Generating annex DOCX...");
  const docxBuffer = await buildAnnexDocx();
  console.log(`DOCX buffer size: ${docxBuffer.length} bytes`);

  // Upload to object storage
  const fileName = "szablon_aneks_podnajem.docx";
  const storagePath = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
  const parts = storagePath.split("/");
  const bucketName = parts[0];
  const objectName = `${parts.slice(1).join("/")}/templates/${fileName}`;
  const objectPath = `/${storagePath}/templates/${fileName}`;

  console.log(`Uploading to bucket=${bucketName}, object=${objectName}...`);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(docxBuffer, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  console.log("Upload complete.");

  // Insert into document_templates
  const [inserted] = await db.insert(documentTemplates).values({
    name: "Szablon Aneksu do Umowy Podnajmu",
    fileName,
    objectPath,
    description: "Szablon aneksu do umowy podnajmu lokalu mieszkalnego. Zawiera pola: numer aneksu, data, strony, nowy czynsz, nowa data zakończenia.",
    templateType: "ANEKS",
  }).returning();

  console.log(`\nTemplate inserted: id=${inserted.id}, templateType=${inserted.templateType}`);
  console.log("Done!");
  process.exit(0);
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
