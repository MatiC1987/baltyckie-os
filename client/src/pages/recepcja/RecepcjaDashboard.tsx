import { useQuery, useQueryClient } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  Plane, PlaneLanding, AlertCircle, CheckSquare, UserPlus, LayoutDashboard, AlertTriangle, FileText,
  Zap, CalendarClock, CreditCard, RefreshCw, TrendingUp, TrendingDown,
} from "lucide-react";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import { useIsMobile } from "@/hooks/use-mobile";

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    const parsed = d.length === 10 ? new Date(d + "T12:00:00") : new Date(d);
    if (isNaN(parsed.getTime())) return String(d);
    return parsed.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return String(d); }
}

function formatAmount(v: string | number | null | undefined) {
  if (v == null) return "—";
  return `${parseFloat(String(v)).toFixed(2)} zł`;
}

function MiniSparkline({ data, width = 120, height = 32 }: { data: number[]; width?: number; height?: number }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  const lastVal = data[data.length - 1];
  const prevVal = data[data.length - 2];
  const isUp = lastVal >= prevVal;
  const color = isUp ? "#22c55e" : "#ef4444";

  return (
    <div className="flex items-center gap-2">
      <svg width={width} height={height} className="overflow-visible">
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={data.length > 0 ? (data.length - 1) * stepX : 0}
          cy={height - ((lastVal - min) / range) * (height - 4) - 2}
          r="3"
          fill={color}
        />
      </svg>
      {isUp ? (
        <TrendingUp className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
      )}
    </div>
  );
}

