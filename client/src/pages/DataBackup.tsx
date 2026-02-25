import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileJson, FileSpreadsheet, Clock, Database, DatabaseBackup } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

interface BackupData {
  exportDate: string;
  reservations: any[];
  apartments: any[];
  expenses: any[];
  leases: any[];
  subleases: any[];
  employees: any[];
  accounts: any[];
  accountSnapshots: any[];
  owners: any[];
  blockades: any[];
  locations: any[];
  serviceContracts: any[];
  serviceContractCategories: any[];
  costSchedules: any[];
  costSchedulePayments: any[];
  installmentSchedules: any[];
  installmentPayments: any[];
  documentCategories: any[];
  documentTemplates: any[];
  appUsers: any[];
  attachments: any[];
  serviceContractAttachments: any[];
  saldoEntries: any[];
  activityLogs: any[];
}

interface RecordCount {
  name: string;
  count: number;
}

function convertToCSV(data: any[]): string {
  if (data.length === 0) return "";

  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(";");

  const csvRows = data.map((row) => {
    return headers
      .map((header) => {
        const value = row[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "string") {
          if (value.includes(";") || value.includes('"') || value.includes("\n")) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        }
        if (typeof value === "object") {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }
        return value.toString();
      })
      .join(";");
  });

  return [csvHeaders, ...csvRows].join("\n");
}

function downloadFile(content: string, filename: string, mimeType: string = "application/json") {
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function logBackupToDb(recordCount: number) {
  await fetch('/api/backup/log', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify({ recordCount, details: 'JSON/Excel export' }),
  });
  queryClient.invalidateQueries({ queryKey: ['/api/import-metadata/last/data_backup'] });
}

