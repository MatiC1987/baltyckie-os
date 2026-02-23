import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Location } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, TrendingDown, ArrowUp, ArrowDown, AlertCircle, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ComposedChart, Line, ReferenceLine } from "recharts";
import { Progress } from "@/components/ui/progress";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

type MonthlyRealization = {
  month: number;
  revenueForecast: number;
  revenueActual: number;
  revenueDeviation: number;
  revenueDeviationPct: number;
  costForecast: number;
  costActual: number;
  profitForecast: number;
  profitActual: number;
  isRealized: boolean;
};

type AptPerformance = {
  apartmentId: number;
  apartmentName: string;
  locationId: number | null;
  totalForecast: number;
  totalActual: number;
  deviation: number;
  deviationPct: number;
  status: "above" | "close" | "below";
};

type RealizationResponse = {
  year: number;
  currentMonth: number;
  locations: Location[];
  monthlyData: MonthlyRealization[];
  apartmentPerformance: AptPerformance[];
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

function statusBadge(status: string) {
  switch (status) {
    case "above":
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Powyżej planu</Badge>;
    case "close":
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Blisko planu</Badge>;
    case "below":
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Poniżej planu</Badge>;
    default:
      return null;
  }
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatNum(p.value)} PLN
        </p>
      ))}
    </div>
  );
}

