import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

type CompanyBalance = {
  accounts: { id: number; name: string; type: string | null; latestBalance: string }[];
  totalBalance: string;
};

type RevenueData = Record<number, Record<number, { najem: number; podnajem: number; doplaty_najem: number; doplaty_podnajem: number }>>;

function formatNum(v: number): string {
  if (v === 0) return "";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumAlways(v: number): string {
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function saldoColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "";
}

function loadForecastData(year: number): Record<string, Record<number, { p: number; r: number }>> {
  try {
    const raw = localStorage.getItem(`forecast-data-${year}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function loadCostsApartmentsData(year: number): Record<string, Record<number, { p: number; r: number }>> {
  try {
    const raw = localStorage.getItem(`costs-apartments-data-${year}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

interface CostItem { name: string; subLabel?: string; }
interface CostCategory { id: string; title: string; color: string; items: CostItem[]; }

function loadOplatyCategories(): CostCategory[] {
  try {
    const raw = localStorage.getItem("oplaty-categories");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function loadOplatyData(year: number): Record<string, number> {
  try {
    const raw = localStorage.getItem(`oplaty-data-${year}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function makeCellKey(catId: string, itemIdx: number, month: number, field: "prognoza" | "rzeczywiste"): string {
  return `${catId}__${itemIdx}__${month}__${field}`;
}

export default function FinanceForecast() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);

  const { data: companyBalance } = useQuery<CompanyBalance>({ queryKey: ["/api/company-balance"] });
  const { data: revenueData = {} } = useQuery<RevenueData>({ queryKey: [`/api/revenue?year=${year}`] });

  const forecastData = useMemo(() => loadForecastData(year), [year]);
  const costsAptData = useMemo(() => loadCostsApartmentsData(year), [year]);
  const oplatyCategories = useMemo(() => loadOplatyCategories(), []);
  const oplatyData = useMemo(() => loadOplatyData(year), [year]);

  const monthlyData = useMemo(() => {
    const months: {
      month: number;
      forecastRevenue: number;
      actualRevenue: number;
      doplaty: number;
      costsForecast: number;
      costsActual: number;
      oplatyForecast: number;
      oplatyActual: number;
    }[] = [];

    for (let m = 0; m < 12; m++) {
      let forecastRevenue = 0;
      let actualRevenue = 0;
      let doplaty = 0;

      Object.keys(forecastData).forEach(key => {
        const cell = forecastData[key]?.[m];
        if (cell) {
          forecastRevenue += cell.p || 0;
        }
      });

      Object.keys(revenueData).forEach(aptIdStr => {
        const aptMonths = revenueData[Number(aptIdStr)];
        if (aptMonths?.[m]) {
          actualRevenue += (aptMonths[m].najem || 0) + (aptMonths[m].podnajem || 0);
          doplaty += (aptMonths[m].doplaty_najem || 0) + (aptMonths[m].doplaty_podnajem || 0);
        }
      });

      let costsForecast = 0;
      let costsActual = 0;
      Object.keys(costsAptData).forEach(key => {
        const cell = costsAptData[key]?.[m];
        if (cell) {
          costsForecast += cell.p || 0;
          costsActual += cell.r || 0;
        }
      });

      let oplatyForecast = 0;
      let oplatyActual = 0;
      oplatyCategories.forEach(cat => {
        cat.items.forEach((_, itemIdx) => {
          const pKey = makeCellKey(cat.id, itemIdx, m, "prognoza");
          const rKey = makeCellKey(cat.id, itemIdx, m, "rzeczywiste");
          oplatyForecast += oplatyData[pKey] || 0;
          oplatyActual += oplatyData[rKey] || 0;
        });
      });

      months.push({ month: m, forecastRevenue, actualRevenue, doplaty, costsForecast, costsActual, oplatyForecast, oplatyActual });
    }
    return months;
  }, [forecastData, revenueData, costsAptData, oplatyCategories, oplatyData]);

  const currentBalance = useMemo(() => Number(companyBalance?.totalBalance || 0), [companyBalance]);

  const balanceForecast = useMemo(() => {
    const forecasts: { month: string; balance: number; monthIdx: number }[] = [];
    let runningBalance = currentBalance;

    for (let m = 0; m < 12; m++) {
      const md = monthlyData[m];
      const isCurrent = year === currentYear && m === currentMonth;
      const isFuture = year > currentYear || (year === currentYear && m > currentMonth);

      if (isCurrent) {
        forecasts.push({ month: MONTHS[m], balance: runningBalance, monthIdx: m });
      } else if (isFuture) {
        const inflow = (md.forecastRevenue || 0) + (md.doplaty || 0);
        const outflow = (md.costsForecast || 0) + (md.oplatyForecast || 0);
        runningBalance += inflow - outflow;
        forecasts.push({ month: MONTHS[m], balance: runningBalance, monthIdx: m });
      }
    }
    return forecasts;
  }, [monthlyData, currentBalance, year, currentYear, currentMonth]);

  type RowDef = {
    label: string;
    key: string;
    isBold: boolean;
    isPositive: boolean;
    isDeviation?: boolean;
    forecastKey?: string;
    actualKey?: string;
  };

  const rows: RowDef[] = [
    { label: "PROGNOZA PRZYCH.", key: "forecastRevenue", isBold: false, isPositive: true },
    { label: "RZECZ. PRZYCHODY", key: "actualRevenue", isBold: true, isPositive: true },
    { label: "ODCHYLENIE PRZYCH.", key: "dev-revenue", isBold: false, isPositive: true, isDeviation: true, forecastKey: "forecastRevenue", actualKey: "actualRevenue" },
    { label: "DOPŁATY (oczek.)", key: "doplaty", isBold: false, isPositive: true },
    { label: "PROGN. KOSZTY APT.", key: "costsForecast", isBold: false, isPositive: false },
    { label: "RZECZ. KOSZTY APT.", key: "costsActual", isBold: true, isPositive: false },
    { label: "ODCHYLENIE KOSZTÓW", key: "dev-costs", isBold: false, isPositive: false, isDeviation: true, forecastKey: "costsForecast", actualKey: "costsActual" },
    { label: "PROGN. OPŁATY", key: "oplatyForecast", isBold: false, isPositive: false },
    { label: "RZECZ. OPŁATY", key: "oplatyActual", isBold: true, isPositive: false },
    { label: "ODCHYLENIE OPŁAT", key: "dev-oplaty", isBold: false, isPositive: false, isDeviation: true, forecastKey: "oplatyForecast", actualKey: "oplatyActual" },
  ];

  const currentMonthBg = "rgba(90, 219, 250, 0.1)";
  const isCurrentMonth = (i: number) => i === currentMonth && year === currentYear;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader title="Finanse / Prognoza" description="Prognoza przychodów i analiza trendów." icon={TrendingUp} actions={
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]" data-testid="select-forecast-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        } />
      </div>

      <Card data-testid="card-balance-forecast">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 flex-wrap text-lg">
            <Wallet className="h-5 w-5" />
            Prognoza salda firmowego
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Aktualny stan: <span className="font-bold" data-testid="text-current-balance">{formatNumAlways(currentBalance)} PLN</span>
            {" "}— projekcja na kolejne miesiące uwzględniająca przychody, dopłaty, koszty apartamentów i opłaty
          </p>
        </CardHeader>
        <CardContent>
          {balanceForecast.length > 0 && (
            <div className="h-[280px] mb-4" data-testid="chart-balance-forecast">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={balanceForecast} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${formatNumAlways(value)} PLN`, "Saldo"]}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" />
                  <defs>
                    <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" fill="url(#balanceGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="rounded-md border border-border overflow-x-auto" data-testid="table-balance-detail">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-3 py-2 border-b border-border font-medium text-muted-foreground min-w-[180px]">Miesiąc</th>
                  {balanceForecast.map(f => (
                    <th key={f.monthIdx} className="px-3 py-2 border-b border-border text-center font-medium" style={isCurrentMonth(f.monthIdx) ? { backgroundColor: currentMonthBg } : undefined} data-testid={`th-forecast-month-${f.monthIdx}`}>
                      {f.month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-3 py-2 border-b border-border font-semibold" data-testid="label-forecast-saldo">Prognozowane saldo</td>
                  {balanceForecast.map(f => (
                    <td key={f.monthIdx} className={`px-3 py-2 border-b border-border text-center font-bold tabular-nums ${saldoColor(f.balance)}`} style={isCurrentMonth(f.monthIdx) ? { backgroundColor: currentMonthBg } : undefined} data-testid={`text-forecast-balance-${f.monthIdx}`}>
                      {formatNumAlways(f.balance)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="px-3 py-2 border-b border-border text-muted-foreground">+ Przychody (prognoza)</td>
                  {balanceForecast.map(f => {
                    const md = monthlyData[f.monthIdx];
                    return (
                      <td key={f.monthIdx} className="px-3 py-2 border-b border-border text-center tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatNum(md.forecastRevenue)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-3 py-2 border-b border-border text-muted-foreground">+ Dopłaty (oczekiwane)</td>
                  {balanceForecast.map(f => {
                    const md = monthlyData[f.monthIdx];
                    return (
                      <td key={f.monthIdx} className="px-3 py-2 border-b border-border text-center tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatNum(md.doplaty)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-3 py-2 border-b border-border text-muted-foreground">- Koszty apartamentów</td>
                  {balanceForecast.map(f => {
                    const md = monthlyData[f.monthIdx];
                    return (
                      <td key={f.monthIdx} className="px-3 py-2 border-b border-border text-center tabular-nums text-red-600 dark:text-red-400">
                        {formatNum(md.costsForecast)}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="px-3 py-2 text-muted-foreground">- Opłaty</td>
                  {balanceForecast.map(f => {
                    const md = monthlyData[f.monthIdx];
                    return (
                      <td key={f.monthIdx} className="px-3 py-2 text-center tabular-nums text-red-600 dark:text-red-400">
                        {formatNum(md.oplatyForecast)}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-monthly-pnl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 flex-wrap text-lg">
            <TrendingUp className="h-5 w-5" />
            Zestawienie miesięczne
          </CardTitle>
          <p className="text-sm text-muted-foreground">Przychody, koszty i opłaty — prognoza vs. rzeczywiste</p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto">
            <table className="w-full text-xs border-collapse" data-testid="table-monthly-pnl">
              <thead>
                <tr className="bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 text-left px-3 py-2 border-r border-b border-border min-w-[180px] font-medium text-muted-foreground">Pozycja</th>
                  {MONTHS.map((m, i) => (
                    <th key={i} className="px-2 py-2 border-b border-border text-center font-medium min-w-[90px]" style={isCurrentMonth(i) ? { backgroundColor: currentMonthBg } : undefined} data-testid={`th-pnl-month-${i}`}>
                      {m}
                    </th>
                  ))}
                  <th className="px-2 py-2 border-b border-border text-center font-bold min-w-[100px] bg-muted/30">RAZEM</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  if (row.isDeviation && row.forecastKey && row.actualKey) {
                    let totalDev = 0;
                    return (
                      <tr key={row.key} className="bg-muted/20" data-testid={`row-pnl-${row.key}`}>
                        <td className="sticky left-0 z-10 bg-muted/20 px-3 py-1.5 border-r border-b border-border text-muted-foreground whitespace-nowrap text-[11px] italic">
                          {row.label}
                        </td>
                        {monthlyData.map((md, i) => {
                          const actual = (md as any)[row.actualKey!] as number;
                          const forecast = (md as any)[row.forecastKey!] as number;
                          const diff = actual - forecast;
                          totalDev += diff;
                          const pct = forecast !== 0 ? ((diff / forecast) * 100) : 0;
                          const hasData = actual !== 0 || forecast !== 0;
                          const deviationColor = diff > 0
                            ? (row.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")
                            : diff < 0
                              ? (row.isPositive ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")
                              : "";
                          return (
                            <td key={i} className={`px-2 py-1.5 border-b border-border text-right tabular-nums text-[11px] ${deviationColor}`} style={isCurrentMonth(i) ? { backgroundColor: currentMonthBg } : undefined} data-testid={`cell-pnl-${row.key}-${i}`}>
                              {hasData ? (
                                <div>
                                  <div>{diff >= 0 ? "+" : ""}{formatNum(diff)} zł</div>
                                  <div className="text-[10px] opacity-70">{diff >= 0 ? "+" : ""}{pct.toFixed(1)}%</div>
                                </div>
                              ) : ""}
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 border-b border-border text-right tabular-nums text-[11px] font-bold bg-muted/10" data-testid={`cell-pnl-${row.key}-total`}>
                          {totalDev !== 0 ? `${totalDev >= 0 ? "+" : ""}${formatNum(totalDev)} zł` : ""}
                        </td>
                      </tr>
                    );
                  }
                  let total = 0;
                  return (
                    <tr key={row.key} data-testid={`row-pnl-${row.key}`}>
                      <td className={`sticky left-0 z-10 bg-card px-3 py-2 border-r border-b border-border ${row.isBold ? "font-bold" : "text-muted-foreground"} whitespace-nowrap`}>
                        {row.label}
                      </td>
                      {monthlyData.map((md, i) => {
                        const val = (md as any)[row.key] as number;
                        total += val;
                        return (
                          <td key={i} className={`px-2 py-2 border-b border-border text-right tabular-nums ${row.isBold ? "font-semibold" : ""} ${val > 0 ? (row.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : ""}`} style={isCurrentMonth(i) ? { backgroundColor: currentMonthBg } : undefined} data-testid={`cell-pnl-${row.key}-${i}`}>
                            {formatNum(val)}
                          </td>
                        );
                      })}
                      <td className={`px-2 py-2 border-b border-border text-right tabular-nums font-bold bg-muted/10 ${total > 0 ? (row.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400") : ""}`} data-testid={`cell-pnl-${row.key}-total`}>
                        {formatNum(total)}
                      </td>
                    </tr>
                  );
                })}

                <tr className="bg-muted/30 font-bold" data-testid="row-pnl-saldo-forecast">
                  <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2 border-r border-b border-border">
                    SALDO PROGNOZA
                  </td>
                  {monthlyData.map((md, i) => {
                    const saldo = md.forecastRevenue + md.doplaty - md.costsForecast - md.oplatyForecast;
                    return (
                      <td key={i} className={`px-2 py-2 border-b border-border text-right tabular-nums ${saldoColor(saldo)}`} style={isCurrentMonth(i) ? { backgroundColor: currentMonthBg } : undefined} data-testid={`cell-saldo-forecast-${i}`}>
                        {formatNum(saldo)}
                      </td>
                    );
                  })}
                  <td className={`px-2 py-2 border-b border-border text-right tabular-nums bg-muted/10 ${saldoColor(monthlyData.reduce((s, md) => s + md.forecastRevenue + md.doplaty - md.costsForecast - md.oplatyForecast, 0))}`} data-testid="cell-saldo-forecast-total">
                    {formatNum(monthlyData.reduce((s, md) => s + md.forecastRevenue + md.doplaty - md.costsForecast - md.oplatyForecast, 0))}
                  </td>
                </tr>

                <tr className="bg-muted/30 font-bold" data-testid="row-pnl-saldo-actual">
                  <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2 border-r border-b border-border">
                    SALDO RZECZYWISTE
                  </td>
                  {monthlyData.map((md, i) => {
                    const saldo = md.actualRevenue - md.costsActual - md.oplatyActual;
                    return (
                      <td key={i} className={`px-2 py-2 border-b border-border text-right tabular-nums ${saldoColor(saldo)}`} style={isCurrentMonth(i) ? { backgroundColor: currentMonthBg } : undefined} data-testid={`cell-saldo-actual-${i}`}>
                        {formatNum(saldo)}
                      </td>
                    );
                  })}
                  <td className={`px-2 py-2 border-b border-border text-right tabular-nums bg-muted/10 ${saldoColor(monthlyData.reduce((s, md) => s + md.actualRevenue - md.costsActual - md.oplatyActual, 0))}`} data-testid="cell-saldo-actual-total">
                    {formatNum(monthlyData.reduce((s, md) => s + md.actualRevenue - md.costsActual - md.oplatyActual, 0))}
                  </td>
                </tr>

                <tr className="bg-muted/20 italic" data-testid="row-pnl-saldo-deviation">
                  <td className="sticky left-0 z-10 bg-muted/20 px-3 py-1.5 border-r border-border text-muted-foreground whitespace-nowrap text-[11px]">
                    ODCHYLENIE SALDA
                  </td>
                  {monthlyData.map((md, i) => {
                    const saldoForecast = md.forecastRevenue + md.doplaty - md.costsForecast - md.oplatyForecast;
                    const saldoActual = md.actualRevenue - md.costsActual - md.oplatyActual;
                    const diff = saldoActual - saldoForecast;
                    const pct = saldoForecast !== 0 ? ((diff / Math.abs(saldoForecast)) * 100) : 0;
                    const hasData = saldoActual !== 0 || saldoForecast !== 0;
                    const color = diff > 0 ? "text-emerald-600 dark:text-emerald-400" : diff < 0 ? "text-red-600 dark:text-red-400" : "";
                    return (
                      <td key={i} className={`px-2 py-1.5 text-right tabular-nums text-[11px] ${color}`} style={isCurrentMonth(i) ? { backgroundColor: currentMonthBg } : undefined} data-testid={`cell-saldo-deviation-${i}`}>
                        {hasData ? (
                          <div>
                            <div>{diff >= 0 ? "+" : ""}{formatNum(diff)} zł</div>
                            <div className="text-[10px] opacity-70">{diff >= 0 ? "+" : ""}{pct.toFixed(1)}%</div>
                          </div>
                        ) : ""}
                      </td>
                    );
                  })}
                  {(() => {
                    const totalForecast = monthlyData.reduce((s, md) => s + md.forecastRevenue + md.doplaty - md.costsForecast - md.oplatyForecast, 0);
                    const totalActual = monthlyData.reduce((s, md) => s + md.actualRevenue - md.costsActual - md.oplatyActual, 0);
                    const totalDiff = totalActual - totalForecast;
                    return (
                      <td className={`px-2 py-1.5 text-right tabular-nums text-[11px] font-bold bg-muted/10 ${totalDiff > 0 ? "text-emerald-600 dark:text-emerald-400" : totalDiff < 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="cell-saldo-deviation-total">
                        {totalDiff !== 0 ? `${totalDiff >= 0 ? "+" : ""}${formatNum(totalDiff)} zł` : ""}
                      </td>
                    );
                  })()}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
