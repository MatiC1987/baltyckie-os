import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sublease, SubleasePayment, Apartment } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Check, X, ArrowUpDown, ArrowUp, ArrowDown, HandCoins } from "lucide-react";
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

export default function SubrentSettlement() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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

  const paymentQueries = useQuery<{ subleaseId: number; payments: SubleasePayment[] }[]>({
    queryKey: ["/api/sublease-payments/all", subleaseIds],
    queryFn: async () => {
      const results = await Promise.all(
        subleaseIds.map(async (id) => {
          const res = await fetch(`/api/subleases/${id}/payments`, { credentials: "include" });
          if (!res.ok) return { subleaseId: id, payments: [] };
          const payments = await res.json();
          return { subleaseId: id, payments };
        })
      );
      return results;
    },
    enabled: subleaseIds.length > 0,
  });

  const allPayments = useMemo(() => {
    if (!paymentQueries.data) return [];
    const items: { payment: SubleasePayment; sublease: Sublease; apartmentName: string; tenantName: string }[] = [];
    for (const { subleaseId, payments } of paymentQueries.data) {
      const sub = activeSubleases.find(s => s.id === subleaseId);
      if (!sub) continue;
      const ids = sub.apartmentIds || (sub.apartmentId ? [sub.apartmentId] : []);
      const apartmentName = ids.map(id => apartments.find(a => a.id === id)?.name || "?").join(", ") || "—";
      const tenantName = sub.tenantType === "firma"
        ? (sub.companyName || "—")
        : [sub.firstName, sub.lastName].filter(Boolean).join(" ") || "—";
      for (const p of payments) {
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

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "apartment":
          return dir * a.apartmentName.localeCompare(b.apartmentName, "pl");
        case "tenant":
          return dir * a.tenantName.localeCompare(b.tenantName, "pl");
        case "dueDate":
          return dir * (a.payment.dueDate || "").localeCompare(b.payment.dueDate || "");
        case "title":
          return dir * a.payment.title.localeCompare(b.payment.title, "pl");
        case "amount": {
          const aVal = parseFloat(a.payment.amount) || 0;
          const bVal = parseFloat(b.payment.amount) || 0;
          return dir * (aVal - bVal);
        }
        case "status":
          return dir * (a.payment.status || "").localeCompare(b.payment.status || "");
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown className="h-3 w-3 ml-1 text-muted-foreground/50" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
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

  return (
    <div className="p-6 space-y-4">
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

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("apartment")} data-testid="th-apartment">
                  <div className="flex items-center">Apartament<SortIcon column="apartment" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("tenant")} data-testid="th-tenant">
                  <div className="flex items-center">Najemca<SortIcon column="tenant" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("dueDate")} data-testid="th-due-date">
                  <div className="flex items-center">Data płatności<SortIcon column="dueDate" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort("title")} data-testid="th-title">
                  <div className="flex items-center">Tytuł płatności<SortIcon column="title" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort("amount")} data-testid="th-amount">
                  <div className="flex items-center justify-end">Kwota<SortIcon column="amount" /></div>
                </TableHead>
                <TableHead className="cursor-pointer select-none text-center" onClick={() => handleSort("status")} data-testid="th-status">
                  <div className="flex items-center justify-center">Status<SortIcon column="status" /></div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Brak płatności do wyświetlenia
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((item, idx) => {
                  const st = PAYMENT_STATUS_LABELS[item.payment.status] || PAYMENT_STATUS_LABELS.do_oplacenia;
                  return (
                    <TableRow key={item.payment.id} className={idx % 2 === 1 ? "bg-muted/30" : ""} data-testid={`row-payment-${item.payment.id}`}>
                      <TableCell className="font-medium" data-testid={`cell-apartment-${item.payment.id}`}>{item.apartmentName}</TableCell>
                      <TableCell data-testid={`cell-tenant-${item.payment.id}`}>{item.tenantName}</TableCell>
                      <TableCell data-testid={`cell-date-${item.payment.id}`}>{formatDate(item.payment.dueDate)}</TableCell>
                      <TableCell data-testid={`cell-title-${item.payment.id}`}>{item.payment.title}</TableCell>
                      <TableCell className="text-right tabular-nums" data-testid={`cell-amount-${item.payment.id}`}>{formatNum(item.payment.amount)} zł</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={st.variant}
                          className="cursor-pointer"
                          onClick={() => handleToggleStatus(item.payment.id, item.payment.status)}
                          data-testid={`badge-status-${item.payment.id}`}
                        >
                          {item.payment.status === "oplacona" ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
                          {st.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
