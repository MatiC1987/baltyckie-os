import * as crypto from "crypto";
import { storage } from "./storage";

const ALGORITHM = "aes-256-cbc";

function getEncryptionKey(): Buffer {
  const keyHex = process.env.VECTRA_ENCRYPT_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error("VECTRA_ENCRYPT_KEY must be set to a 64-char hex string (32 bytes)");
  }
  return Buffer.from(keyHex, "hex");
}

export function encryptPassword(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decryptPassword(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivHex, encHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const enc = Buffer.from(encHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  const decrypted = Buffer.concat([decipher.update(enc), decipher.final()]);
  return decrypted.toString("utf8");
}

export interface SyncResult {
  accountId: number;
  label: string;
  newInvoices: number;
  skipped: number;
  error?: string;
}

async function finishWithStatus(
  accountId: number,
  label: string,
  status: string,
  result: Omit<SyncResult, "accountId" | "label">
): Promise<SyncResult> {
  await storage.updateVectraAccount(accountId, {
    lastSyncAt: new Date(),
    lastSyncStatus: status,
  }).catch(() => {});
  return { accountId, label, ...result };
}

export async function syncVectraAccount(accountId: number): Promise<SyncResult> {
  const account = await storage.getVectraAccount(accountId);
  if (!account) throw new Error(`Konto Vectra #${accountId} nie istnieje`);

  let password: string;
  try {
    password = decryptPassword(account.passwordEncrypted);
  } catch (e) {
    return finishWithStatus(accountId, account.label, "Błąd: deszyfrowanie hasła", {
      newInvoices: 0,
      skipped: 0,
      error: "Błąd deszyfrowania hasła",
    });
  }

  let browser: any = null;
  try {
    const { chromium } = await import("playwright");

    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      acceptDownloads: true,
    });

    const page = await context.newPage();

    await page.goto("https://online.vectra.pl/logowanie", { waitUntil: "networkidle", timeout: 30000 });

    const loginField = await page.$('input[type="text"], input[name="login"], input[id*="login"], input[placeholder*="login"]');
    const passField = await page.$('input[type="password"]');

    if (!loginField || !passField) {
      await browser.close();
      return finishWithStatus(accountId, account.label, "Błąd: nie znaleziono formularza logowania", {
        newInvoices: 0,
        skipped: 0,
        error: "Nie znaleziono formularza logowania",
      });
    }

    await loginField.fill(account.username);
    await passField.fill(password);
    await page.keyboard.press("Enter");

    await page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }).catch(() => {});

    const currentUrl = page.url();
    if (currentUrl.includes("logowanie") || currentUrl.includes("login")) {
      await browser.close();
      return finishWithStatus(accountId, account.label, "Błąd: nieprawidłowy login lub hasło", {
        newInvoices: 0,
        skipped: 0,
        error: "Błąd logowania — sprawdź login i hasło",
      });
    }

    await page.goto("https://online.vectra.pl/faktury", { waitUntil: "networkidle", timeout: 30000 });

    await page.waitForSelector("table, .invoice, .faktura, [class*='invoice'], [class*='faktura']", { timeout: 15000 }).catch(() => {});

    const invoiceRows = await page.$$eval(
      "table tbody tr, .invoice-row, .faktura-row, [class*='invoice-item'], [class*='faktura-item']",
      (rows: Element[]) => rows.map((row) => {
        const cells = Array.from(row.querySelectorAll("td, .cell, [class*='cell']"));
        const texts = cells.map((c) => c.textContent?.trim() || "");
        const link = (row.querySelector("a[href*='pdf'], a[href*='faktura'], a[href*='invoice'], button[class*='download'], a[class*='download']") as HTMLAnchorElement | null)?.href || "";
        return { texts, link };
      })
    ).catch(() => [] as { texts: string[]; link: string }[]);

    let newInvoices = 0;
    let skipped = 0;

    const privateDir = process.env.PRIVATE_OBJECT_DIR || "";

    for (const row of invoiceRows) {
      const { texts, link } = row;
      if (texts.length < 2) continue;

      const invoiceNumber = texts.find((t) => /^FV|^FA|^\d{4}\/|^[A-Z]{2}\/\d/.test(t)) || texts[0];
      if (!invoiceNumber || invoiceNumber.length < 3) continue;

      const existing = await storage.getVectraInvoiceByNumber(accountId, invoiceNumber);
      if (existing) { skipped++; continue; }

      const dateText = texts.find((t) => /\d{2}[.\-/]\d{2}[.\-/]\d{4}|\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(t));
      let invoiceDate: string | null = null;
      if (dateText) {
        const parts = dateText.match(/(\d{2})[.\-/](\d{2})[.\-/](\d{4})/);
        if (parts) invoiceDate = `${parts[3]}-${parts[2]}-${parts[1]}`;
        else {
          const isoP = dateText.match(/(\d{4})[.\-/](\d{2})[.\-/](\d{2})/);
          if (isoP) invoiceDate = `${isoP[1]}-${isoP[2]}-${isoP[3]}`;
        }
      }

      const amountText = texts.find((t) => /\d+[,\.]\d{2}/.test(t) && (t.includes("zł") || t.includes("PLN") || /^\d/.test(t)));
      let amount: string | null = null;
      if (amountText) {
        const m = amountText.match(/[\d\s]+[,\.]\d{2}/);
        if (m) amount = m[0].replace(/\s/g, "").replace(",", ".");
      }

      const period = texts.find((t) => /\d{4}[-\/]\d{2}|\b(styczeń|luty|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień)\b/i.test(t));

      let objectPath: string | null = null;

      if (link && privateDir) {
        try {
          const downloadRes = await page.goto(link, { timeout: 30000, waitUntil: "networkidle" });
          if (downloadRes && downloadRes.headers()["content-type"]?.includes("pdf")) {
            const pdfBuffer = await downloadRes.body();
            const { objectStorageClient: osClient } = await import("./replit_integrations/object_storage/objectStorage");
            const pathParts = privateDir.split("/");
            const bucketName = pathParts[0];
            const baseKey = pathParts.slice(1).join("/");
            const fileName = `vectra-invoices/${accountId}/${invoiceNumber.replace(/\//g, "-")}.pdf`;
            const fullKey = baseKey ? `${baseKey}/${fileName}` : fileName;
            const file = osClient.bucket(bucketName).file(fullKey);
            await file.save(pdfBuffer, { contentType: "application/pdf" });
            objectPath = `${bucketName}/${fullKey}`;
          }
        } catch (e) {
          console.error(`Błąd pobierania PDF dla faktury ${invoiceNumber}:`, e);
        }
      }

      await storage.createVectraInvoice({
        vectraAccountId: accountId,
        invoiceNumber,
        invoiceDate: invoiceDate || null,
        amount: amount || null,
        period: period || null,
        objectPath,
      });

      newInvoices++;
    }

    await browser.close();

    return finishWithStatus(
      accountId,
      account.label,
      `OK — ${newInvoices} nowych, ${skipped} pominiętych`,
      { newInvoices, skipped }
    );
  } catch (err: any) {
    if (browser) await browser.close().catch(() => {});
    const errMsg = err?.message || "Nieznany błąd";
    return finishWithStatus(accountId, account.label, `Błąd: ${errMsg.slice(0, 200)}`, {
      newInvoices: 0,
      skipped: 0,
      error: errMsg,
    });
  }
}
