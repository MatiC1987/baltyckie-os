/**
 * Pure financial calculation functions, extracted from server/routes.ts for testability.
 * No I/O, no DB access — all inputs are plain numbers or strings.
 */

export type MonthlyForecastMap = Record<number, Record<number, number>>;

/**
 * Look up a forecast value for a given year/month, falling back up to 4 prior years
 * if no value exists for the requested year. Returns 0 if nothing found.
 *
 * Used in balance-forecast to fill gaps when forecast data is missing for a year.
 * Month index matches the map's convention (0-based for forecast maps, caller's responsibility).
 */
export function getForecastValue(
  map: MonthlyForecastMap,
  year: number,
  month: number
): number {
  for (let y = year; y >= year - 4; y--) {
    const v = map[y]?.[month];
    if (v !== undefined && v > 0) return v;
  }
  return 0;
}

/**
 * How much of the forecast is still expected to materialise this month.
 * Never negative — if actuals exceeded forecast, remaining is 0.
 */
export function computeRemaining(forecast: number, actual: number): number {
  return Math.max(0, forecast - actual);
}

export interface MonthBalanceParams {
  runningBalance: number;
  revenueRemaining: number;
  surcharges: number;
  aptCostRemaining: number;
  opCostRemaining: number;
  varCostRemaining: number;
}

/**
 * Core balance-forecast formula for a single month.
 * Result is rounded to 2 decimal places (grosze).
 *
 * Formula (from AUDIT_FINANCIAL.md — verified correct):
 *   endBalance = runningBalance + revenueRemaining + surcharges
 *                - aptCostRemaining - opCostRemaining - varCostRemaining
 */
export function computeMonthEndBalance(params: MonthBalanceParams): number {
  const {
    runningBalance,
    revenueRemaining,
    surcharges,
    aptCostRemaining,
    opCostRemaining,
    varCostRemaining,
  } = params;
  return (
    Math.round(
      (runningBalance +
        revenueRemaining +
        surcharges -
        aptCostRemaining -
        opCostRemaining -
        varCostRemaining) *
        100
    ) / 100
  );
}

/**
 * Whether a sublease is active as of a given date.
 *
 * Fixes AUDIT_FINANCIAL.md BUG #2 (SubrentSettlement.tsx:162):
 *   BEFORE: s.endDate >= today          — null >= "2026-..." === false in JS
 *           → indefinite subleases silently excluded from settlement view
 *   AFTER:  !endDate || endDate >= today — null means indefinite = always active
 *
 * @param endDate  ISO date string "YYYY-MM-DD" or null for indefinite subleases
 * @param today    ISO date string to compare against
 */
export function isSubleaseActive(endDate: string | null, today: string): boolean {
  return !endDate || endDate >= today;
}

/**
 * Resolve the effective end date for a sublease within a calculation period.
 *
 * Fixes AUDIT_FINANCIAL.md BUG #3 (routes.ts:~893, ~1027, ~1182, ~6673):
 *   Historical bug (already fixed prior to this extraction):
 *           s.endDate ? new Date(s.endDate) : new Date(null)
 *           → new Date(null) === new Date(0) === 1970-01-01
 *           → totalDays was negative → sublease contribution was 0
 *   Correct: s.endDate ? new Date(s.endDate) : periodEnd
 *           → indefinite subleases extend to the end of the period
 *
 * @param endDate   ISO date string or null (indefinite)
 * @param periodEnd fallback Date when endDate is null
 */
export function resolveSubleaseEnd(endDate: string | null, periodEnd: Date): Date {
  return endDate ? new Date(endDate) : periodEnd;
}

/**
 * Whether a contract should appear in an "expiring soon" list.
 *
 * Business rule (PROJECT_HANDOVER.md §4.6 + PR 1 fix):
 *   - null endDate means indefinite → never shown as expiring
 *   - endDate must fall within [today, windowEnd] inclusive
 *
 * @param endDate  ISO date string "YYYY-MM-DD" or null for indefinite contracts
 * @param today    ISO date string — lower bound (inclusive)
 * @param windowEnd ISO date string — upper bound (inclusive)
 */
export function isContractExpiring(
  endDate: string | null,
  today: string,
  windowEnd: string
): boolean {
  if (endDate === null) return false;
  return endDate >= today && endDate <= windowEnd;
}
