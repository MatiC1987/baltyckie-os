import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

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

interface HotResTestResult {
  success: boolean;
  baseUrl?: string;
  message: string;
  details?: any;
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
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="text-import-title">Import danych</h2>
        <p className="text-muted-foreground">Import rezerwacji z HotRes lub z pliku Excel (.xlsx).</p>
      </div>

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

function HotResSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<HotResTestResult | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<HotResSyncResult | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/hotres/test", { credentials: "include" });
      const data: HotResTestResult = await res.json();
      setTestResult(data);
      if (data.success) {
        toast({ title: "Sukces", description: "Połączenie z HotRes działa" });
      } else {
        toast({ title: "Problem", description: data.message, variant: "destructive" });
      }
    } catch (e: any) {
      setTestResult({ success: false, message: e.message });
      toast({ title: "Błąd", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/hotres/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }),
        credentials: "include",
      });
      const data: HotResSyncResult = await res.json();
      setSyncResult(data);

      if (data.success && data.imported > 0) {
        toast({ title: "Sukces", description: data.message });
        queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
        queryClient.invalidateQueries({ queryKey: ['/api/apartments'] });
        queryClient.invalidateQueries({ queryKey: ['/api/stats/dashboard'] });
      } else {
        toast({
          title: data.success ? "Informacja" : "Problem",
          description: data.message,
          variant: data.success ? "default" : "destructive",
        });
      }
    } catch (e: any) {
      setSyncResult({ success: false, message: e.message, imported: 0, skipped: 0 });
      toast({ title: "Błąd", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Synchronizacja z HotRes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Pobierz rezerwacje bezpośrednio z systemu HotRes.
            </p>
            {testResult && (
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <Badge variant="outline" className="text-green-700 border-green-300" data-testid="badge-hotres-connected">
                    <Wifi className="h-3 w-3 mr-1" /> Połączono
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-destructive border-destructive/30" data-testid="badge-hotres-disconnected">
                    <WifiOff className="h-3 w-3 mr-1" /> Brak połączenia
                  </Badge>
                )}
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={testing}
            data-testid="button-hotres-test"
          >
            {testing ? "Sprawdzanie..." : "Testuj połączenie"}
          </Button>
        </div>

        {testResult && !testResult.success && (
          <div className="bg-muted rounded-lg p-4 text-sm space-y-2">
            <p className="font-medium text-destructive">{testResult.message}</p>
            {testResult.details && (
              <pre className="text-xs text-muted-foreground overflow-auto max-h-32">
                {JSON.stringify(testResult.details, null, 2)}
              </pre>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="hotres-date-from">Data od (opcjonalnie)</Label>
            <Input
              id="hotres-date-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="input-hotres-date-from"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hotres-date-to">Data do (opcjonalnie)</Label>
            <Input
              id="hotres-date-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="input-hotres-date-to"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSync}
            disabled={syncing}
            data-testid="button-hotres-sync"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synchronizacja..." : "Pobierz rezerwacje z HotRes"}
          </Button>
        </div>

        {syncResult && (
          <div className={`rounded-lg p-4 space-y-3 ${syncResult.success ? "bg-muted" : "bg-destructive/10"}`}>
            <div className="flex items-center gap-2">
              {syncResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-700" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <span className="text-sm font-medium" data-testid="text-hotres-sync-message">
                {syncResult.message}
              </span>
            </div>

            {syncResult.imported > 0 && (
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Zaimportowano" value={syncResult.imported} />
                <StatBox label="Pominięto" value={syncResult.skipped} />
                <StatBox label="Nowe apartamenty" value={syncResult.newApartments || 0} />
              </div>
            )}

            {syncResult.log && syncResult.log.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-sm">Log synchronizacji:</h4>
                <div className="bg-muted rounded-lg p-3 text-xs font-mono max-h-48 overflow-y-auto space-y-1" data-testid="text-hotres-sync-log">
                  {syncResult.log.map((entry, i) => (
                    <div key={i}>{entry}</div>
                  ))}
                </div>
              </div>
            )}

            {syncResult.rawResponse && !syncResult.success && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Odpowiedź serwera (debug)</summary>
                <pre className="mt-2 bg-muted rounded-lg p-3 overflow-auto max-h-48" data-testid="text-hotres-raw-response">
                  {JSON.stringify(syncResult.rawResponse, null, 2)}
                </pre>
              </details>
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
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
