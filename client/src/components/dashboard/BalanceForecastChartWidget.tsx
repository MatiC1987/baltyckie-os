import { useMemo } from "react";
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
      </CardContent>
    </Card>
  );
}
