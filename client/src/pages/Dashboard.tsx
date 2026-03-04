import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useReservations } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { useAuth } from "@/hooks/use-auth";
import { UserAvatar } from "@/components/UserAvatar";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { differenceInDays, format, formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import {
  ArrowUp, ArrowDown, ArrowUpDown, Plane, PlaneTakeoff, Wallet, Landmark, Banknote, Bitcoin, HandCoins, Pencil, Check, X, AlertCircle, CalendarClock, FileWarning, TrendingUp, Target, Scale,
  Plus, Receipt, FileSignature, Download, LayoutDashboard, Wrench, Settings, Eye, EyeOff, ChevronUp, ChevronDown as ChevronDownIcon, Upload, GraduationCap,
  Users, Activity, Clock, PlusCircle, Trash2 as Trash2Icon, Coffee, MapPin, Home, FileText,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useLocation } from "wouter";
import { DashboardSkeleton } from "@/components/PageSkeleton";
import { ReservationForm } from "@/pages/Reservations";
import type { Reservation, Lease, SubleasePayment, Loan, LoanPayment } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import RevenueForecastSection, { type ForecastMonth } from "@/components/RevenueForecastSection";
import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";

type WidgetDef = {
  id: string;
  label: string;
  category: "financial" | "operational" | "admin";
  defaultVisible: boolean;
  description: string;
};

const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "kpi", label: "Wskaźniki KPI", category: "financial", defaultVisible: true, description: "Przychód, rezerwacje, nieopłacone, saldo" },
  { id: "balance", label: "Saldo firmowe", category: "financial", defaultVisible: true, description: "Salda kont bankowych" },
  { id: "forecast", label: "Prognoza przychodów", category: "financial", defaultVisible: true, description: "Realizacja prognozy miesięcznej" },
  { id: "balance-forecast-chart", label: "Saldo firmowe — prognoza", category: "financial", defaultVisible: true, description: "Wykres salda firmowego na 36 miesięcy" },
  { id: "unpaid-subleases", label: "Nieopłacone podnajmy", category: "financial", defaultVisible: true, description: "Zaległe płatności podnajmu" },
  { id: "quick-actions", label: "Szybkie akcje", category: "operational", defaultVisible: true, description: "Skróty do tworzenia rezerwacji, wydatków" },
  { id: "unpaid-arrivals", label: "Nieopłacone przyjazdy", category: "operational", defaultVisible: true, description: "Zakończone rezerwacje z dopłatą" },
  { id: "upcoming-arrivals", label: "Najbliższe przyjazdy", category: "operational", defaultVisible: true, description: "Rezerwacje w ciągu 7 dni" },
  { id: "upcoming-departures", label: "Najbliższe wyjazdy", category: "operational", defaultVisible: true, description: "Wyjazdy w ciągu 7 dni" },
  { id: "expiring-leases", label: "Kończące się umowy", category: "admin", defaultVisible: true, description: "Umowy najmu kończące się w 6 miesięcy" },
  { id: "today-tasks", label: "Zadania na dziś", category: "operational", defaultVisible: true, description: "Zadania z terminem na dziś" },
  { id: "rcp-summary", label: "RCP — Pracownicy", category: "operational", defaultVisible: true, description: "Obecność i godziny pracowników" },
  { id: "recent-activity", label: "Ostatnia aktywność", category: "operational", defaultVisible: true, description: "Feed ostatnich zdarzeń w systemie" },
  { id: "hr-summary", label: "Kadry — podsumowanie", category: "admin", defaultVisible: true, description: "Alerty kadrowe: umowy, badania, szkolenia" },
];

const PREFS_KEY = "dashboard-widget-prefs";

type WidgetPrefs = {
  visible: Record<string, boolean>;
  order: string[];
};

function getDefaultPrefs(): WidgetPrefs {
  return {
    visible: Object.fromEntries(WIDGET_REGISTRY.map(w => [w.id, w.defaultVisible])),
    order: WIDGET_REGISTRY.map(w => w.id),
  };
}

function loadWidgetPrefs(): WidgetPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const defaults = getDefaultPrefs();
      const order = [...parsed.order || []];
      for (const w of WIDGET_REGISTRY) {
        if (!order.includes(w.id)) order.push(w.id);
      }
      return {
        visible: { ...defaults.visible, ...(parsed.visible || {}) },
        order: order.filter(id => WIDGET_REGISTRY.some(w => w.id === id)),
      };
    }
  } catch {}
  return getDefaultPrefs();
}

function saveWidgetPrefs(prefs: WidgetPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

type CompanyBalanceAccount = {
  id: number;
  name: string;
  type: string | null;
  category: string | null;
  balanceSource: string | null;
  latestBalance: string;
};

type CompanyBalance = {
  accounts: CompanyBalanceAccount[];
  totalBalance: string;
};

function getAccountIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("pekao") || lower.includes("santander")) return Landmark;
  if (lower.includes("saldo")) return Scale;
  if (lower.includes("krypto")) return Bitcoin;
  if (lower.includes("pożyczki")) return HandCoins;
  return Wallet;
}

type SubleasePaymentExtended = SubleasePayment & {
  subleaseTenantName: string;
  subleaseApartmentIds: number[];
};

function useCompanyBalance() {
  return useQuery<CompanyBalance>({ queryKey: ["/api/company-balance"] });
}

type SortField = "reservationNumber" | "addDate" | "apartmentName" | "startDate" | "endDate" | "guestName" | "price" | "prepayment" | "paidAmount" | "remaining" | "status";
type SortDir = "asc" | "desc";

function getApartmentName(reservation: Reservation, apartments: any[]): string {
  if (!reservation.apartmentId) return "—";
  const apt = apartments.find((a: any) => a.id === reservation.apartmentId);
  return apt?.name || "—";
}

function calcRemaining(r: Reservation): number {
  const price = Number(r.price) || 0;
  const prepayment = Number(r.prepayment) || 0;
  const paid = Number(r.paidAmount) || 0;
  return Math.max(0, price - prepayment - paid);
}

function statusLabel(status: string): string {
  switch (status) {
    case "DO_OPLACENIA": return "DO OPŁACENIA";
    case "PRZYJETA": return "PRZYJĘTA";
    case "ANULOWANA": return "ANULOWANA";
    default: return status;
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PRZYJETA": return "default";
    case "ANULOWANA": return "destructive";
    case "DO_OPLACENIA": return "secondary";
    default: return "outline";
  }
}

