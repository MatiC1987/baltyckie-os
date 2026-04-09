import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useInfiniteQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import {
  Landmark,
  Search,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Ban,
  Minus,
  Loader2,
  Upload,
  AlertCircle,
  Calendar,
  Undo2,
  Sparkles,
} from "lucide-react";
import { Link, useSearch } from "wouter";
import type { Account, BankTransaction } from "@shared/schema";
import { CostTargetWizard, type WizardSelection } from "@/components/CostTargetWizard";

type CostStatus = "all" | "categorized" | "skipped" | "pending";

interface TransactionWithMeta extends BankTransaction {
  statementFileName?: string;
}

interface HistoryResponse {
  transactions: TransactionWithMeta[];
  total: number;
  summary: {
    currentBalance: string;
    lastImportDate: string | null;
    lastImportFileName: string | null;
    totalIncome: string;
    totalExpense: string;
    pendingCount: number;
  };
}

interface AssignmentTargets {
  operational: {
    catId: string;
    title: string;
    items: { catId: string; itemIdx: number; name: string; subLabel: string | null; realizedByMonth: Record<number, number> }[];
  }[];
  apartment: {
    entryId: string;
    name: string;
    location?: string | null;
    categories: { category: string; realizedByMonth: Record<number, number> }[];
  }[];
  sublease: {
    subleaseId: number;
    tenantName: string;
    apartmentNames: string;
    unpaidPayments: { id: number; title: string; category: string; amount: string; dueDate: string }[];
  }[];
}

const QUICK_FILTERS = [
  { label: "Ten miesiąc", value: "this-month" },
  { label: "Poprzedni", value: "last-month" },
  { label: "Kwartał", value: "quarter" },
  { label: "Ten rok", value: "year" },
  { label: "Wszystko", value: "all" },
  { label: "Zakres...", value: "custom" },
] as const;

function getDateRange(filter: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (filter) {
    case "this-month":
      return {
        dateFrom: `${y}-${String(m + 1).padStart(2, "0")}-01`,
        dateTo: `${y}-${String(m + 1).padStart(2, "0")}-${new Date(y, m + 1, 0).getDate()}`,
      };
    case "last-month": {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      return {
        dateFrom: `${py}-${String(pm + 1).padStart(2, "0")}-01`,
        dateTo: `${py}-${String(pm + 1).padStart(2, "0")}-${new Date(py, pm + 1, 0).getDate()}`,
      };
    }
    case "quarter": {
      const qStart = Math.floor(m / 3) * 3;
      return {
        dateFrom: `${y}-${String(qStart + 1).padStart(2, "0")}-01`,
        dateTo: `${y}-${String(qStart + 3).padStart(2, "0")}-${new Date(y, qStart + 3, 0).getDate()}`,
      };
    }
    case "year":
      return { dateFrom: `${y}-01-01`, dateTo: `${y}-12-31` };
    default:
      return {};
  }
}

