import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Apartment, Location, RevenueForecast } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, ArrowUp, ArrowDown, BarChart3, PieChart, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, Line } from "recharts";
import { Sparkline } from "@/components/DataVizHelpers";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

type MonthData = {
  najem: number;
  podnajem: number;
  doplaty_najem: number;
  doplaty_podnajem: number;
};

type RevenueData = Record<number, Record<number, MonthData>>;

function formatNum(v: number): string {
  if (v === 0) return "—";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatPct(v: number): string {
  if (!isFinite(v) || isNaN(v)) return "—";
  return (v * 100).toFixed(0) + "%";
}

function saldoColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "";
}

function pctColor(v: number): string {
  if (!isFinite(v) || isNaN(v)) return "text-muted-foreground";
  if (v >= 1) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0.7) return "text-red-600 dark:text-red-400";
  return "text-amber-600 dark:text-amber-400";
}

function changeIndicator(current: number, previous: number): { text: string; color: string; icon: "up" | "down" | "flat" } {
  if (previous === 0) return { text: "—", color: "text-muted-foreground", icon: "flat" };
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  const text = `${sign}${change.toFixed(0)}%`;
  if (change > 0) return { text, color: "text-emerald-600 dark:text-emerald-400", icon: "up" };
  if (change < 0) return { text, color: "text-red-600 dark:text-red-400", icon: "down" };
  return { text: "0%", color: "text-muted-foreground", icon: "flat" };
}

