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

class CookieJar {
  private cookies: Map<string, string> = new Map();

  addFromHeaders(headers: Headers): void {
    const setCookieHeaders = headers.getSetCookie?.() ?? [];
    for (const header of setCookieHeaders) {
      const [nameValue] = header.split(";");
      const eqIdx = nameValue.indexOf("=");
      if (eqIdx < 0) continue;
      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();
      if (name) this.cookies.set(name, value);
    }
  }

  toCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }

  isEmpty(): boolean {
    return this.cookies.size === 0;
  }
}

async function httpGet(
  url: string,
  jar: CookieJar,
  extraHeaders: Record<string, string> = {}
): Promise<{ text: string; finalUrl: string; status: number; headers: Headers }> {
  const cookieHeader = jar.toCookieHeader();
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
      ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
      ...extraHeaders,
    },
  });
  jar.addFromHeaders(response.headers);
  const text = await response.text();
  return { text, finalUrl: response.url, status: response.status, headers: response.headers };
}

async function httpPost(
  url: string,
  jar: CookieJar,
  body: Record<string, string>,
  referer?: string
): Promise<{ text: string; finalUrl: string; status: number; headers: Headers }> {
  const cookieHeader = jar.toCookieHeader();
  const formBody = new URLSearchParams(body).toString();
  const response = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pl-PL,pl;q=0.9,en;q=0.8",
      "Content-Type": "application/x-www-form-urlencoded",
      ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
      ...(referer ? { "Referer": referer } : {}),
    },
    body: formBody,
  });
  jar.addFromHeaders(response.headers);
  const text = await response.text();
  return { text, finalUrl: response.url, status: response.status, headers: response.headers };
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

  try {
    const { load } = await import("cheerio");
    const jar = new CookieJar();

    const LOGIN_URL = "https://online.vectra.pl/logowanie";
    const INVOICES_URL = "https://online.vectra.pl/faktury";

    const loginPageRes = await httpGet(LOGIN_URL, jar);

    let csrfToken: string | undefined;
    const $login = load(loginPageRes.text);
    const csrfInput = $login('input[name="_token"], input[name="csrf_token"], input[name="csrfmiddlewaretoken"], input[name="_csrf"]').first();
    if (csrfInput.length) {
      csrfToken = csrfInput.attr("value");
    }

    const loginFields: Record<string, string> = {
      login: account.username,
      password: password,
    };
    if (csrfToken) {
      const csrfName = $login('input[name="_token"], input[name="csrf_token"], input[name="csrfmiddlewaretoken"], input[name="_csrf"]').first().attr("name") || "_token";
      loginFields[csrfName] = csrfToken;
    }

    const hiddenInputs = $login('form input[type="hidden"]');
    hiddenInputs.each((_: number, el: any) => {
      const name = $login(el).attr("name");
      const value = $login(el).attr("value") || "";
      if (name && !loginFields[name]) {
        loginFields[name] = value;
      }
    });

    const loginAction = $login("form").first().attr("action") || LOGIN_URL;
    const resolvedAction = loginAction.startsWith("http") ? loginAction : `https://online.vectra.pl${loginAction}`;

    const loginRes = await httpPost(resolvedAction, jar, loginFields, LOGIN_URL);

    if (loginRes.finalUrl.includes("logowanie") || loginRes.finalUrl.includes("login")) {
      const $err = load(loginRes.text);
      const errorMsg = $err(".alert-danger, .error-message, .login-error, [class*='error']").first().text().trim();
      return finishWithStatus(accountId, account.label, "Błąd: nieprawidłowy login lub hasło", {
        newInvoices: 0,
        skipped: 0,
        error: errorMsg || "Błąd logowania — sprawdź login i hasło",
      });
    }

    if (jar.isEmpty()) {
      return finishWithStatus(accountId, account.label, "Błąd: sesja nie została nawiązana", {
        newInvoices: 0,
        skipped: 0,
        error: "Portal Vectra nie zwrócił cookies sesji — możliwe, że wymaga JavaScript (SPA)",
      });
    }

    const invoicesRes = await httpGet(INVOICES_URL, jar);

    const $ = load(invoicesRes.text);

    if (invoicesRes.finalUrl.includes("logowanie") || invoicesRes.finalUrl.includes("login")) {
      return finishWithStatus(accountId, account.label, "Błąd: sesja wygasła lub odmowa dostępu", {
        newInvoices: 0,
        skipped: 0,
        error: "Sesja wygasła po przekierowaniu do logowania",
      });
    }

    const tableRows = $("table tbody tr").toArray();
    const invoiceItems: { texts: string[]; link: string }[] = [];

    if (tableRows.length > 0) {
      for (const row of tableRows) {
        const cells = $(row).find("td").toArray();
        const texts = cells.map((c) => $(c).text().trim()).filter(Boolean);
        const link = $(row).find("a[href*='pdf'], a[href*='faktur'], a[href*='invoice'], a[href*='pobierz'], a[href*='download']").first().attr("href") || "";
        const resolvedLink = link.startsWith("http") ? link : link ? `https://online.vectra.pl${link}` : "";
        invoiceItems.push({ texts, link: resolvedLink });
      }
    } else {
      const bodyText = $.text();
      const hasInvoiceContent = bodyText.includes("faktur") || bodyText.includes("FV") || bodyText.includes("dokument");
      const isLoggedIn = !invoicesRes.finalUrl.includes("logowanie") && (bodyText.includes("wyloguj") || bodyText.includes("Wyloguj") || bodyText.includes("konto") || bodyText.includes("Konto"));

      if (!isLoggedIn && !hasInvoiceContent) {
        return finishWithStatus(accountId, account.label, "Błąd: portal wymaga JavaScript", {
          newInvoices: 0,
          skipped: 0,
          error: "Portal Vectra wymaga przeglądarki — automatyczna synchronizacja niedostępna w tej wersji",
        });
      }
    }

    let newInvoices = 0;
    let skipped = 0;

    for (const row of invoiceItems) {
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
      const privateDir = process.env.PRIVATE_OBJECT_DIR || "";

      if (link && privateDir) {
        try {
          const cookieHeader = jar.toCookieHeader();
          const pdfRes = await fetch(link, {
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "application/pdf,*/*",
              ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
              "Referer": INVOICES_URL,
            },
          });
          jar.addFromHeaders(pdfRes.headers);
          const contentType = pdfRes.headers.get("content-type") || "";
          if (contentType.includes("pdf")) {
            const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
            const { objectStorageClient: osClient } = await import("./replit_integrations/object_storage/objectStorage");
            const normalizedDir = privateDir.startsWith("/") ? privateDir.slice(1) : privateDir;
            const pathParts = normalizedDir.split("/");
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

    return finishWithStatus(
      accountId,
      account.label,
      `OK — ${newInvoices} nowych, ${skipped} pominiętych`,
      { newInvoices, skipped }
    );
  } catch (err: any) {
    const errMsg = err?.message || "Nieznany błąd";
    return finishWithStatus(accountId, account.label, `Błąd: ${errMsg.slice(0, 200)}`, {
      newInvoices: 0,
      skipped: 0,
      error: errMsg,
    });
  }
}