export default function V2Realizacja() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [sortBy, setSortBy] = useState<string>("deviation");
  const [locationFilter, setLocationFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<RealizationResponse>({
    queryKey: [`/api/v2/realization?year=${year}`],
  });

  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear - 4; y <= currentYear + 5; y++) arr.push(y);
    return arr;
  }, [currentYear]);

  const monthlyData = data?.monthlyData || [];
  const apartments = data?.apartmentPerformance || [];
  const locations = data?.locations || [];
  const currentMonth = data?.currentMonth ?? 0;

  const filteredApts = useMemo(() => {
    let apts = locationFilter === "all" ? apartments : apartments.filter(a => String(a.locationId) === locationFilter);
    if (sortBy === "deviation") apts = [...apts].sort((a, b) => a.deviation - b.deviation);
    else if (sortBy === "actual") apts = [...apts].sort((a, b) => b.totalActual - a.totalActual);
    else if (sortBy === "name") apts = [...apts].sort((a, b) => a.apartmentName.localeCompare(b.apartmentName));
    return apts;
  }, [apartments, sortBy, locationFilter]);

  const revenueChartData = useMemo(() => {
    return monthlyData.map((m, i) => ({
      month: MONTHS[m.month],
      "Prognoza": m.revenueForecast,
      "Realizacja": m.revenueActual,
      "Odchylenie": m.revenueDeviation,
    }));
  }, [monthlyData]);

  const profitChartData = useMemo(() => {
    return monthlyData.map(m => ({
      month: MONTHS[m.month],
      "Zysk plan": m.profitForecast,
      "Zysk rzeczywisty": m.profitActual,
    }));
  }, [monthlyData]);

  const totalStats = useMemo(() => {
    const realized = monthlyData.filter(m => m.isRealized);
    const totalForecast = realized.reduce((s, m) => s + m.revenueForecast, 0);
    const totalActual = realized.reduce((s, m) => s + m.revenueActual, 0);
    const aboveCount = apartments.filter(a => a.status === "above").length;
    const belowCount = apartments.filter(a => a.status === "below").length;
    return {
      totalForecast,
      totalActual,
      deviation: totalActual - totalForecast,
      deviationPct: totalForecast > 0 ? ((totalActual - totalForecast) / totalForecast) * 100 : 0,
      aboveCount,
      belowCount,
      realizationPct: totalForecast > 0 ? (totalActual / totalForecast) * 100 : 0,
    };
  }, [monthlyData, apartments]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Realizacja v2" icon={Target} description="Analiza odchyleń plan vs rzeczywistość" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="v2-realizacja-page">
      <PageHeader
        title="Realizacja v2"
        icon={Target}
        description="Analiza odchyleń plan vs rzeczywistość"
        actions={
          <div className="flex items-center gap-2">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[150px]" data-testid="select-location-filter">
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
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="card-gradient from-blue-500/10" data-testid="kpi-forecast-total">
          <CardContent className="pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium">Plan (zrealizowane m.)</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{formatNum(totalStats.totalForecast)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-emerald-500/10" data-testid="kpi-actual-total">
          <CardContent className="pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium">Realizacja</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{formatNum(totalStats.totalActual)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-orange-500/10" data-testid="kpi-deviation-total">
          <CardContent className="pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium">Odchylenie</p>
            <p className={`text-lg font-bold mt-0.5 tabular-nums ${deviationColor(totalStats.deviation)}`}>
              {totalStats.deviation >= 0 ? "+" : ""}{formatNum(totalStats.deviation)}
            </p>
            <p className="text-[10px] text-muted-foreground">{totalStats.deviationPct >= 0 ? "+" : ""}{totalStats.deviationPct.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-green-500/10" data-testid="kpi-above-count">
          <CardContent className="pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3 text-emerald-600" /> Powyżej planu</p>
            <p className="text-lg font-bold mt-0.5">{totalStats.aboveCount} apt.</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-red-500/10" data-testid="kpi-below-count">
          <CardContent className="pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3 text-red-600" /> Poniżej planu</p>
            <p className="text-lg font-bold mt-0.5">{totalStats.belowCount} apt.</p>
          </CardContent>
        </Card>
      </div>

      {totalStats.totalForecast > 0 && (
        <Card data-testid="realization-progress">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Realizacja planu przychodów</span>
              <span className={`text-sm font-bold ${deviationColor(totalStats.realizationPct - 100)}`}>
                {totalStats.realizationPct.toFixed(1)}%
              </span>
            </div>
            <Progress value={Math.min(totalStats.realizationPct, 150)} className="h-3" />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="chart-revenue-comparison">
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3">Przychody: plan vs realizacja</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" className="text-[10px]" />
                <YAxis className="text-[10px]" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Prognoza" fill="hsl(var(--chart-1))" opacity={0.4} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Realizacja" fill="hsl(var(--chart-2))" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="Odchylenie" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="chart-profit-comparison">
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3">Zysk: plan vs realizacja</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={profitChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" className="text-[10px]" />
                <YAxis className="text-[10px]" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Zysk plan" fill="hsl(var(--chart-3))" opacity={0.4} radius={[2, 2, 0, 0]} />
                <Bar dataKey="Zysk rzeczywisty" fill="hsl(var(--chart-4))" radius={[2, 2, 0, 0]} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="2 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="monthly-realization-table">
        <CardContent className="pt-4 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-3">Miesięczna realizacja</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/30 sticky top-0 z-10">
                <th className="text-left p-2 min-w-[100px] font-medium">Pozycja</th>
                {monthlyData.map((m, i) => (
                  <th key={i} className={`text-right p-2 min-w-[75px] font-medium ${m.month === currentMonth && year === currentYear ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""} ${!m.isRealized ? "text-muted-foreground" : ""}`}>
                    {MONTHS[m.month]}
                  </th>
                ))}
                <th className="text-right p-2 min-w-[85px] font-bold">Razem</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2 font-medium">Plan przych.</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums ${m.month === currentMonth && year === currentYear ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(m.revenueForecast)}
                  </td>
                ))}
                <td className="p-2 text-right font-bold tabular-nums">{formatNum(monthlyData.reduce((s, m) => s + m.revenueForecast, 0))}</td>
              </tr>
              <tr className="border-b">
                <td className="p-2 font-medium">Realizacja</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums font-semibold ${m.month === currentMonth && year === currentYear ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {m.isRealized ? formatNum(m.revenueActual) : "—"}
                  </td>
                ))}
                <td className="p-2 text-right font-bold tabular-nums">{formatNum(monthlyData.filter(m => m.isRealized).reduce((s, m) => s + m.revenueActual, 0))}</td>
              </tr>
              <tr className="border-b">
                <td className="p-2 font-medium">Odchylenie</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums ${deviationColor(m.revenueDeviation)} ${m.month === currentMonth && year === currentYear ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {m.isRealized ? `${m.revenueDeviation >= 0 ? "+" : ""}${formatNum(m.revenueDeviation)}` : "—"}
                  </td>
                ))}
                <td className={`p-2 text-right font-bold tabular-nums ${deviationColor(totalStats.deviation)}`}>
                  {totalStats.deviation >= 0 ? "+" : ""}{formatNum(totalStats.deviation)}
                </td>
              </tr>
              <tr className="border-b bg-muted/20">
                <td className="p-2 font-medium">Odch. %</td>
                {monthlyData.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums ${deviationColor(m.revenueDeviationPct)} ${m.month === currentMonth && year === currentYear ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {m.isRealized && m.revenueForecast > 0 ? `${m.revenueDeviationPct >= 0 ? "+" : ""}${m.revenueDeviationPct.toFixed(0)}%` : "—"}
                  </td>
                ))}
                <td className={`p-2 text-right font-bold tabular-nums ${deviationColor(totalStats.deviationPct)}`}>
                  {totalStats.deviationPct >= 0 ? "+" : ""}{totalStats.deviationPct.toFixed(1)}%
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card data-testid="apartment-performance-table">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Wyniki apartamentów</h3>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]" data-testid="select-sort">
                <SelectValue placeholder="Sortuj" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deviation">Odchylenie (rosnąco)</SelectItem>
                <SelectItem value="actual">Przychód (malejąco)</SelectItem>
                <SelectItem value="name">Nazwa (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            {filteredApts.map(apt => {
              const progressValue = apt.totalForecast > 0 ? (apt.totalActual / apt.totalForecast) * 100 : 0;
              return (
                <div key={apt.apartmentId} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors" data-testid={`apt-perf-${apt.apartmentId}`}>
                  <div className="min-w-[140px]">
                    <p className="text-sm font-medium">{apt.apartmentName}</p>
                    {statusBadge(apt.status)}
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Plan: {formatNum(apt.totalForecast)}</span>
                      <span className="font-medium">Rzecz.: {formatNum(apt.totalActual)}</span>
                    </div>
                    <Progress value={Math.min(progressValue, 150)} className="h-2" />
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className={`text-sm font-bold tabular-nums ${deviationColor(apt.deviation)}`}>
                      {apt.deviation >= 0 ? "+" : ""}{formatNum(apt.deviation)} PLN
                    </p>
                    <p className={`text-xs ${deviationColor(apt.deviationPct)}`}>
                      {apt.deviationPct >= 0 ? "+" : ""}{apt.deviationPct.toFixed(1)}%
                    </p>
                  </div>
                </div>
              );
            })}
            {filteredApts.length === 0 && (
              <p className="text-center text-muted-foreground py-8">Brak danych do wyświetlenia</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
