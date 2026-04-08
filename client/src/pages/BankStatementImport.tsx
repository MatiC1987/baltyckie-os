import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  FileSpreadsheet,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronRight,
  Check,
  AlertCircle,
  AlertTriangle,
  Copy,
  TrendingUp,
  TrendingDown,
  Plus,
  X,
  Settings2,
  Building2,
  RefreshCw,
  Loader2,
  Link2,
  Ban,
  CheckCircle2,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import type { Account, BankStatement, BankTransaction, BankMappingRule, GocardlessConnection } from "@shared/schema";

interface AssignmentTarget {
  targetType: "operational" | "apartment" | "sublease";
  label: string;
  catId?: string;
  itemIdx?: number;
  entryId?: string;
  category?: string;
  subleaseId?: number;
  subleasePaymentId?: number;
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
    categories: { category: string; realizedByMonth: Record<number, number> }[];
  }[];
  sublease: {
    subleaseId: number;
    tenantName: string;
    apartmentNames: string;
    unpaidPayments: { id: number; title: string; category: string; amount: string; dueDate: string }[];
  }[];
}

function AutoSyncBanner() {
  const { toast } = useToast();
  const { data: connections = [] } = useQuery<GocardlessConnection[]>({
    queryKey: ["/api/gocardless/connections"],
  });
  const activeConns = connections.filter(c => c.status === "ACTIVE" && c.localAccountId);

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gocardless/sync-all");
      return res.json();
    },
    onSuccess: (data: any) => {
      const totalImported = data.results.reduce((s: number, r: any) => s + r.imported, 0);
      toast({
        title: "Synchronizacja zakończona",
        description: `Zaimportowano ${totalImported} nowych transakcji z ${data.totalConnections} kont.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gocardless/connections"] });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd synchronizacji", description: err.message, variant: "destructive" });
    },
  });

  if (activeConns.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-primary/5" data-testid="card-auto-sync">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="rounded-lg bg-primary/10 p-2 shrink-0">
              <RefreshCw className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">Automatyczny import</p>
              <p className="text-xs text-muted-foreground">
                {activeConns.length} {activeConns.length === 1 ? "połączone konto" : activeConns.length < 5 ? "połączone konta" : "połączonych kont"}
                {" — "}
                {activeConns.map(c => c.institutionName).join(", ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending}
              data-testid="button-auto-sync"
            >
              {syncAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1.5" />
              )}
              Pobierz nowe transakcje
            </Button>
            <Link href="/bank-connections">
              <Button variant="ghost" size="sm" data-testid="link-bank-connections">
                Zarządzaj
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ParsedTransaction {
  date: string;
  description: string;
  amount: string;
  balance: string | null;
  counterparty: string | null;
  category?: string;
  aiCategory?: string;
  confidence?: number;
  isDuplicate?: boolean;
  duplicateId?: number;
}

interface CategorizationRule {
  id: string;
  pattern: string;
  category: string;
  field: "description" | "counterparty";
}

type BankFormat = "generic" | "mbank" | "pko" | "ing" | "santander" | "pekao";

const BANK_FORMATS: { value: BankFormat; label: string }[] = [
  { value: "pekao", label: "Pekao SA" },
  { value: "santander", label: "Santander" },
  { value: "mbank", label: "mBank" },
  { value: "pko", label: "PKO BP" },
  { value: "ing", label: "ING Bank" },
  { value: "generic", label: "Uniwersalny (CSV)" },
];

const RULES_STORAGE_KEY = "bank-import-categorization-rules";

function loadRules(): CategorizationRule[] {
  try {
    const stored = localStorage.getItem(RULES_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveRules(rules: CategorizationRule[]) {
  localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
}

export default function BankStatementImport() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [expandedStatements, setExpandedStatements] = useState<Set<number>>(new Set());
  const [bankFormat, setBankFormat] = useState<BankFormat>("pekao");
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [showRulesDialog, setShowRulesDialog] = useState(false);
  const [rules, setRules] = useState<CategorizationRule[]>(loadRules);
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState("");
  const [newRuleField, setNewRuleField] = useState<"description" | "counterparty">("description");

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: statements = [], isLoading: statementsLoading } = useQuery<BankStatement[]>({
    queryKey: ["/api/bank-statements"],
  });

  const applyCategorizationRules = (transactions: ParsedTransaction[]): ParsedTransaction[] => {
    if (rules.length === 0) return transactions;
    return transactions.map((t) => {
      if (t.category) return t;
      for (const rule of rules) {
        const fieldValue = rule.field === "description" ? t.description : (t.counterparty || "");
        if (fieldValue.toLowerCase().includes(rule.pattern.toLowerCase())) {
          return { ...t, category: rule.category };
        }
      }
      return t;
    });
  };

  const parseCsvMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("bankFormat", bankFormat);
      const res = await fetch("/api/bank-statements/parse-csv", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ transactions: ParsedTransaction[]; rowCount: number }>;
    },
    onSuccess: (data) => {
      const withRules = applyCategorizationRules(data.transactions);
      setParsedTransactions(withRules);
      setShowPreview(true);
      toast({
        title: "Plik przetworzony",
        description: `Znaleziono ${data.rowCount} transakcji (format: ${BANK_FORMATS.find(b => b.value === bankFormat)?.label})`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const checkDuplicatesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId) throw new Error("Wybierz konto");
      const res = await apiRequest("POST", "/api/bank-statements/check-duplicates", {
        accountId: parseInt(selectedAccountId),
        transactions: parsedTransactions.map((t) => ({
          date: t.date,
          amount: t.amount,
          description: t.description,
        })),
      });
      return res.json() as Promise<{ duplicates: { date: string; amount: string; description: string; existingId: number }[] }>;
    },
    onSuccess: (data) => {
      const dupSet = new Map<string, number>();
      for (const d of data.duplicates) {
        dupSet.set(`${d.date}|${d.amount}|${d.description}`, d.existingId);
      }
      const updated = parsedTransactions.map((t) => {
        const key = `${t.date}|${t.amount}|${t.description}`;
        const existingId = dupSet.get(key);
        return { ...t, isDuplicate: !!existingId, duplicateId: existingId };
      });
      setParsedTransactions(updated);
      const dupCount = data.duplicates.length;
      toast({
        title: dupCount > 0 ? "Znaleziono duplikaty" : "Brak duplikatów",
        description: dupCount > 0
          ? `${dupCount} transakcji już istnieje w systemie`
          : "Wszystkie transakcje są nowe",
        variant: dupCount > 0 ? "destructive" : "default",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (selectedAccountId && parsedTransactions.length > 0) {
      checkDuplicatesMutation.mutate();
    }
  }, [selectedAccountId]);

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId) throw new Error("Wybierz konto");
      const transactionsToImport = skipDuplicates
        ? parsedTransactions.filter((t) => !t.isDuplicate)
        : parsedTransactions;

      if (transactionsToImport.length === 0) throw new Error("Brak transakcji do importu (wszystkie są duplikatami)");

      const statementRes = await apiRequest("POST", "/api/bank-statements", {
        accountId: parseInt(selectedAccountId),
        fileName: `import_${bankFormat}_${new Date().toISOString().split("T")[0]}`,
        startDate: transactionsToImport[0]?.date,
        endDate: transactionsToImport[transactionsToImport.length - 1]?.date,
        transactionCount: transactionsToImport.length,
        status: "ZAIMPORTOWANY",
      });
      const statement = await statementRes.json();

      const bulkData = transactionsToImport.map((t) => ({
        statementId: statement.id,
        accountId: parseInt(selectedAccountId),
        date: t.date,
        description: t.description,
        amount: t.amount,
        balance: t.balance,
        counterparty: t.counterparty,
        category: t.category || t.aiCategory || null,
        aiCategory: t.aiCategory || null,
        matched: false,
      }));
      await apiRequest("POST", "/api/bank-transactions/bulk", bulkData);
      return statement;
    },
    onSuccess: (statement) => {
      const imported = skipDuplicates
        ? parsedTransactions.filter((t) => !t.isDuplicate).length
        : parsedTransactions.length;
      toast({ title: "Import zakończony", description: `Zaimportowano ${imported} transakcji` });
      setParsedTransactions([]);
      setShowPreview(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bank-statements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions/history"] });
      navigate(`/konta-firmowe?status=pending&importId=${statement.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Błąd importu", description: err.message, variant: "destructive" });
    },
  });

  const categorizeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/bank-transactions/ai-categorize", {
        transactions: parsedTransactions,
      });
      return res.json() as Promise<{ categories: { index: number; category: string; confidence: number }[] }>;
    },
    onSuccess: (data) => {
      const updated = [...parsedTransactions];
      for (const cat of data.categories) {
        const idx = cat.index - 1;
        if (idx >= 0 && idx < updated.length) {
          updated[idx] = { ...updated[idx], aiCategory: cat.category, confidence: cat.confidence };
        }
      }
      setParsedTransactions(updated);
      toast({ title: "Kategoryzacja AI", description: "Transakcje zostały skategoryzowane" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd AI", description: err.message, variant: "destructive" });
    },
  });

  const deleteStatementMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/bank-statements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank-statements"] });
      toast({ title: "Usunięto", description: "Wyciąg został usunięty" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd usuwania", description: err.message, variant: "destructive" });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseCsvMutation.mutate(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCategoryChange = (index: number, category: string) => {
    const updated = [...parsedTransactions];
    updated[index] = { ...updated[index], category };
    setParsedTransactions(updated);
  };

  const toggleStatement = (id: number) => {
    setExpandedStatements((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddRule = () => {
    if (!newRulePattern.trim() || !newRuleCategory) return;
    const newRule: CategorizationRule = {
      id: Date.now().toString(),
      pattern: newRulePattern.trim(),
      category: newRuleCategory,
      field: newRuleField,
    };
    const updated = [...rules, newRule];
    setRules(updated);
    saveRules(updated);
    setNewRulePattern("");
    setNewRuleCategory("");
    if (parsedTransactions.length > 0) {
      setParsedTransactions(applyCategorizationRules(parsedTransactions));
    }
    toast({ title: "Reguła dodana", description: `"${newRulePattern}" → ${newRuleCategory}` });
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    setRules(updated);
    saveRules(updated);
  };

  const categories = [
    "CZYNSZ",
    "MEDIA",
    "WYNAGRODZENIA",
    "PODATKI",
    "NAPRAWY",
    "PRZYCHOD_REZERWACJA",
    "PRZYCHOD_PODNAJEM",
    "UBEZPIECZENIE",
    "ADMINISTRACJA",
    "INNE",
  ];

  const formatAmount = (val: string | null | undefined) => {
    if (!val) return "-";
    const num = parseFloat(val);
    return num.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " PLN";
  };

  const balanceImpact = useMemo(() => {
    if (parsedTransactions.length === 0) return null;
    const transactionsToCount = skipDuplicates
      ? parsedTransactions.filter((t) => !t.isDuplicate)
      : parsedTransactions;

    const totalIncome = transactionsToCount
      .filter((t) => parseFloat(t.amount) >= 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const totalExpense = transactionsToCount
      .filter((t) => parseFloat(t.amount) < 0)
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const net = totalIncome + totalExpense;
    const count = transactionsToCount.length;
    const duplicateCount = parsedTransactions.filter((t) => t.isDuplicate).length;

    return { totalIncome, totalExpense, net, count, duplicateCount };
  }, [parsedTransactions, skipDuplicates]);

  if (accountsLoading || statementsLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Import wyciągów bankowych"
        description="Importuj transakcje z plików CSV i kategoryzuj automatycznie"
        icon={FileSpreadsheet}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={bankFormat} onValueChange={(v) => setBankFormat(v as BankFormat)}>
              <SelectTrigger className="w-[180px]" data-testid="select-bank-format">
                <Building2 className="mr-2 h-4 w-4 shrink-0" />
                <SelectValue placeholder="Format banku" />
              </SelectTrigger>
              <SelectContent>
                {BANK_FORMATS.map((b) => (
                  <SelectItem key={b.value} value={b.value} data-testid={`select-format-${b.value}`}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
              data-testid="input-csv-file"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={parseCsvMutation.isPending}
              data-testid="button-upload-csv"
            >
              <Upload className="mr-2 h-4 w-4" />
              {parseCsvMutation.isPending ? "Przetwarzanie..." : "Wgraj CSV"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRulesDialog(true)}
              data-testid="button-open-rules"
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Reguły ({rules.length})
            </Button>
          </div>
        }
      />

      <AutoSyncBanner />

      {showPreview && parsedTransactions.length > 0 && balanceImpact && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="card-balance-income">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="text-sm text-muted-foreground">Wpływy</p>
                    <p className="text-lg font-semibold text-green-600 dark:text-green-400" data-testid="text-total-income">
                      +{formatAmount(balanceImpact.totalIncome.toFixed(2))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-balance-expense">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div>
                    <p className="text-sm text-muted-foreground">Wydatki</p>
                    <p className="text-lg font-semibold text-red-600 dark:text-red-400" data-testid="text-total-expense">
                      {formatAmount(balanceImpact.totalExpense.toFixed(2))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-balance-net">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  {balanceImpact.net >= 0 ? (
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Wpływ na saldo</p>
                    <p className={`text-lg font-semibold ${balanceImpact.net >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-net-impact">
                      {balanceImpact.net >= 0 ? "+" : ""}{formatAmount(balanceImpact.net.toFixed(2))}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card data-testid="card-balance-count">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Do importu</p>
                    <p className="text-lg font-semibold" data-testid="text-import-count">
                      {balanceImpact.count} transakcji
                    </p>
                    {balanceImpact.duplicateCount > 0 && (
                      <p className="text-xs text-orange-600 dark:text-orange-400" data-testid="text-duplicate-count">
                        {balanceImpact.duplicateCount} duplikatów
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Podgląd transakcji ({parsedTransactions.length})</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="w-[200px]" data-testid="select-account">
                    <SelectValue placeholder="Wybierz konto" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={String(acc.id)} data-testid={`select-account-${acc.id}`}>
                        {acc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedAccountId && (
                  <Button
                    variant="outline"
                    onClick={() => checkDuplicatesMutation.mutate()}
                    disabled={checkDuplicatesMutation.isPending}
                    data-testid="button-check-duplicates"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {checkDuplicatesMutation.isPending ? "Sprawdzanie..." : "Sprawdź duplikaty"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => categorizeMutation.mutate()}
                  disabled={categorizeMutation.isPending}
                  data-testid="button-ai-categorize"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  {categorizeMutation.isPending ? "Kategoryzowanie..." : "AI Kategoryzacja"}
                </Button>
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={!selectedAccountId || importMutation.isPending}
                  data-testid="button-confirm-import"
                >
                  <Check className="mr-2 h-4 w-4" />
                  {importMutation.isPending ? "Importowanie..." : "Potwierdź import"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {parsedTransactions.some((t) => t.isDuplicate) && (
                <div className="flex items-center gap-3 mb-4 p-3 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800" data-testid="alert-duplicates">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 shrink-0" />
                  <span className="text-sm text-orange-800 dark:text-orange-300">
                    Znaleziono {parsedTransactions.filter((t) => t.isDuplicate).length} duplikatów (zaznaczone na pomarańczowo)
                  </span>
                  <div className="flex items-center gap-2 ml-auto">
                    <Checkbox
                      id="skip-duplicates"
                      checked={skipDuplicates}
                      onCheckedChange={(c) => setSkipDuplicates(!!c)}
                      data-testid="checkbox-skip-duplicates"
                    />
                    <label htmlFor="skip-duplicates" className="text-sm text-orange-800 dark:text-orange-300 cursor-pointer whitespace-nowrap">
                      Pomiń duplikaty
                    </label>
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[30px]"></TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Opis</TableHead>
                      <TableHead>Kontrahent</TableHead>
                      <TableHead className="text-right">Kwota</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Kategoria</TableHead>
                      <TableHead>AI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedTransactions.map((t, idx) => (
                      <TableRow
                        key={idx}
                        className={t.isDuplicate ? "bg-orange-50/50 dark:bg-orange-950/20" : ""}
                        data-testid={`row-preview-${idx}`}
                      >
                        <TableCell>
                          {t.isDuplicate && (
                            <AlertTriangle className="h-4 w-4 text-orange-500" data-testid={`icon-duplicate-${idx}`} />
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap" data-testid={`text-date-${idx}`}>{t.date}</TableCell>
                        <TableCell className="max-w-[300px] truncate" data-testid={`text-description-${idx}`}>{t.description}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{t.counterparty || "-"}</TableCell>
                        <TableCell
                          className={`text-right whitespace-nowrap font-medium ${parseFloat(t.amount) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                          data-testid={`text-amount-${idx}`}
                        >
                          {formatAmount(t.amount)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatAmount(t.balance)}</TableCell>
                        <TableCell>
                          <Select
                            value={t.category || t.aiCategory || ""}
                            onValueChange={(val) => handleCategoryChange(idx, val)}
                          >
                            <SelectTrigger className="w-[160px]" data-testid={`select-category-${idx}`}>
                              <SelectValue placeholder="Kategoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {t.aiCategory && (
                            <Badge variant="secondary" data-testid={`badge-ai-${idx}`}>
                              {t.aiCategory}
                              {t.confidence !== undefined && ` (${Math.round(t.confidence * 100)}%)`}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Zaimportowane wyciągi</CardTitle>
        </CardHeader>
        <CardContent>
          {statements.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-statements">
              <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
              Brak zaimportowanych wyciągów
            </div>
          ) : (
            <div className="space-y-2">
              {statements.map((stmt) => (
                <StatementRow
                  key={stmt.id}
                  statement={stmt}
                  expanded={expandedStatements.has(stmt.id)}
                  onToggle={() => toggleStatement(stmt.id)}
                  onDelete={() => deleteStatementMutation.mutate(stmt.id)}
                  accounts={accounts}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRulesDialog} onOpenChange={setShowRulesDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reguły kategoryzacji</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Dodaj reguły automatycznej kategoryzacji. Jeśli opis lub kontrahent zawiera podany tekst, transakcja zostanie przypisana do wybranej kategorii.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={newRuleField} onValueChange={(v) => setNewRuleField(v as "description" | "counterparty")}>
                  <SelectTrigger className="w-[140px]" data-testid="select-rule-field">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="description">Opis</SelectItem>
                    <SelectItem value="counterparty">Kontrahent</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground whitespace-nowrap">zawiera</span>
                <Input
                  value={newRulePattern}
                  onChange={(e) => setNewRulePattern(e.target.value)}
                  placeholder="np. Booking"
                  className="flex-1 min-w-[120px]"
                  data-testid="input-rule-pattern"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">→</span>
                <Select value={newRuleCategory} onValueChange={setNewRuleCategory}>
                  <SelectTrigger className="w-[200px]" data-testid="select-rule-category">
                    <SelectValue placeholder="Kategoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddRule}
                  disabled={!newRulePattern.trim() || !newRuleCategory}
                  data-testid="button-add-rule"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Dodaj
                </Button>
              </div>
            </div>

            {rules.length > 0 && (
              <div className="space-y-2 mt-4">
                <p className="text-sm font-medium">Aktywne reguły:</p>
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md border"
                    data-testid={`rule-${rule.id}`}
                  >
                    <span className="text-sm">
                      <Badge variant="secondary" className="mr-1">
                        {rule.field === "description" ? "Opis" : "Kontrahent"}
                      </Badge>
                      zawiera &quot;{rule.pattern}&quot; → <Badge variant="secondary">{rule.category}</Badge>
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteRule(rule.id)}
                      data-testid={`button-delete-rule-${rule.id}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRulesDialog(false)} data-testid="button-close-rules">
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function buildTargetOptions(targets: AssignmentTargets | undefined): AssignmentTarget[] {
  if (!targets) return [];
  const options: AssignmentTarget[] = [];
  for (const cat of targets.operational) {
    for (const item of cat.items) {
      options.push({
        targetType: "operational",
        label: `[Opłaty] ${cat.title} → ${item.name}${item.subLabel ? ` (${item.subLabel})` : ""}`,
        catId: item.catId,
        itemIdx: item.itemIdx,
      });
    }
  }
  for (const apt of targets.apartment) {
    for (const c of apt.categories) {
      options.push({
        targetType: "apartment",
        label: `[Mieszkanie] ${apt.name} → ${c.category}`,
        entryId: apt.entryId,
        category: c.category,
      });
    }
  }
  for (const sub of targets.sublease) {
    for (const p of sub.unpaidPayments) {
      options.push({
        targetType: "sublease",
        label: `[Podnajem] ${sub.tenantName} (${sub.apartmentNames}) — ${p.title} ${parseFloat(p.amount).toFixed(2)} zł`,
        subleaseId: sub.subleaseId,
        subleasePaymentId: p.id,
        category: p.category,
      });
    }
  }
  return options;
}

function findMatchingRule(tx: BankTransaction, rules: BankMappingRule[], targets: AssignmentTargets | undefined): AssignmentTarget | null {
  for (const rule of rules) {
    const field = rule.matchField === "description" ? tx.description : (tx.counterparty || "");
    if (field && field.toLowerCase().includes(rule.pattern.toLowerCase())) {
      if (rule.targetType === "sublease" && rule.targetSubleaseId && targets) {
        const sub = targets.sublease.find(s => s.subleaseId === rule.targetSubleaseId);
        if (sub && sub.unpaidPayments.length > 0) {
          const oldest = sub.unpaidPayments[0];
          return {
            targetType: "sublease",
            label: "",
            subleaseId: sub.subleaseId,
            subleasePaymentId: oldest.id,
            category: oldest.category,
          };
        }
        continue;
      }
      return {
        targetType: rule.targetType as "operational" | "apartment" | "sublease",
        label: "",
        catId: rule.targetCatId || undefined,
        itemIdx: rule.targetItemIdx ?? undefined,
        entryId: rule.targetEntryId || undefined,
        category: rule.targetCategory || undefined,
        subleaseId: rule.targetSubleaseId ?? undefined,
      };
    }
  }
  return null;
}

function targetToKey(t: AssignmentTarget): string {
  if (t.targetType === "operational") return `op__${t.catId}__${t.itemIdx}`;
  if (t.targetType === "apartment") return `apt__${t.entryId}__${t.category}`;
  if (t.targetType === "sublease") return `sub__${t.subleasePaymentId}`;
  return "";
}

function StatementRow({
  statement,
  expanded,
  onToggle,
  onDelete,
  accounts,
}: {
  statement: BankStatement;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  accounts: Account[];
}) {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const [assignments, setAssignments] = useState<Record<number, AssignmentTarget>>({});
  const [duplicateWarnings, setDuplicateWarnings] = useState<any[]>([]);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [mismatchWarnings, setMismatchWarnings] = useState<any[]>([]);
  const [showMismatchDialog, setShowMismatchDialog] = useState(false);

  const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({
    queryKey: ["/api/bank-transactions", statement.id],
    queryFn: async () => {
      const res = await fetch(`/api/bank-transactions?statementId=${statement.id}`);
      if (!res.ok) throw new Error("Błąd pobierania transakcji");
      return res.json();
    },
    enabled: expanded,
  });

  const { data: targets } = useQuery<AssignmentTargets>({
    queryKey: ["/api/assignment-targets", new Date().getFullYear()],
    queryFn: async () => {
      const res = await fetch(`/api/assignment-targets?year=${new Date().getFullYear()}`);
      if (!res.ok) throw new Error("Błąd");
      return res.json();
    },
    enabled: expanded,
  });

  const { data: mappingRules = [] } = useQuery<BankMappingRule[]>({
    queryKey: ["/api/bank-mapping-rules"],
    enabled: expanded,
  });

  const targetOptions = useMemo(() => buildTargetOptions(targets), [targets]);

  const unassignedTxs = useMemo(() =>
    transactions.filter(tx => !tx.costImported && !tx.costSkipped),
    [transactions]
  );

  useEffect(() => {
    if (unassignedTxs.length > 0 && mappingRules.length > 0 && targetOptions.length > 0) {
      const autoAssignments: Record<number, AssignmentTarget> = {};
      for (const tx of unassignedTxs) {
        if (assignments[tx.id]) continue;
        const match = findMatchingRule(tx, mappingRules, targets);
        if (match) {
          const opt = targetOptions.find(o => targetToKey(o) === targetToKey(match));
          if (opt) autoAssignments[tx.id] = opt;
        }
      }
      if (Object.keys(autoAssignments).length > 0) {
        setAssignments(prev => ({ ...prev, ...autoAssignments }));
      }
    }
  }, [unassignedTxs, mappingRules, targetOptions]);

  const importMutation = useMutation({
    mutationFn: async (data: { assignments: any[] }) => {
      const res = await apiRequest("POST", "/api/bank-transactions/import-to-targets", data);
      return res.json();
    },
    onSuccess: (data) => {
      const warnings = data.results.filter((r: any) => r.duplicateWarning);
      const mismatches = data.results.filter((r: any) => r.amountMismatch);
      const successes = data.results.filter((r: any) => r.success);
      if (warnings.length > 0) {
        setDuplicateWarnings(warnings);
        setShowDuplicateDialog(true);
      }
      if (mismatches.length > 0) {
        setMismatchWarnings(mismatches);
        setShowMismatchDialog(true);
      }
      if (successes.length > 0) {
        toast({ title: "Zaimportowano", description: `${successes.length} transakcji przypisano do kosztów` });
        setSelectedTxIds(new Set());
        setAssignments(prev => {
          const next = { ...prev };
          for (const s of successes) delete next[s.transactionId];
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions", statement.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/assignment-targets"] });
        queryClient.invalidateQueries({ queryKey: ["/api/bank-mapping-rules"] });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const confirmDuplicateMutation = useMutation({
    mutationFn: async (data: { assignments: any[] }) => {
      const res = await apiRequest("POST", "/api/bank-transactions/confirm-duplicate-import", data);
      return res.json();
    },
    onSuccess: (data) => {
      const count = data.results.filter((r: any) => r.success).length;
      toast({ title: "Zaimportowano", description: `${count} transakcji przypisano mimo duplikatów` });
      setDuplicateWarnings([]);
      setShowDuplicateDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions", statement.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-targets"] });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const skipMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/bank-transactions/skip", { transactionIds: ids });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Pominięto", description: `${data.count} transakcji oznaczono jako pominięte` });
      setSelectedTxIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions", statement.id] });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const handleAssign = (txId: number, key: string) => {
    if (key === "__clear__") {
      setAssignments(prev => { const n = { ...prev }; delete n[txId]; return n; });
      return;
    }
    const opt = targetOptions.find(o => targetToKey(o) === key);
    if (opt) setAssignments(prev => ({ ...prev, [txId]: opt }));
  };

  const handleImportSelected = () => {
    const toImport = Array.from(selectedTxIds)
      .filter(id => assignments[id])
      .map(id => {
        const a = assignments[id];
        return {
          transactionId: id,
          targetType: a.targetType,
          catId: a.catId,
          itemIdx: a.itemIdx,
          entryId: a.entryId,
          category: a.category,
          subleasePaymentId: a.subleasePaymentId,
          subleaseId: a.subleaseId,
        };
      });
    if (toImport.length === 0) {
      toast({ title: "Brak przypisań", description: "Zaznacz transakcje i przypisz je do pozycji kosztów", variant: "destructive" });
      return;
    }
    importMutation.mutate({ assignments: toImport });
  };

  const handleSkipSelected = () => {
    const ids = Array.from(selectedTxIds);
    if (ids.length === 0) return;
    skipMutation.mutate(ids);
  };

  const handleConfirmDuplicates = () => {
    const toConfirm = duplicateWarnings.map(w => {
      const a = assignments[w.transactionId];
      return {
        transactionId: w.transactionId,
        targetType: a?.targetType,
        catId: a?.catId,
        itemIdx: a?.itemIdx,
        entryId: a?.entryId,
        category: a?.category,
      };
    });
    confirmDuplicateMutation.mutate({ assignments: toConfirm });
  };

  const confirmMismatchMutation = useMutation({
    mutationFn: async (data: { assignments: any[] }) => {
      const res = await apiRequest("POST", "/api/bank-transactions/import-to-targets", {
        assignments: data.assignments.map(a => ({ ...a, forceAmount: true })),
      });
      return res.json();
    },
    onSuccess: (data) => {
      const count = data.results.filter((r: any) => r.success).length;
      toast({ title: "Zaimportowano", description: `${count} płatności oznaczono jako opłacone mimo różnicy kwot` });
      setMismatchWarnings([]);
      setShowMismatchDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions", statement.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-targets"] });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const handleConfirmMismatch = () => {
    const toConfirm = mismatchWarnings.map(w => {
      const a = assignments[w.transactionId];
      return {
        transactionId: w.transactionId,
        targetType: "sublease",
        subleasePaymentId: w.paymentId,
        subleaseId: a?.subleaseId,
      };
    });
    confirmMismatchMutation.mutate({ assignments: toConfirm });
  };

  const toggleTx = (id: number) => {
    setSelectedTxIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleAllUnassigned = () => {
    if (selectedTxIds.size === unassignedTxs.length) {
      setSelectedTxIds(new Set());
    } else {
      setSelectedTxIds(new Set(unassignedTxs.map(t => t.id)));
    }
  };

  const accountName = accounts.find((a) => a.id === statement.accountId)?.name || "-";

  const formatAmount = (val: string | null | undefined) => {
    if (!val) return "-";
    const num = parseFloat(val);
    return num.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " PLN";
  };

  const assignedCount = unassignedTxs.filter(tx => assignments[tx.id]).length;
  const importedCount = transactions.filter(tx => tx.costImported).length;
  const skippedCount = transactions.filter(tx => tx.costSkipped).length;

  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <div className="border rounded-md">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between gap-2 p-3 cursor-pointer hover-elevate" data-testid={`row-statement-${statement.id}`}>
            <div className="flex items-center gap-3 flex-wrap">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-medium" data-testid={`text-filename-${statement.id}`}>{statement.fileName}</span>
              <Badge variant="secondary">{accountName}</Badge>
              <span className="text-sm text-muted-foreground">
                {statement.transactionCount} transakcji
              </span>
              {statement.importDate && (
                <span className="text-sm text-muted-foreground" data-testid={`text-import-date-${statement.id}`}>
                  Import: {new Date(statement.importDate).toLocaleDateString("pl-PL")}
                </span>
              )}
              {statement.startDate && statement.endDate && (
                <span className="text-sm text-muted-foreground">
                  Okres: {statement.startDate} - {statement.endDate}
                </span>
              )}
              {importedCount > 0 && (
                <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" data-testid={`badge-imported-count-${statement.id}`}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />{importedCount} przypisanych
                </Badge>
              )}
              {skippedCount > 0 && (
                <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-skipped-count-${statement.id}`}>
                  <Ban className="h-3 w-3 mr-1" />{skippedCount} pominiętych
                </Badge>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteConfirm(true);
              }}
              data-testid={`button-delete-statement-${statement.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CollapsibleTrigger>

        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Usuń wyciąg</AlertDialogTitle>
              <AlertDialogDescription>
                Czy na pewno chcesz usunąć wyciąg "{statement.fileName}" i wszystkie powiązane transakcje ({statement.transactionCount})? Tej operacji nie można cofnąć.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid={`button-cancel-delete-${statement.id}`}>Anuluj</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid={`button-confirm-delete-${statement.id}`}
              >
                Usuń
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ostrzeżenie o duplikatach</AlertDialogTitle>
              <AlertDialogDescription>
                {duplicateWarnings.length} transakcji ma identyczną kwotę jak istniejąca realizacja. Czy chcesz dodać te kwoty mimo to?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-[200px] overflow-y-auto space-y-2 my-2">
              {duplicateWarnings.map((w: any) => (
                <div key={w.transactionId} className="text-sm p-2 rounded bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
                  {w.message}
                </div>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-duplicate">Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmDuplicates} data-testid="button-confirm-duplicate">
                Dodaj mimo to
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showMismatchDialog} onOpenChange={setShowMismatchDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Różnica kwot płatności</AlertDialogTitle>
              <AlertDialogDescription>
                {mismatchWarnings.length} transakcji ma inną kwotę niż przypisana płatność podnajmu. Czy chcesz oznaczyć te płatności jako opłacone mimo to?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="max-h-[200px] overflow-y-auto space-y-2 my-2">
              {mismatchWarnings.map((w: any) => (
                <div key={w.transactionId} className="text-sm p-2 rounded bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                  {w.message}
                </div>
              ))}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-mismatch">Anuluj</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmMismatch} data-testid="button-confirm-mismatch">
                Przypisz mimo to
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <CollapsibleContent>
          <div className="border-t p-3">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Brak transakcji</p>
            ) : (
              <>
                {unassignedTxs.length > 0 && (
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <Button
                      size="sm"
                      onClick={handleImportSelected}
                      disabled={selectedTxIds.size === 0 || importMutation.isPending}
                      data-testid={`button-import-to-costs-${statement.id}`}
                    >
                      {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                      Przypisz do kosztów ({Array.from(selectedTxIds).filter(id => assignments[id]).length})
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSkipSelected}
                      disabled={selectedTxIds.size === 0 || skipMutation.isPending}
                      data-testid={`button-skip-selected-${statement.id}`}
                    >
                      {skipMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                      Pomiń ({selectedTxIds.size})
                    </Button>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {unassignedTxs.length} nieprzypisanych
                      {assignedCount > 0 && ` • ${assignedCount} z przypisaną pozycją`}
                    </span>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30px]">
                          {unassignedTxs.length > 0 && (
                            <Checkbox
                              checked={selectedTxIds.size === unassignedTxs.length && unassignedTxs.length > 0}
                              onCheckedChange={toggleAllUnassigned}
                              data-testid={`checkbox-select-all-${statement.id}`}
                            />
                          )}
                        </TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Opis</TableHead>
                        <TableHead>Kontrahent</TableHead>
                        <TableHead className="text-right">Kwota</TableHead>
                        <TableHead>Kategoria</TableHead>
                        <TableHead className="min-w-[280px]">Przypisanie do kosztów</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => {
                        const isImported = !!tx.costImported;
                        const isSkipped = !!tx.costSkipped;
                        const isDone = isImported || isSkipped;
                        const currentAssignment = assignments[tx.id];

                        return (
                          <TableRow
                            key={tx.id}
                            className={isImported ? "bg-green-50/50 dark:bg-green-950/10" : isSkipped ? "bg-muted/30" : ""}
                            data-testid={`row-transaction-${tx.id}`}
                          >
                            <TableCell>
                              {!isDone && (
                                <Checkbox
                                  checked={selectedTxIds.has(tx.id)}
                                  onCheckedChange={() => toggleTx(tx.id)}
                                  data-testid={`checkbox-tx-${tx.id}`}
                                />
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">{tx.date}</TableCell>
                            <TableCell className="max-w-[250px] truncate" title={tx.description}>{tx.description}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{tx.counterparty || "-"}</TableCell>
                            <TableCell
                              className={`text-right whitespace-nowrap font-medium ${parseFloat(tx.amount) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                            >
                              {formatAmount(tx.amount)}
                            </TableCell>
                            <TableCell>
                              {(tx.category || tx.aiCategory) && (
                                <Badge variant="secondary" className="text-xs">{tx.category || tx.aiCategory}</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {isDone ? (
                                isImported && tx.costTargetType ? (
                                  <span className="text-xs text-green-700 dark:text-green-400">
                                    {tx.costTargetType === "operational" && `Opłaty: ${tx.costTargetCatId}[${tx.costTargetItemIdx}]`}
                                    {tx.costTargetType === "apartment" && `Mieszkanie: ${tx.costTargetEntryId} → ${tx.costTargetCategory}`}
                                    {tx.costTargetType === "sublease" && `Podnajem: płatność #${tx.costTargetSubleasePaymentId}`}
                                  </span>
                                ) : null
                              ) : (
                                <Select
                                  value={currentAssignment ? targetToKey(currentAssignment) : ""}
                                  onValueChange={(v) => handleAssign(tx.id, v)}
                                >
                                  <SelectTrigger className="w-full text-xs h-8" data-testid={`select-assign-${tx.id}`}>
                                    <SelectValue placeholder="Wybierz pozycję..." />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[300px]">
                                    <SelectItem value="__clear__">— Wyczyść —</SelectItem>
                                    {targets?.operational && targets.operational.length > 0 && (() => {
                                      const txMonth = new Date(tx.date).getMonth();
                                      return (
                                        <>
                                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">Opłaty operacyjne</div>
                                          {targets.operational.map(cat =>
                                            cat.items.map(item => {
                                              const realized = item.realizedByMonth[txMonth] || 0;
                                              return (
                                                <SelectItem
                                                  key={`op__${item.catId}__${item.itemIdx}`}
                                                  value={`op__${item.catId}__${item.itemIdx}`}
                                                  data-testid={`option-op-${item.catId}-${item.itemIdx}`}
                                                >
                                                  {cat.title} → {item.name}{item.subLabel ? ` (${item.subLabel})` : ""}{realized > 0 ? ` [${realized.toFixed(2)} zł]` : ""}
                                                </SelectItem>
                                              );
                                            })
                                          )}
                                        </>
                                      );
                                    })()}
                                    {targets?.apartment && targets.apartment.length > 0 && (() => {
                                      const txMonth = new Date(tx.date).getMonth();
                                      return (
                                        <>
                                          <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">Koszty mieszkań</div>
                                          {targets.apartment.map(apt =>
                                            apt.categories.map(c => {
                                              const realized = c.realizedByMonth[txMonth] || 0;
                                              return (
                                                <SelectItem
                                                  key={`apt__${apt.entryId}__${c.category}`}
                                                  value={`apt__${apt.entryId}__${c.category}`}
                                                  data-testid={`option-apt-${apt.entryId}-${c.category}`}
                                                >
                                                  {apt.name} → {c.category}{realized > 0 ? ` [${realized.toFixed(2)} zł]` : ""}
                                                </SelectItem>
                                              );
                                            })
                                          )}
                                        </>
                                      );
                                    })()}
                                    {targets?.sublease && targets.sublease.length > 0 && (
                                      <>
                                        <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted/50">Podnajmy — nieopłacone</div>
                                        {targets.sublease.map(sub =>
                                          sub.unpaidPayments.map(p => (
                                            <SelectItem
                                              key={`sub__${p.id}`}
                                              value={`sub__${p.id}`}
                                              data-testid={`option-sub-${p.id}`}
                                            >
                                              {sub.tenantName} — {p.title} ({parseFloat(p.amount).toFixed(2)} zł, termin {p.dueDate})
                                            </SelectItem>
                                          ))
                                        )}
                                      </>
                                    )}
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>
                              {isImported && (
                                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-xs" data-testid={`badge-imported-${tx.id}`}>
                                  <CheckCircle2 className="h-3 w-3 mr-1" />Przypisana
                                </Badge>
                              )}
                              {isSkipped && (
                                <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-skipped-${tx.id}`}>
                                  <Ban className="h-3 w-3 mr-1" />Pominięta
                                </Badge>
                              )}
                              {!isDone && currentAssignment && (
                                <Badge variant="secondary" className="text-xs" data-testid={`badge-ready-${tx.id}`}>
                                  Gotowa
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
