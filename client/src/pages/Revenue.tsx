import { useState, useMemo, useCallback, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Apartment, Location } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Upload, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

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

function forecastStorageKey(year: number) { return `forecast-data-${year}`; }

function loadForecastData(year: number): Record<string, Record<number, { p: number; r: number }>> {
  try {
    const raw = localStorage.getItem(forecastStorageKey(year));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveForecastData(year: number, data: Record<string, Record<number, { p: number; r: number }>>) {
  localStorage.setItem(forecastStorageKey(year), JSON.stringify(data));
}

export default function Revenue() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [activeLocation, setActiveLocation] = useState<string>("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [forecastData, setForecastData] = useState(() => loadForecastData(currentYear));
  const { toast } = useToast();

  const { data: apartments = [] } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"] });
  const { data: revenueData = {}, isLoading } = useQuery<RevenueData>({
    queryKey: [`/api/revenue?year=${year}`],
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

  const getMonthData = (aptId: number, month: number): MonthData => {
    return revenueData[aptId]?.[month] || { najem: 0, podnajem: 0, doplaty_najem: 0, doplaty_podnajem: 0 };
  };

  const getForecast = (aptId: number, month: number): number => {
    return forecastData[String(aptId)]?.[month]?.p || 0;
  };

  const toggleApartment = (aptId: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(aptId)) next.delete(aptId);
      else next.add(aptId);
      return next;
    });
  };

  const handleForecastChange = useCallback((aptId: number, month: number, value: string) => {
    setForecastData(prev => {
      const next = { ...prev };
      const key = String(aptId);
      if (!next[key]) next[key] = {};
      if (!next[key][month]) next[key][month] = { p: 0, r: 0 };
      next[key][month] = { ...next[key][month], p: parseFloat(value) || 0 };
      saveForecastData(year, next);
      return next;
    });
  }, [year]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/import-forecast");
      return res.json();
    },
    onSuccess: (result: { data: Record<number, Record<number, Record<number, { p: number; r: number }>>>; summary: Record<number, number>; message: string }) => {
      let totalImported = 0;
      for (const [yr, apts] of Object.entries(result.data)) {
        const yearNum = Number(yr);
        const existing = loadForecastData(yearNum);
        const merged = { ...existing };
        for (const [aptId, months] of Object.entries(apts as Record<string, Record<number, { p: number; r: number }>>)) {
          if (!merged[aptId]) merged[aptId] = {};
          for (const [month, val] of Object.entries(months as Record<number, { p: number; r: number }>)) {
            merged[aptId][Number(month)] = val;
            totalImported++;
          }
        }
        saveForecastData(yearNum, merged);
      }
      setForecastData(loadForecastData(year));
      const yearsList = Object.keys(result.summary).sort().join(", ");
      toast({
        title: "Import zakończony",
        description: `Zaimportowano dane prognozy dla lat: ${yearsList} (${totalImported} rekordów)`,
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

  const handleYearChange = (y: string) => {
    const newYear = Number(y);
    setYear(newYear);
    setForecastData(loadForecastData(newYear));
  };

  const locationTotals = useMemo(() => {
    const totals: Record<number, { prognoza: number; przychody: number; najem: number; podnajem: number; doplaty_najem: number; doplaty_podnajem: number }> = {};
    for (let m = 0; m < 12; m++) {
      totals[m] = { prognoza: 0, przychody: 0, najem: 0, podnajem: 0, doplaty_najem: 0, doplaty_podnajem: 0 };
      for (const apt of locationApartments) {
        const md = getMonthData(apt.id, m);
        const forecast = getForecast(apt.id, m);
        totals[m].prognoza += forecast;
        totals[m].najem += md.najem;
        totals[m].podnajem += md.podnajem;
        totals[m].przychody += md.najem + md.podnajem;
        totals[m].doplaty_najem += md.doplaty_najem;
        totals[m].doplaty_podnajem += md.doplaty_podnajem;
      }
    }
    return totals;
  }, [locationApartments, revenueData, forecastData, year]);

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
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-revenue-title">Przychody</h1>
          <p className="text-muted-foreground text-sm">Zestawienie prognozy z przychodami w podziale na najem i podnajem</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      </div>

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

      <div className="rounded-md border border-border bg-card overflow-x-auto" data-testid="table-revenue">
        <table className="w-full text-xs border-collapse">
          <thead>
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
          </thead>
          <tbody>
            <tr className="bg-muted/40 font-semibold">
              <td className="sticky left-0 z-10 bg-muted/40 px-2 py-1.5 border-r-2 border-b border-border font-bold uppercase tracking-wide">
                {currentLocation}
              </td>
              {MONTHS.map((_, mi) => {
                const t = locationTotals[mi];
                const pct = t.prognoza > 0 ? t.przychody / t.prognoza : 0;
                const saldo = t.przychody - t.prognoza;
                const doplaty = t.doplaty_najem + t.doplaty_podnajem;
                return (
                  <Fragment key={mi}>
                    <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-blue-50/50 dark:bg-blue-950/20">{formatNum(t.prognoza)}</td>
                    <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums font-bold">{formatNum(t.przychody)}</td>
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
            </tr>

            {locationApartments.map(apt => {
              const isCollapsed = collapsed.has(apt.id);
              const aptTotals = { prognoza: 0, przychody: 0, najem: 0, podnajem: 0, doplaty_najem: 0, doplaty_podnajem: 0 };
              for (let m = 0; m < 12; m++) {
                const md = getMonthData(apt.id, m);
                const forecast = getForecast(apt.id, m);
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
                        {apt.name}
                      </span>
                    </td>
                    {MONTHS.map((_, mi) => {
                      const md = getMonthData(apt.id, mi);
                      const forecast = getForecast(apt.id, mi);
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
                              value={forecast || ""}
                              onChange={(e) => handleForecastChange(apt.id, mi, e.target.value)}
                              data-testid={`input-forecast-${apt.id}-${mi}`}
                            />
                          </td>
                          <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums font-semibold">{formatNum(przychody)}</td>
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
                  </tr>

                  {isCollapsed && (
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
                  <Bar dataKey="najem" name="Najem" stackId="actual" fill="hsl(210 80% 55%)" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="podnajem" name="Podnajem" stackId="actual" fill="hsl(160 60% 45%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
