import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsSkeleton } from "@/components/PageSkeleton";
import { Landmark, TrendingUp, TrendingDown, BarChart3, Table2 } from "lucide-react";

type MonthData = {
  year: number;
  month: number;
  startBalance: number;
  revenueForecast: number;
  revenueActual: number;
  revenueRemaining: number;
  surcharges: number;
  aptCostForecast: number;
  aptCostActual: number;
  aptCostRemaining: number;
  opCostForecast: number;
  opCostActual: number;
  opCostRemaining: number;
  totalCostForecast: number;
  totalCostActual: number;
  totalCostRemaining: number;
  endBalance: number;
};

type BalanceForecastData = {
  currentBalance: number;
  months: MonthData[];
};

const MONTH_NAMES_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const MONTH_NAMES_FULL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

function pln(value: number, digits = 0): string {
  return value.toLocaleString("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function plnShort(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toLocaleString("pl-PL", { maximumFractionDigits: 0 })} k`;
  return `${sign}${abs.toLocaleString("pl-PL", { maximumFractionDigits: 0 })}`;
}

function balanceColor(val: number) {
  return val >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function balanceBg(val: number) {
  return val >= 0
    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d: MonthData = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-56">
      <p className="font-semibold text-sm mb-2">{MONTH_NAMES_FULL[d.month - 1]} {d.year}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-muted-foreground">Saldo startowe:</span>
        <span className={`text-right font-medium ${balanceColor(d.startBalance)}`}>{pln(d.startBalance)}</span>
        <span className="text-muted-foreground">Prognoza przychodów:</span>
        <span className="text-right">{pln(d.revenueForecast)}</span>
        <span className="text-muted-foreground">Rzecz. przychody:</span>
        <span className="text-right">{pln(d.revenueActual)}</span>
        <span className="text-muted-foreground">Pozostałe przychody:</span>
        <span className="text-right text-emerald-600">+{pln(d.revenueRemaining)}</span>
        <span className="text-muted-foreground">Dopłaty rezerwacje:</span>
        <span className="text-right text-emerald-600">+{pln(d.surcharges)}</span>
        <span className="text-muted-foreground">Koszty apt (poz.):</span>
        <span className="text-right text-red-600">−{pln(d.aptCostRemaining)}</span>
        <span className="text-muted-foreground">Koszty op. (poz.):</span>
        <span className="text-right text-red-600">−{pln(d.opCostRemaining)}</span>
      </div>
      <div className="border-t border-border mt-1.5 pt-1.5">
        <div className="flex justify-between font-semibold">
          <span>Saldo końcowe:</span>
          <span className={balanceColor(d.endBalance)}>{pln(d.endBalance)}</span>
        </div>
      </div>
    </div>
  );
};

export default function SaldoFirmowe() {
  const [view, setView] = useState<"both" | "chart" | "table">("both");
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  const { data, isLoading } = useQuery<BalanceForecastData>({
    queryKey: ["/api/balance-forecast"],
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.months.map(m => ({
      ...m,
      label: `${MONTH_NAMES_SHORT[m.month - 1]} '${String(m.year).slice(2)}`,
    }));
  }, [data]);

  const maxBalance = useMemo(() => data ? Math.max(...data.months.map(m => m.endBalance)) : 0, [data]);
  const minBalance = useMemo(() => data ? Math.min(...data.months.map(m => m.endBalance)) : 0, [data]);

  const byYear = useMemo(() => {
    if (!data) return [];
    const map = new Map<number, MonthData[]>();
    for (const m of data.months) {
      if (!map.has(m.year)) map.set(m.year, []);
      map.get(m.year)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [data]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Saldo firmowe"
        description="Prognozowany stan salda firmowego na 5 lat do przodu."
        icon={Landmark}
        actions={
          <Tabs value={view} onValueChange={v => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="both" data-testid="tab-both">
                <BarChart3 className="h-3.5 w-3.5 mr-1" />Oba
              </TabsTrigger>
              <TabsTrigger value="chart" data-testid="tab-chart">
                <TrendingUp className="h-3.5 w-3.5 mr-1" />Wykres
              </TabsTrigger>
              <TabsTrigger value="table" data-testid="tab-table">
                <Table2 className="h-3.5 w-3.5 mr-1" />Tabela
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {isLoading && <AnalyticsSkeleton />}

      {data && (
        <>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Aktualne saldo</p>
                <p className={`text-xl font-bold mt-1 ${balanceColor(data.currentBalance)}`}>
                  {pln(data.currentBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Suma wszystkich kont</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <p className="text-xs text-muted-foreground font-medium">Maksymalne saldo (5 lat)</p>
                </div>
                <p className="text-xl font-bold mt-1 text-green-600 dark:text-green-400">
                  {pln(maxBalance)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5">
                  <TrendingDown className={`h-4 w-4 ${minBalance < 0 ? "text-red-500" : "text-amber-500"}`} />
                  <p className="text-xs text-muted-foreground font-medium">Minimalne saldo (5 lat)</p>
                </div>
                <p className={`text-xl font-bold mt-1 ${balanceColor(minBalance)}`}>
                  {pln(minBalance)}
                </p>
              </CardContent>
            </Card>
          </div>

          {(view === "chart" || view === "both") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Prognoza salda firmowego — 60 miesięcy</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 16 }}>
                    <defs>
                      <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval={5}
                      className="text-muted-foreground"
                    />
                    <YAxis
                      tickFormatter={plnShort}
                      tick={{ fontSize: 11 }}
                      width={72}
                      className="text-muted-foreground"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
                    <Area
                      type="monotone"
                      dataKey="endBalance"
                      name="Saldo końcowe"
                      stroke="#22c55e"
                      strokeWidth={2}
                      fill="url(#balanceGrad)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#22c55e" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {(view === "table" || view === "both") && (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-xs min-w-[1100px]">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="sticky left-0 bg-muted/50 z-10 text-left px-3 py-2.5 font-semibold w-28">Miesiąc</th>
                    <th className="text-right px-2 py-2.5 font-semibold">Saldo start.</th>
                    <th className="text-right px-2 py-2.5 font-semibold text-emerald-700 dark:text-emerald-400">Prognoza przyc.</th>
                    <th className="text-right px-2 py-2.5 font-semibold text-emerald-700 dark:text-emerald-400">Rzecz. przyc.</th>
                    <th className="text-right px-2 py-2.5 font-semibold text-emerald-700 dark:text-emerald-400">Pozostałe przyc.</th>
                    <th className="text-right px-2 py-2.5 font-semibold text-sky-700 dark:text-sky-400">Dopłaty</th>
                    <th className="text-right px-2 py-2.5 font-semibold text-orange-700 dark:text-orange-400">Koszty apt P</th>
                    <th className="text-right px-2 py-2.5 font-semibold text-orange-700 dark:text-orange-400">Koszty apt R</th>
                    <th className="text-right px-2 py-2.5 font-semibold text-orange-700 dark:text-orange-400">Koszty apt Poz.</th>
                    <th className="text-right px-2 py-2.5 font-semibold text-red-700 dark:text-red-400">Koszty op P</th>
                    <th className="text-right px-2 py-2.5 font-semibold text-red-700 dark:text-red-400">Koszty op R</th>
                    <th className="text-right px-2 py-2.5 font-semibold text-red-700 dark:text-red-400">Koszty op Poz.</th>
                    <th className="text-right px-3 py-2.5 font-semibold w-32">Saldo końc.</th>
                  </tr>
                </thead>
                <tbody>
                  {byYear.map(([year, months]) => (
                    <>
                      <tr key={`year-${year}`} className="bg-muted/30 border-b border-t">
                        <td colSpan={13} className="sticky left-0 bg-muted/30 px-3 py-1.5 font-bold text-sm">{year}</td>
                      </tr>
                      {months.map(m => {
                        const isCurrent = m.year === currentYear && m.month === currentMonth;
                        return (
                          <tr
                            key={`${m.year}-${m.month}`}
                            data-testid={`row-balance-${m.year}-${m.month}`}
                            className={`border-b transition-colors hover:bg-muted/30 ${isCurrent ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                          >
                            <td className={`sticky left-0 z-10 px-3 py-1.5 font-medium ${isCurrent ? "bg-blue-50 dark:bg-blue-950/20" : "bg-background"}`}>
                              {MONTH_NAMES_SHORT[m.month - 1]}
                              {isCurrent && <span className="ml-1 text-[10px] text-blue-500 font-normal">(teraz)</span>}
                            </td>
                            <td className="text-right px-2 py-1.5 tabular-nums">{plnShort(m.startBalance)}</td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">{plnShort(m.revenueForecast)}</td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">{plnShort(m.revenueActual)}</td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">+{plnShort(m.revenueRemaining)}</td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-sky-600 dark:text-sky-400 font-medium">+{plnShort(m.surcharges)}</td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">{plnShort(m.aptCostForecast)}</td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">{plnShort(m.aptCostActual)}</td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-orange-600 dark:text-orange-400 font-medium">−{plnShort(m.aptCostRemaining)}</td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">{plnShort(m.opCostForecast)}</td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground">{plnShort(m.opCostActual)}</td>
                            <td className="text-right px-2 py-1.5 tabular-nums text-red-600 dark:text-red-400 font-medium">−{plnShort(m.opCostRemaining)}</td>
                            <td className={`text-right px-3 py-1.5 tabular-nums font-bold rounded-sm ${balanceBg(m.endBalance)}`}>
                              {plnShort(m.endBalance)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr key={`year-total-${year}`} className="bg-muted/50 border-b-2 border-border">
                        <td className="sticky left-0 bg-muted/50 px-3 py-1.5 font-semibold text-xs text-muted-foreground">Suma {year}</td>
                        <td className="text-right px-2 py-1.5"></td>
                        <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground text-[11px]">
                          {plnShort(months.reduce((s, m) => s + m.revenueForecast, 0))}
                        </td>
                        <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground text-[11px]">
                          {plnShort(months.reduce((s, m) => s + m.revenueActual, 0))}
                        </td>
                        <td className="text-right px-2 py-1.5 tabular-nums text-emerald-600 text-[11px] font-medium">
                          +{plnShort(months.reduce((s, m) => s + m.revenueRemaining, 0))}
                        </td>
                        <td className="text-right px-2 py-1.5 tabular-nums text-sky-600 text-[11px] font-medium">
                          +{plnShort(months.reduce((s, m) => s + m.surcharges, 0))}
                        </td>
                        <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground text-[11px]">
                          {plnShort(months.reduce((s, m) => s + m.aptCostForecast, 0))}
                        </td>
                        <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground text-[11px]">
                          {plnShort(months.reduce((s, m) => s + m.aptCostActual, 0))}
                        </td>
                        <td className="text-right px-2 py-1.5 tabular-nums text-orange-600 text-[11px] font-medium">
                          −{plnShort(months.reduce((s, m) => s + m.aptCostRemaining, 0))}
                        </td>
                        <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground text-[11px]">
                          {plnShort(months.reduce((s, m) => s + m.opCostForecast, 0))}
                        </td>
                        <td className="text-right px-2 py-1.5 tabular-nums text-muted-foreground text-[11px]">
                          {plnShort(months.reduce((s, m) => s + m.opCostActual, 0))}
                        </td>
                        <td className="text-right px-2 py-1.5 tabular-nums text-red-600 text-[11px] font-medium">
                          −{plnShort(months.reduce((s, m) => s + m.opCostRemaining, 0))}
                        </td>
                        <td className={`text-right px-3 py-1.5 tabular-nums font-bold text-[11px] ${balanceBg(months[months.length - 1]?.endBalance ?? 0)}`}>
                          {plnShort(months[months.length - 1]?.endBalance ?? 0)}
                        </td>
                      </tr>
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