export default function RecepcjaDashboard() {
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { pullY, isRefreshing: isPullRefreshing, handlers: pullHandlers } = usePullRefresh({
    onRefresh: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["/api/recepcja/dashboard"] }),
      qc.invalidateQueries({ queryKey: ["/api/recepcja/accounting-notes"] }),
      qc.invalidateQueries({ queryKey: ["/api/recepcja/payment-trend"] }),
    ]).then(() => {}),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/recepcja/dashboard"],
    queryFn: async () => {
      const res = await recepcjaFetch("GET", "/api/recepcja/dashboard");
      return res.json();
    },
  });

  const { data: accountingNotes } = useQuery<any[]>({
    queryKey: ["/api/recepcja/accounting-notes"],
    queryFn: async () => {
      const res = await recepcjaFetch("GET", "/api/recepcja/accounting-notes");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: paymentTrend } = useQuery<{ date: string; amount: number }[]>({
    queryKey: ["/api/recepcja/payment-trend"],
    queryFn: async () => {
      const res = await recepcjaFetch("GET", "/api/recepcja/payment-trend");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const newNotesCount = (accountingNotes || []).filter((n: any) => n.status === "NOWA").length;

  const trendAmounts = (paymentTrend || []).map(p => p.amount);
  const totalLast30 = trendAmounts.reduce((s, v) => s + v, 0);

  const cards = [
    { label: "Przyjazdy dziś", value: data?.todayArrivals || 0, icon: Plane, color: "text-green-600", link: "/recepcja/rezerwacje" },
    { label: "Wyjazdy dziś", value: data?.todayDepartures || 0, icon: PlaneLanding, color: "text-blue-600", link: "/recepcja/rezerwacje" },
    { label: "Zaległe płatności", value: data?.overduePayments || 0, icon: AlertCircle, color: "text-red-600", link: "/recepcja/podnajem/rozliczenia" },
    { label: "Zadania na dziś", value: data?.todayTasks || 0, icon: CheckSquare, color: "text-orange-600", link: "/recepcja/zadania" },
    { label: "Oczekujący najemcy", value: data?.pendingSubmissions || 0, icon: UserPlus, color: "text-purple-600", link: "/recepcja/podnajem/nowy-najemca" },
    { label: "Otwarte usterki", value: data?.openIssues || 0, icon: AlertTriangle, color: "text-yellow-600", link: "/recepcja/usterki" },
    { label: "Nowe noty do wydrukowania", value: newNotesCount, icon: FileText, color: "text-teal-600", link: "/recepcja/dokumenty" },
    { label: "Nieopłacone media", value: data?.unpaidMediaCount || 0, icon: Zap, color: "text-amber-600", link: "/recepcja/dokumenty" },
    { label: "Kończące się podnajmy", value: data?.subleasesEndingSoonCount || 0, icon: CalendarClock, color: "text-violet-600", link: "/recepcja/podnajem" },
    { label: "Nadchodzące płatności (7 dni)", value: data?.upcomingPaymentsCount || 0, icon: CreditCard, color: "text-sky-600", link: "/recepcja/podnajem/rozliczenia" },
  ];

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
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-recepcja-dashboard-title">Dashboard</h1>
      </div>

      {trendAmounts.length > 1 && (
        <Card className="p-4" data-testid="card-payment-trend">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Wpłaty — ostatnie 30 dni</div>
              <div className="text-lg font-bold" data-testid="text-payment-trend-total">{formatAmount(totalLast30)}</div>
            </div>
            <MiniSparkline data={trendAmounts} width={160} height={36} />
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(10)].map((_, i) => (
            <Card key={i} className="p-4 animate-pulse"><div className="h-16 bg-muted rounded" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <Link key={card.label} href={card.link}>
                <Card className="p-4 hover:shadow-md transition-shadow cursor-pointer" data-testid={`card-dashboard-${card.label.toLowerCase().replace(/\s+/g, '-')}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-muted ${card.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{card.value}</div>
                      <div className="text-xs text-muted-foreground">{card.label}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {data?.arrivals?.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Plane className="h-4 w-4 text-green-600" /> Dzisiejsze przyjazdy
          </h2>
          <div className="space-y-2">
            {data.arrivals.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span className="font-medium">{r.guestName}</span>
                <span className="text-muted-foreground">{r.apartmentName || `Apt #${r.apartmentId}`}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data?.departures?.length > 0 && (
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <PlaneLanding className="h-4 w-4 text-blue-600" /> Dzisiejsze wyjazdy
          </h2>
          <div className="space-y-2">
            {data.departures.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span className="font-medium">{r.guestName}</span>
                <span className="text-muted-foreground">{r.apartmentName || `Apt #${r.apartmentId}`}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data?.unpaidMediaList?.length > 0 && (
        <Card className="p-4" data-testid="card-unpaid-media-list">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-600" /> Nieopłacone rozliczenia mediów
          </h2>
          <div className="space-y-2">
            {data.unpaidMediaList.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div>
                  <span className="font-medium">{r.tenantName}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{r.apartmentName}</span>
                  {r.noteNumber && <span className="text-muted-foreground ml-2 text-xs">({r.noteNumber})</span>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs no-default-hover-elevate no-default-active-elevate">{formatAmount(r.totalCost)}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDate(r.generatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data?.upcomingPaymentsList?.length > 0 && (
        <Card className="p-4" data-testid="card-upcoming-payments-list">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-sky-600" /> Nadchodzące płatności (7 dni)
          </h2>
          <div className="space-y-2">
            {data.upcomingPaymentsList.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div>
                  <span className="font-medium">{p.tenantName}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{p.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{formatAmount(p.amount)}</span>
                  <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">
                    {formatDate(p.dueDate)}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {data?.subleasesEndingSoonList?.length > 0 && (
        <Card className="p-4" data-testid="card-subleases-ending-list">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-violet-600" /> Kończące się podnajmy (30 dni)
          </h2>
          <div className="space-y-2">
            {data.subleasesEndingSoonList.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                <div>
                  <span className="font-medium">{s.tenantName}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{s.apartmentName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{formatDate(s.endDate)}</span>
                  <Badge
                    variant={s.daysLeft <= 7 ? "destructive" : "outline"}
                    className="text-xs no-default-hover-elevate no-default-active-elevate"
                  >
                    {s.daysLeft === 0 ? "dziś" : s.daysLeft === 1 ? "1 dzień" : `${s.daysLeft} dni`}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
