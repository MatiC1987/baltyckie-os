import { useQuery } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Plane, PlaneLanding, AlertCircle, CheckSquare, UserPlus, LayoutDashboard, AlertTriangle, FileText,
} from "lucide-react";

export default function RecepcjaDashboard() {
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

  const newNotesCount = (accountingNotes || []).filter((n: any) => n.status === "NOWA").length;

  const cards = [
    { label: "Przyjazdy dziś", value: data?.todayArrivals || 0, icon: Plane, color: "text-green-600", link: "/recepcja/rezerwacje" },
    { label: "Wyjazdy dziś", value: data?.todayDepartures || 0, icon: PlaneLanding, color: "text-blue-600", link: "/recepcja/rezerwacje" },
    { label: "Zaległe płatności", value: data?.overduePayments || 0, icon: AlertCircle, color: "text-red-600", link: "/recepcja/podnajem/rozliczenia" },
    { label: "Zadania na dziś", value: data?.todayTasks || 0, icon: CheckSquare, color: "text-orange-600", link: "/recepcja/zadania" },
    { label: "Oczekujący najemcy", value: data?.pendingSubmissions || 0, icon: UserPlus, color: "text-purple-600", link: "/recepcja/podnajem/nowy-najemca" },
    { label: "Otwarte usterki", value: data?.openIssues || 0, icon: AlertTriangle, color: "text-yellow-600", link: "/recepcja/usterki" },
    { label: "Nowe noty do wydrukowania", value: newNotesCount, icon: FileText, color: "text-teal-600", link: "/recepcja/dokumenty" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-recepcja-dashboard-title">Dashboard</h1>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
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
    </div>
  );
}