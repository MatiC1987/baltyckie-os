/**
 * Seed script: generates annex DOCX template from user's reference file.
 * Reads attached_assets/19.05.2026_Elektropaks_-_Aneks_Nr_1_1776338280825.docx,
 * replaces Elektropaks-specific values with [PLACEHOLDER] tags,
 * uploads to object storage.
 *
 * DB inserts are done separately via executeSql.
 */

import fs from "fs";
import path from "path";
import { Storage } from "@google-cloud/storage";

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

function parsePrivateDir(): { bucketName: string; privatePrefix: string } {
  const dir = process.env.PRIVATE_OBJECT_DIR || "";
  if (!dir) throw new Error("PRIVATE_OBJECT_DIR env var not set");
  const normalized = dir.startsWith("/") ? dir.slice(1) : dir;
  const parts = normalized.split("/");
  return { bucketName: parts[0], privatePrefix: parts.slice(1).join("/") };
}

/**
 * Merge all runs within each paragraph and replace full-text matches.
 * This handles DOCX XML where a single word/phrase is split across multiple <w:r> runs.
 */
function mergeRunsAndReplace(
  xml: string,
  replacements: Array<{ from: string; to: string }>
): string {
  return xml.replace(/<w:p[ >][\s\S]*?<\/w:p>/g, (para) => {
    const textParts: { match: string; text: string }[] = [];
    const runRegex = /<w:r[ >][\s\S]*?<\/w:r>/g;
    let m: RegExpExecArray | null;
    while ((m = runRegex.exec(para)) !== null) {
      const runXml = m[0];
      const texts: string[] = [];
      const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
      let tm: RegExpExecArray | null;
      while ((tm = tRegex.exec(runXml)) !== null) {
        texts.push(tm[1]);
      }
      textParts.push({ match: runXml, text: texts.join("") });
    }
    if (textParts.length === 0) return para;

    const fullText = textParts.map(p => p.text).join("");

    let hasMatch = false;
    for (const r of replacements) {
      if (fullText.includes(r.from)) { hasMatch = true; break; }
    }
    if (!hasMatch) return para;

    let replacedText = fullText;
    for (const { from, to } of replacements) {
      replacedText = replacedText.split(from).join(to);
    }

    const firstRun = textParts[0].match;
    const newRun = firstRun
      .replace(/<w:t[^>]*>[^<]*<\/w:t>/g, "")
      .replace(/<\/w:r>$/, "") +
      `<w:t xml:space="preserve">${replacedText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
      }</w:t></w:r>`;

    let result = para;
    for (let i = textParts.length - 1; i >= 1; i--) {
      result = result.replace(textParts[i].match, "");
    }
    result = result.replace(textParts[0].match, newRun);
    return result;
  });
}

async function processAnnexDocx(): Promise<Buffer> {
  const refPath = path.join(
    process.cwd(),
    "attached_assets",
    "19.05.2026_Elektropaks_-_Aneks_Nr_1_1776338280825.docx"
  );
  const buf = fs.readFileSync(refPath);
  console.log(`Read reference DOCX: ${buf.length} bytes`);

  const PizZip = (await import("pizzip")).default;
  const zip = new PizZip(buf);

  const replacements: Array<{ from: string; to: string }> = [
    { from: "Apartamenty Bałtyckie Mateusz Cieślak", to: "[NAZWA_FIRMY_WYNAJMUJACEGO]" },
    { from: "ELEKTROPAKS Sp. z o.o.", to: "[NAZWA_FIRMY_NAJEMCY]" },
    { from: "Elektropaks Spółka z o.o.", to: "[NAZWA_FIRMY_NAJEMCY]" },
    { from: "8392963268", to: "[NIP_WYNAJMUJACEGO]" },
    { from: "50501301445", to: "[NIP_NAJEMCY]" },
    { from: "5050 1301445", to: "[NIP_NAJEMCY]" },
    { from: "5050130144 5", to: "[NIP_NAJEMCY]" },
    { from: "385574636", to: "[REGON_NAJEMCY]" },
    { from: "Mateusza Cieślak", to: "[IMIE_NAZWISKO_WYNAJMUJACEGO]" },
    { from: "Mateusza Cie ś lak", to: "[IMIE_NAZWISKO_WYNAJMUJACEGO]" },
    { from: "19.05.2025", to: "[DATA_UMOWY_PIERWOTNEJ]" },
    { from: "16.04.2026", to: "[DATA_ANEKSU]" },
    { from: "20.05.2026", to: "[DATA_OD]" },
    { from: "31.10.2026", to: "[NOWA_DATA_DO]" },
    // City/postal code — order matters: longer strings first
    { from: "Ustce (76 -270)", to: "[MIEJSCOWOSC] ([KOD_POCZTOWY_WYNAJMUJACEGO])" },
    { from: "w Ustce pomiędzy", to: "w [MIEJSCOWOSC] pomiędzy" },
    { from: "76 -270", to: "[KOD_POCZTOWY_WYNAJMUJACEGO]" },
    // Streets
    { from: "ul. Na Wydmie 7/32", to: "[ULICA_WYNAJMUJACEGO]" },
    // Representative's private address (split across 2 paragraphs in XML)
    { from: "ul. Sportowa 27, ", to: "[ADRES_ZAMIESZKANIA_WYNAJMUJACEGO], " },
    { from: " 76-200 Bierkowo k. Słupska.", to: "" },
    { from: "76-200 Bierkowo k. Słupska.", to: "" },
    { from: "76-200 Bierkowo k. Słupska", to: "" },
    { from: "ul. Dęblińska 6, 24-100 Puławy", to: "[ADRES_NAJEMCY]" },
    { from: "ul. Dęblińska6, 24-100 Puławy", to: "[ADRES_NAJEMCY]" },
    { from: "Ustka ul. Uzdrowiskowa nr 49 i 51 oraz Ustka ul. Na Wydmie 7/4", to: "[NUMER_LOKALU]" },
    // Catch any remaining 'Ustce' references (in case city appears elsewhere in the doc)
    { from: "Ustce", to: "[MIEJSCOWOSC]" },
  ];

  const xmlFiles = [
    "word/document.xml",
    "word/header1.xml",
    "word/header2.xml",
    "word/header3.xml",
    "word/footer1.xml",
    "word/footer2.xml",
    "word/footer3.xml",
  ];

  for (const xmlFile of xmlFiles) {
    const entry = zip.files[xmlFile];
    if (!entry) continue;
    let xml = entry.asText();
    xml = mergeRunsAndReplace(xml, replacements);
    zip.file(xmlFile, xml);
  }

  const output = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
  console.log(`Processed DOCX: ${output.length} bytes`);
  return output;
}

async function uploadToObjectStorage(docxBuffer: Buffer): Promise<string> {
  const { bucketName, privatePrefix } = parsePrivateDir();
  const entityId = "templates/szablon_aneksu_podnajmu.docx";
  const objectName = `${privatePrefix}/${entityId}`;
  const objectPath = `/objects/${entityId}`;

  console.log(`\nUploading to bucket=${bucketName}, object=${objectName}...`);
  const file = objectStorageClient.bucket(bucketName).file(objectName);
  await file.save(docxBuffer, {
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  console.log(`Upload complete. objectPath=${objectPath}`);
  return objectPath;
}

async function main() {
  console.log("=== Seed: Annex DOCX Template (from user reference) ===\n");

  const docxBuffer = await processAnnexDocx();
  await uploadToObjectStorage(docxBuffer);

  console.log("\nDone! DB inserts should be done via executeSql tool.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
