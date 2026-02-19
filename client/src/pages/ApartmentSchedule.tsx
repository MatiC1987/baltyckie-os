import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CostSchedule, CostSchedulePayment } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, Building2, CheckCircle2, XCircle, Clock, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type CostScheduleWithPayments = CostSchedule & { payments: CostSchedulePayment[] };

type SortField = "apartment" | "category" | "dueDate" | "amount" | "status";
type SortDir = "asc" | "desc";

interface FlatPayment {
  paymentId: number;
  scheduleId: number;
  aptName: string;
  costCategory: string;
  dueDate: string;
  amount: number;
  forecastAmount: number | null;
  status: string;
  paidDate: string | null;
  notes: string | null;
  scheduleName: string;
}

function formatNum(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (isNaN(n) || n === 0) return "0,00";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}

function extractAptName(scheduleName: string): string {
  const idx = scheduleName.indexOf(" - ");
  if (idx > 0) return scheduleName.substring(0, idx);
  return scheduleName;
}

function extractCostCategory(scheduleName: string): string {
  const idx = scheduleName.indexOf(" - ");
  if (idx > 0) return scheduleName.substring(idx + 3);
  return scheduleName;
}

export default function ApartmentSchedule() {
  const { data: schedules = [], isLoading } = useQuery<CostScheduleWithPayments[]>({
    queryKey: ["/api/cost-schedules"],
  });
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("ALL");
  const [monthFilter, setMonthFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [aptFilter, setAptFilter] = useState("ALL");
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const togglePaymentMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: number; newStatus: string }) => {
      return apiRequest("PATCH", `/api/cost-schedule-payments/${id}`, {
        status: newStatus,
        paidDate: newStatus === "OPLACONE" ? new Date().toISOString().split("T")[0] : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedules"] });
      toast({ title: "Status płatności zaktualizowany" });
    },
  });

  const aptSchedules = useMemo(() => {
    return schedules.filter(s => s.category === "APARTAMENTY");
  }, [schedules]);

  const flatPayments: FlatPayment[] = useMemo(() => {
    const result: FlatPayment[] = [];
    for (const s of aptSchedules) {
      const aptName = extractAptName(s.name);
      const costCategory = extractCostCategory(s.name);
      for (const p of s.payments || []) {
        result.push({
          paymentId: p.id,
          scheduleId: s.id,
          aptName,
          costCategory,
          dueDate: p.dueDate,
          amount: parseFloat(p.amount || "0"),
          forecastAmount: p.forecastAmount ? parseFloat(p.forecastAmount) : null,
          status: p.status,
          paidDate: p.paidDate,
          notes: p.notes,
          scheduleName: s.name,
        });
      }
    }
    return result;
  }, [aptSchedules]);

  const years = useMemo(() => {
    const yrs = new Set<string>();
    for (const p of flatPayments) {
      if (p.dueDate) yrs.add(p.dueDate.substring(0, 4));
    }
    return Array.from(yrs).sort();
  }, [flatPayments]);

  const apartments = useMemo(() => {
    const apts = new Set<string>();
    for (const p of flatPayments) apts.add(p.aptName);
    return Array.from(apts).sort((a, b) => a.localeCompare(b, "pl"));
  }, [flatPayments]);

  const months = [
    { value: "01", label: "Styczeń" }, { value: "02", label: "Luty" },
    { value: "03", label: "Marzec" }, { value: "04", label: "Kwiecień" },
    { value: "05", label: "Maj" }, { value: "06", label: "Czerwiec" },
    { value: "07", label: "Lipiec" }, { value: "08", label: "Sierpień" },
    { value: "09", label: "Wrzesień" }, { value: "10", label: "Październik" },
    { value: "11", label: "Listopad" }, { value: "12", label: "Grudzień" },
  ];

  const filtered = useMemo(() => {
    let result = flatPayments;
    if (yearFilter !== "ALL") result = result.filter(p => p.dueDate.startsWith(yearFilter));
    if (monthFilter !== "ALL") result = result.filter(p => p.dueDate.substring(5, 7) === monthFilter);
    if (statusFilter !== "ALL") result = result.filter(p => p.status === statusFilter);
    if (aptFilter !== "ALL") result = result.filter(p => p.aptName === aptFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.aptName.toLowerCase().includes(q) ||
        p.costCategory.toLowerCase().includes(q) ||
        (p.notes || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [flatPayments, yearFilter, monthFilter, statusFilter, aptFilter, searchQuery]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortField) {
        case "apartment": return dir * a.aptName.localeCompare(b.aptName, "pl");
        case "category": return dir * a.costCategory.localeCompare(b.costCategory, "pl");
        case "dueDate": return dir * a.dueDate.localeCompare(b.dueDate);
        case "amount": return dir * (a.amount - b.amount);
        case "status": return dir * a.status.localeCompare(b.status);
        default: return 0;
      }
    });
    return copy;
  }, [filtered, sortField, sortDir]);

  const totals = useMemo(() => {
    const paid = filtered.filter(p => p.status === "OPLACONE").reduce((s, p) => s + p.amount, 0);
    const unpaid = filtered.filter(p => p.status !== "OPLACONE").reduce((s, p) => s + p.amount, 0);
    const overdue = filtered.filter(p => p.status !== "OPLACONE" && p.dueDate < new Date().toISOString().split("T")[0]).length;
    return { paid, unpaid, total: paid + unpaid, count: filtered.length, overdue };
  }, [filtered]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const handleExportCSV = () => {
    const header = "Apartament;Kategoria;Termin płatności;Kwota;Status;Data zapłaty;Uwagi";
    const rows = sorted.map(p =>
      `${p.aptName};${p.costCategory};${p.dueDate};${p.amount.toFixed(2).replace(".", ",")};${p.status};${p.paidDate || ""};${(p.notes || "").replace(/;/g, ",")}`
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `harmonogram-apartamentow-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const SortableHead = ({ field, children, className }: { field: SortField; children: string; className?: string }) => (
    <TableHead
      className={`text-xs font-semibold cursor-pointer select-none hover:bg-muted/80 transition-colors whitespace-nowrap ${className || ""}`}
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-[#5ADBFA]" : "text-muted-foreground/50"}`} />
      </span>
    </TableHead>
  );

  const getStatusBadge = (status: string, dueDate: string) => {
    const isOverdue = status !== "OPLACONE" && dueDate < new Date().toISOString().split("T")[0];
    if (status === "OPLACONE") {
      return <Badge variant="outline" className="text-xs gap-1 text-green-600 dark:text-green-400 border-green-600/30"><CheckCircle2 className="h-3 w-3" />Opłacone</Badge>;
    }
    if (isOverdue) {
      return <Badge variant="outline" className="text-xs gap-1 text-red-600 dark:text-red-400 border-red-600/30"><XCircle className="h-3 w-3" />Zaległe</Badge>;
    }
    return <Badge variant="outline" className="text-xs gap-1 text-amber-600 dark:text-amber-400 border-amber-600/30"><Clock className="h-3 w-3" />Oczekujące</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Apartamenty - Harmonogram</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-apartment-schedule-title">Apartamenty - Harmonogram</h2>
          <p className="text-muted-foreground">Chronologiczna lista opłat eksploatacyjnych apartamentów</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV} disabled={sorted.length === 0} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-2" />
          Eksport CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-count">{totals.count}</div>
            <div className="text-xs text-muted-foreground">Płatności</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-stat-paid">{formatNum(totals.paid)}</div>
            <div className="text-xs text-muted-foreground">Opłacone (PLN)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-stat-unpaid">{formatNum(totals.unpaid)}</div>
            <div className="text-xs text-muted-foreground">Nieopłacone (PLN)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-[#5ADBFA]" data-testid="text-stat-total">{formatNum(totals.total)}</div>
            <div className="text-xs text-muted-foreground">Razem (PLN)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className={`text-2xl font-bold ${totals.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`} data-testid="text-stat-overdue">{totals.overdue}</div>
            <div className="text-xs text-muted-foreground">Zaległe</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Szukaj po apartamencie, kategorii..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            data-testid="input-search-schedule"
          />
        </div>
        <Select value={aptFilter} onValueChange={setAptFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-apt">
            <SelectValue placeholder="Apartament" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie apt.</SelectItem>
            {apartments.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[120px]" data-testid="select-filter-year">
            <SelectValue placeholder="Rok" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie</SelectItem>
            {years.map(yr => <SelectItem key={yr} value={yr}>{yr}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-month">
            <SelectValue placeholder="Miesiąc" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie</SelectItem>
            {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie</SelectItem>
            <SelectItem value="OPLACONE">Opłacone</SelectItem>
            <SelectItem value="NIEOPLACONE">Nieopłacone</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Brak płatności spełniających kryteria.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <SortableHead field="dueDate">Termin</SortableHead>
                <SortableHead field="apartment">Apartament</SortableHead>
                <SortableHead field="category">Kategoria kosztu</SortableHead>
                <SortableHead field="amount" className="text-right">Kwota (PLN)</SortableHead>
                <SortableHead field="status">Status</SortableHead>
                <TableHead className="text-xs font-semibold whitespace-nowrap">Zapłacono</TableHead>
                <TableHead className="text-xs font-semibold whitespace-nowrap text-center">Akcja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map(p => {
                const isOverdue = p.status !== "OPLACONE" && p.dueDate < new Date().toISOString().split("T")[0];
                return (
                  <TableRow
                    key={p.paymentId}
                    className={isOverdue ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                    data-testid={`row-payment-${p.paymentId}`}
                  >
                    <TableCell className="text-sm tabular-nums whitespace-nowrap">
                      {formatDate(p.dueDate)}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {p.aptName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {p.costCategory}
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums whitespace-nowrap font-medium">
                      {formatNum(p.amount)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(p.status, p.dueDate)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums whitespace-nowrap text-muted-foreground">
                      {p.paidDate ? formatDate(p.paidDate) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant={p.status === "OPLACONE" ? "outline" : "default"}
                        onClick={() => togglePaymentMutation.mutate({
                          id: p.paymentId,
                          newStatus: p.status === "OPLACONE" ? "NIEOPLACONE" : "OPLACONE",
                        })}
                        disabled={togglePaymentMutation.isPending}
                        data-testid={`button-toggle-payment-${p.paymentId}`}
                      >
                        {p.status === "OPLACONE" ? "Cofnij" : "Opłać"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="text-sm text-muted-foreground" data-testid="text-schedule-count">
        Wyświetlono {sorted.length} z {flatPayments.length} płatności
      </div>
    </div>
  );
}
