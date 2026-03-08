import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedTabContent } from "@/components/AnimatedTabContent";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileSignature, HandCoins, Gauge, ClipboardCheck, LayoutDashboard,
  AlertTriangle, TrendingUp, Users, CalendarClock, ArrowUpRight, ArrowDownRight,
  Clock, CheckCircle2, XCircle
} from "lucide-react";
import type { Sublease, Apartment } from "@shared/schema";
import Subleases from "@/pages/Subleases";
import SubrentSettlement from "@/pages/SubrentSettlement";
import MediaSettlement from "@/pages/MediaSettlement";
import CheckoutSettlement from "@/pages/CheckoutSettlement";

const TABS = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "umowy", label: "Umowy", icon: FileSignature },
  { value: "rozliczenia", label: "Rozliczenia", icon: HandCoins },
  { value: "media", label: "Rozliczenie mediów", icon: Gauge },
  { value: "checkout", label: "Rozliczenie końcowe", icon: ClipboardCheck },
];

interface SubleasePaymentWithTenant {
  id: number;
  subleaseId: number;
  apartmentId: number | null;
  title: string;
  category: string;
  amount: string;
  dueDate: string;
  status: string;
  subleaseTenantName: string;
  subleaseApartmentIds: number[];
}

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}

function formatNum(v: number): string {
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getTenantDisplayName(s: Sublease): string {
  if (s.tenantType === "firma") return s.companyName || "Firma";
  return `${s.firstName || ""} ${s.lastName || ""}`.trim() || "—";
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function PodnajemDashboard() {
  const { data: subleases = [], isLoading: loadingSubleases } = useQuery<Sublease[]>({
    queryKey: ['/api/subleases'],
  });

  const { data: apartments = [] } = useQuery<Apartment[]>({
    queryKey: ['/api/apartments'],
  });

  const { data: allPayments = [], isLoading: loadingPayments } = useQuery<SubleasePaymentWithTenant[]>({
    queryKey: ['/api/dashboard/all-sublease-payments'],
  });

  const isLoading = loadingSubleases || loadingPayments;

  const apartmentMap = useMemo(() => {
    const map: Record<number, string> = {};
    apartments.forEach(a => { map[a.id] = a.name; });
    return map;
  }, [apartments]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayStr = useMemo(() => today.toISOString().split("T")[0], [today]);

  const activeSubleases = useMemo(() =>
    subleases.filter(s => s.status === "AKTYWNA" || (s.status !== "ANULOWANA" && s.endDate >= todayStr)),
    [subleases, todayStr]
  );

  const stats = useMemo(() => {
    const active = activeSubleases.length;
    const totalMonthlyRent = activeSubleases.reduce((sum, s) => sum + Number(s.rentAmount || 0), 0);
    const totalMonthlyFees = activeSubleases.reduce((sum, s) => sum + Number(s.additionalFees || 0), 0);

    const overduePayments = allPayments.filter(p =>
      p.status !== "oplacona" && p.status !== "oplacone" && p.dueDate < todayStr
    );
    const overdueAmount = overduePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const paidThisMonth = allPayments.filter(p => {
      const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonth = today.getMonth() === 11
        ? `${today.getFullYear() + 1}-01-01`
        : `${today.getFullYear()}-${String(today.getMonth() + 2).padStart(2, '0')}-01`;
      return (p.status === "oplacona" || p.status === "oplacone") && p.dueDate >= monthStart && p.dueDate < nextMonth;
    });
    const paidAmount = paidThisMonth.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    return { active, totalMonthlyRent, totalMonthlyFees, overdueAmount, overdueCount: overduePayments.length, paidAmount };
  }, [activeSubleases, allPayments, todayStr, today]);

  const expiringAlerts = useMemo(() => {
    const alerts: { sublease: Sublease; days: number; level: "critical" | "warning" | "info" }[] = [];
    for (const s of activeSubleases) {
      if (!s.endDate) continue;
      const days = daysUntil(s.endDate);
      if (days <= 0) continue;
      if (days <= 14) {
        alerts.push({ sublease: s, days, level: "critical" });
      } else if (days <= 30) {
        alerts.push({ sublease: s, days, level: "warning" });
      } else if (days <= 60) {
        alerts.push({ sublease: s, days, level: "info" });
      }
    }
    alerts.sort((a, b) => a.days - b.days);
    return alerts;
  }, [activeSubleases]);

  const tenantRanking = useMemo(() => {
    const tenantPayments: Record<number, { name: string; total: number; onTime: number; late: number; avgDelay: number; totalDelay: number }> = {};

    for (const s of subleases) {
      const name = getTenantDisplayName(s);
      if (!tenantPayments[s.id]) {
        tenantPayments[s.id] = { name, total: 0, onTime: 0, late: 0, avgDelay: 0, totalDelay: 0 };
      }
    }

    for (const p of allPayments) {
      const entry = tenantPayments[p.subleaseId];
      if (!entry) continue;
      if (p.category?.toLowerCase() === "kaucja") continue;

      entry.total++;
      if (p.status === "oplacona" || p.status === "oplacone") {
        entry.onTime++;
      } else if (p.dueDate < todayStr) {
        entry.late++;
        const delayDays = daysUntil(p.dueDate);
        entry.totalDelay += Math.abs(delayDays);
      }
    }

    return Object.entries(tenantPayments)
      .filter(([, v]) => v.total > 0)
      .map(([id, v]) => ({
        subleaseId: Number(id),
        name: v.name,
        total: v.total,
        onTime: v.onTime,
        late: v.late,
        rate: v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0,
        avgDelay: v.late > 0 ? Math.round(v.totalDelay / v.late) : 0,
      }))
      .sort((a, b) => b.rate - a.rate || a.avgDelay - b.avgDelay);
  }, [subleases, allPayments, todayStr]);

  const rentTimelines = useMemo(() => {
    const timelines: { sublease: Sublease; changes: { date: string; rent: number; fees: number }[] }[] = [];

    for (const s of activeSubleases) {
      const changes: { date: string; rent: number; fees: number }[] = [];
      changes.push({
        date: s.startDate,
        rent: Number(s.rentAmount || 0),
        fees: Number(s.additionalFees || 0),
      });

      if (changes.length > 0) {
        timelines.push({ sublease: s, changes });
      }
    }

    return timelines;
  }, [activeSubleases]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4" data-testid="dashboard-podnajem">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="stat-active-contracts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aktywne umowy</CardTitle>
            <FileSignature className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-active-contracts">{stats.active}</div>
            <p className="text-xs text-muted-foreground mt-1">z {subleases.length} wszystkich</p>
          </CardContent>
        </Card>

        <Card data-testid="stat-monthly-revenue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Miesięczny czynsz</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-monthly-revenue">{formatNum(stats.totalMonthlyRent)} zł</div>
            <p className="text-xs text-muted-foreground mt-1">+ {formatNum(stats.totalMonthlyFees)} zł opłat dodatkowych</p>
          </CardContent>
        </Card>

        <Card data-testid="stat-paid-this-month">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wpłaty (ten miesiąc)</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-paid-this-month">{formatNum(stats.paidAmount)} zł</div>
          </CardContent>
        </Card>

        <Card data-testid="stat-overdue">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Zaległości</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="value-overdue">{formatNum(stats.overdueAmount)} zł</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.overdueCount} zaległych płatności</p>
          </CardContent>
        </Card>
      </div>

      {expiringAlerts.length > 0 && (
        <Card data-testid="section-expiring-alerts">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Kończące się umowy
            </CardTitle>
            <Badge variant="secondary">{expiringAlerts.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiringAlerts.map((alert, idx) => {
              const s = alert.sublease;
              const name = getTenantDisplayName(s);
              const aptNames = (s.apartmentIds && s.apartmentIds.length > 0
                ? s.apartmentIds.map(id => apartmentMap[id] || `#${id}`).join(", ")
                : s.apartmentId ? (apartmentMap[s.apartmentId] || `#${s.apartmentId}`) : "—");

              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 p-2 rounded-md border"
                  data-testid={`alert-expiring-${s.id}`}
                >
                  <Badge
                    variant={alert.level === "critical" ? "destructive" : alert.level === "warning" ? "secondary" : "outline"}
                    data-testid={`badge-alert-level-${s.id}`}
                  >
                    {alert.days} dni
                  </Badge>
                  <span className="font-medium text-sm" data-testid={`text-tenant-${s.id}`}>{name}</span>
                  <span className="text-xs text-muted-foreground">{aptNames}</span>
                  <span className="text-xs text-muted-foreground ml-auto">do {formatDate(s.endDate)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <Card data-testid="section-tenant-ranking">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Ranking najemców wg terminowości
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tenantRanking.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-ranking">Brak danych o płatnościach</p>
          ) : (
            <div className="space-y-2">
              {tenantRanking.map((tenant, idx) => (
                <div
                  key={tenant.subleaseId}
                  className="flex flex-wrap items-center gap-2 p-2 rounded-md border"
                  data-testid={`ranking-tenant-${tenant.subleaseId}`}
                >
                  <span className="text-sm font-mono text-muted-foreground w-6 text-right">{idx + 1}.</span>
                  <span className="font-medium text-sm flex-1 min-w-[120px]" data-testid={`text-ranking-name-${tenant.subleaseId}`}>{tenant.name}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${Math.max(tenant.rate, 8)}px`,
                          backgroundColor: tenant.rate >= 80 ? 'hsl(var(--chart-2))' : tenant.rate >= 50 ? 'hsl(var(--chart-4))' : 'hsl(var(--destructive))',
                        }}
                      />
                      <span className="text-sm font-bold" data-testid={`value-rate-${tenant.subleaseId}`}>{tenant.rate}%</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{tenant.onTime}</span>
                    </div>
                    {tenant.late > 0 && (
                      <div className="flex items-center gap-1 text-xs text-destructive">
                        <XCircle className="h-3 w-3" />
                        <span>{tenant.late}</span>
                        {tenant.avgDelay > 0 && (
                          <span className="text-muted-foreground">(śr. {tenant.avgDelay} dni)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="section-rent-timeline">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Czynsz aktywnych umów
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rentTimelines.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-testid="text-no-timeline">Brak aktywnych umów</p>
          ) : (
            <div className="space-y-3">
              {rentTimelines.map(({ sublease: s, changes }) => {
                const name = getTenantDisplayName(s);
                const aptNames = (s.apartmentIds && s.apartmentIds.length > 0
                  ? s.apartmentIds.map(id => apartmentMap[id] || `#${id}`).join(", ")
                  : s.apartmentId ? (apartmentMap[s.apartmentId] || `#${s.apartmentId}`) : "—");

                return (
                  <div
                    key={s.id}
                    className="p-3 rounded-md border space-y-2"
                    data-testid={`timeline-sublease-${s.id}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm" data-testid={`text-timeline-name-${s.id}`}>{name}</span>
                      <span className="text-xs text-muted-foreground">{aptNames}</span>
                      <Badge variant="outline" className="ml-auto">
                        {formatDate(s.startDate)} — {formatDate(s.endDate)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {changes.map((ch, ci) => (
                        <div key={ci} className="flex items-center gap-2">
                          {ci > 0 && <ArrowUpRight className="h-3 w-3 text-muted-foreground" />}
                          <div className="text-sm">
                            <span className="font-bold" data-testid={`value-rent-${s.id}-${ci}`}>{formatNum(ch.rent)} zł</span>
                            {ch.fees > 0 && (
                              <span className="text-muted-foreground ml-1">+ {formatNum(ch.fees)} zł</span>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">od {formatDate(ch.date)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Podnajem() {
  const urlTab = new URLSearchParams(window.location.search).get("tab");
  const initialTab = TABS.some(t => t.value === urlTab) ? urlTab! : "dashboard";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && TABS.some(t => t.value === tab)) {
      setActiveTab(tab);
    }
  }, []);

  return (
    <div className="space-y-0" data-testid="page-podnajem">
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0" data-testid="tabs-podnajem">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  data-testid={`tab-${tab.value}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <AnimatedTabContent value="dashboard" activeValue={activeTab}>
            <PodnajemDashboard />
          </AnimatedTabContent>
          <AnimatedTabContent value="umowy" activeValue={activeTab}>
            <Subleases />
          </AnimatedTabContent>
          <AnimatedTabContent value="rozliczenia" activeValue={activeTab}>
            <SubrentSettlement />
          </AnimatedTabContent>
          <AnimatedTabContent value="media" activeValue={activeTab}>
            <MediaSettlement />
          </AnimatedTabContent>
          <AnimatedTabContent value="checkout" activeValue={activeTab}>
            <CheckoutSettlement />
          </AnimatedTabContent>
        </Tabs>
      </div>
    </div>
  );
}
