import { useState, useMemo, useCallback, Fragment } from "react";
import { useQuery, useQueries, useMutation } from "@tanstack/react-query";
import type { Location } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ChevronDown, ChevronRight, Copy, Sparkles, Thermometer, CalendarClock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CopyForecastDialog } from "@/components/v2/CopyForecastDialog";
import { AutoFillDialog } from "@/components/v2/AutoFillDialog";
import RevenueForecastSection, { type ForecastMonth } from "@/components/RevenueForecastSection";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function getGBCategory(name: string): number {
  const lower = name.toLowerCase();
  if (lower.includes("superior")) return 0;
  if (lower.includes("studio mini")) return 2;
  if (lower.includes("studio")) return 1;
  if (lower.includes("2os") || lower.includes("2-os") || lower.includes("2-osobowe")) return 3;
  return 99;
}

const GB_CATEGORY_LABELS: Record<number, string> = {
  0: "Superior",
  1: "Studio",
  2: "Studio Mini",
  3: "Apt. 2-osobowe",
};

function aggregateGBGroups(apartments: AptRevenueData[]): AptRevenueData[] {
  const groups: Record<number, AptRevenueData[]> = {};
  for (const apt of apartments) {
    const cat = getGBCategory(apt.apartmentName);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(apt);
  }

  const result: AptRevenueData[] = [];
  for (const cat of [0, 1, 2, 3]) {
    const items = groups[cat];
    if (!items || items.length === 0) continue;
    const months: Record<number, { forecast: number; actual: number; najem: number; podnajem: number }> = {};
    for (let m = 0; m < 12; m++) {
      months[m] = { forecast: 0, actual: 0, najem: 0, podnajem: 0 };
      for (const apt of items) {
        const md = apt.months[m];
        if (md) {
          months[m].forecast += md.forecast;
          months[m].actual += md.actual;
          months[m].najem += md.najem;
          months[m].podnajem += md.podnajem;
        }
      }
    }
    const label = GB_CATEGORY_LABELS[cat] || `Kategoria ${cat}`;
    result.push({
      apartmentId: -(cat + 1),
      apartmentName: `${label} (${items.length} apt.)`,
      locationId: items[0].locationId,
      months,
      constituentIds: items.map(a => a.apartmentId),
    });
  }

  const uncategorized = groups[99];
  if (uncategorized) {
    for (const apt of uncategorized) {
      result.push(apt);
    }
  }

  return result;
}

type AptRevenueData = {
  apartmentId: number;
  apartmentName: string;
  locationId: number | null;
  months: Record<number, { forecast: number; actual: number; najem: number; podnajem: number }>;
  constituentIds?: number[];
};

type RevenueSummaryResponse = {
  year: number;
  locations: Location[];
  apartments: AptRevenueData[];
  climateFee?: Record<number, { forecast: number; actual: number }>;
};

