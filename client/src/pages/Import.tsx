import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
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
        <p className="text-muted-foreground">Wgraj plik Excel (.xlsx) z danymi rezerwacji, umow i sald.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Wgraj plik Excel
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
          <CardTitle>Obsługiwane arkusze</CardTitle>
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

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/50">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