export default function DataBackup() {
  const [isLoading, setIsLoading] = useState(false);
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [recordCounts, setRecordCounts] = useState<RecordCount[]>([]);
  const { toast } = useToast();

  const { data: lastBackupMeta } = useQuery<{ importedAt: string } | null>({
    queryKey: ['/api/import-metadata/last/data_backup'],
    staleTime: 30000,
  });
  const lastBackupTime = lastBackupMeta?.importedAt
    ? new Date(lastBackupMeta.importedAt).toLocaleString('pl-PL')
    : null;

  useEffect(() => {
    fetchBackupData();
  }, []);

  const fetchBackupData = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest("GET", "/api/backup/export");
      const data = (await response.json()) as BackupData;
      setBackupData(data);

      const counts: RecordCount[] = [
        { name: "Rezerwacje", count: data.reservations?.length || 0 },
        { name: "Apartamenty", count: data.apartments?.length || 0 },
        { name: "Koszty", count: data.expenses?.length || 0 },
        { name: "Umowy najmu", count: data.leases?.length || 0 },
        { name: "Podnajem", count: data.subleases?.length || 0 },
        { name: "Pracownicy", count: data.employees?.length || 0 },
        { name: "Konta", count: data.accounts?.length || 0 },
        { name: "Właściciele", count: data.owners?.length || 0 },
        { name: "Blokady", count: data.blockades?.length || 0 },
        { name: "Lokalizacje", count: data.locations?.length || 0 },
        { name: "Umowy serwisowe", count: data.serviceContracts?.length || 0 },
        { name: "Harmonogramy kosztów", count: data.costSchedules?.length || 0 },
        { name: "Harmonogramy rat", count: data.installmentSchedules?.length || 0 },
        { name: "Szablony dokumentów", count: data.documentTemplates?.length || 0 },
        { name: "Salda", count: data.saldoEntries?.length || 0 },
      ];

      setRecordCounts(counts);
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się załadować danych kopii zapasowej",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleJsonDownload = async () => {
    if (!backupData) {
      toast({
        title: "Błąd",
        description: "Brak danych do pobrania",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const dateStr = new Date().toISOString().split("T")[0];
      const filename = `baltyckie-finanse-backup-${dateStr}.json`;
      const content = JSON.stringify(backupData, null, 2);
      downloadFile(content, filename, "application/json");

      const totalRecords = recordCounts.reduce((s, r) => s + r.count, 0);
      await logBackupToDb(totalRecords);

      toast({
        title: "Sukces",
        description: "Kopia zapasowa (JSON) pobrana pomyślnie",
      });
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać kopii zapasowej",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvDownload = async () => {
    if (!backupData) {
      toast({
        title: "Błąd",
        description: "Brak danych do pobrania",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsLoading(true);
      const dateStr = new Date().toISOString().split("T")[0];

      const csvTables: { [key: string]: string } = {};

      if (backupData.reservations?.length > 0) {
        csvTables["rezerwacje"] = convertToCSV(backupData.reservations);
      }
      if (backupData.apartments?.length > 0) {
        csvTables["apartamenty"] = convertToCSV(backupData.apartments);
      }
      if (backupData.leases?.length > 0) {
        csvTables["umowy_najmu"] = convertToCSV(backupData.leases);
      }
      if (backupData.owners?.length > 0) {
        csvTables["wlasciciele"] = convertToCSV(backupData.owners);
      }
      if (backupData.expenses?.length > 0) {
        csvTables["koszty"] = convertToCSV(backupData.expenses);
      }
      if (backupData.employees?.length > 0) {
        csvTables["pracownicy"] = convertToCSV(backupData.employees);
      }
      if (backupData.accounts?.length > 0) {
        csvTables["konta"] = convertToCSV(backupData.accounts);
      }

      for (const [tableName, csvContent] of Object.entries(csvTables)) {
        const filename = `baltyckie-finanse-backup-${tableName}-${dateStr}.csv`;
        downloadFile(csvContent, filename, "text/csv;charset=utf-8");
      }

      const totalRecords = recordCounts.reduce((s, r) => s + r.count, 0);
      await logBackupToDb(totalRecords);

      toast({
        title: "Sukces",
        description: "Kopie zapasowe (CSV) pobrane pomyślnie",
      });
    } catch (error) {
      toast({
        title: "Błąd",
        description: "Nie udało się pobrać kopii zapasowych",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Backup danych" description="Eksport i tworzenie kopii zapasowych danych." icon={DatabaseBackup} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Pobierz kopię zapasową
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={handleJsonDownload}
              disabled={isLoading || !backupData}
              className="h-auto flex flex-col items-start p-4"
              data-testid="button-download-json"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileJson className="h-5 w-5" />
                <span className="font-semibold">Pobierz backup (JSON)</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Pełna kopia zapasowa w formacie JSON
              </span>
            </Button>

            <Button
              onClick={handleCsvDownload}
              disabled={isLoading || !backupData}
              className="h-auto flex flex-col items-start p-4"
              data-testid="button-download-csv"
            >
              <div className="flex items-center gap-2 mb-2">
                <FileSpreadsheet className="h-5 w-5" />
                <span className="font-semibold">Pobierz backup (CSV)</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Dane w formacie CSV (Excel)
              </span>
            </Button>
          </div>

          {lastBackupTime && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-4 border-t">
              <Clock className="h-4 w-4" />
              <span>Ostatnia kopia zapasowa: {lastBackupTime}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {recordCounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Statystyka danych
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Kategoria</th>
                    <th className="text-right py-3 px-4 font-semibold">Liczba rekordów</th>
                  </tr>
                </thead>
                <tbody>
                  {recordCounts.map((record) => (
                    <tr
                      key={record.name}
                      className="border-b hover:bg-muted/50 transition-colors"
                      data-testid={`row-record-${record.name}`}
                    >
                      <td className="py-3 px-4">{record.name}</td>
                      <td className="text-right py-3 px-4">
                        <Badge variant="secondary" data-testid={`badge-count-${record.name}`}>
                          {record.count}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}
