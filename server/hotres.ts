const BASE_URL = "https://panel.hotres.pl";

interface HotResConfig {
  authCode: string;
  apiKey: string;
}

function getConfig(): HotResConfig {
  const apiKey = process.env.HOTRES_API_KEY;
  const authCode = process.env.HOTRES_AUTH_CODE;
  if (!apiKey || !authCode) {
    throw new Error("Brak konfiguracji HotRes: ustaw HOTRES_API_KEY i HOTRES_AUTH_CODE");
  }
  return { apiKey, authCode };
}

function buildUrl(action: string, params?: Record<string, string>): string {
  const config = getConfig();
  const url = new URL(`${BASE_URL}/api_${action}`);
  url.searchParams.set("auth", config.authCode);
  url.searchParams.set("apikey", config.apiKey);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

let requestCount = 0;
let requestWindowStart = Date.now();

function checkRateLimit() {
  const now = Date.now();
  if (now - requestWindowStart > 3600000) {
    requestCount = 0;
    requestWindowStart = now;
  }
  if (requestCount >= 110) {
    throw new Error("Zbliżasz się do limitu 120 req/h HotRes API. Poczekaj przed kolejnym żądaniem.");
  }
  requestCount++;
}

export function getRateLimitInfo() {
  const now = Date.now();
  if (now - requestWindowStart > 3600000) {
    return { used: 0, remaining: 110, resetInMs: 3600000 };
  }
  return {
    used: requestCount,
    remaining: Math.max(0, 110 - requestCount),
    resetInMs: 3600000 - (now - requestWindowStart),
  };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientError(e: any): boolean {
  const msg = e.message || "";
  if (msg.includes("429") || msg.includes("Too Many") || msg.includes("rate limit")) return true;
  if (msg.includes("500") || msg.includes("502") || msg.includes("503") || msg.includes("504")) return true;
  if (msg.includes("ECONNRESET") || msg.includes("ETIMEDOUT") || msg.includes("ENOTFOUND") || msg.includes("fetch failed")) return true;
  return false;
}

function isLocalRateLimitError(e: any): boolean {
  return (e.message || "").includes("Zbliżasz się do limitu");
}

async function hotresGetWithRetry(action: string, params?: Record<string, string>, maxRetries = 2): Promise<any> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await hotresGet(action, params);
    } catch (e: any) {
      lastError = e;
      if (isLocalRateLimitError(e)) {
        throw e;
      }
      if (!isTransientError(e)) {
        throw e;
      }
      if (attempt < maxRetries) {
        const isRateLimit = e.message?.includes("429") || e.message?.includes("Too Many");
        const backoffMs = isRateLimit
          ? Math.min(5000 * Math.pow(2, attempt), 60000)
          : Math.min(1000 * Math.pow(2, attempt), 10000);
        console.log(`[HotRes] Transient error for ${action}: ${e.message}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})`);
        await sleep(backoffMs);
        continue;
      }
      throw lastError;
    }
  }
  throw lastError;
}

async function hotresGet(action: string, params?: Record<string, string>): Promise<any> {
  checkRateLimit();
  const url = buildUrl(action, params);
  const res = await fetch(url, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HotRes API error (${action}): ${res.status} - ${text.substring(0, 200)}`);
  }
  return res.json();
}

async function hotresPost(action: string, body: any): Promise<any> {
  checkRateLimit();
  const url = buildUrl(action);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HotRes API error (${action}): ${res.status} - ${text.substring(0, 200)}`);
  }
  return res.json();
}

let roomTypesCache: { data: any[]; fetchedAt: number } | null = null;
let ratePlansCache: { data: any[]; fetchedAt: number } | null = null;
const CACHE_TTL = 30 * 60 * 1000;

export async function fetchRooms(): Promise<any[]> {
  const data = await hotresGet("rooms");
  return Array.isArray(data) ? data : [];
}

export async function fetchRoomTypes(): Promise<any[]> {
  if (roomTypesCache && Date.now() - roomTypesCache.fetchedAt < CACHE_TTL) {
    return roomTypesCache.data;
  }
  const data = await hotresGet("roomtypes");
  const result = Array.isArray(data) ? data : [];
  roomTypesCache = { data: result, fetchedAt: Date.now() };
  return result;
}

