import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, AlertCircle, Clock, Coffee, MapPin,
} from "lucide-react";
import { format } from "date-fns";

type TeamStatus = { working: number; onBreak: number; absent: number; total: number };
type EmployeeStat = { employeeId: number; employeeName: string; totalHours: number; lateCount: number; outsideZoneCount: number };

export function RcpSummaryWidget() {
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
