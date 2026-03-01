import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Location } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronRight, Copy, Sparkles, BarChart3 } from "lucide-react";
import { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CopyForecastDialog } from "@/components/v2/CopyForecastDialog";
import { AutoFillDialog } from "@/components/v2/AutoFillDialog";
import { ApartmentTrendSheet } from "@/components/v2/ApartmentTrendSheet";
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

type AptRevenueData = {
  apartmentId: number;
  apartmentName: string;
  locationId: number | null;
  months: Record<number, { forecast: number; actual: number; najem: number; podnajem: number }>;
};

type RevenueSummaryResponse = {
  year: number;
  locations: Location[];
  apartments: AptRevenueData[];
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

type ApartmentTrendData = {
  apartment: { id: number; name: string };
  years: number[];
  yearlyData: Record<number, { months: Record<number, { actual: number; forecast: number }>; totalActual: number; totalForecast: number }>;
};

function ApartmentYearComparison({ apartmentId, isOpen, colSpan }: { apartmentId: number; isOpen: boolean; colSpan: number }) {
  const currentYear = new Date().getFullYear();
  const { data, isLoading } = useQuery<ApartmentTrendData>({
    queryKey: [`/api/v2/apartment-trend/${apartmentId}`],
    enabled: isOpen,
  });

  if (!isOpen) return null;

  return (
    <tr data-testid={`apt-year-comparison-${apartmentId}`}>
      <td colSpan={colSpan} className="p-0 bg-muted/5">
        <div className="px-4 py-3">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-1.5 font-medium min-w-[70px]">Miesiąc</th>
                    {data.years.map(y => (
                      <th key={y} className={`text-right p-1.5 font-medium min-w-[70px] ${y === currentYear ? "text-cyan-600 dark:text-cyan-400 font-bold" : ""}`}>{y}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MONTHS.map((m, mi) => (
                    <tr key={mi} className="border-b hover:bg-muted/20">
                      <td className="p-1.5 font-medium text-muted-foreground">{m}</td>
                      {data.years.map(y => {
                        const val = data.yearlyData[y]?.months[mi]?.actual || 0;
                        const fc = data.yearlyData[y]?.months[mi]?.forecast || 0;
                        const display = val > 0 ? val : (y === currentYear && fc > 0 ? fc : 0);
                        return (
                          <td key={y} className={`p-1.5 text-right tabular-nums ${y === currentYear ? "font-semibold text-cyan-700 dark:text-cyan-300" : ""} ${val === 0 && fc > 0 && y === currentYear ? "text-muted-foreground italic" : ""}`}>
                            {display > 0 ? formatNum(display) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 font-bold bg-muted/20">
                    <td className="p-1.5">Razem</td>
                    {data.years.map(y => (
                      <td key={y} className={`p-1.5 text-right tabular-nums ${y === currentYear ? "text-cyan-700 dark:text-cyan-300" : ""}`}>
                        {formatNum(data.yearlyData[y]?.totalActual || 0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          ) : <p className="text-xs text-muted-foreground">Brak danych</p>}
        </div>
      </td>
    </tr>
  );
}

function handleTableScroll(e: React.UIEvent<HTMLDivElement>) {
  const el = e.currentTarget;
  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10;
  if (atEnd) el.classList.add('scrolled-end');
  else el.classList.remove('scrolled-end');
}

function LocationGroup({ locationName, apartments, currentMonth, onApartmentClick }: {
  locationName: string;
  apartments: AptRevenueData[];
  currentMonth: number;
  onApartmentClick?: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const [expandedComparison, setExpandedComparison] = useState<Set<number>>(new Set());
  const toggleComparison = (id: number) => setExpandedComparison(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const sortedApts = useMemo(() => {
    if (locationName === "GRAND BALTIC") {
      return [...apartments].sort((a, b) => {
        const catA = getGBCategory(a.apartmentName);
        const catB = getGBCategory(b.apartmentName);
        if (catA !== catB) return catA - catB;
        return a.apartmentName.localeCompare(b.apartmentName, "pl");
      });
    }
    return apartments;
  }, [apartments, locationName]);

  const totals = useMemo(() => {
    const t: Record<number, { forecast: number; actual: number }> = {};
    for (let m = 0; m < 12; m++) {
      t[m] = { forecast: 0, actual: 0 };
      for (const apt of sortedApts) {
        t[m].forecast += apt.months[m]?.forecast || 0;
        t[m].actual += apt.months[m]?.actual || 0;
      }
    }
    return t;
  }, [sortedApts]);

  const yearTotalFc = Object.values(totals).reduce((s, t) => s + t.forecast, 0);
  const yearTotalAct = Object.values(totals).reduce((s, t) => s + t.actual, 0);

  return (
    <div className="mb-4" data-testid={`location-group-${locationName}`}>
      <button
        className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-md hover:bg-muted/50 transition-colors font-semibold text-sm"
        onClick={() => setOpen(!open)}
        data-testid={`toggle-location-${locationName}`}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <span>{locationName}</span>
        <Badge variant="secondary" className="ml-2">{sortedApts.length}</Badge>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          Plan: {formatNum(yearTotalFc)} PLN | Realizacja: {formatNum(yearTotalAct)} PLN
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto mt-1 table-scroll-container" onScroll={handleTableScroll}>
          <table className="w-full text-[10px] sm:text-xs border-collapse" data-testid={`revenue-table-${locationName}`}>
            <thead>
              <tr className="border-b bg-muted/30 sticky top-0 z-10">
                <th className="sticky left-0 z-20 bg-muted/30 text-left p-1.5 sm:p-2 min-w-[120px] sm:min-w-[160px] font-medium">Apartament</th>
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
              {sortedApts.map(apt => {
                const yearFc = Object.values(apt.months).reduce((s, m) => s + m.forecast, 0);
                const yearAct = Object.values(apt.months).reduce((s, m) => s + m.actual, 0);
                const yearDev = yearAct - yearFc;
                const yearPct = pctVal(yearAct, yearFc);
                const compExpanded = expandedComparison.has(apt.apartmentId);
                return [
                  <tr key={`${apt.apartmentId}-plan`} className="border-b border-dashed" data-testid={`apt-row-plan-${apt.apartmentId}`}>
                    <td className="sticky left-0 z-10 bg-background p-1.5 sm:p-2 font-medium" rowSpan={3}>
                      <div className="flex items-center gap-1">
                        <button className="text-left hover:text-[#5ADBFA] hover:underline transition-colors flex-1" onClick={() => onApartmentClick?.(apt.apartmentId)} data-testid={`apt-trend-link-${apt.apartmentId}`}>
                          {apt.apartmentName}
                        </button>
                        <button
                          className={`p-0.5 rounded transition-colors shrink-0 ${compExpanded ? "text-cyan-600" : "text-muted-foreground hover:text-foreground"}`}
                          onClick={() => toggleComparison(apt.apartmentId)}
                          title="Porównaj lata"
                          data-testid={`apt-toggle-comparison-${apt.apartmentId}`}
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-1.5 sm:p-2 text-muted-foreground">Plan</td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className={`p-1.5 sm:p-2 text-right tabular-nums ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                        {formatNum(apt.months[i]?.forecast || 0)}
                      </td>
                    ))}
                    <td className="p-1.5 sm:p-2 text-right font-semibold tabular-nums">{formatNum(yearFc)} PLN</td>
                  </tr>,
                  <tr key={`${apt.apartmentId}-actual`} className="border-b border-dashed" data-testid={`apt-row-actual-${apt.apartmentId}`}>
                    <td className="p-1.5 sm:p-2 text-muted-foreground">Rzecz.</td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className={`p-1.5 sm:p-2 text-right tabular-nums font-medium ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                        {formatNum(apt.months[i]?.actual || 0)}
                      </td>
                    ))}
                    <td className="p-1.5 sm:p-2 text-right font-bold tabular-nums">{formatNum(yearAct)} PLN</td>
                  </tr>,
                  <tr key={`${apt.apartmentId}-dev`} className="border-b" data-testid={`apt-row-dev-${apt.apartmentId}`}>
                    <td className="p-1.5 sm:p-2 text-muted-foreground">Odch.</td>
                    {MONTHS.map((_, i) => {
                      const fc = apt.months[i]?.forecast || 0;
                      const act = apt.months[i]?.actual || 0;
                      const dev = act - fc;
                      const mPct = pctVal(act, fc);
                      return (
                        <td key={i} className={`p-1.5 sm:p-2 text-right ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                          {fc === 0 && act === 0 ? "—" : (
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 justify-end">
                                <div className="w-12"><MiniProgress value={mPct} colorClass={deviationBgColor(dev)} /></div>
                                <span className="text-[10px] tabular-nums whitespace-nowrap">{mPct.toFixed(0)}%</span>
                              </div>
                              <span className={`block text-[10px] tabular-nums ${deviationColor(dev)}`}>
                                {dev >= 0 ? "+" : ""}{formatNum(dev)}
                              </span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-1.5 sm:p-2 text-right">
                      {yearFc === 0 && yearAct === 0 ? "—" : (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1 justify-end">
                            <div className="w-14"><MiniProgress value={yearPct} colorClass={deviationBgColor(yearDev)} /></div>
                            <span className="text-[10px] tabular-nums font-semibold whitespace-nowrap">{yearPct.toFixed(0)}%</span>
                          </div>
                          <span className={`block text-[10px] tabular-nums font-semibold ${deviationColor(yearDev)}`}>
                            {yearDev >= 0 ? "+" : ""}{formatNum(yearDev)} PLN
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>,
                  <ApartmentYearComparison key={`${apt.apartmentId}-comp`} apartmentId={apt.apartmentId} isOpen={compExpanded} colSpan={15} />,
                ];
              })}
              <tr className="border-t-2 font-bold bg-muted/20">
                <td className="sticky left-0 z-10 bg-muted/20 p-1.5 sm:p-2">Razem {locationName}</td>
                <td className="p-1.5 sm:p-2 text-muted-foreground text-xs">Plan</td>
                {MONTHS.map((_, i) => (
                  <td key={i} className={`p-1.5 sm:p-2 text-right tabular-nums ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(totals[i]?.forecast || 0)}
                  </td>
                ))}
                <td className="p-1.5 sm:p-2 text-right tabular-nums">{formatNum(yearTotalFc)} PLN</td>
              </tr>
              <tr className="font-bold bg-muted/20">
                <td className="sticky left-0 z-10 bg-muted/20 p-1.5 sm:p-2"></td>
                <td className="p-1.5 sm:p-2 text-muted-foreground text-xs">Rzecz.</td>
                {MONTHS.map((_, i) => (
                  <td key={i} className={`p-1.5 sm:p-2 text-right tabular-nums ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(totals[i]?.actual || 0)}
                  </td>
                ))}
                <td className="p-1.5 sm:p-2 text-right tabular-nums">{formatNum(yearTotalAct)} PLN</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GrandTotalTable({ apartments, currentMonth }: { apartments: AptRevenueData[]; currentMonth: number }) {
  const totals = useMemo(() => {
    const t: Record<number, { forecast: number; actual: number }> = {};
    for (let m = 0; m < 12; m++) {
      t[m] = { forecast: 0, actual: 0 };
      for (const apt of apartments) {
        t[m].forecast += apt.months[m]?.forecast || 0;
        t[m].actual += apt.months[m]?.actual || 0;
      }
    }
    return t;
  }, [apartments]);

  const yearTotalFc = Object.values(totals).reduce((s, t) => s + t.forecast, 0);
  const yearTotalAct = Object.values(totals).reduce((s, t) => s + t.actual, 0);

  return (
    <div data-testid="grand-total-section">
      <div className="flex items-center gap-2 py-2 px-3 font-semibold text-sm mb-1">
        <span>Podsumowanie łączne — wszystkie lokalizacje</span>
        <Badge variant="secondary">{apartments.length} apartamentów</Badge>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          Plan: {formatNum(yearTotalFc)} PLN | Realizacja: {formatNum(yearTotalAct)} PLN
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] sm:text-xs border-collapse" data-testid="revenue-table-grand-total">
          <thead>
            <tr className="border-b bg-muted/30 sticky top-0 z-10">
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
            <tr className="border-t-2 font-bold bg-primary/5">
              <td className="sticky left-0 z-10 bg-primary/5 p-1.5 sm:p-2 font-bold">RAZEM WSZYSTKIE</td>
              <td className="p-1.5 sm:p-2 text-muted-foreground text-xs">Plan</td>
              {MONTHS.map((_, i) => (
                <td key={i} className={`p-1.5 sm:p-2 text-right tabular-nums ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                  {formatNum(totals[i]?.forecast || 0)}
                </td>
              ))}
              <td className="p-1.5 sm:p-2 text-right tabular-nums">{formatNum(yearTotalFc)} PLN</td>
            </tr>
            <tr className="font-bold bg-primary/5">
              <td className="sticky left-0 z-10 bg-primary/5 p-1.5 sm:p-2"></td>
              <td className="p-1.5 sm:p-2 text-muted-foreground text-xs">Rzecz.</td>
              {MONTHS.map((_, i) => (
                <td key={i} className={`p-1.5 sm:p-2 text-right tabular-nums ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                  {formatNum(totals[i]?.actual || 0)}
                </td>
              ))}
              <td className="p-1.5 sm:p-2 text-right tabular-nums">{formatNum(yearTotalAct)} PLN</td>
            </tr>
            <tr className="font-bold bg-primary/5 border-t">
              <td className="sticky left-0 z-10 bg-primary/5 p-1.5 sm:p-2"></td>
              <td className="p-1.5 sm:p-2 text-muted-foreground text-xs">Odch.</td>
              {MONTHS.map((_, i) => {
                const fc = totals[i]?.forecast || 0;
                const act = totals[i]?.actual || 0;
                const dev = act - fc;
                const mPct = pctVal(act, fc);
                return (
                  <td key={i} className={`p-1.5 sm:p-2 text-right ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {fc === 0 && act === 0 ? "—" : (
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 justify-end">
                          <div className="w-12"><MiniProgress value={mPct} colorClass={deviationBgColor(dev)} /></div>
                          <span className="text-[10px] tabular-nums whitespace-nowrap">{mPct.toFixed(0)}%</span>
                        </div>
                        <span className={`block text-[10px] tabular-nums ${deviationColor(dev)}`}>
                          {dev >= 0 ? "+" : ""}{formatNum(dev)}
                        </span>
                      </div>
                    )}
                  </td>
                );
              })}
              <td className="p-1.5 sm:p-2 text-right">
                {yearTotalFc === 0 && yearTotalAct === 0 ? "—" : (
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 justify-end">
                      <div className="w-14"><MiniProgress value={pctVal(yearTotalAct, yearTotalFc)} colorClass={deviationBgColor(yearTotalAct - yearTotalFc)} /></div>
                      <span className="text-[10px] tabular-nums font-semibold whitespace-nowrap">{pctVal(yearTotalAct, yearTotalFc).toFixed(0)}%</span>
                    </div>
                    <span className={`block text-[10px] tabular-nums font-semibold ${deviationColor(yearTotalAct - yearTotalFc)}`}>
                      {yearTotalAct - yearTotalFc >= 0 ? "+" : ""}{formatNum(yearTotalAct - yearTotalFc)} PLN
                    </span>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
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
  const [trendAptId, setTrendAptId] = useState<number | null>(null);

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

  const chartData = useMemo(() => {
    return MONTHS.map((m, i) => {
      let totalFc = 0, totalAct = 0;
      for (const apt of apartments) {
        totalFc += apt.months[i]?.forecast || 0;
        totalAct += apt.months[i]?.actual || 0;
      }
      return { month: m, "Prognoza": totalFc, "Realizacja": totalAct };
    });
  }, [apartments]);

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
              currentMonth={year === currentYear ? currentMonth : -1}
              onApartmentClick={(id) => setTrendAptId(id)}
            />
          </CardContent>
        </Card>
      ))}

      {grouped.size > 1 && (
        <Card data-testid="revenue-grand-total">
          <CardContent className="pt-4">
            <GrandTotalTable apartments={apartments} currentMonth={year === currentYear ? currentMonth : -1} />
          </CardContent>
        </Card>
      )}

      <CopyForecastDialog open={showCopyDialog} onOpenChange={setShowCopyDialog} currentYear={year} defaultTypes={["revenue"]} />
      <AutoFillDialog open={showAutoFill} onOpenChange={setShowAutoFill} currentYear={year} />
      <ApartmentTrendSheet apartmentId={trendAptId} open={!!trendAptId} onOpenChange={(o) => { if (!o) setTrendAptId(null); }} />
    </div>
  );
}

export default V2Przychody;