function formatPLN(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "-";
  return num.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function resolveTargetLabel(
  tx: BankTransaction,
  targets: AssignmentTargets | undefined
): string | null {
  if (!tx.costTargetType || !targets) return null;
  if (tx.costTargetType === "operational") {
    const cat = targets.operational.find(c =>
      c.items.some(i => i.catId === tx.costTargetCatId && i.itemIdx === tx.costTargetItemIdx)
    );
    const item = cat?.items.find(i => i.catId === tx.costTargetCatId && i.itemIdx === tx.costTargetItemIdx);
    return cat && item ? `${cat.title} → ${item.name}` : `Operacyjne: ${tx.costTargetCatId}`;
  }
  if (tx.costTargetType === "apartment") {
    const apt = targets.apartment.find(a => a.entryId === tx.costTargetEntryId);
    return `${apt?.name || tx.costTargetEntryId} → ${tx.costTargetCategory}`;
  }
  if (tx.costTargetType === "sublease") {
    for (const sub of targets.sublease) {
      const pay = sub.unpaidPayments.find(p => p.id === tx.costTargetSubleasePaymentId);
      if (pay) return `${sub.tenantName} → ${pay.title}`;
    }
    const matchingSub = targets.sublease.find(s => s.subleaseId === (tx as any).costTargetSubleaseId);
    if (matchingSub) return `${matchingSub.tenantName} → płatność #${tx.costTargetSubleasePaymentId}`;
    return `Podnajem: płatność #${tx.costTargetSubleasePaymentId}`;
  }
  return null;
}

function TransactionRow({
  tx,
  targets,
  onAssigned,
  onSkipped,
  onUnassigned,
  isNewlyImported,
}: {
  tx: TransactionWithMeta;
  targets: AssignmentTargets | undefined;
  onAssigned: () => void;
  onSkipped: () => void;
  onUnassigned: () => void;
  isNewlyImported?: boolean;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [wizardSelection, setWizardSelection] = useState<WizardSelection | null>(null);
  const amount = parseFloat(tx.amount || "0");
  const isPositive = amount >= 0;

  const isPending = !tx.costImported && !tx.costSkipped;
  const isCategorized = !!tx.costImported;
  const isSkipped = !!tx.costSkipped;

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!wizardSelection) throw new Error("Wybierz pozycję kosztową");
      await apiRequest("POST", "/api/bank-transactions/import-to-targets", {
        assignments: [{
          transactionId: tx.id,
          targetType: wizardSelection.targetType,
          catId: wizardSelection.catId,
          itemIdx: wizardSelection.itemIdx,
          entryId: wizardSelection.entryId,
          category: wizardSelection.category,
          subleasePaymentId: wizardSelection.subleasePaymentId,
          forceAmount: true,
        }],
      });
    },
    onSuccess: () => {
      toast({ title: "Przypisano", description: "Transakcja przypisana do kosztów" });
      setWizardSelection(null);
      onAssigned();
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/bank-transactions/skip", {
        transactionIds: [tx.id],
      });
    },
    onSuccess: () => {
      toast({ title: "Pominięto", description: "Transakcja oznaczona jako pominięta" });
      onSkipped();
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/bank-transactions/${tx.id}/unassign-cost`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Cofnięto", description: "Przypisanie zostało cofnięte" });
      onUnassigned();
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const targetLabel = isCategorized ? resolveTargetLabel(tx, targets) : null;

  const categoryBadge = tx.category ? (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{tx.category}</Badge>
  ) : tx.aiCategory ? (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-blue-300 text-blue-700 dark:border-blue-600 dark:text-blue-400">AI: {tx.aiCategory}</Badge>
  ) : null;

  const statusBadge = isCategorized ? (
    <div className="flex items-center gap-1">
      <Badge variant="outline" className="text-[10px] border-green-500 text-green-600 dark:text-green-400 gap-0.5 px-1.5 py-0" data-testid={`badge-status-${tx.id}`}>
        <CheckCircle2 className="h-3 w-3" /> Przypisane
      </Badge>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (window.confirm("Czy na pewno chcesz cofnąć przypisanie tej transakcji?")) {
            unassignMutation.mutate();
          }
        }}
        disabled={unassignMutation.isPending}
        className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
        title="Cofnij przypisanie"
        data-testid={`button-unassign-${tx.id}`}
      >
        {unassignMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}
      </button>
    </div>
  ) : isSkipped ? (
    <Badge variant="outline" className="text-[10px] border-muted-foreground/30 text-muted-foreground gap-0.5 px-1.5 py-0" data-testid={`badge-status-${tx.id}`}>
      <Ban className="h-3 w-3" /> Pominięte
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 dark:text-amber-400 gap-0.5 px-1.5 py-0" data-testid={`badge-status-${tx.id}`}>
      <Minus className="h-3 w-3" /> Oczekuje
    </Badge>
  );

  return (
    <>
      <tr
        className={`border-b border-border/30 transition-colors hover:bg-muted/40 cursor-pointer h-[34px] ${isSkipped ? "opacity-50" : ""} ${isNewlyImported ? "bg-blue-50/60 dark:bg-blue-950/20" : ""}`}
        onClick={() => setExpanded(!expanded)}
        data-testid={`row-tx-${tx.id}`}
      >
        <td className="px-2 py-1 text-xs tabular-nums text-muted-foreground whitespace-nowrap">
          {formatDate(tx.date)}
        </td>
        <td className="px-2 py-1 text-xs truncate max-w-[120px] sm:max-w-[180px]" title={tx.counterparty || ""}>
          {tx.counterparty || "-"}
        </td>
        <td className="hidden md:table-cell px-2 py-1 text-xs truncate max-w-[200px] lg:max-w-[300px]" title={tx.description}>
          {tx.description}
        </td>
        <td className={`px-2 py-1 text-xs tabular-nums font-semibold text-right whitespace-nowrap ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {isPositive ? "+" : ""}{formatPLN(tx.amount)}
        </td>
        <td className="hidden md:table-cell px-2 py-1 text-xs tabular-nums text-right text-muted-foreground whitespace-nowrap">
          {tx.balance ? formatPLN(tx.balance) : "-"}
        </td>
        <td className="hidden lg:table-cell px-2 py-1 text-center">
          {categoryBadge}
        </td>
        <td className="hidden lg:table-cell px-2 py-1 text-xs truncate max-w-[180px]" title={targetLabel || ""}>
          {targetLabel ? (
            <span className="text-green-700 dark:text-green-400">{targetLabel}</span>
          ) : isCategorized ? (
            <span className="text-muted-foreground">-</span>
          ) : null}
        </td>
        <td className="hidden md:table-cell px-2 py-1 text-center">
          {statusBadge}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20 border-b border-border/30">
          <td colSpan={8} className="px-3 py-2">
            <div className="space-y-2 text-xs">
              <div className="md:hidden">
                <span className="text-muted-foreground">Opis: </span>
                <span>{tx.description}</span>
              </div>
              <div className="md:hidden flex items-center gap-2">
                <span className="text-muted-foreground">Status: </span>
                {statusBadge}
              </div>
              <div className="md:hidden">
                <span className="text-muted-foreground">Saldo: </span>
                <span className="tabular-nums">{tx.balance ? formatPLN(tx.balance) : "-"}</span>
              </div>
              <div className="lg:hidden flex items-center gap-2">
                <span className="text-muted-foreground">Kategoria: </span>
                {categoryBadge || <span className="text-muted-foreground">-</span>}
              </div>
              {tx.statementFileName && (
                <div>
                  <span className="text-muted-foreground">Źródło: </span>
                  <span className="text-muted-foreground/80 italic">{tx.statementFileName}</span>
                </div>
              )}
              {targetLabel && (
                <div className="lg:hidden">
                  <span className="text-muted-foreground">Przypisano: </span>
                  <span className="text-green-700 dark:text-green-400">{targetLabel}</span>
                </div>
              )}
              {isPending && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <CostTargetWizard
                    targets={targets}
                    onSelect={(sel) => setWizardSelection(sel)}
                    value={wizardSelection?.label || ""}
                    onClear={wizardSelection ? () => setWizardSelection(null) : undefined}
                    placeholder="Pozycja kosztowa..."
                    triggerClassName="w-[280px] text-xs h-7"
                    txMonth={new Date(tx.date).getMonth()}
                    data-testid={`select-target-${tx.id}`}
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={!wizardSelection || assignMutation.isPending}
                    onClick={(e) => { e.stopPropagation(); assignMutation.mutate(); }}
                    data-testid={`button-assign-${tx.id}`}
                  >
                    {assignMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                    Przypisz
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    disabled={skipMutation.isPending}
                    onClick={(e) => { e.stopPropagation(); skipMutation.mutate(); }}
                    data-testid={`button-skip-${tx.id}`}
                  >
                    {skipMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                    Pomiń
                  </Button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AccountTab({
  account,
  initialStatus,
  highlightStatementId,
}: {
  account: Account;
  initialStatus?: CostStatus;
  highlightStatementId?: number;
}) {
  const { toast } = useToast();
  const [quickFilter, setQuickFilter] = useState("this-month");
  const [search, setSearch] = useState("");
  const [costStatus, setCostStatus] = useState<CostStatus>(initialStatus || "all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [customDateFrom, setCustomDateFrom] = useState("");
  const [customDateTo, setCustomDateTo] = useState("");
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const dateRange = useMemo(() => {
    if (quickFilter === "custom") {
      return {
        dateFrom: customDateFrom || undefined,
        dateTo: customDateTo || undefined,
      };
    }
    return getDateRange(quickFilter);
  }, [quickFilter, customDateFrom, customDateTo]);

  const now = new Date();
  const { data: targets } = useQuery<AssignmentTargets>({
    queryKey: ["/api/assignment-targets", now.getFullYear(), now.getMonth() + 1],
    queryFn: async () => {
      const res = await fetch(`/api/assignment-targets?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
      if (!res.ok) throw new Error("Failed to load targets");
      return res.json();
    },
  });

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("accountId", String(account.id));
    if (dateRange.dateFrom) p.set("dateFrom", dateRange.dateFrom);
    if (dateRange.dateTo) p.set("dateTo", dateRange.dateTo);
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (costStatus !== "all") p.set("costStatus", costStatus);
    p.set("limit", "30");
    return p;
  }, [account.id, dateRange, debouncedSearch, costStatus]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useInfiniteQuery<HistoryResponse>({
    queryKey: ["/api/bank-transactions/history", queryParams.toString()],
    queryFn: async ({ pageParam }) => {
      const p = new URLSearchParams(queryParams);
      p.set("offset", String(pageParam));
      const res = await fetch(`/api/bank-transactions/history?${p.toString()}`);
      if (!res.ok) throw new Error("Failed to load transactions");
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.transactions.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
  });

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allTransactions = useMemo(
    () => data?.pages.flatMap(p => p.transactions) || [],
    [data]
  );

  const summary = data?.pages[0]?.summary;
  const total = data?.pages[0]?.total || 0;

  const uncategorizedCount = useMemo(() =>
    allTransactions.filter(tx => !tx.category && !tx.aiCategory && !tx.costSkipped).length,
    [allTransactions]
  );

  const aiCategorizeMutation = useMutation({
    mutationFn: async () => {
      const stmtIds = Array.from(new Set(allTransactions.filter(tx => tx.statementId).map(tx => tx.statementId!)));
      let totalUpdated = 0;
      for (const sid of stmtIds) {
        const res = await apiRequest("POST", `/api/bank-statements/${sid}/ai-categorize`);
        const data = await res.json();
        totalUpdated += data.updated || 0;
      }
      return totalUpdated;
    },
    onSuccess: (updated) => {
      toast({ title: "Kategoryzacja AI", description: `Skategoryzowano ${updated} transakcji` });
      refetch();
    },
    onError: (err: Error) => {
      toast({ title: "Błąd AI", description: err.message, variant: "destructive" });
    },
  });

  const handleRefresh = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/assignment-targets"] });
  }, [refetch]);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-3 pb-2">
            <p className="text-[10px] text-muted-foreground uppercase font-medium">Saldo konta</p>
            <p className={`text-base sm:text-lg font-bold mt-0.5 tabular-nums ${Number(summary?.currentBalance || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-account-balance">
              {summary ? formatPLN(summary.currentBalance) : <Skeleton className="h-5 w-24" />}
            </p>
            {summary?.lastImportDate && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Ostatni import: {new Date(summary.lastImportDate).toLocaleDateString("pl-PL")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Wpływy</p>
            </div>
            <p className="text-base sm:text-lg font-bold mt-0.5 tabular-nums text-green-600 dark:text-green-400" data-testid="text-total-income">
              {summary ? `+${formatPLN(summary.totalIncome)}` : <Skeleton className="h-5 w-24" />}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Wydatki</p>
            </div>
            <p className="text-base sm:text-lg font-bold mt-0.5 tabular-nums text-red-600 dark:text-red-400" data-testid="text-total-expense">
              {summary ? formatPLN(summary.totalExpense) : <Skeleton className="h-5 w-24" />}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3 text-amber-500" />
              <p className="text-[10px] text-muted-foreground uppercase font-medium">Do skategoryzowania</p>
            </div>
            <p className="text-base sm:text-lg font-bold mt-0.5 tabular-nums" data-testid="text-pending-count">
              {summary ? summary.pendingCount : <Skeleton className="h-5 w-12" />}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {QUICK_FILTERS.map(f => (
              <Button
                key={f.value}
                size="sm"
                variant={quickFilter === f.value ? "default" : "outline"}
                className="h-7 text-xs px-2.5"
                onClick={() => setQuickFilter(f.value)}
                data-testid={`button-filter-${f.value}`}
              >
                {f.value === "custom" && <Calendar className="h-3 w-3 mr-1" />}
                {f.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Szukaj kontrahenta lub opis..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs pl-7"
                data-testid="input-search"
              />
            </div>
            <Select value={costStatus} onValueChange={(v) => setCostStatus(v as CostStatus)}>
              <SelectTrigger className="h-7 text-xs w-[150px]" data-testid="select-cost-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="pending">Do skategoryzowania</SelectItem>
                <SelectItem value="categorized">Skategoryzowane</SelectItem>
                <SelectItem value="skipped">Pominięte</SelectItem>
              </SelectContent>
            </Select>
            {uncategorizedCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => aiCategorizeMutation.mutate()}
                disabled={aiCategorizeMutation.isPending}
                data-testid="button-ai-categorize"
              >
                {aiCategorizeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Kategoryzuj AI ({uncategorizedCount})
              </Button>
            )}
          </div>
        </div>
        {quickFilter === "custom" && (
          <div className="flex items-center gap-2 pl-1">
            <Label className="text-xs text-muted-foreground">Od:</Label>
            <Input
              type="date"
              value={customDateFrom}
              onChange={(e) => setCustomDateFrom(e.target.value)}
              className="h-7 text-xs w-[140px]"
              data-testid="input-date-from"
            />
            <Label className="text-xs text-muted-foreground">Do:</Label>
            <Input
              type="date"
              value={customDateTo}
              onChange={(e) => setCustomDateTo(e.target.value)}
              className="h-7 text-xs w-[140px]"
              data-testid="input-date-to"
            />
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <div ref={scrollContainerRef} className="overflow-auto max-h-[calc(100vh-380px)]">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <tr className="border-b border-border">
                <th className="text-left px-2 py-2 font-semibold text-muted-foreground w-[90px]">Data</th>
                <th className="text-left px-2 py-2 font-semibold text-muted-foreground">Kontrahent</th>
                <th className="hidden md:table-cell text-left px-2 py-2 font-semibold text-muted-foreground">Tytuł przelewu</th>
                <th className="text-right px-2 py-2 font-semibold text-muted-foreground w-[110px]">Kwota</th>
                <th className="hidden md:table-cell text-right px-2 py-2 font-semibold text-muted-foreground w-[110px]">Saldo</th>
                <th className="hidden lg:table-cell text-center px-2 py-2 font-semibold text-muted-foreground w-[100px]">Kategoria</th>
                <th className="hidden lg:table-cell text-left px-2 py-2 font-semibold text-muted-foreground w-[180px]">Przypisano do</th>
                <th className="hidden md:table-cell text-center px-2 py-2 font-semibold text-muted-foreground w-[130px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td className="px-2 py-1.5"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-2 py-1.5"><Skeleton className="h-4 w-28" /></td>
                    <td className="hidden sm:table-cell px-2 py-1.5"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-2 py-1.5"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="hidden md:table-cell px-2 py-1.5"><Skeleton className="h-4 w-16 ml-auto" /></td>
                    <td className="hidden lg:table-cell px-2 py-1.5"><Skeleton className="h-4 w-16 mx-auto" /></td>
                    <td className="hidden lg:table-cell px-2 py-1.5"><Skeleton className="h-4 w-24" /></td>
                    <td className="hidden sm:table-cell px-2 py-1.5"><Skeleton className="h-4 w-16 mx-auto" /></td>
                  </tr>
                ))
              ) : allTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    Brak transakcji dla wybranych filtrów
                  </td>
                </tr>
              ) : (
                allTransactions.map(tx => (
                  <TransactionRow
                    key={tx.id}
                    tx={tx}
                    targets={targets}
                    onAssigned={handleRefresh}
                    onSkipped={handleRefresh}
                    onUnassigned={handleRefresh}
                    isNewlyImported={highlightStatementId ? tx.statementId === highlightStatementId : false}
                  />
                ))
              )}
            </tbody>
          </table>
          <div ref={loadMoreRef} className="h-8 flex items-center justify-center">
            {isFetchingNextPage && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>
        {total > 0 && (
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground bg-muted/30">
            Wyświetlono {allTransactions.length} z {total} transakcji
          </div>
        )}
      </Card>
    </div>
  );
}

export default function CompanyAccounts() {
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialStatus = (["all", "categorized", "skipped", "pending"].includes(params.get("status") || "") ? params.get("status") : null) as CostStatus | null;
  const importId = params.get("importId") ? parseInt(params.get("importId")!) : undefined;

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: statements = [] } = useQuery<{ id: number; accountId: number | null }[]>({
    queryKey: ["/api/bank-statements"],
    enabled: !!importId,
  });

  const bankAccounts = useMemo(
    () => accounts.filter(a => a.type === "BANK" && a.category === "KONTA_BANKOWE"),
    [accounts]
  );

  const [activeAccountId, setActiveAccountId] = useState<string>("");

  useEffect(() => {
    if (bankAccounts.length > 0 && !activeAccountId) {
      if (importId && statements.length > 0) {
        const stmt = statements.find(s => s.id === importId);
        if (stmt?.accountId) {
          const matchingAccount = bankAccounts.find(a => a.id === stmt.accountId);
          if (matchingAccount) {
            setActiveAccountId(String(matchingAccount.id));
            return;
          }
        }
      }
      setActiveAccountId(String(bankAccounts[0].id));
    }
  }, [bankAccounts, activeAccountId, importId, statements]);

  const activeAccount = bankAccounts.find(a => String(a.id) === activeAccountId);

  if (accountsLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Konta firmowe" description="Historia transakcji bankowych" icon={Landmark} />
        <div className="space-y-3">
          <Skeleton className="h-10 w-64" />
          <div className="grid gap-2 grid-cols-2 lg:grid-cols-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (bankAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="Konta firmowe" description="Historia transakcji bankowych" icon={Landmark} />
        <Card>
          <CardContent className="py-12 text-center">
            <Landmark className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Brak kont bankowych.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Zaimportuj transakcje w{" "}
              <Link href="/import-bankowy" className="text-primary underline">Imporcie bankowym</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Konta firmowe"
        description="Przeglądaj historię transakcji bankowych, przypisuj do kosztów"
        icon={Landmark}
        actions={
          <Link href="/import-bankowy">
            <Button variant="outline" size="sm" data-testid="button-go-import">
              <Upload className="h-4 w-4 mr-1.5" />
              Importuj wyciąg
            </Button>
          </Link>
        }
      />

      {bankAccounts.length > 1 && (
        <Tabs value={activeAccountId} onValueChange={setActiveAccountId}>
          <TabsList>
            {bankAccounts.map(acc => (
              <TabsTrigger key={acc.id} value={String(acc.id)} data-testid={`tab-account-${acc.id}`}>
                {acc.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {activeAccount && (
        <AccountTab
          key={activeAccount.id}
          account={activeAccount}
          initialStatus={initialStatus || undefined}
          highlightStatementId={importId}
        />
      )}
    </div>
  );
}
