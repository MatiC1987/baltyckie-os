import { useState, useRef, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { Link } from "wouter";
import type { Account, BankStatement, BankTransaction, GocardlessConnection } from "@shared/schema";

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

type BankFormat = "generic" | "mbank" | "pko" | "ing" | "santander";

const BANK_FORMATS: { value: BankFormat; label: string }[] = [
  { value: "generic", label: "Uniwersalny (CSV)" },
  { value: "mbank", label: "mBank" },
  { value: "pko", label: "PKO BP" },
  { value: "ing", label: "ING Bank" },
  { value: "santander", label: "Santander" },
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [expandedStatements, setExpandedStatements] = useState<Set<number>>(new Set());
  const [bankFormat, setBankFormat] = useState<BankFormat>("generic");
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
    onSuccess: () => {
      const imported = skipDuplicates
        ? parsedTransactions.filter((t) => !t.isDuplicate).length
        : parsedTransactions.length;
      toast({ title: "Import zakończony", description: `Zaimportowano ${imported} transakcji` });
      setParsedTransactions([]);
      setShowPreview(false);
      setSelectedAccountId("");
      queryClient.invalidateQueries({ queryKey: ["/api/bank-statements"] });
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
  const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({
    queryKey: ["/api/bank-transactions", statement.id],
    queryFn: async () => {
      const res = await fetch(`/api/bank-transactions?statementId=${statement.id}`);
      if (!res.ok) throw new Error("Błąd pobierania transakcji");
      return res.json();
    },
    enabled: expanded,
  });

  const accountName = accounts.find((a) => a.id === statement.accountId)?.name || "-";

  const formatAmount = (val: string | null | undefined) => {
    if (!val) return "-";
    const num = parseFloat(val);
    return num.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " PLN";
  };

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
              {statement.startDate && statement.endDate && (
                <span className="text-sm text-muted-foreground">
                  {statement.startDate} - {statement.endDate}
                </span>
              )}
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              data-testid={`button-delete-statement-${statement.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CollapsibleTrigger>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Opis</TableHead>
                      <TableHead>Kontrahent</TableHead>
                      <TableHead className="text-right">Kwota</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Kategoria</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                        <TableCell className="whitespace-nowrap">{tx.date}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{tx.description}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{tx.counterparty || "-"}</TableCell>
                        <TableCell
                          className={`text-right whitespace-nowrap font-medium ${parseFloat(tx.amount) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                        >
                          {formatAmount(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">{formatAmount(tx.balance)}</TableCell>
                        <TableCell>
                          {(tx.category || tx.aiCategory) && (
                            <Badge variant="secondary">{tx.category || tx.aiCategory}</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
