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
  startDate: string;
  endDate: string;
  guestName: string;
  price: string;
  prepayment: string;
  status: string;
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
      item.booking_number || item.id || item.nr || `HR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    ),
    apartmentName: String(
      item.apartmentName || item.apartment_name || item.room_name || item.nazwa_pokoju ||
      item.room || item.pokoj || item.pokój || item.unit || item.apartment || ""
    ),
    startDate: normalizeDate(
      item.startDate || item.start_date || item.check_in || item.checkin ||
      item.data_przyjazdu || item.arrival || item.from || item.od || ""
    ),
    endDate: normalizeDate(
      item.endDate || item.end_date || item.check_out || item.checkout ||
      item.data_wyjazdu || item.departure || item.to || item.do || ""
    ),
    guestName: String(
      item.guestName || item.guest_name || item.guest || item.gosc || item.gość ||
      item.name || item.imie_nazwisko || item.client || item.klient || "Nieznany"
    ),
    price: String(
      item.price || item.total || item.cena || item.kwota || item.amount ||
      item.total_price || item.wartosc || item.wartość || "0"
    ),
    prepayment: String(
      item.prepayment || item.deposit || item.zaliczka || item.przedplata ||
      item.przedpłata || item.advance || "0"
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

function normalizeStatus(val: any): string {
  const s = String(val).toUpperCase().trim();
  if (s.includes("CONFIRM") || s.includes("ACCEPT") || s.includes("POTWIERDZ") || s.includes("PRZYJ")) return "ACCEPTED";
  if (s.includes("CANCEL") || s.includes("ANUL") || s.includes("ANULOWA")) return "CANCELLED";
  if (s.includes("PEND") || s.includes("OCZEK")) return "PENDING";
  if (s.includes("COMPLET") || s.includes("ZAKON") || s.includes("ZREALI")) return "COMPLETED";
  return s || "ACCEPTED";
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
