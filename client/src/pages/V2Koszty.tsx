import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AnimatedTabContent } from "@/components/AnimatedTabContent";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calculator, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { CopyForecastDialog } from "@/components/v2/CopyForecastDialog";
import { CostsExpensesContent } from "@/pages/CostsExpenses";
import { CostsApartmentsContent } from "@/pages/CostsApartments";

const MONTHS_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const MONTHS_PL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

const EMPTY_MONTHLY = Array.from({ length: 12 }, () => ({ p: 0, r: 0 }));

function formatNum(v: number): string {
  if (v === 0) return "—";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function costPctColor(pct: number) {
  if (pct <= 0) return { text: "text-muted-foreground", bar: "bg-muted", exceeded: false };
  if (pct < 0.85) return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-emerald-500", exceeded: false };
  if (pct < 1.0) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-amber-500", exceeded: false };
  return { text: "text-red-600 dark:text-red-400", bar: "bg-red-500", exceeded: true };
}

function CostTile({ title, prognoza, realized }: { title: string; prognoza: number; realized: number }) {
  const pct = prognoza > 0 ? realized / prognoza : 0;
  const saldo = prognoza - realized;
  const color = costPctColor(pct);

  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-lg sm:text-xl font-bold mt-1 tabular-nums">{formatNum(prognoza)} zł</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Zrealizowane: <span className="font-medium text-foreground">{formatNum(realized)} zł</span>
        </p>
        {prognoza > 0 && (
          <>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 bg-muted rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${color.bar}`}
                  style={{ width: `${Math.min(100, pct * 100)}%` }}
                />
              </div>
              <span className={`text-xs font-semibold tabular-nums ${color.text}`}>
                {(pct * 100).toFixed(0)}%
              </span>
              {color.exceeded && (
                <Badge variant="destructive" className="text-[10px] px-1 py-0">Przekroczono</Badge>
              )}
            </div>
            <p className={`text-xs mt-1 tabular-nums ${saldo >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              Saldo: {saldo >= 0 ? "+" : ""}{formatNum(saldo)} zł
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function V2Koszty() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState("dashboard");
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [clickedMonth, setClickedMonth] = useState<number | null>(null);

  const [aptAnnual, setAptAnnual] = useState({ p: 0, r: 0 });
  const [opAnnual, setOpAnnual] = useState({ p: 0, r: 0 });
  const [aptMonthly, setAptMonthly] = useState<Array<{ p: number; r: number }>>(EMPTY_MONTHLY);
  const [opMonthly, setOpMonthly] = useState<Array<{ p: number; r: number }>>(EMPTY_MONTHLY);

  const handleAptTotals = useCallback((p: number, r: number) => setAptAnnual({ p, r }), []);
  const handleOpTotals = useCallback((p: number, r: number) => setOpAnnual({ p, r }), []);
  const handleAptMonthly = useCallback((data: Array<{ p: number; r: number }>) => setAptMonthly(data), []);
  const handleOpMonthly = useCallback((data: Array<{ p: number; r: number }>) => setOpMonthly(data), []);

  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear - 4; y <= currentYear + 5; y++) arr.push(y);
    return arr;
  }, [currentYear]);

  const monthlyTotals = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const apt = aptMonthly[i] ?? { p: 0, r: 0 };
      const op = opMonthly[i] ?? { p: 0, r: 0 };
      return { apt_p: apt.p, apt_r: apt.r, op_p: op.p, op_r: op.r, total_p: apt.p + op.p, total_r: apt.r + op.r };
    });
  }, [aptMonthly, opMonthly]);

  const currentMonthTotals = useMemo(
    () => monthlyTotals[currentMonth] ?? { apt_p: 0, apt_r: 0, op_p: 0, op_r: 0, total_p: 0, total_r: 0 },
    [monthlyTotals, currentMonth]
  );

  const chartData = useMemo(() => {
    let cumulative = 0;
    return monthlyTotals.map((m, i) => {
      cumulative += m.total_r;
      return {
        name: MONTHS_SHORT[i],
        Prognoza: Math.round(m.total_p),
        Realizacja: Math.round(m.total_r),
        Kumulatywna: Math.round(cumulative),
        monthIndex: i,
      };
    });
  }, [monthlyTotals]);

  const handleChartClick = useCallback((data: any) => {
    const idx = data?.activePayload?.[0]?.payload?.monthIndex;
    if (idx !== undefined) {
      setTab("apartamentowe");
      setClickedMonth(idx);
    }
  }, []);

  return (
    <div className="space-y-4" data-testid="v2-koszty-page">
      <PageHeader
        title="Koszty"
        icon={Calculator}
        description="Koszty apartamentowe i operacyjne"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="icon" disabled={year <= years[0]} onClick={() => setYear(y => y - 1)} data-testid="button-prev-year">
              <ChevronLeft className="h-4 w-4" />
            </Button>
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
            <Button variant="outline" size="icon" disabled={year >= years[years.length - 1]} onClick={() => setYear(y => y + 1)} data-testid="button-next-year">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCopyDialog(true)} data-testid="button-copy-costs">
              <Copy className="h-4 w-4 sm:mr-1" /> <span className="hidden sm:inline">Kopiuj</span>
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="costs-tabs">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="apartamentowe" data-testid="tab-apt-costs">Apartamenty</TabsTrigger>
          <TabsTrigger value="operacyjne" data-testid="tab-op-costs">Operacyjne</TabsTrigger>
        </TabsList>

        <AnimatedTabContent value="dashboard" activeValue={tab} className="space-y-4 mt-4">
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">Rok {year} — podsumowanie roczne</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3" data-testid="v2-koszty-tiles">
              <CostTile title="Koszty (apartamenty)" prognoza={aptAnnual.p} realized={aptAnnual.r} />
              <CostTile title="Koszty operacyjne" prognoza={opAnnual.p} realized={opAnnual.r} />
              <CostTile title="Razem koszty" prognoza={aptAnnual.p + opAnnual.p} realized={aptAnnual.r + opAnnual.r} />
            </div>
          </div>

          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-2">
              {MONTHS_PL[currentMonth]} {year} — bieżący miesiąc
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3" data-testid="v2-koszty-month-tiles">
              <CostTile title="Koszty (apartamenty)" prognoza={currentMonthTotals.apt_p} realized={currentMonthTotals.apt_r} />
              <CostTile title="Koszty operacyjne" prognoza={currentMonthTotals.op_p} realized={currentMonthTotals.op_r} />
              <CostTile title="Razem koszty" prognoza={currentMonthTotals.total_p} realized={currentMonthTotals.total_r} />
            </div>
          </div>

          <Card data-testid="costs-monthly-chart">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Koszty miesięczne — {year}</p>
                <p className="text-[10px] text-muted-foreground">Kliknij miesiąc → przejdź do szczegółów</p>
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={chartData} onClick={handleChartClick} className="cursor-pointer">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis yAxisId="left" className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis yAxisId="right" orientation="right" className="text-xs" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString("pl-PL")} zł`} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="Prognoza" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="Realizacja" fill="#00CCFF" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" dataKey="Kumulatywna" stroke="#f59e0b" strokeWidth={2} dot={false} type="monotone" name="Kumulatywna (realizacja)" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </AnimatedTabContent>

        <TabsContent value="apartamentowe" forceMount className="data-[state=inactive]:hidden">
          <CostsApartmentsContent
            embedded
            externalYear={year}
            onTotalsChange={handleAptTotals}
            onMonthlyDataChange={handleAptMonthly}
            triggerMonthHighlight={clickedMonth}
            onMonthHighlightDone={() => setClickedMonth(null)}
          />
        </TabsContent>

        <TabsContent value="operacyjne" forceMount className="data-[state=inactive]:hidden">
          <CostsExpensesContent
            embedded
            externalYear={year}
            onTotalsChange={handleOpTotals}
            onMonthlyDataChange={handleOpMonthly}
          />
        </TabsContent>
      </Tabs>

      <CopyForecastDialog open={showCopyDialog} onOpenChange={setShowCopyDialog} currentYear={year} defaultTypes={["cost", "operational"]} />
    </div>
  );
}
