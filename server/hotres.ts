// @ts-ignore
import fetch from "node-fetch";

const POSSIBLE_BASE_URLS = [
  "https://panel.hotres.pl/api",
  "https://api.hotres.pl",
  "https://panel.hotres.pl/api/v1",
  "https://api.hotres.pl/v1",
];

let discoveredBaseUrl: string | null = null;

interface HotResConfig {
  apiKey: string;
  authCode: string;
  baseUrl?: string;
}

function getConfig(): HotResConfig {
  const apiKey = process.env.HOTRES_API_KEY;
  const authCode = process.env.HOTRES_AUTH_CODE;
  const baseUrl = process.env.HOTRES_API_URL;

  if (!apiKey || !authCode) {
    throw new Error("Brak konfiguracji HotRes: ustaw HOTRES_API_KEY i HOTRES_AUTH_CODE");
  }

  return { apiKey, authCode, baseUrl };
}

async function makeRequest(url: string, config: HotResConfig, method: string = "GET", body?: any): Promise<{ status: number; data: any; headers: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  const authVariants = [
    { ...headers, "Authorization": `Bearer ${config.apiKey}`, "X-Auth-Code": config.authCode },
    { ...headers, "X-API-Key": config.apiKey, "X-Auth-Code": config.authCode },
    { ...headers, "Authorization": `Bearer ${config.authCode}`, "X-API-Key": config.apiKey },
    { ...headers, "Api-Key": config.apiKey, "Auth-Code": config.authCode },
    { ...headers, "apikey": config.apiKey, "authcode": config.authCode },
  ];

  for (const authHeaders of authVariants) {
    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: body ? JSON.stringify(body) : undefined,
        timeout: 10000,
      });

      const contentType = res.headers.get("content-type") || "";
      let data: any;
      if (contentType.includes("json")) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      if (res.status !== 401 && res.status !== 403) {
        return { status: res.status, data, headers: Object.fromEntries(res.headers.entries()) };
      }
    } catch (e: any) {
      continue;
    }
  }

  const lastRes = await fetch(url, {
    method,
    headers: authVariants[0],
    timeout: 10000,
  });
  const contentType = lastRes.headers.get("content-type") || "";
  let lastData: any;
  if (contentType.includes("json")) {
    lastData = await lastRes.json();
  } else {
    lastData = await lastRes.text();
  }
  return { status: lastRes.status, data: lastData, headers: Object.fromEntries(lastRes.headers.entries()) };
}

