import { useState, useMemo, useCallback, Fragment, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Apartment, Location, RevenueForecast } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Upload, Loader2, Wallet, LayoutGrid, Table2, Maximize2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { FullscreenWrapper, useFullscreen, FullscreenToggleButton } from "@/components/FullscreenWrapper";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { getHeatMapBg, Sparkline } from "@/components/DataVizHelpers";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

type MonthData = {
  najem: number;
  podnajem: number;
  doplaty_najem: number;
  doplaty_podnajem: number;
};

type RevenueData = Record<number, Record<number, MonthData>>;

function formatNum(v: number): string {
  if (v === 0) return "";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(v: number): string {
  if (!isFinite(v) || isNaN(v)) return "";
  return (v * 100).toFixed(0) + "%";
}

function saldoColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (v < 0) return "text-red-600 dark:text-red-400 font-semibold";
  return "";
}

function pctColor(v: number): string {
  if (!isFinite(v) || isNaN(v)) return "text-muted-foreground";
  if (v >= 1) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0.7) return "text-red-600 dark:text-red-400";
  return "text-amber-600 dark:text-amber-400";
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return "—";
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(0)}%`;
}

function changeColor(current: number, previous: number): string {
  if (previous === 0) return "text-muted-foreground";
  const diff = current - previous;
  if (diff > 0) return "text-emerald-600 dark:text-emerald-400";
  if (diff < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export default function Revenue() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const { toast } = useToast();
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const [compactView, setCompactView] = useState(true);
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const fullscreen = useFullscreen();

  const { data: apartments = [] } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"] });
  const { data: revenueData = {}, isLoading } = useQuery<RevenueData>({
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
      if (!res.ok) throw new Error("Failed to fetch forecasts");
      return res.json();
    },
  });

  const { data: compareRevenueData = {} } = useQuery<RevenueData>({
    queryKey: ["/api/revenue", compareYear],
    queryFn: async () => {
      const res = await fetch(`/api/revenue?year=${compareYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch compare revenue");
      return res.json();
    },
    enabled: compareYear !== null,
  });

  const { data: compareForecastData = [] } = useQuery<RevenueForecast[]>({
    queryKey: ["/api/revenue-forecasts", compareYear],
    queryFn: async () => {
      const res = await fetch(`/api/revenue-forecasts?year=${compareYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch compare forecasts");
      return res.json();
    },
    enabled: compareYear !== null,
  });

  const forecastLookup = useMemo(() => {
    const byLocation: Record<string, Record<number, { forecast: number; actual: number }>> = {};
    const byApartment: Record<number, Record<number, { forecast: number; actual: number }>> = {};
    for (const f of forecasts) {
      if (f.locationName && !f.apartmentId) {
        if (!byLocation[f.locationName]) byLocation[f.locationName] = {};
        byLocation[f.locationName][f.month] = { forecast: Number(f.forecast) || 0, actual: Number(f.actual) || 0 };
      }
      if (f.apartmentId) {
        if (!byApartment[f.apartmentId]) byApartment[f.apartmentId] = {};
        byApartment[f.apartmentId][f.month] = { forecast: Number(f.forecast) || 0, actual: Number(f.actual) || 0 };
      }
    }
    return { byLocation, byApartment };
  }, [forecasts]);

  const getLocationForecast = useCallback((locName: string, month: number): number => {
    return forecastLookup.byLocation[locName]?.[month]?.forecast || 0;
  }, [forecastLookup]);

  const getAptForecast = useCallback((aptId: number, month: number): number => {
    const editKey = `${aptId}-${month}`;
    if (editKey in localEdits) return parseFloat(localEdits[editKey]) || 0;
    return forecastLookup.byApartment[aptId]?.[month]?.forecast || 0;
  }, [forecastLookup, localEdits]);

  const getAptForecastDisplay = useCallback((aptId: number, month: number): string => {
    const editKey = `${aptId}-${month}`;
    if (editKey in localEdits) return localEdits[editKey];
    const dbVal = forecastLookup.byApartment[aptId]?.[month]?.forecast || 0;
    return dbVal ? String(dbVal) : "";
  }, [forecastLookup, localEdits]);

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

  const getMonthData = (aptId: number, month: number): MonthData => {
    return revenueData[aptId]?.[month] || { najem: 0, podnajem: 0, doplaty_najem: 0, doplaty_podnajem: 0 };
  };

  const toggleApartment = (aptId: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(aptId)) next.delete(aptId);
      else next.add(aptId);
      return next;
    });
  };

  const forecastMutation = useMutation({
    mutationFn: async (data: { year: number; month: number; apartmentId: number; forecast: string }) => {
      const res = await apiRequest("PUT", "/api/revenue-forecasts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenue-forecasts", year] });
    },
  });

  const handleForecastChange = useCallback((aptId: number, month: number, value: string) => {
    const editKey = `${aptId}-${month}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    if (debounceTimers.current[editKey]) clearTimeout(debounceTimers.current[editKey]);
    debounceTimers.current[editKey] = setTimeout(() => {
      forecastMutation.mutate({
        year,
        month,
        apartmentId: aptId,
        forecast: String(parseFloat(value) || 0),
      });
    }, 800);
  }, [year, forecastMutation]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/import-revenue-forecasts");
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenue-forecasts", year] });
      toast({
        title: "Import zakończony",
        description: result.message || "Dane prognoz zostały zaimportowane",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Błąd importu",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    setLocalEdits({});
  }, [forecasts]);

  const handleYearChange = (y: string) => {
    setYear(Number(y));
    setLocalEdits({});
  };

  const allActiveApartments = useMemo(() => {
    return apartments.filter(a => a.active !== false);
  }, [apartments]);

  const globalTotals = useMemo(() => {
    const razem = forecastLookup.byLocation["RAZEM"];
    const totals: Record<number, { prognoza: number; przychody: number; najem: number; podnajem: number; doplaty_najem: number; doplaty_podnajem: number }> = {};
    for (let m = 0; m < 12; m++) {
      let najem = 0, podnajem = 0, dn = 0, dpn = 0;
      for (const apt of allActiveApartments) {
        const md = getMonthData(apt.id, m);
        najem += md.najem;
        podnajem += md.podnajem;
        dn += md.doplaty_najem;
        dpn += md.doplaty_podnajem;
      }
      const prognoza = razem?.[m]?.forecast || 0;
      totals[m] = { prognoza, przychody: najem + podnajem, najem, podnajem, doplaty_najem: dn, doplaty_podnajem: dpn };
    }
    return totals;
  }, [allActiveApartments, revenueData, forecastLookup]);

  const globalYearTotals = useMemo(() => {
    let prognoza = 0, przychody = 0, najem = 0, podnajem = 0, doplaty = 0;
    for (let m = 0; m < 12; m++) {
      const t = globalTotals[m];
      prognoza += t.prognoza;
      przychody += t.przychody;
      najem += t.najem;
      podnajem += t.podnajem;
      doplaty += t.doplaty_najem + t.doplaty_podnajem;
    }
    return { prognoza, przychody, najem, podnajem, doplaty };
  }, [globalTotals]);

  const locationTotals = useMemo(() => {
    const locForecasts = forecastLookup.byLocation[currentLocation];
    const totals: Record<number, { prognoza: number; przychody: number; najem: number; podnajem: number; doplaty_najem: number; doplaty_podnajem: number }> = {};
    for (let m = 0; m < 12; m++) {
      let najem = 0, podnajem = 0, dn = 0, dpn = 0;
      for (const apt of locationApartments) {
        const md = getMonthData(apt.id, m);
        najem += md.najem;
        podnajem += md.podnajem;
        dn += md.doplaty_najem;
        dpn += md.doplaty_podnajem;
      }
      const prognoza = locForecasts?.[m]?.forecast || 0;
      totals[m] = { prognoza, przychody: najem + podnajem, najem, podnajem, doplaty_najem: dn, doplaty_podnajem: dpn };
    }
    return totals;
  }, [locationApartments, revenueData, forecastLookup, currentLocation]);

  const getCompareMonthData = (aptId: number, month: number): MonthData => {
    return compareRevenueData[aptId]?.[month] || { najem: 0, podnajem: 0, doplaty_najem: 0, doplaty_podnajem: 0 };
  };

  const compareLocationTotals = useMemo(() => {
    if (compareYear === null) return null;
    const totals: Record<number, { przychody: number; najem: number; podnajem: number }> = {};
    for (let m = 0; m < 12; m++) {
      let najem = 0, podnajem = 0;
      for (const apt of locationApartments) {
        const md = getCompareMonthData(apt.id, m);
        najem += md.najem;
        podnajem += md.podnajem;
      }
      totals[m] = { przychody: najem + podnajem, najem, podnajem };
    }
    return totals;
  }, [locationApartments, compareRevenueData, compareYear]);

  const compareGlobalTotals = useMemo(() => {
    if (compareYear === null) return null;
    let przychody = 0, najem = 0, podnajem = 0;
    for (const apt of allActiveApartments) {
      for (let m = 0; m < 12; m++) {
        const md = getCompareMonthData(apt.id, m);
        najem += md.najem;
        podnajem += md.podnajem;
        przychody += md.najem + md.podnajem;
      }
    }
    return { przychody, najem, podnajem };
  }, [allActiveApartments, compareRevenueData, compareYear]);

  const revenueHeatMax = useMemo(() => {
    let max = 0;
    for (const apt of locationApartments) {
      for (let m = 0; m < 12; m++) {
        const md = getMonthData(apt.id, m);
        const rev = md.najem + md.podnajem;
        if (rev > max) max = rev;
      }
    }
    return max;
  }, [locationApartments, revenueData]);

  const getAptSparklineData = useCallback((aptId: number): number[] => {
    return Array.from({ length: 12 }, (_, m) => {
      const md = getMonthData(aptId, m);
      return md.najem + md.podnajem;
    });
  }, [revenueData]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader title="Przychody" description="Przegląd przychodów z najmu i podnajmu." icon={Wallet} />
        <div className="flex items-center gap-2 flex-wrap">
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCompactView(!compactView)}
            title={compactView ? "Widok pełny" : "Widok kompaktowy"}
            data-testid="button-toggle-view"
          >
            {compactView ? <Table2 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            data-testid="button-import-forecast"
          >
            {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-1.5">Import prognozy z Excel</span>
          </Button>
          <Select value={String(year)} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[100px]" data-testid="select-revenue-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: currentYear - 2022 + 2 }, (_, i) => 2022 + i).map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={compareYear !== null ? String(compareYear) : ""} onValueChange={(v) => setCompareYear(v === "" ? null : Number(v))}>
            <SelectTrigger className="w-[150px]" data-testid="select-compare-year">
              <SelectValue placeholder="Porównaj z..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">— Brak —</SelectItem>
              {Array.from({ length: currentYear - 2022 + 2 }, (_, i) => 2022 + i)
                .filter(y => y !== year)
                .map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card data-testid="card-global-summary">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Podsumowanie łączne — wszystkie lokalizacje</span>
            {globalYearTotals.prognoza > 0 && (() => {
              const pct = globalYearTotals.przychody / globalYearTotals.prognoza;
              return (
                <Badge variant="outline" className={`text-[10px] ${pctColor(pct)}`}>
                  Realizacja: {formatPct(pct)}
                </Badge>
              );
            })()}
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Przychody ogółem</div>
              <div className="text-lg font-bold tabular-nums" data-testid="text-global-revenue">{formatNum(globalYearTotals.przychody)} zł</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Prognoza</div>
              <div className="text-lg font-medium tabular-nums text-muted-foreground" data-testid="text-global-forecast">{globalYearTotals.prognoza > 0 ? formatNum(globalYearTotals.prognoza) + " zł" : "—"}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Najem</div>
              <div className="text-sm font-medium tabular-nums" data-testid="text-global-najem">{formatNum(globalYearTotals.najem)} zł</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Podnajem</div>
              <div className="text-sm font-medium tabular-nums" data-testid="text-global-podnajem">{formatNum(globalYearTotals.podnajem)} zł</div>
            </div>
            {globalYearTotals.prognoza > 0 && (
              <div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo</div>
                <div className={`text-sm font-semibold tabular-nums ${saldoColor(globalYearTotals.przychody - globalYearTotals.prognoza)}`} data-testid="text-global-saldo">
                  {formatNum(globalYearTotals.przychody - globalYearTotals.prognoza)} zł
                </div>
              </div>
            )}
          </div>
          {compareYear !== null && compareGlobalTotals && (
            <div className="mt-3 pt-3 border-t border-border" data-testid="global-compare-summary">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Porównanie z {compareYear}</span>
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Przychody {compareYear}</div>
                  <div className="text-sm tabular-nums" data-testid="text-compare-global-revenue">{formatNum(compareGlobalTotals.przychody)} zł</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Zmiana r/r</div>
                  <div className={`text-sm font-semibold tabular-nums ${changeColor(globalYearTotals.przychody, compareGlobalTotals.przychody)}`} data-testid="text-compare-global-change">
                    {pctChange(globalYearTotals.przychody, compareGlobalTotals.przychody)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Najem {compareYear}</div>
                  <div className="text-sm tabular-nums" data-testid="text-compare-global-najem">{formatNum(compareGlobalTotals.najem)} zł</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Podnajem {compareYear}</div>
                  <div className="text-sm tabular-nums" data-testid="text-compare-global-podnajem">{formatNum(compareGlobalTotals.podnajem)} zł</div>
                </div>
              </div>
            </div>
          )}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-12 mt-3 pt-3 border-t border-border">
            {MONTHS.map((mName, mi) => {
              const t = globalTotals[mi];
              const przychody = t.przychody;
              const now = new Date();
              const isCurrentMonth = year === now.getFullYear() && mi === now.getMonth();
              return (
                <div key={mi} className={`text-center ${isCurrentMonth ? "ring-1 ring-primary/30 rounded-md p-1" : "p-1"}`} data-testid={`global-month-${mi}`}>
                  <div className="text-[10px] text-muted-foreground font-medium">{mName}</div>
                  <div className="text-xs font-bold tabular-nums">{przychody > 0 ? formatNum(przychody) : "—"}</div>
                  {t.prognoza > 0 && (
                    <div className={`text-[9px] tabular-nums ${pctColor(przychody / t.prognoza)}`}>{formatPct(przychody / t.prognoza)}</div>
                  )}
                </div>
              );
            })}
          </div>
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

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" data-testid="grid-revenue-cards">
        {MONTHS.map((mName, mi) => {
          const t = locationTotals[mi];
          const pct = t.prognoza > 0 ? t.przychody / t.prognoza : 0;
          const saldo = t.przychody - t.prognoza;
          const doplaty = t.doplaty_najem + t.doplaty_podnajem;
          const now = new Date();
          const isCurrentMonth = year === now.getFullYear() && mi === now.getMonth();
          const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && mi < now.getMonth());
          return (
            <Card key={mi} className={isCurrentMonth ? "border-primary/30" : isPastMonth ? "opacity-75" : ""} data-testid={`card-revenue-month-${mi}`}>
              <CardHeader className="pb-1 pt-3 px-3">
                <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                  <span>{mName}</span>
                  {isCurrentMonth && <Badge variant="outline" className="text-[10px]">Bieżący</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 pb-3 px-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Prognoza</span>
                  <span className="font-medium tabular-nums">{t.prognoza > 0 ? formatNum(t.prognoza) + " zł" : "—"}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Przychody</span>
                  <span className="font-bold tabular-nums">{t.przychody > 0 ? formatNum(t.przychody) + " zł" : "—"}</span>
                </div>
                {(t.najem > 0 || t.podnajem > 0) && (
                  <div className="pl-2 border-l-2 border-muted space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Najem</span>
                      <span className="tabular-nums">{formatNum(t.najem)} zł</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Podnajem</span>
                      <span className="tabular-nums">{formatNum(t.podnajem)} zł</span>
                    </div>
                  </div>
                )}
                {t.prognoza > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Realizacja</span>
                    <span className={`font-bold tabular-nums ${pctColor(pct)}`}>{formatPct(pct)}</span>
                  </div>
                )}
                {saldo !== 0 && t.prognoza > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Saldo</span>
                    <span className={`tabular-nums ${saldoColor(saldo)}`}>{formatNum(saldo)} zł</span>
                  </div>
                )}
                {doplaty > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-700 dark:text-amber-400">Dopłaty</span>
                    <span className="tabular-nums text-amber-700 dark:text-amber-400">{formatNum(doplaty)} zł</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <FullscreenWrapper title={`Przychody ${year}`} toolbar={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCompactView(!compactView)} title={compactView ? "Widok pełny" : "Widok kompaktowy"}>
            {compactView ? <Table2 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </Button>
        </div>
      } isFullscreen={fullscreen.isFullscreen} onExit={fullscreen.exit}>
      <div className="rounded-md border border-border bg-card overflow-x-auto" data-testid="table-revenue">
        <table className="w-full text-xs border-collapse">
          <thead>
            {compactView ? (
              <tr className="bg-muted/30">
                <th className="sticky left-0 z-10 bg-muted/30 text-left px-2 py-1 border-r-2 border-b border-border min-w-[180px]">Apartament</th>
                {MONTHS.map((m, i) => (
                  <th key={i} className="px-1 py-1 border-r border-b border-border text-center font-bold text-muted-foreground text-[10px] w-[70px] min-w-[70px]">{m}</th>
                ))}
                <th className="px-1 py-1 border-b border-border text-center font-bold text-muted-foreground text-[10px] w-[80px] min-w-[80px]">RAZEM</th>
              </tr>
            ) : (
              <>
                <tr className="bg-muted/30">
                  <th className="sticky left-0 z-10 bg-muted/30 text-left px-2 py-1 border-r-2 border-b border-border min-w-[180px]" rowSpan={2}>Apartament</th>
                  {MONTHS.map((m, i) => (
                    <th key={i} colSpan={7} className="px-1 py-1 border-r-2 border-b border-border text-center font-bold text-muted-foreground text-[10px]">{m}</th>
                  ))}
                  <th colSpan={7} className="px-1 py-1 border-b border-border text-center font-bold text-muted-foreground text-[10px]">RAZEM</th>
                </tr>
                <tr className="bg-muted/50">
                  {[...Array(13)].map((_, gi) => (
                    <Fragment key={gi}>
                      <th className="px-1 py-1 border-r border-b border-border text-center w-[55px] min-w-[55px] text-[9px] bg-blue-50/50 dark:bg-blue-950/20">PROGNOZA</th>
                      <th className="px-1 py-1 border-r border-b border-border text-center w-[55px] min-w-[55px] text-[9px] font-bold">PRZYCHODY</th>
                      <th className="px-1 py-1 border-r border-b border-border text-center w-[50px] min-w-[50px] text-[9px] text-muted-foreground">NAJEM</th>
                      <th className="px-1 py-1 border-r border-b border-border text-center w-[50px] min-w-[50px] text-[9px] text-muted-foreground">PODNAJEM</th>
                      <th className="px-1 py-1 border-r border-b border-border text-center w-[35px] min-w-[35px] text-[9px]">%</th>
                      <th className="px-1 py-1 border-r border-b border-border text-center w-[55px] min-w-[55px] text-[9px]">SALDO</th>
                      <th className={`px-1 py-1 ${gi < 12 ? "border-r-2" : ""} border-b border-border text-center w-[55px] min-w-[55px] text-[9px] text-amber-700 dark:text-amber-400`}>DOPŁATY</th>
                    </Fragment>
                  ))}
                </tr>
              </>
            )}
          </thead>
          <tbody>
            <tr className="bg-muted/40 font-semibold">
              <td className="sticky left-0 z-10 bg-muted/40 px-2 py-1.5 border-r-2 border-b border-border font-bold uppercase tracking-wide">
                {currentLocation}
              </td>
              {compactView ? (
                <>
                  {MONTHS.map((_, mi) => {
                    const t = locationTotals[mi];
                    const pct = t.prognoza > 0 ? t.przychody / t.prognoza : 0;
                    return (
                      <td key={mi} className={`border-r border-b border-border px-1 py-1 text-right tabular-nums font-bold ${getHeatMapBg(t.przychody, revenueHeatMax * locationApartments.length, "revenue")}`}>
                        {formatNum(t.przychody)}
                        {t.prognoza > 0 && <div className={`text-[9px] font-normal ${pctColor(pct)}`}>{formatPct(pct)}</div>}
                      </td>
                    );
                  })}
                  {(() => {
                    let tp = 0, trev = 0;
                    for (let m = 0; m < 12; m++) { tp += locationTotals[m].prognoza; trev += locationTotals[m].przychody; }
                    const pct = tp > 0 ? trev / tp : 0;
                    return (
                      <td className="border-b border-border px-1 py-1 text-right tabular-nums font-bold bg-muted/20">
                        {formatNum(trev)}
                        {tp > 0 && <div className={`text-[9px] font-normal ${pctColor(pct)}`}>{formatPct(pct)}</div>}
                      </td>
                    );
                  })()}
                </>
              ) : (
                <>
                  {MONTHS.map((_, mi) => {
                    const t = locationTotals[mi];
                    const pct = t.prognoza > 0 ? t.przychody / t.prognoza : 0;
                    const saldo = t.przychody - t.prognoza;
                    const doplaty = t.doplaty_najem + t.doplaty_podnajem;
                    return (
                      <Fragment key={mi}>
                        <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-blue-50/50 dark:bg-blue-950/20">{formatNum(t.prognoza)}</td>
                        <td className={`border-r border-b border-border px-1 py-1 text-right tabular-nums font-bold ${getHeatMapBg(t.przychody, revenueHeatMax * locationApartments.length, "revenue")}`}>{formatNum(t.przychody)}</td>
                        <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-muted-foreground">{formatNum(t.najem)}</td>
                        <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-muted-foreground">{formatNum(t.podnajem)}</td>
                        <td className={`border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] ${pctColor(pct)}`}>{formatPct(pct)}</td>
                        <td className={`border-r border-b border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                        <td className="border-r-2 border-b border-border px-1 py-1 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatNum(doplaty)}</td>
                      </Fragment>
                    );
                  })}
                  {(() => {
                    let tp = 0, trev = 0, tn = 0, tpn = 0, tdn = 0, tdpn = 0;
                    for (let m = 0; m < 12; m++) {
                      const t = locationTotals[m];
                      tp += t.prognoza; trev += t.przychody; tn += t.najem; tpn += t.podnajem; tdn += t.doplaty_najem; tdpn += t.doplaty_podnajem;
                    }
                    const pct = tp > 0 ? trev / tp : 0;
                    const saldo = trev - tp;
                    return (
                      <>
                        <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-blue-50/50 dark:bg-blue-950/20">{formatNum(tp)}</td>
                        <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums font-bold">{formatNum(trev)}</td>
                        <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-muted-foreground">{formatNum(tn)}</td>
                        <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-muted-foreground">{formatNum(tpn)}</td>
                        <td className={`border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] ${pctColor(pct)}`}>{formatPct(pct)}</td>
                        <td className={`border-r border-b border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                        <td className="border-b border-border px-1 py-1 text-right tabular-nums text-amber-700 dark:text-amber-400">{formatNum(tdn + tdpn)}</td>
                      </>
                    );
                  })()}
                </>
              )}
            </tr>

            {compareYear !== null && compareLocationTotals && compactView && (
              <tr className="bg-amber-50/30 dark:bg-amber-950/20" data-testid="row-compare-location">
                <td className="sticky left-0 z-10 bg-amber-50/30 dark:bg-amber-950/20 px-2 py-1 border-r-2 border-b border-border text-[10px] font-medium text-muted-foreground">
                  {compareYear} (porównanie)
                </td>
                {MONTHS.map((_, mi) => {
                  const ct = compareLocationTotals[mi];
                  const mainT = locationTotals[mi];
                  return (
                    <td key={mi} className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px]">
                      {formatNum(ct.przychody)}
                      <div className={`text-[9px] font-semibold ${changeColor(mainT.przychody, ct.przychody)}`}>
                        {pctChange(mainT.przychody, ct.przychody)}
                      </div>
                    </td>
                  );
                })}
                {(() => {
                  let compareTotal = 0, mainTotal = 0;
                  for (let m = 0; m < 12; m++) {
                    compareTotal += compareLocationTotals[m].przychody;
                    mainTotal += locationTotals[m].przychody;
                  }
                  return (
                    <td className="border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/20">
                      {formatNum(compareTotal)}
                      <div className={`text-[9px] font-semibold ${changeColor(mainTotal, compareTotal)}`}>
                        {pctChange(mainTotal, compareTotal)}
                      </div>
                    </td>
                  );
                })()}
              </tr>
            )}

            {locationApartments.map(apt => {
              const isCollapsed = collapsed.has(apt.id);
              const aptTotals = { prognoza: 0, przychody: 0, najem: 0, podnajem: 0, doplaty_najem: 0, doplaty_podnajem: 0 };
              for (let m = 0; m < 12; m++) {
                const md = getMonthData(apt.id, m);
                const forecast = getAptForecast(apt.id, m);
                aptTotals.prognoza += forecast;
                aptTotals.najem += md.najem;
                aptTotals.podnajem += md.podnajem;
                aptTotals.przychody += md.najem + md.podnajem;
                aptTotals.doplaty_najem += md.doplaty_najem;
                aptTotals.doplaty_podnajem += md.doplaty_podnajem;
              }

              return (
                <Fragment key={apt.id}>
                  <tr className="hover-elevate" data-testid={`row-revenue-${apt.id}`}>
                    <td
                      className="sticky left-0 z-10 bg-card px-2 py-0.5 border-r-2 border-b border-border font-medium cursor-pointer"
                      onClick={() => toggleApartment(apt.id)}
                    >
                      <span className="flex items-center gap-1">
                        {isCollapsed ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        <span className="flex-1 min-w-0 truncate">{apt.name}</span>
                        <Sparkline data={getAptSparklineData(apt.id)} width={60} height={16} showDots />
                      </span>
                    </td>
                    {compactView ? (
                      <>
                        {MONTHS.map((_, mi) => {
                          const md = getMonthData(apt.id, mi);
                          const forecast = getAptForecast(apt.id, mi);
                          const przychody = md.najem + md.podnajem;
                          const pct = forecast > 0 ? przychody / forecast : 0;
                          return (
                            <td key={mi} className={`border-r border-b border-border px-1 py-0.5 text-right tabular-nums font-semibold ${getHeatMapBg(przychody, revenueHeatMax, "revenue")}`}>
                              {formatNum(przychody)}
                              {forecast > 0 && <div className={`text-[9px] font-normal ${pctColor(pct)}`}>{formatPct(pct)}</div>}
                            </td>
                          );
                        })}
                        <td className="border-b border-border px-1 py-0.5 text-right tabular-nums font-semibold bg-muted/20">
                          {formatNum(aptTotals.przychody)}
                          {aptTotals.prognoza > 0 && <div className={`text-[9px] font-normal ${pctColor(aptTotals.przychody / aptTotals.prognoza)}`}>{formatPct(aptTotals.przychody / aptTotals.prognoza)}</div>}
                        </td>
                      </>
                    ) : (
                      <>
                        {MONTHS.map((_, mi) => {
                          const md = getMonthData(apt.id, mi);
                          const forecast = getAptForecast(apt.id, mi);
                          const przychody = md.najem + md.podnajem;
                          const pct = forecast > 0 ? przychody / forecast : 0;
                          const saldo = przychody - forecast;
                          const doplaty = md.doplaty_najem + md.doplaty_podnajem;
                          return (
                            <Fragment key={mi}>
                              <td className="border-r border-b border-border px-0 py-0 bg-blue-50/50 dark:bg-blue-950/20">
                                <input
                                  type="number"
                                  className="w-full h-full px-1 py-0.5 text-right text-[10px] tabular-nums bg-transparent outline-none focus:bg-primary/10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={getAptForecastDisplay(apt.id, mi)}
                                  onChange={(e) => handleForecastChange(apt.id, mi, e.target.value)}
                                  data-testid={`input-forecast-${apt.id}-${mi}`}
                                />
                              </td>
                              <td className={`border-r border-b border-border px-1 py-0.5 text-right tabular-nums font-semibold ${getHeatMapBg(przychody, revenueHeatMax, "revenue")}`}>{formatNum(przychody)}</td>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-muted-foreground text-[10px]">{formatNum(md.najem)}</td>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-muted-foreground text-[10px]">{formatNum(md.podnajem)}</td>
                              <td className={`border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] ${pctColor(pct)}`}>{formatPct(pct)}</td>
                              <td className={`border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                              <td className="border-r-2 border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] text-amber-700 dark:text-amber-400">{formatNum(doplaty)}</td>
                            </Fragment>
                          );
                        })}
                        {(() => {
                          const pct = aptTotals.prognoza > 0 ? aptTotals.przychody / aptTotals.prognoza : 0;
                          const saldo = aptTotals.przychody - aptTotals.prognoza;
                          const doplaty = aptTotals.doplaty_najem + aptTotals.doplaty_podnajem;
                          return (
                            <>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] bg-blue-50/50 dark:bg-blue-950/20">{formatNum(aptTotals.prognoza)}</td>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums font-semibold">{formatNum(aptTotals.przychody)}</td>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-muted-foreground text-[10px]">{formatNum(aptTotals.najem)}</td>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-muted-foreground text-[10px]">{formatNum(aptTotals.podnajem)}</td>
                              <td className={`border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] ${pctColor(pct)}`}>{formatPct(pct)}</td>
                              <td className={`border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                              <td className="border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] text-amber-700 dark:text-amber-400">{formatNum(doplaty)}</td>
                            </>
                          );
                        })()}
                      </>
                    )}
                  </tr>

                  {compareYear !== null && compactView && (
                    <tr className="bg-amber-50/30 dark:bg-amber-950/20" data-testid={`row-compare-apt-${apt.id}`}>
                      <td className="sticky left-0 z-10 bg-amber-50/30 dark:bg-amber-950/20 pl-6 pr-2 py-0.5 border-r-2 border-b border-border text-[9px] text-muted-foreground">
                        {compareYear}
                      </td>
                      {MONTHS.map((_, mi) => {
                        const cmd = getCompareMonthData(apt.id, mi);
                        const md = getMonthData(apt.id, mi);
                        const comparePrzychody = cmd.najem + cmd.podnajem;
                        const mainPrzychody = md.najem + md.podnajem;
                        return (
                          <td key={mi} className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[9px]">
                            {formatNum(comparePrzychody)}
                            <div className={`text-[8px] font-semibold ${changeColor(mainPrzychody, comparePrzychody)}`}>
                              {pctChange(mainPrzychody, comparePrzychody)}
                            </div>
                          </td>
                        );
                      })}
                      {(() => {
                        let compareTotal = 0, mainTotal = 0;
                        for (let m = 0; m < 12; m++) {
                          const cmd = getCompareMonthData(apt.id, m);
                          const md = getMonthData(apt.id, m);
                          compareTotal += cmd.najem + cmd.podnajem;
                          mainTotal += md.najem + md.podnajem;
                        }
                        return (
                          <td className="border-b border-border px-1 py-0.5 text-right tabular-nums text-[9px] bg-muted/20">
                            {formatNum(compareTotal)}
                            <div className={`text-[8px] font-semibold ${changeColor(mainTotal, compareTotal)}`}>
                              {pctChange(mainTotal, compareTotal)}
                            </div>
                          </td>
                        );
                      })()}
                    </tr>
                  )}

                  {isCollapsed && !compactView && (
                    <>
                      <tr className="bg-muted/10">
                        <td className="sticky left-0 z-10 bg-muted/10 pl-8 pr-2 py-0.5 border-r-2 border-b border-border text-muted-foreground text-[10px]">Najem</td>
                        {MONTHS.map((_, mi) => {
                          const md = getMonthData(apt.id, mi);
                          return (
                            <Fragment key={mi}>
                              <td className="border-r border-b border-border" colSpan={2}></td>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px]">{formatNum(md.najem)}</td>
                              <td className="border-r border-b border-border" colSpan={2}></td>
                              <td className="border-r border-b border-border"></td>
                              <td className="border-r-2 border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] text-amber-700 dark:text-amber-400">{formatNum(md.doplaty_najem)}</td>
                            </Fragment>
                          );
                        })}
                        <td className="border-r border-b border-border" colSpan={2}></td>
                        <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px]">{formatNum(aptTotals.najem)}</td>
                        <td className="border-r border-b border-border" colSpan={2}></td>
                        <td className="border-r border-b border-border"></td>
                        <td className="border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] text-amber-700 dark:text-amber-400">{formatNum(aptTotals.doplaty_najem)}</td>
                      </tr>
                      <tr className="bg-muted/10">
                        <td className="sticky left-0 z-10 bg-muted/10 pl-8 pr-2 py-0.5 border-r-2 border-b border-border text-muted-foreground text-[10px]">Podnajem</td>
                        {MONTHS.map((_, mi) => {
                          const md = getMonthData(apt.id, mi);
                          return (
                            <Fragment key={mi}>
                              <td className="border-r border-b border-border" colSpan={2}></td>
                              <td className="border-r border-b border-border"></td>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px]">{formatNum(md.podnajem)}</td>
                              <td className="border-r border-b border-border" colSpan={2}></td>
                              <td className="border-r-2 border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] text-amber-700 dark:text-amber-400">{formatNum(md.doplaty_podnajem)}</td>
                            </Fragment>
                          );
                        })}
                        <td className="border-r border-b border-border" colSpan={2}></td>
                        <td className="border-r border-b border-border"></td>
                        <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px]">{formatNum(aptTotals.podnajem)}</td>
                        <td className="border-r border-b border-border" colSpan={2}></td>
                        <td className="border-r border-b border-border"></td>
                        <td className="border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] text-amber-700 dark:text-amber-400">{formatNum(aptTotals.doplaty_podnajem)}</td>
                      </tr>
                    </>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      </FullscreenWrapper>

      {(() => {
        const chartData = MONTHS.map((mName, mi) => {
          const t = locationTotals[mi];
          return {
            name: mName,
            prognoza: Math.round(t.prognoza),
            najem: Math.round(t.najem),
            podnajem: Math.round(t.podnajem),
          };
        });
        const formatTooltip = (value: number) => value.toLocaleString("pl-PL") + " zł";
        return (
          <Card data-testid="card-revenue-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Realizacja prognozy przychodów — {currentLocation}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-foreground" />
                  <YAxis tickFormatter={(v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)} tick={{ fontSize: 11 }} className="fill-foreground" />
                  <Tooltip
                    formatter={formatTooltip}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Bar dataKey="prognoza" name="Prognoza" fill="hsl(var(--muted-foreground))" opacity={0.35} radius={[3, 3, 0, 0]} />
                  <Bar dataKey="najem" name="Najem" stackId="actual" fill="hsl(var(--chart-1))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="podnajem" name="Podnajem" stackId="actual" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}

      {compareYear !== null && compareLocationTotals && (() => {
        const lineData = MONTHS.map((mName, mi) => {
          const mainT = locationTotals[mi];
          const compareT = compareLocationTotals[mi];
          return {
            name: mName,
            [String(year)]: Math.round(mainT.przychody),
            [String(compareYear)]: Math.round(compareT.przychody),
          };
        });
        const formatTooltip = (value: number) => value.toLocaleString("pl-PL") + " zł";
        return (
          <Card data-testid="card-yoy-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Porównanie rok do roku: {year} vs {compareYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={lineData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-foreground" />
                  <YAxis tickFormatter={(v: number) => v >= 1000 ? (v / 1000).toFixed(0) + "k" : String(v)} tick={{ fontSize: 11 }} className="fill-foreground" />
                  <Tooltip
                    formatter={formatTooltip}
                    contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontSize: "12px" }}
                    labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <Line type="monotone" dataKey={String(year)} name={`${year} — przychody`} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey={String(compareYear)} name={`${compareYear} — przychody`} stroke="hsl(var(--chart-3))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
