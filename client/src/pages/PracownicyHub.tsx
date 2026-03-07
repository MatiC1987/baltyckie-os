import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Stethoscope,
  CircleDollarSign,
  ArrowRight,
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
  { value: "kalendarz", label: "Kalendarz HR", icon: CalendarDays },
];

const POSITIONS: Record<string, string> = {
  KIEROWNIK_RECEPCJI: "Kierownik recepcji",
  PRACOWNIK_RECEPCJI: "Pracownik recepcji",
  FINANCIAL_MANAGER: "Financial Manager",
  KONSERWATOR: "Konserwator",
  OSOBA_SPRZATAJACA: "Osoba sprzątająca",
};

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
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

interface HrCalendarEvent {
  id: string;
  type: "contract" | "training" | "exam";
  date: string;
  title: string;
  employeeName: string;
  employeeId: number;
  status: string;
}

interface ProfileTimelineItem {
  type: string;
  date: string;
  title: string;
  status: string;
  data: any;
}

interface EmployeeProfile {
  employee: Employee;
  contracts: any[];
  trainings: any[];
  exams: any[];
  payroll: any[];
  totalCost: number;
  timeline: ProfileTimelineItem[];
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

function formatCurrency(val: number | string | null | undefined): string {
  const n = Number(val || 0);
  return n.toLocaleString("pl-PL", { style: "currency", currency: "PLN" });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getStatusBadgeVariant(status: string): "destructive" | "secondary" | "default" | "outline" {
  switch (status) {
    case "WYGASŁE":
    case "ZAKOŃCZONA":
      return "destructive";
    case "WYGASAJĄCE":
    case "KOŃCZĄCA_SIĘ":
      return "secondary";
    default:
      return "default";
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    AKTUALNE: "Aktualne",
    WYGASAJĄCE: "Wygasa",
    WYGASŁE: "Wygasło",
    AKTYWNA: "Aktywna",
    ZAKOŃCZONA: "Zakończona",
    WYPOWIEDZIANA: "Wypowiedziana",
    KOŃCZĄCA_SIĘ: "Kończąca się",
  };
  return labels[status] || status;
}

function getTimelineIcon(type: string) {
  switch (type) {
    case "contract":
    case "contract_end":
      return FileText;
    case "training":
      return GraduationCap;
    case "exam":
      return Stethoscope;
    default:
      return Clock;
  }
}

function getTimelineColor(type: string, status: string) {
  if (status === "WYGASŁE" || status === "ZAKOŃCZONA") return "text-destructive";
  if (status === "WYGASAJĄCE" || status === "KOŃCZĄCA_SIĘ") return "text-amber-500";
  switch (type) {
    case "contract":
    case "contract_end":
      return "text-blue-500";
    case "training":
      return "text-purple-500";
    case "exam":
      return "text-emerald-500";
    default:
      return "text-muted-foreground";
  }
}

function EmployeeProfileDialog({
  employeeId,
  open,
  onOpenChange,
}: {
  employeeId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [profileTab, setProfileTab] = useState("timeline");

  const { data: profile, isLoading } = useQuery<EmployeeProfile>({
    queryKey: ["/api/employees", employeeId, "profile"],
    queryFn: async () => {
      const res = await fetch(`/api/employees/${employeeId}/profile`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json();
    },
    enabled: !!employeeId && open,
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-employee-profile-title">
            {profile ? `${profile.employee.firstName} ${profile.employee.lastName}` : "Profil pracownika"}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {profile && (
          <div className="pt-2 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              {profile.employee.photoUrl ? (
                <img src={profile.employee.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover border border-border" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {profile.employee.firstName.charAt(0)}{profile.employee.lastName.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold">{profile.employee.firstName} {profile.employee.lastName}</p>
                <p className="text-sm text-muted-foreground">{POSITIONS[profile.employee.position] || profile.employee.position}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={profile.employee.status === "AKTYWNY" ? "default" : "secondary"}>
                  {profile.employee.status === "AKTYWNY" ? "Aktywny" : "Nieaktywny"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Umowy</p>
                  <p className="text-xl font-bold" data-testid="text-profile-contracts-count">{profile.contracts.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Szkolenia</p>
                  <p className="text-xl font-bold" data-testid="text-profile-trainings-count">{profile.trainings.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Badania</p>
                  <p className="text-xl font-bold" data-testid="text-profile-exams-count">{profile.exams.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Koszt brutto</p>
                  <p className="text-xl font-bold" data-testid="text-profile-total-cost">{formatCurrency(profile.totalCost)}</p>
                </CardContent>
              </Card>
            </div>

            <Tabs value={profileTab} onValueChange={setProfileTab} className="w-full">
              <TabsList className="w-full grid grid-cols-4 h-auto">
                <TabsTrigger value="timeline" data-testid="tab-profile-timeline">Historia</TabsTrigger>
                <TabsTrigger value="contracts" data-testid="tab-profile-contracts">Umowy</TabsTrigger>
                <TabsTrigger value="trainings" data-testid="tab-profile-trainings">Szkolenia</TabsTrigger>
                <TabsTrigger value="costs" data-testid="tab-profile-costs">Koszty</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="mt-4">
                {profile.timeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Brak zdarzeń w historii.</p>
                ) : (
                  <div className="relative pl-6 space-y-0">
                    <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
                    {profile.timeline.map((item, idx) => {
                      const Icon = getTimelineIcon(item.type);
                      const colorClass = getTimelineColor(item.type, item.status);
                      return (
                        <div key={idx} className="relative flex items-start gap-3 py-3" data-testid={`timeline-item-${idx}`}>
                          <div className={`absolute -left-6 mt-0.5 flex items-center justify-center h-6 w-6 rounded-full bg-background border border-border z-10 ${colorClass}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{item.title}</span>
                              <Badge variant={getStatusBadgeVariant(item.status)} className="text-xs">
                                {getStatusLabel(item.status)}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(item.date)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="contracts" className="mt-4">
                {profile.contracts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Brak umów.</p>
                ) : (
                  <div className="space-y-3">
                    {profile.contracts.map((c: any) => (
                      <Card key={c.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm">{c.title}</span>
                            <Badge variant={getStatusBadgeVariant(c.computedStatus)} className="text-xs">
                              {getStatusLabel(c.computedStatus)}
                            </Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <span>Od: {formatDate(c.startDate)}</span>
                            <span>Do: {c.endDate ? formatDate(c.endDate) : "Bezterminowa"}</span>
                            {c.salary && <span>Wynagrodzenie: {formatCurrency(c.salary)}</span>}
                            {c.hourlyRate && <span>Stawka/h: {formatCurrency(c.hourlyRate)}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="trainings" className="mt-4">
                {profile.trainings.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Brak szkoleń.</p>
                ) : (
                  <div className="space-y-3">
                    {profile.trainings.map((t: any) => (
                      <Card key={t.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <GraduationCap className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm">{t.name}</span>
                            <Badge variant={getStatusBadgeVariant(t.computedStatus)} className="text-xs">
                              {getStatusLabel(t.computedStatus)}
                            </Badge>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                            <span>Ukończono: {formatDate(t.completedDate)}</span>
                            <span>Wygasa: {t.expiryDate ? formatDate(t.expiryDate) : "—"}</span>
                            {t.provider && <span>Dostawca: {t.provider}</span>}
                            {t.certificateNumber && <span>Nr certyfikatu: {t.certificateNumber}</span>}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="costs" className="mt-4">
                {profile.payroll.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Brak danych płacowych.</p>
                ) : (
                  <div className="space-y-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                          <span className="font-semibold text-sm">Podsumowanie kosztów</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Łączny koszt brutto</p>
                            <p className="text-lg font-bold" data-testid="text-profile-cost-total">{formatCurrency(profile.totalCost)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Średni koszt/mies.</p>
                            <p className="text-lg font-bold">{formatCurrency(profile.totalCost / (profile.payroll.length || 1))}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Liczba okresów</p>
                            <p className="text-lg font-bold">{profile.payroll.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <div className="rounded-md border border-border overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs font-semibold">Okres</TableHead>
                            <TableHead className="text-xs font-semibold">Godziny</TableHead>
                            <TableHead className="text-xs font-semibold">Brutto</TableHead>
                            <TableHead className="text-xs font-semibold">Netto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {profile.payroll.map((p: any) => (
                            <TableRow key={p.id} data-testid={`row-payroll-${p.id}`}>
                              <TableCell className="text-sm">{p.month && p.year ? `${MONTH_NAMES[p.month - 1]} ${p.year}` : "—"}</TableCell>
                              <TableCell className="text-sm">{Number(p.totalHours || 0).toFixed(1)}h</TableCell>
                              <TableCell className="text-sm font-medium">{formatCurrency(p.grossPay)}</TableCell>
                              <TableCell className="text-sm">{formatCurrency(p.netPay)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HrCalendarTab() {
  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [filterType, setFilterType] = useState<string>("all");

  const { data: events, isLoading } = useQuery<HrCalendarEvent[]>({
    queryKey: ["/api/hr-calendar"],
  });

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter(e => {
      if (filterType !== "all" && e.type !== filterType) return false;
      const d = new Date(e.date);
      return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
    });
  }, [events, viewMonth, viewYear, filterType]);

  const upcomingEvents = useMemo(() => {
    if (!events) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    return events.filter(e => {
      const d = new Date(e.date);
      return d >= today && d <= in30;
    });
  }, [events]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;

  const eventsByDay = useMemo(() => {
    const map = new Map<number, HrCalendarEvent[]>();
    filteredEvents.forEach(e => {
      const day = new Date(e.date).getDate();
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    });
    return map;
  }, [filteredEvents]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const weekDays = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      {upcomingEvents.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-sm text-amber-700 dark:text-amber-300">
                Nadchodzące wygaśnięcia (30 dni)
              </span>
              <Badge variant="secondary" className="text-xs">{upcomingEvents.length}</Badge>
            </div>
            <div className="space-y-2">
              {upcomingEvents.slice(0, 5).map(event => {
                const days = daysUntil(event.date);
                return (
                  <div key={event.id} className="flex items-center gap-2 text-sm" data-testid={`upcoming-event-${event.id}`}>
                    <Badge variant={event.type === "contract" ? "outline" : event.type === "training" ? "secondary" : "default"} className="text-xs capitalize">
                      {event.type === "contract" ? "Umowa" : event.type === "training" ? "Szkolenie" : "Badanie"}
                    </Badge>
                    <span className="font-medium">{event.employeeName}</span>
                    <span className="text-muted-foreground">{event.title}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <Badge variant={days <= 7 ? "destructive" : "secondary"} className="text-xs">
                      {days === 0 ? "Dzisiaj" : days < 0 ? `${Math.abs(days)} dni temu` : `za ${days} dni`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={prevMonth} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[140px] text-center" data-testid="text-calendar-month">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <Button size="icon" variant="ghost" onClick={nextMonth} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]" data-testid="select-calendar-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            <SelectItem value="contract">Umowy</SelectItem>
            <SelectItem value="training">Szkolenia</SelectItem>
            <SelectItem value="exam">Badania</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-7 gap-px">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="p-1 min-h-[60px]" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = eventsByDay.get(day) || [];
              const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
              return (
                <div
                  key={day}
                  className={`p-1 min-h-[60px] border border-border/30 rounded-md ${isToday ? "bg-primary/5" : ""}`}
                  data-testid={`calendar-day-${day}`}
                >
                  <span className={`text-xs ${isToday ? "font-bold text-primary" : "text-muted-foreground"}`}>{day}</span>
                  {dayEvents.slice(0, 2).map(ev => (
                    <div
                      key={ev.id}
                      className={`mt-0.5 text-[10px] leading-tight px-1 py-0.5 rounded truncate ${
                        ev.status === "WYGASŁE" ? "bg-destructive/10 text-destructive" :
                        ev.status === "WYGASAJĄCE" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                        "bg-primary/10 text-primary"
                      }`}
                      title={`${ev.employeeName}: ${ev.title}`}
                    >
                      {ev.employeeName.split(" ")[0]}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {filteredEvents.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3">Zdarzenia w {MONTH_NAMES[viewMonth]} {viewYear}</p>
            <div className="space-y-2">
              {filteredEvents.map(event => (
                <div key={event.id} className="flex items-center gap-2 text-sm" data-testid={`calendar-event-${event.id}`}>
                  <span className="text-xs text-muted-foreground w-16 shrink-0">{formatDate(event.date)}</span>
                  <Badge variant={event.type === "contract" ? "outline" : event.type === "training" ? "secondary" : "default"} className="text-xs">
                    {event.type === "contract" ? "Umowa" : event.type === "training" ? "Szkolenie" : "Badanie"}
                  </Badge>
                  <span className="font-medium">{event.employeeName}</span>
                  <span className="text-muted-foreground truncate">{event.title}</span>
                  <Badge variant={getStatusBadgeVariant(event.status)} className="text-xs ml-auto shrink-0">
                    {getStatusLabel(event.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DashboardTab({ onOpenProfile }: { onOpenProfile: (id: number) => void }) {
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
      employeeId: s.employeeId,
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

      {employees && employees.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-3">Szybki dostęp do profili</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {employees.filter(e => e.status === "AKTYWNY").map(emp => (
                <Button
                  key={emp.id}
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => onOpenProfile(emp.id)}
                  data-testid={`button-profile-${emp.id}`}
                >
                  {emp.photoUrl ? (
                    <img src={emp.photoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                      {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                    </div>
                  )}
                  <span className="truncate text-sm">{emp.firstName} {emp.lastName}</span>
                </Button>
              ))}
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
  const [profileEmployeeId, setProfileEmployeeId] = useState<number | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);

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

  function openProfile(employeeId: number) {
    setProfileEmployeeId(employeeId);
    setProfileOpen(true);
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
            <DashboardTab onOpenProfile={openProfile} />
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
          <TabsContent value="kalendarz" className="mt-0">
            <HrCalendarTab />
          </TabsContent>
        </Tabs>
      </div>

      <EmployeeProfileDialog
        employeeId={profileEmployeeId}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </div>
  );
}
