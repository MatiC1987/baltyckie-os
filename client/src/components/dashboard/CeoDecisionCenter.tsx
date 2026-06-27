import { useMemo, type ReactNode } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, Wallet, AlertTriangle, CheckCircle2,
  AlertCircle, Clock, ArrowRight, Zap, BarChart3, Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import type { ForecastMonth } from "@/components/RevenueForecastSection";
import type { CompanyBalance, DashboardReminders, SubleasePaymentExtended } from "./widget-utils";

const MONTH_NAMES_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function plnShort(value: number) {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M zł`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}k zł`;
  return `${value.toFixed(0)} zł`;
}

function plnFull(value: number) {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " zł";
}

type Signal = {
  id: string;
  severity: "critical" | "warning" | "ok" | "info";
  label: string;
  detail: string;
  href?: string;
};

type CeoDecisionCenterProps = {
  companyBalance?: CompanyBalance;
  forecastData: ForecastMonth[];
  balanceForecastData?: {
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
  } | null;
  kpiStats: {
    monthRevenue: number;
    monthCount: number;
    revenueChange: number;
    lastMonthRevenue: number;
    unpaidCount: number;
  } | null;
  occupancyPct: number;
  allSubleasePayments: SubleasePaymentExtended[];
  reminders?: DashboardReminders;
};

