import { db } from "./db";
import { pricingRules, dailyPrices, priceChangeHistory } from "@shared/schema";
import { eq, and, between } from "drizzle-orm";
import { updatePrices } from "./hotres";
import { log } from "./index";

const SCHEDULER_INTERVAL_MS = 60 * 60 * 1000;
const MAX_CHANGE_PERCENT = 50;

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
          try {
            await updatePrices([{
              type_id: (apt as any).hotresTypeId,
              rate_id: (apt as any).hotresRateId || 0,
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

    if (totalApplied > 0 || totalSkipped > 0) {
      log(`[SCHEDULER] Auto-apply: ${totalApplied} zmian, ${totalSkipped} pominiętych`, "pricing");
    }
  } catch (err: any) {
    log(`[SCHEDULER] Error: ${err.message}`, "pricing");
  }
}

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

export function startPricingScheduler(): void {
  if (schedulerTimer) clearInterval(schedulerTimer);

  log("[SCHEDULER] Pricing scheduler started (interval: 1h)", "pricing");

  setTimeout(() => {
    runAutoApplyRules();
  }, 10000);

  schedulerTimer = setInterval(() => {
    runAutoApplyRules();
  }, SCHEDULER_INTERVAL_MS);
}

export function stopPricingScheduler(): void {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    log("[SCHEDULER] Pricing scheduler stopped", "pricing");
  }
}
