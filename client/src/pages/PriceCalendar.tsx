import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isWeekend, isSameMonth } from "date-fns";
import { pl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Save, X, Filter, Download, Upload, History, RefreshCw, Loader2, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type ViewMode = "week" | "month";

interface DailyPrice {
  id: number;
  apartmentId: number;
  date: string;
  price: string;
  currency: string;
  source: string;
  minStay: number | null;
  maxStay: number | null;
  isBlocked: boolean;
  isAutoPrice: boolean;
  ruleId: number | null;
}

interface Apartment {
  id: number;
  name: string;
  location: string;
  active: boolean;
  minPrice: string | null;
  maxPrice: string | null;
  hotresTypeId: number | null;
  hotresRateId: number | null;
}

export default function PriceCalendar() {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [editingCell, setEditingCell] = useState<{ aptId: number; date: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectionStart, setSelectionStart] = useState<{ aptId: number; date: string } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyApartmentId, setHistoryApartmentId] = useState<number | null>(null);

  const [hotresImportDialogOpen, setHotresImportDialogOpen] = useState(false);
  const [hotresExportDialogOpen, setHotresExportDialogOpen] = useState(false);
  const [hotresPreview, setHotresPreview] = useState<any[]>([]);

  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkModifier, setBulkModifier] = useState("");
  const [bulkModifierType, setBulkModifierType] = useState("percentage");
  const [bulkMinStay, setBulkMinStay] = useState("");
  const [bulkIsBlocked, setBulkIsBlocked] = useState(false);

  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd"), days: eachDayOfInterval({ start, end }) };
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return { from: format(start, "yyyy-MM-dd"), to: format(end, "yyyy-MM-dd"), days: eachDayOfInterval({ start, end }) };
    }
  }, [currentDate, viewMode]);

  const { data: apartments = [] } = useQuery<Apartment[]>({
    queryKey: ["/api/apartments"],
  });

  const { data: prices = [], isLoading: pricesLoading } = useQuery<DailyPrice[]>({
    queryKey: ["/api/daily-prices", dateRange.from, dateRange.to],
    queryFn: async () => {
      const res = await fetch(`/api/daily-prices?from=${dateRange.from}&to=${dateRange.to}`);
      if (!res.ok) throw new Error("Failed to fetch prices");
      return res.json();
    },
  });

  const { data: priceHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/price-history", historyApartmentId],
    queryFn: async () => {
      if (!historyApartmentId) return [];
      const res = await fetch(`/api/price-history?apartmentId=${historyApartmentId}&from=${dateRange.from}&to=${dateRange.to}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    enabled: !!historyApartmentId,
  });

  const locations = useMemo(() => {
    const locs = new Set(apartments.map(a => a.location).filter(Boolean));
    return Array.from(locs).sort();
  }, [apartments]);

  const filteredApartments = useMemo(() => {
    return apartments
      .filter(a => a.active)
      .filter(a => locationFilter === "all" || a.location === locationFilter)
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [apartments, locationFilter]);

  const priceMap = useMemo(() => {
    const map = new Map<string, DailyPrice>();
    prices.forEach(p => map.set(`${p.apartmentId}-${p.date}`, p));
    return map;
  }, [prices]);

  const updatePriceMutation = useMutation({
    mutationFn: async (data: { apartmentId: number; date: string; price: number; reason?: string }) => {
      return apiRequest("PUT", "/api/daily-prices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-prices"] });
      toast({ title: "Cena zaktualizowana" });
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/daily-prices/bulk", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-prices"] });
      toast({ title: "Ceny zaktualizowane", description: `Zaktualizowano ${data.updated || 0} dni` });
      setBulkDialogOpen(false);
      setSelectedCells(new Set());
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const hotresImportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/hotres/import-prices", {
        from: dateRange.from,
        till: dateRange.to,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-prices"] });
      toast({ title: "Import z HotRes", description: data.message });
      setHotresImportDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Błąd importu HotRes", description: err.message, variant: "destructive" });
    },
  });

  const hotresExportMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/hotres/export-prices", {
        from: dateRange.from,
        till: dateRange.to,
        mode: "delta",
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Eksport do HotRes", description: data.message });
      setHotresExportDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Błąd eksportu HotRes", description: err.message, variant: "destructive" });
    },
  });

  const hotresPreviewMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/hotres/preview-prices", {
        from: dateRange.from,
        till: dateRange.to,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      setHotresPreview(data.preview || []);
      setHotresImportDialogOpen(true);
      if (data.errors?.length) {
        toast({
          title: "Częściowy podgląd",
          description: `Błędy dla ${data.errors.length} apartamentów`,
          variant: "destructive",
        });
      }
    },
    onError: (err: any) => {
      toast({ title: "Błąd podglądu", description: err.message, variant: "destructive" });
    },
  });

  const pricingEngineMutation = useMutation({
    mutationFn: async (dryRun: boolean) => {
      const res = await apiRequest("POST", "/api/pricing-engine/run", {
        dryRun,
        dateFrom: dateRange.from,
        dateTo: dateRange.to,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (!data.dryRun) {
        queryClient.invalidateQueries({ queryKey: ["/api/daily-prices"] });
      }
      toast({ title: data.dryRun ? "Podgląd reguł" : "Reguły zastosowane", description: data.message });
    },
    onError: (err: any) => {
      toast({ title: "Błąd silnika cenowego", description: err.message, variant: "destructive" });
    },
  });

  const navigateDate = (direction: number) => {
    if (viewMode === "week") {
      setCurrentDate(prev => addDays(prev, direction * 7));
    } else {
      setCurrentDate(prev => {
        const d = new Date(prev);
        d.setMonth(d.getMonth() + direction);
        return d;
      });
    }
  };

  const handleCellClick = (aptId: number, dateStr: string) => {
    if (editingCell?.aptId === aptId && editingCell?.date === dateStr) return;
    const existing = priceMap.get(`${aptId}-${dateStr}`);
    setEditingCell({ aptId, date: dateStr });
    setEditValue(existing ? existing.price : "");
  };

  const handleCellSave = () => {
    if (!editingCell || !editValue) return;
    updatePriceMutation.mutate({
      apartmentId: editingCell.aptId,
      date: editingCell.date,
      price: Number(editValue),
    });
    setEditingCell(null);
    setEditValue("");
  };

  const handleCellKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleCellSave();
    if (e.key === "Escape") { setEditingCell(null); setEditValue(""); }
  };

  const toggleCellSelection = (aptId: number, dateStr: string) => {
    const key = `${aptId}-${dateStr}`;
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleBulkApply = () => {
    if (selectedCells.size === 0) return;

    const cellsByApt = new Map<number, string[]>();
    selectedCells.forEach(key => {
      const [aptIdStr, dateStr] = key.split("-", 2);
      const aptId = Number(aptIdStr);
      const date = key.substring(aptIdStr.length + 1);
      if (!cellsByApt.has(aptId)) cellsByApt.set(aptId, []);
      cellsByApt.get(aptId)!.push(date);
    });

    const apartmentIds = Array.from(cellsByApt.keys());
    const allDates = Array.from(selectedCells).map(k => k.substring(k.indexOf("-") + 1)).sort();
    const dateFrom = allDates[0];
    const dateTo = allDates[allDates.length - 1];

    const data: any = { apartmentIds, dateFrom, dateTo, reason: "bulk edit" };
    if (bulkPrice) data.price = Number(bulkPrice);
    if (bulkModifier) { data.modifier = Number(bulkModifier); data.modifierType = bulkModifierType; }
    if (bulkMinStay) data.minStay = Number(bulkMinStay);
    data.isBlocked = bulkIsBlocked;

    bulkUpdateMutation.mutate(data);
  };

  const getSourceColor = (source: string, isBlocked: boolean) => {
    if (isBlocked) return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
    switch (source) {
      case "manual": return "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300";
      case "rule": return "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300";
      case "auto": return "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300";
      case "hotres": return "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300";
      default: return "bg-muted";
    }
  };

  return (
    <div className="space-y-4" data-testid="price-calendar-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Kalendarz cen</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-location-filter">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Lokalizacja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie lokalizacje</SelectItem>
              {locations.map(loc => (
                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              data-testid="button-view-week"
            >
              Tydzień
            </Button>
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              data-testid="button-view-month"
            >
              Miesiąc
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => hotresPreviewMutation.mutate()}
            disabled={hotresPreviewMutation.isPending}
            data-testid="button-hotres-import"
          >
            {hotresPreviewMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
            Pobierz z HotRes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHotresExportDialogOpen(true)}
            data-testid="button-hotres-export"
          >
            <Upload className="h-4 w-4 mr-1" />
            Wyślij do HotRes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => pricingEngineMutation.mutate(true)}
            disabled={pricingEngineMutation.isPending}
            data-testid="button-preview-rules"
          >
            {pricingEngineMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Podgląd reguł
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              if (confirm("Czy na pewno chcesz zastosować reguły cenowe? Ceny zostaną zmienione.")) {
                pricingEngineMutation.mutate(false);
              }
            }}
            disabled={pricingEngineMutation.isPending}
            data-testid="button-apply-rules"
          >
            {pricingEngineMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ArrowUpDown className="h-4 w-4 mr-1" />}
            Zastosuj reguły
          </Button>

          {selectedCells.size > 0 && (
            <Button onClick={() => setBulkDialogOpen(true)} variant="outline" data-testid="button-bulk-edit">
              <Pencil className="h-4 w-4 mr-1" />
              Edytuj ({selectedCells.size})
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateDate(-1)} data-testid="button-prev-period">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold" data-testid="text-current-period">
          {viewMode === "week"
            ? `${format(dateRange.days[0], "d MMM", { locale: pl })} — ${format(dateRange.days[dateRange.days.length - 1], "d MMM yyyy", { locale: pl })}`
            : format(currentDate, "LLLL yyyy", { locale: pl })
          }
        </h2>
        <Button variant="ghost" size="icon" onClick={() => navigateDate(1)} data-testid="button-next-period">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex gap-2 text-xs flex-wrap">
        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300">Ręczna</Badge>
        <Badge variant="outline" className="bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300">Reguła</Badge>
        <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">Auto</Badge>
        <Badge variant="outline" className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">Hotres</Badge>
        <Badge variant="outline" className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">Zablokowana</Badge>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {pricesLoading ? (
            <div className="p-8 text-center text-muted-foreground">Ładowanie...</div>
          ) : (
            <table className="w-full text-sm" data-testid="table-price-calendar">
              <thead>
                <tr className="border-b">
                  <th className="sticky left-0 bg-card z-10 px-3 py-2 text-left font-medium min-w-[140px]">Apartament</th>
                  {dateRange.days.map(day => {
                    const dayStr = format(day, "yyyy-MM-dd");
                    return (
                      <th
                        key={dayStr}
                        className={cn(
                          "px-1 py-2 text-center font-medium min-w-[60px]",
                          isToday(day) && "bg-yellow-100 dark:bg-yellow-900/30",
                          isWeekend(day) && "bg-muted/50"
                        )}
                      >
                        <div className="text-xs text-muted-foreground">
                          {format(day, "EEE", { locale: pl })}
                        </div>
                        <div>{format(day, "d")}</div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-center font-medium min-w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                {filteredApartments.map(apt => (
                  <tr key={apt.id} className="border-b hover:bg-muted/30">
                    <td className="sticky left-0 bg-card z-10 px-3 py-1 font-medium text-xs whitespace-nowrap">
                      <div>{apt.name}</div>
                      {(apt.minPrice || apt.maxPrice) && (
                        <div className="text-[10px] text-muted-foreground">
                          {apt.minPrice && `min: ${apt.minPrice}`}
                          {apt.minPrice && apt.maxPrice && " / "}
                          {apt.maxPrice && `max: ${apt.maxPrice}`}
                        </div>
                      )}
                    </td>
                    {dateRange.days.map(day => {
                      const dayStr = format(day, "yyyy-MM-dd");
                      const priceData = priceMap.get(`${apt.id}-${dayStr}`);
                      const isEditing = editingCell?.aptId === apt.id && editingCell?.date === dayStr;
                      const isSelected = selectedCells.has(`${apt.id}-${dayStr}`);

                      return (
                        <td
                          key={dayStr}
                          className={cn(
                            "px-0.5 py-0.5 text-center cursor-pointer border-r border-border/30",
                            isToday(day) && "bg-yellow-50/50 dark:bg-yellow-900/10",
                            isWeekend(day) && "bg-muted/30",
                            isSelected && "ring-2 ring-primary ring-inset"
                          )}
                          onClick={(e) => {
                            if (e.ctrlKey || e.metaKey) {
                              toggleCellSelection(apt.id, dayStr);
                            } else {
                              handleCellClick(apt.id, dayStr);
                            }
                          }}
                          data-testid={`cell-price-${apt.id}-${dayStr}`}
                        >
                          {isEditing ? (
                            <Input
                              autoFocus
                              type="number"
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={handleCellKeyDown}
                              onBlur={handleCellSave}
                              className="h-7 w-16 text-xs text-center mx-auto p-0.5"
                              data-testid={`input-price-${apt.id}-${dayStr}`}
                            />
                          ) : priceData ? (
                            <div
                              className={cn(
                                "rounded px-0.5 py-0.5 text-xs font-medium",
                                getSourceColor(priceData.source || "manual", priceData.isBlocked || false)
                              )}
                              data-testid={`text-price-${apt.id}-${dayStr}`}
                            >
                              {Number(priceData.price).toFixed(0)}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground/40">—</div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-1 py-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => { setHistoryApartmentId(apt.id); setHistoryDialogOpen(true); }}
                        data-testid={`button-history-${apt.id}`}
                      >
                        <History className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredApartments.length === 0 && (
                  <tr>
                    <td colSpan={dateRange.days.length + 2} className="p-8 text-center text-muted-foreground">
                      Brak apartamentów do wyświetlenia
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent data-testid="dialog-bulk-edit">
          <DialogHeader>
            <DialogTitle>Edycja grupowa ({selectedCells.size} komórek)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nowa cena (PLN)</Label>
              <Input
                type="number"
                value={bulkPrice}
                onChange={e => setBulkPrice(e.target.value)}
                placeholder="np. 350"
                data-testid="input-bulk-price"
              />
            </div>
            <div className="text-sm text-muted-foreground text-center">— lub —</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Modyfikator</Label>
                <Input
                  type="number"
                  value={bulkModifier}
                  onChange={e => setBulkModifier(e.target.value)}
                  placeholder="np. 10"
                  data-testid="input-bulk-modifier"
                />
              </div>
              <div>
                <Label>Typ</Label>
                <Select value={bulkModifierType} onValueChange={setBulkModifierType}>
                  <SelectTrigger data-testid="select-bulk-modifier-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Procent (%)</SelectItem>
                    <SelectItem value="fixed">Kwota (PLN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Min. pobyt (noce)</Label>
              <Input
                type="number"
                value={bulkMinStay}
                onChange={e => setBulkMinStay(e.target.value)}
                placeholder="np. 2"
                data-testid="input-bulk-min-stay"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={bulkIsBlocked} onCheckedChange={setBulkIsBlocked} data-testid="switch-bulk-blocked" />
              <Label>Zablokuj daty</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)} data-testid="button-bulk-cancel">Anuluj</Button>
            <Button onClick={handleBulkApply} disabled={bulkUpdateMutation.isPending} data-testid="button-bulk-apply">
              {bulkUpdateMutation.isPending ? "Zapisuję..." : "Zastosuj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-price-history">
          <DialogHeader>
            <DialogTitle>
              Historia zmian cen — {apartments.find(a => a.id === historyApartmentId)?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {priceHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Brak historii zmian</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 px-2">Data</th>
                    <th className="py-1 px-2">Stara</th>
                    <th className="py-1 px-2">Nowa</th>
                    <th className="py-1 px-2">Źródło</th>
                    <th className="py-1 px-2">Przez</th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.map((h: any) => (
                    <tr key={h.id} className="border-b text-xs">
                      <td className="py-1 px-2">{h.date}</td>
                      <td className="py-1 px-2">{h.oldPrice ? `${Number(h.oldPrice).toFixed(0)} zł` : "—"}</td>
                      <td className="py-1 px-2 font-medium">{Number(h.newPrice).toFixed(0)} zł</td>
                      <td className="py-1 px-2">
                        <Badge variant="outline" className="text-[10px]">{h.source}</Badge>
                      </td>
                      <td className="py-1 px-2 text-muted-foreground">{h.changedBy?.split("@")[0]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={hotresImportDialogOpen} onOpenChange={setHotresImportDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-hotres-import">
          <DialogHeader>
            <DialogTitle>
              <Download className="h-5 w-5 inline mr-2" />
              Pobierz ceny z HotRes ({dateRange.from} — {dateRange.to})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {hotresPreview.length > 0 ? (
              <div className="max-h-[300px] overflow-y-auto">
                <p className="text-sm text-muted-foreground mb-2">
                  Znaleziono {hotresPreview.length} różnic między cenami lokalnymi a HotRes:
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-1 px-2">Apartament</th>
                      <th className="py-1 px-2">Data</th>
                      <th className="py-1 px-2">Lokalna</th>
                      <th className="py-1 px-2">HotRes</th>
                      <th className="py-1 px-2">Różnica</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotresPreview.slice(0, 50).map((p: any, i: number) => (
                      <tr key={i} className="border-b text-xs">
                        <td className="py-1 px-2">{p.apartmentName}</td>
                        <td className="py-1 px-2">{p.date}</td>
                        <td className="py-1 px-2">{p.localPrice !== null ? `${p.localPrice} zł` : "—"}</td>
                        <td className="py-1 px-2 font-medium">{p.hotresPrice} zł</td>
                        <td className="py-1 px-2">
                          {p.diff !== null ? (
                            <span className={p.diff > 0 ? "text-green-600" : "text-red-600"}>
                              {p.diff > 0 ? "+" : ""}{p.diff.toFixed(0)} zł
                            </span>
                          ) : "nowa"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {hotresPreview.length > 50 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    ...i {hotresPreview.length - 50} więcej zmian
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                Brak różnic — ceny lokalne są zgodne z HotRes (lub brak apartamentów z hotresTypeId)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHotresImportDialogOpen(false)} data-testid="button-hotres-import-cancel">
              Anuluj
            </Button>
            <Button
              onClick={() => hotresImportMutation.mutate()}
              disabled={hotresImportMutation.isPending}
              data-testid="button-hotres-import-confirm"
            >
              {hotresImportMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              {hotresImportMutation.isPending ? "Importuję..." : "Importuj ceny"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={hotresExportDialogOpen} onOpenChange={setHotresExportDialogOpen}>
        <DialogContent data-testid="dialog-hotres-export">
          <DialogHeader>
            <DialogTitle>
              <Upload className="h-5 w-5 inline mr-2" />
              Wyślij ceny do HotRes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wyśle lokalne ceny z okresu <strong>{dateRange.from}</strong> — <strong>{dateRange.to}</strong> do
              systemu HotRes dla apartamentów z przypisanym hotresTypeId i hotresRateId.
            </p>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-200">
              Uwaga: ta operacja nadpisze ceny w HotRes. Upewnij się, że lokalne ceny są poprawne.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHotresExportDialogOpen(false)} data-testid="button-hotres-export-cancel">
              Anuluj
            </Button>
            <Button
              onClick={() => hotresExportMutation.mutate()}
              disabled={hotresExportMutation.isPending}
              data-testid="button-hotres-export-confirm"
            >
              {hotresExportMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              {hotresExportMutation.isPending ? "Wysyłam..." : "Wyślij do HotRes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
