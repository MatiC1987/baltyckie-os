import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
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
      <PageHeader title="Import danych" description="Import rezerwacji z pliku Excel lub HotRes CSV." icon={Upload} />

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
  const [uploading, setUploading] = useState(false);
  const [importResult, setImportResult] = useState<HotResSyncResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
          Import z HotRes (CSV)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Zaimportuj rezerwacje z pliku CSV wyeksportowanego z panelu HotRes
            (Serwis &gt; Rezerwacje &gt; Eksport CSV).
          </p>
          <p className="text-xs text-muted-foreground">
            Obsługiwane kolumny: numer rezerwacji, apartament/pokój, data przyjazdu/wyjazdu,
            gość, cena, zaliczka, status. Separator: średnik, przecinek lub tabulator.
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
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="button-hotres-csv-import"
          >
            <Upload className={`h-4 w-4 mr-2 ${uploading ? "animate-spin" : ""}`} />
            {uploading ? "Importowanie..." : "Wybierz plik CSV z HotRes"}
          </Button>
        </div>

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
              <div className="grid grid-cols-3 gap-3">
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
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
