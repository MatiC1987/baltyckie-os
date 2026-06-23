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
  debugInfo?: string;
}

export interface DebugResult {
  loginPageStatus: number;
  loginPageUrl: string;
  loginPageSnippet: string;
  hasCsrf: boolean;
  csrfName?: string;
  formAction?: string;
  loginResultStatus: number;
  loginResultUrl: string;
  loginResultSnippet: string;
  cookiesAfterLogin: string[];
  invoicesPageStatus: number;
  invoicesPageUrl: string;
  invoicesPageSnippet: string;
  detectedStructure: string;
  spaIndicators: string[];
  tableRowCount: number;
  selectorResults: Record<string, number>;
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

  getNames(): string[] {
    return Array.from(this.cookies.keys());
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
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
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7",
      "Content-Type": "application/x-www-form-urlencoded",
      "Connection": "keep-alive",
      ...(cookieHeader ? { "Cookie": cookieHeader } : {}),
      ...(referer ? { "Referer": referer, "Origin": "https://online.vectra.pl" } : {}),
    },
    body: formBody,
  });
  jar.addFromHeaders(response.headers);
  const text = await response.text();
  return { text, finalUrl: response.url, status: response.status, headers: response.headers };
}

function htmlSnippet(html: string, maxLen = 800): string {
  return html.slice(0, maxLen).replace(/\s+/g, " ").trim();
}

