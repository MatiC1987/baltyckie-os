import { storage } from "./storage";

export interface HotResSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  newApartments: number;
  lastSync: string;
  error?: string;
  log: string[];
  // Customer-specific stats
  customersCreated: number;
  customersUpdated: number;
  reservationsLinked: number;
  duplicates: number;
}

function normalizeApiStatus(val: string): string {
  const s = (val || "").toLowerCase().trim();
  if (s === "cancelled" || s === "canceled" || s.includes("cancel") || s.includes("anul")) return "ANULOWANA";
  if (s === "confirmed" || s === "accepted" || s.includes("confirm") || s.includes("accept")) return "PRZYJETA";
  if (s === "new" || s === "pending") return "DO_OPLACENIA";
  if (s === "completed" || s === "checkedout" || s === "checkout") return "PRZYJETA";
  return "DO_OPLACENIA";
}

function normalizeApiSource(val: string): string {
  if (!val) return "";
  const s = val.toLowerCase().trim();
  if (s.includes("booking")) return "Booking.com";
  if (s.includes("airbnb")) return "Airbnb";
  if (s.includes("reception") || s.includes("recepcja") || s.includes("walk")) return "Recepcja";
  if (s.includes("hotres")) return "HotRes";
  if (val.trim()) return "Inne";
  return "";
}

