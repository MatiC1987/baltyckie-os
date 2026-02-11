import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Search, Trash2, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, X, Pencil, Tag, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  const [editEntry, setEditEntry] = useState<SaldoEntry | null>(null);
  const [editForm, setEditForm] = useState({
    date: "", operationName: "", reservationNumber: "", guestName: "",
    type: "", paymentMethod: "", kasaFiskalna: "NIE", faktura: "NIE",
    cashAmount: "", saldo: "", cardAmount: "", authCode: "", notes: "",
    entryKind: "PRZYCHOD" as string, category: "",
  });
  const [activeTab, setActiveTab] = useState<"wpisy" | "kategorie">("wpisy");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

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
    entryKind: "PRZYCHOD" as string,
    category: "",
  });

  const { data: entries = [], isLoading } = useQuery<SaldoEntry[]>({
    queryKey: ["/api/saldo"],
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["/api/saldo/categories"],
  });

  const renameCategoryMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      apiRequest("PUT", `/api/saldo/categories/${encodeURIComponent(oldName)}`, { newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saldo"] });
      toast({ title: "Zmieniono nazwę kategorii" });
      setEditingCat(null);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (name: string) => apiRequest("DELETE", `/api/saldo/categories/${encodeURIComponent(name)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saldo"] });
      toast({ title: "Usunięto kategorię" });
    },
  });

  const bulkDeleteCategoryMutation = useMutation({
    mutationFn: (names: string[]) => apiRequest("POST", "/api/saldo/categories/bulk-delete", { names }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/saldo"] });
      setSelectedCats(new Set());
      toast({ title: "Usunięto wybrane kategorie" });
    },
  });

  const [newCatName, setNewCatName] = useState("");
  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => apiRequest("POST", "/api/saldo/categories", { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories"] });
      toast({ title: "Dodano kategorię" });
      setNewCatName("");
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/saldo", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo"] });
      toast({ title: "Dodano wpis" });
      setShowAddDialog(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/saldo/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo"] });
      toast({ title: "Zapisano zmiany" });
      setEditEntry(null);
      setPreviewEntry(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/saldo/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo"] });
      toast({ title: "Usunięto wpis" });
    },
  });

  const openEdit = (entry: SaldoEntry) => {
    setEditForm({
      date: entry.date || "",
      operationName: entry.operationName || "",
      reservationNumber: entry.reservationNumber || "",
      guestName: entry.guestName || "",
      type: entry.type || "",
      paymentMethod: entry.paymentMethod || "",
      kasaFiskalna: entry.kasaFiskalna || "NIE",
      faktura: entry.faktura || "NIE",
      cashAmount: entry.cashAmount || "",
      saldo: entry.saldo || "",
      cardAmount: entry.cardAmount || "",
      authCode: entry.authCode || "",
      notes: entry.notes || "",
      entryKind: entry.entryKind || "PRZYCHOD",
      category: entry.category || "",
    });
    setEditEntry(entry);
  };

  const handleSaveEdit = () => {
    if (!editEntry) return;
    const data: any = {
      date: editForm.date,
      operationName: editForm.operationName,
      reservationNumber: editForm.reservationNumber || null,
      guestName: editForm.guestName || null,
      type: editForm.type || null,
      paymentMethod: editForm.paymentMethod || null,
      kasaFiskalna: editForm.kasaFiskalna || null,
      faktura: editForm.faktura || null,
      cashAmount: editForm.cashAmount ? parseFloat(editForm.cashAmount).toFixed(2) : null,
      saldo: editForm.saldo ? parseFloat(editForm.saldo).toFixed(2) : null,
      cardAmount: editForm.cardAmount ? parseFloat(editForm.cardAmount).toFixed(2) : null,
      authCode: editForm.authCode || null,
      notes: editForm.notes || null,
      entryKind: editForm.entryKind || null,
      category: editForm.entryKind === "KOSZT" ? (editForm.category || null) : null,
    };
    updateMutation.mutate({ id: editEntry.id, data });
  };

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
    let result = [...entries];
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
    result.reverse();
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
    const newestEntry = entries.length > 0 ? entries[entries.length - 1] : null;
    const lastSaldo = newestEntry ? parseFloat(newestEntry.saldo || "0") : 0;
    return { totalCash, totalCard, lastSaldo, count: filtered.length };
  }, [filtered, entries]);

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
      cashAmount: newEntry.cashAmount ? (newEntry.entryKind === "KOSZT" ? (-Math.abs(parseFloat(newEntry.cashAmount))).toFixed(2) : parseFloat(newEntry.cashAmount).toFixed(2)) : null,
      cardAmount: newEntry.cardAmount ? (newEntry.entryKind === "KOSZT" ? (-Math.abs(parseFloat(newEntry.cardAmount))).toFixed(2) : parseFloat(newEntry.cardAmount).toFixed(2)) : null,
      authCode: newEntry.authCode || null,
      notes: newEntry.notes || null,
      saldo: null,
      entryKind: newEntry.entryKind || null,
      category: newEntry.entryKind === "KOSZT" ? (newEntry.category || null) : null,
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
          <div className="flex items-center border border-border rounded-md overflow-visible">
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "wpisy" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setActiveTab("wpisy")}
              data-testid="tab-saldo-wpisy"
            >
              Wpisy
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "kategorie" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setActiveTab("kategorie")}
              data-testid="tab-saldo-kategorie"
            >
              <Tag className="h-3.5 w-3.5 inline mr-1" />Kategorie
            </button>
          </div>
          {activeTab === "wpisy" && (
            <>
              <Button variant="outline" onClick={() => setShowAddDialog(true)} data-testid="button-add-saldo">
                <Plus className="mr-1 h-4 w-4" /> Dodaj wpis
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)} data-testid="button-import-saldo">
                <Upload className="mr-1 h-4 w-4" /> Import Excel
              </Button>
            </>
          )}
        </div>
      </div>

      {activeTab === "kategorie" && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">

              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Nazwa nowej kategorii"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newCatName.trim()) createCategoryMutation.mutate(newCatName.trim()); }}
                  className="max-w-xs"
                  data-testid="input-new-category"
                />
                <Button
                  size="sm"
                  onClick={() => { if (newCatName.trim()) createCategoryMutation.mutate(newCatName.trim()); }}
                  disabled={!newCatName.trim() || createCategoryMutation.isPending}
                  data-testid="button-add-category"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Dodaj kategorię
                </Button>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-muted-foreground">Lista kategorii. Możesz zmienić nazwę lub usunąć kategorie.</p>
                {selectedCats.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Usunąć ${selectedCats.size} wybranych kategorii? Kategorie zostaną usunięte ze wszystkich powiązanych wpisów.`))
                        bulkDeleteCategoryMutation.mutate([...selectedCats]);
                    }}
                    disabled={bulkDeleteCategoryMutation.isPending}
                    data-testid="button-bulk-delete-cats"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Usuń zaznaczone ({selectedCats.size})
                  </Button>
                )}
              </div>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Brak kategorii. Dodaj wpis z kategorią, aby pojawiła się tutaj.</p>
              ) : (
                <div className="space-y-0">
                  <div className="flex items-center gap-2 py-1.5 px-2 border-b border-border bg-muted/30">
                    <input
                      type="checkbox"
                      checked={selectedCats.size === categories.length && categories.length > 0}
                      onChange={e => {
                        if (e.target.checked) setSelectedCats(new Set(categories));
                        else setSelectedCats(new Set());
                      }}
                      className="h-4 w-4 rounded border-border"
                      data-testid="checkbox-select-all-cats"
                    />
                    <span className="text-xs text-muted-foreground font-medium">Zaznacz wszystkie ({categories.length})</span>
                  </div>
                  {categories.map(cat => (
                    <div key={cat} className={`flex items-center gap-2 py-1.5 px-2 border-b border-border last:border-b-0 ${selectedCats.has(cat) ? "bg-accent/20" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selectedCats.has(cat)}
                        onChange={e => {
                          const next = new Set(selectedCats);
                          if (e.target.checked) next.add(cat);
                          else next.delete(cat);
                          setSelectedCats(next);
                        }}
                        className="h-4 w-4 rounded border-border"
                        data-testid={`checkbox-cat-${cat}`}
                      />
                      {editingCat === cat ? (
                        <>
                          <Input
                            className="flex-1"
                            value={editingCatName}
                            onChange={e => setEditingCatName(e.target.value)}
                            autoFocus
                            onKeyDown={e => { if (e.key === "Enter" && editingCatName.trim()) renameCategoryMutation.mutate({ oldName: cat, newName: editingCatName.trim() }); }}
                            data-testid={`input-rename-cat-${cat}`}
                          />
                          <Button size="sm" variant="outline" onClick={() => { if (editingCatName.trim()) renameCategoryMutation.mutate({ oldName: cat, newName: editingCatName.trim() }); }} disabled={!editingCatName.trim() || renameCategoryMutation.isPending} data-testid={`button-save-cat-${cat}`}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingCat(null)} data-testid={`button-cancel-cat-${cat}`}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm font-medium" data-testid={`text-cat-${cat}`}>{cat}</span>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingCat(cat); setEditingCatName(cat); }} data-testid={`button-edit-cat-${cat}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Usunąć kategorię "${cat}"? Kategoria zostanie usunięta ze wszystkich wpisów.`)) deleteCategoryMutation.mutate(cat); }} data-testid={`button-delete-cat-${cat}`}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "wpisy" && <>
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <div className="text-sm text-muted-foreground uppercase tracking-wider mb-2">Aktualne saldo</div>
            <div className={`text-4xl font-bold ${summary.lastSaldo >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-saldo-current">{summary.lastSaldo.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
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
            <SelectValue placeholder="Kategoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie kategorie</SelectItem>
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
          <table className="w-full text-xs border-collapse" style={{ minWidth: "1350px" }}>
            <thead className="sticky top-0 z-[100]">
              <tr className="bg-muted/80 dark:bg-muted/50">
                {([
                  { key: "date", label: "Data", cls: "sticky left-0 z-[110] bg-muted/80 dark:bg-muted/50 border-r w-[90px] text-left" },
                  { key: "operationName", label: "Nazwa operacji", cls: "border-r w-[200px] text-left" },
                  { key: "reservationNumber", label: "Nr rez.", cls: "border-r w-[80px] text-left" },
                  { key: "guestName", label: "Imię i nazwisko", cls: "border-r w-[180px] text-left" },
                  { key: "type", label: "Kategoria", cls: "border-r w-[130px] text-left" },
                  { key: "paymentMethod", label: "Płatność", cls: "border-r w-[90px] text-left" },
                  { key: "kasaFiskalna", label: "KF", cls: "border-r w-[50px] text-center" },
                  { key: "faktura", label: "FV", cls: "border-r w-[50px] text-center" },
                  { key: "cashAmount", label: "Suma (got.)", cls: "border-r-2 w-[100px] text-right" },
                  { key: "saldo", label: "Saldo", cls: "border-r-2 w-[100px] text-right" },
                  { key: "authCode", label: "Kod aut.", cls: "border-r w-[80px] text-left" },
                  { key: "cardAmount", label: "Kwota kartą", cls: "border-r w-[100px] text-right" },
                  { key: "notes", label: "Uwagi", cls: "border-r text-left" },
                ] as const).map(col => (
                  <th
                    key={col.key}
                    className={`border-b border-border px-2 py-2 font-bold select-none ${col.cls}`}
                    data-testid={`header-saldo-${col.key}`}
                  >
                    {col.label}
                  </th>
                ))}
                <th className="border-b border-border px-2 py-2 text-center font-bold w-[65px]"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((entry, idx) => {
                const cashVal = entry.cashAmount ? parseFloat(entry.cashAmount) : null;
                return (
                  <tr
                    key={entry.id}
                    className={`group hover:bg-accent/30 cursor-pointer ${entry.operationName === "SALDO POCZĄTKOWE" ? "bg-blue-50 dark:bg-blue-950/30 font-semibold" : entry.entryKind === "KOSZT" || (cashVal !== null && cashVal < 0) ? "bg-red-50 dark:bg-red-950/20" : idx % 2 === 0 ? "" : "bg-muted/20 dark:bg-muted/10"}`}
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
                          onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                          className="invisible group-hover:visible text-muted-foreground hover:text-foreground p-0.5"
                          data-testid={`button-edit-saldo-${entry.id}`}
                        >
                          <Pencil className="h-3 w-3" />
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
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            Strona {page + 1} z {totalPages} ({filtered.length} wpisów)
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(0)} data-testid="button-saldo-first-page">
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="button-saldo-prev-page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 mx-1">
              <Input
                type="number"
                min={1}
                max={totalPages}
                value={page + 1}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val <= totalPages) setPage(val - 1);
                }}
                className="w-16 text-center"
                data-testid="input-saldo-go-to-page"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">z {totalPages}</span>
            </div>
            <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-saldo-next-page">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} data-testid="button-saldo-last-page">
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      </>}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dodaj wpis do salda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Label className="shrink-0">Typ wpisu:</Label>
              <div className="flex items-center border border-border rounded-md overflow-visible">
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${newEntry.entryKind === "PRZYCHOD" ? "bg-green-600 text-white" : "hover:bg-muted"}`}
                  onClick={() => setNewEntry(p => ({ ...p, entryKind: "PRZYCHOD" }))}
                  data-testid="toggle-new-przychod"
                >
                  Przychód
                </button>
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${newEntry.entryKind === "KOSZT" ? "bg-red-600 text-white" : "hover:bg-muted"}`}
                  onClick={() => setNewEntry(p => ({ ...p, entryKind: "KOSZT" }))}
                  data-testid="toggle-new-koszt"
                >
                  Koszt
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={newEntry.date} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} data-testid="input-new-saldo-date" />
              </div>
              <div className="space-y-1">
                <Label>Nazwa operacji</Label>
                <Input value={newEntry.operationName} onChange={e => setNewEntry(p => ({ ...p, operationName: e.target.value }))} placeholder={newEntry.entryKind === "PRZYCHOD" ? "np. GRAND BALTIC 203" : "np. Zakup środków czystości"} data-testid="input-new-saldo-op" />
              </div>
              {newEntry.entryKind === "KOSZT" && (
                <div className="col-span-2 space-y-1">
                  <Label>Kategoria kosztu</Label>
                  <Select value={newEntry.category || "none"} onValueChange={v => setNewEntry(p => ({ ...p, category: v === "none" ? "" : v }))}>
                    <SelectTrigger data-testid="select-new-saldo-category">
                      <SelectValue placeholder="Wybierz kategorię" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— brak —</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label>Imię i nazwisko</Label>
                <Input value={newEntry.guestName} onChange={e => setNewEntry(p => ({ ...p, guestName: e.target.value }))} data-testid="input-new-saldo-guest" />
              </div>
              {newEntry.entryKind === "PRZYCHOD" && (
                <div className="space-y-1">
                  <Label>Nr rezerwacji</Label>
                  <Input value={newEntry.reservationNumber} onChange={e => setNewEntry(p => ({ ...p, reservationNumber: e.target.value }))} data-testid="input-new-saldo-resnum" />
                </div>
              )}
              <div className="space-y-1">
                <Label>Kategoria</Label>
                <Input value={newEntry.type} onChange={e => setNewEntry(p => ({ ...p, type: e.target.value }))} placeholder={newEntry.entryKind === "PRZYCHOD" ? "np. PRZYJAZD" : "np. WYDATEK"} data-testid="input-new-saldo-type" />
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
              { label: "Typ wpisu", value: previewEntry.entryKind === "KOSZT" ? "Koszt" : "Przychód", highlight: previewEntry.entryKind === "KOSZT" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400" },
              ...(previewEntry.entryKind === "KOSZT" && previewEntry.category ? [{ label: "Kategoria", value: previewEntry.category }] : []),
              { label: "Data", value: formatDate(previewEntry.date) },
              { label: "Nazwa operacji", value: previewEntry.operationName || "" },
              { label: "Nr rezerwacji", value: previewEntry.reservationNumber || "" },
              { label: "Imię i nazwisko", value: previewEntry.guestName || "" },
              { label: "Kategoria", value: previewEntry.type || "" },
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
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewEntry(null)} data-testid="button-close-saldo-preview">
              Zamknij
            </Button>
            <Button onClick={() => { if (previewEntry) { openEdit(previewEntry); setPreviewEntry(null); } }} data-testid="button-edit-from-preview">
              <Pencil className="mr-1 h-4 w-4" /> Edytuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEntry} onOpenChange={(open) => { if (!open) setEditEntry(null); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-saldo-edit">
          <DialogHeader>
            <DialogTitle>Edytuj wpis</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Label className="shrink-0">Typ wpisu:</Label>
              <div className="flex items-center border border-border rounded-md overflow-visible">
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${editForm.entryKind === "PRZYCHOD" ? "bg-green-600 text-white" : "hover:bg-muted"}`}
                  onClick={() => setEditForm(p => ({ ...p, entryKind: "PRZYCHOD" }))}
                  data-testid="toggle-edit-przychod"
                >
                  Przychód
                </button>
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${editForm.entryKind === "KOSZT" ? "bg-red-600 text-white" : "hover:bg-muted"}`}
                  onClick={() => setEditForm(p => ({ ...p, entryKind: "KOSZT" }))}
                  data-testid="toggle-edit-koszt"
                >
                  Koszt
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} data-testid="input-edit-saldo-date" />
              </div>
              <div className="space-y-1">
                <Label>Nazwa operacji</Label>
                <Input value={editForm.operationName} onChange={e => setEditForm(p => ({ ...p, operationName: e.target.value }))} data-testid="input-edit-saldo-op" />
              </div>
              {editForm.entryKind === "KOSZT" && (
                <div className="col-span-2 space-y-1">
                  <Label>Kategoria kosztu</Label>
                  <Select value={editForm.category || "none"} onValueChange={v => setEditForm(p => ({ ...p, category: v === "none" ? "" : v }))}>
                    <SelectTrigger data-testid="select-edit-saldo-category">
                      <SelectValue placeholder="Wybierz kategorię" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— brak —</SelectItem>
                      {categories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label>Imię i nazwisko</Label>
                <Input value={editForm.guestName} onChange={e => setEditForm(p => ({ ...p, guestName: e.target.value }))} data-testid="input-edit-saldo-guest" />
              </div>
              {editForm.entryKind === "PRZYCHOD" && (
                <div className="space-y-1">
                  <Label>Nr rezerwacji</Label>
                  <Input value={editForm.reservationNumber} onChange={e => setEditForm(p => ({ ...p, reservationNumber: e.target.value }))} data-testid="input-edit-saldo-resnum" />
                </div>
              )}
              <div className="space-y-1">
                <Label>Kategoria</Label>
                <Input value={editForm.type} onChange={e => setEditForm(p => ({ ...p, type: e.target.value }))} data-testid="input-edit-saldo-type" />
              </div>
              <div className="space-y-1">
                <Label>Sposób płatności</Label>
                <Select value={editForm.paymentMethod || "none"} onValueChange={v => setEditForm(p => ({ ...p, paymentMethod: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-edit-saldo-payment">
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
                <Input type="number" step="0.01" value={editForm.cashAmount} onChange={e => setEditForm(p => ({ ...p, cashAmount: e.target.value }))} data-testid="input-edit-saldo-cash" />
              </div>
              <div className="space-y-1">
                <Label>Saldo</Label>
                <Input type="number" step="0.01" value={editForm.saldo} onChange={e => setEditForm(p => ({ ...p, saldo: e.target.value }))} data-testid="input-edit-saldo-saldo" />
              </div>
              <div className="space-y-1">
                <Label>Kwota kartą</Label>
                <Input type="number" step="0.01" value={editForm.cardAmount} onChange={e => setEditForm(p => ({ ...p, cardAmount: e.target.value }))} data-testid="input-edit-saldo-card" />
              </div>
              <div className="space-y-1">
                <Label>Kod autoryzacji</Label>
                <Input value={editForm.authCode} onChange={e => setEditForm(p => ({ ...p, authCode: e.target.value }))} data-testid="input-edit-saldo-auth" />
              </div>
              <div className="space-y-1">
                <Label>Kasa fiskalna</Label>
                <Select value={editForm.kasaFiskalna} onValueChange={v => setEditForm(p => ({ ...p, kasaFiskalna: v }))}>
                  <SelectTrigger data-testid="select-edit-saldo-kf">
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
                <Select value={editForm.faktura} onValueChange={v => setEditForm(p => ({ ...p, faktura: v }))}>
                  <SelectTrigger data-testid="select-edit-saldo-fv">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAK">TAK</SelectItem>
                    <SelectItem value="NIE">NIE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Uwagi</Label>
                <Input value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} data-testid="input-edit-saldo-notes" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditEntry(null)} data-testid="button-cancel-edit-saldo">
              Anuluj
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editForm.operationName.trim() || !editForm.date || updateMutation.isPending} data-testid="button-save-edit-saldo">
              {updateMutation.isPending ? "Zapisywanie..." : "Zapisz zmiany"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