function detectSpaIndicators(html: string): string[] {
  const indicators: string[] = [];
  if (/<div[^>]+id=["']?(root|app|ng-app|vue-app)["']?/i.test(html)) indicators.push("div#root/#app (React/Vue/Angular mount point)");
  if (/ng-version|ng-app|angular/i.test(html)) indicators.push("Angular framework");
  if (/__NEXT_DATA__|_nuxt|__nuxt/i.test(html)) indicators.push("Next.js/Nuxt.js SSR");
  if (/window\.__|window\.React|ReactDOM/i.test(html)) indicators.push("React globals");
  if (/type="module"|import\s*\(/i.test(html)) indicators.push("ES modules (SPA bundle)");
  if (/<script[^>]+src="[^"]*(?:bundle|chunk|main|app)[^"]*\.js/i.test(html)) indicators.push("JS bundle script tags");
  if (html.split("<script").length > 8) indicators.push(`Many script tags (${html.split("<script").length - 1})`);
  return indicators;
}

function extractInvoicesFromPage($: any): { texts: string[]; link: string }[] {
  const items: { texts: string[]; link: string }[] = [];

  const extractLink = (el: any): string => {
    const href = $(el).find("a[href*='pdf'], a[href*='faktur'], a[href*='invoice'], a[href*='pobierz'], a[href*='download'], a[href*='.pdf']").first().attr("href")
      || $(el).find("a").first().attr("href")
      || "";
    return href.startsWith("http") ? href : href ? `https://online.vectra.pl${href}` : "";
  };

  const extractTexts = (el: any): string[] =>
    $(el).find("td, .cell, [class*='cell'], [class*='col']").toArray()
      .map((c: any) => $(c).text().trim())
      .filter(Boolean);

  const pushRow = (el: any) => {
    const link = extractLink(el);
    const texts = extractTexts(el);
    if (texts.length >= 1) items.push({ texts, link });
  };

  const tableRows = $("table tbody tr").toArray();
  if (tableRows.length > 0) {
    console.log(`[vectra] Znaleziono ${tableRows.length} wierszy w table > tbody > tr`);
    tableRows.forEach(pushRow);
    return items;
  }

  const theadlessRows = $("table tr").toArray().filter((r: any) => $(r).find("td").length > 0);
  if (theadlessRows.length > 0) {
    console.log(`[vectra] Znaleziono ${theadlessRows.length} wierszy w table > tr (bez tbody)`);
    theadlessRows.forEach(pushRow);
    return items;
  }

  const dataRows = $("[class*='row']:not([class*='header']):not([class*='head']):not([class*='title'])").toArray()
    .filter((el: any) => $(el).text().trim().length > 20);
  if (dataRows.length > 0) {
    console.log(`[vectra] Znaleziono ${dataRows.length} elementów z klasą *row*`);
    dataRows.slice(0, 50).forEach((el: any) => {
      const link = extractLink(el);
      const texts = [$(el).text().trim().slice(0, 200)];
      items.push({ texts, link });
    });
    return items;
  }

  const listItems = $("ul li, ol li").toArray()
    .filter((el: any) => /FV|faktur|invoice|\d{4}\/\d{2}/i.test($(el).text()));
  if (listItems.length > 0) {
    console.log(`[vectra] Znaleziono ${listItems.length} elementów listy z treścią faktur`);
    listItems.forEach((el: any) => {
      const link = extractLink(el);
      const texts = [$(el).text().trim()];
      items.push({ texts, link });
    });
    return items;
  }

  const dataAttrRows = $("[data-invoice-id], [data-id], [data-document-id]").toArray();
  if (dataAttrRows.length > 0) {
    console.log(`[vectra] Znaleziono ${dataAttrRows.length} elementów z data-invoice-id/data-id`);
    dataAttrRows.forEach((el: any) => {
      const link = extractLink(el);
      const texts = [$(el).text().trim()];
      items.push({ texts, link });
    });
    return items;
  }

  return items;
}

function countSelectors($: any): Record<string, number> {
  return {
    "table tbody tr": $("table tbody tr").length,
    "table tr": $("table tr").length,
    "[class*='row']": $("[class*='row']").length,
    "[class*='invoice']": $("[class*='invoice']").length,
    "[class*='faktur']": $("[class*='faktur']").length,
    "ul li": $("ul li").length,
    "[data-id]": $("[data-id]").length,
    "a[href*='pdf']": $("a[href*='pdf']").length,
    "a[href*='pobierz']": $("a[href*='pobierz']").length,
  };
}

export async function debugVectraAccount(accountId: number): Promise<DebugResult> {
  const account = await storage.getVectraAccount(accountId);
  if (!account) throw new Error(`Konto Vectra #${accountId} nie istnieje`);

  const password = decryptPassword(account.passwordEncrypted);
  const { load } = await import("cheerio");
  const jar = new CookieJar();

  const LOGIN_URL = "https://online.vectra.pl/logowanie";
  const INVOICES_URL = "https://online.vectra.pl/faktury";

  const loginPageRes = await httpGet(LOGIN_URL, jar);
  const $login = load(loginPageRes.text);
  const csrfInput = $login('input[name="_token"], input[name="csrf_token"], input[name="csrfmiddlewaretoken"], input[name="_csrf"]').first();
  const hasCsrf = csrfInput.length > 0;
  const csrfName = hasCsrf ? csrfInput.attr("name") : undefined;
  const formAction = $login("form").first().attr("action") || undefined;

  const loginFields: Record<string, string> = { login: account.username, password };
  if (hasCsrf && csrfName) loginFields[csrfName] = csrfInput.attr("value") || "";
  $login('form input[type="hidden"]').each((_: number, el: any) => {
    const n = $login(el).attr("name");
    if (n && !loginFields[n]) loginFields[n] = $login(el).attr("value") || "";
  });

  const resolvedAction = formAction
    ? (formAction.startsWith("http") ? formAction : `https://online.vectra.pl${formAction}`)
    : LOGIN_URL;

  const loginRes = await httpPost(resolvedAction, jar, loginFields, LOGIN_URL);
  const cookiesAfterLogin = jar.getNames();

  const invoicesRes = await httpGet(INVOICES_URL, jar);
  const $ = load(invoicesRes.text);
  const spaIndicators = detectSpaIndicators(invoicesRes.text);
  const selectorResults = countSelectors($);

  const bodyText = $.text().slice(0, 2000);
  let detectedStructure = "unknown";
  if (selectorResults["table tbody tr"] > 0) detectedStructure = `table (${selectorResults["table tbody tr"]} rows)`;
  else if (selectorResults["[class*='invoice']"] > 0) detectedStructure = `div.invoice-* elements (${selectorResults["[class*='invoice']"]})`;
  else if (selectorResults["a[href*='pdf']"] > 0) detectedStructure = `direct PDF links (${selectorResults["a[href*='pdf']"]})`;
  else if (spaIndicators.length > 0) detectedStructure = "SPA — no server-rendered content";

  return {
    loginPageStatus: loginPageRes.status,
    loginPageUrl: loginPageRes.finalUrl,
    loginPageSnippet: htmlSnippet(loginPageRes.text),
    hasCsrf,
    csrfName,
    formAction: resolvedAction,
    loginResultStatus: loginRes.status,
    loginResultUrl: loginRes.finalUrl,
    loginResultSnippet: htmlSnippet(loginRes.text),
    cookiesAfterLogin,
    invoicesPageStatus: invoicesRes.status,
    invoicesPageUrl: invoicesRes.finalUrl,
    invoicesPageSnippet: htmlSnippet(invoicesRes.text),
    detectedStructure,
    spaIndicators,
    tableRowCount: selectorResults["table tbody tr"],
    selectorResults,
  };
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

  console.log(`[vectra] Rozpoczynam sync konta #${accountId} (${account.label})`);

  try {
    const { load } = await import("cheerio");
    const jar = new CookieJar();

    const LOGIN_URL = "https://online.vectra.pl/logowanie";
    const INVOICES_URL = "https://online.vectra.pl/faktury";

    console.log(`[vectra] Pobieram stronę logowania: ${LOGIN_URL}`);
    const loginPageRes = await httpGet(LOGIN_URL, jar);
    console.log(`[vectra] Strona logowania: status=${loginPageRes.status}, finalUrl=${loginPageRes.finalUrl}, htmlLen=${loginPageRes.text.length}`);

    let csrfToken: string | undefined;
    const $login = load(loginPageRes.text);
    const csrfInput = $login('input[name="_token"], input[name="csrf_token"], input[name="csrfmiddlewaretoken"], input[name="_csrf"]').first();
    if (csrfInput.length) {
      csrfToken = csrfInput.attr("value");
      console.log(`[vectra] Znaleziono CSRF token, pole: ${csrfInput.attr("name")}`);
    } else {
      console.log(`[vectra] Brak CSRF token na stronie logowania`);
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
    console.log(`[vectra] Wysyłam formularz logowania do: ${resolvedAction}, pola: ${Object.keys(loginFields).join(", ")}`);

    const loginRes = await httpPost(resolvedAction, jar, loginFields, LOGIN_URL);
    console.log(`[vectra] Odpowiedź logowania: status=${loginRes.status}, finalUrl=${loginRes.finalUrl}, cookies=[${jar.getNames().join(", ")}]`);

    if (loginRes.finalUrl.includes("logowanie") || loginRes.finalUrl.includes("login")) {
      const $err = load(loginRes.text);
      const errorMsg = $err(".alert-danger, .error-message, .login-error, [class*='error'], .alert, .notification-error").first().text().trim();
      const snippet = htmlSnippet(loginRes.text, 400);
      console.log(`[vectra] Logowanie nieudane — nadal na stronie logowania. Snippet: ${snippet}`);
      return finishWithStatus(accountId, account.label, "Błąd: nieprawidłowy login lub hasło", {
        newInvoices: 0,
        skipped: 0,
        error: errorMsg || "Błąd logowania — sprawdź login i hasło",
        debugInfo: `loginUrl=${loginRes.finalUrl} snippet=${snippet}`,
      });
    }

    if (jar.isEmpty()) {
      const snippet = htmlSnippet(loginRes.text, 400);
      console.log(`[vectra] Brak cookies po logowaniu. Snippet: ${snippet}`);
      return finishWithStatus(accountId, account.label, "Błąd: sesja nie została nawiązana", {
        newInvoices: 0,
        skipped: 0,
        error: "Portal Vectra nie zwrócił cookies sesji — możliwe, że wymaga JavaScript (SPA)",
        debugInfo: snippet,
      });
    }

    console.log(`[vectra] Pobieram stronę faktur: ${INVOICES_URL}`);
    const invoicesRes = await httpGet(INVOICES_URL, jar);
    console.log(`[vectra] Strona faktur: status=${invoicesRes.status}, finalUrl=${invoicesRes.finalUrl}, htmlLen=${invoicesRes.text.length}`);

    const $ = load(invoicesRes.text);

    if (invoicesRes.finalUrl.includes("logowanie") || invoicesRes.finalUrl.includes("login")) {
      return finishWithStatus(accountId, account.label, "Błąd: sesja wygasła lub odmowa dostępu", {
        newInvoices: 0,
        skipped: 0,
        error: "Sesja wygasła po przekierowaniu do logowania",
      });
    }

    const spaIndicators = detectSpaIndicators(invoicesRes.text);
    if (spaIndicators.length > 0) {
      console.log(`[vectra] Wykryto wskaźniki SPA: ${spaIndicators.join("; ")}`);
    }

    const selCounts = countSelectors($);
    console.log(`[vectra] Selektory HTML: ${JSON.stringify(selCounts)}`);

    const invoiceItems = extractInvoicesFromPage($);
    console.log(`[vectra] Wyodrębniono ${invoiceItems.length} pozycji faktur`);

    if (invoiceItems.length === 0) {
      const bodyText = $.text();
      const hasInvoiceContent = bodyText.includes("faktur") || bodyText.includes("FV") || bodyText.includes("dokument") || bodyText.includes("rachunek");
      const isLoggedIn = !invoicesRes.finalUrl.includes("logowanie")
        && (bodyText.includes("wyloguj") || bodyText.includes("Wyloguj") || bodyText.includes("konto") || bodyText.includes("Konto") || bodyText.includes("logout"));

      const snippet = htmlSnippet(invoicesRes.text, 600);
      console.log(`[vectra] Brak pozycji faktur. isLoggedIn=${isLoggedIn}, hasInvoiceContent=${hasInvoiceContent}, spaIndicators=${spaIndicators.length}`);

      if (spaIndicators.length >= 2) {
        return finishWithStatus(accountId, account.label, "Błąd: portal wymaga JavaScript", {
          newInvoices: 0,
          skipped: 0,
          error: `Portal Vectra wymaga przeglądarki (SPA). Wskaźniki: ${spaIndicators.slice(0, 2).join("; ")}`,
          debugInfo: snippet,
        });
      }

      if (!isLoggedIn && !hasInvoiceContent) {
        return finishWithStatus(accountId, account.label, "Błąd: portal wymaga JavaScript", {
          newInvoices: 0,
          skipped: 0,
          error: "Portal Vectra wymaga przeglądarki — automatyczna synchronizacja niedostępna w tej wersji",
          debugInfo: snippet,
        });
      }

      return finishWithStatus(
        accountId,
        account.label,
        `OK — 0 nowych, 0 pominiętych (brak faktur na koncie)`,
        { newInvoices: 0, skipped: 0, debugInfo: `selectors=${JSON.stringify(selCounts)}` }
      );
    }

    let newInvoices = 0;
    let skipped = 0;

    for (const row of invoiceItems) {
      const { texts, link } = row;
      if (texts.length < 1) continue;

      const allText = texts.join(" ");
      const invoiceNumber = texts.find((t) => /^FV|^FA|^\d{4}\/|^[A-Z]{2}\/\d|FV\//i.test(t))
        || texts.find((t) => /\d{4}[\/\-]\d{2}/.test(t))
        || texts[0];
      if (!invoiceNumber || invoiceNumber.length < 3) continue;

      const existing = await storage.getVectraInvoiceByNumber(accountId, invoiceNumber);
      if (existing) { skipped++; continue; }

      const dateText = allText.match(/\d{2}[.\-\/]\d{2}[.\-\/]\d{4}|\d{4}[.\-\/]\d{2}[.\-\/]\d{2}/)?.[0];
      let invoiceDate: string | null = null;
      if (dateText) {
        const parts = dateText.match(/(\d{2})[.\-\/](\d{2})[.\-\/](\d{4})/);
        if (parts) invoiceDate = `${parts[3]}-${parts[2]}-${parts[1]}`;
        else {
          const isoP = dateText.match(/(\d{4})[.\-\/](\d{2})[.\-\/](\d{2})/);
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
            console.log(`[vectra] Zapisano PDF: ${objectPath}`);
          } else {
            console.log(`[vectra] Link PDF nie zwrócił PDF (content-type: ${contentType}): ${link}`);
          }
        } catch (e) {
          console.error(`[vectra] Błąd pobierania PDF dla faktury ${invoiceNumber}:`, e);
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

      console.log(`[vectra] Dodano fakturę: ${invoiceNumber}, data=${invoiceDate}, kwota=${amount}`);
      newInvoices++;
    }

    console.log(`[vectra] Sync zakończony: ${newInvoices} nowych, ${skipped} pominiętych`);
    return finishWithStatus(
      accountId,
      account.label,
      `OK — ${newInvoices} nowych, ${skipped} pominiętych`,
      { newInvoices, skipped }
    );
  } catch (err: any) {
    const errMsg = err?.message || "Nieznany błąd";
    console.error(`[vectra] Błąd sync konta #${accountId}:`, err);
    return finishWithStatus(accountId, account.label, `Błąd: ${errMsg.slice(0, 200)}`, {
      newInvoices: 0,
      skipped: 0,
      error: errMsg,
    });
  }
}
