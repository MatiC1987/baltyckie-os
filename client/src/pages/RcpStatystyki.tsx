import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Users, Clock, Award, ArrowUpDown, Search, FileSpreadsheet, AlertTriangle, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import * as XLSX from "xlsx";

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

interface MonthlyTrend {
  month: string;
  lateCount: number;
  overtimeHours: number;
  totalWorkHours: number;
  missedClockIns: number;
}

interface MissingClockIn {
  employeeId: number;
  employeeName: string;
  position: string;
  scheduledStart: string;
  minutesOverdue: number;
}

type SortField = "employeeName" | "totalDays" | "totalHours" | "overtimeHours" | "punctualityRate" | "lateCount";
type SortDir = "asc" | "desc";

const POSITION_LABELS: Record<string, string> = {
  KIEROWNIK_RECEPCJI: "Kierownik recepcji",
  PRACOWNIK_RECEPCJI: "Pracownik recepcji",
  KONSERWATOR: "Konserwator",
  OSOBA_SPRZATAJACA: "Osoba sprzątająca",
  FINANCIAL_MANAGER: "Manager finansowy",
};

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

export default function RcpStatystyki() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(formatDate(firstDay));
  const [toDate, setToDate] = useState(formatDate(lastDay));
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("employeeName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: stats = [], isLoading, isError } = useQuery<EmployeeStat[]>({
    queryKey: ["/api/rcp/employee-stats", fromDate, toDate],
    queryFn: async () => {
      const res = await fetch(`/api/rcp/employee-stats?from=${fromDate}&to=${toDate}`);
      if (!res.ok) throw new Error("Błąd pobierania danych");
      return res.json();
    },
  });

  const { data: monthlyTrend = [] } = useQuery<MonthlyTrend[]>({
    queryKey: ["/api/rcp/monthly-trend"],
  });

  const { data: missingClockIns = [] } = useQuery<MissingClockIn[]>({
    queryKey: ["/api/rcp/missing-clockins"],
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = [...stats];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        s =>
          s.employeeName.toLowerCase().includes(q) ||
          (POSITION_LABELS[s.position] || s.position).toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      const nA = valA as number;
      const nB = valB as number;
      return sortDir === "asc" ? nA - nB : nB - nA;
    });
    return result;
  }, [stats, search, sortField, sortDir]);

  const totalEmployees = stats.length;
  const avgHours = totalEmployees > 0
    ? Math.round((stats.reduce((s, e) => s + e.totalHours, 0) / totalEmployees) * 100) / 100
    : 0;
  const bestPunctuality = totalEmployees > 0
    ? Math.max(...stats.map(s => s.punctualityRate))
    : 0;
  const totalLateCount = stats.reduce((s, e) => s + e.lateCount, 0);

  const chartData = filtered.map(s => ({
    name: s.employeeName.length > 15 ? s.employeeName.slice(0, 15) + "..." : s.employeeName,
    godziny: s.totalHours,
    nadgodziny: s.overtimeHours,
  }));

  function exportExcel() {
    if (filtered.length === 0) return;
    const headerRows = [
      ["Statystyki pracowników"],
      [`Okres: ${fromDate} — ${toDate}`],
      [],
      ["Pracownik", "Stanowisko", "Dni", "Godziny", "Śr. h/dzień", "Nadgodziny", "Spóźnienia", "Punktualność %", "Wcz. wyjścia", "Poza strefą"],
    ];

    const dataRows = filtered.map(s => [
      s.employeeName,
      POSITION_LABELS[s.position] || s.position,
      s.totalDays,
      s.totalHours,
      s.avgHoursPerDay,
      s.overtimeHours,
      s.lateCount,
      s.punctualityRate,
      s.earlyLeaveCount,
      s.outsideZoneCount,
    ]);

    const summaryRows = [
      [],
      ["Podsumowanie"],
      ["Pracowników", totalEmployees],
      ["Średnio godzin", avgHours],
      ["Najlepsza punktualność", `${bestPunctuality}%`],
      ["Łączne spóźnienia", totalLateCount],
    ];

    const allRows = [...headerRows, ...dataRows, ...summaryRows];
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    ws["!cols"] = [
      { wch: 24 }, { wch: 20 }, { wch: 6 }, { wch: 10 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Statystyki");
    XLSX.writeFile(wb, `Statystyki_RCP_${fromDate}_${toDate}.xlsx`);
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 -ml-3 no-default-hover-elevate no-default-active-elevate"
      onClick={() => toggleSort(field)}
      data-testid={`button-sort-${field}`}
    >
      {children}
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Statystyki pracowników"
        description="Analiza czasu pracy i punktualności"
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              data-testid="input-date-from"
            />
            <span className="text-muted-foreground">—</span>
            <Input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              data-testid="input-date-to"
            />
            <Button variant="outline" onClick={exportExcel} disabled={filtered.length === 0} data-testid="button-export-stats-excel">
              <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
            </Button>
          </div>
        }
      />

      {missingClockIns.length > 0 && (
        <Card className="border-red-200 dark:border-red-800" data-testid="alert-missing-clockins-stats">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="font-semibold">Brak rejestracji wejścia dzisiaj</span>
              <Badge variant="destructive">{missingClockIns.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {missingClockIns.map((m) => (
                <Badge key={m.employeeId} variant="outline" data-testid={`badge-missing-${m.employeeId}`}>
                  {m.employeeName} (plan: {m.scheduledStart}, {m.minutesOverdue} min temu)
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pracownicy</p>
              <p className="text-2xl font-bold" data-testid="text-total-employees">
                {isLoading ? <Skeleton className="h-7 w-10" /> : totalEmployees}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Śr. godzin</p>
              <p className="text-2xl font-bold" data-testid="text-avg-hours">
                {isLoading ? <Skeleton className="h-7 w-10" /> : `${avgHours}h`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Najlepsza punktualność</p>
              <p className="text-2xl font-bold" data-testid="text-best-punctuality">
                {isLoading ? <Skeleton className="h-7 w-10" /> : `${bestPunctuality}%`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500/10 shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Łączne spóźnienia</p>
              <p className="text-2xl font-bold" data-testid="text-total-late">
                {isLoading ? <Skeleton className="h-7 w-10" /> : totalLateCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {filtered.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Godziny pracy wg pracownika</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="godziny" fill="hsl(var(--primary))" name="Godziny" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="nadgodziny" fill="hsl(var(--destructive))" name="Nadgodziny" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {monthlyTrend.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Trend spóźnień i nadgodzin (6 miesięcy)</h3>
            </div>
            <div className="h-64" data-testid="chart-trend-stats">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="lateCount" stroke="hsl(var(--destructive))" name="Spóźnienia" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="overtimeHours" stroke="hsl(var(--primary))" name="Nadgodziny (h)" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="missedClockIns" stroke="hsl(var(--chart-3, 30 80% 55%))" name="Brak rejestracji" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj pracownika..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs"
              data-testid="input-search"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-destructive" data-testid="text-error">
              Błąd pobierania danych. Sprawdź zakres dat i spróbuj ponownie.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortButton field="employeeName">Pracownik</SortButton>
                    </TableHead>
                    <TableHead>Stanowisko</TableHead>
                    <TableHead className="text-right">
                      <SortButton field="totalDays">Dni</SortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton field="totalHours">Godziny</SortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton field="overtimeHours">Nadgodziny</SortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton field="punctualityRate">Punktualność</SortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton field="lateCount">Spóźnienia</SortButton>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Brak danych dla wybranego okresu
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(s => (
                      <TableRow key={s.employeeId} data-testid={`row-employee-${s.employeeId}`}>
                        <TableCell className="font-medium" data-testid={`text-name-${s.employeeId}`}>
                          {s.employeeName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {POSITION_LABELS[s.position] || s.position}
                        </TableCell>
                        <TableCell className="text-right">{s.totalDays}</TableCell>
                        <TableCell className="text-right">{s.totalHours}h</TableCell>
                        <TableCell className="text-right">{s.overtimeHours}h</TableCell>
                        <TableCell className="text-right">{s.punctualityRate}%</TableCell>
                        <TableCell className="text-right">{s.lateCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
