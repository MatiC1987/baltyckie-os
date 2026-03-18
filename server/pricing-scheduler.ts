import { db } from "./db";
import { pricingRules, dailyPrices, priceChangeHistory, appConfig } from "@shared/schema";
import { eq, and, between } from "drizzle-orm";
import { updatePrices } from "./hotres";
import { log } from "./index";

const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000;
const MAX_CHANGE_PERCENT = 50;

async function isHotresExportEnabled(): Promise<boolean> {
  const row = await db.select().from(appConfig).where(eq(appConfig.key, "hotres_export_enabled")).limit(1);
  if (row.length === 0) return false;
  return row[0].value === "true";
}

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function runAutoApplyRules(): Promise<void> {
  try {
    const rules = await db.select().from(pricingRules)
      .where(and(eq(pricingRules.active, true), eq(pricingRules.autoApply, true)))
      .orderBy(pricingRules.priority);

    if (rules.length === 0) return;

    const now = new Date();
    const from = fmtDate(now);
    const to = fmtDate(new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000));

    const { storage } = await import("./storage");
    const allApartments = await storage.getApartments();
    let totalApplied = 0;
    let totalSkipped = 0;

    for (const rule of rules) {
      const ruleFrom = rule.dateFrom && rule.dateFrom > from ? rule.dateFrom : from;
      const ruleTo = rule.dateTo && rule.dateTo < to ? rule.dateTo : to;
      if (ruleFrom > ruleTo) continue;

      let targetApts = allApartments;
      if (rule.apartmentIds && rule.apartmentIds.length > 0) {
        targetApts = allApartments.filter((a: any) => rule.apartmentIds!.includes(a.id));
      }
      if (rule.locationFilter) {
        targetApts = targetApts.filter((a: any) => a.location === rule.locationFilter);
      }

      for (const apt of targetApts) {
        const existingPrices = await db.select().from(dailyPrices)
          .where(and(
            eq(dailyPrices.apartmentId, apt.id),
            between(dailyPrices.date, ruleFrom, ruleTo)
          ));
        const priceMap = new Map(existingPrices.map(p => [p.date, p]));

        const changedPrices: { date: string; price: string }[] = [];
        let d = new Date(ruleFrom);
        const endD = new Date(ruleTo);

        while (d <= endD) {
          const dateStr = fmtDate(d);
          const dayOfWeek = d.getDay();
          const existing = priceMap.get(dateStr);

          if (!existing) { d.setDate(d.getDate() + 1); continue; }

          if (rule.dayOfWeek && rule.dayOfWeek.length > 0 && !rule.dayOfWeek.includes(dayOfWeek)) {
            d.setDate(d.getDate() + 1); continue;
          }

          const ruleType = rule.type || "seasonal";
          if (ruleType === "weekend" && dayOfWeek !== 5 && dayOfWeek !== 6) {
            d.setDate(d.getDate() + 1); continue;
          }
          if (ruleType === "last_minute") {
            const daysUntil = Math.floor((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntil > (rule.minStayRule || 7)) { d.setDate(d.getDate() + 1); continue; }
          }
          if (ruleType === "long_stay") {
            const minStay = (existing as any).minStay || 1;
            if (minStay < (rule.minStayRule || 7)) { d.setDate(d.getDate() + 1); continue; }
          }

          const oldPrice = parseFloat(existing.price);
          let newPrice: number;
          if (rule.modifierType === "percentage") {
            newPrice = oldPrice * (1 + parseFloat(rule.modifier) / 100);
          } else {
            newPrice = oldPrice + parseFloat(rule.modifier);
          }

          const minP = (apt as any).minPrice ? parseFloat((apt as any).minPrice) : 0;
          const maxP = (apt as any).maxPrice ? parseFloat((apt as any).maxPrice) : Infinity;
          newPrice = Math.max(minP, Math.min(maxP, newPrice));
          newPrice = Math.round(newPrice * 100) / 100;

          const changePercent = oldPrice > 0 ? Math.abs((newPrice - oldPrice) / oldPrice) * 100 : 0;
          if (changePercent > MAX_CHANGE_PERCENT) {
            totalSkipped++;
            d.setDate(d.getDate() + 1);
            continue;
          }

          if (newPrice !== oldPrice) {
            await db.update(dailyPrices).set({
              price: String(newPrice),
              isAutoPrice: true,
              ruleId: rule.id,
              source: "auto",
              updatedAt: new Date(),
            }).where(eq(dailyPrices.id, existing.id));

            await db.insert(priceChangeHistory).values({
              apartmentId: apt.id,
              date: dateStr,
              oldPrice: String(oldPrice),
              newPrice: String(newPrice),
              changedBy: "scheduler",
              reason: `Auto-reguła: ${rule.name}`,
              source: "auto",
              ruleId: rule.id,
            });

            changedPrices.push({ date: dateStr, price: String(newPrice) });
            totalApplied++;
          }

          d.setDate(d.getDate() + 1);
        }

        if (changedPrices.length > 0 && (apt as any).hotresTypeId) {
          const exportEnabled = await isHotresExportEnabled();
          if (!exportEnabled) {
            log(`[SCHEDULER] HotRes export disabled — skipping push for ${apt.name} (${changedPrices.length} changes applied locally only)`, "pricing");
          } else {
            try {
              if (!(apt as any).hotresRateId) {
                console.log(`[SCHEDULER] Skipping HotRes push for apt ${apt.id}: missing hotresRateId`);
                continue;
              }
              await updatePrices([{
                type_id: (apt as any).hotresTypeId,
                rate_id: (apt as any).hotresRateId,
                mode: "delta" as const,
                prices: changedPrices.map(p => ({
                  from: p.date,
                  till: p.date,
                  baseprice: parseFloat(p.price),
                })),
              }]);
            } catch (hotresErr: any) {
              log(`[SCHEDULER] Hotres push error for ${apt.name}: ${hotresErr.message}`, "pricing");
            }
          }
        }
      }
    }

    if (totalApplied > 0 || totalSkipped > 0) {
      log(`[SCHEDULER] Auto-apply: ${totalApplied} zmian, ${totalSkipped} pominiętych`, "pricing");
    }
  } catch (err: any) {
    log(`[SCHEDULER] Error: ${err.message}`, "pricing");
  }
}

