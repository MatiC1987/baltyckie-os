import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Plus, Trash2, Edit, Loader2, Tag, Pencil, Check, X, ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, ChevronDown, ChevronUp } from "lucide-react";

function formatNum(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = parseFloat(v);
  if (isNaN(n)) return "";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type SortField = "date" | "operationName" | "category" | "cashAmount" | "cardAmount";
type SortDir = "asc" | "desc";

export default function RecepcjaSaldo() {
  const [activeTab, setActiveTab] = useState<"wpisy" | "kategorie">("wpisy");
  const [showAdd, setShowAdd] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [newCatName, setNewCatName] = useState("");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterEntryKind, setFilterEntryKind] = useState<"ALL" | "PRZYCHOD" | "KOSZT">("ALL");
  const [filterCategory, setFilterCategory] = useState<string>("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/saldo"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/saldo"); return r.json(); },
  });

  const { data: initialBalance } = useQuery({
    queryKey: ["/api/recepcja/saldo/initial-balance"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/saldo/initial-balance"); return r.json(); },
  });

  const { data: categoriesRaw = [] } = useQuery<any[]>({
    queryKey: ["/api/recepcja/saldo/categories"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/saldo/categories"); return r.json(); },
  });

  const categories = useMemo(() => categoriesRaw.map((c: any) => typeof c === "string" ? c : c.name), [categoriesRaw]);

  const usedCategories = useMemo(() => {
    const cats = new Set<string>();
    entries.forEach((e: any) => { if (e.category) cats.add(e.category); if (e.type) cats.add(e.type); });
    return [...cats].sort();
  }, [entries]);

  const currentBalance = (Number(initialBalance?.initialBalance || 0) +
    entries.reduce((sum: number, e: any) => sum + Number(e.cashAmount || 0), 0)).toFixed(2);

  const filteredAndSorted = useMemo(() => {
    let result = [...entries];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((e: any) =>
        (e.operationName || "").toLowerCase().includes(q) ||
        (e.guestName || "").toLowerCase().includes(q) ||
        (e.reservationNumber || "").toLowerCase().includes(q) ||
        (e.notes || "").toLowerCase().includes(q)
      );
    }

    if (filterDateFrom) {
      result = result.filter((e: any) => e.date >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter((e: any) => e.date <= filterDateTo);
    }

    if (filterEntryKind !== "ALL") {
      result = result.filter((e: any) => e.entryKind === filterEntryKind);
    }

    if (filterCategory !== "ALL") {
      result = result.filter((e: any) => (e.category || e.type) === filterCategory);
    }

    result.sort((a: any, b: any) => {
      let cmp = 0;
      switch (sortField) {
        case "date":
          cmp = (a.date || "").localeCompare(b.date || "");
          break;
        case "operationName":
          cmp = (a.operationName || "").localeCompare(b.operationName || "");
          break;
        case "category":
          cmp = (a.category || a.type || "").localeCompare(b.category || b.type || "");
          break;
        case "cashAmount":
          cmp = (Number(a.cashAmount || 0)) - (Number(b.cashAmount || 0));
          break;
        case "cardAmount":
          cmp = (Number(a.cardAmount || 0)) - (Number(b.cardAmount || 0));
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [entries, searchQuery, filterDateFrom, filterDateTo, filterEntryKind, filterCategory, sortField, sortDir]);

  const hasActiveFilters = searchQuery || filterDateFrom || filterDateTo || filterEntryKind !== "ALL" || filterCategory !== "ALL";

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await recepcjaFetch("POST", "/api/recepcja/saldo", data);
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo"] });
      setShowAdd(false);
      toast({ title: "Dodano wpis" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/saldo/${id}`, data);
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo"] });
      setEditEntry(null);
      toast({ title: "Zaktualizowano wpis" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await recepcjaFetch("DELETE", `/api/recepcja/saldo/${id}`);
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo"] });
      toast({ title: "Usunięto wpis" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const r = await recepcjaFetch("POST", "/api/recepcja/saldo/categories", { name });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo/categories"] });
      toast({ title: "Dodano kategorię" });
      setNewCatName("");
    },
  });

  const renameCategoryMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/saldo/categories/${encodeURIComponent(oldName)}`, { newName });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo"] });
      toast({ title: "Zmieniono nazwę kategorii" });
      setEditingCat(null);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const r = await recepcjaFetch("DELETE", `/api/recepcja/saldo/categories/${encodeURIComponent(name)}`);
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo"] });
      toast({ title: "Usunięto kategorię" });
    },
  });

  const bulkDeleteCategoryMutation = useMutation({
    mutationFn: async (names: string[]) => {
      const r = await recepcjaFetch("POST", "/api/recepcja/saldo/categories/bulk-delete", { names });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo"] });
      setSelectedCats(new Set());
      toast({ title: "Usunięto wybrane kategorie" });
    },
  });

  const clearFilters = () => {
    setSearchQuery("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterEntryKind("ALL");
    setFilterCategory("ALL");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-recepcja-saldo-title">Saldo</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-border rounded-md overflow-visible">
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "wpisy" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setActiveTab("wpisy")}
              data-testid="tab-recepcja-saldo-wpisy"
            >
              Wpisy
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "kategorie" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setActiveTab("kategorie")}
              data-testid="tab-recepcja-saldo-kategorie"
            >
              <Tag className="h-3.5 w-3.5 inline mr-1" />Kategorie
            </button>
          </div>
          {activeTab === "wpisy" && (
            <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-saldo-add">
              <Plus className="h-4 w-4 mr-1" /> Dodaj wpis
            </Button>
          )}
        </div>
      </div>

      {activeTab === "wpisy" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Saldo początkowe</div>
              <div className="text-xl font-bold">{formatNum(String(initialBalance?.initialBalance || 0))} PLN</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground">Saldo bieżące</div>
              <div className={`text-xl font-bold ${Number(currentBalance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatNum(currentBalance)} PLN
              </div>
            </Card>
          </div>

          <Card className="p-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Szukaj po nazwie, gościu, nr rezerwacji..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-saldo-search"
                />
              </div>
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                data-testid="button-toggle-filters"
              >
                <Filter className="h-4 w-4 mr-1" />
                Filtry
                {hasActiveFilters && <span className="ml-1 h-2 w-2 rounded-full bg-primary inline-block" />}
                {showFilters ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
              </Button>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-3.5 w-3.5 mr-1" /> Wyczyść
                </Button>
              )}
            </div>

            {showFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-3 pt-3 border-t">
                <div className="space-y-1">
                  <Label className="text-xs">Data od</Label>
                  <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} data-testid="input-filter-date-from" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data do</Label>
                  <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} data-testid="input-filter-date-to" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Typ wpisu</Label>
                  <Select value={filterEntryKind} onValueChange={(v: any) => setFilterEntryKind(v)}>
                    <SelectTrigger data-testid="select-filter-entry-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Wszystkie</SelectItem>
                      <SelectItem value="PRZYCHOD">Przychody</SelectItem>
                      <SelectItem value="KOSZT">Koszty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kategoria</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger data-testid="select-filter-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Wszystkie</SelectItem>
                      {usedCategories.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              {hasActiveFilters && (
                <div className="text-sm text-muted-foreground">
                  Wyświetlono {filteredAndSorted.length} z {entries.length} wpisów
                </div>
              )}
              <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("date")} data-testid="th-sort-date">
                        <div className="flex items-center">Data<SortIcon field="date" /></div>
                      </th>
                      <th className="p-2 text-left cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("operationName")} data-testid="th-sort-operation">
                        <div className="flex items-center">Operacja<SortIcon field="operationName" /></div>
                      </th>
                      <th className="p-2 text-left cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("category")} data-testid="th-sort-category">
                        <div className="flex items-center">Kategoria<SortIcon field="category" /></div>
                      </th>
                      <th className="p-2 text-right cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("cashAmount")} data-testid="th-sort-cash">
                        <div className="flex items-center justify-end">Gotówka<SortIcon field="cashAmount" /></div>
                      </th>
                      <th className="p-2 text-right cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("cardAmount")} data-testid="th-sort-card">
                        <div className="flex items-center justify-end">Karta<SortIcon field="cardAmount" /></div>
                      </th>
                      <th className="p-2 text-left">Wprowadził</th>
                      <th className="p-2 text-center w-20">Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAndSorted.map((e: any) => (
                      <tr key={e.id} className="border-b hover:bg-muted/30" data-testid={`row-saldo-${e.id}`}>
                        <td className="p-2 whitespace-nowrap">{e.date}</td>
                        <td className="p-2">{e.operationName}</td>
                        <td className="p-2">
                          <span className={`${e.category || e.type ? '' : 'text-muted-foreground'}`}>
                            {e.category || e.type || '-'}
                          </span>
                        </td>
                        <td className={`p-2 text-right ${Number(e.cashAmount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatNum(e.cashAmount)}
                        </td>
                        <td className="p-2 text-right text-muted-foreground">{formatNum(e.cardAmount)}</td>
                        <td className="p-2 text-muted-foreground text-xs">{e.createdBy || '-'}</td>
                        <td className="p-2 text-center">
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditEntry(e)} data-testid={`button-edit-saldo-${e.id}`}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(e.id)} data-testid={`button-delete-saldo-${e.id}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredAndSorted.length === 0 && (
                      <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">
                        {hasActiveFilters ? "Brak wpisów spełniających kryteria" : "Brak wpisów"}
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </>
      )}

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
                      if (window.confirm(`Usunąć ${selectedCats.size} wybranych kategorii?`))
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
                <p className="text-sm text-muted-foreground py-4 text-center">Brak kategorii. Dodaj nową kategorię powyżej.</p>
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
                  {categories.map((cat: string) => (
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
                          <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Usunąć kategorię "${cat}"?`)) deleteCategoryMutation.mutate(cat); }} data-testid={`button-delete-cat-${cat}`}>
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

      <SaldoEntryDialog
        open={showAdd || !!editEntry}
        onClose={() => { setShowAdd(false); setEditEntry(null); }}
        onSubmit={(data: any) => editEntry ? updateMutation.mutate({ id: editEntry.id, ...data }) : createMutation.mutate(data)}
        entry={editEntry}
        categories={categories}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function SaldoEntryDialog({ open, onClose, onSubmit, entry, categories, isPending }: any) {
  const [form, setForm] = useState({
    date: "",
    operationName: "",
    entryKind: "PRZYCHOD",
    cashAmount: "",
    cardAmount: "",
    category: "",
    guestName: "",
    reservationNumber: "",
    type: "",
    paymentMethod: "",
    kasaFiskalna: "NIE",
    faktura: "NIE",
    authCode: "",
    notes: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        date: entry?.date || new Date().toISOString().slice(0, 10),
        operationName: entry?.operationName || "",
        entryKind: entry?.entryKind || "PRZYCHOD",
        cashAmount: entry?.cashAmount ? String(Math.abs(Number(entry.cashAmount))) : "",
        cardAmount: entry?.cardAmount ? String(Math.abs(Number(entry.cardAmount))) : "",
        category: entry?.category || "",
        guestName: entry?.guestName || "",
        reservationNumber: entry?.reservationNumber || "",
        type: entry?.type || "",
        paymentMethod: entry?.paymentMethod || "",
        kasaFiskalna: entry?.kasaFiskalna || "NIE",
        faktura: entry?.faktura || "NIE",
        authCode: entry?.authCode || "",
        notes: entry?.notes || "",
      });
    }
  }, [open, entry]);

  const u = (field: string, value: string) => setForm(p => ({ ...p, [field]: value }));

  const handleSubmit = () => {
    const cashVal = form.cashAmount ? (form.entryKind === "KOSZT" ? (-Math.abs(Number(form.cashAmount))).toFixed(2) : parseFloat(form.cashAmount).toFixed(2)) : null;
    const cardVal = form.cardAmount ? (form.entryKind === "KOSZT" ? (-Math.abs(Number(form.cardAmount))).toFixed(2) : parseFloat(form.cardAmount).toFixed(2)) : null;
    onSubmit({
      date: form.date,
      operationName: form.operationName,
      entryKind: form.entryKind || null,
      cashAmount: cashVal,
      cardAmount: cardVal,
      category: form.entryKind === "KOSZT" ? (form.category || null) : null,
      guestName: form.guestName || null,
      reservationNumber: form.reservationNumber || null,
      type: form.type || null,
      paymentMethod: form.paymentMethod || null,
      kasaFiskalna: form.kasaFiskalna || null,
      faktura: form.faktura || null,
      authCode: form.authCode || null,
      notes: form.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Edytuj wpis" : "Dodaj wpis do salda"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2">
            <Label className="shrink-0">Typ wpisu:</Label>
            <div className="flex items-center border border-border rounded-md overflow-visible">
              <button
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${form.entryKind === "PRZYCHOD" ? "bg-green-600 text-white" : "hover:bg-muted"}`}
                onClick={() => u("entryKind", "PRZYCHOD")}
                data-testid="toggle-new-przychod"
              >
                Przychód
              </button>
              <button
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${form.entryKind === "KOSZT" ? "bg-red-600 text-white" : "hover:bg-muted"}`}
                onClick={() => u("entryKind", "KOSZT")}
                data-testid="toggle-new-koszt"
              >
                Koszt
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={e => u("date", e.target.value)} data-testid="input-saldo-date" />
            </div>
            <div className="space-y-1">
              <Label>Nazwa operacji</Label>
              <Input value={form.operationName} onChange={e => u("operationName", e.target.value)} placeholder={form.entryKind === "PRZYCHOD" ? "np. GRAND BALTIC 203" : "np. Zakup środków czystości"} data-testid="input-saldo-operation" />
            </div>
            {form.entryKind === "KOSZT" && (
              <div className="col-span-2 space-y-1">
                <Label>Kategoria kosztu</Label>
                <Select value={form.category || "none"} onValueChange={v => u("category", v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-saldo-cost-category">
                    <SelectValue placeholder="Wybierz kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— brak —</SelectItem>
                    {categories.map((c: string) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1">
              <Label>Imię i nazwisko</Label>
              <Input value={form.guestName} onChange={e => u("guestName", e.target.value)} data-testid="input-saldo-guest" />
            </div>
            {form.entryKind === "PRZYCHOD" && (
              <div className="space-y-1">
                <Label>Nr rezerwacji</Label>
                <Input value={form.reservationNumber} onChange={e => u("reservationNumber", e.target.value)} data-testid="input-saldo-resnum" />
              </div>
            )}
            <div className="space-y-1">
              <Label>Rodzaj</Label>
              <Select value={form.type || "none"} onValueChange={v => u("type", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-saldo-type">
                  <SelectValue placeholder="Wybierz rodzaj" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— brak —</SelectItem>
                  {categories.map((c: string) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sposób płatności</Label>
              <Select value={form.paymentMethod || "none"} onValueChange={v => u("paymentMethod", v === "none" ? "" : v)}>
                <SelectTrigger data-testid="select-saldo-payment">
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
              <Input type="number" step="0.01" value={form.cashAmount} onChange={e => u("cashAmount", e.target.value)} placeholder="0.00" data-testid="input-saldo-cash" />
            </div>
            <div className="space-y-1">
              <Label>Kwota kartą</Label>
              <Input type="number" step="0.01" value={form.cardAmount} onChange={e => u("cardAmount", e.target.value)} placeholder="0.00" data-testid="input-saldo-card" />
            </div>
            <div className="space-y-1">
              <Label>Kod autoryzacji</Label>
              <Input value={form.authCode} onChange={e => u("authCode", e.target.value)} data-testid="input-saldo-auth" />
            </div>
            <div className="space-y-1">
              <Label>Uwagi</Label>
              <Input value={form.notes} onChange={e => u("notes", e.target.value)} data-testid="input-saldo-notes" />
            </div>
            <div className="space-y-1">
              <Label>Kasa fiskalna</Label>
              <Select value={form.kasaFiskalna} onValueChange={v => u("kasaFiskalna", v)}>
                <SelectTrigger data-testid="select-saldo-kf">
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
              <Select value={form.faktura} onValueChange={v => u("faktura", v)}>
                <SelectTrigger data-testid="select-saldo-fv">
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
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={isPending || !form.operationName.trim() || !form.date} data-testid="button-saldo-save">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {entry ? "Zapisz zmiany" : "Dodaj wpis"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
