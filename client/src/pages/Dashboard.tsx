import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import { useIsMobile } from "@/hooks/use-mobile";
import { RefreshCw } from "lucide-react";
import { useReservations } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { useAuth } from "@/hooks/use-auth";
import { UserAvatar } from "@/components/UserAvatar";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowUp, ArrowDown, Plane, Wallet, AlertCircle, TrendingUp, Target,
  Upload, X, Settings, LayoutDashboard,
} from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import RevenueForecastSection, { type ForecastMonth } from "@/components/RevenueForecastSection";
import type { Reservation, Lease } from "@shared/schema";
import { Link } from "wouter";

import {
  loadWidgetPrefs, saveWidgetPrefs, calcRemaining, getGreeting,
  type WidgetPrefs, type CompanyBalance, type SubleasePaymentExtended, type DashboardReminders,
} from "@/components/dashboard/widget-utils";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { WidgetSettingsSheet } from "@/components/dashboard/WidgetSettingsSheet";
import { CompanyBalanceCard } from "@/components/dashboard/CompanyBalanceCard";
import { UnpaidArrivalsTab } from "@/components/dashboard/UnpaidArrivalsTab";
import { UpcomingArrivalsTab } from "@/components/dashboard/UpcomingArrivalsTab";
import { UpcomingDeparturesTab } from "@/components/dashboard/UpcomingDeparturesTab";
import { UnpaidSubleasesTab } from "@/components/dashboard/UnpaidSubleasesTab";
import { ExpiringLeasesTab } from "@/components/dashboard/ExpiringLeasesTab";
import { TodayTasksWidget } from "@/components/dashboard/TodayTasksWidget";
import { HrSummaryWidget } from "@/components/dashboard/HrSummaryWidget";
import { RcpSummaryWidget } from "@/components/dashboard/RcpSummaryWidget";
import { RecentActivityWidget } from "@/components/dashboard/RecentActivityWidget";
import { BalanceForecastChartWidget } from "@/components/dashboard/BalanceForecastChartWidget";

