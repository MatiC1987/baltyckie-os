import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsSkeleton } from "@/components/PageSkeleton";
import { Landmark, TrendingUp, TrendingDown, BarChart3, Table2 } from "lucide-react";

type MonthData = {
  year: number;
  month: number;
  revenueForecast: number;
  revenueActual: number;
  revenueRemaining: number;
  aptCostForecast: number;
  aptCostActual: number;
  aptCostRemaining: number;
  opCostForecast: number;
  opCostActual: number;
  opCostRemaining: number;
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
  return `${value.toLocaleString("pl-PL", { maximumFractionDigits: 0, minimumFractionDigits: 0 })} zł`;
}

function balanceColor(val: number) {
  return val >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
}

function balanceBg(val: number) {
  return val >= 0
    ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
    : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300";
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d: MonthData = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-56">
      <p className="font-semibold text-sm mb-2">{MONTH_NAMES_FULL[d.month - 1]} {d.year}</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        <span className="text-muted-foreground">Prognoza przychodów:</span>
        <span className="text-right">{pln(d.revenueForecast)}</span>
        <span className="text-muted-foreground">Realizacja przychodów:</span>
        <span className="text-right">{pln(d.revenueActual)}</span>
        <span className="text-muted-foreground">Pozostało do wynajęcia:</span>
        <span className={`text-right font-medium ${d.revenueRemaining >= 0 ? "text-emerald-600" : "text-blue-600"}`}>{pln(d.revenueRemaining)}</span>
        <span className="text-muted-foreground">Koszty apt (pozostało):</span>
        <span className="text-right text-orange-600">−{pln(d.aptCostRemaining)}</span>
        <span className="text-muted-foreground">Koszty op (pozostało):</span>
        <span className="text-right text-red-600">−{pln(d.opCostRemaining)}</span>
      </div>
      <div className="border-t border-border mt-1.5 pt-1.5">
        <div className="flex justify-between font-semibold">
          <span>Saldo firmowe:</span>
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

  const COL_COUNT_DESKTOP = 11;
  const COL_COUNT_MOBILE = 5;

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
                <BarChart3 className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Oba</span>
              </TabsTrigger>
              <TabsTrigger value="chart" data-testid="tab-chart">
                <TrendingUp className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Wykres</span>
              </TabsTrigger>
              <TabsTrigger value="table" data-testid="tab-table">
                <Table2 className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Tabela</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {isLoading && <AnalyticsSkeleton />}

      {data && (
        <>
          <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Aktualne saldo firmowe</p>
                <p className={`text-lg sm:text-xl font-bold mt-1 ${balanceColor(data.currentBalance)}`} data-testid="text-current-balance">
                  {pln(data.currentBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Suma kont, sald, krypto i pożyczek</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <p className="text-xs text-muted-foreground font-medium">Maksymalne saldo (5 lat)</p>
                </div>
                <p className="text-lg sm:text-xl font-bold mt-1 text-green-600 dark:text-green-400" data-testid="text-max-balance">
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
                <p className={`text-lg sm:text-xl font-bold mt-1 ${balanceColor(minBalance)}`} data-testid="text-min-balance">
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
                      name="Saldo firmowe"
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
            <Card className="overflow-hidden">
              <div className="overflow-x-auto table-scroll-container" onScroll={(e) => { const el = e.currentTarget; const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10; if (atEnd) el.classList.add('scrolled-end'); else el.classList.remove('scrolled-end'); }}>
                <table className="w-full text-xs sm:text-sm sm:min-w-[1100px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-left px-2 sm:px-4 py-2.5 sm:py-3 font-bold w-20 sm:w-32 border-r border-slate-200 dark:border-slate-700" rowSpan={2}>Miesiąc</th>
                      <th className="hidden sm:table-cell text-center px-1 sm:px-2 py-2 font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 border-b border-emerald-200 dark:border-emerald-800" colSpan={3}>Przychody</th>
                      <th className="sm:hidden text-center px-1 py-2 font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60" rowSpan={2}>Poz.<br/>przych.</th>
                      <th className="hidden sm:table-cell text-center px-1 sm:px-2 py-2 font-bold text-orange-800 dark:text-orange-200 bg-orange-100 dark:bg-orange-900/60 border-b border-orange-200 dark:border-orange-800" colSpan={3}>Koszty apartamentów</th>
                      <th className="sm:hidden text-center px-1 py-2 font-bold text-orange-800 dark:text-orange-200 bg-orange-100 dark:bg-orange-900/60" rowSpan={2}>Poz.<br/>apt.</th>
                      <th className="hidden sm:table-cell text-center px-1 sm:px-2 py-2 font-bold text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/60 border-b border-red-200 dark:border-red-800" colSpan={3}>Koszty operacyjne</th>
                      <th className="sm:hidden text-center px-1 py-2 font-bold text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/60" rowSpan={2}>Poz.<br/>op.</th>
                      <th className="text-center px-1 sm:px-4 py-2 font-bold text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700" rowSpan={2}>Saldo<br/>firmowe</th>
                    </tr>
                    <tr>
                      <th className="hidden sm:table-cell text-right px-1 sm:px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/40">Prognoza</th>
                      <th className="hidden sm:table-cell text-right px-1 sm:px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/40">Realizacja</th>
                      <th className="hidden sm:table-cell text-right px-1 sm:px-2 py-1.5 text-[11px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60">Pozostało</th>
                      <th className="hidden sm:table-cell text-right px-1 sm:px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/40">Prognoza</th>
                      <th className="hidden sm:table-cell text-right px-1 sm:px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/40">Realizacja</th>
                      <th className="hidden sm:table-cell text-right px-1 sm:px-2 py-1.5 text-[11px] sm:text-xs font-bold text-orange-800 dark:text-orange-200 bg-orange-100 dark:bg-orange-900/60">Pozostało</th>
                      <th className="hidden sm:table-cell text-right px-1 sm:px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40">Prognoza</th>
                      <th className="hidden sm:table-cell text-right px-1 sm:px-2 py-1.5 text-[11px] sm:text-xs font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/40">Realizacja</th>
                      <th className="hidden sm:table-cell text-right px-1 sm:px-2 py-1.5 text-[11px] sm:text-xs font-bold text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/60">Pozostało</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byYear.map(([year, months]) => (
                      <Fragment key={year}>
                        <tr className="bg-slate-50 dark:bg-slate-800/60 border-y-2 border-slate-200 dark:border-slate-600">
                          <td colSpan={COL_COUNT_DESKTOP} className="hidden sm:table-cell sticky left-0 bg-slate-50 dark:bg-slate-800/60 px-2 sm:px-4 py-2 font-bold text-base text-slate-800 dark:text-slate-200 tracking-wide">{year}</td>
                          <td colSpan={COL_COUNT_MOBILE} className="sm:hidden sticky left-0 bg-slate-50 dark:bg-slate-800/60 px-2 py-2 font-bold text-base text-slate-800 dark:text-slate-200 tracking-wide">{year}</td>
                        </tr>
                        {months.map(m => {
                          const isCurrent = m.year === currentYear && m.month === currentMonth;
                          const rowBg = isCurrent ? "bg-blue-50/70 dark:bg-blue-950/30" : "";
                          const stickyBg = isCurrent ? "bg-blue-50/70 dark:bg-blue-950/30" : "bg-card";
                          return (
                            <tr
                              key={`${m.year}-${m.month}`}
                              data-testid={`row-balance-${m.year}-${m.month}`}
                              className={`border-b border-border/50 transition-colors hover:bg-muted/50 ${rowBg}`}
                            >
                              <td className={`sticky left-0 z-10 px-2 sm:px-4 py-2 sm:py-2.5 font-semibold text-slate-700 dark:text-slate-200 border-r border-border/30 ${stickyBg}`}>
                                {MONTH_NAMES_SHORT[m.month - 1]}
                                {isCurrent && <span className="ml-1.5 text-[10px] sm:text-xs text-blue-600 dark:text-blue-400 font-bold">(teraz)</span>}
                              </td>
                              <td className="hidden sm:table-cell text-right px-2 py-2 sm:py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{plnShort(m.revenueForecast)}</td>
                              <td className="hidden sm:table-cell text-right px-2 py-2 sm:py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{plnShort(m.revenueActual)}</td>
                              <td className={`text-right px-1.5 sm:px-2 py-2 sm:py-2.5 tabular-nums font-semibold ${m.revenueRemaining > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
                                {plnShort(m.revenueRemaining)}
                              </td>
                              <td className="hidden sm:table-cell text-right px-2 py-2 sm:py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{plnShort(m.aptCostForecast)}</td>
                              <td className="hidden sm:table-cell text-right px-2 py-2 sm:py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{plnShort(m.aptCostActual)}</td>
                              <td className={`text-right px-1.5 sm:px-2 py-2 sm:py-2.5 tabular-nums font-semibold ${m.aptCostRemaining > 0 ? "text-orange-700 dark:text-orange-400" : "text-slate-400 dark:text-slate-500"}`}>
                                {m.aptCostRemaining > 0 ? `−${plnShort(m.aptCostRemaining)}` : "0"}
                              </td>
                              <td className="hidden sm:table-cell text-right px-2 py-2 sm:py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{plnShort(m.opCostForecast)}</td>
                              <td className="hidden sm:table-cell text-right px-2 py-2 sm:py-2.5 tabular-nums text-slate-600 dark:text-slate-300">{plnShort(m.opCostActual)}</td>
                              <td className={`text-right px-1.5 sm:px-2 py-2 sm:py-2.5 tabular-nums font-semibold ${m.opCostRemaining > 0 ? "text-red-700 dark:text-red-400" : "text-slate-400 dark:text-slate-500"}`}>
                                {m.opCostRemaining > 0 ? `−${plnShort(m.opCostRemaining)}` : "0"}
                              </td>
                              <td className={`text-right px-2 sm:px-4 py-2 sm:py-2.5 tabular-nums font-bold border-l border-border/30 ${balanceBg(m.endBalance)}`}>
                                {plnShort(m.endBalance)}
                              </td>
                            </tr>
                          );
                        })}
                        <tr key={`year-total-${year}`} className="bg-slate-50 dark:bg-slate-800/50 border-b-2 border-slate-200 dark:border-slate-600">
                          <td className="sticky left-0 bg-slate-50 dark:bg-slate-800/50 px-2 sm:px-4 py-2.5 font-bold text-sm text-slate-800 dark:text-slate-200 border-r border-border/30">Suma {year}</td>
                          <td className="hidden sm:table-cell text-right px-2 py-2.5 tabular-nums text-slate-500 dark:text-slate-400 font-medium">
                            {plnShort(months.reduce((s, m) => s + m.revenueForecast, 0))}
                          </td>
                          <td className="hidden sm:table-cell text-right px-2 py-2.5 tabular-nums text-slate-500 dark:text-slate-400 font-medium">
                            {plnShort(months.reduce((s, m) => s + m.revenueActual, 0))}
                          </td>
                          <td className="text-right px-1.5 sm:px-2 py-2.5 tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">
                            {plnShort(months.reduce((s, m) => s + m.revenueRemaining, 0))}
                          </td>
                          <td className="hidden sm:table-cell text-right px-2 py-2.5 tabular-nums text-slate-500 dark:text-slate-400 font-medium">
                            {plnShort(months.reduce((s, m) => s + m.aptCostForecast, 0))}
                          </td>
                          <td className="hidden sm:table-cell text-right px-2 py-2.5 tabular-nums text-slate-500 dark:text-slate-400 font-medium">
                            {plnShort(months.reduce((s, m) => s + m.aptCostActual, 0))}
                          </td>
                          <td className="text-right px-1.5 sm:px-2 py-2.5 tabular-nums text-orange-700 dark:text-orange-400 font-bold">
                            −{plnShort(months.reduce((s, m) => s + m.aptCostRemaining, 0))}
                          </td>
                          <td className="hidden sm:table-cell text-right px-2 py-2.5 tabular-nums text-slate-500 dark:text-slate-400 font-medium">
                            {plnShort(months.reduce((s, m) => s + m.opCostForecast, 0))}
                          </td>
                          <td className="hidden sm:table-cell text-right px-2 py-2.5 tabular-nums text-slate-500 dark:text-slate-400 font-medium">
                            {plnShort(months.reduce((s, m) => s + m.opCostActual, 0))}
                          </td>
                          <td className="text-right px-1.5 sm:px-2 py-2.5 tabular-nums text-red-700 dark:text-red-400 font-bold">
                            −{plnShort(months.reduce((s, m) => s + m.opCostRemaining, 0))}
                          </td>
                          <td className={`text-right px-2 sm:px-4 py-2.5 tabular-nums font-bold border-l border-border/30 ${balanceBg(months[months.length - 1]?.endBalance ?? 0)}`}>
                            {plnShort(months[months.length - 1]?.endBalance ?? 0)}
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
