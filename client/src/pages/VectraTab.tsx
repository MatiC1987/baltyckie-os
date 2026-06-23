import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import MarkdownViewer from "@/components/MarkdownViewer";
import instrukcjaContent from "@docs/instrukcja-vectra.md?raw";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth-token";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Plus,
  RefreshCw,
  Download,
  Pencil,
  Trash2,
  Tv,
  CheckCircle,
  AlertCircle,
  Clock,
  CalendarClock,
  BookOpen,
  History,
  Zap,
  User,
  Info,
  Loader2,
  BarChart2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VectraAccount {
  id: number;
  label: string;
  username: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  createdAt: string;
}

interface VectraInvoice {
  id: number;
  vectraAccountId: number;
  invoiceNumber: string;
  invoiceDate: string | null;
  amount: string | null;
  period: string | null;
  objectPath: string | null;
  downloadedAt: string;
}

interface VectraScheduleConfig {
  enabled: boolean;
  hour: number;
}

interface VectraSyncStats {
  totalCount: number;
  firstSyncAt: string | null;
  lastSyncAt: string | null;
}

interface VectraSyncLog {
  id: number;
  syncedAt: string;
  mode: "manual" | "auto";
  newInvoices: number;
  skipped: number;
  errorCount: number;
  errorDetails: string | null;
  accounts: string | null;
}

interface VectraDebugResult {
  loginPageStatus: number;
  loginPageUrl: string;
  loginPageSnippet: string;
  hasCsrf: boolean;
  csrfName?: string;
  formAction?: string;
  loginResultStatus: number;
  loginResultUrl: string;
  loginResultSnippet: string;
  cookiesAfterLogin: string[];
  invoicesPageStatus: number;
  invoicesPageUrl: string;
  invoicesPageSnippet: string;
  detectedStructure: string;
  spaIndicators: string[];
  tableRowCount: number;
  selectorResults: Record<string, number>;
}

const accountFormSchema = z.object({
  label: z.string().min(1, "Etykieta jest wymagana"),
  username: z.string().min(1, "Login jest wymagany"),
  password: z.string().optional(),
});
type AccountFormValues = z.infer<typeof accountFormSchema>;

function SyncStatusBadge({ status, syncAt }: { status: string | null; syncAt: string | null }) {
  if (!status) return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Nie synchronizowano</Badge>;

  const isOk = status.startsWith("OK");
  const isError = status.startsWith("Błąd");

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={isOk ? "default" : isError ? "destructive" : "secondary"} className="gap-1 text-xs">
        {isOk ? <CheckCircle className="h-3 w-3" /> : isError ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
        {status.length > 50 ? status.slice(0, 50) + "…" : status}
      </Badge>
      {syncAt && (
        <span className="text-xs text-muted-foreground">
          {format(new Date(syncAt), "dd.MM.yyyy HH:mm", { locale: pl })}
        </span>
      )}
    </div>
  );
}

function ScheduleCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: schedule, isLoading } = useQuery<VectraScheduleConfig>({
    queryKey: ["/api/vectra/schedule"],
  });

  const updateMutation = useMutation({
    mutationFn: (config: VectraScheduleConfig) =>
      apiRequest("PUT", "/api/vectra/schedule", config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/schedule"] });
      toast({ title: "Harmonogram zapisany" });
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się zapisać harmonogramu", variant: "destructive" }),
  });

  const currentEnabled = schedule?.enabled ?? false;
  const currentHour = schedule?.hour ?? 3;

  function toggleEnabled() {
    updateMutation.mutate({ enabled: !currentEnabled, hour: currentHour });
  }

  function changeHour(val: string) {
    updateMutation.mutate({ enabled: currentEnabled, hour: Number(val) });
  }

  const hourOptions = Array.from({ length: 24 }, (_, i) => i);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarClock className="h-5 w-5 text-primary" />
          Automatyczna synchronizacja
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Ładowanie…</div>
        ) : (
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <Switch
                id="schedule-enabled"
                checked={currentEnabled}
                onCheckedChange={toggleEnabled}
                disabled={updateMutation.isPending}
                data-testid="switch-schedule-enabled"
              />
              <Label htmlFor="schedule-enabled" className="cursor-pointer select-none">
                {currentEnabled ? "Włączona" : "Wyłączona"}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="schedule-hour" className="text-sm whitespace-nowrap">
                Godzina synchronizacji:
              </Label>
              <Select
                value={String(currentHour)}
                onValueChange={changeHour}
                disabled={updateMutation.isPending}
              >
                <SelectTrigger id="schedule-hour" className="w-24" data-testid="select-schedule-hour">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hourOptions.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {String(h).padStart(2, "0")}:00
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {currentEnabled && (
              <p className="text-sm text-muted-foreground">
                Synchronizacja będzie uruchamiana codziennie o godzinie{" "}
                <strong>{String(currentHour).padStart(2, "0")}:00</strong>. Po zakończeniu pojawi się powiadomienie w centrum powiadomień.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SyncHistoryCard() {
  const { data: logs = [], isLoading } = useQuery<VectraSyncLog[]>({
    queryKey: ["/api/vectra/sync-logs"],
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-5 w-5 text-primary" />
          Historia synchronizacji
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Ładowanie…</div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">
            Brak historii synchronizacji. Historia pojawi się po pierwszej synchronizacji.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data i czas</TableHead>
                  <TableHead>Tryb</TableHead>
                  <TableHead>Konta</TableHead>
                  <TableHead className="text-center">Nowe</TableHead>
                  <TableHead className="text-center">Pominięte</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id} data-testid={`row-sync-log-${log.id}`}>
                    <TableCell className="text-sm whitespace-nowrap">
                      {format(new Date(log.syncedAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                    </TableCell>
                    <TableCell>
                      {log.mode === "auto" ? (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Zap className="h-3 w-3" />
                          Auto
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-xs">
                          <User className="h-3 w-3" />
                          Ręczna
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[180px] truncate" title={log.accounts || ""}>
                      {log.accounts || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`text-sm font-medium ${log.newInvoices > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
                        {log.newInvoices}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm text-muted-foreground">{log.skipped}</span>
                    </TableCell>
                    <TableCell>
                      {log.errorCount > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <Badge variant="destructive" className="gap-1 text-xs w-fit">
                            <AlertCircle className="h-3 w-3" />
                            {log.errorCount} {log.errorCount === 1 ? "błąd" : "błędów"}
                          </Badge>
                          {log.errorDetails && (
                            <span className="text-xs text-muted-foreground max-w-[240px] truncate" title={log.errorDetails}>
                              {log.errorDetails}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="default" className="gap-1 text-xs bg-green-600 hover:bg-green-700">
                          <CheckCircle className="h-3 w-3" />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function VectraTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [instrukcjaOpen, setInstrukcjaOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<VectraAccount | null>(null);
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());
  const [syncingAll, setSyncingAll] = useState(false);
  const [diagnosticAccount, setDiagnosticAccount] = useState<VectraAccount | null>(null);
  const [diagnosticData, setDiagnosticData] = useState<VectraDebugResult | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<VectraAccount[]>({
    queryKey: ["/api/vectra/accounts"],
  });

  const { data: syncStats } = useQuery<VectraSyncStats>({
    queryKey: ["/api/vectra/sync-stats"],
    refetchInterval: 60000,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<VectraInvoice[]>({
    queryKey: ["/api/vectra/invoices", filterAccount],
    queryFn: () => {
      const url = filterAccount !== "all"
        ? `/api/vectra/invoices?accountId=${filterAccount}`
        : "/api/vectra/invoices";
      return fetch(url, { credentials: "include", headers: { ...getAuthHeaders() } }).then((r) => r.json());
    },
  });

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { label: "", username: "", password: "" },
  });

  const createMutation = useMutation({
    mutationFn: (data: AccountFormValues) =>
      apiRequest("POST", "/api/vectra/accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/accounts"] });
      toast({ title: "Konto dodane" });
      setDialogOpen(false);
      form.reset();
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się dodać konta", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: AccountFormValues) =>
      apiRequest("PUT", `/api/vectra/accounts/${editingAccount?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/accounts"] });
      toast({ title: "Konto zaktualizowane" });
      setDialogOpen(false);
      setEditingAccount(null);
      form.reset();
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się zaktualizować konta", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/vectra/accounts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/invoices"] });
      toast({ title: "Konto usunięte" });
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się usunąć konta", variant: "destructive" }),
  });

  async function syncAccount(id: number) {
    setSyncingIds((prev) => new Set(prev).add(id));
    try {
      const res = await apiRequest("POST", `/api/vectra/sync/${id}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        toast({ title: "Błąd synchronizacji", description: data.error || data.message || "Nieznany błąd", variant: "destructive" });
      } else {
        toast({ title: `Synchronizacja zakończona`, description: `${data.newInvoices} nowych faktur, ${data.skipped} pominiętych` });
      }
    } catch {
      toast({ title: "Błąd połączenia", variant: "destructive" });
    } finally {
      setSyncingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/sync-stats"] });
    }
  }

  async function syncAll() {
    setSyncingAll(true);
    try {
      const res = await apiRequest("POST", "/api/vectra/sync-all");
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Błąd synchronizacji", description: data.message || "Nieznany błąd", variant: "destructive" });
      } else {
        const total = data.results?.reduce((s: number, r: any) => s + (r.newInvoices || 0), 0) || 0;
        const errors = data.results?.filter((r: any) => r.error).length || 0;
        toast({
          title: "Synchronizacja wszystkich kont",
          description: `${total} nowych faktur${errors > 0 ? `, ${errors} błędów` : ""}`,
        });
      }
    } catch {
      toast({ title: "Błąd połączenia", variant: "destructive" });
    } finally {
      setSyncingAll(false);
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vectra/sync-stats"] });
    }
  }

  function openAdd() {
    setEditingAccount(null);
    form.reset({ label: "", username: "", password: "" });
    setDialogOpen(true);
  }

  function openEdit(account: VectraAccount) {
    setEditingAccount(account);
    form.reset({ label: account.label, username: account.username, password: "" });
    setDialogOpen(true);
  }

  function onSubmit(values: AccountFormValues) {
    if (editingAccount) {
      updateMutation.mutate(values);
    } else {
      if (!values.password) {
        form.setError("password", { message: "Hasło jest wymagane dla nowego konta" });
        return;
      }
      createMutation.mutate(values);
    }
  }

  async function openDiagnostic(account: VectraAccount) {
    setDiagnosticAccount(account);
    setDiagnosticData(null);
    setDiagnosticError(null);
    setDiagnosticLoading(true);
    try {
      const res = await fetch(`/api/vectra/debug/${account.id}`, {
        credentials: "include",
        headers: { ...getAuthHeaders() },
      });
      const data = await res.json();
      if (!res.ok) {
        setDiagnosticError(data.message || "Nieznany błąd");
      } else {
        setDiagnosticData(data);
      }
    } catch (err: any) {
      setDiagnosticError(err.message || "Błąd połączenia");
    } finally {
      setDiagnosticLoading(false);
    }
  }

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.label]));

  return (
    <div className="space-y-6 pt-4">
      {/* Schedule settings */}
      <ScheduleCard />

      {/* Accounts section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5 text-primary" />
              Konta Vectra
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInstrukcjaOpen(true)}
                data-testid="button-instrukcja"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Instrukcja
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={syncAll}
                disabled={syncingAll || accounts.length === 0}
                data-testid="button-sync-all"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncingAll ? "animate-spin" : ""}`} />
                Synchronizuj wszystkie
              </Button>
              <Button size="sm" onClick={openAdd} data-testid="button-add-account">
                <Plus className="h-4 w-4 mr-2" />
                Dodaj konto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {accountsLoading ? (
            <div className="text-sm text-muted-foreground">Ładowanie…</div>
          ) : accounts.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Brak kont Vectra. Kliknij „Dodaj konto" aby dodać pierwsze.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Etykieta</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Status synchronizacji</TableHead>
                    <TableHead>Podsumowanie sync</TableHead>
                    <TableHead className="text-right">Akcje</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
                      <TableCell className="font-medium">{account.label}</TableCell>
                      <TableCell className="text-muted-foreground">{account.username}</TableCell>
                      <TableCell>
                        <SyncStatusBadge status={account.lastSyncStatus} syncAt={account.lastSyncAt} />
                      </TableCell>
                      <TableCell>
                        {syncStats ? (
                          <div className="flex flex-col gap-0.5" data-testid={`sync-stats-${account.id}`}>
                            <div className="flex items-center gap-1.5">
                              <BarChart2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="text-sm font-medium">
                                {syncStats.totalCount}{" "}
                                <span className="text-muted-foreground font-normal">
                                  {syncStats.totalCount === 1 ? "synchronizacja" : syncStats.totalCount < 5 ? "synchronizacje" : "synchronizacji"}
                                </span>
                              </span>
                            </div>
                            {syncStats.firstSyncAt && (
                              <span className="text-xs text-muted-foreground pl-5">
                                od {format(new Date(syncStats.firstSyncAt), "dd.MM.yyyy", { locale: pl })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncAccount(account.id)}
                            disabled={syncingIds.has(account.id)}
                            data-testid={`button-sync-${account.id}`}
                            title="Synchronizuj"
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${syncingIds.has(account.id) ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDiagnostic(account)}
                            data-testid={`button-diagnostic-${account.id}`}
                            title="Diagnostyka"
                          >
                            <Info className="h-3.5 w-3.5 text-blue-500" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(account)}
                            data-testid={`button-edit-${account.id}`}
                            title="Edytuj"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMutation.mutate(account.id)}
                            data-testid={`button-delete-${account.id}`}
                            title="Usuń"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoices section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Pobrane faktury</CardTitle>
            {accounts.length > 0 && (
              <Select value={filterAccount} onValueChange={setFilterAccount}>
                <SelectTrigger className="w-48" data-testid="select-filter-account">
                  <SelectValue placeholder="Wszystkie konta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie konta</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {invoicesLoading ? (
            <div className="text-sm text-muted-foreground">Ładowanie…</div>
          ) : invoices.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              Brak pobranych faktur. Kliknij „Synchronizuj" przy koncie, aby pobrać faktury.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Konto</TableHead>
                    <TableHead>Numer faktury</TableHead>
                    <TableHead>Data faktury</TableHead>
                    <TableHead>Kwota</TableHead>
                    <TableHead>Okres</TableHead>
                    <TableHead>Pobrano</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                      <TableCell className="text-sm">{accountMap[inv.vectraAccountId] || `#${inv.vectraAccountId}`}</TableCell>
                      <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                      <TableCell className="text-sm">
                        {inv.invoiceDate ? format(new Date(inv.invoiceDate), "dd.MM.yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {inv.amount ? `${parseFloat(inv.amount).toFixed(2)} zł` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{inv.period || "—"}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(inv.downloadedAt), "dd.MM.yyyy HH:mm", { locale: pl })}
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.objectPath ? (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            data-testid={`button-download-${inv.id}`}
                          >
                            <a href={`/api/vectra/invoices/${inv.id}/download`} target="_blank" rel="noopener noreferrer">
                              <Download className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Brak pliku</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync History section */}
      <SyncHistoryCard />

      {/* Instrukcja Sheet */}
      <Sheet open={instrukcjaOpen} onOpenChange={setInstrukcjaOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto" data-testid="sheet-instrukcja">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Instrukcja obsługi — Moduł Vectra
            </SheetTitle>
          </SheetHeader>
          <MarkdownViewer content={instrukcjaContent} />
        </SheetContent>
      </Sheet>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingAccount(null); }}>
        <DialogContent data-testid="dialog-vectra-account">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Edytuj konto Vectra" : "Dodaj konto Vectra"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Etykieta (np. „GB101 - salon")</FormLabel>
                    <FormControl>
                      <Input placeholder="Etykieta konta" data-testid="input-label" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Login (e-mail lub numer klienta)</FormLabel>
                    <FormControl>
                      <Input placeholder="login@example.com" data-testid="input-username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Hasło{editingAccount ? " (zostaw puste aby nie zmieniać)" : ""}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={editingAccount ? "••••••••" : "Hasło do portalu Vectra"}
                        data-testid="input-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Anuluj
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-account"
                >
                  {editingAccount ? "Zapisz zmiany" : "Dodaj konto"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Diagnostic Modal */}
      <Dialog open={!!diagnosticAccount} onOpenChange={(open) => { if (!open) { setDiagnosticAccount(null); setDiagnosticData(null); setDiagnosticError(null); } }}>
        <DialogContent className="max-w-2xl" data-testid="dialog-diagnostic">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Diagnostyka konta: {diagnosticAccount?.label}
            </DialogTitle>
          </DialogHeader>

          {diagnosticLoading && (
            <div className="flex items-center justify-center py-10 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Pobieranie danych diagnostycznych…</span>
            </div>
          )}

          {diagnosticError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{diagnosticError}</span>
            </div>
          )}

          {diagnosticData && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-2">

                {/* SPA warning */}
                {diagnosticData.spaIndicators.length > 0 && (
                  <div className="flex gap-2 rounded-md border border-yellow-400/60 bg-yellow-50 dark:bg-yellow-950/30 p-3 text-sm text-yellow-800 dark:text-yellow-300">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Wykryto wskaźniki SPA — synchronizacja może nie działać</p>
                      <ul className="mt-1 list-disc list-inside space-y-0.5">
                        {diagnosticData.spaIndicators.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* HTTP statuses */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Statusy HTTP</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Strona logowania", status: diagnosticData.loginPageStatus, url: diagnosticData.loginPageUrl },
                      { label: "Po zalogowaniu", status: diagnosticData.loginResultStatus, url: diagnosticData.loginResultUrl },
                      { label: "Strona faktur", status: diagnosticData.invoicesPageStatus, url: diagnosticData.invoicesPageUrl },
                    ].map(({ label, status, url }) => (
                      <div key={label} className="rounded border p-2 text-sm">
                        <p className="text-muted-foreground text-xs">{label}</p>
                        <Badge
                          variant={status >= 200 && status < 300 ? "default" : "destructive"}
                          className="mt-1 text-xs"
                          data-testid={`badge-status-${label}`}
                        >
                          {status}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1 truncate" title={url}>{url}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Login page info */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Formularz logowania</p>
                  <div className="rounded border p-2 text-sm space-y-1">
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-muted-foreground">CSRF:</span>
                      <Badge variant={diagnosticData.hasCsrf ? "default" : "secondary"} className="text-xs">
                        {diagnosticData.hasCsrf ? `Tak (${diagnosticData.csrfName})` : "Nie wykryto"}
                      </Badge>
                    </div>
                    {diagnosticData.formAction && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground text-xs">Action:</span>
                        <span className="text-xs font-mono break-all">{diagnosticData.formAction}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cookies */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                    Cookies po logowaniu ({diagnosticData.cookiesAfterLogin.length})
                  </p>
                  {diagnosticData.cookiesAfterLogin.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Brak cookies — logowanie mogło się nie udać</p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {diagnosticData.cookiesAfterLogin.map((c, i) => (
                        <Badge key={i} variant="outline" className="text-xs font-mono">{c}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Detected structure */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Wykryta struktura strony</p>
                  <div className="rounded border p-2 text-sm flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{diagnosticData.detectedStructure}</Badge>
                    <span className="text-muted-foreground text-xs">Wierszy tabeli: {diagnosticData.tableRowCount}</span>
                  </div>
                </div>

                {/* Selector results */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Wyniki selektorów HTML</p>
                  <div className="grid grid-cols-2 gap-1">
                    {Object.entries(diagnosticData.selectorResults).map(([selector, count]) => (
                      <div key={selector} className="flex justify-between rounded border px-2 py-1 text-xs">
                        <span className="font-mono text-muted-foreground truncate mr-2" title={selector}>{selector}</span>
                        <span className={`font-semibold shrink-0 ${count > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* HTML snippets */}
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Snippet HTML — strona logowania</p>
                  <pre className="rounded border bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{diagnosticData.loginPageSnippet}</pre>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Snippet HTML — po zalogowaniu</p>
                  <pre className="rounded border bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{diagnosticData.loginResultSnippet}</pre>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Snippet HTML — strona faktur</p>
                  <pre className="rounded border bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{diagnosticData.invoicesPageSnippet}</pre>
                </div>

              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDiagnosticAccount(null); setDiagnosticData(null); setDiagnosticError(null); }}
              data-testid="button-close-diagnostic"
            >
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
