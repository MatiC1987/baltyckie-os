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