function KpiCard({ title, value, subtitle, gradient, icon: Icon, change, testId }: {
  title: string;
  value: string;
  subtitle?: string;
  gradient: string;
  icon: any;
  change?: { text: string; color: string; icon: "up" | "down" | "flat" };
  testId: string;
}) {
  return (
    <Card className={`kpi-card card-gradient ${gradient}`} data-testid={testId}>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
        <p className="text-xl font-bold mt-1 tabular-nums">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        {change && (
          <p className={`text-xs mt-1 flex items-center gap-1 font-medium ${change.color}`}>
            {change.icon === "up" ? <ArrowUp className="h-3 w-3" /> : change.icon === "down" ? <ArrowDown className="h-3 w-3" /> : null}
            {change.text} vs ubiegły rok
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ApartmentAccordionRow({ apt, months, comparePrev }: {
  apt: Apartment;
  months: { month: number; value: number; forecast: number; najem?: number; podnajem?: number; doplaty?: number; prevYearValue?: number }[];
  comparePrev: boolean;
}) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const currentMonth = now.getMonth();

  const yearTotal = months.reduce((s, m) => s + m.value, 0);
  const yearForecast = months.reduce((s, m) => s + m.forecast, 0);
  const yearPrevTotal = comparePrev ? months.reduce((s, m) => s + (m.prevYearValue || 0), 0) : 0;
  const realization = yearForecast > 0 ? yearTotal / yearForecast : 0;
  const sparkData = months.map(m => m.value);
  const yrChange = comparePrev && yearPrevTotal > 0 ? changeIndicator(yearTotal, yearPrevTotal) : null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div
          className="flex items-center gap-3 px-3 py-2.5 border-b border-border hover:bg-muted/30 cursor-pointer transition-colors group"
          data-testid={`row-accordion-revenue-${apt.id}`}
        >
          <div className="shrink-0">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
          <div className="flex-1 min-w-0">
            <span className="font-medium text-sm truncate">{apt.name}</span>
          </div>
          <Sparkline data={sparkData} width={80} height={20} showDots />
          <div className="text-right min-w-[90px]">
            <div className="text-sm font-bold tabular-nums">{formatNum(yearTotal)} zł</div>
            {yearForecast > 0 && (
              <div className="text-[10px] text-muted-foreground tabular-nums">z {formatNum(yearForecast)} zł</div>
            )}
          </div>
          {yearForecast > 0 && (
            <div className={`text-xs font-semibold min-w-[50px] text-right tabular-nums ${pctColor(realization)}`}>
              {formatPct(realization)}
            </div>
          )}
          <div className={`min-w-[60px] text-right ${yearForecast > 0 ? saldoColor(yearTotal - yearForecast) : ""}`}>
            {yearForecast > 0 && (
              <span className="text-xs font-semibold tabular-nums">{formatNum(yearTotal - yearForecast)} zł</span>
            )}
          </div>
          {yrChange ? (
            <Badge variant="outline" className={`text-[10px] shrink-0 ${yrChange.color}`}>
              {yrChange.icon === "up" ? <ArrowUp className="h-2.5 w-2.5 mr-0.5" /> : yrChange.icon === "down" ? <ArrowDown className="h-2.5 w-2.5 mr-0.5" /> : null}
              {yrChange.text}
            </Badge>
          ) : <div className="min-w-[60px]" />}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 p-3 bg-muted/10 border-b border-border">
          {months.map(m => {
            const isCurrentMonth = m.month === currentMonth;
            const pct = m.forecast > 0 ? m.value / m.forecast : 0;
            const saldo = m.value - m.forecast;
            const prevChange = comparePrev && m.prevYearValue !== undefined && m.prevYearValue > 0
              ? changeIndicator(m.value, m.prevYearValue) : null;
            return (
              <Card
                key={m.month}
                className={`text-xs ${isCurrentMonth ? "ring-2 ring-[#5ADBFA]/50" : ""}`}
                data-testid={`card-month-revenue-${apt.id}-${m.month}`}
              >
                <CardContent className="p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{MONTHS[m.month]}</span>
                    {isCurrentMonth && <Badge className="text-[8px] px-1 py-0 bg-[#5ADBFA]/20 text-[#5ADBFA] border-[#5ADBFA]/30">Teraz</Badge>}
                  </div>

                  {m.forecast > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Prognoza</span>
                      <span className="tabular-nums text-muted-foreground">{formatNum(m.forecast)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Przychody</span>
                    <span className="font-bold tabular-nums">{formatNum(m.value)}</span>
                  </div>

                  {m.najem !== undefined && (m.najem > 0 || (m.podnajem ?? 0) > 0) && (
                    <div className="pl-2 border-l-2 border-muted space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Najem</span>
                        <span className="tabular-nums">{formatNum(m.najem)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">Podnajem</span>
                        <span className="tabular-nums">{formatNum(m.podnajem ?? 0)}</span>
                      </div>
                    </div>
                  )}

                  {m.forecast > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Realizacja</span>
                        <span className={`font-bold tabular-nums ${pctColor(pct)}`}>{formatPct(pct)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Saldo</span>
                        <span className={`font-semibold tabular-nums ${saldoColor(saldo)}`}>
                          {formatNum(saldo)} zł
                        </span>
                      </div>
                    </>
                  )}

                  {(m.doplaty ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-amber-600 dark:text-amber-400">Dopłaty</span>
                      <span className="tabular-nums text-amber-600 dark:text-amber-400">{formatNum(m.doplaty ?? 0)}</span>
                    </div>
                  )}

                  {prevChange && (
                    <div className="flex justify-between items-center pt-1 border-t border-border mt-1">
                      <span className="text-muted-foreground text-[10px]">vs ubiegły rok</span>
                      <span className={`font-semibold text-[10px] ${prevChange.color}`}>{prevChange.text}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function LocationSummaryRow({ locationName, months, comparePrev }: {
  locationName: string;
  months: { month: number; value: number; forecast: number; prevYearValue?: number }[];
  comparePrev: boolean;
}) {
  const yearTotal = months.reduce((s, m) => s + m.value, 0);
  const yearForecast = months.reduce((s, m) => s + m.forecast, 0);
  const yearPrevTotal = comparePrev ? months.reduce((s, m) => s + (m.prevYearValue || 0), 0) : 0;
  const realization = yearForecast > 0 ? yearTotal / yearForecast : 0;
  const sparkData = months.map(m => m.value);
  const yrChange = comparePrev && yearPrevTotal > 0 ? changeIndicator(yearTotal, yearPrevTotal) : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 border-b-2 border-border font-semibold" data-testid={`row-location-summary`}>
      <div className="w-4" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-bold uppercase tracking-wide">{locationName}</span>
      </div>
      <Sparkline data={sparkData} width={80} height={20} showDots />
      <div className="text-right min-w-[90px]">
        <div className="text-sm font-bold tabular-nums">{formatNum(yearTotal)} zł</div>
        {yearForecast > 0 && (
          <div className="text-[10px] text-muted-foreground tabular-nums">z {formatNum(yearForecast)} zł</div>
        )}
      </div>
      {yearForecast > 0 && (
        <div className={`text-xs font-semibold min-w-[50px] text-right tabular-nums ${pctColor(realization)}`}>
          {formatPct(realization)}
        </div>
      )}
      <div className={`min-w-[60px] text-right ${yearForecast > 0 ? saldoColor(yearTotal - yearForecast) : ""}`}>
        {yearForecast > 0 && (
          <span className="text-xs font-semibold tabular-nums">{formatNum(yearTotal - yearForecast)} zł</span>
        )}
      </div>
      {yrChange ? (
        <Badge variant="outline" className={`text-[10px] shrink-0 ${yrChange.color}`}>
          {yrChange.icon === "up" ? <ArrowUp className="h-2.5 w-2.5 mr-0.5" /> : yrChange.icon === "down" ? <ArrowDown className="h-2.5 w-2.5 mr-0.5" /> : null}
          {yrChange.text}
        </Badge>
      ) : <div className="min-w-[60px]" />}
    </div>
  );
}

export default function Revenue() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [compareYear, setCompareYear] = useState<number | null>(null);

  const { data: apartments = [] } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"] });

  const { data: revenueData = {}, isLoading: revLoading } = useQuery<RevenueData>({
    queryKey: ["/api/revenue", year],
    queryFn: async () => {
      const res = await fetch(`/api/revenue?year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch revenue");
      return res.json();
    },
  });

  const { data: forecasts = [] } = useQuery<RevenueForecast[]>({
    queryKey: ["/api/revenue-forecasts", year],
    queryFn: async () => {
      const res = await fetch(`/api/revenue-forecasts?year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: compareRevenueData = {} } = useQuery<RevenueData>({
    queryKey: ["/api/revenue", compareYear],
    queryFn: async () => {
      const res = await fetch(`/api/revenue?year=${compareYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: compareYear !== null,
  });

  const revForecastLookup = useMemo(() => {
    const byApartment: Record<number, Record<number, number>> = {};
    for (const f of forecasts) {
      if (f.apartmentId) {
        if (!byApartment[f.apartmentId]) byApartment[f.apartmentId] = {};
        byApartment[f.apartmentId][f.month] = Number(f.forecast) || 0;
      }
    }
    return { byApartment };
  }, [forecasts]);

  const getRevForecast = useCallback((aptId: number, month: number): number => {
    return revForecastLookup.byApartment[aptId]?.[month] || 0;
  }, [revForecastLookup]);

  const sortedLocations = useMemo(() =>
    [...locations].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [locations]
  );

  const locationTabs = useMemo(() => {
    return sortedLocations.filter(loc => {
      const apts = apartments.filter(a => a.location === loc.name && a.active !== false);
      return apts.length > 0;
    });
  }, [sortedLocations, apartments]);

  const currentLocation = activeLocation || (locationTabs.length > 0 ? locationTabs[0].name : "");

  const locationApartments = useMemo(() => {
    return apartments.filter(a => a.location === currentLocation && a.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [apartments, currentLocation]);

  const allActiveApartments = useMemo(() => apartments.filter(a => a.active !== false), [apartments]);

  const getMonthData = (aptId: number, month: number): MonthData => {
    return revenueData[aptId]?.[month] || { najem: 0, podnajem: 0, doplaty_najem: 0, doplaty_podnajem: 0 };
  };

  const getCompareRevenue = (aptId: number, month: number): number => {
    const md = compareRevenueData[aptId]?.[month];
    return md ? (md.najem + md.podnajem) : 0;
  };

  const globalRevTotals = useMemo(() => {
    const result: Record<number, { value: number; forecast: number; najem: number; podnajem: number }> = {};
    for (let m = 0; m < 12; m++) {
      let najem = 0, podnajem = 0, forecast = 0;
      for (const apt of allActiveApartments) {
        const md = getMonthData(apt.id, m);
        najem += md.najem;
        podnajem += md.podnajem;
        forecast += getRevForecast(apt.id, m);
      }
      result[m] = { value: najem + podnajem, forecast, najem, podnajem };
    }
    return result;
  }, [allActiveApartments, revenueData, revForecastLookup]);

  const yearRevTotal = useMemo(() => {
    let v = 0, f = 0;
    for (let m = 0; m < 12; m++) { v += globalRevTotals[m].value; f += globalRevTotals[m].forecast; }
    return { value: v, forecast: f };
  }, [globalRevTotals]);

  const prevYearRevTotal = useMemo(() => {
    if (compareYear === null) return 0;
    let total = 0;
    for (const apt of allActiveApartments) {
      for (let m = 0; m < 12; m++) total += getCompareRevenue(apt.id, m);
    }
    return total;
  }, [allActiveApartments, compareRevenueData, compareYear]);

  const currentMonthIdx = new Date().getMonth();
  const currentMonthRev = globalRevTotals[currentMonthIdx]?.value || 0;
  const currentMonthForecast = globalRevTotals[currentMonthIdx]?.forecast || 0;

  const chartData = useMemo(() => {
    return MONTHS.map((mName, mi) => {
      const rev = globalRevTotals[mi];
      return {
        name: mName,
        najem: Math.round(rev.najem),
        podnajem: Math.round(rev.podnajem),
        przychody: Math.round(rev.value),
        prognoza: Math.round(rev.forecast),
      };
    });
  }, [globalRevTotals]);

  const locationChartData = useMemo(() => {
    return MONTHS.map((mName, mi) => {
      let najem = 0, podnajem = 0, forecast = 0;
      for (const apt of locationApartments) {
        const md = getMonthData(apt.id, mi);
        najem += md.najem;
        podnajem += md.podnajem;
        forecast += getRevForecast(apt.id, mi);
      }
      return {
        name: mName,
        najem: Math.round(najem),
        podnajem: Math.round(podnajem),
        przychody: Math.round(najem + podnajem),
        prognoza: Math.round(forecast),
      };
    });
  }, [locationApartments, revenueData, revForecastLookup]);

  const getAptRevenueMonths = useCallback((apt: Apartment) => {
    return Array.from({ length: 12 }, (_, m) => {
      const md = getMonthData(apt.id, m);
      return {
        month: m,
        value: md.najem + md.podnajem,
        forecast: getRevForecast(apt.id, m),
        najem: md.najem,
        podnajem: md.podnajem,
        doplaty: md.doplaty_najem + md.doplaty_podnajem,
        prevYearValue: compareYear !== null ? getCompareRevenue(apt.id, m) : undefined,
      };
    });
  }, [revenueData, revForecastLookup, compareRevenueData, compareYear]);

  const locationRevMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      let value = 0, forecast = 0, prevYearValue = 0;
      for (const apt of locationApartments) {
        const md = getMonthData(apt.id, m);
        value += md.najem + md.podnajem;
        forecast += getRevForecast(apt.id, m);
        if (compareYear !== null) prevYearValue += getCompareRevenue(apt.id, m);
      }
      return { month: m, value, forecast, prevYearValue: compareYear !== null ? prevYearValue : undefined };
    });
  }, [locationApartments, revenueData, revForecastLookup, compareRevenueData, compareYear]);

  if (revLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  const formatTooltip = (value: number) => value.toLocaleString("pl-PL") + " zł";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader title="Przychody" description="Rzeczywiste przychody z rezerwacji i podnajmów z porównaniem do prognozy." icon={Wallet} />
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]" data-testid="select-revenue-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: currentYear - 2022 + 2 }, (_, i) => 2022 + i).map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={compareYear !== null ? String(compareYear) : "none"} onValueChange={(v) => setCompareYear(v === "none" ? null : Number(v))}>
            <SelectTrigger className="w-[150px]" data-testid="select-compare-year">
              <SelectValue placeholder="Porównaj z..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Brak —</SelectItem>
              {Array.from({ length: currentYear - 2022 + 2 }, (_, i) => 2022 + i)
                .filter(y => y !== year)
                .map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" data-testid="kpi-revenue">
        <KpiCard
          title={`Przychody ${year}`}
          value={`${formatNum(yearRevTotal.value)} zł`}
          subtitle={yearRevTotal.forecast > 0 ? `Prognoza: ${formatNum(yearRevTotal.forecast)} zł` : undefined}
          gradient="card-gradient-green"
          icon={TrendingUp}
          change={compareYear !== null && prevYearRevTotal > 0 ? changeIndicator(yearRevTotal.value, prevYearRevTotal) : undefined}
          testId="kpi-total-revenue"
        />
        <KpiCard
          title={`Bieżący miesiąc`}
          value={`${formatNum(currentMonthRev)} zł`}
          subtitle={currentMonthForecast > 0 ? `Prognoza: ${formatNum(currentMonthForecast)} zł` : undefined}
          gradient="card-gradient-blue"
          icon={BarChart3}
          testId="kpi-current-month"
        />
        <KpiCard
          title="Najem vs Podnajem"
          value={`${formatNum(globalRevTotals[currentMonthIdx]?.najem || 0)} / ${formatNum(globalRevTotals[currentMonthIdx]?.podnajem || 0)}`}
          subtitle="Najem / Podnajem w bieżącym miesiącu"
          gradient="card-gradient-purple"
          icon={PieChart}
          testId="kpi-najem-podnajem"
        />
        <KpiCard
          title="Realizacja prognozy"
          value={yearRevTotal.forecast > 0 ? formatPct(yearRevTotal.value / yearRevTotal.forecast) : "—"}
          subtitle={yearRevTotal.forecast > 0 ? `Saldo: ${formatNum(yearRevTotal.value - yearRevTotal.forecast)} zł` : "Brak prognoz"}
          gradient={yearRevTotal.forecast > 0 && yearRevTotal.value / yearRevTotal.forecast >= 1 ? "card-gradient-green" : "card-gradient-orange"}
          icon={yearRevTotal.forecast > 0 && yearRevTotal.value / yearRevTotal.forecast >= 1 ? TrendingUp : TrendingDown}
          testId="kpi-realization"
        />
      </div>

      <Card data-testid="card-main-chart">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Przychody — {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-foreground" />
              <YAxis tickFormatter={(v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)} tick={{ fontSize: 11 }} className="fill-foreground" />
              <Tooltip
                formatter={formatTooltip}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
              />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="najem" name="Najem" stackId="rev" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="podnajem" name="Podnajem" stackId="rev" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="prognoza" name="Prognoza" stroke="hsl(var(--chart-1))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Tabs value={currentLocation} onValueChange={setActiveLocation}>
        <TabsList className="flex flex-wrap h-auto gap-1" data-testid="tabs-location">
          {locationTabs.map(loc => (
            <TabsTrigger key={loc.id} value={loc.name} data-testid={`tab-location-${loc.name}`}>
              {loc.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card data-testid="card-location-rev-chart">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Przychody — {currentLocation}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={locationChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-foreground" />
              <YAxis tickFormatter={(v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)} tick={{ fontSize: 10 }} className="fill-foreground" />
              <Tooltip formatter={formatTooltip} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              <Bar dataKey="najem" name="Najem" stackId="rev" fill="hsl(var(--chart-2))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="podnajem" name="Podnajem" stackId="rev" fill="hsl(var(--chart-5))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="prognoza" name="Prognoza" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card data-testid="card-revenue-accordion">
        <CardHeader className="pb-0 pt-3 px-3">
          <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
            <div className="w-4" />
            <div className="flex-1">Apartament</div>
            <div className="w-[80px] text-center">Trend</div>
            <div className="min-w-[90px] text-right">Przychody / Prognoza</div>
            <div className="min-w-[50px] text-right">Realizacja</div>
            <div className="min-w-[60px] text-right">Saldo</div>
            {compareYear !== null && <div className="min-w-[60px] text-right">vs {compareYear}</div>}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <LocationSummaryRow
            locationName={currentLocation}
            months={locationRevMonths}
            comparePrev={compareYear !== null}
          />
          {locationApartments.map(apt => (
            <ApartmentAccordionRow
              key={apt.id}
              apt={apt}
              months={getAptRevenueMonths(apt)}
              comparePrev={compareYear !== null}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
