import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Users, AlertCircle, FileText, GraduationCap,
} from "lucide-react";
import { format } from "date-fns";
import type { DashboardReminders } from "./widget-utils";

export function HrSummaryWidget({ reminders }: { reminders?: DashboardReminders }) {
  const [, navigate] = useLocation();

  const { data: employees, isLoading: empLoading } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: expiringTrainingsData } = useQuery<{ id: number; name: string; employeeName: string; expiryDate: string | null }[]>({ queryKey: ["/api/employee-trainings/expiring"] });
  const { data: expiringContractsData } = useQuery<{ id: number; title: string; employeeName: string; endDate: string | null }[]>({ queryKey: ["/api/employee-contracts/expiring"] });

  const activeCount = employees?.filter((e: any) => e.isActive !== false).length ?? 0;
  const contractAlerts = expiringContractsData?.length ?? 0;
  const examAlerts = reminders?.expiringExams?.length ?? 0;
  const trainingAlerts = expiringTrainingsData?.length ?? 0;

  const alerts: { icon: typeof AlertCircle; text: string; color: string }[] = [];
  if (reminders?.expiringExams) {
    for (const exam of reminders.expiringExams.slice(0, 2)) {
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

  if (empLoading) {
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