function formatNum(v: number): string {
  if (v === 0) return "—";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function deviationColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function deviationBgColor(v: number): string {
  if (v > 0) return "bg-emerald-500";
  if (v < 0) return "bg-red-500";
  return "bg-muted";
}

function pctStr(actual: number, forecast: number): string {
  if (forecast === 0) return "—";
  const pct = ((actual - forecast) / forecast) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

function pctVal(actual: number, forecast: number): number {
  if (forecast === 0) return 0;
  return (actual / forecast) * 100;
}

function MiniProgress({ value, colorClass }: { value: number; colorClass: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className={`h-full rounded-full transition-all ${colorClass}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
  );
}

function revenuePctColor(pct: number) {
  if (pct <= 0) return { text: "text-muted-foreground", bar: "bg-muted" };
  if (pct >= 100) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500" };
  if (pct >= 75) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500" };
  return { text: "text-orange-600 dark:text-orange-400", bar: "bg-orange-500" };
}

function RevenueTile({ title, forecast, actual, onClick, testId, variant = "default", isExpanded = false }: {
  title: string;
  forecast: number;
  actual: number;
  onClick?: () => void;
  testId?: string;
  variant?: "default" | "summary" | "grand";
  isExpanded?: boolean;
}) {
  const pct = forecast > 0 ? (actual / forecast) * 100 : 0;
  const saldo = actual - forecast;
  const color = revenuePctColor(pct);

  const isGrand = variant === "grand";
  const isSummary = variant === "summary";

  return (
    <Card
      className={`${onClick ? "cursor-pointer hover:shadow-md hover:border-primary/30 transition-all" : ""} ${isGrand ? "border-primary/30 bg-primary/5" : isSummary ? "bg-muted/30 border-dashed" : ""} ${isExpanded ? "border-primary/50 shadow-md ring-1 ring-primary/20" : ""}`}
      onClick={onClick}
      data-testid={testId}
    >
      <CardContent className="pt-4 pb-3 px-4">
        <p className={`${isGrand ? "text-sm font-bold" : isSummary ? "text-xs font-semibold text-muted-foreground" : "text-xs text-muted-foreground"}`}>{title}</p>
        <p className={`${isGrand ? "text-2xl" : "text-lg sm:text-xl"} font-bold mt-1 tabular-nums`}>{formatNum(forecast)} PLN</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Realizacja: <span className="font-medium text-foreground">{formatNum(actual)} PLN</span>
        </p>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 bg-muted rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${color.bar}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
          <span className={`text-xs font-semibold tabular-nums ${color.text}`}>
            {forecast > 0 ? `${pct.toFixed(0)}%` : "—"}
          </span>
        </div>
        <p className={`text-xs mt-1 tabular-nums ${saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
          Saldo: {saldo >= 0 ? "+" : ""}{formatNum(saldo)} PLN
        </p>
      </CardContent>
    </Card>
  );
}

type ApartmentTrendData = {
  apartment: { id: number; name: string; location: string | null };
  years: number[];
  yearlyData: Record<number, {
    months: Record<number, { actual: number; forecast: number; cost: number }>;
    totalActual: number;
    totalForecast: number;
    totalCost: number;
  }>;
};

function rowBgClass(actual: number, forecast: number): string {
  if (forecast === 0 && actual === 0) return "";
  if (actual >= forecast) return "bg-emerald-50/40 dark:bg-emerald-950/10";
  return "bg-red-50/40 dark:bg-red-950/10";
}

function progressColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 75) return "bg-amber-500";
  return "bg-orange-500";
}

function ExpandedRevenueTile({ apt, currentMonth, year, onCollapse, onYearChange, availableYears }: {
  apt: AptRevenueData;
  currentMonth: number;
  year: number;
  onCollapse: () => void;
  onYearChange?: (y: number) => void;
  availableYears?: number[];
}) {
  const [showR1, setShowR1] = useState(false);
  const isGrouped = apt.apartmentId < 0;
  const constituentIds = apt.constituentIds || [];

  const { data: trendData, isLoading: singleTrendLoading } = useQuery<ApartmentTrendData>({
    queryKey: [`/api/v2/apartment-trend/${apt.apartmentId}`],
    enabled: showR1 && !isGrouped,
  });

  const constituentTrends = useQueries({
    queries: constituentIds.map(id => ({
      queryKey: [`/api/v2/apartment-trend/${id}`],
      enabled: showR1 && isGrouped,
    })),
  });

  const groupedTrendLoading = isGrouped && constituentTrends.some(q => q.isLoading);
  const trendLoading = isGrouped ? groupedTrendLoading : singleTrendLoading;

  const prevYear = year - 1;

  const prevYearMonths = useMemo(() => {
    if (!isGrouped) {
      return trendData?.yearlyData[prevYear]?.months || null;
    }
    const allLoaded = constituentTrends.every(q => q.data);
    if (!allLoaded) return null;
    const aggregated: Record<number, { actual: number; forecast: number; cost: number }> = {};
    for (let m = 0; m < 12; m++) {
      aggregated[m] = { actual: 0, forecast: 0, cost: 0 };
      for (const q of constituentTrends) {
        const td = q.data as ApartmentTrendData | undefined;
        const md = td?.yearlyData[prevYear]?.months?.[m];
        if (md) {
          aggregated[m].actual += md.actual;
          aggregated[m].forecast += md.forecast;
          aggregated[m].cost += md.cost;
        }
      }
    }
    return aggregated;
  }, [isGrouped, trendData, constituentTrends, prevYear]);

  const yearTotals = useMemo(() => {
    let fc = 0, act = 0, naj = 0, pod = 0;
    for (let m = 0; m < 12; m++) {
      fc += apt.months[m]?.forecast || 0;
      act += apt.months[m]?.actual || 0;
      naj += apt.months[m]?.najem || 0;
      pod += apt.months[m]?.podnajem || 0;
    }
    return { forecast: fc, actual: act, najem: naj, podnajem: pod };
  }, [apt.months]);

  const prevYearTotal = useMemo(() => {
    if (!prevYearMonths) return 0;
    let total = 0;
    for (let m = 0; m < 12; m++) {
      total += prevYearMonths[m]?.actual || 0;
    }
    return total;
  }, [prevYearMonths]);

  const najPct = yearTotals.actual > 0 ? Math.round((yearTotals.najem / yearTotals.actual) * 100) : 0;
  const podPct = yearTotals.actual > 0 ? 100 - najPct : 0;

  const chartData = useMemo(() => {
    return MONTHS.map((label, mi) => {
      const md = apt.months[mi] || { forecast: 0, actual: 0 };
      return { month: label, prognoza: md.forecast, rzeczywiste: md.actual };
    });
  }, [apt.months]);

  const saldoYear = yearTotals.actual - yearTotals.forecast;

  return (
    <div
      className="col-span-full animate-in fade-in slide-in-from-top-2 duration-200"
      data-testid={`expanded-tile-${apt.apartmentId}`}
    >
      <Card className="border-primary/20 shadow-lg bg-gradient-to-b from-card to-card/95 overflow-hidden">
        <CardContent className="pt-5 pb-4 px-5">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
            <div
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={onCollapse}
              data-testid={`collapse-expanded-${apt.apartmentId}`}
            >
              <p className="text-base font-bold tracking-tight">{apt.apartmentName}</p>
              <div className="flex items-baseline gap-3 mt-1">
                <p className="text-2xl font-extrabold tabular-nums tracking-tight">{formatNum(yearTotals.actual)} <span className="text-sm font-semibold text-muted-foreground">PLN</span></p>
                <span className={`text-sm font-bold tabular-nums ${saldoYear >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {saldoYear >= 0 ? "+" : ""}{formatNum(saldoYear)}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground font-medium">Najem {najPct}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                  <span className="text-muted-foreground font-medium">Podnajem {podPct}%</span>
                </div>
                {yearTotals.actual > 0 && (
                  <div className="flex h-2.5 w-28 rounded-full overflow-hidden bg-muted/60">
                    <div className="bg-blue-500 transition-all" style={{ width: `${najPct}%` }} />
                    <div className="bg-violet-500 transition-all" style={{ width: `${podPct}%` }} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {onYearChange && availableYears && (
                <Select value={String(year)} onValueChange={v => onYearChange(Number(v))}>
                  <SelectTrigger className="h-7 w-[80px] text-xs" data-testid={`year-select-${apt.apartmentId}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" data-testid={`toggle-r1-${apt.apartmentId}`}>
                <CalendarClock className="h-3.5 w-3.5" />
                <span>R-1</span>
                <Switch checked={showR1} onCheckedChange={setShowR1} className="scale-75" />
              </label>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-border/40 bg-muted/10 p-3" data-testid={`expanded-chart-${apt.apartmentId}`}>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} width={45} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                  formatter={(value: number, name: string) => [formatNum(value) + " PLN", name]}
                  labelFormatter={(label: string) => label}
                />
                <Bar dataKey="prognoza" name="Prognoza" fill="hsl(var(--muted-foreground))" opacity={0.35} radius={[3, 3, 0, 0]} barSize={18} />
                <Bar dataKey="rzeczywiste" name="Rzeczywiste" fill="hsl(217, 91%, 60%)" radius={[3, 3, 0, 0]} barSize={18} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs border-collapse" style={{ tableLayout: "fixed" }} data-testid={`expanded-table-${apt.apartmentId}`}>
              <colgroup>
                <col style={{ width: "40px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "80px" }} />
                <col style={{ width: "85px" }} />
                <col style={{ width: "75px" }} />
                <col style={{ width: "75px" }} />
                <col style={{ width: "30px" }} />
                {showR1 && <col style={{ width: "75px" }} />}
                {showR1 && <col style={{ width: "55px" }} />}
              </colgroup>
              <thead>
                <tr className="border-b-2 border-border/60">
                  <th className="text-left py-2 px-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Mies.</th>
                  <th className="text-right py-2 px-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Prognoza</th>
                  <th className="text-right py-2 px-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Rzeczywiste</th>
                  <th className="text-right py-2 px-1.5 font-bold text-foreground uppercase tracking-wider text-[10px] border-l-2 border-r-2 border-border/40 bg-muted/20">Saldo</th>
                  <th className="text-right py-2 px-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Najem</th>
                  <th className="text-right py-2 px-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Podn.</th>
                  <th className="py-2 px-1.5"></th>
                  {showR1 && <th className="text-right py-2 px-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">R-1</th>}
                  {showR1 && <th className="text-right py-2 px-1.5 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Δ r/r</th>}
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((monthLabel, mi) => {
                  const md = apt.months[mi] || { forecast: 0, actual: 0, najem: 0, podnajem: 0 };
                  const saldo = md.actual - md.forecast;
                  const pct = md.forecast > 0 ? (md.actual / md.forecast) * 100 : 0;
                  const isCurrentMonth = year === new Date().getFullYear() && mi === currentMonth;
                  const prevActual = prevYearMonths?.[mi]?.actual || 0;
                  const yoyPct = prevActual > 0 ? ((md.actual - prevActual) / prevActual) * 100 : 0;

                  return (
                    <tr
                      key={mi}
                      className={`border-b border-border/30 transition-colors ${rowBgClass(md.actual, md.forecast)} ${isCurrentMonth ? "ring-1 ring-inset ring-cyan-400/50" : ""}`}
                      data-testid={`expanded-row-${apt.apartmentId}-${mi}`}
                    >
                      <td className={`py-1.5 px-1.5 font-semibold text-[11px] ${isCurrentMonth ? "text-cyan-700 dark:text-cyan-300" : ""}`}>{monthLabel}</td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums">{formatNum(md.forecast)}</td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums font-semibold">{formatNum(md.actual)}</td>
                      <td className={`py-1.5 px-1.5 text-right tabular-nums font-bold border-l-2 border-r-2 border-border/40 bg-muted/10 ${deviationColor(saldo)}`}>
                        {md.forecast === 0 && md.actual === 0 ? "—" : `${saldo >= 0 ? "+" : ""}${formatNum(saldo)}`}
                      </td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums text-blue-600 dark:text-blue-400">{formatNum(md.najem)}</td>
                      <td className="py-1.5 px-1.5 text-right tabular-nums text-violet-600 dark:text-violet-400">{formatNum(md.podnajem)}</td>
                      <td className="py-1.5 px-1.5">
                        {md.forecast > 0 && (
                          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full ${progressColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        )}
                      </td>
                      {showR1 && (
                        <td className="py-1.5 px-1.5 text-right tabular-nums text-muted-foreground">
                          {trendLoading ? "…" : formatNum(prevActual)}
                        </td>
                      )}
                      {showR1 && (
                        <td className={`py-1.5 px-1.5 text-right tabular-nums text-[10px] ${prevActual > 0 ? deviationColor(md.actual - prevActual) : "text-muted-foreground"}`}>
                          {trendLoading ? "…" : prevActual > 0 ? `${yoyPct >= 0 ? "+" : ""}${yoyPct.toFixed(0)}%` : "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold bg-muted/20">
                  <td className="py-2 px-1.5 text-[11px]">ROCZNIE</td>
                  <td className="py-2 px-1.5 text-right tabular-nums">{formatNum(yearTotals.forecast)}</td>
                  <td className="py-2 px-1.5 text-right tabular-nums">{formatNum(yearTotals.actual)}</td>
                  <td className={`py-2 px-1.5 text-right tabular-nums font-extrabold border-l-2 border-r-2 border-border/40 bg-muted/30 ${deviationColor(saldoYear)}`}>
                    {saldoYear >= 0 ? "+" : ""}{formatNum(saldoYear)}
                  </td>
                  <td className="py-2 px-1.5 text-right tabular-nums text-blue-600 dark:text-blue-400">{formatNum(yearTotals.najem)}</td>
                  <td className="py-2 px-1.5 text-right tabular-nums text-violet-600 dark:text-violet-400">{formatNum(yearTotals.podnajem)}</td>
                  <td className="py-2 px-1.5">
                    {yearTotals.forecast > 0 && (
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${progressColor(pctVal(yearTotals.actual, yearTotals.forecast))}`} style={{ width: `${Math.min(pctVal(yearTotals.actual, yearTotals.forecast), 100)}%` }} />
                      </div>
                    )}
                  </td>
                  {showR1 && (
                    <td className="py-2 px-1.5 text-right tabular-nums text-muted-foreground">
                      {trendLoading ? "…" : formatNum(prevYearTotal)}
                    </td>
                  )}
                  {showR1 && (
                    <td className={`py-2 px-1.5 text-right tabular-nums text-[10px] ${prevYearTotal > 0 ? deviationColor(yearTotals.actual - prevYearTotal) : "text-muted-foreground"}`}>
                      {trendLoading ? "…" : prevYearTotal > 0 ? `${((yearTotals.actual - prevYearTotal) / prevYearTotal * 100) >= 0 ? "+" : ""}${((yearTotals.actual - prevYearTotal) / prevYearTotal * 100).toFixed(0)}%` : "—"}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LocationSummaryBar({ locationName, forecast, actual }: {
  locationName: string;
  forecast: number;
  actual: number;
}) {
  const saldo = actual - forecast;
  const pct = forecast > 0 ? (actual / forecast) * 100 : 0;
  const color = revenuePctColor(pct);

  return (
    <div
      className="mt-3 mx-1 rounded-lg border border-border/50 bg-muted/15 px-4 py-2.5 flex items-center gap-4 flex-wrap"
      data-testid={`location-summary-${locationName}`}
    >
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Razem {locationName}</span>
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Prognoza:</span>
          <span className="font-bold tabular-nums">{formatNum(forecast)} PLN</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Realizacja:</span>
          <span className="font-bold tabular-nums">{formatNum(actual)} PLN</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-muted-foreground">Saldo:</span>
          <span className={`font-bold tabular-nums ${deviationColor(saldo)}`}>
            {saldo >= 0 ? "+" : ""}{formatNum(saldo)} PLN
          </span>
          {forecast > 0 && (
            <span className={`text-[10px] tabular-nums ${deviationColor(saldo)}`}>
              ({pctStr(actual, forecast)})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${color.bar}`} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className={`text-xs font-bold tabular-nums ${color.text}`}>
            {forecast > 0 ? `${pct.toFixed(0)}%` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function LocationGroup({ locationName, apartments, expandedAptId, onApartmentClick, year, onYearChange, availableYears }: {
  locationName: string;
  apartments: AptRevenueData[];
  expandedAptId: number | null;
  onApartmentClick?: (id: number) => void;
  year: number;
  onYearChange?: (y: number) => void;
  availableYears?: number[];
}) {
  const [open, setOpen] = useState(true);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const sortedApts = useMemo(() => {
    if (locationName === "GRAND BALTIC") {
      return aggregateGBGroups(apartments);
    }
    return apartments;
  }, [apartments, locationName]);

  const yearTotals = useMemo(() => {
    let fc = 0, act = 0;
    for (const apt of apartments) {
      for (let m = 0; m < 12; m++) {
        fc += apt.months[m]?.forecast || 0;
        act += apt.months[m]?.actual || 0;
      }
    }
    return { forecast: fc, actual: act };
  }, [apartments]);

  return (
    <div className="mb-4" data-testid={`location-group-${locationName}`}>
      <button
        className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-md hover:bg-muted/50 transition-colors font-semibold text-sm"
        onClick={() => setOpen(!open)}
        data-testid={`toggle-location-${locationName}`}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span>{locationName}</span>
        <Badge variant="secondary" className="ml-2">{apartments.length}</Badge>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          Plan: {formatNum(yearTotals.forecast)} PLN | Realizacja: {formatNum(yearTotals.actual)} PLN
        </span>
      </button>

      {open && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-2 px-1" data-testid={`revenue-tiles-${locationName}`}>
            {sortedApts.map(apt => {
              const yearFc = Object.values(apt.months).reduce((s, m) => s + m.forecast, 0);
              const yearAct = Object.values(apt.months).reduce((s, m) => s + m.actual, 0);
              const isExpanded = expandedAptId === apt.apartmentId;
              return (
                <Fragment key={apt.apartmentId}>
                  <RevenueTile
                    title={apt.apartmentName}
                    forecast={yearFc}
                    actual={yearAct}
                    onClick={() => onApartmentClick?.(apt.apartmentId)}
                    testId={`revenue-tile-${apt.apartmentId}`}
                    isExpanded={isExpanded}
                  />
                  {isExpanded && (
                    <ExpandedRevenueTile
                      apt={apt}
                      currentMonth={year === currentYear ? currentMonth : -1}
                      year={year}
                      onCollapse={() => onApartmentClick?.(apt.apartmentId)}
                      onYearChange={onYearChange}
                      availableYears={availableYears}
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
          <LocationSummaryBar
            locationName={locationName}
            forecast={yearTotals.forecast}
            actual={yearTotals.actual}
          />
        </>
      )}
    </div>
  );
}

function ClimateFeeTable({ climateFee, currentMonth, year }: { climateFee?: Record<number, { forecast: number; actual: number }>; currentMonth: number; year: number }) {
  const { toast } = useToast();
  const [editingCell, setEditingCell] = useState<{ month: number; field: "forecast" | "actual" } | null>(null);
  const [editValue, setEditValue] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: { year: number; month: number; climateFeeForecast?: number; climateFeeActual?: number }) => {
      const res = await apiRequest("PUT", "/api/revenue-forecasts/climate-fee", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/v2/revenue-summary?year=${year}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/dashboard/revenue-forecast?year=${year}`] });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const startEdit = useCallback((month: number, field: "forecast" | "actual") => {
    const val = climateFee?.[month]?.[field] || 0;
    setEditValue(val === 0 ? "" : String(val));
    setEditingCell({ month, field });
  }, [climateFee]);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const numVal = parseFloat(editValue) || 0;
    const currentVal = climateFee?.[editingCell.month]?.[editingCell.field] || 0;
    if (numVal !== currentVal) {
      const payload: any = { year, month: editingCell.month };
      if (editingCell.field === "forecast") payload.climateFeeForecast = numVal;
      else payload.climateFeeActual = numVal;
      mutation.mutate(payload);
    }
    setEditingCell(null);
  }, [editingCell, editValue, climateFee, year, mutation]);

  const yearFc = Object.values(climateFee || {}).reduce((s, v) => s + (v.forecast || 0), 0);
  const yearAct = Object.values(climateFee || {}).reduce((s, v) => s + (v.actual || 0), 0);

  return (
    <div data-testid="climate-fee-section">
      <div className="flex items-center gap-2 py-2 px-3 font-semibold text-sm mb-1">
        <Thermometer className="h-4 w-4 text-orange-500" />
        <span>Opłata klimatyczna</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          Plan: {formatNum(yearFc)} PLN | Realizacja: {formatNum(yearAct)} PLN
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] sm:text-xs border-collapse" data-testid="climate-fee-table">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="sticky left-0 z-20 bg-muted/30 text-left p-1.5 sm:p-2 min-w-[120px] sm:min-w-[160px] font-medium"></th>
              <th className="text-left p-1.5 sm:p-2 min-w-[45px] sm:min-w-[60px] font-medium">Wiersz</th>
              {MONTHS.map((m, i) => (
                <th key={i} className={`text-right p-1.5 sm:p-2 min-w-[60px] sm:min-w-[80px] font-medium ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                  {m}
                </th>
              ))}
              <th className="text-right p-1.5 sm:p-2 min-w-[70px] sm:min-w-[90px] font-bold">Razem</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b bg-orange-50/30 dark:bg-orange-950/10">
              <td className="sticky left-0 z-10 bg-orange-50/30 dark:bg-orange-950/10 p-1.5 sm:p-2 font-medium">Opłata klim.</td>
              <td className="p-1.5 sm:p-2 text-muted-foreground text-xs">Plan</td>
              {MONTHS.map((_, i) => {
                const val = climateFee?.[i]?.forecast || 0;
                const isEditing = editingCell?.month === i && editingCell?.field === "forecast";
                return (
                  <td key={i} className={`p-1 text-right ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`} data-testid={`climate-fee-forecast-${i}`}>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
                        className="h-6 text-[10px] sm:text-xs text-right w-16 sm:w-20 ml-auto p-1"
                        autoFocus
                        data-testid={`input-climate-forecast-${i}`}
                      />
                    ) : (
                      <button
                        className="w-full text-right tabular-nums hover:bg-muted/50 rounded px-1 py-0.5 transition-colors cursor-text"
                        onClick={() => startEdit(i, "forecast")}
                        data-testid={`btn-edit-climate-forecast-${i}`}
                      >
                        {formatNum(val)}
                      </button>
                    )}
                  </td>
                );
              })}
              <td className="p-1.5 sm:p-2 text-right tabular-nums font-medium">{formatNum(yearFc)} PLN</td>
            </tr>
            <tr className="bg-orange-50/30 dark:bg-orange-950/10">
              <td className="sticky left-0 z-10 bg-orange-50/30 dark:bg-orange-950/10 p-1.5 sm:p-2"></td>
              <td className="p-1.5 sm:p-2 text-muted-foreground text-xs">Rzecz.</td>
              {MONTHS.map((_, i) => {
                const val = climateFee?.[i]?.actual || 0;
                const isEditing = editingCell?.month === i && editingCell?.field === "actual";
                return (
                  <td key={i} className={`p-1 text-right ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`} data-testid={`climate-fee-actual-${i}`}>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingCell(null); }}
                        className="h-6 text-[10px] sm:text-xs text-right w-16 sm:w-20 ml-auto p-1"
                        autoFocus
                        data-testid={`input-climate-actual-${i}`}
                      />
                    ) : (
                      <button
                        className="w-full text-right tabular-nums hover:bg-muted/50 rounded px-1 py-0.5 transition-colors cursor-text"
                        onClick={() => startEdit(i, "actual")}
                        data-testid={`btn-edit-climate-actual-${i}`}
                      >
                        {formatNum(val)}
                      </button>
                    )}
                  </td>
                );
              })}
              <td className="p-1.5 sm:p-2 text-right tabular-nums font-medium">{formatNum(yearAct)} PLN</td>
            </tr>
            <tr className="border-t bg-orange-50/30 dark:bg-orange-950/10">
              <td className="sticky left-0 z-10 bg-orange-50/30 dark:bg-orange-950/10 p-1.5 sm:p-2"></td>
              <td className="p-1.5 sm:p-2 text-muted-foreground text-xs">Odch.</td>
              {MONTHS.map((_, i) => {
                const fc = climateFee?.[i]?.forecast || 0;
                const act = climateFee?.[i]?.actual || 0;
                const dev = act - fc;
                return (
                  <td key={i} className={`p-1.5 sm:p-2 text-right ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {fc === 0 && act === 0 ? "—" : (
                      <span className={`tabular-nums text-[10px] ${deviationColor(dev)}`}>
                        {dev >= 0 ? "+" : ""}{formatNum(dev)}
                      </span>
                    )}
                  </td>
                );
              })}
              <td className="p-1.5 sm:p-2 text-right">
                {yearFc === 0 && yearAct === 0 ? "—" : (
                  <span className={`tabular-nums text-[10px] font-semibold ${deviationColor(yearAct - yearFc)}`}>
                    {yearAct - yearFc >= 0 ? "+" : ""}{formatNum(yearAct - yearFc)} PLN
                  </span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GrandTotalTile({ apartments, climateFee }: { apartments: AptRevenueData[]; climateFee?: Record<number, { forecast: number; actual: number }> }) {
  const yearTotals = useMemo(() => {
    let fc = 0, act = 0;
    for (const apt of apartments) {
      for (let m = 0; m < 12; m++) {
        fc += apt.months[m]?.forecast || 0;
        act += apt.months[m]?.actual || 0;
      }
    }
    for (let m = 0; m < 12; m++) {
      fc += climateFee?.[m]?.forecast || 0;
      act += climateFee?.[m]?.actual || 0;
    }
    return { forecast: fc, actual: act };
  }, [apartments, climateFee]);

  return (
    <div data-testid="grand-total-section">
      <div className="max-w-md mx-auto">
        <RevenueTile
          title="RAZEM WSZYSTKIE"
          forecast={yearTotals.forecast}
          actual={yearTotals.actual}
          variant="grand"
          testId="revenue-tile-grand-total"
        />
      </div>
    </div>
  );
}

export function V2Przychody() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [expandedAptId, setExpandedAptId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<RevenueSummaryResponse>({
    queryKey: [`/api/v2/revenue-summary?year=${year}`],
  });

  const { data: forecastData } = useQuery<ForecastMonth[]>({
    queryKey: [`/api/dashboard/revenue-forecast?year=${year}`],
  });

  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear - 4; y <= currentYear + 5; y++) arr.push(y);
    return arr;
  }, [currentYear]);

  const locations = data?.locations || [];
  const apartments = data?.apartments || [];

  const grouped = useMemo(() => {
    const locMap = new Map<string, AptRevenueData[]>();
    const filtered = locationFilter === "all" ? apartments : apartments.filter(a => String(a.locationId) === locationFilter);
    for (const apt of filtered) {
      const loc = locations.find(l => l.id === apt.locationId);
      const locName = loc?.name || "Bez lokalizacji";
      if (!locMap.has(locName)) locMap.set(locName, []);
      locMap.get(locName)!.push(apt);
    }
    return locMap;
  }, [apartments, locations, locationFilter]);

  const climateFee = data?.climateFee;

  const chartData = useMemo(() => {
    return MONTHS.map((m, i) => {
      let totalFc = 0, totalAct = 0;
      for (const apt of apartments) {
        totalFc += apt.months[i]?.forecast || 0;
        totalAct += apt.months[i]?.actual || 0;
      }
      totalFc += climateFee?.[i]?.forecast || 0;
      totalAct += climateFee?.[i]?.actual || 0;
      return { month: m, "Prognoza": totalFc, "Realizacja": totalAct };
    });
  }, [apartments, climateFee]);

  const yearTotals = useMemo(() => {
    let fc = 0, act = 0;
    for (const apt of apartments) {
      for (let m = 0; m < 12; m++) {
        fc += apt.months[m]?.forecast || 0;
        act += apt.months[m]?.actual || 0;
      }
    }
    for (let m = 0; m < 12; m++) {
      fc += climateFee?.[m]?.forecast || 0;
      act += climateFee?.[m]?.actual || 0;
    }
    return { forecast: fc, actual: act };
  }, [apartments, climateFee]);

  const currentMonthByLocation = useMemo(() => {
    const m = year === currentYear ? currentMonth : -1;
    if (m < 0) return [];
    const result: { name: string; forecast: number; actual: number; pct: number }[] = [];
    for (const loc of locations) {
      const locApts = apartments.filter(a => a.locationId === loc.id);
      let fc = 0, act = 0;
      for (const apt of locApts) {
        fc += apt.months[m]?.forecast || 0;
        act += apt.months[m]?.actual || 0;
      }
      result.push({ name: loc.name, forecast: fc, actual: act, pct: fc > 0 ? (act / fc) * 100 : 0 });
    }
    return result;
  }, [apartments, locations, currentMonth, currentYear, year]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="v2-przychody-page">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-location-filter">
            <SelectValue placeholder="Lokalizacja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {locations.map(l => (
              <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-[100px]" data-testid="select-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setShowAutoFill(true)} data-testid="button-auto-fill">
          <Sparkles className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Auto-uzup.</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowCopyDialog(true)} data-testid="button-copy-forecasts">
          <Copy className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Kopiuj</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-gradient from-emerald-500/10" data-testid="kpi-forecast">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Prognoza roczna</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{formatNum(yearTotals.forecast)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-blue-500/10" data-testid="kpi-actual">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Realizacja</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{formatNum(yearTotals.actual)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-orange-500/10" data-testid="kpi-deviation">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Odchylenie</p>
            <p className={`text-xl font-bold mt-1 tabular-nums ${deviationColor(yearTotals.actual - yearTotals.forecast)}`}>
              {yearTotals.actual - yearTotals.forecast >= 0 ? "+" : ""}{formatNum(yearTotals.actual - yearTotals.forecast)} PLN
            </p>
            {yearTotals.forecast > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">{pctStr(yearTotals.actual, yearTotals.forecast)}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {currentMonthByLocation.length > 0 && (
        <Card data-testid="current-month-summary">
          <CardContent className="pt-4 pb-3">
            <h3 className="text-sm font-semibold mb-3">
              {MONTHS[currentMonth]} {year} — zestawienie per lokalizacja
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {currentMonthByLocation.map(loc => {
                const dev = loc.actual - loc.forecast;
                return (
                  <div key={loc.name} className="rounded-lg border p-3 space-y-2" data-testid={`month-loc-${loc.name}`}>
                    <p className="text-xs font-semibold truncate">{loc.name}</p>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Plan</span>
                      <span className="tabular-nums font-medium">{formatNum(loc.forecast)} PLN</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Realizacja</span>
                      <span className="tabular-nums font-medium">{formatNum(loc.actual)} PLN</span>
                    </div>
                    <MiniProgress value={loc.pct} colorClass={deviationBgColor(dev)} />
                    <div className="flex justify-between text-[10px]">
                      <span className={`tabular-nums font-semibold ${deviationColor(dev)}`}>
                        {dev >= 0 ? "+" : ""}{formatNum(dev)} PLN
                      </span>
                      <span className="tabular-nums text-muted-foreground">{loc.pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {forecastData && forecastData.length > 0 && (
        <Card data-testid="revenue-forecast-section">
          <CardContent className="pt-4">
            <RevenueForecastSection forecastData={forecastData} />
          </CardContent>
        </Card>
      )}

      <Card data-testid="revenue-chart">
        <CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `${formatNum(v)} PLN`} />
              <Legend />
              <Bar dataKey="Prognoza" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Realizacja" fill="#00CCFF" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {Array.from(grouped.entries()).map(([locName, apts]) => (
        <Card key={locName}>
          <CardContent className="pt-4">
            <LocationGroup
              locationName={locName}
              apartments={apts}
              expandedAptId={expandedAptId}
              onApartmentClick={(id) => setExpandedAptId(prev => prev === id ? null : id)}
              year={year}
              onYearChange={setYear}
              availableYears={years}
            />
          </CardContent>
        </Card>
      ))}

      <Card data-testid="climate-fee-card">
        <CardContent className="pt-4">
          <ClimateFeeTable climateFee={data?.climateFee} currentMonth={year === currentYear ? currentMonth : -1} year={year} />
        </CardContent>
      </Card>

      {grouped.size > 1 && (
        <Card data-testid="revenue-grand-total">
          <CardContent className="pt-4">
            <GrandTotalTile apartments={apartments} climateFee={data?.climateFee} />
          </CardContent>
        </Card>
      )}

      <CopyForecastDialog open={showCopyDialog} onOpenChange={setShowCopyDialog} currentYear={year} defaultTypes={["revenue"]} />
      <AutoFillDialog open={showAutoFill} onOpenChange={setShowAutoFill} currentYear={year} />
    </div>
  );
}

export default V2Przychody;
