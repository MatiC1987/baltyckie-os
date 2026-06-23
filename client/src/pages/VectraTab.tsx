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
} from "lucide-react";

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

export function VectraTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<VectraAccount | null>(null);
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [syncingIds, setSyncingIds] = useState<Set<number>>(new Set());
  const [syncingAll, setSyncingAll] = useState(false);

  const { data: accounts = [], isLoading: accountsLoading } = useQuery<VectraAccount[]>({
    queryKey: ["/api/vectra/accounts"],
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

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a.label]));

  return (
    <div className="space-y-6 pt-4">
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
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => syncAccount(account.id)}
                            disabled={syncingIds.has(account.id)}
                            data-testid={`button-sync-${account.id}`}
                          >
                            <RefreshCw className={`h-3.5 w-3.5 ${syncingIds.has(account.id) ? "animate-spin" : ""}`} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(account)}
                            data-testid={`button-edit-${account.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMutation.mutate(account.id)}
                            data-testid={`button-delete-${account.id}`}
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
    </div>
  );
}
