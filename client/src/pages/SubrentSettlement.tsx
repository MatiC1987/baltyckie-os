import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sublease, SubleasePayment, Apartment, SubleaseApartmentChange } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Check, X, ArrowUpDown, ArrowUp, ArrowDown, HandCoins, AlertTriangle, CalendarClock, CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";

const PAYMENT_STATUS_LABELS: Record<string, { label: string; variant: "default" | "destructive" | "secondary" }> = {
  oplacona: { label: "Opłacona", variant: "default" },
  do_oplacenia: { label: "Do opłacenia", variant: "destructive" },
  czesciowo: { label: "Częściowo", variant: "secondary" },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}

function formatNum(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = parseFloat(v);
  if (isNaN(n)) return "";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type SortKey = "apartment" | "tenant" | "dueDate" | "title" | "amount" | "status";
type SortDir = "asc" | "desc";

type PaymentItem = { payment: SubleasePayment; sublease: Sublease; apartmentName: string; tenantName: string };

function PaymentTable({
  items,
  sortKey,
  sortDir,
  onSort,
  onToggleStatus,
  highlight,
  testIdPrefix,
}: {
  items: PaymentItem[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  onToggleStatus: (id: number, status: string) => void;
  highlight?: "overdue";
  testIdPrefix: string;
}) {
  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const sorted = useMemo(() => {
    const arr = [...items];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "apartment": return dir * a.apartmentName.localeCompare(b.apartmentName, "pl");
        case "tenant": return dir * a.tenantName.localeCompare(b.tenantName, "pl");
        case "dueDate": return dir * (a.payment.dueDate || "").localeCompare(b.payment.dueDate || "");
        case "title": return dir * a.payment.title.localeCompare(b.payment.title, "pl");
        case "amount": return dir * ((parseFloat(a.payment.amount) || 0) - (parseFloat(b.payment.amount) || 0));
        case "status": return dir * (a.payment.status || "").localeCompare(b.payment.status || "");
        default: return 0;
      }
    });
    return arr;
  }, [items, sortKey, sortDir]);

  if (items.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="cursor-pointer select-none" onClick={() => onSort("apartment")} data-testid={`th-${testIdPrefix}-apartment`}>
            <div className="flex items-center">Apartament<SortIcon column="apartment" /></div>
          </TableHead>
          <TableHead className="cursor-pointer select-none" onClick={() => onSort("tenant")} data-testid={`th-${testIdPrefix}-tenant`}>
            <div className="flex items-center">Najemca<SortIcon column="tenant" /></div>
          </TableHead>
          <TableHead className="cursor-pointer select-none" onClick={() => onSort("dueDate")} data-testid={`th-${testIdPrefix}-due-date`}>
            <div className="flex items-center">Data płatności<SortIcon column="dueDate" /></div>
          </TableHead>
          <TableHead className="cursor-pointer select-none" onClick={() => onSort("title")} data-testid={`th-${testIdPrefix}-title`}>
            <div className="flex items-center">Tytuł płatności<SortIcon column="title" /></div>
          </TableHead>
          <TableHead className="cursor-pointer select-none text-right" onClick={() => onSort("amount")} data-testid={`th-${testIdPrefix}-amount`}>
            <div className="flex items-center justify-end">Kwota<SortIcon column="amount" /></div>
          </TableHead>
          <TableHead className="cursor-pointer select-none text-center" onClick={() => onSort("status")} data-testid={`th-${testIdPrefix}-status`}>
            <div className="flex items-center justify-center">Status<SortIcon column="status" /></div>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((item, idx) => {
          const st = PAYMENT_STATUS_LABELS[item.payment.status] || PAYMENT_STATUS_LABELS.do_oplacenia;
          const isOverdueRow = highlight === "overdue" && item.payment.status !== "oplacona";
          return (
            <TableRow
              key={item.payment.id}
              className={`${idx % 2 === 1 ? "bg-muted/30" : ""} ${isOverdueRow ? "bg-red-500/10 dark:bg-red-900/20 border-l-2 border-l-red-500" : ""}`}
              data-testid={`row-payment-${item.payment.id}`}
            >
              <TableCell className="font-medium" data-testid={`cell-apartment-${item.payment.id}`}>{item.apartmentName}</TableCell>
              <TableCell data-testid={`cell-tenant-${item.payment.id}`}>{item.tenantName}</TableCell>
              <TableCell data-testid={`cell-date-${item.payment.id}`}>
                {isOverdueRow && <AlertTriangle className="h-3.5 w-3.5 inline mr-1 text-red-500" />}
                {formatDate(item.payment.dueDate)}
              </TableCell>
              <TableCell data-testid={`cell-title-${item.payment.id}`}>{item.payment.title}</TableCell>
              <TableCell className={`text-right tabular-nums ${isOverdueRow ? "text-red-600 dark:text-red-400 font-semibold" : ""}`} data-testid={`cell-amount-${item.payment.id}`}>
                {formatNum(item.payment.amount)} zł
              </TableCell>
              <TableCell className="text-center">
                <Badge
                  variant={st.variant}
                  className="cursor-pointer"
                  onClick={() => onToggleStatus(item.payment.id, item.payment.status)}
                  data-testid={`badge-status-${item.payment.id}`}
                >
                  {item.payment.status === "oplacona" ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                  {st.label}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default function SubrentSettlement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: subleases = [] } = useQuery<Sublease[]>({
    queryKey: ["/api/subleases"],
  });

  const { data: apartments = [] } = useQuery<Apartment[]>({
    queryKey: ["/api/apartments"],
  });

  const activeSubleases = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return subleases.filter(s => s.endDate >= today);
  }, [subleases]);

  const subleaseIds = useMemo(() => activeSubleases.map(s => s.id), [activeSubleases]);

  const paymentQueries = useQuery<{ subleaseId: number; payments: SubleasePayment[]; changes: SubleaseApartmentChange[] }[]>({
    queryKey: ["/api/sublease-payments/all", subleaseIds],
    queryFn: async () => {
      const results = await Promise.all(
        subleaseIds.map(async (id) => {
          const [payRes, chRes] = await Promise.all([
            fetch(`/api/subleases/${id}/payments`, { credentials: "include" }),
            fetch(`/api/subleases/${id}/apartment-changes`, { credentials: "include" }),
          ]);
          const payments = payRes.ok ? await payRes.json() : [];
          const changes = chRes.ok ? await chRes.json() : [];
          return { subleaseId: id, payments, changes };
        })
      );
      return results;
    },
    enabled: subleaseIds.length > 0,
  });

  const allPayments = useMemo(() => {
    if (!paymentQueries.data) return [];
    const items: PaymentItem[] = [];
    for (const { subleaseId, payments, changes } of paymentQueries.data) {
      const sub = activeSubleases.find(s => s.id === subleaseId);
      if (!sub) continue;
      const baseIds = sub.apartmentIds || (sub.apartmentId ? [sub.apartmentId] : []);
      const tenantName = sub.tenantType === "firma"
        ? (sub.companyName || "—")
        : [sub.firstName, sub.lastName].filter(Boolean).join(" ") || "—";
      for (const p of payments) {
        let resolvedIds: number[];
        if (p.apartmentId) {
          resolvedIds = [p.apartmentId];
        } else {
          resolvedIds = baseIds.map(id => {
            let currentId = id;
            for (const ch of changes) {
              if (ch.oldApartmentId === currentId && p.dueDate >= ch.changeDate) {
                currentId = ch.newApartmentId;
              }
            }
            return currentId;
          });
        }
        const apartmentName = resolvedIds.map(id => apartments.find(a => a.id === id)?.name || "?").join(", ") || "—";
        items.push({ payment: p, sublease: sub, apartmentName, tenantName });
      }
    }
    return items;
  }, [paymentQueries.data, activeSubleases, apartments]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return allPayments;
    const q = searchQuery.toLowerCase();
    return allPayments.filter(item =>
      item.apartmentName.toLowerCase().includes(q) ||
      item.tenantName.toLowerCase().includes(q) ||
      item.payment.title.toLowerCase().includes(q)
    );
  }, [allPayments, searchQuery]);

  const { overdue, current, future } = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const overdueItems: PaymentItem[] = [];
    const currentItems: PaymentItem[] = [];
    const futureItems: PaymentItem[] = [];

    for (const item of filtered) {
      const dueDate = item.payment.dueDate;
      if (!dueDate) {
        currentItems.push(item);
        continue;
      }
      const parts = dueDate.split("-");
      const dueYear = parseInt(parts[0]);
      const dueMonth = parseInt(parts[1]) - 1;
      const isPast = dueYear < currentYear || (dueYear === currentYear && dueMonth < currentMonth);
      const isCurrent = dueYear === currentYear && dueMonth === currentMonth;

      if (isPast && item.payment.status !== "oplacona") {
        overdueItems.push(item);
      } else if (isCurrent) {
        currentItems.push(item);
      } else if (!isPast) {
        futureItems.push(item);
      }
    }

    return { overdue: overdueItems, current: currentItems, future: futureItems };
  }, [filtered]);

  const overdueUnpaidTotal = useMemo(() => {
    return overdue
      .filter(i => i.payment.status !== "oplacona")
      .reduce((sum, i) => sum + (parseFloat(i.payment.amount) || 0), 0);
  }, [overdue]);

  const currentTotal = useMemo(() => {
    return current.reduce((sum, i) => sum + (parseFloat(i.payment.amount) || 0), 0);
  }, [current]);

  const currentPaidTotal = useMemo(() => {
    return current
      .filter(i => i.payment.status === "oplacona")
      .reduce((sum, i) => sum + (parseFloat(i.payment.amount) || 0), 0);
  }, [current]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ paymentId, newStatus }: { paymentId: number; newStatus: string }) => {
      const res = await fetch(`/api/sublease-payments/${paymentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sublease-payments/all"] });
      queryClient.invalidateQueries({ queryKey: ["/api/revenue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/all-sublease-payments"] });
      for (const id of subleaseIds) {
        queryClient.invalidateQueries({ queryKey: ["/api/subleases", id, "payments"] });
      }
      toast({ title: "Status płatności został zaktualizowany" });
    },
  });

  const handleToggleStatus = (paymentId: number, currentStatus: string) => {
    const newStatus = currentStatus === "oplacona" ? "do_oplacenia" : "oplacona";
    toggleStatusMutation.mutate({ paymentId, newStatus });
  };

  const overdueUnpaidCount = overdue.filter(i => i.payment.status !== "oplacona").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader title="Podnajem - Rozliczenie" description="Rozliczenia finansowe podnajmów." icon={HandCoins} />
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-settlement"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className={overdueUnpaidCount > 0 ? "border-red-500/50 bg-red-500/5 dark:bg-red-900/10" : ""} data-testid="card-overdue-summary">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={`h-4 w-4 ${overdueUnpaidCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <span className="text-sm font-medium text-muted-foreground">Zaległe</span>
            </div>
            <div className={`text-2xl font-bold tabular-nums ${overdueUnpaidCount > 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-overdue-total">
              {formatNum(String(overdueUnpaidTotal))} zł
            </div>
            <div className="text-xs text-muted-foreground mt-0.5" data-testid="text-overdue-count">
              {overdueUnpaidCount > 0 ? `${overdueUnpaidCount} nieopłaconych` : "Brak zaległości"}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-current-summary">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Bieżący miesiąc</span>
            </div>
            <div className="text-2xl font-bold tabular-nums" data-testid="text-current-total">
              {formatNum(String(currentPaidTotal))} / {formatNum(String(currentTotal))} zł
            </div>
            <div className="text-xs text-muted-foreground mt-0.5" data-testid="text-current-count">
              {current.length} płatności
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-future-summary">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Przyszłe</span>
            </div>
            <div className="text-2xl font-bold tabular-nums" data-testid="text-future-total">
              {formatNum(String(future.reduce((s, i) => s + (parseFloat(i.payment.amount) || 0), 0)))} zł
            </div>
            <div className="text-xs text-muted-foreground mt-0.5" data-testid="text-future-count">
              {future.length} płatności
            </div>
          </CardContent>
        </Card>
      </div>

      {overdue.length > 0 && (
        <Card className="border-red-500/30" data-testid="section-overdue">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-red-600 dark:text-red-400">Zaległe płatności</span>
              <Badge variant="destructive" className="ml-2" data-testid="badge-overdue-count">{overdueUnpaidCount} nieopł.</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PaymentTable
              items={overdue}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onToggleStatus={handleToggleStatus}
              highlight="overdue"
              testIdPrefix="overdue"
            />
          </CardContent>
        </Card>
      )}

      {current.length > 0 && (
        <Card data-testid="section-current">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-primary" />
              Bieżący miesiąc
              <Badge variant="secondary" className="ml-2" data-testid="badge-current-count">{current.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PaymentTable
              items={current}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onToggleStatus={handleToggleStatus}
              testIdPrefix="current"
            />
          </CardContent>
        </Card>
      )}

      {future.length > 0 && (
        <Card data-testid="section-future">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              Przyszłe płatności
              <Badge variant="outline" className="ml-2" data-testid="badge-future-count">{future.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <PaymentTable
              items={future}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              onToggleStatus={handleToggleStatus}
              testIdPrefix="future"
            />
          </CardContent>
        </Card>
      )}

      {overdue.length === 0 && current.length === 0 && future.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Brak płatności do wyświetlenia
          </CardContent>
        </Card>
      )}
    </div>
  );
}
