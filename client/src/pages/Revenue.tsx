import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Apartment, Location, RevenueForecast, CostForecast } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Upload, Loader2, Wallet, TrendingUp, TrendingDown, ArrowUp, ArrowDown, BarChart3, PieChart } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ComposedChart, Area } from "recharts";
import { Sparkline } from "@/components/DataVizHelpers";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const MONTHS_FULL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

type MonthData = {
  najem: number;
  podnajem: number;
  doplaty_najem: number;
  doplaty_podnajem: number;
};

type RevenueData = Record<number, Record<number, MonthData>>;
type CostsData = Record<number, Record<number, number>>;

function formatNum(v: number): string {
  if (v === 0) return "—";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatNumFull(v: number): string {
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function pctBadgeColor(v: number): string {
  if (!isFinite(v) || isNaN(v)) return "bg-muted text-muted-foreground";
  if (v >= 1) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
  if (v < 0.7) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
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

function ApartmentAccordionRow({ apt, months, forecasts, comparePrev, onForecastChange, type }: {
  apt: Apartment;
  months: { month: number; value: number; forecast: number; najem?: number; podnajem?: number; doplaty?: number; prevYearValue?: number }[];
  forecasts: Record<number, string>;
  comparePrev: boolean;
  onForecastChange: (aptId: number, month: number, value: string) => void;
  type: "revenue" | "cost";
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
          data-testid={`row-accordion-${type}-${apt.id}`}
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
          {yrChange && (
            <Badge variant="outline" className={`text-[10px] shrink-0 ${yrChange.color}`}>
              {yrChange.icon === "up" ? <ArrowUp className="h-2.5 w-2.5 mr-0.5" /> : yrChange.icon === "down" ? <ArrowDown className="h-2.5 w-2.5 mr-0.5" /> : null}
              {yrChange.text}
            </Badge>
          )}
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
            const editKey = `${apt.id}-${m.month}`;
            return (
              <Card
                key={m.month}
                className={`text-xs ${isCurrentMonth ? "ring-2 ring-[#5ADBFA]/50" : ""}`}
                data-testid={`card-month-${type}-${apt.id}-${m.month}`}
              >
                <CardContent className="p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{MONTHS[m.month]}</span>
                    {isCurrentMonth && <Badge className="text-[8px] px-1 py-0 bg-[#5ADBFA]/20 text-[#5ADBFA] border-[#5ADBFA]/30">Teraz</Badge>}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Prognoza</span>
                    <input
                      type="number"
                      className="w-[70px] text-right text-[11px] tabular-nums bg-blue-50/60 dark:bg-blue-950/30 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={forecasts[m.month] ?? ""}
                      onChange={(e) => onForecastChange(apt.id, m.month, e.target.value)}
                      placeholder="0"
                      data-testid={`input-forecast-${type}-${apt.id}-${m.month}`}
                    />
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{type === "revenue" ? "Przychody" : "Koszty"}</span>
                    <span className="font-bold tabular-nums">{formatNum(m.value)}</span>
                  </div>

                  {type === "revenue" && m.najem !== undefined && (m.najem > 0 || (m.podnajem ?? 0) > 0) && (
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
                        <span className={`font-semibold tabular-nums ${saldoColor(type === "revenue" ? saldo : -saldo)}`}>
                          {formatNum(saldo)} zł
                        </span>
                      </div>
                    </>
                  )}

                  {(m.doplaty ?? 0) > 0 && type === "revenue" && (
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
  const [activeTab, setActiveTab] = useState<"revenue" | "costs">("revenue");
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const { toast } = useToast();
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [localRevEdits, setLocalRevEdits] = useState<Record<string, string>>({});
  const [localCostEdits, setLocalCostEdits] = useState<Record<string, string>>({});

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

  const { data: costsData = {}, isLoading: costsLoading } = useQuery<CostsData>({
    queryKey: ["/api/costs", year],
    queryFn: async () => {
      const res = await fetch(`/api/costs?year=${year}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch costs");
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

  const { data: costForecasts = [] } = useQuery<CostForecast[]>({
    queryKey: ["/api/cost-forecasts", year],
    queryFn: async () => {
      const res = await fetch(`/api/cost-forecasts?year=${year}`, { credentials: "include" });
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

  const { data: compareCostsData = {} } = useQuery<CostsData>({
    queryKey: ["/api/costs", compareYear],
    queryFn: async () => {
      const res = await fetch(`/api/costs?year=${compareYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: compareYear !== null,
  });

  const revForecastLookup = useMemo(() => {
    const byApartment: Record<number, Record<number, number>> = {};
    const byLocation: Record<string, Record<number, number>> = {};
    for (const f of forecasts) {
      if (f.apartmentId) {
        if (!byApartment[f.apartmentId]) byApartment[f.apartmentId] = {};
        byApartment[f.apartmentId][f.month] = Number(f.forecast) || 0;
      }
      if (f.locationName) {
        if (!byLocation[f.locationName]) byLocation[f.locationName] = {};
        byLocation[f.locationName][f.month] = Number(f.forecast) || 0;
      }
    }
    return { byApartment, byLocation };
  }, [forecasts]);

  const costForecastLookup = useMemo(() => {
    const byApartment: Record<number, Record<number, number>> = {};
    for (const f of costForecasts) {
      if (f.apartmentId) {
        if (!byApartment[f.apartmentId]) byApartment[f.apartmentId] = {};
        byApartment[f.apartmentId][f.month] = Number(f.forecast) || 0;
      }
    }
    return { byApartment };
  }, [costForecasts]);

  const getRevForecast = useCallback((aptId: number, month: number): number => {
    const editKey = `${aptId}-${month}`;
    if (editKey in localRevEdits) return parseFloat(localRevEdits[editKey]) || 0;
    return revForecastLookup.byApartment[aptId]?.[month] || 0;
  }, [revForecastLookup, localRevEdits]);

  const getCostForecast = useCallback((aptId: number, month: number): number => {
    const editKey = `${aptId}-${month}`;
    if (editKey in localCostEdits) return parseFloat(localCostEdits[editKey]) || 0;
    return costForecastLookup.byApartment[aptId]?.[month] || 0;
  }, [costForecastLookup, localCostEdits]);

  const getRevForecastDisplay = useCallback((aptId: number, month: number): string => {
    const editKey = `${aptId}-${month}`;
    if (editKey in localRevEdits) return localRevEdits[editKey];
    const dbVal = revForecastLookup.byApartment[aptId]?.[month] || 0;
    return dbVal ? String(dbVal) : "";
  }, [revForecastLookup, localRevEdits]);

  const getCostForecastDisplay = useCallback((aptId: number, month: number): string => {
    const editKey = `${aptId}-${month}`;
    if (editKey in localCostEdits) return localCostEdits[editKey];
    const dbVal = costForecastLookup.byApartment[aptId]?.[month] || 0;
    return dbVal ? String(dbVal) : "";
  }, [costForecastLookup, localCostEdits]);

  const revForecastMutation = useMutation({
    mutationFn: async (data: { year: number; month: number; apartmentId: number; forecast: string }) => {
      const res = await apiRequest("PUT", "/api/revenue-forecasts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenue-forecasts", year] });
    },
  });

  const costForecastMutation = useMutation({
    mutationFn: async (data: { year: number; month: number; apartmentId: number; forecast: string }) => {
      const res = await apiRequest("PUT", "/api/cost-forecasts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-forecasts", year] });
    },
  });

  const handleRevForecastChange = useCallback((aptId: number, month: number, value: string) => {
    const editKey = `${aptId}-${month}`;
    setLocalRevEdits(prev => ({ ...prev, [editKey]: value }));
    if (debounceTimers.current[`rev-${editKey}`]) clearTimeout(debounceTimers.current[`rev-${editKey}`]);
    debounceTimers.current[`rev-${editKey}`] = setTimeout(() => {
      revForecastMutation.mutate({ year, month, apartmentId: aptId, forecast: String(parseFloat(value) || 0) });
    }, 800);
  }, [year, revForecastMutation]);

  const handleCostForecastChange = useCallback((aptId: number, month: number, value: string) => {
    const editKey = `${aptId}-${month}`;
    setLocalCostEdits(prev => ({ ...prev, [editKey]: value }));
    if (debounceTimers.current[`cost-${editKey}`]) clearTimeout(debounceTimers.current[`cost-${editKey}`]);
    debounceTimers.current[`cost-${editKey}`] = setTimeout(() => {
      costForecastMutation.mutate({ year, month, apartmentId: aptId, forecast: String(parseFloat(value) || 0) });
    }, 800);
  }, [year, costForecastMutation]);

  useEffect(() => {
    setLocalRevEdits({});
    setLocalCostEdits({});
  }, [year, forecasts, costForecasts]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/import-revenue-forecasts");
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenue-forecasts", year] });
      toast({ title: "Import zakończony", description: result.message || "Dane prognoz zostały zaimportowane" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd importu", description: err.message, variant: "destructive" });
    },
  });

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

  const getCostData = (aptId: number, month: number): number => {
    return costsData[aptId]?.[month] || 0;
  };

  const getCompareRevenue = (aptId: number, month: number): number => {
    const md = compareRevenueData[aptId]?.[month];
    return md ? (md.najem + md.podnajem) : 0;
  };

  const getCompareCost = (aptId: number, month: number): number => {
    return compareCostsData[aptId]?.[month] || 0;
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
  }, [allActiveApartments, revenueData, revForecastLookup, localRevEdits]);

  const globalCostTotals = useMemo(() => {
    const result: Record<number, { value: number; forecast: number }> = {};
    for (let m = 0; m < 12; m++) {
      let value = 0, forecast = 0;
      for (const apt of allActiveApartments) {
        value += getCostData(apt.id, m);
        forecast += getCostForecast(apt.id, m);
      }
      result[m] = { value, forecast };
    }
    return result;
  }, [allActiveApartments, costsData, costForecastLookup, localCostEdits]);

  const yearRevTotal = useMemo(() => {
    let v = 0, f = 0;
    for (let m = 0; m < 12; m++) { v += globalRevTotals[m].value; f += globalRevTotals[m].forecast; }
    return { value: v, forecast: f };
  }, [globalRevTotals]);

  const yearCostTotal = useMemo(() => {
    let v = 0, f = 0;
    for (let m = 0; m < 12; m++) { v += globalCostTotals[m].value; f += globalCostTotals[m].forecast; }
    return { value: v, forecast: f };
  }, [globalCostTotals]);

  const prevYearRevTotal = useMemo(() => {
    if (compareYear === null) return 0;
    let total = 0;
    for (const apt of allActiveApartments) {
      for (let m = 0; m < 12; m++) total += getCompareRevenue(apt.id, m);
    }
    return total;
  }, [allActiveApartments, compareRevenueData, compareYear]);

  const prevYearCostTotal = useMemo(() => {
    if (compareYear === null) return 0;
    let total = 0;
    for (const apt of allActiveApartments) {
      for (let m = 0; m < 12; m++) total += getCompareCost(apt.id, m);
    }
    return total;
  }, [allActiveApartments, compareCostsData, compareYear]);

  const chartData = useMemo(() => {
    return MONTHS.map((mName, mi) => {
      const rev = globalRevTotals[mi];
      const cost = globalCostTotals[mi];
      return {
        name: mName,
        przychody: Math.round(rev.value),
        koszty: Math.round(cost.value),
        prognoza_przychody: Math.round(rev.forecast),
        prognoza_koszty: Math.round(cost.forecast),
        wynik_netto: Math.round(rev.value - cost.value),
      };
    });
  }, [globalRevTotals, globalCostTotals]);

  const locationChartData = useMemo(() => {
    return MONTHS.map((mName, mi) => {
      let rev = 0, cost = 0, revForecast = 0, costForecast = 0;
      for (const apt of locationApartments) {
        const md = getMonthData(apt.id, mi);
        rev += md.najem + md.podnajem;
        cost += getCostData(apt.id, mi);
        revForecast += getRevForecast(apt.id, mi);
        costForecast += getCostForecast(apt.id, mi);
      }
      return {
        name: mName,
        przychody: Math.round(rev),
        koszty: Math.round(cost),
        prognoza: Math.round(activeTab === "revenue" ? revForecast : costForecast),
        wynik: Math.round(rev - cost),
      };
    });
  }, [locationApartments, revenueData, costsData, revForecastLookup, costForecastLookup, localRevEdits, localCostEdits, activeTab]);

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
  }, [revenueData, revForecastLookup, localRevEdits, compareRevenueData, compareYear]);

  const getAptCostMonths = useCallback((apt: Apartment) => {
    return Array.from({ length: 12 }, (_, m) => ({
      month: m,
      value: getCostData(apt.id, m),
      forecast: getCostForecast(apt.id, m),
      prevYearValue: compareYear !== null ? getCompareCost(apt.id, m) : undefined,
    }));
  }, [costsData, costForecastLookup, localCostEdits, compareCostsData, compareYear]);

  const getRevForecastEdits = useCallback((aptId: number): Record<number, string> => {
    const result: Record<number, string> = {};
    for (let m = 0; m < 12; m++) {
      result[m] = getRevForecastDisplay(aptId, m);
    }
    return result;
  }, [getRevForecastDisplay]);

  const getCostForecastEdits = useCallback((aptId: number): Record<number, string> => {
    const result: Record<number, string> = {};
    for (let m = 0; m < 12; m++) {
      result[m] = getCostForecastDisplay(aptId, m);
    }
    return result;
  }, [getCostForecastDisplay]);

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
  }, [locationApartments, revenueData, revForecastLookup, localRevEdits, compareRevenueData, compareYear]);

  const locationCostMonths = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      let value = 0, forecast = 0, prevYearValue = 0;
      for (const apt of locationApartments) {
        value += getCostData(apt.id, m);
        forecast += getCostForecast(apt.id, m);
        if (compareYear !== null) prevYearValue += getCompareCost(apt.id, m);
      }
      return { month: m, value, forecast, prevYearValue: compareYear !== null ? prevYearValue : undefined };
    });
  }, [locationApartments, costsData, costForecastLookup, localCostEdits, compareCostsData, compareYear]);

  const isLoading = revLoading || costsLoading;

  if (isLoading) {
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

  const wynikNetto = yearRevTotal.value - yearCostTotal.value;
  const formatTooltip = (value: number) => value.toLocaleString("pl-PL") + " zł";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader title="Przychody i Koszty" description="Przegląd finansowy z prognozami i porównaniem rok do roku." icon={Wallet} />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            data-testid="button-import-forecast"
          >
            {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-1.5">Import prognoz</span>
          </Button>
          <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setLocalRevEdits({}); setLocalCostEdits({}); }}>
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

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" data-testid="kpi-revenue-costs">
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
          title={`Koszty ${year}`}
          value={`${formatNum(yearCostTotal.value)} zł`}
          subtitle={yearCostTotal.forecast > 0 ? `Prognoza: ${formatNum(yearCostTotal.forecast)} zł` : undefined}
          gradient="card-gradient-orange"
          icon={TrendingDown}
          change={compareYear !== null && prevYearCostTotal > 0 ? changeIndicator(yearCostTotal.value, prevYearCostTotal) : undefined}
          testId="kpi-total-costs"
        />
        <KpiCard
          title="Wynik netto"
          value={`${formatNum(wynikNetto)} zł`}
          subtitle={wynikNetto >= 0 ? "Zysk" : "Strata"}
          gradient={wynikNetto >= 0 ? "card-gradient-green" : "card-gradient-orange"}
          icon={BarChart3}
          testId="kpi-net-result"
        />
        <KpiCard
          title="Realizacja prognozy"
          value={yearRevTotal.forecast > 0 ? formatPct(yearRevTotal.value / yearRevTotal.forecast) : "—"}
          subtitle={yearRevTotal.forecast > 0 ? `Saldo: ${formatNum(yearRevTotal.value - yearRevTotal.forecast)} zł` : "Brak prognoz"}
          gradient="card-gradient-purple"
          icon={PieChart}
          testId="kpi-realization"
        />
      </div>

      <Card data-testid="card-main-chart">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Przychody vs Koszty — {year}</CardTitle>
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
              <Bar dataKey="przychody" name="Przychody" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="koszty" name="Koszty" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="prognoza_przychody" name="Prognoza przych." stroke="hsl(var(--chart-1))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              <Line type="monotone" dataKey="wynik_netto" name="Wynik netto" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{ r: 3 }} />
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

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList data-testid="tabs-revenue-costs">
          <TabsTrigger value="revenue" data-testid="tab-revenue">
            <TrendingUp className="h-4 w-4 mr-1.5" /> Przychody
          </TabsTrigger>
          <TabsTrigger value="costs" data-testid="tab-costs">
            <TrendingDown className="h-4 w-4 mr-1.5" /> Koszty
          </TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="mt-4 space-y-4">
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
                  <Bar dataKey="przychody" name="Przychody" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
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
                  forecasts={getRevForecastEdits(apt.id)}
                  comparePrev={compareYear !== null}
                  onForecastChange={handleRevForecastChange}
                  type="revenue"
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="mt-4 space-y-4">
          <Card data-testid="card-location-cost-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Koszty — {currentLocation}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={locationChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-foreground" />
                  <YAxis tickFormatter={(v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)} tick={{ fontSize: 10 }} className="fill-foreground" />
                  <Tooltip formatter={formatTooltip} contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                  <Bar dataKey="koszty" name="Koszty" fill="hsl(var(--chart-3))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="prognoza" name="Prognoza" fill="hsl(var(--muted-foreground))" opacity={0.3} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="card-costs-accordion">
            <CardHeader className="pb-0 pt-3 px-3">
              <div className="flex items-center gap-3 px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                <div className="w-4" />
                <div className="flex-1">Apartament</div>
                <div className="w-[80px] text-center">Trend</div>
                <div className="min-w-[90px] text-right">Koszty / Prognoza</div>
                <div className="min-w-[50px] text-right">Realizacja</div>
                <div className="min-w-[60px] text-right">Saldo</div>
                {compareYear !== null && <div className="min-w-[60px] text-right">vs {compareYear}</div>}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <LocationSummaryRow
                locationName={currentLocation}
                months={locationCostMonths}
                comparePrev={compareYear !== null}
              />
              {locationApartments.map(apt => (
                <ApartmentAccordionRow
                  key={apt.id}
                  apt={apt}
                  months={getAptCostMonths(apt)}
                  forecasts={getCostForecastEdits(apt.id)}
                  comparePrev={compareYear !== null}
                  onForecastChange={handleCostForecastChange}
                  type="cost"
                />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
