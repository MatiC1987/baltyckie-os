import { describe, it, expect } from "vitest";
import {
  getForecastValue,
  computeRemaining,
  computeMonthEndBalance,
  isContractExpiring,
  type MonthlyForecastMap,
} from "../shared/finance-calculations";

// ─── getForecastValue ──────────────────────────────────────────────────────────

describe("getForecastValue", () => {
  it("returns the value for the exact year/month when present", () => {
    const map: MonthlyForecastMap = { 2026: { 5: 12000 } };
    expect(getForecastValue(map, 2026, 5)).toBe(12000);
  });

  it("falls back to the previous year when current year is missing", () => {
    const map: MonthlyForecastMap = { 2025: { 5: 9500 } };
    expect(getForecastValue(map, 2026, 5)).toBe(9500);
  });

  it("falls back up to 4 years, picks the closest non-zero year", () => {
    const map: MonthlyForecastMap = {
      2023: { 3: 7000 },
      2024: { 3: 0 },   // zero — should be skipped
    };
    expect(getForecastValue(map, 2026, 3)).toBe(7000);
  });

  it("returns 0 when no value found within 4-year lookback", () => {
    const map: MonthlyForecastMap = { 2020: { 1: 5000 } };
    expect(getForecastValue(map, 2026, 1)).toBe(0);
  });

  it("returns 0 for an empty map", () => {
    expect(getForecastValue({}, 2026, 6)).toBe(0);
  });

  it("does not cross months — month 5 data does not satisfy month 6 query", () => {
    const map: MonthlyForecastMap = { 2026: { 5: 8000 } };
    expect(getForecastValue(map, 2026, 6)).toBe(0);
  });
});

// ─── computeRemaining ─────────────────────────────────────────────────────────

describe("computeRemaining", () => {
  it("returns forecast minus actual when forecast exceeds actual", () => {
    expect(computeRemaining(10000, 3000)).toBe(7000);
  });

  it("returns 0 when actual equals forecast (nothing remaining)", () => {
    expect(computeRemaining(5000, 5000)).toBe(0);
  });

  it("returns 0 when actual exceeds forecast (never negative)", () => {
    expect(computeRemaining(4000, 6000)).toBe(0);
  });

  it("handles zero forecast", () => {
    expect(computeRemaining(0, 0)).toBe(0);
    expect(computeRemaining(0, 500)).toBe(0);
  });
});

// ─── computeMonthEndBalance ───────────────────────────────────────────────────

describe("computeMonthEndBalance", () => {
  it("calculates endBalance correctly for a typical profitable month", () => {
    // runningBalance 50 000 + revenue 20 000 + surcharges 2 000
    // - aptCost 5 000 - opCost 3 000 - varCost 1 000 = 63 000
    const result = computeMonthEndBalance({
      runningBalance: 50000,
      revenueRemaining: 20000,
      surcharges: 2000,
      aptCostRemaining: 5000,
      opCostRemaining: 3000,
      varCostRemaining: 1000,
    });
    expect(result).toBe(63000);
  });

  it("produces a negative endBalance when costs exceed income (cash crunch)", () => {
    const result = computeMonthEndBalance({
      runningBalance: 1000,
      revenueRemaining: 0,
      surcharges: 0,
      aptCostRemaining: 8000,
      opCostRemaining: 2000,
      varCostRemaining: 500,
    });
    expect(result).toBe(-9500);
  });

  it("rounds to exactly 2 decimal places (grosze)", () => {
    const result = computeMonthEndBalance({
      runningBalance: 1000.005,
      revenueRemaining: 0.001,
      surcharges: 0,
      aptCostRemaining: 0,
      opCostRemaining: 0,
      varCostRemaining: 0,
    });
    // 1000.005 + 0.001 = 1000.006 → rounded to 2dp = 1000.01
    expect(result).toBe(1000.01);
  });

  it("running balance carries over correctly across two consecutive months", () => {
    const month1 = computeMonthEndBalance({
      runningBalance: 10000,
      revenueRemaining: 5000,
      surcharges: 0,
      aptCostRemaining: 2000,
      opCostRemaining: 1000,
      varCostRemaining: 0,
    });
    expect(month1).toBe(12000);

    // month2 starts with month1's endBalance as runningBalance
    const month2 = computeMonthEndBalance({
      runningBalance: month1,
      revenueRemaining: 3000,
      surcharges: 500,
      aptCostRemaining: 2000,
      opCostRemaining: 1000,
      varCostRemaining: 200,
    });
    expect(month2).toBe(12300);
  });

  it("zero inputs produce zero endBalance", () => {
    expect(
      computeMonthEndBalance({
        runningBalance: 0,
        revenueRemaining: 0,
        surcharges: 0,
        aptCostRemaining: 0,
        opCostRemaining: 0,
        varCostRemaining: 0,
      })
    ).toBe(0);
  });
});

// ─── isContractExpiring (F-04: null-safe endDate) ────────────────────────────

describe("isContractExpiring", () => {
  const TODAY = "2026-06-28";
  const WINDOW_30 = "2026-07-28";
  const WINDOW_90 = "2026-09-26";

  it("returns false for null endDate (indefinite contract — never expires)", () => {
    expect(isContractExpiring(null, TODAY, WINDOW_30)).toBe(false);
    expect(isContractExpiring(null, TODAY, WINDOW_90)).toBe(false);
  });

  it("returns true when endDate falls within the window (inclusive boundaries)", () => {
    expect(isContractExpiring("2026-07-15", TODAY, WINDOW_30)).toBe(true);
    expect(isContractExpiring(TODAY, TODAY, WINDOW_30)).toBe(true);       // today
    expect(isContractExpiring(WINDOW_30, TODAY, WINDOW_30)).toBe(true);   // last day of window
  });

  it("returns false when endDate is before today (already expired)", () => {
    expect(isContractExpiring("2026-06-01", TODAY, WINDOW_30)).toBe(false);
    expect(isContractExpiring("2025-12-31", TODAY, WINDOW_30)).toBe(false);
  });

  it("returns false when endDate is beyond the window", () => {
    expect(isContractExpiring("2026-09-01", TODAY, WINDOW_30)).toBe(false);
    expect(isContractExpiring("2027-01-01", TODAY, WINDOW_90)).toBe(false);
  });

  it("handles end-of-year boundary correctly", () => {
    expect(isContractExpiring("2026-12-31", "2026-10-01", "2026-12-31")).toBe(true);
    expect(isContractExpiring("2027-01-01", "2026-10-01", "2026-12-31")).toBe(false);
  });
});
