import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, getDaysInMonth, addMonths, subMonths, getDay, parseISO, startOfYear, endOfYear, getMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ChevronLeft, ChevronRight, Calendar, Copy, Check, AlertTriangle,
  RefreshCw, ArrowUpDown, Tag, Plus, Trash2, Edit2, Play,
  Download, Upload, History, Settings2, TrendingUp, Zap, X,
  ArrowDown, ArrowUp, CheckSquare, Sparkles, BrainCircuit, ThumbsUp, ThumbsDown, Loader2
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Apartment { id: number; name: string; location?: string; minPrice?: string; maxPrice?: string; hotresTypeId?: number; hotresRateId?: number; }
interface DailyPrice { id: number; apartment_id: number; date: string; price: string; min_stay?: number; max_stay?: number; is_blocked?: boolean; closed_to_arrival?: boolean; closed_to_departure?: boolean; note?: string; source?: string; }
interface Reservation { id: number; apartmentId?: number; startDate: string; endDate: string; }
interface PricingRule { id: number; name: string; type: string; season_type?: string; date_from?: string; date_to?: string; day_of_week?: number[]; modifier: string; modifier_type: string; priority: number; active: boolean; min_stay_rule?: number; apartment_ids?: number[]; }
interface PriceTemplate { id: number; name: string; description?: string; config: any; created_by?: string; }
interface HistoryEntry { id: number; apartment_id: number; date: string; old_price?: string; new_price: string; changed_by?: string; source?: string; created_at: string; apartment_name?: string; }

// ─── Color helper ───────────────────────────────────────────────────────────
function getPriceColor(price: number, min: number, max: number): string {
  if (min === max || max === 0) return "hsl(210,60%,62%)";
  const r = Math.min(1, Math.max(0, (price - min) / (max - min)));
  const hue = r < 0.5 ? 210 - 90 * (r * 2) : 120 - 120 * ((r - 0.5) * 2);
  const sat = 55 + r * 15;
  const light = 65 - r * 10;
  return `hsl(${hue},${sat}%,${light}%)`;
}