export function CeoDecisionCenter({
  companyBalance,
  forecastData,
  balanceForecastData,
  kpiStats,
  occupancyPct,
  allSubleasePayments,
  reminders,
}: CeoDecisionCenterProps) {
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(thisYear, thisMonth + 1, 0).getDate();
  const monthProgress = dayOfMonth / daysInMonth;

  const currentMonthForecast = useMemo(() =>
    forecastData.find(m => m.month === thisMonth && m.year === thisYear),
    [forecastData, thisMonth, thisYear]
  );

  const totalBalance = Number(companyBalance?.totalBalance || 0);

  const realizationPct = useMemo(() => {
    if (!currentMonthForecast || currentMonthForecast.forecast <= 0) return null;
    return (currentMonthForecast.actual / currentMonthForecast.forecast) * 100;
  }, [currentMonthForecast]);

  const expectedPct = monthProgress * 100;

  const dailyPace = useMemo(() => {
    if (!currentMonthForecast || dayOfMonth === 0) return null;
    return currentMonthForecast.actual / dayOfMonth;
  }, [currentMonthForecast, dayOfMonth]);

  const projectedRevenue = useMemo(() => {
    if (!dailyPace) return null;
    return dailyPace * daysInMonth;
  }, [dailyPace, daysInMonth]);

  const overdueSubleases = useMemo(() => {
    return allSubleasePayments.filter(p =>
      p.status === "PENDING" && new Date(p.dueDate) < now
    ).length;
  }, [allSubleasePayments]);

  const next3Months = useMemo(() => {
    if (!balanceForecastData?.months) return [];
    return balanceForecastData.months
      .filter(m => {
        const mDate = new Date(m.year, m.month - 1, 1);
        const nowDate = new Date(thisYear, thisMonth, 1);
        return mDate >= nowDate;
      })
      .slice(0, 3);
  }, [balanceForecastData, thisMonth, thisYear]);

  const signals = useMemo((): Signal[] => {
    const result: Signal[] = [];

    if (realizationPct !== null && monthProgress > 0.5) {
      if (realizationPct < 60) {
        result.push({
          id: "forecast-critical",
          severity: "critical",
          label: `Realizacja prognozy: ${realizationPct.toFixed(0)}%`,
          detail: `Oczekiwano ~${expectedPct.toFixed(0)}% przy ${dayOfMonth}. dniu miesiąca`,
          href: "/v2/przychody",
        });
      } else if (realizationPct < 85) {
        result.push({
          id: "forecast-warning",
          severity: "warning",
          label: `Realizacja prognozy: ${realizationPct.toFixed(0)}%`,
          detail: `Oczekiwano ~${expectedPct.toFixed(0)}% przy ${dayOfMonth}. dniu miesiąca`,
          href: "/v2/przychody",
        });
      } else {
        result.push({
          id: "forecast-ok",
          severity: "ok",
          label: `Realizacja prognozy: ${realizationPct.toFixed(0)}%`,
          detail: "Tempo sprzedaży na właściwym poziomie",
          href: "/v2/przychody",
        });
      }
    } else if (realizationPct !== null) {
      result.push({
        id: "forecast-info",
        severity: "info",
        label: `Realizacja prognozy: ${realizationPct.toFixed(0)}%`,
        detail: `${dayOfMonth}. dzień miesiąca — ${(monthProgress * 100).toFixed(0)}% miesiąca minęło`,
        href: "/v2/przychody",
      });
    }

    if (kpiStats && kpiStats.unpaidCount > 0) {
      result.push({
        id: "unpaid-reservations",
        severity: kpiStats.unpaidCount > 5 ? "warning" : "info",
        label: `${kpiStats.unpaidCount} nieopłaconych rezerwacji`,
        detail: "Wymaga weryfikacji i kontaktu z gośćmi",
        href: "/reservations",
      });
    }

    if (overdueSubleases > 0) {
      result.push({
        id: "overdue-subleases",
        severity: "warning",
        label: `${overdueSubleases} zaległych płatności podnajmu`,
        detail: "Przekroczony termin płatności",
        href: "/podnajem",
      });
    }

    if (reminders?.overdueCosts && reminders.overdueCosts > 0) {
      result.push({
        id: "overdue-costs",
        severity: "info",
        label: `${reminders.overdueCosts} niezapłaconych kosztów`,
        detail: "Koszty wymagające rozliczenia",
        href: "/v2/koszty",
      });
    }

    if (reminders?.expiringLeases && reminders.expiringLeases.length > 0) {
      result.push({
        id: "expiring-leases",
        severity: "warning",
        label: `${reminders.expiringLeases.length} umów najmu do wygaśnięcia`,
        detail: "Wymaga odnowienia lub zakończenia",
        href: "/leases",
      });
    }

    if (occupancyPct < 40 && dayOfMonth > 5) {
      result.push({
        id: "low-occupancy",
        severity: "warning",
        label: `Obłożenie: ${occupancyPct}%`,
        detail: "Poniżej optymalnego poziomu dla tego okresu",
        href: "/occupancy",
      });
    }

    if (result.length === 0) {
      result.push({
        id: "all-ok",
        severity: "ok",
        label: "Wszystko pod kontrolą",
        detail: "Brak pilnych spraw wymagających uwagi",
      });
    }

    return result;
  }, [realizationPct, monthProgress, kpiStats, overdueSubleases, reminders, occupancyPct, dayOfMonth, expectedPct]);

  const signalIcon = (severity: Signal["severity"]) => {
    switch (severity) {
      case "critical": return <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />;
      case "warning": return <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-500" />;
      case "ok": return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />;
      case "info": return <Clock className="h-3.5 w-3.5 shrink-0 text-blue-500" />;
    }
  };

  const signalBg = (severity: Signal["severity"]) => {
    switch (severity) {
      case "critical": return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800/50 text-red-800 dark:text-red-200";
      case "warning": return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200";
      case "ok": return "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-200";
      case "info": return "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-200";
    }
  };

  const hasCritical = signals.some(s => s.severity === "critical");
  const hasWarning = signals.some(s => s.severity === "warning");

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-3"
      data-testid="section-ceo-decision-center"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Na co zwrócić uwagę dzisiaj</h2>
          {hasCritical && (
            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Pilne</Badge>
          )}
          {!hasCritical && hasWarning && (
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-400 text-amber-700 dark:text-amber-400">Uwaga</Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{dayOfMonth}. dzień miesiąca · {(monthProgress * 100).toFixed(0)}% miesiąca</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <PriorityKpiCard
          label="Saldo firmowe"
          icon={<Wallet className="h-4 w-4 text-primary" />}
          iconBg="bg-primary/10"
          value={<AnimatedCounter value={totalBalance} suffix=" zł" />}
          valueClass={totalBalance < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}
          sub={
            <span className={totalBalance < 0 ? "text-red-500" : "text-muted-foreground"}>
              {companyBalance?.accounts?.length || 0} kont bankowych
            </span>
          }
          href="/konta-firmowe"
          testId="card-ceo-balance"
        />

        <PriorityKpiCard
          label="Realizacja prognozy"
          icon={<BarChart3 className="h-4 w-4 text-indigo-500" />}
          iconBg="bg-indigo-500/10"
          value={
            realizationPct !== null
              ? <span>{realizationPct.toFixed(0)}%</span>
              : <span className="text-muted-foreground text-base">—</span>
          }
          valueClass={
            realizationPct === null ? "text-muted-foreground" :
            realizationPct >= 85 ? "text-emerald-600 dark:text-emerald-400" :
            realizationPct >= 60 ? "text-amber-600 dark:text-amber-400" :
            "text-red-600 dark:text-red-400"
          }
          sub={
            realizationPct !== null && currentMonthForecast ? (
              <span className="text-muted-foreground">
                {plnShort(currentMonthForecast.actual)} z {plnShort(currentMonthForecast.forecast)}
              </span>
            ) : (
              <span className="text-muted-foreground">brak prognozy</span>
            )
          }
          bar={realizationPct !== null ? {
            actual: realizationPct,
            expected: expectedPct,
          } : undefined}
          href="/v2/przychody"
          testId="card-ceo-forecast"
        />

        <PriorityKpiCard
          label="Tempo sprzedaży"
          icon={<Activity className="h-4 w-4 text-teal-500" />}
          iconBg="bg-teal-500/10"
          value={
            dailyPace !== null
              ? <span>{plnShort(dailyPace)}<span className="text-sm font-normal text-muted-foreground">/dzień</span></span>
              : <span className="text-muted-foreground text-base">—</span>
          }
          valueClass="text-foreground"
          sub={
            projectedRevenue !== null ? (
              <span className="text-muted-foreground">
                Projekcja: {plnShort(projectedRevenue)}
              </span>
            ) : (
              <span className="text-muted-foreground">brak danych</span>
            )
          }
          href="/v2/przychody"
          testId="card-ceo-pace"
        />

        <PriorityKpiCard
          label="Obłożenie miesiąca"
          icon={<BarChart3 className="h-4 w-4 text-cyan-500" />}
          iconBg="bg-cyan-500/10"
          value={<span>{occupancyPct}%</span>}
          valueClass={
            occupancyPct >= 70 ? "text-emerald-600 dark:text-emerald-400" :
            occupancyPct >= 40 ? "text-amber-600 dark:text-amber-400" :
            "text-red-600 dark:text-red-400"
          }
          sub={
            <span className="text-muted-foreground">
              {kpiStats?.monthCount ?? 0} rezerwacji aktywnych
            </span>
          }
          bar={{ actual: occupancyPct, expected: undefined }}
          barColor={occupancyPct >= 70 ? "bg-emerald-500" : occupancyPct >= 40 ? "bg-amber-500" : "bg-red-500"}
          href="/occupancy"
          testId="card-ceo-occupancy"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        <div className="lg:col-span-2 space-y-1.5">
          {signals.map(signal => {
            const inner = (
              <div
                key={signal.id}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs ${signalBg(signal.severity)} ${signal.href ? "cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition-all" : ""}`}
                data-testid={`signal-${signal.id}`}
              >
                {signalIcon(signal.severity)}
                <span className="font-semibold">{signal.label}</span>
                <span className="text-[11px] opacity-70 hidden sm:inline">· {signal.detail}</span>
                {signal.href && <ArrowRight className="h-3 w-3 ml-auto shrink-0 opacity-50" />}
              </div>
            );
            return signal.href ? (
              <Link key={signal.id} href={signal.href}>{inner}</Link>
            ) : (
              <div key={signal.id}>{inner}</div>
            );
          })}
        </div>

        <Card className="border-border/60" data-testid="card-ceo-balance-mini">
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-1.5 mb-2.5">
              <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              <span className="text-xs font-semibold text-foreground">Prognoza salda — 3 miesiące</span>
            </div>
            {next3Months.length > 0 ? (
              <div className="space-y-2">
                {next3Months.map((m, i) => {
                  const isCurrent = m.year === thisYear && m.month === thisMonth + 1;
                  return (
                    <div key={`${m.year}-${m.month}`} className="flex items-center justify-between gap-2" data-testid={`mini-forecast-${m.year}-${m.month}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground w-8">{MONTH_NAMES_SHORT[m.month - 1]}</span>
                        {isCurrent && <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0 leading-none">teraz</Badge>}
                      </div>
                      <div className="flex items-center gap-2 flex-1 justify-end">
                        <div className="flex-1 h-1.5 rounded-full bg-muted max-w-[80px]">
                          <div
                            className={`h-1.5 rounded-full transition-all ${m.endBalance >= 0 ? "bg-green-500" : "bg-red-500"}`}
                            style={{ width: i === 0 ? "60%" : i === 1 ? "50%" : "40%" }}
                          />
                        </div>
                        <span className={`text-xs font-bold tabular-nums w-20 text-right ${m.endBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                          {plnShort(m.endBalance)}
                        </span>
                        {i > 0 && (
                          m.endBalance > next3Months[i - 1].endBalance
                            ? <TrendingUp className="h-3 w-3 text-green-500 shrink-0" />
                            : <TrendingDown className="h-3 w-3 text-red-400 shrink-0" />
                        )}
                        {i === 0 && <span className="w-3" />}
                      </div>
                    </div>
                  );
                })}
                <div className="pt-1 border-t border-border/40">
                  <Link href="/saldo-firmowe">
                    <span className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1">
                      Pełna prognoza 36 mies. <ArrowRight className="h-2.5 w-2.5" />
                    </span>
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Brak danych prognozy</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="h-px bg-border/50 mt-1" />
    </motion.div>
  );
}

function PriorityKpiCard({
  label,
  icon,
  iconBg,
  value,
  valueClass,
  sub,
  bar,
  barColor,
  href,
  testId,
}: {
  label: string;
  icon: ReactNode;
  iconBg: string;
  value: ReactNode;
  valueClass?: string;
  sub?: ReactNode;
  bar?: { actual: number; expected?: number };
  barColor?: string;
  href?: string;
  testId?: string;
}) {
  const inner = (
    <Card
      className={`border-border/60 ${href ? "cursor-pointer hover:border-primary/30 hover:shadow-sm transition-all" : ""}`}
      data-testid={testId}
    >
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-xs text-muted-foreground font-medium leading-tight">{label}</p>
          <div className={`h-7 w-7 rounded-md ${iconBg} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
        </div>
        <p className={`text-xl font-bold leading-tight ${valueClass}`}>{value}</p>
        {bar && (
          <div className="mt-1.5 mb-1 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-muted relative overflow-hidden">
              <div
                className={`h-1.5 rounded-full transition-all ${barColor ?? (bar.actual >= 85 ? "bg-emerald-500" : bar.actual >= 60 ? "bg-amber-500" : "bg-red-500")}`}
                style={{ width: `${Math.min(100, bar.actual)}%` }}
              />
              {bar.expected !== undefined && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-slate-400/60 dark:bg-slate-500/60 rounded-full"
                  style={{ left: `${Math.min(100, bar.expected)}%` }}
                />
              )}
            </div>
          </div>
        )}
        {sub && <div className="text-[11px] mt-0.5">{sub}</div>}
        {href && <ArrowRight className="h-3 w-3 text-muted-foreground/40 mt-1.5" />}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}
