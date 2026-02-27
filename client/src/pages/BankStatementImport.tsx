import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import type { Account, BankStatement, BankTransaction } from "@shared/schema";

interface ParsedTransaction {
  date: string;
  description: string;
  amount: string;
  balance: string | null;
  counterparty: string | null;
  category?: string;
  aiCategory?: string;
  confidence?: number;
}

export default function BankStatementImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);
  const [expandedStatements, setExpandedStatements] = useState<Set<number>>(new Set());

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: statements = [], isLoading: statementsLoading } = useQuery<BankStatement[]>({
    queryKey: ["/api/bank-statements"],
  });

  const parseCsvMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/bank-statements/parse-csv", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ transactions: ParsedTransaction[]; rowCount: number }>;
    },
    onSuccess: (data) => {
      setParsedTransactions(data.transactions);
      setShowPreview(true);
      toast({
        title: "Plik przetworzony",
        description: `Znaleziono ${data.rowCount} transakcji`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId) throw new Error("Wybierz konto");
      const statementRes = await apiRequest("POST", "/api/bank-statements", {
        accountId: parseInt(selectedAccountId),
        fileName: "import_csv",
        startDate: parsedTransactions[0]?.date,
        endDate: parsedTransactions[parsedTransactions.length - 1]?.date,
        transactionCount: parsedTransactions.length,
        status: "ZAIMPORTOWANY",
      });
      const statement = await statementRes.json();

      const bulkData = parsedTransactions.map((t) => ({
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
      toast({ title: "Import zakończony", description: "Transakcje zostały zaimportowane" });
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
          </div>
        }
      />

      {showPreview && parsedTransactions.length > 0 && (
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
                    <TableHead>AI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedTransactions.map((t, idx) => (
                    <TableRow key={idx} data-testid={`row-preview-${idx}`}>
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