function useCompanyBalance() {
  return useQuery<CompanyBalance>({ queryKey: ["/api/company-balance"] });
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: reservations, isLoading: reservationsLoading } = useReservations();
  const { data: apartments } = useApartments();
  const { data: companyBalance, isLoading: balanceLoading } = useCompanyBalance();
  const { data: leases } = useQuery<Lease[]>({ queryKey: ["/api/leases"] });
  const { data: allSubleasePayments } = useQuery<SubleasePaymentExtended[]>({ queryKey: ["/api/dashboard/all-sublease-payments"] });
  const { data: forecastData } = useQuery<ForecastMonth[]>({ queryKey: ["/api/dashboard/revenue-forecast"] });
  const { data: subleases } = useQuery<any[]>({ queryKey: ["/api/subleases"] });
  const { data: expiringTrainings } = useQuery<{ id: number; name: string; status: string; employeeName: string; expiryDate: string | null }[]>({ queryKey: ["/api/employee-trainings/expiring"] });
  const { data: expiringContracts } = useQuery<{ id: number; title: string; employeeName: string; endDate: string | null }[]>({ queryKey: ["/api/employee-contracts/expiring"] });
  const { data: balanceForecastData } = useQuery<{ currentBalance: number; months: { year: number; month: number; endBalance: number; revenueForecast: number; revenueActual: number; aptCostRemaining: number; opCostRemaining: number; surcharges: number }[] }>({ queryKey: ["/api/balance-forecast"] });

  const { data: reminders } = useQuery<DashboardReminders>({ queryKey: ["/api/dashboard-reminders"] });

  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingBalance, setEditingBalance] = useState("");
  const [widgetPrefs, setWidgetPrefs] = useState(loadWidgetPrefs);
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);
  const hotresReminderKey = `hotres-import-reminder-${format(new Date(), "yyyy-MM-dd")}`;
  const [hotresReminderDismissed, setHotresReminderDismissed] = useState(() => !!localStorage.getItem(hotresReminderKey));
  const dismissHotresReminder = () => {
    localStorage.setItem(hotresReminderKey, "1");
    setHotresReminderDismissed(true);
  };

  const handlePrefsChange = (prefs: WidgetPrefs) => {
    saveWidgetPrefs(prefs);
    setWidgetPrefs(prefs);
    fetch("/api/dashboard-widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ widgets: prefs }),
    }).catch(() => {});
  };

  const isVisible = (id: string) => widgetPrefs.visible[id] !== false;

  const updateBalanceMutation = useMutation({
    mutationFn: ({ accountId, balance }: { accountId: number; balance: string }) =>
      apiRequest("POST", "/api/snapshots", {
        accountId,
        date: new Date().toISOString().split("T")[0],
        balance,
        notes: "Ręczna aktualizacja salda",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account-balance-history"] });
      setEditingAccountId(null);
      setEditingBalance("");
    },
  });

  const kpiStats = useMemo(() => {
    if (!reservations) return null;
    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;

    const thisMonthRes = reservations.filter(r => {
      if (!r.startDate) return false;
      const d = new Date(r.startDate);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear && r.status !== "ANULOWANA";
    });
    const monthCount = thisMonthRes.length;

    const currentForecast = forecastData?.find(m => m.month === thisMonth);
    const prevForecast = forecastData?.find(m => m.month === prevMonth);
    const monthRevenue = currentForecast?.actual ?? 0;
    const lastMonthRevenue = prevForecast?.actual ?? 0;
    const revenueChange = lastMonthRevenue > 0 ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue * 100) : 0;

    const unpaidCount = reservations.filter(r => {
      if (r.status === "ANULOWANA") return false;
      return calcRemaining(r) > 0;
    }).length;

    return { monthRevenue, monthCount, revenueChange, lastMonthRevenue, unpaidCount };
  }, [reservations, forecastData]);

  const occupancyPct = useMemo(() => {
    if (!reservations || !apartments || apartments.length === 0) return 0;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalAptNights = apartments.length * daysInMonth;
    if (totalAptNights === 0) return 0;

    let occupiedNights = 0;
    reservations.forEach(r => {
      if (r.status === "ANULOWANA" || !r.startDate || !r.endDate) return;
      const start = new Date(r.startDate);
      const end = new Date(r.endDate);
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      const overlapStart = start > monthStart ? start : monthStart;
      const overlapEnd = end < monthEnd ? end : monthEnd;
      if (overlapStart <= overlapEnd) {
        const nights = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24));
        if (nights > 0) occupiedNights += nights;
      }
    });

    if (subleases) {
      subleases.forEach(s => {
        if (!s.startDate || !s.endDate) return;
        const start = new Date(s.startDate);
        const end = new Date(s.endDate);
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 0);
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        if (overlapStart <= overlapEnd) {
          const aptCount = Array.isArray(s.apartmentIds) && s.apartmentIds.length > 0
            ? s.apartmentIds.length
            : (s.apartmentId ? 1 : 0);
          const nights = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          if (nights > 0 && aptCount > 0) occupiedNights += nights * aptCount;
        }
      });
    }

    return Math.min(100, Math.round((occupiedNights / totalAptNights) * 100));
  }, [reservations, apartments, subleases]);

  const isMobile = useIsMobile();
  const { pullY, isRefreshing: isPullRefreshing, handlers: pullHandlers } = usePullRefresh({
    onRefresh: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/revenue-forecast"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-reminders"] }),
    ]).then(() => {}),
  });

  if (reservationsLoading && !reservations) {
    return <DashboardSkeleton />;
  }

  const todayFormatted = format(new Date(), "EEEE, d MMMM yyyy", { locale: pl });
  const greeting = getGreeting();
  const userName = user?.firstName || "";

  return (
    <div
      className="space-y-6"
      onTouchStart={isMobile ? pullHandlers.onTouchStart : undefined}
      onTouchMove={isMobile ? pullHandlers.onTouchMove : undefined}
      onTouchEnd={isMobile ? pullHandlers.onTouchEnd : undefined}
    >
      {isMobile && (pullY > 0 || isPullRefreshing) && (
        <div className="flex items-center justify-center transition-all" style={{ height: isPullRefreshing ? 48 : pullY }}>
          <RefreshCw className={`h-5 w-5 text-muted-foreground ${isPullRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullY * 3}deg)` }} />
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            {user?.id ? (
              <UserAvatar userId={user.id} firstName={user.firstName} lastName={user.lastName} size="lg" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0" data-testid="icon-dashboard">
                <LayoutDashboard className="h-5 w-5" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">
              {greeting}{userName ? `, ${userName}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground capitalize" data-testid="text-dashboard-date">{todayFormatted}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowWidgetSettings(true)} data-testid="button-widget-settings">
          <Settings className="h-4 w-4 mr-1" /> Widżety
        </Button>
      </div>

      {!hotresReminderDismissed && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800" data-testid="alert-hotres-reminder">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                Pamiętaj o codziennym imporcie rezerwacji z HotRes
              </AlertDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/import-export">
                <Button variant="outline" size="sm" className="h-7 text-xs border-amber-300 dark:border-amber-700" data-testid="button-hotres-import">
                  Przejdź do importu
                </Button>
              </Link>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={dismissHotresReminder} data-testid="button-hotres-dismiss">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {widgetPrefs.order.map(widgetId => {
        if (!isVisible(widgetId)) return null;
        switch (widgetId) {
          case "kpi":
            return kpiStats ? (
              <div key="kpi" className="grid gap-3 grid-cols-2 lg:grid-cols-5">
                <Card className="kpi-card card-gradient card-gradient-green" data-testid="card-kpi-revenue">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground font-medium">Przychód (ten miesiąc)</p>
                      <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                    </div>
                    <p className="text-lg sm:text-xl font-bold mt-1">
                      <AnimatedCounter value={kpiStats.monthRevenue} suffix=" zł" />
                    </p>
                    {kpiStats.lastMonthRevenue > 0 && (
                      <p className={`text-xs mt-1 flex items-center gap-1 ${kpiStats.revenueChange >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                        {kpiStats.revenueChange >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {Math.abs(kpiStats.revenueChange).toFixed(1)}% vs poprzedni mies.
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className="kpi-card card-gradient" data-testid="card-kpi-reservations">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground font-medium">Rezerwacje (ten miesiąc)</p>
                      <div className="h-8 w-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Plane className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                    <p className="text-lg sm:text-xl font-bold mt-1">{kpiStats.monthCount}</p>
                    <p className="text-xs text-muted-foreground mt-1">aktywnych rezerwacji</p>
                  </CardContent>
                </Card>
                <Card className="kpi-card card-gradient card-gradient-orange" data-testid="card-kpi-unpaid">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground font-medium">Do opłacenia</p>
                      <div className={`h-8 w-8 rounded-md flex items-center justify-center shrink-0 ${kpiStats.unpaidCount > 0 ? "bg-amber-500/10" : "bg-muted/50"}`}>
                        <AlertCircle className={`h-4 w-4 ${kpiStats.unpaidCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
                      </div>
                    </div>
                    <p className={`text-lg sm:text-xl font-bold mt-1 ${kpiStats.unpaidCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                      {kpiStats.unpaidCount}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">nieopłaconych rezerwacji</p>
                  </CardContent>
                </Card>
                <Card className="kpi-card card-gradient card-gradient-purple" data-testid="card-kpi-balance">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground font-medium">Saldo firmowe</p>
                      <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        <Wallet className="h-4 w-4 text-primary" />
                      </div>
                    </div>
                    <p className={`text-lg sm:text-xl font-bold mt-1 ${Number(companyBalance?.totalBalance || 0) < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                      <AnimatedCounter value={Number(companyBalance?.totalBalance || 0)} suffix=" zł" />
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">łączne saldo kont</p>
                  </CardContent>
                </Card>
                <Card className="kpi-card card-gradient" data-testid="card-kpi-occupancy">
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground font-medium">Obłożenie (ten miesiąc)</p>
                      <div className="h-8 w-8 rounded-md bg-cyan-500/10 flex items-center justify-center shrink-0">
                        <Target className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                    </div>
                    <p className="text-lg sm:text-xl font-bold mt-1">{occupancyPct}%</p>
                    <div className="mt-1.5">
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className={`h-2 rounded-full transition-all ${occupancyPct >= 70 ? "bg-emerald-500" : occupancyPct >= 40 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${occupancyPct}%` }}
                          data-testid="progress-occupancy"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null;
          case "quick-actions":
            return <QuickActions key="quick-actions" />;
          case "balance":
            return (
              <CompanyBalanceCard
                key="balance"
                companyBalance={companyBalance}
                balanceLoading={balanceLoading}
                editingAccountId={editingAccountId}
                editingBalance={editingBalance}
                setEditingAccountId={setEditingAccountId}
                setEditingBalance={setEditingBalance}
                updateBalanceMutation={updateBalanceMutation}
              />
            );
          case "forecast":
            return <RevenueForecastSection key="forecast" forecastData={forecastData || []} />;
          case "balance-forecast-chart":
            return <BalanceForecastChartWidget key="balance-forecast-chart" data={balanceForecastData} />;
          case "unpaid-arrivals":
            return <UnpaidArrivalsTab key="unpaid-arrivals" reservations={reservations || []} apartments={apartments || []} isLoading={reservationsLoading} reminders={reminders} expiringTrainings={expiringTrainings} expiringContracts={expiringContracts} />;
          case "upcoming-arrivals":
            return <UpcomingArrivalsTab key="upcoming-arrivals" reservations={reservations || []} apartments={apartments || []} isLoading={reservationsLoading} />;
          case "upcoming-departures":
            return <UpcomingDeparturesTab key="upcoming-departures" reservations={reservations || []} apartments={apartments || []} isLoading={reservationsLoading} />;
          case "unpaid-subleases":
            return <UnpaidSubleasesTab key="unpaid-subleases" payments={allSubleasePayments || []} apartments={apartments || []} />;
          case "expiring-leases":
            return <ExpiringLeasesTab key="expiring-leases" leases={leases || []} apartments={apartments || []} />;
          case "today-tasks":
            return <TodayTasksWidget key="today-tasks" />;
          case "rcp-summary":
            return <RcpSummaryWidget key="rcp-summary" />;
          case "recent-activity":
            return <RecentActivityWidget key="recent-activity" />;
          case "hr-summary":
            return <HrSummaryWidget key="hr-summary" reminders={reminders} />;
          default:
            return null;
        }
      })}

      <WidgetSettingsSheet open={showWidgetSettings} onOpenChange={setShowWidgetSettings} prefs={widgetPrefs} onPrefsChange={handlePrefsChange} />
    </div>
  );
}
