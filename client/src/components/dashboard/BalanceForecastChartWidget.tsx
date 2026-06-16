import { useMemo, Fragment } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";

type BalanceForecastData = {
  currentBalance: number;
  months: {
    year: number;
    month: number;
    endBalance: number;
    revenueForecast: number;
    revenueActual: number;
    aptCostRemaining: number;
    opCostRemaining: number;
    surcharges: number;
  }[];
};

const MONTH_NAMES_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function plnFmt(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}

function plnFull(value: number) {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " zł";
}

function plnShort(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(0)}k`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function balanceBg(val: number) {
  if (val > 0) return "text-green-700 dark:text-green-400";
  if (val < 0) return "text-red-700 dark:text-red-400";
  return "text-slate-500 dark:text-slate-400";
}

function BalanceForecastTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg text-sm">
      <p className="font-medium mb-1">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Saldo końcowe</span>
          <span className={`font-semibold ${data.endBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {plnFull(data.endBalance)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function BalanceForecastChartWidget({ data }: { data?: BalanceForecastData | null }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed, matching API data

  const chartData = useMemo(() => {
    if (!data?.months) return [];
    return data.months.map(m => ({
      label: `${MONTH_NAMES_SHORT[m.month]} ${m.year}`,
      endBalance: m.endBalance,
    }));
  }, [data]);

  const minBalance = useMemo(() => {
    if (!chartData.length) return 0;
    return Math.min(...chartData.map(d => d.endBalance));
  }, [chartData]);

  const endBalance = useMemo(() => {
    if (!chartData.length) return 0;
    return chartData[chartData.length - 1].endBalance;
  }, [chartData]);

  const tableMonths = useMemo(() => {
    if (!data?.months) return [];
    const nextYear = currentYear + 1;
    return data.months.filter(m =>
      (m.year === currentYear && m.month >= currentMonth) ||
      (m.year === nextYear)
    );
  }, [data, currentYear, currentMonth]);

  const tableByYear = useMemo(() => {
    const map = new Map<number, typeof tableMonths>();
    for (const m of tableMonths) {
      if (!map.has(m.year)) map.set(m.year, []);
      map.get(m.year)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [tableMonths]);

  if (!data) {
    return (
      <Card data-testid="widget-balance-forecast-chart">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-balance-forecast-chart">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-500" />
            Prognoza salda firmowego — 36 miesięcy
          </CardTitle>
          <Link href="/saldo-firmowe">
            <Button variant="ghost" size="sm" className="text-xs h-7" data-testid="link-saldo-firmowe-details">
              Szczegóły →
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Aktualne saldo</p>
            <p className={`text-sm font-bold ${data.currentBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-balance-current">
              {plnFull(data.currentBalance)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Min (36 mies.)</p>
            <p className={`text-sm font-bold ${minBalance >= 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-balance-min">
              {plnFull(minBalance)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Saldo za 36 mies.</p>
            <p className={`text-sm font-bold ${endBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-balance-end">
              {plnFull(endBalance)}
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 12 }}>
            <defs>
              <linearGradient id="dashBalanceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval={5}
              className="text-muted-foreground"
            />
            <YAxis
              tickFormatter={plnFmt}
              tick={{ fontSize: 10 }}
              width={56}
              className="text-muted-foreground"
            />
            <RTooltip content={<BalanceForecastTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} />
            <Area
              type="monotone"
              dataKey="endBalance"
              name="Saldo firmowe"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#dashBalanceGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#22c55e" }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {tableByYear.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[11px]" data-testid="table-balance-forecast-monthly">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground w-16">Miesiąc</th>
                  <th className="text-right py-1.5 px-1.5 font-semibold text-teal-700 dark:text-teal-300">Przychody</th>
                  <th className="text-right py-1.5 px-1.5 font-semibold text-indigo-700 dark:text-indigo-300">Koszty apt.</th>
                  <th className="text-right py-1.5 px-1.5 font-semibold text-rose-700 dark:text-rose-300">Koszty op.</th>
                  <th className="text-right py-1.5 px-1.5 font-semibold text-sky-700 dark:text-sky-300">Dopłaty</th>
                  <th className="text-right py-1.5 px-2 font-semibold text-slate-700 dark:text-slate-200 border-l border-border/40">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {tableByYear.map(([year, months]) => (
                  <Fragment key={year}>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-y border-slate-200 dark:border-slate-600">
                      <td colSpan={6} className="px-2 py-1 font-bold text-xs text-slate-700 dark:text-slate-200 tracking-wide">
                        {year}
                      </td>
                    </tr>
                    {months.map(m => {
                      const isCurrent = m.year === currentYear && m.month === currentMonth;
                      return (
                        <tr
                          key={`${m.year}-${m.month}`}
                          data-testid={`row-forecast-${m.year}-${m.month}`}
                          className={`border-b border-border/30 transition-colors hover:bg-muted/40 ${isCurrent ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}`}
                        >
                          <td className="py-1 px-2 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {MONTH_NAMES_SHORT[m.month - 1]}
                            {isCurrent && (
                              <span className="ml-1 text-[9px] text-blue-600 dark:text-blue-400 font-bold">(teraz)</span>
                            )}
                          </td>
                          <td className={`text-right py-1 px-1.5 tabular-nums ${m.revenueForecast > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
                            {plnShort(m.revenueForecast)}
                          </td>
                          <td className={`text-right py-1 px-1.5 tabular-nums ${m.aptCostRemaining > 0 ? "text-orange-700 dark:text-orange-400" : "text-slate-400 dark:text-slate-500"}`}>
                            {m.aptCostRemaining > 0 ? `−${plnShort(m.aptCostRemaining)}` : "0"}
                          </td>
                          <td className={`text-right py-1 px-1.5 tabular-nums ${m.opCostRemaining > 0 ? "text-red-700 dark:text-red-400" : "text-slate-400 dark:text-slate-500"}`}>
                            {m.opCostRemaining > 0 ? `−${plnShort(m.opCostRemaining)}` : "0"}
                          </td>
                          <td className={`text-right py-1 px-1.5 tabular-nums ${m.surcharges > 0 ? "text-cyan-700 dark:text-cyan-400" : "text-slate-400 dark:text-slate-500"}`}>
                            {m.surcharges > 0 ? `+${plnShort(m.surcharges)}` : "0"}
                          </td>
                          <td className={`text-right py-1 px-2 tabular-nums font-bold border-l border-border/30 ${balanceBg(m.endBalance)}`}>
                            {plnShort(m.endBalance)}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