export async function testConnection(): Promise<{
  success: boolean;
  baseUrl?: string;
  message: string;
  details?: any;
}> {
  const config = getConfig();

  if (config.baseUrl) {
    try {
      const endpoints = ["/reservations", "/bookings", "/rezerwacje", "/rooms", "/pokoje", ""];
      for (const endpoint of endpoints) {
        const url = `${config.baseUrl}${endpoint}`;
        const result = await makeRequest(url, config);
        if (result.status >= 200 && result.status < 400) {
          discoveredBaseUrl = config.baseUrl!;
          return {
            success: true,
            baseUrl: config.baseUrl,
            message: `Połączono z HotRes API: ${url} (status: ${result.status})`,
            details: { endpoint, status: result.status, response: typeof result.data === 'string' ? result.data.substring(0, 500) : result.data },
          };
        }
      }
      return {
        success: false,
        baseUrl: config.baseUrl,
        message: `Nie udało się połączyć z ${config.baseUrl}. Sprawdź klucze API.`,
        details: { triedEndpoints: endpoints },
      };
    } catch (e: any) {
      return { success: false, message: `Błąd połączenia: ${e.message}` };
    }
  }

  for (const baseUrl of POSSIBLE_BASE_URLS) {
    try {
      const endpoints = ["/reservations", "/bookings", "/rezerwacje", ""];
      for (const endpoint of endpoints) {
        const url = `${baseUrl}${endpoint}`;
        try {
          const result = await makeRequest(url, config);
          if (result.status >= 200 && result.status < 400) {
            discoveredBaseUrl = baseUrl;
            return {
              success: true,
              baseUrl,
              message: `Połączono z HotRes API: ${url} (status: ${result.status})`,
              details: { endpoint, status: result.status, response: typeof result.data === 'string' ? result.data.substring(0, 500) : result.data },
            };
          }
        } catch {
          continue;
        }
      }
    } catch {
      continue;
    }
  }

  return {
    success: false,
    message: "Nie udało się automatycznie wykryć adresu API HotRes. Potrzebny jest adres URL API z panelu HotRes (Serwis > API).",
    details: { triedUrls: POSSIBLE_BASE_URLS },
  };
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

function parseReservationsFromResponse(data: any): HotResReservation[] {
  if (!data) return [];

  let items: any[] = [];
  if (Array.isArray(data)) {
    items = data;
  } else if (data.reservations && Array.isArray(data.reservations)) {
    items = data.reservations;
  } else if (data.bookings && Array.isArray(data.bookings)) {
    items = data.bookings;
  } else if (data.data && Array.isArray(data.data)) {
    items = data.data;
  } else if (data.results && Array.isArray(data.results)) {
    items = data.results;
  }

  return items.map((item: any) => ({
    reservationNumber: String(
      item.reservationNumber || item.reservation_number || item.numer_rezerwacji ||
      item.booking_number || item.number || item.id || item.nr || `HR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    ),
    apartmentName: String(
      item.apartmentName || item.apartment_name || item.room_name || item.nazwa_pokoju ||
      item.room || item.pokoj || item.pokój || item.unit || item.apartment || item.roomscodes || ""
    ),
    addDate: normalizeDate(
      item.addDate || item.add_date || item.created_at || item.data_dodania || ""
    ),
    startDate: normalizeDate(
      item.startDate || item.start_date || item.check_in || item.checkin ||
      item.arrival_date || item.data_przyjazdu || item.arrival || item.from || item.od || ""
    ),
    endDate: normalizeDate(
      item.endDate || item.end_date || item.check_out || item.checkout ||
      item.departure_date || item.data_wyjazdu || item.departure || item.to || item.do || ""
    ),
    guestName: String(
      item.guestName || item.guest_name || item.guest || item.gosc || item.gość ||
      item.name || item.imie_nazwisko || item.client || item.klient ||
      [item.first_name, item.last_name].filter(Boolean).join(" ") || "Nieznany"
    ),
    price: String(
      item.price || item.total || item.cena || item.kwota || item.amount ||
      item.total_price || item.wartosc || item.wartość || "0"
    ),
    prepayment: String(
      item.prepayment || item.deposit || item.zaliczka || item.przedplata ||
      item.przedpłata || item.advance || "0"
    ),
    paidAmount: String(
      item.paid || item.paidAmount || item.paid_amount || item.wplacona ||
      item.wpłacona || item.zaplacono || item.zapłacono || "0"
    ),
    status: normalizeStatus(
      item.status || item.stan || ""
    ),
  }));
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
    if (!isNaN(excelDate.getTime())) {
      return excelDate.toISOString().split('T')[0];
    }
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

export async function fetchReservations(dateFrom?: string, dateTo?: string): Promise<{
  success: boolean;
  reservations: HotResReservation[];
  message: string;
  rawResponse?: any;
}> {
  const config = getConfig();
  const baseUrl = config.baseUrl || discoveredBaseUrl || "https://panel.hotres.pl/api";

  const reservationEndpoints = ["/reservations", "/bookings", "/rezerwacje"];
  const dateParamVariants = dateFrom || dateTo ? [
    { from: dateFrom, to: dateTo },
    { date_from: dateFrom, date_to: dateTo },
    { start: dateFrom, end: dateTo },
    { checkin: dateFrom, checkout: dateTo },
    { arrival: dateFrom, departure: dateTo },
  ] : [{}];

  const diagnostics: Array<{ url: string; status: number; dataPreview: string; parsed: number }> = [];

  for (const endpoint of reservationEndpoints) {
    for (const params of dateParamVariants) {
      const filteredParams = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
      const queryString = Object.entries(filteredParams).map(([k, v]) => `${k}=${encodeURIComponent(v!)}`).join("&");
      const url = queryString ? `${baseUrl}${endpoint}?${queryString}` : `${baseUrl}${endpoint}`;
      try {
        const result = await makeRequest(url, config);
        const reservations = parseReservationsFromResponse(result.data);
        const preview = typeof result.data === 'string' ? result.data.substring(0, 300) : JSON.stringify(result.data).substring(0, 300);
        diagnostics.push({ url, status: result.status, dataPreview: preview, parsed: reservations.length });

        if (result.status >= 200 && result.status < 300 && reservations.length > 0) {
          return {
            success: true,
            reservations,
            message: `Pobrano ${reservations.length} rezerwacji z HotRes`,
            rawResponse: result.data,
          };
        }

        if (result.status >= 200 && result.status < 300 && reservations.length === 0) {
          const data = result.data;
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const allArrayKeys = Object.entries(data)
              .filter(([, v]) => Array.isArray(v))
              .map(([k, v]) => ({ key: k, count: (v as any[]).length }));
            if (allArrayKeys.length > 0) {
              for (const arrInfo of allArrayKeys) {
                const items = (data as any)[arrInfo.key];
                const mapped = items.map((item: any) => ({
                  reservationNumber: String(
                    item.reservationNumber || item.reservation_number || item.numer_rezerwacji ||
                    item.booking_number || item.id || item.nr || item.numer || item.number ||
                    `HR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
                  ),
                  apartmentName: String(
                    item.apartmentName || item.apartment_name || item.room_name || item.nazwa_pokoju ||
                    item.room || item.pokoj || item.pokój || item.unit || item.apartment ||
                    item.nazwa || item.obiekt || item.nazwa_obiektu || ""
                  ),
                  startDate: normalizeDate(
                    item.startDate || item.start_date || item.check_in || item.checkin ||
                    item.data_przyjazdu || item.arrival || item.from || item.od ||
                    item.data_od || item.poczatek || item.start || ""
                  ),
                  endDate: normalizeDate(
                    item.endDate || item.end_date || item.check_out || item.checkout ||
                    item.data_wyjazdu || item.departure || item.to || item.do ||
                    item.data_do || item.koniec || item.end || ""
                  ),
                  guestName: String(
                    item.guestName || item.guest_name || item.guest || item.gosc || item.gość ||
                    item.name || item.imie_nazwisko || item.client || item.klient ||
                    item.nazwisko || item.imie || item.osoba || "Nieznany"
                  ),
                  price: String(
                    item.price || item.total || item.cena || item.kwota || item.amount ||
                    item.total_price || item.wartosc || item.wartość || item.netto || item.brutto || "0"
                  ),
                  prepayment: String(
                    item.prepayment || item.deposit || item.zaliczka || item.przedplata ||
                    item.przedpłata || item.advance || "0"
                  ),
                  status: normalizeStatus(item.status || item.stan || ""),
                }));
                const valid = mapped.filter((r: HotResReservation) => r.startDate && r.endDate);
                if (valid.length > 0) {
                  return {
                    success: true,
                    reservations: valid,
                    message: `Pobrano ${valid.length} rezerwacji z HotRes (klucz: ${arrInfo.key})`,
                    rawResponse: result.data,
                  };
                }
              }
            }
          }
        }
      } catch {
        continue;
      }
      if (diagnostics.length > 0 && !dateFrom && !dateTo) break;
    }
  }

  return {
    success: false,
    reservations: [],
    message: "Nie udało się pobrać rezerwacji z HotRes. Sprawdź klucze API i adres URL.",
    rawResponse: { diagnostics },
  };
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

  // Headerless CSV - fixed column positions matching HotRes export format:
  // 0:number 1:status 2:add_date 3:arrival 4:departure 5:amount 6:paid 7:currency
  // 8:rate_title 9:last_name 10:first_name 11:email 12:phone 13:address 14:city
  // 15:zip 16:roomscodes 17:source 18:source_portal 19:source_commission
  // 20:referer_url 21:discount_code 22:rate_board 23:message 24:comments
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
