import { storage } from "./storage";
import { db } from "./db";
import { appConfig } from "@shared/schema";
import { eq } from "drizzle-orm";
import type { SyncResult } from "./vectra-scraper";

export interface VectraScheduleConfig {
  enabled: boolean;
  hour: number;
}

const DEFAULT_CONFIG: VectraScheduleConfig = { enabled: false, hour: 3 };

let schedulerInterval: ReturnType<typeof setInterval> | null = null;
let lastRunDate: string | null = null;

export async function getVectraScheduleConfig(): Promise<VectraScheduleConfig> {
  try {
    const [row] = await db.select().from(appConfig).where(eq(appConfig.key, "vectra_schedule"));
    if (row?.value) {
      const parsed = JSON.parse(row.value);
      return {
        enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_CONFIG.enabled,
        hour: typeof parsed.hour === "number" ? Math.max(0, Math.min(23, parsed.hour)) : DEFAULT_CONFIG.hour,
      };
    }
  } catch (e) {
    console.error("[vectra-scheduler] Błąd odczytu konfiguracji:", e);
  }
  return { ...DEFAULT_CONFIG };
}

export async function setVectraScheduleConfig(config: VectraScheduleConfig): Promise<void> {
  const value = JSON.stringify(config);
  const [existing] = await db.select().from(appConfig).where(eq(appConfig.key, "vectra_schedule"));
  if (existing) {
    await db.update(appConfig).set({ value, updatedAt: new Date() }).where(eq(appConfig.key, "vectra_schedule"));
  } else {
    await db.insert(appConfig).values({ key: "vectra_schedule", value });
  }
}

async function runVectraScheduledSync(): Promise<void> {
  console.log("[vectra-scheduler] Rozpoczynam automatyczną synchronizację...");
  try {
    const { syncVectraAccount } = await import("./vectra-scraper");
    const accounts = await storage.getVectraAccounts();
    if (accounts.length === 0) {
      console.log("[vectra-scheduler] Brak kont Vectra — pomijam");
      return;
    }

    let totalNew = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    const errorMessages: string[] = [];
    const results: SyncResult[] = [];

    for (const account of accounts) {
      try {
        const result = await syncVectraAccount(account.id);
        results.push(result);
        totalNew += result.newInvoices;
        totalSkipped += result.skipped;
        if (result.error) {
          totalErrors++;
          errorMessages.push(`${account.label}: ${result.error}`);
        }
      } catch (e: any) {
        totalErrors++;
        errorMessages.push(`${account.label}: ${e.message || "nieznany błąd"}`);
      }
    }

    console.log(`[vectra-scheduler] Zakończono: ${totalNew} nowych faktur, ${totalErrors} błędów`);
    await storage.createVectraSyncLog({
      mode: "auto",
      newInvoices: totalNew,
      skipped: totalSkipped,
      errorCount: totalErrors,
      errorDetails: errorMessages.length > 0 ? errorMessages.join("; ") : null,
      accounts: accounts.map((a) => a.label).join(", "),
    }).catch((e: any) => console.error("[vectra-scheduler] Błąd zapisu logu:", e));

    const title = totalErrors === 0
      ? `Vectra: synchronizacja zakończona (${totalNew} nowych faktur)`
      : `Vectra: synchronizacja zakończona z błędami`;

    const messageParts: string[] = [];
    if (totalNew > 0) messageParts.push(`Pobrano ${totalNew} nowych faktur`);
    if (totalErrors > 0) messageParts.push(`Błędy (${totalErrors}): ${errorMessages.slice(0, 3).join("; ")}`);
    if (totalNew === 0 && totalErrors === 0) messageParts.push("Brak nowych faktur");

    await storage.createNotification({
      type: totalErrors > 0 ? "warning" : "info",
      title,
      message: messageParts.join(". "),
      entityType: "vectra_sync",
      entityId: null,
      isRead: false,
      dueDate: null,
      targetPanel: "main",
    });
  } catch (e: any) {
    console.error("[vectra-scheduler] Nieoczekiwany błąd:", e.message);
  }
}

export function startVectraScheduler(): void {
  if (schedulerInterval) return;

  console.log("[vectra-scheduler] Harmonogram uruchomiony (sprawdzanie co minutę)");

  schedulerInterval = setInterval(async () => {
    try {
      const config = await getVectraScheduleConfig();
      if (!config.enabled) return;

      const now = new Date();
      const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      if (currentHour === config.hour && currentMinute === 0 && lastRunDate !== todayKey) {
        lastRunDate = todayKey;
        await runVectraScheduledSync();
      }
    } catch (e: any) {
      console.error("[vectra-scheduler] Błąd sprawdzania harmonogramu:", e.message);
    }
  }, 60 * 1000);
}