function getTextColor(price: number, min: number, max: number): string {
  if (min === max || max === 0) return "#1e3a5f";
  const r = Math.min(1, Math.max(0, (price - min) / (max - min)));
  return r > 0.65 ? "#fff" : "#1a1a2e";
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Cennik() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"month" | "year">("month");
  const [locationFilter, setLocationFilter] = useState("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [activeTab, setActiveTab] = useState("kalendarz");

  const from = viewMode === "month"
    ? format(startOfMonth(currentDate), "yyyy-MM-dd")
    : format(startOfYear(currentDate), "yyyy-MM-dd");
  const to = viewMode === "month"
    ? format(endOfMonth(currentDate), "yyyy-MM-dd")
    : format(endOfYear(currentDate), "yyyy-MM-dd");

  const { data: apartments = [] } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: dailyPrices = [], isLoading: pricesLoading } = useQuery<DailyPrice[]>({
    queryKey: ["/api/pricing/daily", from, to],
    queryFn: () => fetch(`/api/pricing/daily?from=${from}&to=${to}`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: reservations = [] } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations", from, to],
    queryFn: () => fetch(`/api/reservations?startDate=${from}&endDate=${to}`, { credentials: "include" }).then(r => r.json()),
  });
  const { data: alerts = [] } = useQuery<any[]>({
    queryKey: ["/api/pricing/alerts"],
    queryFn: () => fetch("/api/pricing/alerts", { credentials: "include" }).then(r => r.json()),
  });

  const locations = useMemo(() => {
    const locs = [...new Set(apartments.map(a => a.location).filter(Boolean))];
    return locs as string[];
  }, [apartments]);

  const filteredApts = useMemo(() => apartments.filter(a => {
    if (locationFilter !== "all" && a.location !== locationFilter) return false;
    if (searchFilter && !a.name.toLowerCase().includes(searchFilter.toLowerCase())) return false;
    return true;
  }), [apartments, locationFilter, searchFilter]);

  // Build price map: aptId → date → price
  // node-postgres returns DATE as full ISO string ("2026-06-01T00:00:00.000Z"), normalize to "2026-06-01"
  const priceMap = useMemo(() => {
    const m: Record<number, Record<string, DailyPrice>> = {};
    for (const p of dailyPrices) {
      if (!m[p.apartment_id]) m[p.apartment_id] = {};
      const key = String(p.date).substring(0, 10);
      m[p.apartment_id][key] = { ...p, date: key };
    }
    return m;
  }, [dailyPrices]);

  // Build reservation map: aptId → Set<date>
  const reservedMap = useMemo(() => {
    const m: Record<number, Set<string>> = {};
    for (const r of reservations) {
      if (!r.apartmentId) continue;
      if (!m[r.apartmentId]) m[r.apartmentId] = new Set();
      const start = parseISO(r.startDate), end = parseISO(r.endDate);
      for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        m[r.apartmentId].add(format(d, "yyyy-MM-dd"));
      }
    }
    return m;
  }, [reservations]);

  // Per-apartment min/max price
  const aptPriceRange = useMemo(() => {
    const m: Record<number, { min: number; max: number }> = {};
    for (const apt of apartments) {
      const prices = dailyPrices.filter(p => p.apartment_id === apt.id).map(p => Number(p.price));
      m[apt.id] = { min: prices.length ? Math.min(...prices) : 0, max: prices.length ? Math.max(...prices) : 0 };
    }
    return m;
  }, [apartments, dailyPrices]);

  // Alert map: aptId → health score
  const alertMap = useMemo(() => {
    const m: Record<number, number> = {};
    for (const a of alerts) m[a.apartmentId] = a.healthScore;
    return m;
  }, [alerts]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Page header */}
      <div className="sticky top-0 z-30 border-b border-border/50 backdrop-blur-md bg-background/80 px-4 sm:px-6 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Tag className="h-5 w-5 text-cyan-400 shrink-0" />
            <h1 className="text-lg font-semibold truncate">Cennik</h1>
            {alerts.length > 0 && (
              <Badge variant="destructive" className="text-xs shrink-0">{alerts.length}</Badge>
            )}
          </div>
          {activeTab === "kalendarz" && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Month/Year navigation */}
              <div className="flex items-center gap-1 bg-muted/60 rounded-xl px-1 py-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
                  onClick={() => setCurrentDate(viewMode === "month" ? subMonths(currentDate, 1) : new Date(currentDate.getFullYear() - 1, 0))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2 min-w-[120px] text-center">
                  {viewMode === "month"
                    ? format(currentDate, "LLLL yyyy", { locale: pl })
                    : format(currentDate, "yyyy")}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg"
                  onClick={() => setCurrentDate(viewMode === "month" ? addMonths(currentDate, 1) : new Date(currentDate.getFullYear() + 1, 0))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {/* View toggle */}
              <div className="flex items-center bg-muted/60 rounded-xl p-1">
                <Button size="sm" variant={viewMode === "month" ? "default" : "ghost"} className="h-7 px-3 rounded-lg text-xs"
                  onClick={() => setViewMode("month")}>Miesiąc</Button>
                <Button size="sm" variant={viewMode === "year" ? "default" : "ghost"} className="h-7 px-3 rounded-lg text-xs"
                  onClick={() => setViewMode("year")}>Rok</Button>
              </div>
            </div>
          )}
        </div>
        {/* Filters */}
        {activeTab === "kalendarz" && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="h-8 w-36 text-xs rounded-lg"><SelectValue placeholder="Lokalizacja" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                {locations.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Szukaj apartamentu..." value={searchFilter} onChange={e => setSearchFilter(e.target.value)}
              className="h-8 w-40 text-xs rounded-lg" />
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <TabsList className="mx-4 sm:mx-6 mt-3 mb-0 rounded-xl bg-muted/50 w-fit">
          <TabsTrigger value="kalendarz" className="rounded-lg text-xs px-3">Kalendarz</TabsTrigger>
          <TabsTrigger value="reguly" className="rounded-lg text-xs px-3">Reguły</TabsTrigger>
          <TabsTrigger value="szablony" className="rounded-lg text-xs px-3">Szablony</TabsTrigger>
          <TabsTrigger value="hotres" className="rounded-lg text-xs px-3">HotRes</TabsTrigger>
          <TabsTrigger value="historia" className="rounded-lg text-xs px-3">Historia</TabsTrigger>
          <TabsTrigger value="ai" className="rounded-lg text-xs px-3 gap-1">
            <Sparkles className="h-3 w-3 text-violet-400" />AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kalendarz" className="flex-1 min-h-0 mt-2 mx-0">
          <CalendarTab
            apartments={filteredApts}
            priceMap={priceMap}
            reservedMap={reservedMap}
            aptPriceRange={aptPriceRange}
            alertMap={alertMap}
            currentDate={currentDate}
            viewMode={viewMode}
            onMonthClick={(m) => { setCurrentDate(m); setViewMode("month"); }}
            from={from} to={to}
          />
        </TabsContent>
        <TabsContent value="reguly" className="flex-1 min-h-0 mt-2 px-4 sm:px-6 overflow-y-auto pb-6">
          <RulesTab apartments={apartments} />
        </TabsContent>
        <TabsContent value="szablony" className="flex-1 min-h-0 mt-2 px-4 sm:px-6 overflow-y-auto pb-6">
          <TemplatesTab apartments={apartments} />
        </TabsContent>
        <TabsContent value="hotres" className="flex-1 min-h-0 mt-2 px-4 sm:px-6 overflow-y-auto pb-6">
          <HotresTab apartments={apartments} />
        </TabsContent>
        <TabsContent value="historia" className="flex-1 min-h-0 mt-2 px-4 sm:px-6 overflow-y-auto pb-6">
          <HistoryTab apartments={apartments} />
        </TabsContent>
        <TabsContent value="ai" className="flex-1 min-h-0 mt-2 px-4 sm:px-6 overflow-y-auto pb-6">
          <AiTab apartments={apartments} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── AI Tab ───────────────────────────────────────────────────────────────────
interface AiRec { id: number; apartment_id: number; apartment_name?: string; date: string; current_price: string; recommended_price: string; confidence?: string; reasoning?: string; factors?: string; status: string; created_at: string; }

function AiTab({ apartments }: { apartments: Apartment[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [aptId, setAptId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [genAptId, setGenAptId] = useState<string>("");
  const [genFrom, setGenFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [genTo, setGenTo] = useState(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [configAptId, setConfigAptId] = useState<string>("");
  const [configOpen, setConfigOpen] = useState(false);
  const [configAutoMode, setConfigAutoMode] = useState(false);
  const [configMaxChange, setConfigMaxChange] = useState("20");
  const [configMinPrice, setConfigMinPrice] = useState("");
  const [configMaxPrice, setConfigMaxPrice] = useState("");
  const [configDaysAhead, setConfigDaysAhead] = useState("90");

  const params = new URLSearchParams();
  if (aptId !== "all") params.set("apartmentId", aptId);
  if (statusFilter !== "all") params.set("status", statusFilter);

  const { data, isLoading, refetch } = useQuery<{ data: AiRec[]; total: number }>({
    queryKey: ["/api/pricing/ai/recommendations", aptId, statusFilter],
    queryFn: () => fetch(`/api/pricing/ai/recommendations?${params}`, { credentials: "include" }).then(r => r.json()),
  });

  const generateMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pricing/ai/recommend", { apartmentId: Number(genAptId), from: genFrom, to: genTo }),
    onSuccess: async (res: any) => {
      const data = await res.json();
      toast({ title: `Wygenerowano ${data.count} rekomendacji AI` });
      qc.invalidateQueries({ queryKey: ["/api/pricing/ai/recommendations"] });
    },
    onError: (e: any) => toast({ title: "Błąd AI", description: e.message, variant: "destructive" }),
  });

  const applyMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/pricing/ai/recommendations/${id}/apply`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pricing/ai/recommendations"] }); qc.invalidateQueries({ queryKey: ["/api/pricing/daily"] }); },
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const dismissMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/pricing/ai/recommendations/${id}/dismiss`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/pricing/ai/recommendations"] }),
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const applyAllMut = useMutation({
    mutationFn: () => apiRequest("POST", "/api/pricing/ai/recommendations/apply-batch", aptId !== "all" ? { apartmentId: Number(aptId) } : {}),
    onSuccess: async (res: any) => {
      const d = await res.json();
      toast({ title: `Zastosowano ${d.applied} rekomendacji` });
      qc.invalidateQueries({ queryKey: ["/api/pricing/ai/recommendations"] });
      qc.invalidateQueries({ queryKey: ["/api/pricing/daily"] });
    },
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const configQuery = useQuery<any>({
    queryKey: ["/api/pricing/ai/config", configAptId],
    queryFn: () => configAptId ? fetch(`/api/pricing/ai/config/${configAptId}`, { credentials: "include" }).then(r => r.json()) : Promise.resolve(null),
    enabled: !!configAptId,
  });

  const saveConfigMut = useMutation({
    mutationFn: () => apiRequest("PUT", `/api/pricing/ai/config/${configAptId}`, {
      autoMode: configAutoMode, maxChangePercent: Number(configMaxChange),
      minPrice: configMinPrice ? Number(configMinPrice) : null,
      maxPrice: configMaxPrice ? Number(configMaxPrice) : null,
      daysAhead: Number(configDaysAhead),
    }),
    onSuccess: () => {
      toast({ title: "Konfiguracja zapisana" });
      setConfigOpen(false);
      qc.invalidateQueries({ queryKey: ["/api/pricing/ai/config"] });
    },
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const openConfig = (aptId: string) => {
    setConfigAptId(aptId);
    setConfigOpen(true);
    const cfg = configQuery.data;
    if (cfg) {
      setConfigAutoMode(cfg.auto_mode || false);
      setConfigMaxChange(String(cfg.max_change_percent || 20));
      setConfigMinPrice(cfg.min_price || "");
      setConfigMaxPrice(cfg.max_price || "");
      setConfigDaysAhead(String(cfg.days_ahead || 90));
    }
  };

  const pendingCount = (data?.data || []).filter(r => r.status === "pending").length;

  const CONFIDENCE_COLOR = (c: number) =>
    c >= 0.8 ? "text-emerald-500" : c >= 0.6 ? "text-amber-500" : "text-red-400";

  const STATUS_BADGE: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    applied: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    dismissed: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-4">
      {/* Header karta */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <BrainCircuit className="h-5 w-5 text-violet-400" />
          <h2 className="font-semibold text-sm">Rekomendacje AI</h2>
          <Badge className="text-[10px] bg-violet-500/10 text-violet-500 border-violet-500/20 rounded-full px-2">GPT-4o mini</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">AI analizuje historię rezerwacji, sezonowość i dni tygodnia, by zaproponować optymalne ceny.</p>

        {/* Generator */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1 block">Apartament</Label>
            <Select value={genAptId} onValueChange={setGenAptId}>
              <SelectTrigger className="h-8 text-xs rounded-xl"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
              <SelectContent>
                {apartments.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1 block">Od</Label>
            <Input type="date" value={genFrom} onChange={e => setGenFrom(e.target.value)} className="h-8 text-xs rounded-xl" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground mb-1 block">Do</Label>
            <Input type="date" value={genTo} onChange={e => setGenTo(e.target.value)} className="h-8 text-xs rounded-xl" />
          </div>
          <Button
            onClick={() => generateMut.mutate()}
            disabled={!genAptId || generateMut.isPending}
            className="h-8 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs gap-1"
          >
            {generateMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Generuj
          </Button>
        </div>
      </div>

      {/* Filtry i akcje */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={aptId} onValueChange={setAptId}>
          <SelectTrigger className="h-8 w-48 rounded-xl text-xs"><SelectValue placeholder="Apartament" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {apartments.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 rounded-xl text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            <SelectItem value="pending">Oczekujące</SelectItem>
            <SelectItem value="applied">Zastosowane</SelectItem>
            <SelectItem value="dismissed">Odrzucone</SelectItem>
          </SelectContent>
        </Select>
        {pendingCount > 0 && (
          <Button
            variant="outline" size="sm"
            className="h-8 rounded-xl text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 gap-1"
            onClick={() => applyAllMut.mutate()}
            disabled={applyAllMut.isPending}
          >
            {applyAllMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Zastosuj wszystkie ({pendingCount})
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Select value={apartments[0] ? "" : ""} onValueChange={openConfig}>
            <SelectTrigger className="h-8 w-44 rounded-xl text-xs">
              <span className="flex items-center gap-1.5"><Settings2 className="h-3.5 w-3.5" />Konfiguracja AI</span>
            </SelectTrigger>
            <SelectContent>
              {apartments.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista rekomendacji */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />Ładowanie...
        </div>
      ) : (data?.data || []).length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>Brak rekomendacji. Wygeneruj je powyżej.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {(data?.data || []).map(rec => {
            const diff = Number(rec.recommended_price) - Number(rec.current_price);
            const diffPct = Number(rec.current_price) > 0
              ? ((diff / Number(rec.current_price)) * 100).toFixed(1)
              : "0";
            const conf = Number(rec.confidence || 0.7);
            return (
              <div key={rec.id} className={cn(
                "rounded-xl border p-3 flex items-start gap-3 transition-colors",
                rec.status === "applied" ? "bg-emerald-500/5 border-emerald-500/20" :
                rec.status === "dismissed" ? "opacity-50 border-dashed" : "bg-card border-border/50 hover:border-violet-500/30"
              )}>
                {/* Data + apartament */}
                <div className="shrink-0 w-24 text-center">
                  <div className="text-sm font-semibold">{format(parseISO(rec.date), "dd.MM.yyyy")}</div>
                  <div className="text-[10px] text-muted-foreground truncate max-w-[96px]">{rec.apartment_name || `#${rec.apartment_id}`}</div>
                </div>

                {/* Ceny */}
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">Obecna</div>
                    <div className="text-sm text-muted-foreground">{Math.round(Number(rec.current_price))} PLN</div>
                  </div>
                  <div className={cn("flex items-center gap-0.5 text-xs font-semibold", diff > 0 ? "text-emerald-500" : diff < 0 ? "text-red-500" : "text-muted-foreground")}>
                    {diff > 0 ? <ArrowUp className="h-3 w-3" /> : diff < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                    {diffPct}%
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">Rekomendacja</div>
                    <div className="text-sm font-bold text-violet-400">{Math.round(Number(rec.recommended_price))} PLN</div>
                  </div>
                </div>

                {/* Szczegóły */}
                <div className="flex-1 min-w-0">
                  {rec.reasoning && (
                    <p className="text-[11px] text-muted-foreground truncate">{rec.reasoning}</p>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {rec.factors && rec.factors.split(",").map((f, i) => (
                      <span key={i} className="text-[10px] bg-muted rounded-md px-1.5 py-0.5">{f.trim()}</span>
                    ))}
                    <span className={cn("text-[10px] font-medium", CONFIDENCE_COLOR(conf))}>
                      {Math.round(conf * 100)}% pewność
                    </span>
                  </div>
                </div>

                {/* Status + akcje */}
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className={cn("text-[10px] px-2 py-0.5 rounded-full border", STATUS_BADGE[rec.status] || STATUS_BADGE.pending)}>
                    {rec.status === "pending" ? "Oczekuje" : rec.status === "applied" ? "Zastosowano" : "Odrzucono"}
                  </span>
                  {rec.status === "pending" && (
                    <>
                      <Button size="icon" variant="ghost" className="h-6 w-6 rounded-lg text-emerald-500 hover:bg-emerald-500/10"
                        onClick={() => applyMut.mutate(rec.id)} disabled={applyMut.isPending}
                        data-testid={`btn-apply-rec-${rec.id}`}>
                        <ThumbsUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 rounded-lg text-muted-foreground hover:bg-muted"
                        onClick={() => dismissMut.mutate(rec.id)} disabled={dismissMut.isPending}
                        data-testid={`btn-dismiss-rec-${rec.id}`}>
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <div className="text-xs text-muted-foreground text-center pt-1">Łącznie: {data?.total || 0}</div>
        </div>
      )}

      {/* Dialog konfiguracji */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle className="text-sm">Konfiguracja AI — {apartments.find(a => String(a.id) === configAptId)?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Tryb automatyczny</Label>
                <p className="text-[11px] text-muted-foreground">Ceny aplikowane automatycznie co noc</p>
              </div>
              <Switch checked={configAutoMode} onCheckedChange={setConfigAutoMode} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Maks. zmiana (%)</Label>
                <Input value={configMaxChange} onChange={e => setConfigMaxChange(e.target.value)} className="h-8 rounded-xl text-xs" type="number" min="1" max="100" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Dni do przodu</Label>
                <Input value={configDaysAhead} onChange={e => setConfigDaysAhead(e.target.value)} className="h-8 rounded-xl text-xs" type="number" min="7" max="365" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Min. cena (PLN)</Label>
                <Input value={configMinPrice} onChange={e => setConfigMinPrice(e.target.value)} className="h-8 rounded-xl text-xs" type="number" placeholder="brak" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Maks. cena (PLN)</Label>
                <Input value={configMaxPrice} onChange={e => setConfigMaxPrice(e.target.value)} className="h-8 rounded-xl text-xs" type="number" placeholder="brak" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setConfigOpen(false)}>Anuluj</Button>
            <Button size="sm" className="rounded-xl" onClick={() => saveConfigMut.mutate()} disabled={saveConfigMut.isPending}>
              {saveConfigMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Calendar Tab ─────────────────────────────────────────────────────────────
interface CalendarTabProps {
  apartments: Apartment[];
  priceMap: Record<number, Record<string, DailyPrice>>;
  reservedMap: Record<number, Set<string>>;
  aptPriceRange: Record<number, { min: number; max: number }>;
  alertMap: Record<number, number>;
  currentDate: Date;
  viewMode: "month" | "year";
  onMonthClick: (m: Date) => void;
  from: string; to: string;
}

function CalendarTab({ apartments, priceMap, reservedMap, aptPriceRange, alertMap, currentDate, viewMode, onMonthClick, from, to }: CalendarTabProps) {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [shiftAnchor, setShiftAnchor] = useState<string | null>(null);
  const [copySourceId, setCopySourceId] = useState<number | null>(null);
  const [editCell, setEditCell] = useState<{ apartmentId: number; date: string } | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [copyDialogData, setCopyDialogData] = useState<{ fromId: number; toIds: number[] } | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentDate);

  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month, i + 1);
    return { day: i + 1, date: format(d, "yyyy-MM-dd"), dow: getDay(d) };
  }), [year, month, daysInMonth]);

  const months12 = useMemo(() => Array.from({ length: 12 }, (_, i) => new Date(year, i, 1)), [year]);

  // Save single price
  const saveMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/pricing/daily", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pricing/daily"] }); qc.invalidateQueries({ queryKey: ["/api/pricing/alerts"] }); },
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  // Bulk save
  const batchMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/pricing/daily/batch", data),
    onSuccess: async (res: any) => { const r = await res.json(); qc.invalidateQueries({ queryKey: ["/api/pricing/daily"] }); qc.invalidateQueries({ queryKey: ["/api/pricing/alerts"] }); toast({ title: `Zapisano ${r.inserted} cen` }); setSelectedCells(new Set()); setBulkDialogOpen(false); },
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  // Delete price
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pricing/daily/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pricing/daily"] }); qc.invalidateQueries({ queryKey: ["/api/pricing/alerts"] }); },
  });

  // Copy prices
  const copyMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/pricing/daily/copy", data),
    onSuccess: async (res: any) => { const r = await res.json(); qc.invalidateQueries({ queryKey: ["/api/pricing/daily"] }); toast({ title: `Skopiowano ${r.copied} cen` }); setCopySourceId(null); setCopyDialogData(null); },
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const handleCellClick = useCallback((aptId: number, dateStr: string, e: React.MouseEvent) => {
    if (copySourceId !== null) {
      if (aptId === copySourceId) { setCopySourceId(null); return; }
      setCopyDialogData({ fromId: copySourceId, toIds: [aptId] });
      return;
    }
    const key = `${aptId}-${dateStr}`;
    if (e.shiftKey && shiftAnchor) {
      // Range select
      const anchorParts = shiftAnchor.split("-");
      const anchorAptId = Number(anchorParts[0]);
      const anchorDate = anchorParts.slice(1).join("-");
      if (anchorAptId === aptId) {
        const d1 = anchorDate < dateStr ? anchorDate : dateStr;
        const d2 = anchorDate < dateStr ? dateStr : anchorDate;
        const newSel = new Set(selectedCells);
        for (const { date } of days) {
          if (date >= d1 && date <= d2) newSel.add(`${aptId}-${date}`);
        }
        setSelectedCells(newSel);
      }
    } else if (e.shiftKey) {
      const newSel = new Set(selectedCells);
      if (newSel.has(key)) newSel.delete(key); else newSel.add(key);
      setSelectedCells(newSel);
    } else {
      setShiftAnchor(key);
      setEditCell({ apartmentId: aptId, date: dateStr });
    }
  }, [copySourceId, shiftAnchor, selectedCells, days]);

  const handleAptHeaderClick = (aptId: number) => {
    if (copySourceId === aptId) { setCopySourceId(null); return; }
    setCopySourceId(aptId);
    toast({ title: "Tryb kopiowania", description: "Kliknij wiersz docelowy aby skopiować ceny" });
  };

  const handleSelectAllRow = (aptId: number) => {
    const newSel = new Set(selectedCells);
    const rowKeys = days.map(d => `${aptId}-${d.date}`);
    const allSelected = rowKeys.every(k => newSel.has(k));
    if (allSelected) rowKeys.forEach(k => newSel.delete(k));
    else rowKeys.forEach(k => newSel.add(k));
    setSelectedCells(newSel);
  };

  const DOW_LABELS = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
  const isWeekend = (dow: number) => dow === 0 || dow === 5 || dow === 6;

  if (viewMode === "year") {
    // Year view: 12 months grid
    return (
      <div className="px-4 sm:px-6 pb-6 overflow-y-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-2">
          {months12.map((m, mi) => {
            const mFrom = format(startOfMonth(m), "yyyy-MM-dd");
            const mTo = format(endOfMonth(m), "yyyy-MM-dd");
            const mPrices = Object.values(priceMap).flatMap(aptMap =>
              Object.entries(aptMap).filter(([d]) => d >= mFrom && d <= mTo).map(([, p]) => Number(p.price))
            );
            const avgPrice = mPrices.length ? Math.round(mPrices.reduce((a, b) => a + b, 0) / mPrices.length) : null;
            const setPrices = mPrices.length;
            return (
              <button key={mi} onClick={() => onMonthClick(m)}
                className="bg-card border border-border/60 rounded-2xl p-4 text-left hover:border-cyan-400/60 hover:shadow-md transition-all duration-150 group">
                <div className="text-sm font-semibold capitalize text-foreground group-hover:text-cyan-400 transition-colors">
                  {format(m, "LLLL", { locale: pl })}
                </div>
                {avgPrice !== null ? (
                  <div className="mt-2">
                    <div className="text-xl font-bold text-foreground">{avgPrice} <span className="text-xs text-muted-foreground">PLN</span></div>
                    <div className="text-xs text-muted-foreground mt-1">śr. cena · {setPrices} rekordów</div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground mt-2">Brak cen</div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Month view: grid
  return (
    <div className="flex flex-col h-full">
      {/* Bulk action bar */}
      {selectedCells.size > 0 && (
        <div className="mx-4 sm:mx-6 mb-2 bg-primary text-primary-foreground rounded-2xl shadow-lg px-4 py-2 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">Zaznaczono: {selectedCells.size}</span>
          <Button size="sm" variant="secondary" className="h-7 rounded-lg text-xs" onClick={() => setBulkDialogOpen(true)}>
            <Edit2 className="h-3 w-3 mr-1" />Ustaw cenę
          </Button>
          <Button size="sm" variant="secondary" className="h-7 rounded-lg text-xs" onClick={() => {
            const toDelete = Array.from(selectedCells).map(k => {
              const [aptId, ...dateParts] = k.split("-");
              const date = dateParts.join("-");
              return priceMap[Number(aptId)]?.[date]?.id;
            }).filter(Boolean) as number[];
            Promise.all(toDelete.map(id => deleteMutation.mutateAsync(id))).then(() => {
              qc.invalidateQueries({ queryKey: ["/api/pricing/daily"] });
              qc.invalidateQueries({ queryKey: ["/api/pricing/alerts"] });
              setSelectedCells(new Set());
              toast({ title: `Usunięto ${toDelete.length} cen` });
            });
          }}>
            <Trash2 className="h-3 w-3 mr-1" />Wyczyść
          </Button>
          <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/20"
            onClick={() => setSelectedCells(new Set())}><X className="h-3 w-3" /></Button>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-auto px-4 sm:px-6 pb-6">
        <div className="relative">
          <table className="border-collapse" style={{ tableLayout: "fixed" }}>
            <thead>
              <tr>
                {/* Apt name header */}
                <th className="sticky left-0 z-20 bg-background/95 backdrop-blur-sm w-40 min-w-40 border-b border-border/40 pb-1 pr-2 text-left">
                  <span className="text-xs text-muted-foreground font-medium">Apartament</span>
                </th>
                {/* Day headers */}
                {days.map(({ day, date, dow }) => (
                  <th key={day} className={cn(
                    "border-b border-border/40 pb-1 min-w-[52px] w-[52px]",
                    isWeekend(dow) ? "bg-muted/30" : ""
                  )}>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] text-muted-foreground">{DOW_LABELS[dow]}</span>
                      <span className={cn("text-xs font-semibold", isWeekend(dow) ? "text-cyan-500" : "text-foreground")}>{day}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Group apartments by location for display
                const locationMap: Record<string, typeof apartments> = {};
                const groupOrder: string[] = [];
                for (const apt of apartments) {
                  const loc = apt.location?.trim() || "Pozostałe";
                  if (!locationMap[loc]) { locationMap[loc] = []; groupOrder.push(loc); }
                  locationMap[loc].push(apt);
                }
                // Named locations alphabetically, "Pozostałe" always last
                groupOrder.sort((a, b) => {
                  if (a === "Pozostałe") return 1;
                  if (b === "Pozostałe") return -1;
                  return a.localeCompare(b, "pl");
                });
                const showGroupHeaders = groupOrder.length > 1 || (groupOrder.length === 1 && groupOrder[0] !== "Pozostałe");
                return groupOrder.flatMap(location => [
                  ...(showGroupHeaders ? [
                    <tr key={`loc-header-${location}`}>
                      <td className="sticky left-0 z-10 bg-muted/40 pt-2 pb-1 pr-2">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{location}</span>
                      </td>
                      <td colSpan={days.length} className="bg-muted/40 pt-2 pb-1 border-b border-border/30" />
                    </tr>
                  ] : []),
                  ...locationMap[location].map(apt => {
                const { min, max } = aptPriceRange[apt.id] || { min: 0, max: 0 };
                const health = alertMap[apt.id];
                const isCopySource = copySourceId === apt.id;
                return (
                  <tr key={apt.id} className={cn("group/row", isCopySource ? "ring-2 ring-inset ring-cyan-400" : "")}>
                    {/* Apt name cell */}
                    <td className={cn(
                      "sticky left-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/20 pr-2 py-0.5",
                      isCopySource ? "bg-cyan-950/30" : ""
                    )}>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate leading-tight">{apt.name}</div>
                          {health !== undefined && health < 100 && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className="h-1 rounded-full bg-muted flex-1 max-w-[60px]">
                                <div className={cn("h-1 rounded-full", health >= 70 ? "bg-emerald-500" : health >= 40 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${health}%` }} />
                              </div>
                              <span className="text-[9px] text-muted-foreground">{health}%</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleAptHeaderClick(apt.id)}
                          title={isCopySource ? "Anuluj kopiowanie" : "Kopiuj ceny z tego apartamentu"}
                          className={cn("shrink-0 h-5 w-5 rounded flex items-center justify-center transition-colors",
                            isCopySource ? "bg-cyan-500 text-white" : "opacity-0 group-hover/row:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground"
                          )}>
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleSelectAllRow(apt.id)}
                          title="Zaznacz cały wiersz"
                          className="shrink-0 h-5 w-5 rounded flex items-center justify-center opacity-0 group-hover/row:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <CheckSquare className="h-3 w-3" />
                        </button>
                      </div>
                    </td>

                    {/* Day cells */}
                    {days.map(({ day, date, dow }) => {
                      const dp = priceMap[apt.id]?.[date];
                      const isReserved = reservedMap[apt.id]?.has(date);
                      const isSelected = selectedCells.has(`${apt.id}-${date}`);
                      const price = dp ? Number(dp.price) : null;
                      const bg = dp && !isReserved ? getPriceColor(price!, min, max) : undefined;
                      const textC = dp && !isReserved ? getTextColor(price!, min, max) : undefined;

                      return (
                        <td key={day}
                          onClick={(e) => !isReserved && handleCellClick(apt.id, date, e)}
                          className={cn(
                            "border border-border/15 py-0.5 px-0 text-center transition-all duration-100",
                            isWeekend(dow) ? "bg-muted/20" : "",
                            isReserved ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                            isSelected ? "ring-2 ring-inset ring-primary" : "",
                            !isReserved && !dp ? "hover:bg-muted/50" : "",
                            !isReserved && dp ? "hover:scale-105 hover:z-10 hover:shadow-md" : "",
                            copySourceId && !isReserved && apt.id !== copySourceId ? "hover:ring-2 hover:ring-cyan-400/70 ring-inset" : "",
                          )}
                          style={{ backgroundColor: isSelected ? undefined : bg }}>
                          {isReserved ? (
                            <span className="text-[10px] text-muted-foreground">🔒</span>
                          ) : dp ? (
                            <div style={{ color: textC }} className="flex flex-col items-center leading-none">
                              <span className="text-[11px] font-semibold">{Math.round(Number(dp.price))}</span>
                              {dp.min_stay && dp.min_stay > 1 && (
                                <span className="text-[8px] opacity-75">{dp.min_stay}n</span>
                              )}
                              {dp.note && <span className="text-[8px]">📌</span>}
                            </div>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
                  })
                ]);
              })()}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-6 rounded" style={{ background: "linear-gradient(to right, hsl(210,60%,62%), hsl(120,65%,58%), hsl(0,70%,60%))" }} />
            <span className="text-xs text-muted-foreground">Niska → Wysoka cena (per apartament)</span>
          </div>
          <div className="flex items-center gap-1"><span className="text-sm">🔒</span><span className="text-xs text-muted-foreground">Zarezerwowane</span></div>
          <div className="flex items-center gap-1"><span className="text-sm">📌</span><span className="text-xs text-muted-foreground">Notatka</span></div>
        </div>
      </div>

      {/* Single cell edit popover */}
      {editCell && (
        <PriceEditDialog
          open={!!editCell}
          onClose={() => setEditCell(null)}
          apartmentId={editCell.apartmentId}
          date={editCell.date}
          existing={priceMap[editCell.apartmentId]?.[editCell.date]}
          onSave={(data) => {
            saveMutation.mutate(data);
            setEditCell(null);
          }}
          onDelete={(id) => {
            deleteMutation.mutate(id);
            setEditCell(null);
          }}
          isPending={saveMutation.isPending}
        />
      )}

      {/* Bulk edit dialog */}
      <BulkPriceDialog
        open={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        selectedCells={selectedCells}
        from={from} to={to}
        apartments={apartments}
        onSave={(entries) => batchMutation.mutate({ entries })}
        isPending={batchMutation.isPending}
      />

      {/* Copy dialog */}
      {copyDialogData && (
        <CopyPricesDialog
          open={!!copyDialogData}
          fromApartmentId={copyDialogData.fromId}
          toApartmentIds={copyDialogData.toIds}
          apartments={apartments}
          from={from} to={to}
          onClose={() => { setCopyDialogData(null); setCopySourceId(null); }}
          onConfirm={(data) => copyMutation.mutate(data)}
          isPending={copyMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── Price Edit Dialog ────────────────────────────────────────────────────────
function PriceEditDialog({ open, onClose, apartmentId, date, existing, onSave, onDelete, isPending }: any) {
  const [price, setPrice] = useState(existing ? Math.round(Number(existing.price)).toString() : "");
  const [minStay, setMinStay] = useState((existing?.min_stay || 1).toString());
  const [isBlocked, setIsBlocked] = useState(existing?.is_blocked || false);
  const [note, setNote] = useState(existing?.note || "");
  const [cta, setCta] = useState(existing?.closed_to_arrival || false);
  const [ctd, setCtd] = useState(existing?.closed_to_departure || false);

  const dateLabel = useMemo(() => {
    try { return format(parseISO(date), "EEEE, d LLLL yyyy", { locale: pl }); } catch { return date; }
  }, [date]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base capitalize">{dateLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Cena PLN</Label>
              <Input value={price} onChange={e => setPrice(e.target.value)} type="number" placeholder="0" className="mt-1 h-10 text-lg font-bold rounded-xl" autoFocus />
            </div>
            <div className="w-20">
              <Label className="text-xs text-muted-foreground">Min pobyt</Label>
              <Input value={minStay} onChange={e => setMinStay(e.target.value)} type="number" min={1} className="mt-1 h-10 rounded-xl" />
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Notatka (opcjonalna)</Label>
            <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Np. Festiwal, targi..." rows={2} className="mt-1 rounded-xl resize-none text-sm" />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Switch checked={isBlocked} onCheckedChange={setIsBlocked} id="blocked" /><Label htmlFor="blocked" className="text-xs">Zablokowane</Label></div>
            <div className="flex items-center gap-2"><Switch checked={cta} onCheckedChange={setCta} id="cta" /><Label htmlFor="cta" className="text-xs">CTA</Label></div>
            <div className="flex items-center gap-2"><Switch checked={ctd} onCheckedChange={setCtd} id="ctd" /><Label htmlFor="ctd" className="text-xs">CTD</Label></div>
          </div>
        </div>
        <DialogFooter className="flex-row gap-2">
          {existing && <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive rounded-xl" onClick={() => onDelete(existing.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Usuń</Button>}
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl">Anuluj</Button>
          <Button size="sm" disabled={isPending || !price} className="rounded-xl"
            onClick={() => onSave({ apartmentId, date, price: Number(price), minStay: Number(minStay), isBlocked, closedToArrival: cta, closedToDeparture: ctd, note: note || null })}>
            {isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1" />}Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk Price Dialog ────────────────────────────────────────────────────────
function BulkPriceDialog({ open, onClose, selectedCells, from, to, apartments, onSave, isPending }: any) {
  const [price, setPrice] = useState("");
  const [minStay, setMinStay] = useState("1");
  const [overwrite, setOverwrite] = useState(true);

  const entries = useMemo(() => {
    return Array.from(selectedCells as Set<string>).map(k => {
      const [aptId, ...dateParts] = k.split("-");
      return { apartmentId: Number(aptId), date: dateParts.join("-"), price: Number(price), minStay: Number(minStay) };
    });
  }, [selectedCells, price, minStay]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle>Ustaw cenę masowo</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="text-sm text-muted-foreground">Zaznaczono <strong>{(selectedCells as Set<string>).size}</strong> komórek</div>
          <div>
            <Label className="text-xs text-muted-foreground">Cena PLN</Label>
            <Input value={price} onChange={e => setPrice(e.target.value)} type="number" placeholder="0" className="mt-1 h-10 text-lg font-bold rounded-xl" autoFocus />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Min pobyt (noce)</Label>
            <Input value={minStay} onChange={e => setMinStay(e.target.value)} type="number" min={1} className="mt-1 rounded-xl" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={overwrite} onCheckedChange={setOverwrite} id="ow" />
            <Label htmlFor="ow" className="text-xs">{overwrite ? "Nadpisz wszystkie" : "Uzupełnij tylko puste"}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Anuluj</Button>
          <Button disabled={isPending || !price} className="rounded-xl" onClick={() => onSave(entries.map(e => ({ ...e, overwrite })))}>
            {isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Zapisz {entries.length} cen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Copy Prices Dialog ───────────────────────────────────────────────────────
function CopyPricesDialog({ open, fromApartmentId, toApartmentIds, apartments, from, to, onClose, onConfirm, isPending }: any) {
  const [overwrite, setOverwrite] = useState(false);
  const fromApt = apartments.find((a: Apartment) => a.id === fromApartmentId);
  const toApts = apartments.filter((a: Apartment) => toApartmentIds.includes(a.id));
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle>Kopiuj ceny</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1 text-sm">
          <div>Z: <strong>{fromApt?.name}</strong></div>
          <div>Do: <strong>{toApts.map((a: Apartment) => a.name).join(", ")}</strong></div>
          <div>Zakres: <strong>{from} → {to}</strong></div>
          <div className="flex items-center gap-2">
            <Switch checked={overwrite} onCheckedChange={setOverwrite} id="cpo" />
            <Label htmlFor="cpo" className="text-xs">{overwrite ? "Nadpisz wszystkie dni" : "Kopiuj tylko brakujące dni (—)"}</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Anuluj</Button>
          <Button disabled={isPending} className="rounded-xl"
            onClick={() => onConfirm({ fromApartmentId, toApartmentIds, from, to, overwrite })}>
            {isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}Kopiuj ceny
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────
function RulesTab({ apartments }: { apartments: Apartment[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRule, setEditRule] = useState<PricingRule | null>(null);
  const [applyDialogRule, setApplyDialogRule] = useState<PricingRule | null>(null);

  const { data: rules = [], isLoading } = useQuery<PricingRule[]>({
    queryKey: ["/api/pricing/rules"],
    queryFn: () => fetch("/api/pricing/rules", { credentials: "include" }).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pricing/rules/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pricing/rules"] }); toast({ title: "Reguła usunięta" }); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => apiRequest("PUT", `/api/pricing/rules/${id}`, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/pricing/rules"] }),
  });

  const TYPE_LABELS: Record<string, string> = { season: "🏖️ Sezon", day_of_week: "📅 Dzień tygodnia", min_stay: "🌙 Min pobyt", lead_time: "⏱️ Wyprzedzenie", orphan: "✂️ Dni osierocone" };
  const DOW = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Reguły cenowe</h2>
        <Button size="sm" className="rounded-xl" onClick={() => { setEditRule(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" />Dodaj regułę
        </Button>
      </div>
      {isLoading ? <div className="text-sm text-muted-foreground">Ładowanie...</div> :
        rules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Brak reguł cenowych</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...rules].sort((a, b) => b.priority - a.priority).map((rule, i) => (
              <div key={rule.id} className={cn("bg-card border rounded-2xl px-4 py-3 flex items-start gap-3 transition-opacity", !rule.active && "opacity-50")}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{rule.name}</span>
                    <Badge variant="outline" className="text-xs rounded-lg">{TYPE_LABELS[rule.type] || rule.type}</Badge>
                    <Badge variant={rule.active ? "default" : "secondary"} className="text-xs rounded-lg">{rule.active ? "Aktywna" : "Nieaktywna"}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                    {rule.date_from && <span>{rule.date_from} → {rule.date_to}</span>}
                    {rule.day_of_week && <span>Dni: {rule.day_of_week.map(d => DOW[d]).join(", ")}</span>}
                    <span>{rule.modifier_type === "percentage" ? `${Number(rule.modifier) > 0 ? "+" : ""}${rule.modifier}%` : `${Number(rule.modifier) > 0 ? "+" : ""}${rule.modifier} PLN`}</span>
                    {rule.min_stay_rule && <span>Min {rule.min_stay_rule} nocy</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={rule.active} onCheckedChange={(v) => toggleMutation.mutate({ id: rule.id, active: v })} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setApplyDialogRule(rule)} title="Zastosuj regułę">
                    <Play className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => { setEditRule(rule); setDialogOpen(true); }}>
                    <Edit2 className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(rule.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      }
      <RuleDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditRule(null); }} editRule={editRule} apartments={apartments} />
      {applyDialogRule && (
        <ApplyRuleDialog open={!!applyDialogRule} rule={applyDialogRule} apartments={apartments}
          onClose={() => setApplyDialogRule(null)} />
      )}
    </div>
  );
}

function RuleDialog({ open, onClose, editRule, apartments }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(editRule?.name || "");
  const [type, setType] = useState(editRule?.type || "season");
  const [dateFrom, setDateFrom] = useState(editRule?.date_from || "");
  const [dateTo, setDateTo] = useState(editRule?.date_to || "");
  const [modifier, setModifier] = useState(editRule?.modifier?.toString() || "0");
  const [modType, setModType] = useState(editRule?.modifier_type || "percentage");
  const [priority, setPriority] = useState((editRule?.priority || 0).toString());
  const [minStay, setMinStay] = useState((editRule?.min_stay_rule || "").toString());
  const [selDays, setSelDays] = useState<number[]>(editRule?.day_of_week || []);
  const [selApts, setSelApts] = useState<number[]>(editRule?.apartment_ids || []);

  const saveMutation = useMutation({
    mutationFn: (data: any) => editRule
      ? apiRequest("PUT", `/api/pricing/rules/${editRule.id}`, data)
      : apiRequest("POST", "/api/pricing/rules", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pricing/rules"] }); toast({ title: editRule ? "Reguła zaktualizowana" : "Reguła dodana" }); onClose(); },
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const DOW = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
  const toggleDay = (d: number) => setSelDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const toggleApt = (id: number) => setSelApts(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editRule ? "Edytuj regułę" : "Nowa reguła cenowa"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div><Label className="text-xs text-muted-foreground">Nazwa</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1 rounded-xl" /></div>
          <div>
            <Label className="text-xs text-muted-foreground">Typ reguły</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="season">🏖️ Sezon (zakres dat)</SelectItem>
                <SelectItem value="day_of_week">📅 Dzień tygodnia</SelectItem>
                <SelectItem value="min_stay">🌙 Minimalna długość pobytu</SelectItem>
                <SelectItem value="lead_time">⏱️ Wyprzedzenie (last-minute)</SelectItem>
                <SelectItem value="orphan">✂️ Dni osierocone</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(type === "season" || type === "lead_time") && (
            <div className="flex gap-2">
              <div className="flex-1"><Label className="text-xs text-muted-foreground">Od</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="mt-1 rounded-xl" /></div>
              <div className="flex-1"><Label className="text-xs text-muted-foreground">Do</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="mt-1 rounded-xl" /></div>
            </div>
          )}
          {type === "day_of_week" && (
            <div>
              <Label className="text-xs text-muted-foreground">Dni tygodnia</Label>
              <div className="flex gap-1 mt-1 flex-wrap">
                {DOW.map((d, i) => (
                  <button key={i} onClick={() => toggleDay(i)} className={cn("h-8 w-9 rounded-lg text-xs font-medium border transition-colors", selDays.includes(i) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>{d}</button>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Modyfikator</Label>
              <Input type="number" value={modifier} onChange={e => setModifier(e.target.value)} className="mt-1 rounded-xl" placeholder="np. 20 albo -10" />
            </div>
            <div className="w-32">
              <Label className="text-xs text-muted-foreground">Typ</Label>
              <Select value={modType} onValueChange={setModType}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">%</SelectItem>
                  <SelectItem value="fixed">PLN</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Min pobyt (opcjonalny)</Label>
            <Input type="number" min={1} value={minStay} onChange={e => setMinStay(e.target.value)} className="mt-1 rounded-xl" placeholder="np. 3" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Priorytet</Label>
            <Input type="number" value={priority} onChange={e => setPriority(e.target.value)} className="mt-1 rounded-xl" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Apartamenty (brak = wszystkie)</Label>
            <div className="mt-1 flex flex-wrap gap-1 max-h-32 overflow-y-auto p-1 border border-border/50 rounded-xl">
              {apartments.map((a: Apartment) => (
                <button key={a.id} onClick={() => toggleApt(a.id)} className={cn("text-xs px-2 py-1 rounded-lg border transition-colors", selApts.includes(a.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>{a.name}</button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Anuluj</Button>
          <Button disabled={saveMutation.isPending || !name} className="rounded-xl"
            onClick={() => saveMutation.mutate({ name, type, dateFrom: dateFrom || null, dateTo: dateTo || null, dayOfWeek: selDays.length ? selDays : null, modifier: Number(modifier), modifierType: modType, priority: Number(priority), active: true, minStayRule: minStay ? Number(minStay) : null, apartmentIds: selApts.length ? selApts : null })}>
            {saveMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyRuleDialog({ open, rule, apartments, onClose }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [from, setFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [basePrices, setBasePrices] = useState<Record<number, string>>({});

  const applyMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/pricing/rules/${rule.id}/apply`, { from, to, basePrices: Object.fromEntries(Object.entries(basePrices).map(([k, v]) => [k, Number(v)])) }),
    onSuccess: async (res: any) => { const r = await res.json(); qc.invalidateQueries({ queryKey: ["/api/pricing/daily"] }); toast({ title: `Zastosowano: ${r.inserted} cen` }); onClose(); },
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const relApts = rule.apartment_ids?.length ? apartments.filter((a: Apartment) => rule.apartment_ids.includes(a.id)) : apartments;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Zastosuj: {rule.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex gap-2">
            <div className="flex-1"><Label className="text-xs text-muted-foreground">Od</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 rounded-xl" /></div>
            <div className="flex-1"><Label className="text-xs text-muted-foreground">Do</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 rounded-xl" /></div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Cena bazowa per apartament (PLN)</Label>
            <div className="space-y-2 mt-1">
              {relApts.map((a: Apartment) => (
                <div key={a.id} className="flex items-center gap-2">
                  <span className="text-xs flex-1 truncate">{a.name}</span>
                  <Input type="number" value={basePrices[a.id] || ""} onChange={e => setBasePrices(p => ({ ...p, [a.id]: e.target.value }))}
                    className="w-24 h-8 rounded-lg text-sm" placeholder="0" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Anuluj</Button>
          <Button disabled={applyMutation.isPending} className="rounded-xl" onClick={() => applyMutation.mutate()}>
            {applyMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}Zastosuj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────
function TemplatesTab({ apartments }: { apartments: Apartment[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTmpl, setEditTmpl] = useState<PriceTemplate | null>(null);
  const [applyTmpl, setApplyTmpl] = useState<PriceTemplate | null>(null);

  const { data: templates = [] } = useQuery<PriceTemplate[]>({
    queryKey: ["/api/pricing/templates"],
    queryFn: () => fetch("/api/pricing/templates", { credentials: "include" }).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/pricing/templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pricing/templates"] }); toast({ title: "Szablon usunięty" }); },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Szablony cenowe</h2>
        <Button size="sm" className="rounded-xl" onClick={() => { setEditTmpl(null); setDialogOpen(true); }}>
          <Plus className="h-3.5 w-3.5 mr-1" />Nowy szablon
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Szablony pozwalają szybko przypisać zestawy cen do wielu apartamentów jednym kliknięciem.</p>
      {templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Brak szablonów</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="bg-card border border-border/60 rounded-2xl px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{t.name}</div>
                {t.description && <div className="text-xs text-muted-foreground mt-0.5">{t.description}</div>}
                <div className="text-xs text-muted-foreground mt-1">
                  {t.config?.basePrice ? `Cena bazowa: ${t.config.basePrice} PLN` : ""}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setApplyTmpl(t)} title="Zastosuj">
                  <Play className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => { setEditTmpl(t); setDialogOpen(true); }}>
                  <Edit2 className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <TemplateDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditTmpl(null); }} editTmpl={editTmpl} apartments={apartments} />
      {applyTmpl && (
        <ApplyTemplateDialog open={!!applyTmpl} template={applyTmpl} apartments={apartments} onClose={() => setApplyTmpl(null)} />
      )}
    </div>
  );
}

function TemplateDialog({ open, onClose, editTmpl, apartments }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState(editTmpl?.name || "");
  const [description, setDescription] = useState(editTmpl?.description || "");
  const [basePrice, setBasePrice] = useState(editTmpl?.config?.basePrice?.toString() || "");
  const [minStay, setMinStay] = useState((editTmpl?.config?.minStay || 1).toString());
  const [aptPrices, setAptPrices] = useState<Record<number, string>>(editTmpl?.config?.prices || {});

  const saveMutation = useMutation({
    mutationFn: (data: any) => editTmpl
      ? apiRequest("PUT", `/api/pricing/templates/${editTmpl.id}`, data)
      : apiRequest("POST", "/api/pricing/templates", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pricing/templates"] }); toast({ title: "Szablon zapisany" }); onClose(); },
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editTmpl ? "Edytuj szablon" : "Nowy szablon"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div><Label className="text-xs text-muted-foreground">Nazwa</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-1 rounded-xl" placeholder="Np. Lato 2026" /></div>
          <div><Label className="text-xs text-muted-foreground">Opis</Label><Input value={description} onChange={e => setDescription(e.target.value)} className="mt-1 rounded-xl" /></div>
          <div className="flex gap-2">
            <div className="flex-1"><Label className="text-xs text-muted-foreground">Cena bazowa (PLN)</Label><Input type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} className="mt-1 rounded-xl" /></div>
            <div className="w-28"><Label className="text-xs text-muted-foreground">Min pobyt</Label><Input type="number" min={1} value={minStay} onChange={e => setMinStay(e.target.value)} className="mt-1 rounded-xl" /></div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Ceny per apartament (opcjonalnie)</Label>
            <div className="space-y-1.5 mt-1">
              {apartments.map((a: Apartment) => (
                <div key={a.id} className="flex items-center gap-2">
                  <span className="text-xs flex-1 truncate">{a.name}</span>
                  <Input type="number" value={aptPrices[a.id] || ""} onChange={e => setAptPrices(p => ({ ...p, [a.id]: e.target.value }))}
                    className="w-24 h-8 rounded-lg text-sm" placeholder={basePrice || "0"} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Anuluj</Button>
          <Button disabled={saveMutation.isPending || !name} className="rounded-xl"
            onClick={() => saveMutation.mutate({ name, description, config: { basePrice: Number(basePrice) || null, minStay: Number(minStay), prices: Object.fromEntries(Object.entries(aptPrices).map(([k, v]) => [k, Number(v)])) } })}>
            {saveMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyTemplateDialog({ open, template, apartments, onClose }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [from, setFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(addMonths(new Date(), 2), "yyyy-MM-dd"));
  const [selApts, setSelApts] = useState<number[]>(apartments.map((a: Apartment) => a.id));
  const [overwrite, setOverwrite] = useState(false);

  const applyMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/pricing/templates/${template.id}/apply`, { apartmentIds: selApts, from, to, overwrite }),
    onSuccess: async (res: any) => { const r = await res.json(); qc.invalidateQueries({ queryKey: ["/api/pricing/daily"] }); toast({ title: `Zastosowano: ${r.inserted} cen` }); onClose(); },
    onError: (e: any) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm rounded-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Zastosuj: {template.name}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex gap-2">
            <div className="flex-1"><Label className="text-xs text-muted-foreground">Od</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1 rounded-xl" /></div>
            <div className="flex-1"><Label className="text-xs text-muted-foreground">Do</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1 rounded-xl" /></div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Apartamenty</Label>
            <div className="mt-1 flex flex-wrap gap-1">
              {apartments.map((a: Apartment) => (
                <button key={a.id} onClick={() => setSelApts(p => p.includes(a.id) ? p.filter(x => x !== a.id) : [...p, a.id])}
                  className={cn("text-xs px-2 py-1 rounded-lg border transition-colors", selApts.includes(a.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>{a.name}</button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={overwrite} onCheckedChange={setOverwrite} id="tow" /><Label htmlFor="tow" className="text-xs">{overwrite ? "Nadpisz istniejące ceny" : "Tylko puste dni"}</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Anuluj</Button>
          <Button disabled={applyMutation.isPending || selApts.length === 0} className="rounded-xl" onClick={() => applyMutation.mutate()}>
            {applyMutation.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}Zastosuj
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── HotRes Tab ───────────────────────────────────────────────────────────────
function HotresTab({ apartments }: { apartments: Apartment[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [pullFrom, setPullFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pullTo, setPullTo] = useState(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [pushFrom, setPushFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [pushTo, setPushTo] = useState(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [pushApts, setPushApts] = useState<number[]>([]);
  const [pullData, setPullData] = useState<any[] | null>(null);
  const [pullLoading, setPullLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResults, setPushResults] = useState<any[] | null>(null);

  const aptyWithHotres = apartments.filter(a => a.hotresTypeId);
  const aptyWithout = apartments.filter(a => !a.hotresTypeId);

  const handlePull = async () => {
    setPullLoading(true); setPullData(null);
    try {
      const r = await fetch(`/api/pricing/hotres/pull?from=${pullFrom}&to=${pullTo}`, { credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message);
      setPullData(data.data || []);
    } catch (e: any) { toast({ title: "Błąd", description: e.message, variant: "destructive" }); }
    setPullLoading(false);
  };

  const handlePush = async () => {
    if (pushApts.length === 0) { toast({ title: "Wybierz apartamenty" }); return; }
    setPushLoading(true); setPushResults(null);
    try {
      const r = await apiRequest("POST", "/api/pricing/hotres/push", { from: pushFrom, to: pushTo, apartmentIds: pushApts }) as any;
      setPushResults(r.results || []);
      qc.invalidateQueries({ queryKey: ["/api/pricing/daily"] });
      toast({ title: "Synchronizacja zakończona" });
    } catch (e: any) { toast({ title: "Błąd", description: e.message, variant: "destructive" }); }
    setPushLoading(false);
  };

  return (
    <div className="space-y-6">
      {aptyWithout.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 inline mr-1" />
          Brak hotresTypeId: {aptyWithout.map(a => a.name).join(", ")}
        </div>
      )}

      {/* Pull section */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Download className="h-4 w-4 text-cyan-400" />Pobierz ceny z HotRes</h3>
        <div className="flex gap-2 flex-wrap">
          <div><Label className="text-xs text-muted-foreground">Od</Label><Input type="date" value={pullFrom} onChange={e => setPullFrom(e.target.value)} className="mt-1 w-36 h-8 rounded-xl text-sm" /></div>
          <div><Label className="text-xs text-muted-foreground">Do</Label><Input type="date" value={pullTo} onChange={e => setPullTo(e.target.value)} className="mt-1 w-36 h-8 rounded-xl text-sm" /></div>
          <div className="flex items-end"><Button onClick={handlePull} disabled={pullLoading} className="h-8 rounded-xl">
            {pullLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Download className="h-3.5 w-3.5 mr-1" />}Pobierz z HotRes
          </Button></div>
        </div>
        {pullData && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-1 pr-3 text-muted-foreground">Apartament</th>
                  <th className="text-left py-1 pr-3 text-muted-foreground">Data</th>
                  <th className="text-right py-1 pr-3 text-muted-foreground">Nasza</th>
                  <th className="text-right py-1 pr-3 text-muted-foreground">HotRes</th>
                  <th className="text-right py-1 text-muted-foreground">Różnica</th>
                </tr>
              </thead>
              <tbody>
                {pullData.slice(0, 50).map((row, i) => (
                  <tr key={i} className="border-b border-border/20">
                    <td className="py-1 pr-3">{row.apartmentName}</td>
                    <td className="py-1 pr-3">{row.date}</td>
                    <td className="py-1 pr-3 text-right">{row.ourPrice != null ? `${row.ourPrice} PLN` : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-1 pr-3 text-right">{row.hotresPrice ? `${row.hotresPrice} PLN` : <span className="text-muted-foreground">—</span>}</td>
                    <td className={cn("py-1 text-right font-medium", row.diff === 0 ? "text-emerald-500" : row.diff != null ? (row.diff > 0 ? "text-amber-500" : "text-red-500") : "text-muted-foreground")}>
                      {row.diff != null ? (row.diff > 0 ? `+${row.diff}` : row.diff) : "—"}
                    </td>
                  </tr>
                ))}
                {pullData.length > 50 && <tr><td colSpan={5} className="text-center text-muted-foreground py-2">...i {pullData.length - 50} więcej</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Push section */}
      <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-3">
        <h3 className="font-semibold flex items-center gap-2"><Upload className="h-4 w-4 text-emerald-400" />Wyślij ceny do HotRes</h3>
        <div className="flex gap-2 flex-wrap">
          <div><Label className="text-xs text-muted-foreground">Od</Label><Input type="date" value={pushFrom} onChange={e => setPushFrom(e.target.value)} className="mt-1 w-36 h-8 rounded-xl text-sm" /></div>
          <div><Label className="text-xs text-muted-foreground">Do</Label><Input type="date" value={pushTo} onChange={e => setPushTo(e.target.value)} className="mt-1 w-36 h-8 rounded-xl text-sm" /></div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Apartamenty</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {aptyWithHotres.map(a => (
              <button key={a.id} onClick={() => setPushApts(p => p.includes(a.id) ? p.filter(x => x !== a.id) : [...p, a.id])}
                className={cn("text-xs px-2 py-1 rounded-lg border transition-colors", pushApts.includes(a.id) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>{a.name}</button>
            ))}
          </div>
        </div>
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
          ⚠️ Wysyłka nadpisze ceny w HotRes (mode=delta). Dotyczy tylko wybranego planu cenowego per apartament.
        </div>
        <Button onClick={handlePush} disabled={pushLoading || pushApts.length === 0} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
          {pushLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}Wyślij do HotRes ↑
        </Button>
        {pushResults && (
          <div className="space-y-1.5">
            {pushResults.map((r, i) => (
              <div key={i} className={cn("text-xs px-3 py-2 rounded-xl flex items-center gap-2", r.error ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400")}>
                {r.error ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                <span>{r.apartmentName}: {r.error || `Wysłano ${r.sent} rekordów`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────
function HistoryTab({ apartments }: { apartments: Apartment[] }) {
  const [aptFilter, setAptFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data, isLoading } = useQuery<{ data: HistoryEntry[]; total: number }>({
    queryKey: ["/api/pricing/history", aptFilter, from, to, offset],
    queryFn: () => {
      const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
      if (aptFilter !== "all") params.set("apartmentId", aptFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return fetch(`/api/pricing/history?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const SOURCE_LABELS: Record<string, string> = { manual: "Ręcznie", rule: "Reguła", copy: "Kopia", template: "Szablon", derived: "Pochodna", bulk: "Masowe", hotres: "HotRes", excel: "Excel", "ai-auto": "AI auto" };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={aptFilter} onValueChange={(v) => { setAptFilter(v); setOffset(0); }}>
          <SelectTrigger className="h-8 w-48 rounded-xl text-xs"><SelectValue placeholder="Apartament" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {apartments.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="h-8 w-36 rounded-xl text-xs" placeholder="Od" />
        <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="h-8 w-36 rounded-xl text-xs" placeholder="Do" />
      </div>

      {isLoading ? <div className="text-sm text-muted-foreground">Ładowanie...</div> : (
        <>
          <div className="text-xs text-muted-foreground">Łącznie: {data?.total || 0} zmian</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Data zmiany</th>
                  <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Apartament</th>
                  <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Data cennika</th>
                  <th className="text-right py-1.5 pr-3 text-muted-foreground font-medium">Stara cena</th>
                  <th className="text-right py-1.5 pr-3 text-muted-foreground font-medium">Nowa cena</th>
                  <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Zmienił</th>
                  <th className="text-left py-1.5 text-muted-foreground font-medium">Źródło</th>
                </tr>
              </thead>
              <tbody>
                {(data?.data || []).map(row => (
                  <tr key={row.id} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                    <td className="py-1.5 pr-3 text-muted-foreground">{row.created_at ? format(new Date(row.created_at), "dd.MM HH:mm") : "—"}</td>
                    <td className="py-1.5 pr-3 font-medium truncate max-w-[120px]">{row.apartment_name || `#${row.apartment_id}`}</td>
                    <td className="py-1.5 pr-3">{row.date}</td>
                    <td className="py-1.5 pr-3 text-right text-muted-foreground">{row.old_price ? `${Math.round(Number(row.old_price))} PLN` : "—"}</td>
                    <td className="py-1.5 pr-3 text-right font-semibold">{Math.round(Number(row.new_price))} PLN</td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{row.changed_by || "—"}</td>
                    <td className="py-1.5"><Badge variant="outline" className="text-[10px] rounded-md">{SOURCE_LABELS[row.source || ""] || row.source || "—"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(data?.total || 0) > limit && (
            <div className="flex items-center gap-2 justify-center pt-2">
              <Button variant="outline" size="sm" className="rounded-xl" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <span className="text-xs text-muted-foreground">{Math.floor(offset / limit) + 1} / {Math.ceil((data?.total || 0) / limit)}</span>
              <Button variant="outline" size="sm" className="rounded-xl" disabled={offset + limit >= (data?.total || 0)} onClick={() => setOffset(offset + limit)}><ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
