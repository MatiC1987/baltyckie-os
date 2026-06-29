import { useState, useMemo, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
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
  Upload, X, Settings, LayoutDashboard, GripVertical, Check,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const kpiContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const kpiCardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import RevenueForecastSection, { type ForecastMonth } from "@/components/RevenueForecastSection";
import type { Reservation, Lease } from "@shared/schema";
import { Link } from "wouter";

import {
  loadWidgetPrefs, saveWidgetPrefs, mergeWidgetPrefs, calcRemaining, getGreeting,
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
import { HrSummaryWidget } from "@/components/dashboard/HrSummaryWidget";
import { RcpSummaryWidget } from "@/components/dashboard/RcpSummaryWidget";
import { RecentActivityWidget } from "@/components/dashboard/RecentActivityWidget";
import { BalanceForecastChartWidget } from "@/components/dashboard/BalanceForecastChartWidget";
import { TodayReservationsWidget } from "@/components/dashboard/TodayReservationsWidget";

function SortableWidget({ id, isEditMode, children }: { id: string; isEditMode: boolean; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
  };

  return (
    <div ref={setNodeRef} style={style} data-testid={`sortable-widget-${id}`}>
      {isEditMode && (
        <div
          {...attributes}
          {...listeners}
          className="absolute -left-1 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-7 h-10 rounded-md bg-muted/80 border border-border cursor-grab active:cursor-grabbing"
          data-testid={`drag-handle-${id}`}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className={isEditMode ? "ml-7 ring-1 ring-dashed ring-border rounded-md" : ""}>
        {children}
      </div>
    </div>
  );
}

function useCompanyBalance() {
  return useQuery<CompanyBalance>({ queryKey: ["/api/company-balance"] });
}

export default function Dashboard() {
  const { toast } = useToast();
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
  const { data: dbWidgetPrefs } = useQuery<WidgetPrefs | null>({ queryKey: ["/api/dashboard-widgets"] });

  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingBalance, setEditingBalance] = useState("");
  const [widgetPrefs, setWidgetPrefs] = useState(loadWidgetPrefs);
  const [showWidgetSettings, setShowWidgetSettings] = useState(false);
  const dbPrefsApplied = useRef(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (dbPrefsApplied.current) return;
    if (dbWidgetPrefs === undefined) return;
    dbPrefsApplied.current = true;
    if (dbWidgetPrefs && typeof dbWidgetPrefs === "object") {
      const merged = mergeWidgetPrefs(dbWidgetPrefs);
      saveWidgetPrefs(merged);
      setWidgetPrefs(merged);
    }
  }, [dbWidgetPrefs]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = widgetPrefs.order.indexOf(active.id as string);
      const newIndex = widgetPrefs.order.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(widgetPrefs.order, oldIndex, newIndex);
        handlePrefsChange({ ...widgetPrefs, order: newOrder });
      }
    }
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
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się zaktualizować salda", variant: "destructive" });
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
    if (!reservations || !apartments) return 0;
    const activeApts = apartments.filter(a => a.active !== false);
    if (activeApts.length === 0) return 0;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalAptNights = activeApts.length * daysInMonth;
    if (totalAptNights === 0) return 0;

    const activeAptIds = new Set(activeApts.map(a => a.id));

    let occupiedNights = 0;
    reservations.forEach(r => {
      if (r.status === "ANULOWANA" || !r.startDate || !r.endDate) return;
      if (r.apartmentId && !activeAptIds.has(r.apartmentId)) return;
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
          const activeSubAptIds = Array.isArray(s.apartmentIds) && s.apartmentIds.length > 0
            ? (s.apartmentIds as number[]).filter(id => activeAptIds.has(id))
            : (s.apartmentId && activeAptIds.has(s.apartmentId) ? [s.apartmentId] : []);
          const aptCount = activeSubAptIds.length;
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

  const visibleWidgetIds = useMemo(() =>
    widgetPrefs.order.filter(id => isVisible(id)),
    [widgetPrefs]
  );

  if (reservationsLoading && !reservations) {
    return <DashboardSkeleton />;
  }

  const todayFormatted = format(new Date(), "EEEE, d MMMM yyyy", { locale: pl });
  const greeting = getGreeting();
  const userName = user?.firstName || "";

  const renderWidget = (widgetId: string) => {
    switch (widgetId) {
      case "kpi":
        return kpiStats ? (
          <motion.div
            className="grid gap-3 grid-cols-2 lg:grid-cols-5"
            variants={kpiContainerVariants}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={kpiCardVariants}>
              <Card className="kpi-card card-gradient card-gradient-green h-full" data-testid="card-kpi-revenue">
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
            </motion.div>
            <motion.div variants={kpiCardVariants}>
              <Card className="kpi-card card-gradient h-full" data-testid="card-kpi-reservations">
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
            </motion.div>
            <motion.div variants={kpiCardVariants}>
              <Card className="kpi-card card-gradient card-gradient-orange h-full" data-testid="card-kpi-unpaid">
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
            </motion.div>
            <motion.div variants={kpiCardVariants}>
              <Card className="kpi-card card-gradient card-gradient-purple h-full" data-testid="card-kpi-balance">
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
            </motion.div>
            <motion.div variants={kpiCardVariants}>
              <Card className="kpi-card card-gradient h-full" data-testid="card-kpi-occupancy">
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
            </motion.div>
          </motion.div>
        ) : null;
      case "quick-actions":
        return <QuickActions />;
      case "today-reservations":
        return (
          <TodayReservationsWidget
            reservations={reservations || []}
            forecastData={forecastData || []}
          />
        );
      case "balance":
        return (
          <CompanyBalanceCard
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
        return <RevenueForecastSection forecastData={forecastData || []} />;
      case "balance-forecast-chart":
        return <BalanceForecastChartWidget data={balanceForecastData} />;
      case "unpaid-arrivals":
        return <UnpaidArrivalsTab reservations={reservations || []} apartments={apartments || []} isLoading={reservationsLoading} reminders={reminders} expiringTrainings={expiringTrainings} expiringContracts={expiringContracts} />;
      case "upcoming-arrivals":
        return <UpcomingArrivalsTab reservations={reservations || []} apartments={apartments || []} isLoading={reservationsLoading} />;
      case "upcoming-departures":
        return <UpcomingDeparturesTab reservations={reservations || []} apartments={apartments || []} isLoading={reservationsLoading} />;
      case "unpaid-subleases":
        return <UnpaidSubleasesTab payments={allSubleasePayments || []} apartments={apartments || []} />;
      case "expiring-leases":
        return <ExpiringLeasesTab leases={leases || []} apartments={apartments || []} expiredLeases={reminders?.expiredLeases || []} expiringLeases={reminders?.expiringLeases} />;
      case "rcp-summary":
        return <RcpSummaryWidget />;
      case "recent-activity":
        return <RecentActivityWidget />;
      case "hr-summary":
        return <HrSummaryWidget reminders={reminders} />;
      default:
        return null;
    }
  };

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
        <div className="flex items-center gap-2 flex-wrap">
          {isEditMode ? (
            <Button variant="default" size="sm" onClick={() => setIsEditMode(false)} data-testid="button-save-layout">
              <Check className="h-4 w-4 mr-1" /> Zapisz układ
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} data-testid="button-edit-layout">
              <GripVertical className="h-4 w-4 mr-1" /> Edytuj układ
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowWidgetSettings(true)} data-testid="button-widget-settings">
            <Settings className="h-4 w-4 mr-1" /> Widżety
          </Button>
        </div>
      </div>


      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleWidgetIds} strategy={verticalListSortingStrategy}>
          {visibleWidgetIds.map(widgetId => (
            <SortableWidget key={widgetId} id={widgetId} isEditMode={isEditMode}>
              {renderWidget(widgetId)}
            </SortableWidget>
          ))}
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className="opacity-80 shadow-lg rounded-xl border bg-card p-4 flex items-center gap-3">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">{activeId}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <WidgetSettingsSheet open={showWidgetSettings} onOpenChange={setShowWidgetSettings} prefs={widgetPrefs} onPrefsChange={handlePrefsChange} />
    </div>
  );
}
