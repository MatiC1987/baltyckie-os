import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Location } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, ChevronDown, ChevronRight, TrendingUp, TrendingDown, ArrowUp, ArrowDown, Copy, Sparkles } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CopyForecastDialog } from "@/components/v2/CopyForecastDialog";
import { AutoFillDialog } from "@/components/v2/AutoFillDialog";
import { ApartmentTrendSheet } from "@/components/v2/ApartmentTrendSheet";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

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

function pctStr(actual: number, forecast: number): string {
  if (forecast === 0) return "—";
  const pct = ((actual - forecast) / forecast) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

function LocationGroup({ locationName, apartments, currentMonth, onApartmentClick }: {
  locationName: string;
  apartments: AptRevenueData[];
  currentMonth: number;
  onApartmentClick?: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);

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
          Plan: {formatNum(yearTotalFc)} PLN | Realizacja: {formatNum(yearTotalAct)} PLN
        </span>
      </button>

      {open && (
        <div className="overflow-x-auto mt-1">
          <table className="w-full text-xs border-collapse" data-testid={`revenue-table-${locationName}`}>
            <thead>
              <tr className="border-b bg-muted/30 sticky top-0 z-10">
                <th className="text-left p-2 min-w-[160px] font-medium">Apartament</th>
                <th className="text-left p-2 min-w-[60px] font-medium">Wiersz</th>
                {MONTHS.map((m, i) => (
                  <th key={i} className={`text-right p-2 min-w-[80px] font-medium ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {m}
                  </th>
                ))}
                <th className="text-right p-2 min-w-[90px] font-bold">Razem</th>
              </tr>
            </thead>
            <tbody>
              {apartments.map(apt => {
                const yearFc = Object.values(apt.months).reduce((s, m) => s + m.forecast, 0);
                const yearAct = Object.values(apt.months).reduce((s, m) => s + m.actual, 0);
                return [
                  <tr key={`${apt.apartmentId}-plan`} className="border-b border-dashed" data-testid={`apt-row-plan-${apt.apartmentId}`}>
                    <td className="p-2 font-medium" rowSpan={3}>
                      <button className="text-left hover:text-[#5ADBFA] hover:underline transition-colors" onClick={() => onApartmentClick?.(apt.apartmentId)} data-testid={`apt-trend-link-${apt.apartmentId}`}>
                        {apt.apartmentName}
                      </button>
                    </td>
                    <td className="p-2 text-muted-foreground">Plan</td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className={`p-2 text-right tabular-nums ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                        {formatNum(apt.months[i]?.forecast || 0)}
                      </td>
                    ))}
                    <td className="p-2 text-right font-semibold tabular-nums">{formatNum(yearFc)}</td>
                  </tr>,
                  <tr key={`${apt.apartmentId}-actual`} className="border-b border-dashed" data-testid={`apt-row-actual-${apt.apartmentId}`}>
                    <td className="p-2 text-muted-foreground">Rzecz.</td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className={`p-2 text-right tabular-nums font-medium ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                        {formatNum(apt.months[i]?.actual || 0)}
                      </td>
                    ))}
                    <td className="p-2 text-right font-bold tabular-nums">{formatNum(yearAct)}</td>
                  </tr>,
                  <tr key={`${apt.apartmentId}-dev`} className="border-b" data-testid={`apt-row-dev-${apt.apartmentId}`}>
                    <td className="p-2 text-muted-foreground">Odch.</td>
                    {MONTHS.map((_, i) => {
                      const fc = apt.months[i]?.forecast || 0;
                      const act = apt.months[i]?.actual || 0;
                      const dev = act - fc;
                      return (
                        <td key={i} className={`p-2 text-right tabular-nums text-xs ${deviationColor(dev)} ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                          {fc === 0 && act === 0 ? "—" : `${dev >= 0 ? "+" : ""}${formatNum(dev)}`}
                          {fc > 0 && <span className="block text-[10px]">{pctStr(act, fc)}</span>}
                        </td>
                      );
                    })}
                    <td className={`p-2 text-right tabular-nums text-xs font-semibold ${deviationColor(yearAct - yearFc)}`}>
                      {yearFc === 0 && yearAct === 0 ? "—" : `${yearAct - yearFc >= 0 ? "+" : ""}${formatNum(yearAct - yearFc)}`}
                    </td>
                  </tr>,
                ];
              })}
              <tr className="border-t-2 font-bold bg-muted/20">
                <td className="p-2">Razem {locationName}</td>
                <td className="p-2 text-muted-foreground text-xs">Plan</td>
                {MONTHS.map((_, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(totals[i]?.forecast || 0)}
                  </td>
                ))}
                <td className="p-2 text-right tabular-nums">{formatNum(yearTotalFc)}</td>
              </tr>
              <tr className="font-bold bg-muted/20">
                <td className="p-2"></td>
                <td className="p-2 text-muted-foreground text-xs">Rzecz.</td>
                {MONTHS.map((_, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(totals[i]?.actual || 0)}
                  </td>
                ))}
                <td className="p-2 text-right tabular-nums">{formatNum(yearTotalAct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function V2Przychody() {
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Przychody v2" icon={Wallet} description="Przychody — prognoza vs realizacja" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="v2-przychody-page">
      <PageHeader
        title="Przychody v2"
        icon={Wallet}
        description="Przychody — prognoza vs realizacja"
        actions={
          <div className="flex items-center gap-2">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-location-filter">
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
              <Sparkles className="h-4 w-4 mr-1" /> Auto-uzup.
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCopyDialog(true)} data-testid="button-copy-forecasts">
              <Copy className="h-4 w-4 mr-1" /> Kopiuj
            </Button>
          </div>
        }
      />

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

      <Card data-testid="revenue-chart">
        <CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `${formatNum(v)} PLN`} />
              <Legend />
              <Bar dataKey="Prognoza" fill="hsl(var(--chart-1))" opacity={0.5} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Realizacja" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
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

      <CopyForecastDialog open={showCopyDialog} onOpenChange={setShowCopyDialog} currentYear={year} defaultTypes={["revenue"]} />
      <AutoFillDialog open={showAutoFill} onOpenChange={setShowAutoFill} currentYear={year} />
      <ApartmentTrendSheet apartmentId={trendAptId} open={!!trendAptId} onOpenChange={(o) => { if (!o) setTrendAptId(null); }} />
    </div>
  );
}