function normalizeDate(val: string): string {
  if (!val) return "";
  const isoMatch = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const euMatch = val.match(/^(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (euMatch) return `${euMatch[3]}-${euMatch[2]}-${euMatch[1]}`;
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch {}
  return "";
}

export async function syncHotResReservations(): Promise<HotResSyncResult> {
  const authKey = process.env.HOTRES_AUTH_KEY;
  const apiKey = process.env.HOTRES_API_KEY;
  const lastSync = new Date().toISOString();

  if (!authKey || !apiKey) {
    return {
      imported: 0, updated: 0, skipped: 0, newApartments: 0, lastSync,
      error: "Brak kluczy API HotRes (HOTRES_AUTH_KEY, HOTRES_API_KEY). Skonfiguruj je w ustawieniach.",
      log: [],
      customersCreated: 0, customersUpdated: 0, reservationsLinked: 0, duplicates: 0,
    };
  }

  let apiData: any[];
  try {
    // Parametr: mod_date (format Y-m-d H:i:s), domyślnie -2h od teraz.
    // Używamy 90 dni wstecz żeby złapać wszystkie ostatnio zmodyfikowane.
    // UWAGA: `from` nie jest parametrem API HotRes — ignorowane przez serwer.
    const modDate = new Date();
    modDate.setDate(modDate.getDate() - 90);
    const modDateStr = modDate.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
    const url = `https://panel.hotres.pl/api_reservations?auth=${encodeURIComponent(authKey)}&apikey=${encodeURIComponent(apiKey)}&mod_date=${encodeURIComponent(modDateStr)}`;
    const response = await fetch(url, {
      headers: { "Accept": "application/json" },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        imported: 0, updated: 0, skipped: 0, newApartments: 0, lastSync,
        error: `HotRes API zwróciło błąd ${response.status}: ${text.slice(0, 200)}`,
        log: [],
      };
    }

    const raw = await response.json();
    if (Array.isArray(raw)) {
      apiData = raw;
    } else if (raw && Array.isArray(raw.reservations)) {
      apiData = raw.reservations;
    } else if (raw && Array.isArray(raw.data)) {
      apiData = raw.data;
    } else {
      return {
        imported: 0, updated: 0, skipped: 0, newApartments: 0, lastSync,
        error: `Nieoczekiwany format odpowiedzi API HotRes`,
        log: [`Otrzymano: ${JSON.stringify(raw).slice(0, 300)}`],
      };
    }
  } catch (e: any) {
    return {
      imported: 0, updated: 0, skipped: 0, newApartments: 0, lastSync,
      error: `Błąd połączenia z HotRes API: ${e.message}`,
      log: [],
    };
  }

  const allApartments = await storage.getApartments();
  const apartmentMap = new Map(allApartments.map(a => [a.name.trim().toLowerCase(), a.id]));
  const hotresNameMap = new Map(
    allApartments.filter(a => a.hotresName).map(a => [a.hotresName!.trim().toLowerCase(), a.id])
  );

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let newApartments = 0;
  let customersCreated = 0;
  let customersUpdated = 0;
  let reservationsLinked = 0;
  let duplicates = 0;
  const log: string[] = [];
  const updatedCustomerIds = new Set<number>();

  log.push(`Pobrano ${apiData.length} rezerwacji z HotRes API`);

  for (const item of apiData) {
    const resNumber = String(item.number || item.id || "").trim();
    if (!resNumber) {
      skipped++;
      log.push(`[POMINIĘTO] Rezerwacja bez numeru: ${JSON.stringify(item).slice(0, 120)}`);
      continue;
    }

    const startDate = normalizeDate(item.arrival_date || item.start_date || "");
    const endDate = normalizeDate(item.departure_date || item.end_date || "");

    if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      skipped++;
      log.push(`[POMINIĘTO] Rez. ${resNumber}: nieprawidłowe daty (przyjazd="${item.arrival_date || item.start_date}", wyjazd="${item.departure_date || item.end_date}")`);
      continue;
    }

    const firstName = (item.first_name || "").trim();
    const lastName = (item.last_name || "").trim();
    const guestName = ([firstName, lastName].filter(Boolean).join(" ") || "Nieznany").toUpperCase();

    const addDate = normalizeDate(item.add_date || "");

    const total = parseFloat(item.total || item.price || "0") || 0;
    const addonsAmount = parseFloat(item.addons_amount || "0") || 0;

    const status = normalizeApiStatus(item.status || "");
    const source = normalizeApiSource(item.source || "");

    const prepayment = String(parseFloat(item.deposit || "0") || 0);
    const paidAmount = String(parseFloat(item.paid || "0") || 0);

    const rooms: any[] = Array.isArray(item.rooms) ? item.rooms : [];
    const apartmentNames: string[] = rooms.length > 0
      ? rooms.map((r: any) => (r.code || r.title || "").trim()).filter(Boolean)
      : [String(item.room || item.apartment || "").trim()].filter(Boolean);

    const resolvedAptIds: number[] = [];
    for (const aptName of apartmentNames) {
      const key = aptName.toLowerCase();
      let foundId = hotresNameMap.get(key) || apartmentMap.get(key);
      if (!foundId) {
        try {
          const apt = await storage.createApartment({
            name: aptName,
            location: "",
            address: "",
            ownerName: "",
            active: true,
          });
          apartmentMap.set(key, apt.id);
          allApartments.push(apt);
          foundId = apt.id;
          newApartments++;
          log.push(`[NOWY APT] Utworzono apartament: ${aptName} (rez. ${resNumber})`);
        } catch {
          skipped++;
          log.push(`[POMINIĘTO] Rez. ${resNumber}: nie można utworzyć apartamentu '${aptName}'`);
          continue;
        }
      }
      if (!resolvedAptIds.includes(foundId)) {
        resolvedAptIds.push(foundId);
      }
    }

    const primaryAptId = resolvedAptIds.length > 0 ? resolvedAptIds[0] : null;
    const isGroupReservation = resolvedAptIds.length > 1;

    // total = pełna wartość rezerwacji (nocleg + sprzątanie + podatek) = "Wartość" w HotRes
    // addons_amount = składowe dodatki (sprzątanie + podatek) — podzbiór total, NIE coś ekstra
    const price = total.toFixed(2);
    const surcharge = addonsAmount.toFixed(2);

    // Extract customer data from HotRes item
    const phone = (item.phone || "").trim();
    const email = (item.email || "").trim();
    const nationality = (item.nationality || item.country || "").trim();
    const street = (item.address || item.street || "").trim();
    const city = (item.city || "").trim();
    const hotresItemId = String(item.id || item.customer_id || "").trim();

    let customerId: number | null = null;
    if (firstName && lastName) {
      try {
        const { customer, isNew } = await storage.upsertCustomer({
          firstName,
          lastName,
          ...(phone && { phone }),
          ...(email && { email }),
          ...(nationality && { nationality }),
          ...(street && { street }),
          ...(city && { city }),
          ...(hotresItemId && { hotresId: `hotres_${hotresItemId}` }),
          source: "hotres",
          lastStayDate: endDate,
        });
        customerId = customer.id;
        updatedCustomerIds.add(customer.id);
        if (isNew) {
          customersCreated++;
        } else {
          customersUpdated++;
          duplicates++;
        }
      } catch (e: any) {
        // Non-fatal: continue without customer link
        log.push(`Uwaga: nie udało się upsert klienta ${guestName}: ${e.message}`);
      }
    }

    const aptLabel = primaryAptId
      ? (allApartments.find(a => a.id === primaryAptId)?.name || `apt#${primaryAptId}`)
      : (apartmentNames[0] || "brak apartamentu");

    try {
      const existing = await storage.getReservationByNumber(resNumber);
      if (existing) {
        await storage.updateReservation(existing.id, {
          apartmentId: primaryAptId,
          apartmentIds: isGroupReservation ? resolvedAptIds : null,
          addDate: addDate && /^\d{4}-\d{2}-\d{2}$/.test(addDate) ? addDate : undefined,
          startDate,
          endDate,
          guestName,
          price,
          prepayment,
          paidAmount,
          surcharge,
          status,
          ...(source && { source }),
          ...(customerId && { customerId }),
        });
        updated++;
        if (customerId) reservationsLinked++;
        log.push(`[AKTUALIZACJA] Rez. ${resNumber} | ${guestName} | ${startDate}–${endDate} | ${aptLabel} | ${status}`);
      } else {
        await storage.createReservation({
          reservationNumber: resNumber,
          apartmentId: primaryAptId,
          apartmentIds: isGroupReservation ? resolvedAptIds : null,
          addDate: addDate && /^\d{4}-\d{2}-\d{2}$/.test(addDate) ? addDate : null,
          startDate,
          endDate,
          guestName,
          price,
          prepayment,
          paidAmount,
          surcharge,
          status,
          ...(source && { source }),
          ...(customerId && { customerId }),
        });
        imported++;
        if (customerId) reservationsLinked++;
        const groupInfo = isGroupReservation
          ? ` [GRUPOWA: ${resolvedAptIds.map(id => allApartments.find(a => a.id === id)?.name || `ID:${id}`).join(", ")}]`
          : "";
        log.push(`[NOWA] Rez. ${resNumber} | ${guestName} | ${startDate}–${endDate} | ${aptLabel} | ${status}${groupInfo}`);
      }
    } catch (e: any) {
      skipped++;
      log.push(`[BŁĄD] Rez. ${resNumber} | ${guestName} | ${startDate}–${endDate}: ${e.message}`);
    }
  }

  log.push(`[PODSUMOWANIE] nowe=${imported}, zaktualizowane=${updated}, pominięte=${skipped}, nowe apt=${newApartments}`);

  // Update customer stats in batch after all reservations processed
  if (updatedCustomerIds.size > 0) {
    try {
      const allRes = await storage.getReservations({});
      for (const customerId of updatedCustomerIds) {
        const customerRes = allRes.filter(r => r.customerId === customerId);
        const confirmed = customerRes.filter(r => r.status !== "ANULOWANA");
        const totalStays = confirmed.length;
        const totalRevenue = confirmed.reduce((s, r) => s + parseFloat(r.price || "0"), 0);
        const latestStay = confirmed.map(r => r.endDate).sort().reverse()[0];
        if (totalStays > 0) {
          await storage.updateCustomer(customerId, {
            totalStays,
            totalRevenue: totalRevenue.toFixed(2),
            ...(latestStay && { lastStayDate: latestStay }),
          });
        }
      }
      log.push(`Zaktualizowano statystyki dla ${updatedCustomerIds.size} klientów`);
    } catch (e: any) {
      log.push(`Uwaga: błąd aktualizacji statystyk klientów: ${e.message}`);
    }
  }

  await storage.saveImportMetadata({
    importType: "hotres_api",
    recordsImported: imported,
    recordsUpdated: updated,
    recordsSkipped: skipped,
    details: `API sync: nowe=${imported}, zaktualizowane=${updated}, pominięte=${skipped}`,
  });

  return {
    imported, updated, skipped, newApartments, lastSync, log,
    customersCreated, customersUpdated, reservationsLinked, duplicates,
  };
}

// Pomocnicza funkcja: przetwarza jedną rezerwację z API i upsertuje w DB.
// Zwraca 'imported' | 'updated' | 'skipped'.
async function processApiReservation(
  item: any,
  allApartments: any[],
  apartmentMap: Map<string, number>,
  hotresNameMap: Map<string, number>,
  log: string[],
): Promise<"imported" | "updated" | "skipped"> {
  const resNumber = String(item.number || item.id || "").trim();
  if (!resNumber) return "skipped";

  const startDate = normalizeDate(item.arrival_date || item.start_date || "");
  const endDate = normalizeDate(item.departure_date || item.end_date || "");
  if (!startDate || !endDate) return "skipped";

  const firstName = (item.first_name || "").trim();
  const lastName = (item.last_name || "").trim();
  const guestName = ([firstName, lastName].filter(Boolean).join(" ") || "Nieznany").toUpperCase();
  const addDate = normalizeDate(item.add_date || "");

  // total = pełna wartość rezerwacji (nocleg + sprzątanie + podatek) = "Wartość" w HotRes
  // addons_amount = składowe dodatki (sprzątanie + podatek) — podzbiór total, NIE coś ekstra
  const total = parseFloat(item.total || item.price || "0") || 0;
  const addonsAmount = parseFloat(item.addons_amount || "0") || 0;
  const price = total.toFixed(2);
  const surcharge = addonsAmount.toFixed(2);

  const status = normalizeApiStatus(item.status || "");
  const source = normalizeApiSource(item.source || "");
  const prepayment = String(parseFloat(item.deposit || "0") || 0);
  const paidAmount = String(parseFloat(item.paid || "0") || 0);

  const rooms: any[] = Array.isArray(item.rooms) ? item.rooms : [];
  const apartmentNames: string[] = rooms.length > 0
    ? rooms.map((r: any) => (r.code || r.title || "").trim()).filter(Boolean)
    : [String(item.room || item.apartment || "").trim()].filter(Boolean);

  const resolvedAptIds: number[] = [];
  for (const aptName of apartmentNames) {
    const key = aptName.toLowerCase();
    let foundId = hotresNameMap.get(key) || apartmentMap.get(key);
    if (!foundId) {
      try {
        const apt = await storage.createApartment({ name: aptName, location: "", address: "", ownerName: "", active: true });
        apartmentMap.set(key, apt.id);
        allApartments.push(apt);
        foundId = apt.id;
        log.push(`[NOWY APT] ${aptName}`);
      } catch { return "skipped"; }
    }
    if (!resolvedAptIds.includes(foundId)) resolvedAptIds.push(foundId);
  }

  const primaryAptId = resolvedAptIds.length > 0 ? resolvedAptIds[0] : null;
  const isGroup = resolvedAptIds.length > 1;

  try {
    const existing = await storage.getReservationByNumber(resNumber);
    if (existing) {
      await storage.updateReservation(existing.id, {
        apartmentId: primaryAptId,
        apartmentIds: isGroup ? resolvedAptIds : null,
        addDate: addDate && /^\d{4}-\d{2}-\d{2}$/.test(addDate) ? addDate : undefined,
        startDate, endDate, guestName, price, prepayment, paidAmount, surcharge, status,
        ...(source && { source }),
      });
      return "updated";
    } else {
      await storage.createReservation({
        reservationNumber: resNumber,
        apartmentId: primaryAptId,
        apartmentIds: isGroup ? resolvedAptIds : null,
        addDate: addDate && /^\d{4}-\d{2}-\d{2}$/.test(addDate) ? addDate : null,
        startDate, endDate, guestName, price, prepayment, paidAmount, surcharge, status,
        ...(source && { source }),
      });
      return "imported";
    }
  } catch (e: any) {
    log.push(`[BŁĄD] Rez. ${resNumber}: ${e.message}`);
    return "skipped";
  }
}

// Pełna synchronizacja historyczna: pobiera WSZYSTKIE rezerwacje przez paginację departure_date.
// Jeden call = max 300 wyników → przy ~2474 rez. potrzeba ~9 wywołań.
// Prawidłowa cena: total (nocleg) + addons_amount (sprzątanie + podatek + inne).
export async function deepSyncHotResReservations(): Promise<HotResSyncResult & { pagesProcessed: number }> {
  const authKey = process.env.HOTRES_AUTH_KEY;
  const apiKey = process.env.HOTRES_API_KEY;
  const lastSync = new Date().toISOString();
  const baseResult = { lastSync, customersCreated: 0, customersUpdated: 0, reservationsLinked: 0, duplicates: 0 };

  if (!authKey || !apiKey) {
    return { ...baseResult, imported: 0, updated: 0, skipped: 0, newApartments: 0, pagesProcessed: 0,
      error: "Brak kluczy API HotRes.", log: [] };
  }

  const allApartments = await storage.getApartments();
  const apartmentMap = new Map(allApartments.map(a => [a.name.trim().toLowerCase(), a.id]));
  const hotresNameMap = new Map(allApartments.filter(a => a.hotresName).map(a => [a.hotresName!.trim().toLowerCase(), a.id]));

  let imported = 0, updated = 0, skipped = 0;
  const log: string[] = [];
  const seenNumbers = new Set<string>();

  let modDate = "2020-01-01 00:00:00";
  let pagesProcessed = 0;
  const MAX_PAGES = 40;

  while (pagesProcessed < MAX_PAGES) {
    const url = `https://panel.hotres.pl/api_reservations?auth=${encodeURIComponent(authKey)}&apikey=${encodeURIComponent(apiKey)}&mod_date=${encodeURIComponent(modDate)}`;
    let batch: any[];
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
      if (!res.ok) { log.push(`Błąd HTTP ${res.status} przy mod_date=${modDate}`); break; }
      const raw = await res.json();
      batch = Array.isArray(raw) ? raw : (Array.isArray(raw?.reservations) ? raw.reservations : []);
    } catch (e: any) {
      log.push(`Błąd połączenia: ${e.message}`); break;
    }

    pagesProcessed++;
    log.push(`Strona ${pagesProcessed}: mod_date >= ${modDate} → ${batch.length} rezerwacji`);

    if (batch.length === 0) break;

    // Find max mod_date BEFORE filtering duplicates (need it for pagination)
    const modDates = batch.map((r: any) => r.mod_date || r.updated_at).filter(Boolean).sort();
    const maxModDate = modDates[modDates.length - 1] as string | undefined;

    for (const item of batch) {
      const num = String(item.number || item.id || "").trim();
      if (!num || seenNumbers.has(num)) continue;
      seenNumbers.add(num);
      const result = await processApiReservation(item, allApartments, apartmentMap, hotresNameMap, log);
      if (result === "imported") imported++;
      else if (result === "updated") updated++;
      else skipped++;
    }

    if (batch.length < 300) break; // ostatnia strona

    // Paginacja: użyj max mod_date jako nowej dolnej granicy
    if (!maxModDate || maxModDate <= modDate) {
      log.push(`Paginacja zatrzymana: brak postępu (maxModDate=${maxModDate})`);
      break;
    }
    modDate = maxModDate;
  }

  log.push(`[PODSUMOWANIE DEEP SYNC] strony=${pagesProcessed}, nowe=${imported}, zaktualizowane=${updated}, pominięte=${skipped}`);

  await storage.saveImportMetadata({
    importType: "hotres_api",
    recordsImported: imported,
    recordsUpdated: updated,
    recordsSkipped: skipped,
    details: `Deep sync: strony=${pagesProcessed}, nowe=${imported}, zaktualizowane=${updated}`,
  });

  return { imported, updated, skipped, newApartments: 0, lastSync, log, pagesProcessed, ...baseResult };
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startHotResSyncScheduler(): void {
  if (syncInterval) return;
  const INTERVAL_MS = 15 * 60 * 1000;

  const runSync = async () => {
    console.log("[hotres-sync] Automatyczna synchronizacja...");
    try {
      const result = await syncHotResReservations();
      if (result.error) {
        console.error(`[hotres-sync] Błąd: ${result.error}`);
      } else {
        console.log(`[hotres-sync] OK: +${result.imported} nowych, ~${result.updated} zaktualizowanych, ${result.skipped} pominiętych`);
      }
    } catch (e: any) {
      console.error("[hotres-sync] Nieoczekiwany błąd:", e.message);
    }
  };

  syncInterval = setInterval(runSync, INTERVAL_MS);
  console.log("[hotres-sync] Harmonogram automatyczny uruchomiony (co 15 min), startuje natychmiast...");
  runSync();
}
