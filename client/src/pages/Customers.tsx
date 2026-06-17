import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Search, RefreshCw, Download, Users, Mail, Phone, Globe,
  CheckCircle2, XCircle, ChevronRight, Tag, X, Building2,
  CalendarDays, Loader2, MoreHorizontal, Pencil, Trash2,
  Filter, ArrowUpDown, Plus, BarChart3, ArrowUp, ArrowDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Customer, InsertCustomer } from "@shared/schema";

const PAGE_SIZE = 50;

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  hotres: { label: "HotRes", color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30" },
  csv:    { label: "CSV",    color: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
  manual: { label: "Ręcznie", color: "bg-slate-500/15 text-slate-400 border-slate-500/30" },
};

const LANG_OPTIONS = [
  { value: "pl", label: "Polski" },
  { value: "en", label: "Angielski" },
  { value: "de", label: "Niemiecki" },
  { value: "fr", label: "Francuski" },
  { value: "uk", label: "Ukraiński" },
  { value: "ru", label: "Rosyjski" },
  { value: "other", label: "Inny" },
];

const SEGMENTS = ["VIP", "Stały", "Nowy", "Firma", "Okazjonalny"] as const;

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try { return format(parseISO(d), "dd.MM.yyyy", { locale: pl }); }
  catch { return d; }
}

