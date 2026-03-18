import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format, eachDayOfInterval, startOfMonth, endOfMonth, addMonths, isWeekend } from "date-fns";
import { pl } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Tag, Plus, Pencil, Trash2, Play, Eye, Power, ArrowUpDown, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingRule {
  id: number;
  name: string;
  type: string;
  seasonType: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  dayOfWeek: number[] | null;
  modifier: string;
  modifierType: string;
  priority: number;
  active: boolean;
  autoApply: boolean;
  minStayRule: number | null;
  maxStayRule: number | null;
  apartmentIds: number[] | null;
  locationFilter: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Apartment {
  id: number;
  name: string;
  location: string;
  active: boolean;
}

const RULE_TYPES = [
  { value: "seasonal", label: "Sezonowa" },
  { value: "weekend", label: "Weekendowa" },
  { value: "day_of_week", label: "Dzień tygodnia" },
  { value: "last_minute", label: "Last minute" },
  { value: "long_stay", label: "Długi pobyt" },
  { value: "holiday", label: "Święta / dni wolne" },
  { value: "occupancy", label: "Obłożenie" },
  { value: "early_booking", label: "Early booking" },
  { value: "custom", label: "Niestandardowa" },
];

const DAY_NAMES = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

const defaultForm = {
  name: "",
  type: "seasonal",
  seasonType: "",
  dateFrom: "",
  dateTo: "",
  dayOfWeek: [] as number[],
  modifier: "",
  modifierType: "percentage",
  priority: 0,
  active: true,
  autoApply: false,
  minStayRule: "",
  maxStayRule: "",
  apartmentIds: [] as number[],
  locationFilter: "",
};

export default function PricingRules() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewRuleId, setPreviewRuleId] = useState<number | null>(null);
  const [previewDateFrom, setPreviewDateFrom] = useState("");
  const [previewDateTo, setPreviewDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("rules");
  const [conflictDate, setConflictDate] = useState(new Date());

  const { data: rules = [], isLoading } = useQuery<PricingRule[]>({
    queryKey: ["/api/pricing-rules"],
  });

  const { data: apartments = [] } = useQuery<Apartment[]>({
    queryKey: ["/api/apartments"],
  });

  const conflictRange = useMemo(() => {
    const from = startOfMonth(conflictDate);
    const to = endOfMonth(addMonths(conflictDate, 2));
    return { from: format(from, "yyyy-MM-dd"), to: format(to, "yyyy-MM-dd") };
  }, [conflictDate]);

  const { data: conflictsData, isLoading: conflictsLoading } = useQuery<{
    conflicts: { date: string; rules: { id: number; name: string; type: string; modifier: string; modifierType: string; priority: number; affectedApartments: number }[] }[];
    totalConflictDays: number;
    totalRules: number;
  }>({
    queryKey: ["/api/pricing-rules/conflicts", conflictRange.from, conflictRange.to],
    queryFn: async () => {
      const res = await fetch(`/api/pricing-rules/conflicts?from=${conflictRange.from}&to=${conflictRange.to}`);
      if (!res.ok) throw new Error("Failed to fetch conflicts");
      return res.json();
    },
    enabled: activeTab === "conflicts",
  });

  const { data: previewData, isFetching: previewLoading } = useQuery<{ changes: any[]; count: number }>({
    queryKey: ["/api/pricing-rules/preview", previewRuleId, previewDateFrom, previewDateTo],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/pricing-rules/preview", {
        ruleId: previewRuleId,
        dateFrom: previewDateFrom || undefined,
        dateTo: previewDateTo || undefined,
      });
      return res.json();
    },
    enabled: !!previewRuleId && previewDialogOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/pricing-rules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
      toast({ title: "Reguła utworzona" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/pricing-rules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
      toast({ title: "Reguła zaktualizowana" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/pricing-rules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
      toast({ title: "Reguła usunięta" });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) =>
      apiRequest("PUT", `/api/pricing-rules/${id}`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/pricing-rules/apply", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/daily-prices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pricing-rules"] });
      toast({ title: "Reguła zastosowana", description: `Zaktualizowano ${data.updated} cen` });
      setPreviewDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...defaultForm });
  };

  const openEdit = (rule: PricingRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      type: rule.type,
      seasonType: rule.seasonType || "",
      dateFrom: rule.dateFrom || "",
      dateTo: rule.dateTo || "",
      dayOfWeek: rule.dayOfWeek || [],
      modifier: rule.modifier,
      modifierType: rule.modifierType || "percentage",
      priority: rule.priority,
      active: rule.active,
      autoApply: rule.autoApply,
      minStayRule: rule.minStayRule?.toString() || "",
      maxStayRule: rule.maxStayRule?.toString() || "",
      apartmentIds: rule.apartmentIds || [],
      locationFilter: rule.locationFilter || "",
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const data: any = {
      name: form.name,
      type: form.type,
      modifier: form.modifier,
      modifierType: form.modifierType,
      priority: form.priority,
      active: form.active,
      autoApply: form.autoApply,
    };
    if (form.seasonType) data.seasonType = form.seasonType;
    if (form.dateFrom) data.dateFrom = form.dateFrom;
    if (form.dateTo) data.dateTo = form.dateTo;
    if (form.dayOfWeek.length > 0) data.dayOfWeek = form.dayOfWeek;
    if (form.minStayRule) data.minStayRule = Number(form.minStayRule);
    if (form.maxStayRule) data.maxStayRule = Number(form.maxStayRule);
    if (form.apartmentIds.length > 0) data.apartmentIds = form.apartmentIds;
    if (form.locationFilter) data.locationFilter = form.locationFilter;

    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const toggleDayOfWeek = (day: number) => {
    setForm(prev => ({
      ...prev,
      dayOfWeek: prev.dayOfWeek.includes(day)
        ? prev.dayOfWeek.filter(d => d !== day)
        : [...prev.dayOfWeek, day],
    }));
  };

  const openPreview = (rule: PricingRule) => {
    setPreviewRuleId(rule.id);
    setPreviewDateFrom(rule.dateFrom || "");
    setPreviewDateTo(rule.dateTo || "");
    setPreviewDialogOpen(true);
  };

  const getTypeLabel = (type: string) => RULE_TYPES.find(t => t.value === type)?.label || type;

  const locations = [...new Set(apartments.filter(a => a.active).map(a => a.location).filter(Boolean))].sort();

  const conflictMap = useMemo(() => {
    const map = new Map<string, { date: string; rules: any[] }>();
    if (conflictsData?.conflicts) {
      conflictsData.conflicts.forEach(c => map.set(c.date, c));
    }
    return map;
  }, [conflictsData]);

  const conflictMonths = useMemo(() => {
    const start = startOfMonth(conflictDate);
    return [start, addMonths(start, 1), addMonths(start, 2)];
  }, [conflictDate]);

  return (
    <div className="space-y-4" data-testid="pricing-rules-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Tag className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Reguły cenowe</h1>
        </div>
        <Button onClick={() => { resetForm(); setDialogOpen(true); }} data-testid="button-add-rule">
          <Plus className="h-4 w-4 mr-1" />
          Nowa reguła
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="rules" data-testid="tab-rules">Reguły</TabsTrigger>
          <TabsTrigger value="conflicts" data-testid="tab-conflicts">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            Mapa konfliktów
            {conflictsData && conflictsData.totalConflictDays > 0 && (
              <Badge variant="destructive" className="ml-1.5 h-5 text-[10px]">{conflictsData.totalConflictDays}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules">
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Ładowanie...</div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Brak reguł cenowych</p>
            <p className="text-sm mt-1">Utwórz pierwszą regułę, aby automatycznie zarządzać cenami</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rules.map(rule => (
            <Card key={rule.id} className={cn("transition-opacity", !rule.active && "opacity-50")} data-testid={`card-rule-${rule.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold" data-testid={`text-rule-name-${rule.id}`}>{rule.name}</h3>
                      <Badge variant="outline">{getTypeLabel(rule.type)}</Badge>
                      <Badge variant={rule.active ? "default" : "secondary"}>
                        {rule.active ? "Aktywna" : "Nieaktywna"}
                      </Badge>
                      {rule.autoApply && <Badge variant="outline" className="text-green-600">Auto</Badge>}
                      <Badge variant="outline" className="text-muted-foreground">
                        <ArrowUpDown className="h-3 w-3 mr-0.5" />
                        {rule.priority}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 space-x-3">
                      <span>
                        {rule.modifierType === "percentage" ? `${Number(rule.modifier) > 0 ? "+" : ""}${rule.modifier}%` : `${Number(rule.modifier) > 0 ? "+" : ""}${rule.modifier} PLN`}
                      </span>
                      {rule.dateFrom && rule.dateTo && (
                        <span>{rule.dateFrom} → {rule.dateTo}</span>
                      )}
                      {rule.dayOfWeek && rule.dayOfWeek.length > 0 && (
                        <span>{rule.dayOfWeek.map(d => DAY_NAMES[d]).join(", ")}</span>
                      )}
                      {rule.locationFilter && <span>📍 {rule.locationFilter}</span>}
                      {rule.apartmentIds && rule.apartmentIds.length > 0 && (
                        <span>{rule.apartmentIds.length} apt.</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openPreview(rule)} data-testid={`button-preview-${rule.id}`}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleActiveMutation.mutate({ id: rule.id, active: !rule.active })} data-testid={`button-toggle-${rule.id}`}>
                      <Power className={cn("h-4 w-4", rule.active ? "text-green-500" : "text-muted-foreground")} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rule)} data-testid={`button-edit-${rule.id}`}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm("Usunąć regułę?")) deleteMutation.mutate(rule.id); }} data-testid={`button-delete-${rule.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
        </TabsContent>

        <TabsContent value="conflicts">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={() => setConflictDate(d => addMonths(d, -3))} data-testid="button-conflict-prev">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <span className="font-semibold" data-testid="text-conflict-range">
                  {format(conflictMonths[0], "LLLL yyyy", { locale: pl })} — {format(conflictMonths[2], "LLLL yyyy", { locale: pl })}
                </span>
                <Button variant="ghost" size="icon" onClick={() => setConflictDate(d => addMonths(d, 3))} data-testid="button-conflict-next">
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              {conflictsData && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>Aktywnych reguł: <strong>{conflictsData.totalRules}</strong></span>
                  <span>Dni z konfliktami: <Badge variant={conflictsData.totalConflictDays > 0 ? "destructive" : "secondary"}>{conflictsData.totalConflictDays}</Badge></span>
                </div>
              )}
            </div>

            <div className="flex gap-2 text-xs flex-wrap">
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-green-200 dark:bg-green-900/40 border border-green-400" /> 0-1 reguła</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-900/40 border border-amber-400" /> 2 reguły</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-orange-200 dark:bg-orange-900/40 border border-orange-400" /> 3 reguły</div>
              <div className="flex items-center gap-1"><div className="w-3 h-3 rounded bg-red-200 dark:bg-red-900/40 border border-red-400" /> 4+ reguły</div>
            </div>

            {conflictsLoading ? (
              <div className="text-center text-muted-foreground py-8">Ładowanie mapy konfliktów...</div>
            ) : (
              <TooltipProvider delayDuration={200}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {conflictMonths.map((monthStart, mIdx) => {
                    const monthEnd = endOfMonth(monthStart);
                    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                    const firstDayOfWeek = (monthStart.getDay() + 6) % 7;

                    return (
                      <Card key={mIdx} data-testid={`card-conflict-month-${mIdx}`}>
                        <CardHeader className="py-2 px-3">
                          <CardTitle className="text-sm text-center">
                            {format(monthStart, "LLLL yyyy", { locale: pl })}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-2">
                          <div className="grid grid-cols-7 gap-px text-[10px]">
                            {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map(d => (
                              <div key={d} className="text-center text-muted-foreground font-medium py-0.5">{d}</div>
                            ))}
                            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                              <div key={`empty-${i}`} />
                            ))}
                            {days.map(day => {
                              const dateStr = format(day, "yyyy-MM-dd");
                              const conflict = conflictMap.get(dateStr);
                              const ruleCount = conflict?.rules.length || 0;

                              let bgColor = "";
                              if (ruleCount >= 4) bgColor = "bg-red-200 dark:bg-red-900/40 border-red-400";
                              else if (ruleCount === 3) bgColor = "bg-orange-200 dark:bg-orange-900/40 border-orange-400";
                              else if (ruleCount === 2) bgColor = "bg-amber-200 dark:bg-amber-900/40 border-amber-400";

                              const cell = (
                                <div
                                  className={cn(
                                    "text-center py-1 rounded text-xs border",
                                    bgColor || "bg-background border-transparent",
                                    isWeekend(day) && !bgColor && "bg-muted/40",
                                    ruleCount >= 2 && "cursor-pointer font-semibold"
                                  )}
                                  data-testid={`cell-conflict-${dateStr}`}
                                >
                                  {day.getDate()}
                                </div>
                              );

                              if (conflict && conflict.rules.length >= 2) {
                                const winner = conflict.rules[0];
                                return (
                                  <Tooltip key={dateStr}>
                                    <TooltipTrigger asChild>{cell}</TooltipTrigger>
                                    <TooltipContent className="max-w-xs p-3" side="top" data-testid={`tooltip-conflict-${dateStr}`}>
                                      <div className="space-y-1.5">
                                        <p className="font-semibold text-xs">{format(day, "d MMMM yyyy (EEEE)", { locale: pl })}</p>
                                        <p className="text-[10px] text-muted-foreground">{conflict.rules.length} nakładających się reguł:</p>
                                        {conflict.rules.map((r, ri) => (
                                          <div key={r.id} className={cn("text-xs flex items-center gap-1.5 p-1 rounded", ri === 0 && "bg-primary/10 font-medium")}>
                                            <Badge variant="outline" className="text-[10px] h-4 shrink-0">P:{r.priority}</Badge>
                                            <span className="truncate">{r.name}</span>
                                            <span className="text-muted-foreground shrink-0">
                                              {r.modifierType === "percentage"
                                                ? `${Number(r.modifier) > 0 ? "+" : ""}${r.modifier}%`
                                                : `${Number(r.modifier) > 0 ? "+" : ""}${r.modifier} PLN`}
                                            </span>
                                            {ri === 0 && <Badge variant="default" className="text-[9px] h-3.5 shrink-0">wygrywa</Badge>}
                                          </div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              }
                              return <div key={dateStr}>{cell}</div>;
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TooltipProvider>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="dialog-rule-form">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edytuj regułę" : "Nowa reguła cenowa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nazwa</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Sezon letni +20%" data-testid="input-rule-name" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger data-testid="select-rule-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorytet</Label>
                <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))} data-testid="input-rule-priority" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Od daty</Label>
                <Input type="date" value={form.dateFrom} onChange={e => setForm(f => ({ ...f, dateFrom: e.target.value }))} data-testid="input-rule-date-from" />
              </div>
              <div>
                <Label>Do daty</Label>
                <Input type="date" value={form.dateTo} onChange={e => setForm(f => ({ ...f, dateTo: e.target.value }))} data-testid="input-rule-date-to" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Modyfikator</Label>
                <Input type="number" value={form.modifier} onChange={e => setForm(f => ({ ...f, modifier: e.target.value }))} placeholder="np. 20" data-testid="input-rule-modifier" />
              </div>
              <div>
                <Label>Typ modyfikatora</Label>
                <Select value={form.modifierType} onValueChange={v => setForm(f => ({ ...f, modifierType: v }))}>
                  <SelectTrigger data-testid="select-rule-modifier-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Procent (%)</SelectItem>
                    <SelectItem value="fixed">Kwota (PLN)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(form.type === "weekend" || form.type === "day_of_week") && (
              <div>
                <Label>Dni tygodnia</Label>
                <div className="flex gap-1 mt-1">
                  {DAY_NAMES.map((name, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant={form.dayOfWeek.includes(i) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDayOfWeek(i)}
                      data-testid={`button-day-${i}`}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Lokalizacja (opcjonalnie)</Label>
              <Select value={form.locationFilter || "all"} onValueChange={v => setForm(f => ({ ...f, locationFilter: v === "all" ? "" : v }))}>
                <SelectTrigger data-testid="select-rule-location"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie lokalizacje</SelectItem>
                  {locations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{form.type === "occupancy" ? "Próg obłożenia (%)" : form.type === "last_minute" ? "Dni do przyjazdu" : form.type === "long_stay" ? "Min. długość pobytu" : "Min. pobyt"}</Label>
                <Input type="number" value={form.minStayRule} onChange={e => setForm(f => ({ ...f, minStayRule: e.target.value }))} placeholder={form.type === "occupancy" ? "np. 80" : "opcjonalnie"} data-testid="input-rule-min-stay" />
              </div>
              <div>
                <Label>Max. pobyt</Label>
                <Input type="number" value={form.maxStayRule} onChange={e => setForm(f => ({ ...f, maxStayRule: e.target.value }))} placeholder="opcjonalnie" data-testid="input-rule-max-stay" />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} data-testid="switch-rule-active" />
                <Label>Aktywna</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.autoApply} onCheckedChange={v => setForm(f => ({ ...f, autoApply: v }))} data-testid="switch-rule-auto-apply" />
                <Label>Auto-apply</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-rule-cancel">Anuluj</Button>
            <Button onClick={handleSave} disabled={!form.name || !form.modifier || createMutation.isPending || updateMutation.isPending} data-testid="button-rule-save">
              {createMutation.isPending || updateMutation.isPending ? "Zapisuję..." : editingId ? "Zapisz" : "Utwórz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-rule-preview">
          <DialogHeader>
            <DialogTitle>Podgląd reguły — {rules.find(r => r.id === previewRuleId)?.name}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <Label>Od daty</Label>
              <Input type="date" value={previewDateFrom} onChange={e => setPreviewDateFrom(e.target.value)} data-testid="input-preview-date-from" />
            </div>
            <div>
              <Label>Do daty</Label>
              <Input type="date" value={previewDateTo} onChange={e => setPreviewDateTo(e.target.value)} data-testid="input-preview-date-to" />
            </div>
          </div>

          {previewLoading ? (
            <div className="text-center py-4 text-muted-foreground">Ładowanie podglądu...</div>
          ) : previewData ? (
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Zmiany: <strong>{previewData.count}</strong> pozycji
              </p>
              {previewData.count > 0 && (
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-1 px-2">Apartament</th>
                        <th className="py-1 px-2">Data</th>
                        <th className="py-1 px-2">Stara cena</th>
                        <th className="py-1 px-2">Nowa cena</th>
                        <th className="py-1 px-2">Zmiana</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.changes.slice(0, 50).map((c: any, i: number) => {
                        const diff = c.newPrice - c.oldPrice;
                        return (
                          <tr key={i} className="border-b text-xs">
                            <td className="py-1 px-2">{apartments.find(a => a.id === c.apartmentId)?.name || c.apartmentId}</td>
                            <td className="py-1 px-2">{c.date}</td>
                            <td className="py-1 px-2">{c.oldPrice} zł</td>
                            <td className="py-1 px-2 font-medium">{c.newPrice} zł</td>
                            <td className={cn("py-1 px-2", diff > 0 ? "text-green-600" : "text-red-600")}>
                              {diff > 0 ? "+" : ""}{diff} zł
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {previewData.count > 50 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">
                      Pokazano 50 z {previewData.count} zmian
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)} data-testid="button-preview-cancel">Zamknij</Button>
            {previewData && previewData.count > 0 && (
              <Button
                onClick={() => applyMutation.mutate({ ruleId: previewRuleId, dateFrom: previewDateFrom, dateTo: previewDateTo })}
                disabled={applyMutation.isPending}
                data-testid="button-apply-rule"
              >
                <Play className="h-4 w-4 mr-1" />
                {applyMutation.isPending ? "Stosowanie..." : `Przelicz teraz (${previewData.count})`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