async function runAutoImport(): Promise<void> {
  try {
    const freqRow = await db.select().from(appConfig).where(eq(appConfig.key, "hotres_import_frequency")).limit(1);
    const frequency = freqRow.length > 0 ? freqRow[0].value : "disabled";
    if (frequency === "disabled") return;

    const lastRow = await db.select().from(appConfig).where(eq(appConfig.key, "hotres_last_auto_import")).limit(1);
    const lastImport = lastRow.length > 0 && lastRow[0].value ? new Date(lastRow[0].value) : null;
    const now = new Date();

    if (lastImport) {
      const hoursSince = (now.getTime() - lastImport.getTime()) / (1000 * 60 * 60);
      if (frequency === "4h" && hoursSince < 4) return;
      if (frequency === "daily" && hoursSince < 24) return;
      if (frequency === "weekly" && hoursSince < 168) return;
    }

    log(`[SCHEDULER] Starting auto-import from HotRes (frequency: ${frequency})`, "pricing");

    const { storage } = await import("./storage");
    const { fetchPrices } = await import("./hotres");
    const allApartments = await storage.getApartments();
    const mappedApts = allApartments.filter((a: any) => a.hotresTypeId && a.hotresRateId);

    if (mappedApts.length === 0) {
      log("[SCHEDULER] No mapped apartments — skipping auto-import", "pricing");
      return;
    }

    const from = fmtDate(now);
    const till = fmtDate(new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000));
    let totalImported = 0;

    for (const apt of mappedApts) {
      try {
        const typeId = String((apt as any).hotresTypeId);
        const rateId = String((apt as any).hotresRateId);
        const priceBlocks = await fetchPrices(from, till, typeId, rateId);

        for (const block of priceBlocks) {
          const dates = (block as any).dates || [];
          for (const d of dates) {
            const price = parseFloat(d.price || d.baseprice || "0");
            if (price <= 0) continue;

            const existing = await db.select().from(dailyPrices)
              .where(and(eq(dailyPrices.apartmentId, apt.id), eq(dailyPrices.date, d.date)))
              .limit(1);

            const priceData: any = {
              price: String(price),
              basePrice: d.baseprice ? String(d.baseprice) : String(price),
              source: "hotres",
              updatedAt: now,
              minStay: d.min ? parseInt(d.min) : null,
              maxStay: d.max ? parseInt(d.max) : null,
              closedToArrival: d.cta === 1 || d.cta === "1",
              closedToDeparture: d.ctd === 1 || d.ctd === "1",
            };

            for (let i = 1; i <= 8; i++) {
              const key = `pers${i}`;
              const col = `pricePerPerson${i}`;
              if (d[key]) priceData[col] = String(d[key]);
            }
            for (let i = 1; i <= 3; i++) {
              const key = `child${i}`;
              const col = `childPrice${i}`;
              if (d[key]) priceData[col] = String(d[key]);
            }

            if (existing.length > 0) {
              const oldPrice = existing[0].price;
              if (oldPrice !== String(price)) {
                await db.insert(priceChangeHistory).values({
                  apartmentId: apt.id,
                  date: d.date,
                  oldPrice: oldPrice,
                  newPrice: String(price),
                  changedBy: "auto-import",
                  reason: "Auto-import z HotRes",
                  source: "hotres",
                });
              }
              await db.update(dailyPrices).set(priceData).where(eq(dailyPrices.id, existing[0].id));
            } else {
              await db.insert(dailyPrices).values({
                apartmentId: apt.id,
                date: d.date,
                ...priceData,
                hotresTypeId: parseInt(typeId),
                hotresRateId: parseInt(rateId),
              });
            }
            totalImported++;
          }
        }
      } catch (aptErr: any) {
        log(`[SCHEDULER] Auto-import error for ${apt.name}: ${aptErr.message}`, "pricing");
      }
    }

    await db.insert(appConfig).values({ key: "hotres_last_auto_import", value: now.toISOString() })
      .onConflictDoUpdate({ target: appConfig.key, set: { value: now.toISOString(), updatedAt: now } });

    log(`[SCHEDULER] Auto-import complete: ${totalImported} prices for ${mappedApts.length} apartments`, "pricing");
  } catch (err: any) {
    log(`[SCHEDULER] Auto-import error: ${err.message}`, "pricing");
  }
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startPricingScheduler(): void {
  if (schedulerTimer) clearInterval(schedulerTimer);

  log("[SCHEDULER] Pricing scheduler started (interval: 1h)", "pricing");

  setTimeout(() => {
    runAutoApplyRules();
    runAutoImport();
  }, 10000);

  schedulerTimer = setInterval(() => {
    runAutoApplyRules();
    runAutoImport();
  }, SCHEDULER_INTERVAL_MS);
}

export function stopPricingScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    log("[SCHEDULER] Pricing scheduler stopped", "pricing");
  }
}