export async function fetchRates(): Promise<any[]> {
  if (ratePlansCache && Date.now() - ratePlansCache.fetchedAt < CACHE_TTL) {
    return ratePlansCache.data;
  }
  const data = await hotresGet("rates");
  const result = Array.isArray(data) ? data : [];
  ratePlansCache = { data: result, fetchedAt: Date.now() };
  return result;
}

function normalizePriceDate(val: any): string {
  if (!val) return "";
  const str = String(val);
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const euMatch = str.match(/^(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (euMatch) return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`;
  return str;
}

function normalizePriceResponse(data: any, typeId?: number, rateId?: number): any[] {
  if (!data) return [];

  if (Array.isArray(data)) {
    const firstItem = data[0];
    if (firstItem && firstItem.dates && Array.isArray(firstItem.dates)) {
      return data.map((block: any) => ({
        ...block,
        dates: (block.dates || []).map((d: any) => ({
          ...d,
          date: normalizePriceDate(d.date),
        })),
      }));
    }

    if (firstItem && (firstItem.date || firstItem.price || firstItem.baseprice)) {
      return [{
        type_id: typeId ? String(typeId) : undefined,
        rate_id: rateId ? String(rateId) : undefined,
        dates: data.map((d: any) => ({
          ...d,
          date: normalizePriceDate(d.date),
        })),
      }];
    }

    return [];
  }

  if (data && typeof data === "object" && !Array.isArray(data)) {
    if (data.dates && Array.isArray(data.dates)) {
      return [{
        type_id: data.type_id || (typeId ? String(typeId) : undefined),
        rate_id: data.rate_id || (rateId ? String(rateId) : undefined),
        dates: data.dates.map((d: any) => ({
          ...d,
          date: normalizePriceDate(d.date),
        })),
      }];
    }

    if (data.prices) {
      return normalizePriceResponse(data.prices, typeId, rateId);
    }

    if (data.data) {
      return normalizePriceResponse(data.data, typeId, rateId);
    }
  }

  console.warn(`[HotRes] Unknown price response format:`, JSON.stringify(data).substring(0, 500));
  return [];
}

export async function fetchPrices(from: string, till: string, typeId?: number, rateId?: number): Promise<any[]> {
  const params: Record<string, string> = { from, till };
  if (typeId) params.type_id = String(typeId);
  if (rateId) params.rate_id = String(rateId);
  try {
    const data = await hotresGetWithRetry("prices", params);
    const normalized = normalizePriceResponse(data, typeId, rateId);
    if (normalized.length === 0 && data) {
      console.warn(`[HotRes] fetchPrices returned empty after normalization. Raw response type: ${typeof data}, isArray: ${Array.isArray(data)}, sample:`, JSON.stringify(data).substring(0, 300));
    }
    return normalized;
  } catch (e: any) {
    console.error(`[HotRes] fetchPrices failed for typeId=${typeId}, rateId=${rateId}, from=${from}, till=${till}: ${e.message}`);
    throw e;
  }
}

export async function fetchPricesBatched(
  apartments: Array<{ id: number; name: string; hotresTypeId: number; hotresRateId?: number | null }>,
  from: string,
  till: string,
  onProgress?: (current: number, total: number, aptName: string, status: "ok" | "error", message: string) => void
): Promise<Map<number, { prices: any[]; error?: string }>> {
  const results = new Map<number, { prices: any[]; error?: string }>();
  const DELAY_BETWEEN_REQUESTS_MS = 3200;

  for (let i = 0; i < apartments.length; i++) {
    const apt = apartments[i];
    try {
      const prices = await fetchPrices(from, till, apt.hotresTypeId, apt.hotresRateId || undefined);
      results.set(apt.id, { prices });
      onProgress?.(i + 1, apartments.length, apt.name, "ok", `Pobrano ${prices.reduce((s, b) => s + (b.dates?.length || 0), 0)} dni`);
    } catch (e: any) {
      results.set(apt.id, { prices: [], error: e.message });
      onProgress?.(i + 1, apartments.length, apt.name, "error", e.message);
    }

    if (i < apartments.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }
  }

  return results;
}

export async function updatePrices(payload: Array<{
  type_id: number;
  rate_id: number;
  mode: "delta" | "clear";
  prices: Array<{
    from: string;
    till: string;
    baseprice?: number;
    pers1?: number;
    pers2?: number;
    pers3?: number;
    pers4?: number;
    pers5?: number;
    pers6?: number;
    pers7?: number;
    pers8?: number;
    child1?: number;
    child2?: number;
    child3?: number;
    cta?: number;
    ctd?: number;
    min?: number | null;
    max?: number | null;
  }>;
}>): Promise<any> {
  return hotresPost("updateprices", payload);
}

export async function fetchAvailability(from: string, till: string, typeId?: number): Promise<any[]> {
  const params: Record<string, string> = { from, till };
  if (typeId) params.type_id = String(typeId);
  const data = await hotresGet("availability", params);
  return Array.isArray(data) ? data : [];
}

export async function updateAvailability(payload: Array<{
  type_id: number;
  date: string;
  avb: number;
}>): Promise<any> {
  return hotresPost("updateavb", payload);
}

export async function testConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const roomTypes = await fetchRoomTypes();
    return {
      success: true,
      message: `Połączono z HotRes API. Znaleziono ${roomTypes.length} typów pokoi.`,
      details: { roomTypesCount: roomTypes.length },
    };
  } catch (e: any) {
    return {
      success: false,
      message: `Błąd połączenia z HotRes: ${e.message}`,
    };
  }
}

export async function fetchReservations(dateFrom?: string, dateTo?: string): Promise<{
  success: boolean;
  reservations: HotResReservation[];
  message: string;
  rawResponse?: any;
}> {
  try {
    const params: Record<string, string> = {};
    if (dateFrom) params.from = dateFrom;
    if (dateTo) params.till = dateTo;
    const data = await hotresGet("reservations", params);
    const items = Array.isArray(data) ? data : [];
    const reservations = items.map((item: any) => ({
      reservationNumber: String(item.id || item.number || `HR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`),
      apartmentName: String(item.roomscodes || item.room_name || item.apartment || ""),
      addDate: normalizeDate(item.add_date || item.created_at || ""),
      startDate: normalizeDate(item.arrival_date || item.check_in || item.from || ""),
      endDate: normalizeDate(item.departure_date || item.check_out || item.to || ""),
      guestName: String(
        item.guest_name || item.name ||
        [item.first_name, item.last_name].filter(Boolean).join(" ") || "Nieznany"
      ),
      price: String(item.amount || item.price || item.total || "0"),
      prepayment: String(item.prepayment || item.deposit || "0"),
      paidAmount: String(item.paid || item.paid_amount || "0"),
      status: normalizeStatus(item.status || ""),
      source: normalizeSource(item.source_portal || item.source || ""),
    }));
    return {
      success: true,
      reservations,
      message: `Pobrano ${reservations.length} rezerwacji z HotRes`,
      rawResponse: data,
    };
  } catch (e: any) {
    return {
      success: false,
      reservations: [],
      message: `Błąd pobierania rezerwacji: ${e.message}`,
    };
  }
}

export interface HotResReservation {
  reservationNumber: string;
  apartmentName: string;
  addDate: string;
  startDate: string;
  endDate: string;
  guestName: string;
  price: string;
  prepayment: string;
  paidAmount: string;
  status: string;
  source?: string;
}

function normalizeDate(val: any): string {
  if (!val) return "";
  const str = String(val);
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const euMatch = str.match(/^(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (euMatch) return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`;
  if (!isNaN(Number(val))) {
    const excelDate = new Date((Number(val) - 25569) * 86400 * 1000);
    if (!isNaN(excelDate.getTime())) return excelDate.toISOString().split('T')[0];
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  } catch {}
  return str;
}

function normalizeSource(val: string): string {
  if (!val) return "";
  const s = val.trim().toLowerCase();
  if (s.includes("booking")) return "Booking.com";
  if (s.includes("airbnb")) return "Airbnb";
  if (s.includes("recepcja") || s.includes("reception") || s.includes("walk-in") || s.includes("walkin")) return "Recepcja";
  if (s.includes("hotres")) return "HotRes";
  if (val.trim()) return "Inne";
  return "";
}

function normalizeStatus(val: any): string {
  const s = String(val).toUpperCase().trim();
  if (s === "CANCELED" || s === "CANCELLED" || s.includes("CANCEL") || s.includes("ANUL") || s.includes("ANULOWA") || s.includes("STORNO") || s === "ANULOWANA") return "ANULOWANA";
  if (s === "COMPLETE" || s === "COMPLETED" || s === "CHECKOUT" || s === "CHECKIN" || s.includes("COMPLET") || s.includes("ZAKON") || s.includes("ZREALI")) return "PRZYJETA";
  if (s.includes("CONFIRM") || s.includes("ACCEPT") || s.includes("POTWIERDZ") || s.includes("PRZYJ") || s === "PRZYJETA" || s === "PRZYJĘTA") return "PRZYJETA";
  if (s === "NEW" || s.includes("PEND") || s.includes("OCZEK") || s.includes("OPLAC") || s.includes("OPŁAC") || s === "DO_OPLACENIA") return "DO_OPLACENIA";
  return s || "DO_OPLACENIA";
}

function isHeaderRow(cells: string[]): boolean {
  if (cells.length < 5) return false;
  const first = cells[0].trim().toLowerCase();
  const knownHeaders = ['number', 'numer', 'nr', 'id', 'lp', 'numer rezerwacji', 'reservation'];
  if (knownHeaders.some(h => first === h || first.includes(h))) return true;
  if (/^\d+$/.test(cells[0].trim())) return false;
  const datePatterns = /^\d{4}-\d{2}-\d{2}|^\d{2}[./-]\d{2}[./-]\d{4}/;
  if (datePatterns.test(cells[0].trim())) return false;
  return true;
}

export function parseHotResCsv(csvContent: string): HotResReservation[] {
  const lines = csvContent.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return [];

  const separators = [';', ',', '\t'];
  let sep = ';';
  let maxCols = 0;
  for (const s of separators) {
    const cols = parseCsvLine(lines[0], s).length;
    if (cols > maxCols) { maxCols = cols; sep = s; }
  }

  const firstRowCells = parseCsvLine(lines[0], sep);
  const hasHeader = isHeaderRow(firstRowCells);
  let dataStartIdx = hasHeader ? 1 : 0;

  if (hasHeader) {
    const rawHeaders = firstRowCells.map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());

    const colMap = {
      resNumber: findCol(rawHeaders, ['number', 'numer rezerwacji', 'numer', 'nr rezerwacji', 'nr', 'reservation number', 'booking number', 'id', 'lp']),
      addDate: findCol(rawHeaders, ['add_date', 'data dodania', 'data_dodania', 'created', 'created_at']),
      apartment: findCol(rawHeaders, ['roomscodes', 'apartament', 'pokój', 'pokoj', 'room', 'apartment', 'nazwa pokoju', 'obiekt', 'unit', 'nazwa', 'rate_title']),
      startDate: findCol(rawHeaders, ['arrival_date', 'data przyjazdu', 'przyjazd', 'check-in', 'checkin', 'data od', 'od', 'start', 'arrival', 'from']),
      endDate: findCol(rawHeaders, ['departure_date', 'data wyjazdu', 'wyjazd', 'check-out', 'checkout', 'data do', 'do', 'end', 'departure', 'to']),
      lastName: findCol(rawHeaders, ['last_name', 'nazwisko']),
      firstName: findCol(rawHeaders, ['first_name', 'imię', 'imie']),
      guest: findCol(rawHeaders, ['gość', 'gosc', 'guest', 'imię i nazwisko', 'imie i nazwisko', 'klient', 'client', 'name', 'osoba']),
      price: findCol(rawHeaders, ['amount', 'cena', 'kwota', 'wartość', 'wartosc', 'price', 'total', 'netto', 'brutto', 'suma']),
      paid: findCol(rawHeaders, ['paid', 'wpłacona', 'wplacona', 'wpłata', 'wplata', 'zapłacono', 'zaplacono']),
      prepayment: findCol(rawHeaders, ['zaliczka', 'przedpłata', 'przedplata', 'prepayment', 'deposit', 'advance']),
      status: findCol(rawHeaders, ['status', 'stan']),
      source: findCol(rawHeaders, ['source', 'źródło', 'zrodlo', 'source_portal', 'portal', 'kanał', 'kanal', 'channel']),
    };

    const results: HotResReservation[] = [];

    for (let i = dataStartIdx; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i], sep);
      if (cells.length < 3) continue;

      const getValue = (idx: number) => idx >= 0 && idx < cells.length ? cells[idx].trim().replace(/^["']|["']$/g, '') : '';

      const startDate = normalizeDate(getValue(colMap.startDate));
      const endDate = normalizeDate(getValue(colMap.endDate));
      if (!startDate || !endDate) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) continue;

      const resNumber = getValue(colMap.resNumber) || `CSV-${i}-${Date.now().toString(36)}`;
      const addDateRaw = getValue(colMap.addDate);
      const addDate = addDateRaw ? normalizeDate(addDateRaw) : "";

      const priceStr = getValue(colMap.price).replace(/\s/g, '').replace(',', '.') || "0";
      const paidStr = getValue(colMap.paid).replace(/\s/g, '').replace(',', '.') || "0";
      const prepaymentStr = getValue(colMap.prepayment).replace(/\s/g, '').replace(',', '.') || "0";

      let guestName = getValue(colMap.guest);
      if (!guestName && (colMap.firstName >= 0 || colMap.lastName >= 0)) {
        const firstName = getValue(colMap.firstName);
        const lastName = getValue(colMap.lastName);
        guestName = [firstName, lastName].filter(Boolean).join(" ");
      }

      const sourceVal = getValue(colMap.source);

      results.push({
        reservationNumber: resNumber,
        apartmentName: getValue(colMap.apartment),
        addDate: addDate && /^\d{4}-\d{2}-\d{2}$/.test(addDate) ? addDate : "",
        startDate,
        endDate,
        guestName: (guestName || "Nieznany").toUpperCase(),
        price: isNaN(Number(priceStr)) ? "0" : priceStr,
        prepayment: isNaN(Number(prepaymentStr)) ? "0" : prepaymentStr,
        paidAmount: isNaN(Number(paidStr)) ? "0" : paidStr,
        status: normalizeStatus(getValue(colMap.status)),
        source: normalizeSource(sourceVal),
      });
    }

    return results;
  }

  const COL = {
    NUMBER: 0,
    STATUS: 1,
    ADD_DATE: 2,
    ARRIVAL: 3,
    DEPARTURE: 4,
    AMOUNT: 5,
    PAID: 6,
    CURRENCY: 7,
    LAST_NAME: 9,
    FIRST_NAME: 10,
    ROOMSCODES: 16,
    SOURCE: 17,
    SOURCE_PORTAL: 18,
  };

  const results: HotResReservation[] = [];

  for (let i = dataStartIdx; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], sep);
    if (cells.length < 7) continue;

    const getValue = (idx: number) => idx >= 0 && idx < cells.length ? cells[idx].trim().replace(/^["']|["']$/g, '') : '';

    const startDate = normalizeDate(getValue(COL.ARRIVAL));
    const endDate = normalizeDate(getValue(COL.DEPARTURE));
    if (!startDate || !endDate) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) continue;

    const resNumber = getValue(COL.NUMBER) || `CSV-${i}-${Date.now().toString(36)}`;
    const addDateRaw = getValue(COL.ADD_DATE);
    const addDate = addDateRaw ? normalizeDate(addDateRaw) : "";

    const priceStr = getValue(COL.AMOUNT).replace(/\s/g, '').replace(',', '.') || "0";
    const paidStr = getValue(COL.PAID).replace(/\s/g, '').replace(',', '.') || "0";

    const firstName = getValue(COL.FIRST_NAME);
    const lastName = getValue(COL.LAST_NAME);
    const guestName = ([firstName, lastName].filter(Boolean).join(" ") || "Nieznany").toUpperCase();

    const apartmentName = getValue(COL.ROOMSCODES);
    const sourceVal = getValue(COL.SOURCE_PORTAL) || getValue(COL.SOURCE);

    results.push({
      reservationNumber: resNumber,
      apartmentName,
      addDate: addDate && /^\d{4}-\d{2}-\d{2}$/.test(addDate) ? addDate : "",
      startDate,
      endDate,
      guestName,
      price: isNaN(Number(priceStr)) ? "0" : priceStr,
      prepayment: "0",
      paidAmount: isNaN(Number(paidStr)) ? "0" : paidStr,
      status: normalizeStatus(getValue(COL.STATUS)),
      source: normalizeSource(sourceVal),
    });
  }

  return results;
}

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.indexOf(c);
    if (idx >= 0) return idx;
  }
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' || ch === "'") {
      if (inQuotes && i + 1 < line.length && line[i + 1] === ch) {
        current += ch;
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === sep && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