function QuickActions() {
  const [, navigate] = useLocation();
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const actions = [
    { label: "Nowa rezerwacja", shortLabel: "Rezerwacja", icon: Plus, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10", action: () => setShowReservationDialog(true), testId: "button-quick-reservation" },
    { label: "Nowy wydatek", shortLabel: "Wydatek", icon: Receipt, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10", action: () => navigate("/koszty-operacyjne?action=new"), testId: "button-quick-expense" },
    { label: "Nowy podnajem", shortLabel: "Podnajem", icon: FileSignature, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-500/10", action: () => navigate("/podnajem?action=new"), testId: "button-quick-sublease" },
    { label: "Dodaj fakturę", shortLabel: "Faktura", icon: Receipt, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", action: () => navigate("/dokumenty-ksiegowe"), testId: "button-quick-cost-invoice" },
    { label: "Backup danych", shortLabel: "Backup", icon: Download, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", action: () => navigate("/import-export"), testId: "button-quick-backup" },
  ];
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {actions.map(a => (
          <Card key={a.testId} className="hover-elevate cursor-pointer" onClick={a.action} data-testid={a.testId}>
            <CardContent className="py-3 px-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-md ${a.bg} flex items-center justify-center shrink-0`}>
                <a.icon className={`h-4 w-4 ${a.color}`} />
              </div>
              <span className="text-sm font-medium">
                <span className="hidden sm:inline">{a.label}</span>
                <span className="sm:hidden">{a.shortLabel}</span>
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Dialog open={showReservationDialog} onOpenChange={setShowReservationDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nowa rezerwacja</DialogTitle>
          </DialogHeader>
          <ReservationForm onSuccess={() => { setShowReservationDialog(false); navigate("/reservations"); }} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Dobrej nocy";
  if (hour < 12) return "Dzień dobry";
  if (hour < 18) return "Dzień dobry";
  return "Dobry wieczór";
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

  const { data: reminders } = useQuery<{
    expiringExams: { id: number; examName: string; validUntil: string; employeeName: string }[];
    overdueCosts: number;
    overdueSubleasePayments: number;
    upcomingArrivals: number;
    expiringLeases: { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null }[];
    expiringSubleases: { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null }[];
    upcomingInspections: { id: number; inspectionType: string; nextDate: string; apartmentId: number | null; isOverdue: boolean }[];
  }>({ queryKey: ["/api/dashboard-reminders"] });
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

  if (reservationsLoading && !reservations) {
    return <DashboardSkeleton />;
  }

  const todayFormatted = format(new Date(), "EEEE, d MMMM yyyy", { locale: pl });
  const greeting = getGreeting();
  const userName = user?.firstName || "";

  return (
    <div className="space-y-6">
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
            return <HrSummaryWidget key="hr-summary" />;
          default:
            return null;
        }
      })}

      <WidgetSettingsSheet open={showWidgetSettings} onOpenChange={setShowWidgetSettings} prefs={widgetPrefs} onPrefsChange={handlePrefsChange} />
    </div>
  );
}

function WidgetSettingsSheet({ open, onOpenChange, prefs, onPrefsChange }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefs: WidgetPrefs;
  onPrefsChange: (prefs: WidgetPrefs) => void;
}) {
  const categoryLabels: Record<string, string> = { financial: "Finansowe", operational: "Operacyjne", admin: "Administracyjne" };

  const toggleWidget = (id: string) => {
    const newPrefs = { ...prefs, visible: { ...prefs.visible, [id]: !prefs.visible[id] } };
    onPrefsChange(newPrefs);
  };

  const moveWidget = (id: string, direction: "up" | "down") => {
    const order = [...prefs.order];
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= order.length) return;
    [order[idx], order[targetIdx]] = [order[targetIdx], order[idx]];
    onPrefsChange({ ...prefs, order });
  };

  const resetDefaults = () => {
    onPrefsChange(getDefaultPrefs());
  };

  const orderedWidgets = prefs.order
    .map(id => WIDGET_REGISTRY.find(w => w.id === id))
    .filter((w): w is WidgetDef => !!w);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[350px] sm:w-[400px] flex flex-col" data-testid="sheet-widget-settings">
        <SheetHeader>
          <SheetTitle>Konfiguracja widżetów</SheetTitle>
        </SheetHeader>
        <div className="py-4 space-y-2 flex-1 overflow-y-auto">
          <p className="text-xs text-muted-foreground mb-3">Włącz/wyłącz widżety i zmień ich kolejność strzałkami.</p>
          {orderedWidgets.map((w, idx) => (
            <div key={w.id} className="flex items-center gap-1.5 py-1.5 px-2 rounded-md border border-border" data-testid={`widget-toggle-${w.id}`}>
              <div className="flex flex-col shrink-0">
                <button
                  onClick={() => moveWidget(w.id, "up")}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                  data-testid={`widget-move-up-${w.id}`}
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveWidget(w.id, "down")}
                  disabled={idx === orderedWidgets.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-20 p-0.5"
                  data-testid={`widget-move-down-${w.id}`}
                >
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                  {w.label}
                  <Badge variant="outline" className="text-[9px]">{categoryLabels[w.category]}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">{w.description}</div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => toggleWidget(w.id)}
                className={`shrink-0 toggle-elevate ${prefs.visible[w.id] ? "toggle-elevated" : ""}`}
                data-testid={`button-toggle-widget-${w.id}`}
              >
                {prefs.visible[w.id] ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={resetDefaults} className="w-full mt-4" data-testid="button-reset-widget-defaults">
            Przywróć domyślne
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MiniSparkline({ data, color, accountId }: { data: { value: number }[]; color: string; accountId?: number }) {
  if (data.length < 2) return null;
  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 64;
  const height = 24;
  const padding = 2;
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((v - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });
  return (
    <svg width={width} height={height} className="shrink-0" data-testid={accountId ? `sparkline-account-${accountId}` : undefined}>
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  KONTA_BANKOWE: "Konta bankowe",
  GOTOWKA: "Gotówka",
  INNE: "Inne",
};

const CATEGORY_ORDER = ["KONTA_BANKOWE", "GOTOWKA", "INNE"];

type LoanWithPayments = Loan & { payments: LoanPayment[]; totalPaid: string; remaining: string };

function LoansDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const { data: loansData, isLoading } = useQuery<LoanWithPayments[]>({
    queryKey: ["/api/loans"],
    enabled: open,
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDebtor, setNewDebtor] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [payingLoanId, setPayingLoanId] = useState<number | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payNotes, setPayNotes] = useState("");

  const [expandedLoanId, setExpandedLoanId] = useState<number | null>(null);

  const createLoanMutation = useMutation({
    mutationFn: async (data: { title: string; debtor: string; amount: string; notes?: string }) => {
      return apiRequest("POST", "/api/loans", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      setShowAddForm(false);
      setNewTitle(""); setNewDebtor(""); setNewAmount(""); setNewNotes("");
      toast({ title: "Pożyczka dodana" });
    },
  });

  const deleteLoanMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/loans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      toast({ title: "Pożyczka usunięta" });
    },
  });

  const createPaymentMutation = useMutation({
    mutationFn: async (data: { loanId: number; amount: string; date: string; notes?: string }) => {
      return apiRequest("POST", "/api/loan-payments", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      setPayingLoanId(null);
      setPayAmount(""); setPayDate(new Date().toISOString().split("T")[0]); setPayNotes("");
      toast({ title: "Spłata zarejestrowana" });
    },
  });

  const deletePaymentMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/loan-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/loans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      toast({ title: "Spłata usunięta" });
    },
  });

  const totalRemaining = loansData?.reduce((s, l) => s + Number(l.remaining), 0) || 0;
  const totalLoaned = loansData?.reduce((s, l) => s + Number(l.amount), 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-loans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="h-5 w-5" />
            Zarządzanie pożyczkami
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 p-3 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Łączna kwota pożyczek</div>
              <div className="text-xl font-bold">{totalLoaned.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Pozostało do spłaty</div>
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">{totalRemaining.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
            </div>
          </div>
        </div>

        {!showAddForm ? (
          <Button onClick={() => setShowAddForm(true)} size="sm" className="mb-3" data-testid="button-add-loan">
            <Plus className="h-4 w-4 mr-1" /> Dodaj pożyczkę
          </Button>
        ) : (
          <div className="border rounded-lg p-3 mb-3 space-y-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tytuł *</Label>
                <Input value={newTitle} onChange={(e: any) => setNewTitle(e.target.value)} placeholder="np. Pożyczka na remont" className="h-8 text-sm" data-testid="input-loan-title" />
              </div>
              <div>
                <Label className="text-xs">Dłużnik *</Label>
                <Input value={newDebtor} onChange={(e: any) => setNewDebtor(e.target.value)} placeholder="np. Jan Kowalski" className="h-8 text-sm" data-testid="input-loan-debtor" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Kwota (PLN) *</Label>
                <Input type="number" step="0.01" value={newAmount} onChange={(e: any) => setNewAmount(e.target.value)} placeholder="0.00" className="h-8 text-sm" data-testid="input-loan-amount" />
              </div>
              <div>
                <Label className="text-xs">Notatki</Label>
                <Input value={newNotes} onChange={(e: any) => setNewNotes(e.target.value)} placeholder="Opcjonalne" className="h-8 text-sm" data-testid="input-loan-notes" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={!newTitle || !newDebtor || !newAmount || createLoanMutation.isPending}
                onClick={() => createLoanMutation.mutate({ title: newTitle, debtor: newDebtor, amount: newAmount, notes: newNotes || undefined })}
                data-testid="button-save-loan"
              >
                <Check className="h-3 w-3 mr-1" /> Zapisz
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowAddForm(false); setNewTitle(""); setNewDebtor(""); setNewAmount(""); setNewNotes(""); }}
                data-testid="button-cancel-loan"
              >
                Anuluj
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
        ) : !loansData || loansData.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Brak pożyczek. Dodaj pierwszą pożyczkę powyżej.</div>
        ) : (
          <div className="space-y-2">
            {loansData.map(loan => {
              const remaining = Number(loan.remaining);
              const total = Number(loan.amount);
              const paid = Number(loan.totalPaid);
              const paidPct = total > 0 ? (paid / total) * 100 : 0;
              const isExpanded = expandedLoanId === loan.id;
              const isPaying = payingLoanId === loan.id;

              return (
                <div key={loan.id} className="border rounded-lg overflow-hidden" data-testid={`card-loan-${loan.id}`}>
                  <div
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm truncate">{loan.title}</span>
                          {remaining <= 0 && <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">SPŁACONA</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{loan.debtor}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold">{total.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
                        {remaining > 0 && (
                          <div className="text-xs text-orange-600 dark:text-orange-400">
                            pozostało: {remaining.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 w-full bg-muted rounded-full h-1.5">
                      <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(paidPct, 100)}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-muted-foreground">Spłacono {paidPct.toFixed(0)}%</span>
                      {loan.notes && <span className="text-[10px] text-muted-foreground italic truncate max-w-[150px]">{loan.notes}</span>}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t bg-muted/20 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-muted-foreground uppercase">Historia spłat</span>
                        <div className="flex gap-1">
                          {remaining > 0 && (
                            <Button size="sm" variant="outline" className="h-7 text-xs"
                              onClick={(e) => { e.stopPropagation(); setPayingLoanId(isPaying ? null : loan.id); setPayAmount(""); }}
                              data-testid={`button-add-payment-${loan.id}`}
                            >
                              <Plus className="h-3 w-3 mr-1" /> Spłata
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); if (confirm("Usunąć tę pożyczkę?")) deleteLoanMutation.mutate(loan.id); }}
                            data-testid={`button-delete-loan-${loan.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      {isPaying && (
                        <div className="border rounded-md p-2 space-y-2 bg-background">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Label className="text-[10px]">Kwota *</Label>
                              <Input type="number" step="0.01" value={payAmount} onChange={(e: any) => setPayAmount(e.target.value)}
                                placeholder={remaining.toFixed(2)} className="h-7 text-xs" data-testid={`input-payment-amount-${loan.id}`} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Data *</Label>
                              <Input type="date" value={payDate} onChange={(e: any) => setPayDate(e.target.value)}
                                className="h-7 text-xs" data-testid={`input-payment-date-${loan.id}`} />
                            </div>
                            <div>
                              <Label className="text-[10px]">Notatka</Label>
                              <Input value={payNotes} onChange={(e: any) => setPayNotes(e.target.value)}
                                placeholder="Opcjonalnie" className="h-7 text-xs" data-testid={`input-payment-notes-${loan.id}`} />
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 text-xs"
                              disabled={!payAmount || !payDate || createPaymentMutation.isPending}
                              onClick={() => createPaymentMutation.mutate({ loanId: loan.id, amount: payAmount, date: payDate, notes: payNotes || undefined })}
                              data-testid={`button-save-payment-${loan.id}`}
                            >
                              <Check className="h-3 w-3 mr-1" /> Zapisz spłatę
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={() => { setPayingLoanId(null); setPayAmount(""); setPayNotes(""); }}
                            >
                              Anuluj
                            </Button>
                          </div>
                        </div>
                      )}

                      {loan.payments.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center py-2">Brak spłat</div>
                      ) : (
                        <div className="space-y-1">
                          {loan.payments.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/50 group" data-testid={`row-payment-${p.id}`}>
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{format(new Date(p.date), "dd.MM.yyyy")}</span>
                                <span className="font-medium text-green-600 dark:text-green-400">
                                  +{Number(p.amount).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                                </span>
                                {p.notes && <span className="text-muted-foreground italic">{p.notes}</span>}
                              </div>
                              <button
                                onClick={(e) => { e.stopPropagation(); if (confirm("Usunąć tę spłatę?")) deletePaymentMutation.mutate(p.id); }}
                                className="invisible group-hover:visible text-destructive hover:text-destructive/80"
                                data-testid={`button-delete-payment-${p.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CompanyBalanceCard({
  companyBalance, balanceLoading, editingAccountId, editingBalance,
  setEditingAccountId, setEditingBalance, updateBalanceMutation,
}: any) {
  const [loansDialogOpen, setLoansDialogOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };
  const saldoLinkMap: Record<string, string> = {
    "Saldo - M. Cieślak": "/saldo-mc",
    "Saldo - M. Latasiewicz": "/saldo-ml",
    "Saldo - J. Głodkowska": "/saldo-jg",
  };

  const { data: balanceHistory } = useQuery<Record<number, { date: string; balance: string }[]>>({
    queryKey: ["/api/account-balance-history"],
  });

  const totalBalance = Number(companyBalance?.totalBalance || 0);

  const totalChange = useMemo(() => {
    if (!balanceHistory || !companyBalance?.accounts) return null;
    let currentTotal = 0;
    let previousTotal = 0;
    let hasPrevious = false;
    for (const acc of companyBalance.accounts) {
      const current = Number(acc.latestBalance);
      currentTotal += current;
      const history = balanceHistory[acc.id];
      if (history && history.length >= 2) {
        previousTotal += Number(history[history.length - 2].balance);
        hasPrevious = true;
      } else {
        previousTotal += current;
      }
    }
    if (!hasPrevious) return null;
    const diff = currentTotal - previousTotal;
    const pct = previousTotal !== 0 ? ((diff / Math.abs(previousTotal)) * 100) : 0;
    return { diff, pct };
  }, [balanceHistory, companyBalance]);

  const groupedAccounts = useMemo(() => {
    if (!companyBalance?.accounts) return {};
    const groups: Record<string, CompanyBalanceAccount[]> = {};
    for (const acc of companyBalance.accounts) {
      const cat = acc.category || "INNE";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(acc);
    }
    return groups;
  }, [companyBalance]);

  const getAccountChange = (accId: number, currentBalance: number) => {
    if (!balanceHistory?.[accId] || balanceHistory[accId].length < 2) return null;
    const history = balanceHistory[accId];
    const prev = Number(history[history.length - 2].balance);
    const diff = currentBalance - prev;
    const pct = prev !== 0 ? ((diff / Math.abs(prev)) * 100) : 0;
    return { diff, pct };
  };

  const getSparklineData = (accId: number) => {
    if (!balanceHistory?.[accId]) return [];
    return balanceHistory[accId].map(s => ({ value: Number(s.balance) }));
  };

  const renderAccountCard = (acc: CompanyBalanceAccount) => {
    const Icon = getAccountIcon(acc.name);
    const balance = Number(acc.latestBalance);
    const isEditing = editingAccountId === acc.id;
    const isAuto = acc.balanceSource === "auto_saldo" || acc.balanceSource === "auto_loans";
    const saldoLink = saldoLinkMap[acc.name];
    const isLoan = acc.type === "LOAN";
    const change = getAccountChange(acc.id, balance);
    const sparkData = getSparklineData(acc.id);
    const sparkColor = change && change.diff >= 0 ? "#22c55e" : change && change.diff < 0 ? "#ef4444" : "#94a3b8";

    const content = (
      <>
        <div className="flex items-center gap-1.5 mb-1">
          <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-[11px] text-muted-foreground truncate leading-tight">{acc.name}</span>
          {isAuto && <span className="text-[9px] text-muted-foreground/50 italic ml-auto">auto</span>}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  step="0.01"
                  value={editingBalance}
                  onChange={(e: any) => setEditingBalance(e.target.value)}
                  onKeyDown={(e: any) => {
                    if (e.key === "Enter" && editingBalance.trim()) {
                      updateBalanceMutation.mutate({ accountId: acc.id, balance: editingBalance.trim() });
                    }
                    if (e.key === "Escape") { setEditingAccountId(null); setEditingBalance(""); }
                  }}
                  className="h-6 text-xs w-20"
                  autoFocus
                  data-testid={`input-balance-${acc.id}`}
                />
                <Button size="sm" variant="ghost"
                  onClick={() => { if (editingBalance.trim()) updateBalanceMutation.mutate({ accountId: acc.id, balance: editingBalance.trim() }); }}
                  disabled={!editingBalance.trim() || updateBalanceMutation.isPending}
                  data-testid={`button-save-balance-${acc.id}`}
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost"
                  onClick={() => { setEditingAccountId(null); setEditingBalance(""); }}
                  data-testid={`button-cancel-balance-${acc.id}`}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 group/edit">
                <span className={`text-sm font-bold ${balance < 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid={`text-account-balance-${acc.id}`}>
                  {balance.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                </span>
                {!isAuto && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingAccountId(acc.id); setEditingBalance(balance.toString()); }}
                    className="invisible group-hover/edit:visible text-muted-foreground hover:text-foreground"
                    data-testid={`button-edit-balance-${acc.id}`}
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
            {change && (
              <div className={`flex items-center gap-0.5 mt-0.5 ${change.diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid={`text-account-change-${acc.id}`}>
                {change.diff >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                <span className="text-[10px] font-medium">
                  {change.diff >= 0 ? "+" : ""}{change.diff.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł
                </span>
                <span className="text-[9px] text-muted-foreground">
                  ({change.pct >= 0 ? "+" : ""}{change.pct.toFixed(1)}%)
                </span>
              </div>
            )}
          </div>
          <MiniSparkline data={sparkData} color={sparkColor} accountId={acc.id} />
        </div>
      </>
    );

    if (isLoan) {
      return (
        <button
          key={acc.id}
          onClick={() => setLoansDialogOpen(true)}
          className="rounded-lg border border-border p-2.5 hover-elevate block text-left w-full"
          data-testid={`card-account-balance-${acc.id}`}
        >
          {content}
        </button>
      );
    }

    if (isAuto && saldoLink) {
      return (
        <Link
          key={acc.id}
          href={saldoLink}
          className="rounded-lg border border-border p-2.5 hover-elevate block"
          data-testid={`card-account-balance-${acc.id}`}
        >
          {content}
        </Link>
      );
    }

    return (
      <div key={acc.id} className="rounded-lg border border-border p-2.5" data-testid={`card-account-balance-${acc.id}`}>
        {content}
      </div>
    );
  };

  return (
    <Card data-testid="card-company-balance">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="h-4 w-4" />
          Saldo firmowe
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        {balanceLoading ? (
          <div className="space-y-3">
            <div className="h-16 bg-muted animate-pulse rounded-lg" />
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 p-4">
              <div className="text-xs text-muted-foreground mb-1">Łączne saldo</div>
              <div className="flex items-end gap-3 flex-wrap">
                <span className={`text-3xl font-bold tracking-tight ${totalBalance < 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-total-balance">
                  {totalBalance.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-lg font-semibold text-muted-foreground">PLN</span>
                </span>
                {totalChange && (
                  <div className={`flex items-center gap-1 pb-1 ${totalChange.diff >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                    {totalChange.diff >= 0 ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    <span className="text-sm font-semibold">
                      {totalChange.diff >= 0 ? "+" : ""}{totalChange.diff.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({totalChange.pct >= 0 ? "+" : ""}{totalChange.pct.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>
            </div>

            {CATEGORY_ORDER.map(cat => {
              const accs = groupedAccounts[cat];
              if (!accs || accs.length === 0) return null;
              const categoryTotal = accs.reduce((s, a) => s + Number(a.latestBalance), 0);
              const isExpanded = expandedCategories.has(cat);
              return (
                <div key={cat}>
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center justify-between gap-2 w-full py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors mb-1"
                    data-testid={`button-toggle-category-${cat}`}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronDownIcon className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" data-testid={`text-category-label-${cat}`}>{CATEGORY_LABELS[cat] || cat}</span>
                      <span className="text-[10px] text-muted-foreground/60">({accs.length})</span>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${categoryTotal < 0 ? "text-red-600 dark:text-red-400" : "text-foreground"}`} data-testid={`text-category-total-${cat}`}>
                      {categoryTotal.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 pl-2">
                      {accs.map(renderAccountCard)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <LoansDialog open={loansDialogOpen} onOpenChange={setLoansDialogOpen} />
    </Card>
  );
}

function PendingReadingsReminder() {
  const { data: pendingReadings } = useQuery<{ subleaseId: number; readings: any[] }[]>({ queryKey: ["/api/pending-meter-readings"] });
  const count = pendingReadings?.reduce((s, g) => s + g.readings.length, 0) || 0;
  if (count === 0) return null;
  return (
    <Card className="border-amber-500/50" data-testid="card-pending-readings-reminder">
      <CardContent className="py-3 px-4">
        <Link href="/podnajem?tab=media">
          <div className="flex items-center gap-2 text-sm cursor-pointer hover-elevate" data-testid="reminder-pending-readings">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>Odczyty liczników do weryfikacji: <strong>{count}</strong></span>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

function UnpaidArrivalsTab({ reservations, apartments, isLoading, reminders, expiringTrainings, expiringContracts }: { reservations: Reservation[]; apartments: any[]; isLoading: boolean; reminders?: { expiringExams: { id: number; examName: string; validUntil: string; employeeName: string }[]; overdueCosts: number; overdueSubleasePayments: number; upcomingArrivals: number; expiringLeases: { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null }[]; expiringSubleases: { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null }[]; upcomingInspections?: { id: number; inspectionType: string; nextDate: string; apartmentId: number | null; isOverdue: boolean }[] }; expiringTrainings?: { id: number; name: string; status: string; employeeName: string; expiryDate: string | null }[]; expiringContracts?: { id: number; title: string; employeeName: string; endDate: string | null }[] }) {
  const [sortField, setSortField] = useState<SortField>("endDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showAll, setShowAll] = useState(false);
  const ITEMS_LIMIT = 10;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const unpaidCompleted = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let data = reservations.filter(r => {
      if (r.status === "ANULOWANA") return false;
      const remaining = calcRemaining(r);
      return remaining > 0 && r.endDate && r.endDate <= today;
    });

    data.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case "reservationNumber": valA = a.reservationNumber; valB = b.reservationNumber; break;
        case "apartmentName": valA = getApartmentName(a, apartments); valB = getApartmentName(b, apartments); break;
        case "startDate": valA = a.startDate; valB = b.startDate; break;
        case "endDate": valA = a.endDate; valB = b.endDate; break;
        case "guestName": valA = a.guestName; valB = b.guestName; break;
        case "price": valA = Number(a.price); valB = Number(b.price); break;
        case "remaining": valA = calcRemaining(a); valB = calcRemaining(b); break;
        default: valA = a.endDate; valB = b.endDate;
      }
      if (typeof valA === "string") return sortDir === "asc" ? valA.localeCompare(valB, "pl") : valB.localeCompare(valA, "pl");
      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return data;
  }, [reservations, apartments, sortField, sortDir]);

  const totalUnpaid = useMemo(() => unpaidCompleted.reduce((s, r) => s + calcRemaining(r), 0), [unpaidCompleted]);

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}</div>;

  const hasReminders = (reminders && (
    reminders.expiringExams.length > 0 ||
    reminders.overdueCosts > 0 ||
    reminders.overdueSubleasePayments > 0 ||
    reminders.expiringLeases.length > 0 ||
    reminders.expiringSubleases.length > 0 ||
    (reminders.upcomingInspections && reminders.upcomingInspections.length > 0)
  )) || (expiringTrainings && expiringTrainings.length > 0) || (expiringContracts && expiringContracts.length > 0);

  return (
    <div className="space-y-3">
      <PendingReadingsReminder />
      {hasReminders && (
        <Card data-testid="card-reminders">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Przypomnienia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reminders?.overdueCosts && reminders.overdueCosts > 0 && (
              <Link href="/v2/koszty">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid="reminder-overdue-costs">
                  <FileWarning className="h-4 w-4 text-red-500 shrink-0" />
                  <span>Zaległe opłaty kosztów: <strong>{reminders.overdueCosts}</strong></span>
                </div>
              </Link>
            )}
            {reminders?.overdueSubleasePayments && reminders.overdueSubleasePayments > 0 && (
              <Link href="/podnajem">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid="reminder-overdue-sublease">
                  <FileWarning className="h-4 w-4 text-red-500 shrink-0" />
                  <span>Zaległe płatności podnajmu: <strong>{reminders.overdueSubleasePayments}</strong></span>
                </div>
              </Link>
            )}
            {(reminders?.expiringExams || []).map(exam => (
              <Link key={exam.id} href="/employees">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-exam-${exam.id}`}>
                  <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Badanie <strong>{exam.examName}</strong> pracownika {exam.employeeName} wygasa {exam.validUntil}</span>
                </div>
              </Link>
            ))}
            {(reminders?.expiringLeases || []).map(lease => (
              <Link key={lease.id} href="/apartment-schedule">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-lease-${lease.id}`}>
                  <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Najem {lease.tenantName || "—"} kończy się {lease.endDate}</span>
                </div>
              </Link>
            ))}
            {(reminders?.expiringSubleases || []).map(sub => (
              <Link key={sub.id} href="/podnajem">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-sublease-${sub.id}`}>
                  <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Podnajem {sub.tenantName || "—"} kończy się {sub.endDate}</span>
                </div>
              </Link>
            ))}
            {(reminders?.upcomingInspections || []).map(insp => {
              const typeLabels: Record<string, string> = {
                GAZOWY: "gazowy", ELEKTRYCZNY: "elektryczny", KOMINIARSKI: "kominiarski",
                WENTYLACYJNY: "wentylacyjny", BUDOWLANY: "budowlany", PPOZ: "p.poż.", INNE: "inny"
              };
              return (
                <Link key={insp.id} href="/przeglady">
                  <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-inspection-${insp.id}`}>
                    <Wrench className={`h-4 w-4 shrink-0 ${insp.isOverdue ? 'text-red-500' : 'text-amber-500'}`} />
                    <span>
                      {insp.isOverdue ? "Przeterminowany" : "Zbliżający się"} przegląd {typeLabels[insp.inspectionType] || insp.inspectionType} — {insp.nextDate}
                    </span>
                  </div>
                </Link>
              );
            })}
            {(expiringTrainings || []).length > 0 && (
              <Link href="/szkolenia">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid="reminder-expiring-trainings">
                  <GraduationCap className="h-4 w-4 text-amber-500 shrink-0" />
                  <span><strong>{(expiringTrainings || []).length}</strong> szkoleń wygasa w ciągu 30 dni</span>
                </div>
              </Link>
            )}
            {(expiringContracts || []).length > 0 && (
              <Link href="/umowy-pracownicze">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid="reminder-expiring-contracts">
                  <FileSignature className="h-4 w-4 text-amber-500 shrink-0" />
                  <span><strong>{(expiringContracts || []).length}</strong> umów pracowniczych kończy się w ciągu 30 dni</span>
                </div>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-unpaid-arrivals-title">Nieopłacone przyjazdy</h3>
          <p className="text-sm text-muted-foreground">Zakończone rezerwacje z nieopłaconą dopłatą.</p>
        </div>
        {unpaidCompleted.length > 0 && (
          <Badge variant="destructive" data-testid="badge-unpaid-total">
            Łącznie: {totalUnpaid.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
          </Badge>
        )}
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto max-h-[50vh] lg:max-h-none">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <SortableHeader field="reservationNumber" label="Numer" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="apartmentName" label="Apartament" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="startDate" label="Przyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="endDate" label="Wyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="guestName" label="Gość" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="price" label="Kwota" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="remaining" label="Dopłata" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {unpaidCompleted.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Brak nieopłaconych rezerwacji</TableCell></TableRow>
            )}
            {(showAll ? unpaidCompleted : unpaidCompleted.slice(0, ITEMS_LIMIT)).map(r => (
              <TableRow key={r.id} data-testid={`row-unpaid-${r.id}`}>
                <TableCell className="font-medium text-xs whitespace-nowrap">{r.reservationNumber}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{getApartmentName(r, apartments)}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.startDate}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.endDate}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.guestName}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{Number(r.price).toFixed(2)} zł</TableCell>
                <TableCell className="text-xs font-semibold whitespace-nowrap text-red-600 dark:text-red-400">{calcRemaining(r).toFixed(2)} zł</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground" data-testid="text-unpaid-count">
          {unpaidCompleted.length} nieopłaconych rezerwacji
        </div>
        {unpaidCompleted.length > ITEMS_LIMIT && (
          <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} data-testid="button-show-more-unpaid">
            {showAll ? "Pokaż mniej" : `Pokaż więcej (${unpaidCompleted.length - ITEMS_LIMIT})`}
          </Button>
        )}
      </div>
    </div>
  );
}

function UpcomingArrivalsTab({ reservations, apartments, isLoading }: { reservations: Reservation[]; apartments: any[]; isLoading: boolean }) {
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const upcoming = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const in7days = new Date(today);
    in7days.setDate(in7days.getDate() + 7);
    const in7daysStr = in7days.toISOString().split("T")[0];

    let data = reservations.filter(r => {
      if (r.status === "ANULOWANA") return false;
      return r.startDate >= todayStr && r.startDate <= in7daysStr;
    });

    data.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case "reservationNumber": valA = a.reservationNumber; valB = b.reservationNumber; break;
        case "apartmentName": valA = getApartmentName(a, apartments); valB = getApartmentName(b, apartments); break;
        case "startDate": valA = a.startDate; valB = b.startDate; break;
        case "endDate": valA = a.endDate; valB = b.endDate; break;
        case "guestName": valA = a.guestName; valB = b.guestName; break;
        case "price": valA = Number(a.price); valB = Number(b.price); break;
        case "remaining": valA = calcRemaining(a); valB = calcRemaining(b); break;
        default: valA = a.startDate; valB = b.startDate;
      }
      if (typeof valA === "string") return sortDir === "asc" ? valA.localeCompare(valB, "pl") : valB.localeCompare(valA, "pl");
      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return data;
  }, [reservations, apartments, sortField, sortDir]);

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}</div>;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-upcoming-arrivals-title">Najbliższe przyjazdy</h3>
        <p className="text-sm text-muted-foreground">Rezerwacje rozpoczynające się w ciągu najbliższych 7 dni.</p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto max-h-[50vh] lg:max-h-none">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <SortableHeader field="reservationNumber" label="Numer" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="apartmentName" label="Apartament" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="startDate" label="Przyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="endDate" label="Wyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="guestName" label="Gość" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="price" label="Kwota" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="remaining" label="Dopłata" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <TableHead className="text-xs font-semibold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upcoming.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Brak rezerwacji w ciągu 7 dni</TableCell></TableRow>
            )}
            {upcoming.map(r => {
              const remaining = calcRemaining(r);
              return (
                <TableRow key={r.id} data-testid={`row-upcoming-${r.id}`}>
                  <TableCell className="font-medium text-xs whitespace-nowrap">{r.reservationNumber}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{getApartmentName(r, apartments)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-semibold">{r.startDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.endDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.guestName}</TableCell>
                  <TableCell className="text-xs font-bold whitespace-nowrap">{Number(r.price).toFixed(2)} zł</TableCell>
                  <TableCell className={`text-xs font-semibold whitespace-nowrap ${remaining > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                    {remaining.toFixed(2)} zł
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)} className="text-xs">{statusLabel(r.status)}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground" data-testid="text-upcoming-count">
        {upcoming.length} rezerwacji w ciągu 7 dni
      </div>
    </div>
  );
}

function UpcomingDeparturesTab({ reservations, apartments, isLoading }: { reservations: Reservation[]; apartments: any[]; isLoading: boolean }) {
  const [sortField, setSortField] = useState<SortField>("endDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const upcoming = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const in7days = new Date(today);
    in7days.setDate(in7days.getDate() + 7);
    const in7daysStr = in7days.toISOString().split("T")[0];

    let data = reservations.filter(r => {
      if (r.status === "ANULOWANA") return false;
      return r.endDate >= todayStr && r.endDate <= in7daysStr;
    });

    data.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case "reservationNumber": valA = a.reservationNumber; valB = b.reservationNumber; break;
        case "apartmentName": valA = getApartmentName(a, apartments); valB = getApartmentName(b, apartments); break;
        case "startDate": valA = a.startDate; valB = b.startDate; break;
        case "endDate": valA = a.endDate; valB = b.endDate; break;
        case "guestName": valA = a.guestName; valB = b.guestName; break;
        case "price": valA = Number(a.price); valB = Number(b.price); break;
        case "remaining": valA = calcRemaining(a); valB = calcRemaining(b); break;
        default: valA = a.endDate; valB = b.endDate;
      }
      if (typeof valA === "string") return sortDir === "asc" ? valA.localeCompare(valB, "pl") : valB.localeCompare(valA, "pl");
      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return data;
  }, [reservations, apartments, sortField, sortDir]);

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}</div>;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-upcoming-departures-title">Najbliższe wyjazdy</h3>
        <p className="text-sm text-muted-foreground">Rezerwacje kończące się w ciągu najbliższych 7 dni.</p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto max-h-[50vh] lg:max-h-none">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <SortableHeader field="reservationNumber" label="Numer" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="apartmentName" label="Apartament" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="startDate" label="Przyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="endDate" label="Wyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="guestName" label="Gość" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="price" label="Kwota" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="remaining" label="Dopłata" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <TableHead className="text-xs font-semibold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upcoming.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Brak wyjazdów w ciągu 7 dni</TableCell></TableRow>
            )}
            {upcoming.map(r => {
              const remaining = calcRemaining(r);
              return (
                <TableRow key={r.id} data-testid={`row-departure-${r.id}`}>
                  <TableCell className="font-medium text-xs whitespace-nowrap">{r.reservationNumber}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{getApartmentName(r, apartments)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.startDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-semibold">{r.endDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.guestName}</TableCell>
                  <TableCell className="text-xs font-bold whitespace-nowrap">{Number(r.price).toFixed(2)} zł</TableCell>
                  <TableCell className={`text-xs font-semibold whitespace-nowrap ${remaining > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                    {remaining.toFixed(2)} zł
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)} className="text-xs">{statusLabel(r.status)}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground" data-testid="text-departures-count">
        {upcoming.length} wyjazdów w ciągu 7 dni
      </div>
    </div>
  );
}

function UnpaidSubleasesTab({ payments, apartments }: { payments: SubleasePaymentExtended[]; apartments: any[] }) {
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const ITEMS_LIMIT = 10;
  const today = new Date().toISOString().split("T")[0];
  const in7days = new Date();
  in7days.setDate(in7days.getDate() + 7);
  const in7daysStr = in7days.toISOString().split("T")[0];

  const todayPayments = useMemo(() =>
    payments.filter(p => p.status === "do_oplacenia" && p.dueDate <= today),
    [payments, today]
  );

  const upcomingPayments = useMemo(() =>
    payments.filter(p => p.status === "do_oplacenia" && p.dueDate > today && p.dueDate <= in7daysStr),
    [payments, today, in7daysStr]
  );

  const getAptNames = (p: SubleasePaymentExtended) => {
    if (p.apartmentId) {
      const apt = apartments.find(a => a.id === p.apartmentId);
      return apt?.name || "—";
    }
    return p.subleaseApartmentIds.map(id => apartments.find(a => a.id === id)?.name || "?").join(", ") || "—";
  };

  const totalOverdue = todayPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalUpcoming = upcomingPayments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-unpaid-subleases-title">Nieopłacone podnajmy</h3>
        <p className="text-sm text-muted-foreground">Płatności z podnajem - rozliczenie do zapłaty.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-base font-medium">Zaległe i na dziś ({todayPayments.length})</h4>
          {todayPayments.length > 0 && (
            <Badge variant="destructive" data-testid="badge-overdue-sublease-total">
              {totalOverdue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
            </Badge>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Najemca</TableHead>
                <TableHead className="text-xs font-semibold">Apartament</TableHead>
                <TableHead className="text-xs font-semibold">Tytuł</TableHead>
                <TableHead className="text-xs font-semibold">Termin</TableHead>
                <TableHead className="text-xs font-semibold">Kwota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayPayments.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Brak zaległych płatności</TableCell></TableRow>
              )}
              {(showAllOverdue ? todayPayments : todayPayments.slice(0, ITEMS_LIMIT)).map(p => (
                <TableRow key={p.id} data-testid={`row-overdue-sublease-${p.id}`}>
                  <TableCell className="text-xs whitespace-nowrap">{p.subleaseTenantName}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{getAptNames(p)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{p.title}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-semibold text-red-600 dark:text-red-400">{p.dueDate}</TableCell>
                  <TableCell className="text-xs font-bold whitespace-nowrap">{Number(p.amount).toFixed(2)} zł</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {todayPayments.length > ITEMS_LIMIT && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAllOverdue(!showAllOverdue)} data-testid="button-show-more-overdue-subleases">
              {showAllOverdue ? "Pokaż mniej" : `Pokaż więcej (${todayPayments.length - ITEMS_LIMIT})`}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-base font-medium">Najbliższe 7 dni ({upcomingPayments.length})</h4>
          {upcomingPayments.length > 0 && (
            <Badge variant="secondary" data-testid="badge-upcoming-sublease-total">
              {totalUpcoming.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
            </Badge>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Najemca</TableHead>
                <TableHead className="text-xs font-semibold">Apartament</TableHead>
                <TableHead className="text-xs font-semibold">Tytuł</TableHead>
                <TableHead className="text-xs font-semibold">Termin</TableHead>
                <TableHead className="text-xs font-semibold">Kwota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingPayments.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Brak płatności w najbliższych 7 dniach</TableCell></TableRow>
              )}
              {(showAllUpcoming ? upcomingPayments : upcomingPayments.slice(0, ITEMS_LIMIT)).map(p => (
                <TableRow key={p.id} data-testid={`row-upcoming-sublease-${p.id}`}>
                  <TableCell className="text-xs whitespace-nowrap">{p.subleaseTenantName}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{getAptNames(p)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{p.title}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{p.dueDate}</TableCell>
                  <TableCell className="text-xs font-bold whitespace-nowrap">{Number(p.amount).toFixed(2)} zł</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {upcomingPayments.length > ITEMS_LIMIT && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAllUpcoming(!showAllUpcoming)} data-testid="button-show-more-upcoming-subleases">
              {showAllUpcoming ? "Pokaż mniej" : `Pokaż więcej (${upcomingPayments.length - ITEMS_LIMIT})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpiringLeasesTab({ leases, apartments }: { leases: Lease[]; apartments: any[] }) {
  const expiringLeases = useMemo(() => {
    const today = new Date();
    const in6months = new Date(today);
    in6months.setMonth(in6months.getMonth() + 6);
    const todayStr = today.toISOString().split("T")[0];
    const in6monthsStr = in6months.toISOString().split("T")[0];

    return leases
      .filter(l => l.endDate && l.endDate >= todayStr && l.endDate <= in6monthsStr)
      .sort((a, b) => (a.endDate || "").localeCompare(b.endDate || ""));
  }, [leases]);

  const getAptName = (lease: Lease) => {
    if (!lease.apartmentId) return "—";
    const apt = apartments.find(a => a.id === lease.apartmentId);
    return apt?.name || "—";
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-expiring-leases-title">Kończące się umowy</h3>
        <p className="text-sm text-muted-foreground">Umowy najmu kończące się w ciągu najbliższych 6 miesięcy.</p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold">Apartament</TableHead>
              <TableHead className="text-xs font-semibold">Najemca</TableHead>
              <TableHead className="text-xs font-semibold">Początek</TableHead>
              <TableHead className="text-xs font-semibold">Koniec</TableHead>
              <TableHead className="text-xs font-semibold">Czynsz</TableHead>
              <TableHead className="text-xs font-semibold">Pozostało dni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expiringLeases.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Brak kończących się umów w najbliższych 6 miesiącach</TableCell></TableRow>
            )}
            {expiringLeases.map(l => {
              const daysLeft = l.endDate ? differenceInDays(new Date(l.endDate), new Date()) : 0;
              return (
                <TableRow key={l.id} data-testid={`row-expiring-lease-${l.id}`}>
                  <TableCell className="text-xs whitespace-nowrap font-medium">{getAptName(l)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{l.tenantName || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{l.startDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-semibold">{l.endDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-bold">{Number(l.rentAmount).toFixed(2)} zł</TableCell>
                  <TableCell className={`text-xs whitespace-nowrap font-semibold ${daysLeft < 30 ? "text-red-600 dark:text-red-400" : daysLeft < 90 ? "text-orange-600 dark:text-orange-400" : ""}`}>
                    {daysLeft} dni
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground" data-testid="text-expiring-count">
        {expiringLeases.length} kończących się umów
      </div>
    </div>
  );
}

function SortableHeader({ field, label, sortField, sortDir, onSort }: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = sortField === field;
  return (
    <TableHead>
      <button
        onClick={() => onSort(field)}
        className="flex items-center text-xs font-semibold whitespace-nowrap hover-elevate px-1 py-1 rounded"
        data-testid={`sort-${field}`}
      >
        {label}
        {isActive
          ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)
          : <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
        }
      </button>
    </TableHead>
  );
}

function TodayTasksWidget() {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: allTasks } = useQuery<any[]>({ queryKey: ["/api/tasks"] });
  const [, setLocation] = useLocation();

  const todayTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t: any) => t.dueDate === today && !t.completed);
  }, [allTasks, today]);

  const overdueTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t: any) => t.dueDate && t.dueDate < today && !t.completed);
  }, [allTasks, today]);

  const toggleTask = useMutation({
    mutationFn: async (task: any) => {
      await apiRequest("PATCH", `/api/tasks/${task.id}`, { completed: !task.completed });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const PRIORITY_COLORS: Record<string, string> = {
    PILNY: "text-red-500",
    WYSOKI: "text-orange-500",
    ŚREDNI: "text-yellow-500",
    NISKI: "text-blue-400",
  };

  return (
    <Card data-testid="today-tasks-widget">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Zadania na dziś
            {todayTasks.length > 0 && (
              <Badge variant="secondary" className="ml-1">{todayTasks.length}</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/tasks")} data-testid="link-all-tasks">
            Wszystkie
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {overdueTasks.length > 0 && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
              Zaległe ({overdueTasks.length})
            </p>
            {overdueTasks.slice(0, 3).map((task: any) => (
              <div key={task.id} className="flex items-center gap-2 py-1">
                <button
                  className="h-4 w-4 rounded border border-red-300 flex-shrink-0"
                  onClick={() => toggleTask.mutate(task)}
                  data-testid={`toggle-overdue-task-${task.id}`}
                />
                <span className="text-sm text-red-700 dark:text-red-300 truncate">{task.title}</span>
                <span className="text-xs text-red-400 ml-auto whitespace-nowrap">{task.dueDate}</span>
              </div>
            ))}
          </div>
        )}
        {todayTasks.length === 0 && overdueTasks.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">Brak zadań na dziś</p>
        )}
        {todayTasks.map((task: any) => (
          <div key={task.id} className="flex items-center gap-2 py-1.5 border-b last:border-0">
            <button
              className="h-4 w-4 rounded border border-muted-foreground/30 flex-shrink-0 hover:border-primary transition-colors"
              onClick={() => toggleTask.mutate(task)}
              data-testid={`toggle-today-task-${task.id}`}
            />
            <span className={`text-sm flex-1 truncate ${PRIORITY_COLORS[task.priority] || ""}`}>
              {task.title}
            </span>
            {task.dueTime && (
              <span className="text-xs text-muted-foreground">{task.dueTime}</span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

const BALANCE_MONTH_NAMES = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const BALANCE_MONTH_NAMES_FULL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

function BalanceForecastChartWidget({ data }: { data?: { currentBalance: number; months: { year: number; month: number; endBalance: number; revenueForecast: number; revenueActual: number; aptCostRemaining: number; opCostRemaining: number; surcharges: number }[] } }) {
  const chartData = useMemo(() => {
    if (!data?.months) return [];
    return data.months.slice(0, 36).map(m => ({
      ...m,
      label: `${BALANCE_MONTH_NAMES[m.month - 1]} '${String(m.year).slice(2)}`,
    }));
  }, [data]);

  const minBalance = useMemo(() => chartData.length ? Math.min(...chartData.map(m => m.endBalance)) : 0, [chartData]);
  const maxBalance = useMemo(() => chartData.length ? Math.max(...chartData.map(m => m.endBalance)) : 0, [chartData]);
  const endBalance = chartData.length ? chartData[chartData.length - 1].endBalance : 0;

  function plnFmt(value: number): string {
    if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return String(Math.round(value));
  }

  function plnFull(value: number): string {
    return `${value.toLocaleString("pl-PL", { maximumFractionDigits: 0, minimumFractionDigits: 0 })} zł`;
  }

  const BalanceForecastTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-xs space-y-1 min-w-48">
        <p className="font-semibold text-sm mb-1.5">{BALANCE_MONTH_NAMES_FULL[d.month - 1]} {d.year}</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          <span className="text-muted-foreground">Prognoza przych.:</span>
          <span className="text-right">{plnFull(d.revenueForecast)}</span>
          <span className="text-muted-foreground">Realizacja przych.:</span>
          <span className="text-right">{plnFull(d.revenueActual)}</span>
          <span className="text-muted-foreground">Koszty apt:</span>
          <span className="text-right text-orange-600">−{plnFull(d.aptCostRemaining)}</span>
          <span className="text-muted-foreground">Koszty oper.:</span>
          <span className="text-right text-red-600">−{plnFull(d.opCostRemaining)}</span>
          {d.surcharges > 0 && (
            <>
              <span className="text-muted-foreground">Dopłaty:</span>
              <span className="text-right text-cyan-600">+{plnFull(d.surcharges)}</span>
            </>
          )}
        </div>
        <div className="border-t border-border mt-1.5 pt-1.5">
          <div className="flex justify-between font-semibold">
            <span>Saldo:</span>
            <span className={d.endBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              {plnFull(d.endBalance)}
            </span>
          </div>
        </div>
      </div>
    );
  };

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

function HrSummaryWidget() {
  const [, navigate] = useLocation();

  const { data: employees, isLoading: empLoading } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: remindersData, isLoading: remLoading } = useQuery<{
    expiringExams: { id: number; examName: string; validUntil: string; employeeName: string }[];
    expiringLeases: any[];
    expiringSubleases: any[];
  }>({ queryKey: ["/api/dashboard-reminders"] });
  const { data: expiringTrainingsData } = useQuery<{ id: number; name: string; employeeName: string; expiryDate: string | null }[]>({ queryKey: ["/api/employee-trainings/expiring"] });
  const { data: expiringContractsData } = useQuery<{ id: number; title: string; employeeName: string; endDate: string | null }[]>({ queryKey: ["/api/employee-contracts/expiring"] });

  const activeCount = employees?.filter((e: any) => e.isActive !== false).length ?? 0;
  const contractAlerts = expiringContractsData?.length ?? 0;
  const examAlerts = remindersData?.expiringExams?.length ?? 0;
  const trainingAlerts = expiringTrainingsData?.length ?? 0;

  const alerts: { icon: typeof AlertCircle; text: string; color: string }[] = [];
  if (remindersData?.expiringExams) {
    for (const exam of remindersData.expiringExams.slice(0, 2)) {
      alerts.push({ icon: AlertCircle, text: `Badanie ${exam.employeeName} wygasa ${format(new Date(exam.validUntil), "dd.MM.yyyy")}`, color: "text-red-500" });
    }
  }
  if (expiringContractsData) {
    for (const c of expiringContractsData.slice(0, 2)) {
      alerts.push({ icon: FileText, text: `Umowa ${c.employeeName} kończy się ${c.endDate ? format(new Date(c.endDate), "dd.MM.yyyy") : "—"}`, color: "text-amber-500" });
    }
  }
  if (expiringTrainingsData) {
    for (const t of expiringTrainingsData.slice(0, 1)) {
      alerts.push({ icon: GraduationCap, text: `Szkolenie ${t.employeeName} wygasa ${t.expiryDate ? format(new Date(t.expiryDate), "dd.MM.yyyy") : "—"}`, color: "text-orange-500" });
    }
  }

  if (empLoading || remLoading) {
    return (
      <Card data-testid="widget-hr-summary">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Kadry</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-muted rounded" />
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-4 bg-muted rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-hr-summary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Kadry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-hr-active">{activeCount}</div>
            <div className="text-xs text-muted-foreground">Aktywni</div>
          </div>
          <div className="rounded-lg bg-amber-500/10 p-3 text-center">
            <div className={`text-2xl font-bold ${contractAlerts > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} data-testid="text-hr-contracts">{contractAlerts}</div>
            <div className="text-xs text-muted-foreground">Umowy</div>
          </div>
          <div className="rounded-lg bg-red-500/10 p-3 text-center">
            <div className={`text-2xl font-bold ${(examAlerts + trainingAlerts) > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} data-testid="text-hr-exams">{examAlerts + trainingAlerts}</div>
            <div className="text-xs text-muted-foreground">Badania/Szk.</div>
          </div>
        </div>
        {alerts.length > 0 && (
          <div className="space-y-2">
            {alerts.slice(0, 5).map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <a.icon className={`h-3.5 w-3.5 shrink-0 ${a.color}`} />
                <span className="text-muted-foreground truncate">{a.text}</span>
              </div>
            ))}
          </div>
        )}
        {alerts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Brak alertów kadrowych</p>
        )}
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate("/pracownicy")} data-testid="button-hr-details">
          Szczegóły →
        </Button>
      </CardContent>
    </Card>
  );
}

type TeamStatus = { working: number; onBreak: number; absent: number; total: number };
type EmployeeStat = { employeeId: number; employeeName: string; totalHours: number; lateCount: number; outsideZoneCount: number };

function RcpSummaryWidget() {
  const [, setLocation] = useLocation();
  const now = new Date();
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");

  const { data: teamStatus, isLoading: teamLoading } = useQuery<TeamStatus>({
    queryKey: ["/api/time-clock/team-status"],
    refetchInterval: 30000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<EmployeeStat[]>({
    queryKey: ["/api/rcp/employee-stats", monthStart, today],
    queryFn: async () => {
      const res = await fetch(`/api/rcp/employee-stats?from=${monthStart}&to=${today}`);
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const totalHours = useMemo(() => stats?.reduce((s, e) => s + (e.totalHours || 0), 0) || 0, [stats]);
  const totalLate = useMemo(() => stats?.reduce((s, e) => s + (e.lateCount || 0), 0) || 0, [stats]);
  const totalOutsideZone = useMemo(() => stats?.reduce((s, e) => s + (e.outsideZoneCount || 0), 0) || 0, [stats]);

  if (teamLoading && statsLoading) {
    return (
      <Card data-testid="widget-rcp-summary">
        <CardContent className="py-6">
          <div className="space-y-3">
            <div className="h-5 w-40 bg-muted animate-pulse rounded" />
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
            </div>
            <div className="h-12 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-rcp-summary">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            RCP — Pracownicy
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/rcp/admin")} data-testid="link-rcp-details">
            Szczegóły →
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border bg-card p-3 text-center" data-testid="rcp-working">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Pracują</span>
            </div>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{teamStatus?.working ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center" data-testid="rcp-on-break">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <Coffee className="h-3 w-3 text-amber-500" />
              <span className="text-xs text-muted-foreground">Przerwa</span>
            </div>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{teamStatus?.onBreak ?? 0}</p>
          </div>
          <div className="rounded-lg border bg-card p-3 text-center" data-testid="rcp-absent">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="text-xs text-muted-foreground">Nieobecni</span>
            </div>
            <p className="text-xl font-bold text-muted-foreground">{teamStatus?.absent ?? 0}</p>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Podsumowanie miesiąca</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-sm">Łączne godziny</span>
              </div>
              <span className="text-sm font-semibold" data-testid="rcp-total-hours">{totalHours.toFixed(1)}h</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className={`h-3.5 w-3.5 ${totalLate > 0 ? "text-amber-500" : "text-muted-foreground/40"}`} />
                <span className="text-sm">Spóźnienia</span>
              </div>
              <span className={`text-sm font-semibold ${totalLate > 0 ? "text-amber-600 dark:text-amber-400" : ""}`} data-testid="rcp-late-count">
                {totalLate}
              </span>
            </div>
            {totalOutsideZone > 0 && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-sm">Poza strefą GPS</span>
                </div>
                <Badge variant="destructive" className="text-xs" data-testid="rcp-outside-zone">{totalOutsideZone}</Badge>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ACTION_LABELS: Record<string, string> = {
  create: "utworzył/a",
  update: "zaktualizował/a",
  delete: "usunął/ęła",
  import: "zaimportował/a",
};

const ENTITY_LABELS: Record<string, string> = {
  reservation: "rezerwację",
  apartment: "apartament",
  sublease: "podnajem",
  invoice: "fakturę",
  cost: "koszt",
  lease: "umowę najmu",
  cost_invoice: "fakturę kosztową",
  payment: "płatność",
  employee: "pracownika",
  task: "zadanie",
  owner_contract: "umowę właściciela",
  owner_payment: "płatność właściciela",
  saldo: "saldo",
  bank_account: "konto bankowe",
};

function getActionIcon(action: string) {
  switch (action) {
    case "create": return <PlusCircle className="h-4 w-4 text-emerald-500" />;
    case "update": return <Pencil className="h-4 w-4 text-blue-500" />;
    case "delete": return <Trash2Icon className="h-4 w-4 text-red-500" />;
    case "import": return <Download className="h-4 w-4 text-purple-500" />;
    default: return <Activity className="h-4 w-4 text-muted-foreground" />;
  }
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case "reservation": return <Plane className="h-3.5 w-3.5 text-muted-foreground" />;
    case "apartment": return <Home className="h-3.5 w-3.5 text-muted-foreground" />;
    case "invoice":
    case "cost_invoice": return <Receipt className="h-3.5 w-3.5 text-muted-foreground" />;
    case "sublease":
    case "lease":
    case "owner_contract": return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
    case "cost":
    case "payment":
    case "owner_payment": return <Banknote className="h-3.5 w-3.5 text-muted-foreground" />;
    default: return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

type ActivityLog = { id: number; userId?: string; userName?: string; action: string; entityType: string; entityId?: string; entityName?: string; details?: string; createdAt: string };

function RecentActivityWidget() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = useQuery<{ logs: ActivityLog[]; total: number }>({
    queryKey: ["/api/activity-logs", { limit: 10 }],
    queryFn: async () => {
      const res = await fetch("/api/activity-logs?limit=10");
      if (!res.ok) throw new Error("Failed to fetch activity logs");
      return res.json();
    },
    refetchInterval: 60000,
  });

  const logs = data?.logs || [];

  if (isLoading) {
    return (
      <Card data-testid="widget-recent-activity">
        <CardContent className="py-6">
          <div className="space-y-3">
            <div className="h-5 w-44 bg-muted animate-pulse rounded" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-3.5 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-recent-activity">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Ostatnia aktywność
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setLocation("/activity-log")} data-testid="link-activity-log">
            Zobacz wszystko →
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-activity">Brak ostatniej aktywności</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 border-b last:border-0" data-testid={`activity-entry-${log.id}`}>
                <div className="mt-0.5 flex-shrink-0">
                  {getActionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {getEntityIcon(log.entityType)}
                    <p className="text-sm leading-tight">
                      <span className="font-medium">{log.userName || "System"}</span>
                      {" "}
                      <span className="text-muted-foreground">{ACTION_LABELS[log.action] || log.action}</span>
                      {" "}
                      <span className="text-muted-foreground">{ENTITY_LABELS[log.entityType] || log.entityType}</span>
                      {log.entityName && (
                        <>
                          {" — "}
                          <span className="font-medium truncate">{log.entityName}</span>
                        </>
                      )}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: pl })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
