import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import {
  Users,
  LayoutDashboard,
  UserCog,
  FileCheck,
  Banknote,
  GraduationCap,
  AlertTriangle,
  UserCheck,
  UserX,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { Employee } from "@shared/schema";
import Employees from "@/pages/Employees";
import UmowyPracownicze from "@/pages/UmowyPracownicze";
import ListaPlac from "@/pages/ListaPlac";
import Szkolenia from "@/pages/Szkolenia";

const TABS = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "lista", label: "Lista pracowników", icon: UserCog },
  { value: "umowy", label: "Umowy", icon: FileCheck },
  { value: "lista-plac", label: "Lista płac", icon: Banknote },
  { value: "szkolenia", label: "Szkolenia", icon: GraduationCap },
];

interface DashboardReminders {
  expiringExams: Array<{
    id: number;
    examName: string;
    validUntil: string;
    employeeName: string;
  }>;
  overdueCosts: number;
  overdueSubleasePayments: number;
  upcomingArrivals: number;
  expiringLeases: any[];
  expiringSubleases: any[];
  upcomingInspections: any[];
}

interface EmployeeStat {
  employeeId: number;
  employeeName: string;
  position: string;
  totalDays: number;
  totalHours: number;
  avgHoursPerDay: number;
  overtimeHours: number;
  lateCount: number;
  earlyLeaveCount: number;
  punctualityRate: number;
  outsideZoneCount: number;
}

interface ExpiringContract {
  id: number;
  employeeName?: string;
  title: string;
  endDate?: string;
  computedStatus?: string;
}

interface ExpiringTraining {
  id: number;
  employeeName: string;
  name: string;
  expiryDate?: string;
  status: string;
}

function getInitialTab(): string {
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && TABS.some((t) => t.value === tab)) return tab;
  }
  return "dashboard";
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function DashboardTab() {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: employees, isLoading: empLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: reminders, isLoading: remLoading } =
    useQuery<DashboardReminders>({
      queryKey: ["/api/dashboard-reminders"],
    });

  const { data: employeeStats } = useQuery<EmployeeStat[]>({
    queryKey: ["/api/rcp/employee-stats", from, to],
    queryFn: async () => {
      const res = await fetch(
        `/api/rcp/employee-stats?from=${from}&to=${to}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });

  const { data: expiringContracts } = useQuery<ExpiringContract[]>({
    queryKey: ["/api/employee-contracts/expiring"],
  });

  const { data: expiringTrainings } = useQuery<ExpiringTraining[]>({
    queryKey: ["/api/employee-trainings/expiring"],
  });

  const activeCount =
    employees?.filter((e) => e.status === "AKTYWNY").length ?? 0;
  const inactiveCount =
    employees?.filter((e) => e.status === "NIEAKTYWNY").length ?? 0;
  const totalCount = employees?.length ?? 0;

  const chartData = (employeeStats || [])
    .filter((s) => s.totalHours > 0)
    .sort((a, b) => b.totalHours - a.totalHours)
    .slice(0, 10)
    .map((s) => ({
      name: s.employeeName.split(" ")[0],
      godziny: s.totalHours,
    }));

  const alerts: Array<{
    id: string;
    icon: typeof AlertTriangle;
    text: string;
    variant: "destructive" | "secondary" | "outline";
  }> = [];

  if (reminders?.expiringExams) {
    reminders.expiringExams.slice(0, 3).forEach((exam) => {
      alerts.push({
        id: `exam-${exam.id}`,
        icon: AlertTriangle,
        text: `Badanie "${exam.examName}" — ${exam.employeeName} wygasa ${formatDate(exam.validUntil)}`,
        variant: "destructive",
      });
    });
  }

  if (expiringContracts) {
    expiringContracts.slice(0, 3).forEach((c) => {
      alerts.push({
        id: `contract-${c.id}`,
        icon: Clock,
        text: `Umowa "${c.title}" — ${c.employeeName || "?"} kończy się ${formatDate(c.endDate)}`,
        variant: "secondary",
      });
    });
  }

  if (expiringTrainings) {
    expiringTrainings.slice(0, 3).forEach((t) => {
      const isExpired = t.status === "WYGASŁE";
      alerts.push({
        id: `training-${t.id}`,
        icon: GraduationCap,
        text: `Szkolenie "${t.name}" — ${t.employeeName} ${isExpired ? "wygasło" : "wygasa"} ${formatDate(t.expiryDate)}`,
        variant: isExpired ? "destructive" : "secondary",
      });
    });
  }

  if (empLoading || remLoading) {
    return (
      <div className="space-y-6 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-emerald-500/10">
              <UserCheck className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Aktywni pracownicy
              </p>
              <p
                className="text-2xl font-bold"
                data-testid="text-active-employees"
              >
                {activeCount}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-gray-500/10">
              <UserX className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Nieaktywni</p>
              <p
                className="text-2xl font-bold"
                data-testid="text-inactive-employees"
              >
                {inactiveCount}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Łącznie</p>
              <p
                className="text-2xl font-bold"
                data-testid="text-total-employees"
              >
                {totalCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {alerts.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-sm text-amber-700 dark:text-amber-300">
                Alerty kadrowe
              </span>
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert) => {
                const Icon = alert.icon;
                return (
                  <div
                    key={alert.id}
                    className="flex items-center gap-2 text-sm"
                    data-testid={`alert-${alert.id}`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1">{alert.text}</span>
                    <Badge variant={alert.variant} className="text-xs">
                      {alert.variant === "destructive"
                        ? "Pilne"
                        : "Uwaga"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-4">
              Godziny pracy — bieżący miesiąc
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar
                    dataKey="godziny"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PracownicyHub() {
  const [activeTab, setActiveTab] = useState(getInitialTab);

  function handleTabChange(value: string) {
    setActiveTab(value);
    const url = new URL(window.location.href);
    if (value === "dashboard") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", value);
    }
    window.history.replaceState({}, "", url.toString());
  }

  return (
    <div className="space-y-0" data-testid="page-pracownicy-hub">
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-2">
        <PageHeader
          title="Pracownicy"
          description="Zarządzanie pracownikami, umowami, listą płac i szkoleniami"
          icon={Users}
        />
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full mt-4"
        >
          <TabsList
            className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0"
            data-testid="tabs-pracownicy"
          >
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
          <TabsContent value="dashboard" className="mt-0">
            <DashboardTab />
          </TabsContent>
          <TabsContent value="lista" className="mt-0">
            <Employees />
          </TabsContent>
          <TabsContent value="umowy" className="mt-0">
            <UmowyPracownicze />
          </TabsContent>
          <TabsContent value="lista-plac" className="mt-0">
            <ListaPlac />
          </TabsContent>
          <TabsContent value="szkolenia" className="mt-0">
            <Szkolenia />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
