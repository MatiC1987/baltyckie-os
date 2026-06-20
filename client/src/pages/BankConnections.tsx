import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge as AppStatusBadge } from "@/components/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Landmark,
  Plus,
  RefreshCw,
  Trash2,
  Link2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  ExternalLink,
  Wifi,
  WifiOff,
  Building2,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import type { GocardlessConnection, Account } from "@shared/schema";

interface GCInstitution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  transaction_total_days: string;
  countries: string[];
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ACTIVE: { label: "Aktywne", variant: "default" },
  PENDING: { label: "Oczekuje", variant: "secondary" },
  EXPIRED: { label: "Wygasło", variant: "destructive" },
  ERROR: { label: "Błąd", variant: "destructive" },
};

function StatusBadge({ status }: { status: string }) {
  return <AppStatusBadge status={status} />;
}

function ConnectionCard({
  conn,
  accounts,
  onSync,
  onDelete,
  onLinkAccount,
  isSyncing,
}: {
  conn: GocardlessConnection;
  accounts: Account[];
  onSync: (id: number) => void;
  onDelete: (id: number) => void;
  onLinkAccount: (connId: number, accountId: number) => void;
  isSyncing: boolean;
}) {
  const linkedAccount = accounts.find(a => a.id === conn.localAccountId);

  return (
    <Card data-testid={`card-connection-${conn.id}`}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <Landmark className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm truncate" data-testid={`text-institution-${conn.id}`}>
                  {conn.institutionName}
                </h3>
                <StatusBadge status={conn.status} />
              </div>
              {conn.iban && (
                <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-iban-${conn.id}`}>
                  IBAN: {conn.iban}
                </p>
              )}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {linkedAccount ? (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Link2 className="h-3 w-3" />
                    Powiązane z: {linkedAccount.name}
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Brak powiązanego konta
                  </span>
                )}
                {conn.lastSyncAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Ostatnia sync: {new Date(conn.lastSyncAt).toLocaleString("pl-PL")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!conn.localAccountId && conn.status === "ACTIVE" && (
              <Select onValueChange={(val) => onLinkAccount(conn.id, parseInt(val))}>
                <SelectTrigger className="w-[180px] h-8 text-xs" data-testid={`select-link-account-${conn.id}`}>
                  <SelectValue placeholder="Powiąż konto..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.filter(a => a.type === "BANK").map(a => (
                    <SelectItem key={a.id} value={String(a.id)} data-testid={`option-account-${a.id}`}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {conn.status === "ACTIVE" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSync(conn.id)}
                disabled={isSyncing || !conn.localAccountId}
                data-testid={`button-sync-${conn.id}`}
              >
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Synchronizuj</span>
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" data-testid={`button-delete-${conn.id}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Odłączyć bank?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Czy na pewno chcesz odłączyć {conn.institutionName}? Zaimportowane transakcje pozostaną w systemie.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Anuluj</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(conn.id)} data-testid={`button-confirm-delete-${conn.id}`}>
                    Odłącz
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BankConnections() {
  const { toast } = useToast();
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [successParam] = useState(() => new URLSearchParams(window.location.search).get("success"));
  const [errorParam] = useState(() => new URLSearchParams(window.location.search).get("error"));

  useEffect(() => {
    if (successParam || errorParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const { data: gcStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["/api/gocardless/status"],
  });

  const { data: connections = [], isLoading: connectionsLoading } = useQuery<GocardlessConnection[]>({
    queryKey: ["/api/gocardless/connections"],
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: institutions, isLoading: institutionsLoading } = useQuery<GCInstitution[]>({
    queryKey: ["/api/gocardless/institutions"],
    enabled: showBankPicker && !!gcStatus?.configured,
  });

  const syncMutation = useMutation({
    mutationFn: async (connectionId: number) => {
      setSyncingId(connectionId);
      const res = await apiRequest("POST", `/api/gocardless/sync/${connectionId}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Synchronizacja zakończona",
        description: `Zaimportowano ${data.imported} nowych transakcji (${data.skipped} pominięto jako duplikaty).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gocardless/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-statements"] });
      setSyncingId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Błąd synchronizacji", description: err.message, variant: "destructive" });
      setSyncingId(null);
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/gocardless/sync-all");
      return res.json();
    },
    onSuccess: (data) => {
      const totalImported = data.results.reduce((s: number, r: any) => s + r.imported, 0);
      toast({
        title: "Synchronizacja wszystkich kont",
        description: `Zsynchronizowano ${data.totalConnections} kont. Zaimportowano ${totalImported} transakcji.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gocardless/connections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank-statements"] });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd synchronizacji", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/gocardless/connections/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Odłączono bank" });
      queryClient.invalidateQueries({ queryKey: ["/api/gocardless/connections"] });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const linkAccountMutation = useMutation({
    mutationFn: async ({ connId, localAccountId }: { connId: number; localAccountId: number }) => {
      const res = await apiRequest("PATCH", `/api/gocardless/connections/${connId}/link-account`, { localAccountId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Powiązano konto" });
      queryClient.invalidateQueries({ queryKey: ["/api/gocardless/connections"] });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const connectBank = async (institution: GCInstitution) => {
    setConnecting(true);
    try {
      const res = await apiRequest("POST", "/api/gocardless/connect", {
        institutionId: institution.id,
        institutionName: institution.name,
      });
      const data = await res.json();
      if (data.link) {
        window.location.href = data.link;
      }
    } catch (err: any) {
      toast({ title: "Błąd połączenia", description: err.message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const activeConnections = connections.filter(c => c.status === "ACTIVE");
  const isConfigured = gcStatus?.configured ?? false;

  return (
    <div className="space-y-6 pb-20" data-testid="page-bank-connections">
      <PageHeader
        title="Połączenia bankowe"
        description="Automatyczne pobieranie transakcji z kont bankowych przez GoCardless"
        breadcrumbs={[
          { label: "Ustawienia", href: "/ustawienia" },
          { label: "Połączenia bankowe" },
        ]}
      />

      {successParam && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" data-testid="alert-success">
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">Bank połączony pomyślnie!</p>
              <p className="text-sm text-green-600 dark:text-green-400">Powiąż konto lokalne i uruchom pierwszą synchronizację.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {errorParam && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950" data-testid="alert-error">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p className="font-medium text-red-800 dark:text-red-200">Wystąpił błąd podczas łączenia z bankiem.</p>
              <p className="text-sm text-red-600 dark:text-red-400">Spróbuj ponownie lub sprawdź konfigurację GoCardless.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isConfigured && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" data-testid="alert-not-configured">
          <CardContent className="p-4 flex items-center gap-3">
            <WifiOff className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">GoCardless nie jest skonfigurowany</p>
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Ustaw zmienne środowiskowe GOCARDLESS_SECRET_ID i GOCARDLESS_SECRET_KEY.
                Zarejestruj się na{" "}
                <a href="https://bankaccountdata.gocardless.com/" target="_blank" rel="noopener noreferrer" className="underline">
                  bankaccountdata.gocardless.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Połączone konta ({activeConnections.length})</h2>
        </div>
        <div className="flex items-center gap-2">
          {activeConnections.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncAllMutation.mutate()}
              disabled={syncAllMutation.isPending}
              data-testid="button-sync-all"
            >
              {syncAllMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCw className="h-4 w-4 mr-1.5" />}
              Synchronizuj wszystkie
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShowBankPicker(true)}
            disabled={!isConfigured}
            data-testid="button-add-connection"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Dodaj połączenie
          </Button>
        </div>
      </div>

      {connectionsLoading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-60" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : connections.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Landmark}
          title="Brak połączeń bankowych"
          description="Połącz swoje konto bankowe, aby automatycznie pobierać transakcje."
          actionLabel={isConfigured ? "Połącz bank" : undefined}
          onAction={isConfigured ? () => setShowBankPicker(true) : undefined}
        />
      ) : (
        <div className="space-y-3">
          {connections.map(conn => (
            <ConnectionCard
              key={conn.id}
              conn={conn}
              accounts={accounts}
              onSync={(id) => syncMutation.mutate(id)}
              onDelete={(id) => deleteMutation.mutate(id)}
              onLinkAccount={(connId, accountId) => linkAccountMutation.mutate({ connId, localAccountId: accountId })}
              isSyncing={syncingId === conn.id}
            />
          ))}
        </div>
      )}

      {showBankPicker && (
        <Card data-testid="card-bank-picker">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Wybierz bank do połączenia
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowBankPicker(false)} data-testid="button-close-picker">
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {institutionsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : !institutions || institutions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nie znaleziono dostępnych banków. Sprawdź konfigurację GoCardless.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {institutions.map(inst => (
                  <button
                    key={inst.id}
                    onClick={() => connectBank(inst)}
                    disabled={connecting}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                    data-testid={`button-bank-${inst.id}`}
                  >
                    {inst.logo ? (
                      <img src={inst.logo} alt={inst.name} className="h-8 w-8 rounded object-contain" />
                    ) : (
                      <Landmark className="h-8 w-8 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{inst.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Do {inst.transaction_total_days} dni historii
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {connecting && (
              <div className="flex items-center justify-center gap-2 mt-4 py-3" data-testid="connecting-indicator">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Przekierowuję do banku...</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
