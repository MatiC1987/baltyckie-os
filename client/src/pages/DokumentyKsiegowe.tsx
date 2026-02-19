import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CostInvoice, ZipDownloadHistory, AccountingNote, Sublease, MediaSettlementReport } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger
} from "@/components/ui/collapsible";
import {
  Upload, FileText, Image, Trash2, Download, Package, ChevronDown, ChevronUp,
  X, AlertTriangle, Clock, Search, Filter, Eye, History, Plus, CheckCircle2
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

const EXPENSE_CATEGORIES = [
  "WYNAGRODZENIA",
  "ZUS & PODATKI",
  "KREDYTY & POŻYCZKI",
  "NIERUCHOMOŚCI",
  "OBSŁUGA PRAWNO-KSIĘGOWA",
  "MARKETING & REKLAMA",
  "USŁUGI",
  "POZOSTAŁE",
];

const STATUS_OPTIONS = [
  { value: "NOWA", label: "Nowa", variant: "secondary" as const },
  { value: "WYSLANA", label: "Wysłana", variant: "default" as const },
  { value: "ZAKSIEGOWANA", label: "Zaksięgowana", variant: "outline" as const },
];

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}

function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString("pl-PL") + " " + date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function getMonthName(m: number): string {
  const names = ["", "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
  return names[m] || "";
}

function extractDateFromFilename(filename: string): string | null {
  const m1 = filename.match(/(\d{4})[_\-.](\d{2})[_\-.](\d{2})/);
  if (m1) return `${m1[1]}-${m1[2]}-${m1[3]}`;
  const m2 = filename.match(/(\d{2})[_\-.](\d{2})[_\-.](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2]}-${m2[1]}`;
  return null;
}

function DeadlineBanner() {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  const daysUntil15 = 15 - currentDay;
  const showBanner = daysUntil15 >= 0 && daysUntil15 <= 5;

  const dismissKey = `cost-invoice-banner-dismissed-${currentYear}-${currentMonth}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey) === "true"; } catch { return false; }
  });

  const { data: invoices = [] } = useQuery<CostInvoice[]>({ queryKey: ["/api/cost-invoices"] });
  const unsentCount = invoices.filter(
    i => i.status === "NOWA" && i.invoiceMonth === prevMonth && i.invoiceYear === prevYear
  ).length;

  if (!showBanner || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey, "true"); } catch {}
  };

  return (
    <div className="mb-4 p-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 flex items-center gap-3 flex-wrap" data-testid="banner-deadline">
      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="font-medium text-yellow-800 dark:text-yellow-200">
          {daysUntil15 === 0
            ? "Dziś termin wysyłki dokumentów do księgowej!"
            : `Zostało ${daysUntil15} ${daysUntil15 === 1 ? "dzień" : "dni"} do wysyłki dokumentów do księgowej (15. dzień miesiąca).`}
        </span>
        {unsentCount > 0 && (
          <span className="ml-2 text-yellow-700 dark:text-yellow-300">
            Masz <strong>{unsentCount}</strong> {unsentCount === 1 ? "niewysłaną fakturę" : unsentCount < 5 ? "niewysłane faktury" : "niewysłanych faktur"} za {getMonthName(prevMonth)} {prevYear}.
          </span>
        )}
      </div>
      <Button size="icon" variant="ghost" onClick={handleDismiss} data-testid="button-dismiss-banner">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function CostInvoicesTab() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<CostInvoice | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadComment, setUploadComment] = useState("");
  const [uploadDate, setUploadDate] = useState("");
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [lastCreatedInvoice, setLastCreatedInvoice] = useState<CostInvoice | null>(null);
  const [expenseCategory, setExpenseCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseRecurrence, setExpenseRecurrence] = useState<string>("");
  const [expenseRecurrenceEnd, setExpenseRecurrenceEnd] = useState("");
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  const { data: invoices = [], isLoading } = useQuery<CostInvoice[]>({ queryKey: ["/api/cost-invoices"] });
  const { data: downloadHistory = [] } = useQuery<ZipDownloadHistory[]>({ queryKey: ["/api/zip-download-history"] });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const resp = await fetch("/api/cost-invoices", { method: "POST", body: formData, credentials: "include" });
      if (!resp.ok) { const e = await resp.json(); throw new Error(e.message || "Błąd uploadu"); }
      return resp.json();
    },
    onSuccess: (data: CostInvoice) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-invoices"] });
      setLastCreatedInvoice(data);
      setShowUploadDialog(false);
      setUploadFiles([]);
      setUploadComment("");
      setUploadDate("");
      setShowExpenseDialog(true);
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/cost-invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-invoices"] });
      toast({ title: "Usunięto fakturę" });
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) =>
      apiRequest("PATCH", `/api/cost-invoices/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cost-invoices"] }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: number[]; status: string }) =>
      apiRequest("PATCH", "/api/cost-invoices/bulk-status", { ids, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-invoices"] });
      setSelectedIds(new Set());
      toast({ title: "Statusy zaktualizowane" });
    },
  });

  const linkExpenseMutation = useMutation({
    mutationFn: async (data: { invoiceId: number; category: string; description: string; amount: string; date: string; recurrenceType?: string | null; recurrenceEndDate?: string | null }) => {
      const expensePayload: any = {
        date: data.date,
        category: data.category,
        amount: data.amount,
        description: data.description,
        type: "VARIABLE",
      };
      if (data.recurrenceType) {
        expensePayload.recurrenceType = data.recurrenceType;
        expensePayload.recurrenceEndDate = data.recurrenceEndDate;
      }
      const expense = await apiRequest("POST", "/api/expenses", expensePayload);
      const expenseData = expense as any;
      await apiRequest("PATCH", `/api/cost-invoices/${data.invoiceId}`, { linkedExpenseId: expenseData.id });
      return expenseData;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      setShowExpenseDialog(false);
      setLastCreatedInvoice(null);
      setExpenseRecurrence("");
      setExpenseRecurrenceEnd("");
      const msg = variables.recurrenceType
        ? "Koszt cykliczny dodany i powiązany z fakturą"
        : "Koszt dodany i powiązany z fakturą";
      toast({ title: msg });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const handleFilesDrop = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f =>
      ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"].includes(f.type)
    );
    if (arr.length === 0) {
      toast({ title: "Niedozwolony format", description: "Dozwolone: PDF, PNG, JPG, WEBP", variant: "destructive" });
      return;
    }
    setUploadFiles(arr);
    const suggestedDate = extractDateFromFilename(arr[0].name);
    setUploadDate(suggestedDate || new Date().toISOString().slice(0, 10));
    setUploadComment("");
    setShowUploadDialog(true);
  }, [toast]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesDrop(e.dataTransfer.files);
  }, [handleFilesDrop]);

  const handleUpload = async () => {
    for (const file of uploadFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("invoiceDate", uploadDate);
      formData.append("comment", uploadComment);
      await uploadMutation.mutateAsync(formData);
    }
  };

  const handleZipDownload = async () => {
    if (selectedIds.size === 0) {
      toast({ title: "Zaznacz faktury", description: "Wybierz faktury do pobrania", variant: "destructive" });
      return;
    }
    try {
      const resp = await fetch("/api/cost-invoices/download-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selectedIds] }),
        credentials: "include",
      });
      if (!resp.ok) throw new Error("Błąd pobierania ZIP");
      const blob = await resp.blob();
      const cd = resp.headers.get("Content-Disposition");
      let fn = "faktury_kosztowe.zip";
      if (cd) { const m = cd.match(/filename="?([^"]+)"?/); if (m) fn = m[1]; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fn;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/cost-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/zip-download-history"] });
      toast({ title: "Paczka ZIP pobrana" });
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    }
  };

  const filteredInvoices = useMemo(() => {
    let result = invoices;
    if (statusFilter !== "ALL") result = result.filter(i => i.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.originalFileName.toLowerCase().includes(q) ||
        (i.comment || "").toLowerCase().includes(q) ||
        i.uploadedBy.toLowerCase().includes(q)
      );
    }
    return result;
  }, [invoices, statusFilter, searchQuery]);

  const groupedByMonth = useMemo(() => {
    const groups: Record<string, CostInvoice[]> = {};
    for (const inv of filteredInvoices) {
      const key = `${inv.invoiceYear}-${String(inv.invoiceMonth).padStart(2, "0")}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(inv);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredInvoices]);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    const opt = STATUS_OPTIONS.find(s => s.value === status);
    if (!opt) return <Badge variant="secondary">{status}</Badge>;
    return <Badge variant={opt.variant} data-testid={`badge-status-${status}`}>{opt.label}</Badge>;
  };

  const isImage = (mime: string) => mime.startsWith("image/");

  return (
    <div className="space-y-4">
      <DeadlineBanner />

      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-md p-6 text-center transition-colors cursor-pointer ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
        data-testid="dropzone-upload"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          multiple
          onChange={e => { if (e.target.files?.length) handleFilesDrop(e.target.files); e.target.value = ""; }}
          data-testid="input-file-upload"
        />
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Przeciągnij i upuść pliki (PDF, PNG, JPG) lub <span className="text-primary font-medium">kliknij aby wybrać</span>
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie, komentarzu, osobie..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]" data-testid="select-status-filter">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie</SelectItem>
            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>

        {selectedIds.size > 0 && (
          <>
            <Button onClick={handleZipDownload} data-testid="button-download-zip">
              <Package className="h-4 w-4 mr-1" />
              Pobierz ZIP ({selectedIds.size})
            </Button>
            <Select onValueChange={val => bulkStatusMutation.mutate({ ids: [...selectedIds], status: val })}>
              <SelectTrigger className="w-[160px]" data-testid="select-bulk-status">
                <SelectValue placeholder="Zmień status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}

        <Button variant="outline" onClick={() => setShowHistoryPanel(!showHistoryPanel)} data-testid="button-toggle-history">
          <History className="h-4 w-4 mr-1" />
          Historia wysyłek
        </Button>
      </div>

      {/* Download History Panel */}
      {showHistoryPanel && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Historia pobrań ZIP
            </CardTitle>
          </CardHeader>
          <CardContent>
            {downloadHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak historii pobrań</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data pobrania</TableHead>
                    <TableHead>Miesiąc</TableHead>
                    <TableHead>Pobrał</TableHead>
                    <TableHead>Liczba faktur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {downloadHistory.slice(0, 20).map(h => (
                    <TableRow key={h.id} data-testid={`row-history-${h.id}`}>
                      <TableCell>{formatDateTime(h.downloadedAt)}</TableCell>
                      <TableCell>{getMonthName(h.month)} {h.year}</TableCell>
                      <TableCell>{h.downloadedBy}</TableCell>
                      <TableCell>{h.invoiceCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invoices grouped by month */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : groupedByMonth.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {invoices.length === 0 ? "Brak faktur kosztowych. Przeciągnij pliki powyżej aby dodać." : "Brak faktur pasujących do filtrów."}
          </CardContent>
        </Card>
      ) : (
        groupedByMonth.map(([monthKey, monthInvoices]) => {
          const [y, m] = monthKey.split("-").map(Number);
          const monthSelectedIds = monthInvoices.filter(i => selectedIds.has(i.id));
          const allSelected = monthSelectedIds.length === monthInvoices.length;

          return (
            <MonthGroup
              key={monthKey}
              year={y}
              month={m}
              invoices={monthInvoices}
              selectedIds={selectedIds}
              allSelected={allSelected}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={() => {
                const next = new Set(selectedIds);
                if (allSelected) {
                  monthInvoices.forEach(i => next.delete(i.id));
                } else {
                  monthInvoices.forEach(i => next.add(i.id));
                }
                setSelectedIds(next);
              }}
              onDelete={id => deleteMutation.mutate(id)}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              onPreview={setPreviewInvoice}
              getStatusBadge={getStatusBadge}
              isImage={isImage}
            />
          );
        })
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj fakturę kosztową</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Pliki</Label>
              <div className="text-sm text-muted-foreground mt-1">
                {uploadFiles.map(f => f.name).join(", ")}
              </div>
            </div>
            <div>
              <Label htmlFor="upload-date">Data faktury</Label>
              <Input
                id="upload-date"
                type="date"
                value={uploadDate}
                onChange={e => setUploadDate(e.target.value)}
                data-testid="input-upload-date"
              />
            </div>
            <div>
              <Label htmlFor="upload-comment">Komentarz / opis</Label>
              <Input
                id="upload-comment"
                placeholder="np. Faktura za prąd - grudzień"
                value={uploadComment}
                onChange={e => setUploadComment(e.target.value)}
                data-testid="input-upload-comment"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} data-testid="button-cancel-upload">
              Anuluj
            </Button>
            <Button onClick={handleUpload} disabled={uploadMutation.isPending} data-testid="button-confirm-upload">
              {uploadMutation.isPending ? "Wysyłanie..." : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link to Expense Dialog */}
      <Dialog open={showExpenseDialog} onOpenChange={setShowExpenseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodać jako koszt operacyjny?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Faktura "{lastCreatedInvoice?.originalFileName}" została dodana. Czy chcesz powiązać ją z kosztem w zakładce Koszty operacyjne?
          </p>
          <div className="space-y-4">
            <div>
              <Label>Kategoria kosztu</Label>
              <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                <SelectTrigger data-testid="select-expense-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Opis kosztu</Label>
              <Input
                value={expenseDescription}
                onChange={e => setExpenseDescription(e.target.value)}
                placeholder="np. Faktura za energię elektryczną"
                data-testid="input-expense-description"
              />
            </div>
            <div>
              <Label>Kwota (PLN)</Label>
              <Input
                type="number"
                step="0.01"
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                placeholder="0.00"
                data-testid="input-expense-amount"
              />
            </div>
            <div className="border-t pt-4 mt-2">
              <Label className="text-sm font-medium">Cykliczność kosztu</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Ustaw jeśli ten koszt powtarza się regularnie (np. czynsz, energia)
              </p>
              <Select value={expenseRecurrence || "NONE"} onValueChange={(v) => { if (v === "NONE") { setExpenseRecurrence(""); setExpenseRecurrenceEnd(""); } else { setExpenseRecurrence(v); if (!expenseRecurrenceEnd) { const d = new Date(); d.setFullYear(d.getFullYear() + 1); setExpenseRecurrenceEnd(d.toISOString().slice(0, 10)); } } }}>
                <SelectTrigger data-testid="select-expense-recurrence">
                  <SelectValue placeholder="Brak (jednorazowy)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Brak (jednorazowy)</SelectItem>
                  <SelectItem value="MIESIECZNIE">Co miesiąc</SelectItem>
                  <SelectItem value="KWARTALNIE">Co kwartał</SelectItem>
                  <SelectItem value="ROCZNIE">Co rok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {expenseRecurrence && expenseRecurrence !== "NONE" && (
              <div>
                <Label>Koniec cykliczności</Label>
                <Input
                  type="date"
                  value={expenseRecurrenceEnd}
                  onChange={e => setExpenseRecurrenceEnd(e.target.value)}
                  data-testid="input-expense-recurrence-end"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Przyszłe koszty zostaną automatycznie utworzone jako prognozowane
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowExpenseDialog(false); setLastCreatedInvoice(null); setExpenseRecurrence(""); setExpenseRecurrenceEnd(""); toast({ title: "Faktura dodana bez powiązania z kosztem" }); }}
              data-testid="button-skip-expense"
            >
              Pomiń
            </Button>
            <Button
              onClick={() => {
                if (!lastCreatedInvoice || !expenseAmount) return;
                const recType = expenseRecurrence && expenseRecurrence !== "NONE" ? expenseRecurrence : null;
                if (recType && !expenseRecurrenceEnd) {
                  toast({ title: "Podaj datę końca cykliczności", variant: "destructive" });
                  return;
                }
                linkExpenseMutation.mutate({
                  invoiceId: lastCreatedInvoice.id,
                  category: expenseCategory,
                  description: expenseDescription || lastCreatedInvoice.originalFileName,
                  amount: expenseAmount,
                  date: lastCreatedInvoice.invoiceDate,
                  recurrenceType: recType,
                  recurrenceEndDate: recType ? expenseRecurrenceEnd : null,
                });
              }}
              disabled={linkExpenseMutation.isPending || !expenseAmount}
              data-testid="button-link-expense"
            >
              {linkExpenseMutation.isPending ? "Zapisywanie..." : "Dodaj koszt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewInvoice} onOpenChange={() => setPreviewInvoice(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewInvoice?.originalFileName}</DialogTitle>
          </DialogHeader>
          {previewInvoice && (
            <div className="overflow-auto max-h-[60vh]">
              {isImage(previewInvoice.mimeType) ? (
                <img
                  src={`/api/cost-invoices/${previewInvoice.id}/file`}
                  alt={previewInvoice.originalFileName}
                  className="max-w-full rounded-md"
                />
              ) : (
                <iframe
                  src={`/api/cost-invoices/${previewInvoice.id}/file`}
                  className="w-full h-[55vh] rounded-md border"
                  title={previewInvoice.originalFileName}
                />
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewInvoice(null)}>Zamknij</Button>
            <Button asChild>
              <a href={`/api/cost-invoices/${previewInvoice?.id}/file?download=true`} download data-testid="button-download-preview">
                <Download className="h-4 w-4 mr-1" /> Pobierz
              </a>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MonthGroup({
  year, month, invoices, selectedIds, allSelected,
  onToggleSelect, onToggleSelectAll, onDelete, onStatusChange, onPreview, getStatusBadge, isImage
}: {
  year: number; month: number; invoices: CostInvoice[];
  selectedIds: Set<number>; allSelected: boolean;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onDelete: (id: number) => void;
  onStatusChange: (id: number, status: string) => void;
  onPreview: (inv: CostInvoice) => void;
  getStatusBadge: (s: string) => JSX.Element;
  isImage: (mime: string) => boolean;
}) {
  const [open, setOpen] = useState(true);
  const newCount = invoices.filter(i => i.status === "NOWA").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer flex flex-row items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{getMonthName(month)} {year}</CardTitle>
              <Badge variant="secondary" className="text-xs">{invoices.length}</Badge>
              {newCount > 0 && <Badge variant="default" className="text-xs">{newCount} nowych</Badge>}
            </div>
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={onToggleSelectAll}
                      data-testid={`checkbox-select-all-${year}-${month}`}
                    />
                  </TableHead>
                  <TableHead>Plik</TableHead>
                  <TableHead>Data faktury</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dodał</TableHead>
                  <TableHead>Dodano</TableHead>
                  <TableHead>Komentarz</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id} data-testid={`row-invoice-${inv.id}`}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(inv.id)}
                        onCheckedChange={() => onToggleSelect(inv.id)}
                        data-testid={`checkbox-invoice-${inv.id}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isImage(inv.mimeType) ? (
                          <div className="w-8 h-8 rounded overflow-hidden border shrink-0">
                            <img
                              src={`/api/cost-invoices/${inv.id}/file`}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <FileText className="h-5 w-5 text-red-500 shrink-0" />
                        )}
                        <span className="text-sm truncate max-w-[200px]" title={inv.originalFileName} data-testid={`text-filename-${inv.id}`}>
                          {inv.originalFileName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell>
                      <Select value={inv.status} onValueChange={val => onStatusChange(inv.id, val)}>
                        <SelectTrigger className="w-[130px] h-8" data-testid={`select-status-${inv.id}`}>
                          <SelectValue>{getStatusBadge(inv.status)}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-sm">{inv.uploadedBy}</TableCell>
                    <TableCell className="text-sm">{formatDateTime(inv.uploadedAt)}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate" title={inv.comment || ""}>
                      {inv.comment || "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => onPreview(inv)} data-testid={`button-preview-${inv.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" asChild>
                          <a href={`/api/cost-invoices/${inv.id}/file?download=true`} download data-testid={`button-download-${inv.id}`}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => onDelete(inv.id)} data-testid={`button-delete-${inv.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function AccountingNotesTab() {
  const { data: notes = [], isLoading } = useQuery<AccountingNote[]>({ queryKey: ["/api/accounting-notes"] });
  const { data: subleases = [] } = useQuery<Sublease[]>({ queryKey: ["/api/subleases"] });

  const getSubleaseName = (subleaseId: number) => {
    const sub = subleases.find(s => s.id === subleaseId);
    if (!sub) return `#${subleaseId}`;
    if (sub.tenantType === "firma") return sub.companyName || `#${subleaseId}`;
    return `${sub.firstName || ""} ${sub.lastName || ""}`.trim() || `#${subleaseId}`;
  };

  const handleDownload = async (noteId: number) => {
    const response = await fetch(`/api/accounting-notes/${noteId}/download`, { credentials: "include" });
    if (!response.ok) return;
    const blob = await response.blob();
    const cd = response.headers.get("Content-Disposition");
    let fn = "nota_ksiegowa.pdf";
    if (cd) { const m = cd.match(/filename="?([^"]+)"?/); if (m) fn = decodeURIComponent(m[1]); }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = fn;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Brak not księgowych. Noty generowane są automatycznie przy rozliczeniach mediów w zakładce Podnajem.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numer noty</TableHead>
              <TableHead>Podnajem</TableHead>
              <TableHead>Plik</TableHead>
              <TableHead>Data wygenerowania</TableHead>
              <TableHead className="text-right">Akcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notes.map(note => (
              <TableRow key={note.id} data-testid={`row-note-${note.id}`}>
                <TableCell className="font-medium">{note.noteNumber}</TableCell>
                <TableCell>{getSubleaseName(note.subleaseId)}</TableCell>
                <TableCell className="text-sm">{note.fileName}</TableCell>
                <TableCell>{formatDateTime(note.generatedAt)}</TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => handleDownload(note.id)} data-testid={`button-download-note-${note.id}`}>
                    <Download className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function DokumentyKsiegowe() {
  return (
    <div>
      <PageHeader
        title="Dokumenty księgowe"
        description="Faktury kosztowe i noty księgowe w jednym miejscu"
      />
      <Tabs defaultValue="faktury" className="mt-4">
        <TabsList data-testid="tabs-documents">
          <TabsTrigger value="faktury" data-testid="tab-faktury">Faktury kosztowe</TabsTrigger>
          <TabsTrigger value="noty" data-testid="tab-noty">Noty księgowe</TabsTrigger>
        </TabsList>
        <TabsContent value="faktury" className="mt-4">
          <CostInvoicesTab />
        </TabsContent>
        <TabsContent value="noty" className="mt-4">
          <AccountingNotesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
