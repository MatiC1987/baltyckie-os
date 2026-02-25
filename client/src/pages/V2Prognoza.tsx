import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Wallet, Calculator, DollarSign, BarChart3, Copy, Sparkles } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from "recharts";
import { CopyForecastDialog } from "@/components/v2/CopyForecastDialog";
import { AutoFillDialog } from "@/components/v2/AutoFillDialog";

const MONTHS_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

type ForecastMonth = {
  year: number;
  month: number;
  monthLabel: string;
  isPast: boolean;
  isCurrent: boolean;
  revenueForecast: number;
  actualRevenue: number;
  subleaseRevenue: number;
  apartmentCostForecast: number;
  operationalCostForecast: number;
  variableCostForecast: number;
  totalCostForecast: number;
  actualExpenses: number;
  pendingPayments: number;
  monthResult: number;
  cumulativeBalance: number;
};

type ForecastResponse = {
  companyBalance: number;
  months: ForecastMonth[];
};

function formatNum(v: number): string {
  if (v === 0) return "—";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function balanceColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "";
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

function readLocalAptCosts(years: number[]): Record<string, number> {
  const aptCostsByYM: Record<string, number> = {};
  for (const year of years) {
    try {
      const raw = localStorage.getItem(`costs-apartments-data-${year}`);
      if (!raw) continue;
      const stored = JSON.parse(raw) as Record<string, Record<string, { p: number; r: number }>>;
      for (const monthData of Object.values(stored)) {
        for (const [monthStr, cellData] of Object.entries(monthData)) {
          const ym = `${year}-${parseInt(monthStr)}`;
          aptCostsByYM[ym] = (aptCostsByYM[ym] || 0) + (Number(cellData.p) || 0);
        }
      }
    } catch {}
  }
  return aptCostsByYM;
}

// Reads ALL operational costs from CostsExpenses localStorage (oplaty-data-{year}).
// Cell key format: "${catId}__${itemIdx}__${monthIdx}__prognoza" (monthIdx 0-based)
function readLocalOpCosts(years: number[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const year of years) {
    try {
      const raw = localStorage.getItem(`oplaty-data-${year}`);
      if (!raw) continue;
      const stored = JSON.parse(raw) as Record<string, number>;
      for (const [key, value] of Object.entries(stored)) {
        const parts = key.split("__");
        if (parts.length === 4 && parts[3] === "prognoza") {
          const monthIdx = parseInt(parts[2]);
          const ym = `${year}-${monthIdx}`;
          result[ym] = (result[ym] || 0) + (Number(value) || 0);
        }
      }
    } catch {}
  }
  return result;
}

export default function V2Prognoza() {
  const currentYear = new Date().getFullYear();
  const [horizon, setHorizon] = useState<string>("12");
  const [viewYear, setViewYear] = useState<string>("all");
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showAutoFill, setShowAutoFill] = useState(false);

  const { data, isLoading } = useQuery<ForecastResponse>({
    queryKey: ["/api/v2/financial-forecast"],
  });

  const months = data?.months || [];
  const companyBalance = data?.companyBalance || 0;

  const adjustedMonths = useMemo(() => {
    if (months.length === 0) return months;

    const uniqueYears = [...new Set(months.map(m => m.year))];
    const aptCostsByYM = readLocalAptCosts(uniqueYears);
    const opCostsByYM = readLocalOpCosts(uniqueYears);

    let cumCostOffset = 0;
    let currentMonthPassed = false;

    return months.map((m) => {
      const ym = `${m.year}-${m.month}`;

      // Apartment costs: replace DB value (empty) with localStorage
      const localAptCost = aptCostsByYM[ym] || 0;

      // Operational costs: replace DB value (only wages) with full localStorage data.
      // Only apply diff when localStorage actually has data (avoid wiping DB values when localStorage is empty).
      const localOpCost = opCostsByYM[ym] || 0;
      const opCostDiff = localOpCost > 0 ? (localOpCost - m.operationalCostForecast) : 0;

      // Total extra cost vs what the API already computed
      const extraCost = localAptCost + opCostDiff;

      if (m.isCurrent) {
        currentMonthPassed = true;
      } else if (currentMonthPassed) {
        cumCostOffset += extraCost;
      }

      return {
        ...m,
        apartmentCostForecast: localAptCost > 0 ? localAptCost : m.apartmentCostForecast,
        operationalCostForecast: localOpCost > 0 ? localOpCost : m.operationalCostForecast,
        totalCostForecast: m.totalCostForecast + extraCost,
        monthResult: m.monthResult - extraCost,
        cumulativeBalance: m.cumulativeBalance - cumCostOffset,
      };
    });
  }, [months]);

  const displayMonths = useMemo(() => {
    if (viewYear === "all") return adjustedMonths.slice(0, Number(horizon));
    const y = Number(viewYear);
    return adjustedMonths.filter(m => m.year === y);
  }, [adjustedMonths, horizon, viewYear]);

  const availableYears = useMemo(() => {
    const years = new Set(months.map(m => m.year));
    return Array.from(years).sort();
  }, [months]);

  const chartData = useMemo(() => {
    return displayMonths.map(m => ({
      label: `${MONTHS_SHORT[m.month]} ${String(m.year).slice(2)}`,
      "Przychody": m.revenueForecast + m.subleaseRevenue,
      "Koszty": -m.totalCostForecast,
      "Wynik netto": m.monthResult,
      "Saldo narastająco": m.cumulativeBalance,
    }));
  }, [displayMonths]);

  const balanceChartData = useMemo(() => {
    return displayMonths.map(m => ({
      label: `${MONTHS_SHORT[m.month]} ${String(m.year).slice(2)}`,
      "Saldo": m.cumulativeBalance,
    }));
  }, [displayMonths]);

  const summaryStats = useMemo(() => {
    if (displayMonths.length === 0) return { totalRevenue: 0, totalCosts: 0, totalNet: 0, minBalance: 0, maxBalance: 0, finalBalance: 0 };
    const totalRevenue = displayMonths.reduce((s, m) => s + m.revenueForecast + m.subleaseRevenue, 0);
    const totalCosts = displayMonths.reduce((s, m) => s + m.totalCostForecast, 0);
    const totalNet = displayMonths.reduce((s, m) => s + m.monthResult, 0);
    const balances = displayMonths.map(m => m.cumulativeBalance);
    return {
      totalRevenue,
      totalCosts,
      totalNet,
      minBalance: Math.min(...balances),
      maxBalance: Math.max(...balances),
      finalBalance: balances[balances.length - 1] || 0,
    };
  }, [displayMonths]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Prognoza finansowa" icon={TrendingUp} description="Kompleksowa prognoza finansowa" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="v2-prognoza-page">
      <PageHeader
        title="Prognoza finansowa"
        icon={TrendingUp}
        description="Kompleksowa prognoza finansowa — wynik na koniec każdego miesiąca"
        actions={
          <div className="flex items-center gap-2">
            <Select value={viewYear} onValueChange={setViewYear}>
              <SelectTrigger className="w-[120px]" data-testid="select-view-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Horyzont</SelectItem>
                {availableYears.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {viewYear === "all" && (
              <Select value={horizon} onValueChange={setHorizon}>
                <SelectTrigger className="w-[130px]" data-testid="select-horizon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="6">6 miesięcy</SelectItem>
                  <SelectItem value="12">12 miesięcy</SelectItem>
                  <SelectItem value="24">24 miesiące</SelectItem>
                  <SelectItem value="36">36 miesięcy</SelectItem>
                  <SelectItem value="48">48 miesięcy</SelectItem>
                  <SelectItem value="60">60 miesięcy</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowAutoFill(true)} data-testid="button-auto-fill">
              <Sparkles className="h-4 w-4 mr-1" /> Auto
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCopyDialog(true)} data-testid="button-copy-forecasts">
              <Copy className="h-4 w-4 mr-1" /> Kopiuj
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="card-gradient from-blue-500/10" data-testid="kpi-company-balance">
          <CardContent className="pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium">Saldo firmowe</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{formatNum(companyBalance)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-emerald-500/10" data-testid="kpi-total-revenue">
          <CardContent className="pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium">Suma przychodów</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{formatNum(summaryStats.totalRevenue)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-red-500/10" data-testid="kpi-total-costs">
          <CardContent className="pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium">Suma kosztów</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{formatNum(summaryStats.totalCosts)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-purple-500/10" data-testid="kpi-net-result">
          <CardContent className="pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium">Wynik netto</p>
            <p className={`text-lg font-bold mt-0.5 tabular-nums ${balanceColor(summaryStats.totalNet)}`}>
              {formatNum(summaryStats.totalNet)} PLN
            </p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-cyan-500/10" data-testid="kpi-final-balance">
          <CardContent className="pt-3 pb-2">
            <p className="text-[11px] text-muted-foreground font-medium">Saldo końcowe</p>
            <p className={`text-lg font-bold mt-0.5 tabular-nums ${balanceColor(summaryStats.finalBalance)}`}>
              {formatNum(summaryStats.finalBalance)} PLN
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card data-testid="chart-revenue-costs">
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3">Przychody vs Koszty</h3>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" className="text-[10px]" interval={displayMonths.length > 24 ? 2 : 0} angle={displayMonths.length > 12 ? -45 : 0} textAnchor="end" height={50} />
                <YAxis className="text-[10px]" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Przychody" fill="#00CCFF" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Koszty" fill="hsl(222, 47%, 11%)" radius={[2, 2, 0, 0]} />
                <Line type="monotone" dataKey="Wynik netto" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="chart-balance">
          <CardContent className="pt-4">
            <h3 className="text-sm font-semibold mb-3">Saldo narastająco</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={balanceChartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" className="text-[10px]" interval={displayMonths.length > 24 ? 2 : 0} angle={displayMonths.length > 12 ? -45 : 0} textAnchor="end" height={50} />
                <YAxis className="text-[10px]" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="Saldo" stroke="#00CCFF" fill="#00CCFF" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="forecast-table">
        <CardContent className="pt-4 overflow-x-auto">
          <h3 className="text-sm font-semibold mb-3">Szczegółowa tabela prognozowa</h3>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/30 sticky top-0 z-10">
                <th className="text-left p-2 min-w-[180px] font-medium">Pozycja</th>
                {displayMonths.map((m, i) => (
                  <th key={i} className={`text-right p-2 min-w-[80px] font-medium ${m.isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {MONTHS_SHORT[m.month]} {String(m.year).slice(2)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-emerald-50/30 dark:bg-emerald-950/10">
                <td className="p-2 font-medium flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-emerald-600" /> Przychody (prognoza)
                </td>
                {displayMonths.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400 ${m.isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(m.revenueForecast)}
                  </td>
                ))}
              </tr>
              <tr className="border-b bg-emerald-50/20 dark:bg-emerald-950/5">
                <td className="p-2 font-medium pl-6 text-muted-foreground">w tym rzeczywiste</td>
                {displayMonths.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums ${m.isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {m.actualRevenue > 0 ? formatNum(m.actualRevenue) : "—"}
                  </td>
                ))}
              </tr>
              <tr className="border-b bg-emerald-50/20 dark:bg-emerald-950/5">
                <td className="p-2 font-medium pl-6 text-muted-foreground">w tym podnajmy</td>
                {displayMonths.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums ${m.isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(m.subleaseRevenue)}
                  </td>
                ))}
              </tr>

              <tr className="border-b bg-red-50/30 dark:bg-red-950/10">
                <td className="p-2 font-medium flex items-center gap-1">
                  <Calculator className="h-3 w-3 text-red-600" /> Koszty apartamentowe
                </td>
                {displayMonths.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums text-red-700 dark:text-red-400 ${m.isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(m.apartmentCostForecast)}
                  </td>
                ))}
              </tr>
              <tr className="border-b bg-red-50/20 dark:bg-red-950/5">
                <td className="p-2 font-medium pl-6 text-muted-foreground">Koszty operacyjne</td>
                {displayMonths.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums text-red-700 dark:text-red-400 ${m.isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(m.operationalCostForecast)}
                  </td>
                ))}
              </tr>
              <tr className="border-b bg-red-50/20 dark:bg-red-950/5">
                <td className="p-2 font-medium pl-6 text-muted-foreground">Koszty zmienne</td>
                {displayMonths.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums text-red-700 dark:text-red-400 ${m.isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(m.variableCostForecast)}
                  </td>
                ))}
              </tr>
              <tr className="border-b bg-red-50/30 dark:bg-red-950/10 font-semibold">
                <td className="p-2 font-bold">Razem koszty</td>
                {displayMonths.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums text-red-700 dark:text-red-400 ${m.isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(m.totalCostForecast)}
                  </td>
                ))}
              </tr>

              <tr className="border-b border-t-2 font-bold">
                <td className="p-2 flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Wynik netto miesiąca
                </td>
                {displayMonths.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums font-bold ${balanceColor(m.monthResult)} ${m.isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(m.monthResult)}
                  </td>
                ))}
              </tr>
              <tr className="bg-muted/30 font-bold border-t-2">
                <td className="p-2 flex items-center gap-1">
                  <BarChart3 className="h-3 w-3" /> Saldo narastająco
                </td>
                {displayMonths.map((m, i) => (
                  <td key={i} className={`p-2 text-right tabular-nums font-bold text-base ${balanceColor(m.cumulativeBalance)} ${m.isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(m.cumulativeBalance)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <CopyForecastDialog open={showCopyDialog} onOpenChange={setShowCopyDialog} currentYear={currentYear} />
      <AutoFillDialog open={showAutoFill} onOpenChange={setShowAutoFill} currentYear={currentYear} />
    </div>
  );
}
