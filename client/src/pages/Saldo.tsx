import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Search, Trash2, Plus, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { SaldoEntry } from "@shared/schema";

const PAGE_SIZE = 100;

function formatDate(d: string) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}

function formatNum(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = parseFloat(v);
  if (isNaN(n)) return "";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Saldo({ personName }: { personName: string }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<SaldoEntry | null>(null);

  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split("T")[0],
    operationName: "",
    reservationNumber: "",
    guestName: "",
    type: "",
    paymentMethod: "",
    kasaFiskalna: "NIE",
    faktura: "NIE",
    cashAmount: "",
    cardAmount: "",
    authCode: "",
    notes: "",
  });

  const { data: entries = [], isLoading } = useQuery<SaldoEntry[]>({
    queryKey: ["/api/saldo"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/saldo", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo"] });
      toast({ title: "Dodano wpis" });
      setShowAddDialog(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/saldo/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo"] });
      toast({ title: "Usunięto wpis" });
    },
  });

  const paymentMethods = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { if (e.paymentMethod) s.add(e.paymentMethod); });
    return [...s].sort();
  }, [entries]);

  const types = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { if (e.type) s.add(e.type); });
    return [...s].sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let result = entries;
    if (dateFrom) result = result.filter(e => e.date >= dateFrom);
    if (dateTo) result = result.filter(e => e.date <= dateTo);
    if (paymentFilter !== "all") result = result.filter(e => e.paymentMethod === paymentFilter);
    if (typeFilter !== "all") result = result.filter(e => e.type === typeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        (e.operationName?.toLowerCase().includes(q)) ||
        (e.guestName?.toLowerCase().includes(q)) ||
        (e.reservationNumber?.toLowerCase().includes(q)) ||
        (e.notes?.toLowerCase().includes(q))
      );
    }
    return result;
  }, [entries, dateFrom, dateTo, paymentFilter, typeFilter, searchQuery]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const summary = useMemo(() => {
    let totalCash = 0;
    let totalCard = 0;
    filtered.forEach(e => {
      if (e.cashAmount) totalCash += parseFloat(e.cashAmount);
      if (e.cardAmount) totalCard += parseFloat(e.cardAmount);
    });
    const lastSaldo = filtered.length > 0 ? parseFloat(filtered[filtered.length - 1].saldo || "0") : 0;
    return { totalCash, totalCard, lastSaldo, count: filtered.length };
  }, [filtered]);

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/saldo/import-xlsx?replace=true", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      queryClient.invalidateQueries({ queryKey: ["/api/saldo"] });
      toast({ title: `Zaimportowano ${result.imported} wpisów z arkusza "${result.sheetName}"` });
      setShowImportDialog(false);
    } catch (err: any) {
      toast({ title: "Błąd importu", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleAddEntry = () => {
    const data: any = {
      date: newEntry.date,
      operationName: newEntry.operationName,
      reservationNumber: newEntry.reservationNumber || null,
      guestName: newEntry.guestName || null,
      type: newEntry.type || null,
      paymentMethod: newEntry.paymentMethod || null,
      kasaFiskalna: newEntry.kasaFiskalna || null,
      faktura: newEntry.faktura || null,
      cashAmount: newEntry.cashAmount ? parseFloat(newEntry.cashAmount).toFixed(2) : null,
      cardAmount: newEntry.cardAmount ? parseFloat(newEntry.cardAmount).toFixed(2) : null,
      authCode: newEntry.authCode || null,
      notes: newEntry.notes || null,
      saldo: null,
    };
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-saldo-title">Saldo</h2>
          <p className="text-muted-foreground">{personName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowAddDialog(true)} data-testid="button-add-saldo">
            <Plus className="mr-1 h-4 w-4" /> Dodaj wpis
          </Button>
          <Button variant="outline" onClick={() => setShowImportDialog(true)} data-testid="button-import-saldo">
            <Upload className="mr-1 h-4 w-4" /> Import Excel
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Wpisy</div>
              <div className="text-xl font-bold mt-1" data-testid="text-saldo-count">{summary.count.toLocaleString("pl-PL")}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Gotówka (suma)</div>
              <div className="text-xl font-bold mt-1" data-testid="text-saldo-cash">{summary.totalCash.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Karta (suma)</div>
              <div className="text-xl font-bold mt-1" data-testid="text-saldo-card">{summary.totalCard.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Aktualne saldo</div>
              <div className={`text-xl font-bold mt-1 ${summary.lastSaldo >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-saldo-current">{summary.lastSaldo.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 w-[250px]"
            placeholder="Szukaj..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
            data-testid="input-saldo-search"
          />
        </div>
        <Input
          type="date"
          className="w-[150px]"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(0); }}
          placeholder="Od daty"
          data-testid="input-saldo-date-from"
        />
        <Input
          type="date"
          className="w-[150px]"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(0); }}
          placeholder="Do daty"
          data-testid="input-saldo-date-to"
        />
        <Select value={paymentFilter} onValueChange={v => { setPaymentFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[160px]" data-testid="select-saldo-payment">
            <SelectValue placeholder="Płatność" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie płatności</SelectItem>
            {paymentMethods.map(m => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px]" data-testid="select-saldo-type">
            <SelectValue placeholder="Rodzaj" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie rodzaje</SelectItem>
            {types.map(t => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(searchQuery || dateFrom || dateTo || paymentFilter !== "all" || typeFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setSearchQuery(""); setDateFrom(""); setDateTo(""); setPaymentFilter("all"); setTypeFilter("all"); setPage(0); }} data-testid="button-clear-saldo-filters">
            Wyczyść filtry
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Ładowanie danych...</div>
      ) : (
        <div className="rounded-md border border-border bg-card overflow-x-auto">
          <table className="w-full text-xs border-collapse" style={{ minWidth: "1400px" }}>
            <thead className="sticky top-0 z-[100]">
              <tr className="bg-muted/80 dark:bg-muted/50">
                <th className="sticky left-0 z-[110] bg-muted/80 dark:bg-muted/50 border-b border-r border-border px-2 py-2 text-left font-bold w-[90px]">Data</th>
                <th className="border-b border-r border-border px-2 py-2 text-left font-bold w-[200px]">Nazwa operacji</th>
                <th className="border-b border-r border-border px-2 py-2 text-left font-bold w-[80px]">Nr rez.</th>
                <th className="border-b border-r border-border px-2 py-2 text-left font-bold w-[180px]">Imię i nazwisko</th>
                <th className="border-b border-r border-border px-2 py-2 text-left font-bold w-[130px]">Rodzaj</th>
                <th className="border-b border-r border-border px-2 py-2 text-left font-bold w-[90px]">Płatność</th>
                <th className="border-b border-r border-border px-2 py-2 text-center font-bold w-[50px]">KF</th>
                <th className="border-b border-r border-border px-2 py-2 text-center font-bold w-[50px]">FV</th>
                <th className="border-b border-r-2 border-border px-2 py-2 text-right font-bold w-[100px]">Suma (got.)</th>
                <th className="border-b border-r-2 border-border px-2 py-2 text-right font-bold w-[100px]">Saldo</th>
                <th className="border-b border-r border-border px-2 py-2 text-left font-bold w-[80px]">Kod aut.</th>
                <th className="border-b border-r border-border px-2 py-2 text-right font-bold w-[100px]">Kwota kartą</th>
                <th className="border-b border-r border-border px-2 py-2 text-left font-bold">Uwagi</th>
                <th className="border-b border-border px-2 py-2 text-center font-bold w-[55px]"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((entry, idx) => {
                const cashVal = entry.cashAmount ? parseFloat(entry.cashAmount) : null;
                return (
                  <tr
                    key={entry.id}
                    className={`group hover:bg-accent/30 cursor-pointer ${idx % 2 === 0 ? "" : "bg-muted/20 dark:bg-muted/10"} ${entry.operationName === "SALDO POCZĄTKOWE" ? "bg-blue-50 dark:bg-blue-950/30 font-semibold" : ""}`}
                    onClick={() => setPreviewEntry(entry)}
                    data-testid={`row-saldo-${entry.id}`}
                  >
                    <td className="sticky left-0 z-[5] bg-inherit border-b border-r border-border px-2 py-1.5 tabular-nums" data-testid={`cell-date-${entry.id}`}>{formatDate(entry.date)}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 truncate font-semibold" data-testid={`cell-op-${entry.id}`}>{entry.operationName}</td>
                    <td className="border-b border-r border-border px-2 py-1.5" data-testid={`cell-resnum-${entry.id}`}>{entry.reservationNumber || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 truncate" data-testid={`cell-guest-${entry.id}`}>{entry.guestName || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 truncate" data-testid={`cell-type-${entry.id}`}>{entry.type || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5" data-testid={`cell-payment-${entry.id}`}>{entry.paymentMethod || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-center" data-testid={`cell-kf-${entry.id}`}>{entry.kasaFiskalna || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-center" data-testid={`cell-fv-${entry.id}`}>{entry.faktura || ""}</td>
                    <td className={`border-b border-r-2 border-border px-2 py-1.5 text-right tabular-nums font-semibold ${cashVal !== null && cashVal < 0 ? "text-red-600 dark:text-red-400" : cashVal !== null && cashVal > 0 ? "text-green-600 dark:text-green-400" : ""}`} data-testid={`cell-cash-${entry.id}`}>{formatNum(entry.cashAmount)}</td>
                    <td className="border-b border-r-2 border-border px-2 py-1.5 text-right tabular-nums font-bold" data-testid={`cell-saldo-${entry.id}`}>{formatNum(entry.saldo)}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 tabular-nums" data-testid={`cell-auth-${entry.id}`}>{entry.authCode || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-right tabular-nums" data-testid={`cell-card-${entry.id}`}>{formatNum(entry.cardAmount)}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-muted-foreground truncate" data-testid={`cell-notes-${entry.id}`}>{entry.notes || ""}</td>
                    <td className="border-b border-border px-1 py-1.5 text-center">
                      <div className="flex items-center gap-0.5 justify-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewEntry(entry); }}
                          className="invisible group-hover:visible text-muted-foreground hover:text-foreground p-0.5"
                          data-testid={`button-preview-saldo-${entry.id}`}
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Usunąć ten wpis?")) {
                              deleteMutation.mutate(entry.id);
                            }
                          }}
                          className="invisible group-hover:visible text-muted-foreground hover:text-destructive p-0.5"
                          data-testid={`button-delete-saldo-${entry.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Strona {page + 1} z {totalPages} ({filtered.length} wpisów)
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="button-saldo-prev-page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-saldo-next-page">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dodaj wpis do salda</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={newEntry.date} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} data-testid="input-new-saldo-date" />
            </div>
            <div className="space-y-1">
              <Label>Nazwa operacji</Label>
              <Input value={newEntry.operationName} onChange={e => setNewEntry(p => ({ ...p, operationName: e.target.value }))} placeholder="np. GRAND BALTIC 203" data-testid="input-new-saldo-op" />
            </div>
            <div className="space-y-1">
              <Label>Nr rezerwacji</Label>
              <Input value={newEntry.reservationNumber} onChange={e => setNewEntry(p => ({ ...p, reservationNumber: e.target.value }))} data-testid="input-new-saldo-resnum" />
            </div>
            <div className="space-y-1">
              <Label>Imię i nazwisko</Label>
              <Input value={newEntry.guestName} onChange={e => setNewEntry(p => ({ ...p, guestName: e.target.value }))} data-testid="input-new-saldo-guest" />
            </div>
            <div className="space-y-1">
              <Label>Rodzaj</Label>
              <Input value={newEntry.type} onChange={e => setNewEntry(p => ({ ...p, type: e.target.value }))} placeholder="np. PRZYJAZD" data-testid="input-new-saldo-type" />
            </div>
            <div className="space-y-1">
              <Label>Sposób płatności</Label>
              <Select value={newEntry.paymentMethod || "none"} onValueChange={v => setNewEntry(p => ({ ...p, paymentMethod: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="select-new-saldo-payment">
                  <SelectValue placeholder="Wybierz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  <SelectItem value="GOTÓWKA">GOTÓWKA</SelectItem>
                  <SelectItem value="KARTA">KARTA</SelectItem>
                  <SelectItem value="BLIK">BLIK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Suma (gotówka)</Label>
              <Input type="number" step="0.01" value={newEntry.cashAmount} onChange={e => setNewEntry(p => ({ ...p, cashAmount: e.target.value }))} placeholder="0.00" data-testid="input-new-saldo-cash" />
            </div>
            <div className="space-y-1">
              <Label>Kwota kartą</Label>
              <Input type="number" step="0.01" value={newEntry.cardAmount} onChange={e => setNewEntry(p => ({ ...p, cardAmount: e.target.value }))} placeholder="0.00" data-testid="input-new-saldo-card" />
            </div>
            <div className="space-y-1">
              <Label>Kod autoryzacji</Label>
              <Input value={newEntry.authCode} onChange={e => setNewEntry(p => ({ ...p, authCode: e.target.value }))} data-testid="input-new-saldo-auth" />
            </div>
            <div className="space-y-1">
              <Label>Uwagi</Label>
              <Input value={newEntry.notes} onChange={e => setNewEntry(p => ({ ...p, notes: e.target.value }))} data-testid="input-new-saldo-notes" />
            </div>
            <div className="space-y-1">
              <Label>Kasa fiskalna</Label>
              <Select value={newEntry.kasaFiskalna} onValueChange={v => setNewEntry(p => ({ ...p, kasaFiskalna: v }))}>
                <SelectTrigger data-testid="select-new-saldo-kf">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAK">TAK</SelectItem>
                  <SelectItem value="NIE">NIE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Faktura</Label>
              <Select value={newEntry.faktura} onValueChange={v => setNewEntry(p => ({ ...p, faktura: v }))}>
                <SelectTrigger data-testid="select-new-saldo-fv">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TAK">TAK</SelectItem>
                  <SelectItem value="NIE">NIE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddEntry} disabled={!newEntry.operationName.trim() || !newEntry.date || createMutation.isPending} data-testid="button-confirm-add-saldo">
              Dodaj wpis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Import salda z Excela</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Wybierz plik Excel (.xlsx) z arkuszem "Saldo". Istniejące dane zostaną zastąpione.
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              data-testid="input-saldo-file"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowImportDialog(false)} data-testid="button-cancel-saldo-import">
              Anuluj
            </Button>
            <Button onClick={handleImport} disabled={importing} data-testid="button-confirm-saldo-import">
              {importing ? "Importowanie..." : "Importuj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewEntry} onOpenChange={(open) => { if (!open) setPreviewEntry(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-saldo-preview">
          <DialogHeader>
            <DialogTitle>Podgląd wpisu</DialogTitle>
          </DialogHeader>
          {previewEntry && (() => {
            const cashVal = previewEntry.cashAmount ? parseFloat(previewEntry.cashAmount) : null;
            const cardVal = previewEntry.cardAmount ? parseFloat(previewEntry.cardAmount) : null;
            const saldoVal = previewEntry.saldo ? parseFloat(previewEntry.saldo) : null;
            const fields: { label: string; value: string; highlight?: string }[] = [
              { label: "Data", value: formatDate(previewEntry.date) },
              { label: "Nazwa operacji", value: previewEntry.operationName || "" },
              { label: "Nr rezerwacji", value: previewEntry.reservationNumber || "" },
              { label: "Imię i nazwisko", value: previewEntry.guestName || "" },
              { label: "Rodzaj", value: previewEntry.type || "" },
              { label: "Sposób płatności", value: previewEntry.paymentMethod || "" },
              { label: "Kasa fiskalna", value: previewEntry.kasaFiskalna || "" },
              { label: "Faktura", value: previewEntry.faktura || "" },
              {
                label: "Suma (gotówka)",
                value: formatNum(previewEntry.cashAmount) ? `${formatNum(previewEntry.cashAmount)} zł` : "",
                highlight: cashVal !== null ? (cashVal < 0 ? "text-red-600 dark:text-red-400" : cashVal > 0 ? "text-green-600 dark:text-green-400" : "") : "",
              },
              {
                label: "Saldo",
                value: formatNum(previewEntry.saldo) ? `${formatNum(previewEntry.saldo)} zł` : "",
                highlight: saldoVal !== null ? (saldoVal < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400") : "",
              },
              { label: "Kod autoryzacji", value: previewEntry.authCode || "" },
              {
                label: "Kwota kartą",
                value: formatNum(previewEntry.cardAmount) ? `${formatNum(previewEntry.cardAmount)} zł` : "",
                highlight: cardVal !== null && cardVal > 0 ? "text-blue-600 dark:text-blue-400" : "",
              },
              { label: "Uwagi", value: previewEntry.notes || "" },
            ];
            return (
              <div className="space-y-1 py-2" data-testid="preview-saldo-content">
                {fields.map(({ label, value, highlight }) => (
                  <div key={label} className="flex items-start gap-3 py-1.5 border-b border-border last:border-b-0">
                    <span className="text-xs text-muted-foreground w-[130px] shrink-0 pt-0.5">{label}</span>
                    <span className={`text-sm font-medium break-words ${highlight || ""}`} data-testid={`preview-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                      {value || <span className="text-muted-foreground/50">—</span>}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewEntry(null)} data-testid="button-close-saldo-preview">
              Zamknij
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
