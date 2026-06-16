import { storage } from "./storage";

export interface HotResSyncResult {
  imported: number;
  updated: number;
  skipped: number;
  newApartments: number;
  lastSync: string;
  error?: string;
  log: string[];
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
    };
  }

  let apiData: any[];
  try {
    const url = `https://panel.hotres.pl/api_reservations?auth=${encodeURIComponent(authKey)}&apikey=${encodeURIComponent(apiKey)}`;
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
  const log: string[] = [];

  log.push(`Pobrano ${apiData.length} rezerwacji z HotRes API`);

  for (const item of apiData) {
    const resNumber = String(item.number || item.id || "").trim();
    if (!resNumber) {
      skipped++;
      continue;
    }

    const startDate = normalizeDate(item.arrival_date || item.start_date || "");
    const endDate = normalizeDate(item.departure_date || item.end_date || "");

    if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      skipped++;
      log.push(`Pominięto rez. ${resNumber}: nieprawidłowe daty (${item.arrival_date} → ${item.departure_date})`);
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
          log.push(`Utworzono apartament: ${aptName}`);
        } catch {
          skipped++;
          log.push(`Pominięto rez. ${resNumber}: nie można utworzyć apartamentu '${aptName}'`);
          continue;
        }
      }
      if (!resolvedAptIds.includes(foundId)) {
        resolvedAptIds.push(foundId);
      }
    }

    const primaryAptId = resolvedAptIds.length > 0 ? resolvedAptIds[0] : null;
    const isGroupReservation = resolvedAptIds.length > 1;

    const price = total.toFixed(2);
    const surcharge = addonsAmount.toFixed(2);

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
        });
        updated++;
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
        });
        imported++;
        if (isGroupReservation) {
          const names = resolvedAptIds.map(id => allApartments.find(a => a.id === id)?.name || `ID:${id}`).join(", ");
          log.push(`Rezerwacja grupowa ${resNumber}: ${names}`);
        }
      }
    } catch (e: any) {
      skipped++;
      log.push(`Błąd zapisu rez. ${resNumber}: ${e.message}`);
    }
  }

  if (updated > 0) log.push(`Zaktualizowano ${updated} istniejących rezerwacji`);
  log.push(`Podsumowanie: nowe=${imported}, zaktualizowane=${updated}, pominięte=${skipped}, nowe apt=${newApartments}`);

  await storage.saveImportMetadata({
    importType: "hotres_api",
    recordsImported: imported,
    recordsUpdated: updated,
    recordsSkipped: skipped,
    details: `API sync: nowe=${imported}, zaktualizowane=${updated}, pominięte=${skipped}`,
  });

  return { imported, updated, skipped, newApartments, lastSync, log };
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startHotResSyncScheduler(): void {
  if (syncInterval) return;
  const INTERVAL_MS = 60 * 60 * 1000;

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
  console.log("[hotres-sync] Harmonogram automatyczny uruchomiony (co 60 min), startuje natychmiast...");
  runSync();
}
