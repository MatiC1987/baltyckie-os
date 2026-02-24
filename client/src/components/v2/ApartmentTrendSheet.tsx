import { useQuery } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, Minus } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const MONTHS_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

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

function formatNum(v: number): string {
  if (v === 0) return "—";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function yoyChange(current: number, previous: number): { value: number; pct: number } {
  const diff = current - previous;
  const pct = previous > 0 ? (diff / previous) * 100 : 0;
  return { value: diff, pct };
}

export function ApartmentTrendSheet({ apartmentId, open, onOpenChange }: {
  apartmentId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery<ApartmentTrendData>({
    queryKey: [`/api/v2/apartment-trend/${apartmentId}`],
    enabled: !!apartmentId && open,
  });

  const currentYear = new Date().getFullYear();

  const yearlyBarData = data ? data.years.map(y => ({
    year: String(y),
    "Przychód": data.yearlyData[y]?.totalActual || 0,
    "Prognoza": data.yearlyData[y]?.totalForecast || 0,
    "Koszty": data.yearlyData[y]?.totalCost || 0,
  })) : [];

  const monthlyLineData = data ? MONTHS_SHORT.map((m, i) => {
    const row: any = { month: m };
    for (const y of data.years) {
      row[String(y)] = data.yearlyData[y]?.months[i]?.actual || 0;
    }
    return row;
  }) : [];

  const currentYearData = data?.yearlyData[currentYear];
  const prevYearData = data?.yearlyData[currentYear - 1];
  const yoyRevenue = currentYearData && prevYearData ? yoyChange(currentYearData.totalActual, prevYearData.totalActual) : null;
  const monthlyAvg = currentYearData ? Math.round(currentYearData.totalActual / Math.max(new Date().getMonth() + 1, 1)) : 0;
  const profit = currentYearData ? currentYearData.totalActual - currentYearData.totalCost : 0;

  const colors = ["#00CCFF", "hsl(222, 47%, 11%)", "hsl(142, 71%, 45%)", "#f59e0b", "#ef4444"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto" data-testid="apartment-trend-sheet">
        <SheetHeader>
          <SheetTitle className="text-lg" data-testid="trend-apartment-name">
            {data?.apartment.name || "Apartament"}
          </SheetTitle>
          {data?.apartment.location && (
            <Badge variant="secondary">{data.apartment.location}</Badge>
          )}
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : data ? (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <Card data-testid="kpi-annual-revenue">
                <CardContent className="pt-3 pb-2">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Przychód {currentYear}
                  </p>
                  <p className="text-lg font-bold tabular-nums">{formatNum(currentYearData?.totalActual || 0)} PLN</p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-monthly-avg">
                <CardContent className="pt-3 pb-2">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Średnia mies.
                  </p>
                  <p className="text-lg font-bold tabular-nums">{formatNum(monthlyAvg)} PLN</p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-yoy-change">
                <CardContent className="pt-3 pb-2">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    {yoyRevenue && yoyRevenue.value >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-600" /> : <TrendingDown className="h-3 w-3 text-red-600" />}
                    Zmiana r/r
                  </p>
                  <p className={`text-lg font-bold tabular-nums ${yoyRevenue && yoyRevenue.value >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {yoyRevenue ? `${yoyRevenue.pct >= 0 ? "+" : ""}${yoyRevenue.pct.toFixed(1)}%` : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card data-testid="kpi-profit">
                <CardContent className="pt-3 pb-2">
                  <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" /> Zysk netto
                  </p>
                  <p className={`text-lg font-bold tabular-nums ${profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {formatNum(profit)} PLN
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card data-testid="chart-yearly-bars">
              <CardContent className="pt-4">
                <h4 className="text-sm font-semibold mb-2">Przychody roczne</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={yearlyBarData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="year" className="text-[10px]" />
                    <YAxis className="text-[10px]" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `${formatNum(v)} PLN`} />
                    <Legend />
                    <Bar dataKey="Przychód" fill="#00CCFF" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Prognoza" fill="hsl(222, 47%, 11%)" opacity={0.4} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Koszty" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="chart-monthly-lines">
              <CardContent className="pt-4">
                <h4 className="text-sm font-semibold mb-2">Porównanie miesięczne</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlyLineData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" className="text-[10px]" />
                    <YAxis className="text-[10px]" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => `${formatNum(v)} PLN`} />
                    <Legend />
                    {data.years.map((y, i) => (
                      <Line key={y} type="monotone" dataKey={String(y)} stroke={colors[i % colors.length]} strokeWidth={y === currentYear ? 3 : 1.5} dot={false} strokeDasharray={y > currentYear ? "5 5" : undefined} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="yoy-comparison-table">
              <CardContent className="pt-4 overflow-x-auto">
                <h4 className="text-sm font-semibold mb-2">Tabela rok do roku</h4>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-2 font-medium">Rok</th>
                      <th className="text-right p-2 font-medium">Przychód</th>
                      <th className="text-right p-2 font-medium">Koszty</th>
                      <th className="text-right p-2 font-medium">Zysk</th>
                      <th className="text-right p-2 font-medium">Zmiana r/r</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.years.map((y, idx) => {
                      const yd = data.yearlyData[y];
                      const prevYd = idx > 0 ? data.yearlyData[data.years[idx - 1]] : null;
                      const change = prevYd && prevYd.totalActual > 0
                        ? ((yd.totalActual - prevYd.totalActual) / prevYd.totalActual) * 100
                        : null;
                      return (
                        <tr key={y} className={`border-b ${y === currentYear ? "bg-cyan-50/40 dark:bg-cyan-950/10 font-semibold" : ""}`} data-testid={`trend-year-row-${y}`}>
                          <td className="p-2">{y}</td>
                          <td className="p-2 text-right tabular-nums">{formatNum(yd.totalActual)}</td>
                          <td className="p-2 text-right tabular-nums">{formatNum(yd.totalCost)}</td>
                          <td className={`p-2 text-right tabular-nums ${yd.totalActual - yd.totalCost >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {formatNum(yd.totalActual - yd.totalCost)}
                          </td>
                          <td className={`p-2 text-right tabular-nums ${change !== null && change >= 0 ? "text-emerald-600 dark:text-emerald-400" : change !== null ? "text-red-600 dark:text-red-400" : ""}`}>
                            {change !== null ? `${change >= 0 ? "+" : ""}${change.toFixed(1)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
