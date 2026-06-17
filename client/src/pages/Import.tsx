import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Download, Users, Briefcase, FileText, Loader2, Zap } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";

interface ImportResult {
  message: string;
  imported: {
    reservations: number;
    apartments: number;
    leases?: number;
    accounts?: number;
    skipped?: number;
  };
  log?: string[];
}

interface HotResSyncResult {
  success: boolean;
  message: string;
  imported: number;
  skipped: number;
  newApartments?: number;
  log?: string[];
  rawResponse?: any;
}

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Blad importu');
      }

      const data: ImportResult = await res.json();
      setResult(data);
      toast({ title: "Sukces", description: data.message });

      queryClient.invalidateQueries({ queryKey: ['/api/apartments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leases'] });
      queryClient.invalidateQueries({ queryKey: ['/api/accounts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats/dashboard'] });

    } catch (e: any) {
      setError(e.message);
      toast({ title: "Blad", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Import & Eksport" description="Import rezerwacji z pliku Excel lub HotRes CSV. Modul eksportu danych w przygotowaniu." icon={Upload} />

      <UniversalImporter />

      <HotResSection />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import z pliku Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">Przeciagnij plik .xlsx tutaj lub kliknij ponizej</p>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
              id="file-upload"
              data-testid="input-file-upload"
            />
            <label htmlFor="file-upload">
              <Button variant="outline" asChild>
                <span>Wybierz plik</span>
              </Button>
            </label>

            {file && (
              <p className="mt-4 text-sm font-medium" data-testid="text-selected-file">
                Wybrany plik: {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              data-testid="button-start-import"
            >
              {uploading ? "Importowanie..." : "Rozpocznij import"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              Wynik importu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatBox label="Apartamenty" value={result.imported.apartments} />
              <StatBox label="Rezerwacje" value={result.imported.reservations} />
              <StatBox label="Umowy" value={result.imported.leases || 0} />
              <StatBox label="Konta" value={result.imported.accounts || 0} />
              <StatBox label="Pominiete" value={result.imported.skipped || 0} />
            </div>

            {result.log && result.log.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">Log importu:</h4>
                <div className="bg-muted rounded-lg p-4 text-sm font-mono max-h-64 overflow-y-auto space-y-1" data-testid="text-import-log">
                  {result.log.map((entry, i) => (
                    <div key={i}>{entry}</div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Blad importu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive" data-testid="text-import-error">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Obsługiwane arkusze Excel</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><strong>"Rezerwacje (2025)"</strong> i <strong>"Rezerwacje (2020-24)"</strong> - rezerwacje krótkoterminowe</li>
            <li><strong>"Umowy najmu"</strong> - apartamenty i umowy dlugoterminowe</li>
            <li><strong>"Saldo"</strong> - konta bankowe i salda poczatkowe</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

const IMPORT_TYPES = [
  {
    key: "owners",
    label: "Właściciele",
    icon: Users,
    description: "Import właścicieli nieruchomości (imię, NIP, kontakt)",
    invalidateKeys: ["/api/owners"],
  },
  {
    key: "employees",
    label: "Pracownicy",
    icon: Briefcase,
    description: "Import pracowników (dane osobowe, stanowisko, umowa)",
    invalidateKeys: ["/api/employees"],
  },
  {
    key: "service-contracts",
    label: "Umowy serwisowe",
    icon: FileText,
    description: "Import umów serwisowych (nazwa, kategoria, cena)",
    invalidateKeys: ["/api/service-contracts"],
  },
];

interface UniversalImportResult {
  message: string;
  imported: number;
  skipped: number;
  log: string[];
}

function UniversalImporter() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, UniversalImportResult>>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleDownloadTemplate = (typeKey: string) => {
    window.open(`/api/import-template/${typeKey}`, '_blank');
  };

  const handleFileSelect = async (typeKey: string, file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: "Błąd", description: "Wybierz plik Excel (.xlsx)", variant: "destructive" });
      return;
    }

    setUploading(typeKey);
    setResults(prev => { const next = { ...prev }; delete next[typeKey]; return next; });

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`/api/import-data/${typeKey}`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Błąd importu');

      setResults(prev => ({ ...prev, [typeKey]: data }));
      toast({ title: "Sukces", description: data.message });

      const config = IMPORT_TYPES.find(t => t.key === typeKey);
      if (config) {
        for (const key of config.invalidateKeys) {
          queryClient.invalidateQueries({ queryKey: [key] });
        }
      }
    } catch (e: any) {
      toast({ title: "Błąd", description: e.message, variant: "destructive" });
      setResults(prev => ({
        ...prev,
        [typeKey]: { message: e.message, imported: 0, skipped: 0, log: [] },
      }));
    } finally {
      setUploading(null);
      const ref = fileRefs.current[typeKey];
      if (ref) ref.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importer danych (Excel)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Pobierz szablon Excel, wypełnij danymi i zaimportuj. Każdy typ danych ma własny szablon z przykładowymi wartościami.
        </p>

        <div className="grid gap-4 md:grid-cols-3">
          {IMPORT_TYPES.map(type => {
            const Icon = type.icon;
            const isActive = activeType === type.key;
            const isUploading = uploading === type.key;
            const result = results[type.key];

            return (
              <div
                key={type.key}
                className="border rounded-md p-4 space-y-3"
                data-testid={`card-import-${type.key}`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{type.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{type.description}</p>

                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadTemplate(type.key)}
                    data-testid={`button-template-${type.key}`}
                  >
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Pobierz szablon
                  </Button>

                  <input
                    ref={el => { fileRefs.current[type.key] = el; }}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    data-testid={`input-import-file-${type.key}`}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(type.key, f);
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => fileRefs.current[type.key]?.click()}
                    disabled={isUploading}
                    data-testid={`button-import-${type.key}`}
                  >
                    {isUploading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {isUploading ? "Importowanie..." : "Importuj plik"}
                  </Button>
                </div>

                {result && (
                  <div className={`rounded-md p-3 text-xs space-y-2 ${result.imported > 0 ? "bg-muted" : "bg-destructive/10"}`}>
                    <div className="flex items-center gap-1.5">
                      {result.imported > 0 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      <span className="font-medium" data-testid={`text-result-${type.key}`}>
                        {result.message}
                      </span>
                    </div>

                    {result.log.length > 0 && (
                      <div>
                        <button
                          className="text-xs text-muted-foreground underline"
                          onClick={() => setActiveType(isActive ? null : type.key)}
                          data-testid={`button-toggle-log-${type.key}`}
                        >
                          {isActive ? "Ukryj log" : "Pokaż log"}
                        </button>
                        {isActive && (
                          <div className="mt-2 bg-muted/50 rounded p-2 font-mono text-xs max-h-40 overflow-y-auto space-y-0.5" data-testid={`text-log-${type.key}`}>
                            {result.log.map((entry, i) => (
                              <div key={i}>{entry}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

interface ApiSyncStatus {
  importedAt?: string;
  recordsImported?: number;
  recordsUpdated?: number;
  recordsSkipped?: number;
  details?: string;
}

interface ApiSyncResponse {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  newApartments: number;
  lastSync: string;
  error?: string;
  log: string[];
}

function HotResApiSyncCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncResult, setSyncResult] = useState<ApiSyncResponse | null>(null);
  const [showLog, setShowLog] = useState(false);

  const { data: syncStatus } = useQuery<ApiSyncStatus | null>({
    queryKey: ["/api/hotres/sync-status"],
    refetchInterval: false,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hotres/sync"),
    onSuccess: async (res) => {
      const data: ApiSyncResponse = await res.json();
      setSyncResult(data);
      if (!data.error) {
        toast({
          title: "Synchronizacja zakończona",
          description: `+${data.imported} nowych, ~${data.updated} zaktualizowanych`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/apartments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats/dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["/api/hotres/sync-status"] });
      } else {
        toast({ title: "Błąd synchronizacji", description: data.error, variant: "destructive" });
      }
    },
    onError: (e: any) => {
      toast({ title: "Błąd", description: e.message, variant: "destructive" });
    },
  });

  const isSyncing = syncMutation.isPending;

  const statusBadge = () => {
    if (isSyncing) return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" data-testid="badge-sync-status">Synchronizacja...</Badge>;
    if (syncResult?.error) return <Badge variant="destructive" data-testid="badge-sync-status">Błąd</Badge>;
    if (syncResult && !syncResult.error) return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-sync-status">OK</Badge>;
    if (syncStatus?.importedAt) return <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-sync-status">OK</Badge>;
    return null;
  };

  const formatSyncDate = (isoDate: string) => {
    try {
      return format(parseISO(isoDate), "d MMM yyyy HH:mm", { locale: pl });
    } catch {
      return isoDate;
    }
  };

  const lastSyncInfo = syncResult
    ? `${formatSyncDate(syncResult.lastSync)} — ${syncResult.imported} dodanych, ${syncResult.updated} zaktualizowanych, ${syncResult.skipped} pominiętych`
    : syncStatus?.importedAt
    ? `${formatSyncDate(syncStatus.importedAt)} — ${syncStatus.recordsImported ?? 0} dodanych, ${syncStatus.recordsUpdated ?? 0} zaktualizowanych, ${syncStatus.recordsSkipped ?? 0} pominiętych`
    : null;

  return (
    <div className="border rounded-lg p-4 space-y-4 bg-card">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Synchronizacja API</span>
          {statusBadge()}
        </div>
        <Button
          size="sm"
          onClick={() => syncMutation.mutate()}
          disabled={isSyncing}
          data-testid="button-hotres-api-sync"
        >
          {isSyncing ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          {isSyncing ? "Synchronizowanie..." : "Synchronizuj teraz"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Automatyczna synchronizacja z HotRes API — bez potrzeby eksportu CSV. Uruchamia się przy każdym starcie serwera i powtarza co godzinę.
      </p>

      {lastSyncInfo && (
        <div className="text-xs text-muted-foreground flex items-start gap-1.5" data-testid="text-last-sync-info">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-green-600 shrink-0" />
          <span>Ostatnia sync: {lastSyncInfo}</span>
        </div>
      )}

      {syncResult?.error && (
        <div className="flex items-start gap-1.5 text-xs text-destructive" data-testid="text-sync-error">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{syncResult.error}</span>
        </div>
      )}

      {syncResult && syncResult.log.length > 0 && (
        <div>
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => setShowLog(v => !v)}
            data-testid="button-toggle-sync-log"
          >
            {showLog ? "Ukryj log" : `Pokaż log (${syncResult.log.length} wpisów)`}
          </button>
          {showLog && (
            <div className="mt-2 bg-muted rounded p-2 font-mono text-xs max-h-64 overflow-y-auto space-y-0.5" data-testid="text-api-sync-log">
              {syncResult.log.map((entry, i) => {
                const isSkipped = entry.startsWith("[POMINIĘTO]");
                const isError = entry.startsWith("[BŁĄD]");
                const isNew = entry.startsWith("[NOWA]");
                const isUpdate = entry.startsWith("[AKTUALIZACJA]");
                const isSummary = entry.startsWith("[PODSUMOWANIE]");
                const isNewApt = entry.startsWith("[NOWY APT]");
                return (
                  <div
                    key={i}
                    className={
                      isError ? "text-red-600 dark:text-red-400" :
                      isSkipped ? "text-orange-500 dark:text-orange-400" :
                      isNew ? "text-green-700 dark:text-green-400" :
                      isUpdate ? "text-blue-600 dark:text-blue-400" :
                      isSummary ? "text-foreground font-semibold" :
                      isNewApt ? "text-purple-600 dark:text-purple-400" :
                      "text-muted-foreground"
                    }
                  >
                    {entry}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface DeepSyncResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  pagesProcessed: number;
  log: string[];
  error?: string;
  message?: string;
}

function HotResSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<HotResSyncResult | null>(null);
  const [repairResult, setRepairResult] = useState<{ success: boolean; message: string; fixed?: number } | null>(null);
  const [deepSyncResult, setDeepSyncResult] = useState<DeepSyncResult | null>(null);
  const [showDeepSyncLog, setShowDeepSyncLog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const deepSyncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hotres/deep-sync"),
    onSuccess: async (res) => {
      const data: DeepSyncResult = await res.json();
      setDeepSyncResult(data);
      if (data.success || data.imported >= 0) {
        toast({ title: "Deep Sync zakończony", description: `Nowe: ${data.imported}, zaktualizowane: ${data.updated}, stron: ${data.pagesProcessed ?? "?"}` });
        queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/stats/dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/import-metadata/last/hotres_api'] });
      } else {
        toast({ title: "Błąd", description: data.error || data.message || "Nieznany błąd", variant: "destructive" });
      }
    },
    onError: (e: any) => {
      toast({ title: "Błąd deep sync", description: e.message, variant: "destructive" });
    },
  });

  const repairMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/hotres/repair-prices"),
    onSuccess: async (res) => {
      const data = await res.json();
      setRepairResult(data);
      if (data.success) {
        toast({ title: "Naprawiono ceny", description: data.message });
        queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/stats/dashboard'] });
      } else {
        toast({ title: "Błąd", description: data.message, variant: "destructive" });
      }
    },
    onError: (e: any) => {
      toast({ title: "Błąd", description: e.message, variant: "destructive" });
    },
  });

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({ title: "Nieprawidłowy format", description: "Wybierz plik CSV wyeksportowany z HotRes", variant: "destructive" });
      return;
    }

    setUploading(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/hotres/import-csv", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data: HotResSyncResult = await res.json();
      setImportResult(data);

      if (data.success && (data.imported > 0 || (data as any).updated > 0)) {
        toast({ title: "Sukces", description: data.message });
        queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/apartments'] });
        queryClient.invalidateQueries({ queryKey: ['/api/stats/dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['/api/import-metadata/last/hotres_csv'] });
      } else {
        toast({
          title: data.success ? "Informacja" : "Problem",
          description: data.message,
          variant: data.success ? "default" : "destructive",
        });
      }
    } catch (e: any) {
      setImportResult({ success: false, message: e.message, imported: 0, skipped: 0 });
      toast({ title: "Błąd", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          HotRes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <HotResApiSyncCard />

        {/* Deep Sync section */}
        <div className="border rounded-lg p-4 space-y-3 border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20">
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1 flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Deep Sync — jednorazowa naprawa historycznych rezerwacji</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Pobiera <strong>wszystkie</strong> rezerwacje z HotRes API od 2020 roku (paginacja po dacie wyjazdu) i nadpisuje kwoty zgodnie z aktualną logiką (total + addons_amount). Naprawia historyczne rekordy, których nie obejmuje regularna synchronizacja. <strong>Operacja jednorazowa — może potrwać kilka minut.</strong>
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => { setDeepSyncResult(null); deepSyncMutation.mutate(); }}
            disabled={deepSyncMutation.isPending}
            data-testid="button-hotres-deep-sync"
            className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-950/50"
          >
            {deepSyncMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            {deepSyncMutation.isPending ? "Deep Sync — trwa (kilka minut)..." : "Uruchom Deep Sync"}
          </Button>

          {deepSyncResult && (
            <div className={`rounded-lg p-3 space-y-3 ${deepSyncResult.success || deepSyncResult.imported >= 0 ? "bg-green-50 dark:bg-green-950/30" : "bg-destructive/10"}`} data-testid="panel-deep-sync-result">
              <div className="flex items-center gap-2">
                {deepSyncResult.success || deepSyncResult.imported >= 0 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-700 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                )}
                <span className="text-sm font-medium text-green-800 dark:text-green-200" data-testid="text-deep-sync-message">
                  Deep Sync zakończony
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatBox label="Stron API" value={deepSyncResult.pagesProcessed ?? 0} />
                <StatBox label="Nowe" value={deepSyncResult.imported ?? 0} />
                <StatBox label="Zaktualizowane" value={deepSyncResult.updated ?? 0} />
                <StatBox label="Pominięte" value={deepSyncResult.skipped ?? 0} />
              </div>
              {deepSyncResult.log && deepSyncResult.log.length > 0 && (
                <div>
                  <button
                    className="text-xs text-muted-foreground underline"
                    onClick={() => setShowDeepSyncLog(v => !v)}
                    data-testid="button-toggle-deep-sync-log"
                  >
                    {showDeepSyncLog ? "Ukryj log" : `Pokaż log (${deepSyncResult.log.length} wpisów)`}
                  </button>
                  {showDeepSyncLog && (
                    <div className="mt-2 bg-muted rounded p-2 font-mono text-xs max-h-64 overflow-y-auto space-y-0.5" data-testid="text-deep-sync-log">
                      {deepSyncResult.log.map((entry, i) => {
                        const isError = entry.startsWith("[BŁĄD]");
                        const isNew = entry.startsWith("[NOWA]");
                        const isUpdate = entry.startsWith("[AKTUALIZACJA]");
                        const isSummary = entry.startsWith("[PODSUMOWANIE]") || entry.startsWith("Strona");
                        return (
                          <div key={i} className={
                            isError ? "text-red-600 dark:text-red-400" :
                            isNew ? "text-green-700 dark:text-green-400" :
                            isUpdate ? "text-blue-600 dark:text-blue-400" :
                            isSummary ? "text-foreground font-semibold" :
                            "text-muted-foreground"
                          }>{entry}</div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium">Import CSV (fallback)</p>
          <p className="text-xs text-muted-foreground">
            Ręczny import z pliku CSV wyeksportowanego z panelu HotRes (Serwis &gt; Rezerwacje &gt; Eksport CSV).
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleCsvImport}
            className="hidden"
            data-testid="input-hotres-csv-file"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="button-hotres-csv-import"
          >
            <Upload className={`h-4 w-4 mr-2 ${uploading ? "animate-spin" : ""}`} />
            {uploading ? "Importowanie..." : "Wybierz plik CSV z HotRes"}
          </Button>
          <Button
            variant="outline"
            onClick={() => repairMutation.mutate()}
            disabled={repairMutation.isPending}
            data-testid="button-hotres-repair-prices"
            title="Przywraca opłatę za sprzątanie do rezerwacji, w których została błędnie usunięta podczas importu CSV"
          >
            {repairMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {repairMutation.isPending ? "Naprawianie..." : "Napraw ceny (fallback)"}
          </Button>
        </div>

        {repairResult && (
          <div className={`rounded-lg p-3 text-sm flex items-start gap-2 ${repairResult.success ? "bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200" : "bg-destructive/10 text-destructive"}`}>
            {repairResult.success ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span data-testid="text-repair-result">{repairResult.message}</span>
          </div>
        )}

        {importResult && (
          <div className={`rounded-lg p-4 space-y-3 ${importResult.success ? "bg-muted" : "bg-destructive/10"}`}>
            <div className="flex items-center gap-2">
              {importResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-700" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm font-medium" data-testid="text-hotres-sync-message">
                {importResult.message}
              </span>
            </div>

            {importResult.imported > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                <StatBox label="Zaimportowano" value={importResult.imported} />
                <StatBox label="Pominięto" value={importResult.skipped} />
                <StatBox label="Nowe apartamenty" value={importResult.newApartments || 0} />
              </div>
            )}

            {importResult.log && importResult.log.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-sm">Log importu:</h4>
                <div className="bg-muted rounded-lg p-3 text-xs font-mono max-h-48 overflow-y-auto space-y-1" data-testid="text-hotres-sync-log">
                  {importResult.log.map((entry, i) => (
                    <div key={i}>{entry}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/50">
      <div className="text-xl sm:text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