function fmtMoney(v?: string | number | null) {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toLocaleString("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 });
}

interface StayHistoryItem {
  id: number;
  reservationNumber: string;
  apartmentName: string;
  startDate: string;
  endDate: string;
  price: string;
  status: string;
  source: string | null;
}

interface StayHistoryData {
  history: StayHistoryItem[];
  totalRevenue: number;
  totalStays: number;
}

interface CustomerPage {
  data: Customer[];
  total: number;
}

interface CustomerStats {
  total: number;
  consentCount: number;
  withEmailCount: number;
}

export default function Customers() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [consentFilter, setConsentFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"lastName" | "totalStays" | "totalRevenue" | "lastStayDate">("lastName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [panelMode, setPanelMode] = useState<"view" | "edit">("view");
  const [editData, setEditData] = useState<Partial<Customer>>({});
  const [tagInput, setTagInput] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleSearchChange = (v: string) => {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(v), 350);
  };

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (consentFilter === "true") p.set("marketingConsent", "true");
    if (consentFilter === "false") p.set("marketingConsent", "false");
    if (sourceFilter !== "all") p.set("source", sourceFilter);
    p.set("sortBy", sortField);
    p.set("sortDir", sortDir);
    p.set("limit", String(PAGE_SIZE));
    return p;
  }, [debouncedSearch, consentFilter, sourceFilter, sortField, sortDir]);

  const {
    data: infiniteData,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery<CustomerPage>({
    queryKey: ["/api/customers", queryParams.toString()],
    queryFn: async ({ pageParam }) => {
      const p = new URLSearchParams(queryParams);
      p.set("offset", String(pageParam));
      const res = await fetch(`/api/customers?${p.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.data.length, 0);
      if (loaded >= lastPage.total) return undefined;
      return loaded;
    },
    staleTime: 1000 * 60,
  });

  const { data: stats } = useQuery<CustomerStats>({
    queryKey: ["/api/customers/stats"],
    staleTime: 1000 * 60 * 2,
  });

  const customers = useMemo(() => {
    if (!infiniteData) return [];
    return infiniteData.pages.flatMap(p => p.data);
  }, [infiniteData]);

  const totalFiltered = infiniteData?.pages[0]?.total ?? 0;

  const totalCount = stats?.total ?? 0;
  const consentCount = stats?.consentCount ?? 0;
  const withEmailCount = stats?.withEmailCount ?? 0;

  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupSentinel = useCallback((el: HTMLDivElement | null) => {
    (sentinelRef as any).current = el;
    if (observerRef.current) observerRef.current.disconnect();
    if (!el) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observerRef.current.observe(el);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    return () => { observerRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    if (!sentinelRef.current || !observerRef.current) return;
    observerRef.current.disconnect();
    if (hasNextPage && !isFetchingNextPage) {
      observerRef.current.observe(sentinelRef.current);
    }
  }, [hasNextPage, isFetchingNextPage]);

  const { data: stayHistory, isLoading: isLoadingHistory } = useQuery<StayHistoryData>({
    queryKey: ["/api/customers", selectedCustomer?.id, "reservations"],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${selectedCustomer!.id}/reservations`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!selectedCustomer,
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: number; data: Partial<Customer> }) =>
      apiRequest("PATCH", `/api/customers/${vars.id}`, vars.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Zapisano zmiany" });
      setPanelMode("view");
    },
    onError: (e: any) => toast({ title: "Błąd zapisu", description: e.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertCustomer) => apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Dodano klienta" });
      setAddDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "Błąd dodawania", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      setSelectedCustomer(null);
      toast({ title: "Klient usunięty" });
    },
    onError: (e: any) => toast({ title: "Błąd usuwania", description: e.message, variant: "destructive" }),
  });

  const handleRecalculateStats = async () => {
    setIsRecalculating(true);
    try {
      const res = await fetch("/api/customers/recalculate-stats", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Błąd przeliczania");
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Statystyki przeliczone",
        description: `Zaktualizowano ${data.updated ?? 0} klientów`,
      });
    } catch (e: any) {
      toast({ title: "Błąd przeliczania statystyk", description: e.message, variant: "destructive" });
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleHotResSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/customers/import-all-hotres", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Błąd importu");
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Import HotRes zakończony",
        description: `+${data.created ?? 0} nowych · ${data.updated ?? 0} zaktualizowanych · ${data.linked ?? 0} powiązanych rezerwacji`,
      });
    } catch (e: any) {
      toast({ title: "Błąd importu HotRes", description: e.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const p = new URLSearchParams();
      if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
      if (consentFilter === "true") p.set("marketingConsent", "true");
      if (consentFilter === "false") p.set("marketingConsent", "false");
      if (sourceFilter !== "all") p.set("source", sourceFilter);
      const res = await fetch(`/api/customers/export?${p.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const all: Customer[] = await res.json();

      const headers = ["Imię", "Nazwisko", "Email", "Telefon", "Miasto", "Kraj", "Narodowość", "Źródło", "Zgoda marketingowa", "Język", "Tagi", "Liczba pobytów", "Przychód", "Ostatni pobyt", "Notatki"];
      const rows = all.map(c => [
        c.firstName, c.lastName, c.email || "", c.phone || "",
        c.city || "", c.country || "", c.nationality || "",
        c.source || "manual",
        c.marketingConsent ? "tak" : "nie",
        c.preferredLang || "pl",
        (c.tags || []).join(";"),
        String(c.totalStays || 0),
        String(c.totalRevenue || "0"),
        c.lastStayDate || "",
        (c.notes || "").replace(/\n/g, " "),
      ]);
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "klienci.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Błąd eksportu", description: e.message, variant: "destructive" });
    }
  };

  const openPanel = (c: Customer) => {
    setSelectedCustomer(c);
    setEditData({ ...c });
    setPanelMode("view");
  };

  const startEdit = () => {
    setEditData({ ...selectedCustomer! });
    setTagInput("");
    setPanelMode("edit");
  };

  const saveEdit = () => {
    if (!selectedCustomer) return;
    updateMutation.mutate({ id: selectedCustomer.id, data: editData });
    setSelectedCustomer({ ...selectedCustomer, ...editData } as Customer);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    setEditData(prev => ({ ...prev, tags: [...(prev.tags || []), t] }));
    setTagInput("");
  };

  const removeTag = (t: string) => {
    setEditData(prev => ({ ...prev, tags: (prev.tags || []).filter(x => x !== t) }));
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline text-slate-500" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1 inline text-[#5ADBFA]" />
      : <ArrowDown className="h-3 w-3 ml-1 inline text-[#5ADBFA]" />;
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-[#5ADBFA]" />
            Baza klientów
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {totalCount === 0 && isLoading
              ? "Ładowanie..."
              : `${totalCount} klientów · ${consentCount} ze zgodą marketingową · ${withEmailCount} z emailem`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddDialogOpen(true)}
            className="text-xs"
            data-testid="button-add-customer"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Dodaj
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleHotResSync}
            disabled={isSyncing}
            className="text-xs"
            data-testid="button-sync-hotres"
          >
            {isSyncing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Importuj z HotRes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculateStats}
            disabled={isRecalculating}
            className="text-xs"
            data-testid="button-recalculate-stats"
          >
            {isRecalculating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <BarChart3 className="h-3.5 w-3.5 mr-1.5" />}
            Przelicz statystyki
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="text-xs"
            data-testid="button-export-csv"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Eksportuj CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Szukaj klienta..."
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
            data-testid="input-search-customers"
          />
          {search && (
            <button onClick={() => { setSearch(""); setDebouncedSearch(""); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Select value={consentFilter} onValueChange={setConsentFilter}>
          <SelectTrigger className="h-9 w-[180px] text-sm" data-testid="select-consent-filter">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-slate-400 shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie zgody</SelectItem>
            <SelectItem value="true">Ze zgodą</SelectItem>
            <SelectItem value="false">Bez zgody</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="h-9 w-[160px] text-sm" data-testid="select-source-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie źródła</SelectItem>
            <SelectItem value="hotres">HotRes</SelectItem>
            <SelectItem value="csv">CSV</SelectItem>
            <SelectItem value="manual">Ręcznie</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap" onClick={() => toggleSort("lastName")} data-testid="th-sort-name">
                  Klient <SortIcon field="lastName" />
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Kontakt</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Źródło</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Zgoda</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap hidden lg:table-cell" onClick={() => toggleSort("totalStays")} data-testid="th-sort-stays">
                  Pobyty <SortIcon field="totalStays" />
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap hidden lg:table-cell" onClick={() => toggleSort("totalRevenue")} data-testid="th-sort-revenue">
                  Przychód <SortIcon field="totalRevenue" />
                </th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap hidden xl:table-cell" onClick={() => toggleSort("lastStayDate")} data-testid="th-sort-last-stay">
                  Ostatni pobyt <SortIcon field="lastStayDate" />
                </th>
                <th className="w-8 px-2" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                    Ładowanie...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Brak klientów{search || consentFilter !== "all" || sourceFilter !== "all" ? " spełniających kryteria" : ""}</p>
                    {!search && consentFilter === "all" && sourceFilter === "all" && (
                      <p className="text-xs mt-1 text-muted-foreground/60">Kliknij <strong className="text-foreground">Importuj z HotRes</strong> aby zasilić bazę</p>
                    )}
                  </td>
                </tr>
              ) : (
                customers.map(c => {
                  const srcInfo = SOURCE_LABELS[c.source || "manual"] || SOURCE_LABELS.manual;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-border hover:bg-muted/40 cursor-pointer transition-colors group"
                      onClick={() => openPanel(c)}
                      data-testid={`row-customer-${c.id}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground" data-testid={`text-customer-name-${c.id}`}>{c.lastName} {c.firstName}</div>
                        {c.city && <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Building2 className="h-2.5 w-2.5" />{c.city}</div>}
                        {c.tags && c.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.tags.slice(0, 3).map(t => (
                              <span key={t} className="text-[10px] bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded px-1 py-0.5">{t}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="space-y-0.5">
                          {c.email && <div className="flex items-center gap-1.5 text-xs text-foreground/70"><Mail className="h-3 w-3 text-muted-foreground shrink-0" /><span className="truncate max-w-[180px]">{c.email}</span></div>}
                          {c.phone && <div className="flex items-center gap-1.5 text-xs text-foreground/70"><Phone className="h-3 w-3 text-muted-foreground shrink-0" />{c.phone}</div>}
                          {!c.email && !c.phone && <span className="text-xs text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`text-[11px] font-medium border rounded-full px-2 py-0.5 ${srcInfo.color}`}>{srcInfo.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {c.marketingConsent
                          ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                          : <XCircle className="h-4 w-4 text-muted-foreground/40 mx-auto" />}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="font-medium text-foreground" data-testid={`text-stays-${c.id}`}>{c.totalStays || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell">
                        <span className="font-medium text-emerald-500" data-testid={`text-revenue-${c.id}`}>{fmtMoney(c.totalRevenue)}</span>
                      </td>
                      <td className="px-4 py-3 text-right hidden xl:table-cell text-muted-foreground text-xs">
                        {fmtDate(c.lastStayDate)}
                      </td>
                      <td className="px-2 py-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Infinite scroll sentinel */}
        {customers.length > 0 && (
          <div
            ref={setupSentinel}
            className="px-4 py-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-500"
            data-testid="customers-footer"
          >
            <span>
              Wyświetlono {customers.length} z {totalFiltered} klientów
              {(debouncedSearch || consentFilter !== "all" || sourceFilter !== "all") && totalFiltered !== totalCount
                ? ` (z ${totalCount} łącznie)`
                : ""}
            </span>
            {isFetchingNextPage && (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Ładowanie kolejnych...
              </span>
            )}
            {!hasNextPage && customers.length < totalFiltered && (
              <span className="text-slate-600">Koniec listy</span>
            )}
          </div>
        )}
      </div>

      {/* Customer detail/edit sheet */}
      <Sheet open={!!selectedCustomer} onOpenChange={open => { if (!open) { setSelectedCustomer(null); setPanelMode("view"); } }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-customer-panel">
          {selectedCustomer && (
            <>
              <SheetHeader className="pr-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-lg text-white truncate">
                      {selectedCustomer.lastName} {selectedCustomer.firstName}
                    </SheetTitle>
                    <SheetDescription className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[11px] font-medium border rounded-full px-2 py-0.5 ${(SOURCE_LABELS[selectedCustomer.source || "manual"] || SOURCE_LABELS.manual).color}`}>
                        {(SOURCE_LABELS[selectedCustomer.source || "manual"] || SOURCE_LABELS.manual).label}
                      </span>
                      {selectedCustomer.nationality && (
                        <span className="text-xs text-slate-400 flex items-center gap-1"><Globe className="h-3 w-3" />{selectedCustomer.nationality}</span>
                      )}
                    </SheetDescription>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {panelMode === "view" ? (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={startEdit} data-testid="button-edit-customer">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-customer-more">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDeleteConfirmId(selectedCustomer.id)} className="text-red-400">
                              <Trash2 className="h-4 w-4 mr-2" /> Usuń klienta
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setPanelMode("view")} data-testid="button-cancel-edit">Anuluj</Button>
                        <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-customer">
                          {updateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Zapisz"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-white" data-testid="text-panel-stays">{selectedCustomer.totalStays || 0}</div>
                    <div className="text-[11px] text-slate-400">Pobyty</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-sm font-bold text-emerald-400" data-testid="text-panel-revenue">{fmtMoney(selectedCustomer.totalRevenue)}</div>
                    <div className="text-[11px] text-slate-400">Przychód</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                    <div className="text-xs font-semibold text-white">{fmtDate(selectedCustomer.lastStayDate)}</div>
                    <div className="text-[11px] text-slate-400">Ostatni pobyt</div>
                  </div>
                </div>

                {panelMode === "view" ? (
                  <>
                    {/* Contact */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Kontakt</h3>
                      <div className="space-y-2">
                        {selectedCustomer.email ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                            <a href={`mailto:${selectedCustomer.email}`} className="text-[#5ADBFA] hover:underline truncate">{selectedCustomer.email}</a>
                          </div>
                        ) : null}
                        {selectedCustomer.phone ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-4 w-4 text-slate-500 shrink-0" />
                            <a href={`tel:${selectedCustomer.phone}`} className="text-slate-200 hover:text-white">{selectedCustomer.phone}</a>
                          </div>
                        ) : null}
                        {(selectedCustomer.street || selectedCustomer.city) ? (
                          <div className="flex items-start gap-2 text-sm text-slate-300">
                            <Building2 className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                            <span>{[selectedCustomer.street, selectedCustomer.postalCode, selectedCustomer.city, selectedCustomer.country].filter(Boolean).join(", ")}</span>
                          </div>
                        ) : null}
                        {!selectedCustomer.email && !selectedCustomer.phone && !selectedCustomer.city && (
                          <p className="text-sm text-slate-500 italic">Brak danych kontaktowych</p>
                        )}
                      </div>
                    </div>

                    <Separator className="bg-white/10" />

                    {/* Marketing */}
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Marketing</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          {selectedCustomer.marketingConsent
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            : <XCircle className="h-4 w-4 text-slate-500" />}
                          <span className={selectedCustomer.marketingConsent ? "text-emerald-400" : "text-slate-400"}>
                            {selectedCustomer.marketingConsent ? "Zgoda marketingowa — aktywna" : "Brak zgody marketingowej"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-300">
                          <Globe className="h-4 w-4 text-slate-500" />
                          <span>{LANG_OPTIONS.find(l => l.value === (selectedCustomer.preferredLang || "pl"))?.label || "Polski"}</span>
                        </div>
                        {selectedCustomer.segment && (
                          <div className="flex items-center gap-2 text-slate-300">
                            <Tag className="h-4 w-4 text-slate-500" />
                            <span>Segment: {selectedCustomer.segment}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedCustomer.tags && selectedCustomer.tags.length > 0 && (
                      <>
                        <Separator className="bg-white/10" />
                        <div>
                          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tagi</h3>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedCustomer.tags.map(t => (
                              <span key={t} className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded px-2 py-0.5 flex items-center gap-1">
                                <Tag className="h-2.5 w-2.5" />{t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {selectedCustomer.notes && (
                      <>
                        <Separator className="bg-white/10" />
                        <div>
                          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notatki</h3>
                          <p className="text-sm text-slate-300 whitespace-pre-wrap">{selectedCustomer.notes}</p>
                        </div>
                      </>
                    )}

                    <Separator className="bg-white/10" />
                    <div>
                      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5" /> Historia pobytów
                      </h3>
                      {isLoadingHistory ? (
                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                          <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie...
                        </div>
                      ) : stayHistory && stayHistory.history.length > 0 ? (
                        <div className="space-y-2">
                          {stayHistory.history.map(h => (
                            <div key={h.id} className="bg-slate-800/50 rounded-lg p-3" data-testid={`row-stay-${h.id}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm text-white truncate">{h.apartmentName}</div>
                                  <div className="text-xs text-slate-400 mt-0.5">{fmtDate(h.startDate)} – {fmtDate(h.endDate)}</div>
                                  {h.reservationNumber && <div className="text-xs text-slate-500"># {h.reservationNumber}</div>}
                                </div>
                                <div className="text-right shrink-0">
                                  <div className="text-sm font-semibold text-emerald-400">{fmtMoney(h.price)}</div>
                                  <div className={`text-[10px] mt-0.5 ${h.status === "ANULOWANA" ? "text-red-400" : "text-emerald-400"}`}>
                                    {h.status === "ANULOWANA" ? "Anulowana" : "Potwierdzona"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500 italic">Brak historii pobytów</p>
                      )}
                    </div>
                  </>
                ) : (
                  /* Edit form */
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Imię *</Label>
                        <Input value={editData.firstName || ""} onChange={e => setEditData(p => ({ ...p, firstName: e.target.value }))} className="mt-1 h-9 text-sm" data-testid="input-edit-firstName" />
                      </div>
                      <div>
                        <Label className="text-xs">Nazwisko *</Label>
                        <Input value={editData.lastName || ""} onChange={e => setEditData(p => ({ ...p, lastName: e.target.value }))} className="mt-1 h-9 text-sm" data-testid="input-edit-lastName" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input type="email" value={editData.email || ""} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} className="mt-1 h-9 text-sm" data-testid="input-edit-email" />
                    </div>
                    <div>
                      <Label className="text-xs">Telefon</Label>
                      <Input value={editData.phone || ""} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} className="mt-1 h-9 text-sm" data-testid="input-edit-phone" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Miasto</Label>
                        <Input value={editData.city || ""} onChange={e => setEditData(p => ({ ...p, city: e.target.value }))} className="mt-1 h-9 text-sm" data-testid="input-edit-city" />
                      </div>
                      <div>
                        <Label className="text-xs">Kraj</Label>
                        <Input value={editData.country || ""} onChange={e => setEditData(p => ({ ...p, country: e.target.value }))} className="mt-1 h-9 text-sm" data-testid="input-edit-country" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Narodowość</Label>
                      <Input value={editData.nationality || ""} onChange={e => setEditData(p => ({ ...p, nationality: e.target.value }))} className="mt-1 h-9 text-sm" placeholder="np. Polska, Niemcy..." data-testid="input-edit-nationality" />
                    </div>

                    <Separator className="bg-white/10" />

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">Zgoda marketingowa</Label>
                        <p className="text-xs text-slate-400 mt-0.5">Newsletter, oferty specjalne</p>
                      </div>
                      <Checkbox
                        checked={editData.marketingConsent ?? true}
                        onCheckedChange={v => setEditData(p => ({ ...p, marketingConsent: !!v }))}
                        data-testid="checkbox-marketing-consent"
                      />
                    </div>

                    <div>
                      <Label className="text-xs">Preferowany język</Label>
                      <Select value={editData.preferredLang || "pl"} onValueChange={v => setEditData(p => ({ ...p, preferredLang: v }))}>
                        <SelectTrigger className="mt-1 h-9 text-sm" data-testid="select-edit-lang">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANG_OPTIONS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Segment</Label>
                      <Select value={editData.segment || ""} onValueChange={v => setEditData(p => ({ ...p, segment: v }))}>
                        <SelectTrigger className="mt-1 h-9 text-sm" data-testid="select-edit-segment">
                          <SelectValue placeholder="Wybierz segment" />
                        </SelectTrigger>
                        <SelectContent>
                          {SEGMENTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator className="bg-white/10" />

                    <div>
                      <Label className="text-xs mb-2 block">Tagi</Label>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(editData.tags || []).map(t => (
                          <span key={t} className="text-xs bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded px-2 py-0.5 flex items-center gap-1">
                            {t}
                            <button onClick={() => removeTag(t)} className="hover:text-red-400 transition-colors" data-testid={`button-remove-tag-${t}`}>
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())}
                          placeholder="Dodaj tag..."
                          className="h-8 text-xs flex-1"
                          data-testid="input-tag"
                        />
                        <Button size="sm" variant="outline" onClick={addTag} className="h-8 text-xs" data-testid="button-add-tag">Dodaj</Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs">Notatki</Label>
                      <Textarea
                        value={editData.notes || ""}
                        onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                        className="mt-1 text-sm resize-none"
                        rows={3}
                        placeholder="Dodaj notatki o kliencie..."
                        data-testid="textarea-edit-notes"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add customer dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dodaj klienta</DialogTitle>
          </DialogHeader>
          <AddCustomerForm
            isPending={createMutation.isPending}
            onSubmit={data => createMutation.mutate(data)}
            onCancel={() => setAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={open => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń klienta</AlertDialogTitle>
            <AlertDialogDescription>Tej operacji nie można cofnąć. Klient zostanie trwale usunięty z bazy.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deleteConfirmId) { deleteMutation.mutate(deleteConfirmId); setDeleteConfirmId(null); } }}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >Usuń</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddCustomerForm({ isPending, onSubmit, onCancel }: {
  isPending: boolean;
  onSubmit: (data: InsertCustomer) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Partial<InsertCustomer>>({
    firstName: "", lastName: "", email: "", phone: "",
    city: "", country: "Polska", source: "manual",
    marketingConsent: true, preferredLang: "pl",
  });

  const set = (key: keyof InsertCustomer, val: any) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName?.trim() || !form.lastName?.trim()) return;
    onSubmit(form as InsertCustomer);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Imię *</Label>
          <Input value={form.firstName || ""} onChange={e => set("firstName", e.target.value)} className="mt-1 h-9 text-sm" data-testid="input-customer-firstName" required />
        </div>
        <div>
          <Label className="text-xs">Nazwisko *</Label>
          <Input value={form.lastName || ""} onChange={e => set("lastName", e.target.value)} className="mt-1 h-9 text-sm" data-testid="input-customer-lastName" required />
        </div>
      </div>
      <div>
        <Label className="text-xs">Email</Label>
        <Input type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} className="mt-1 h-9 text-sm" data-testid="input-customer-email" />
      </div>
      <div>
        <Label className="text-xs">Telefon</Label>
        <Input value={form.phone || ""} onChange={e => set("phone", e.target.value)} className="mt-1 h-9 text-sm" data-testid="input-customer-phone" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Miasto</Label>
          <Input value={form.city || ""} onChange={e => set("city", e.target.value)} className="mt-1 h-9 text-sm" data-testid="input-customer-city" />
        </div>
        <div>
          <Label className="text-xs">Kraj</Label>
          <Input value={form.country || "Polska"} onChange={e => set("country", e.target.value)} className="mt-1 h-9 text-sm" data-testid="input-customer-country" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Zgoda marketingowa</Label>
        </div>
        <Checkbox
          checked={form.marketingConsent ?? true}
          onCheckedChange={v => set("marketingConsent", !!v)}
          data-testid="checkbox-add-marketing-consent"
        />
      </div>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} data-testid="button-cancel-add">Anuluj</Button>
        <Button type="submit" size="sm" disabled={isPending} data-testid="button-submit-customer">
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
          Dodaj klienta
        </Button>
      </DialogFooter>
    </form>
  );
}
