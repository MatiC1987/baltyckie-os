import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { BookTemplate, Plus, Trash2, Pencil, Play, Loader2, ChevronRight, ChevronLeft, Eye } from "lucide-react";

interface Apartment {
  id: number;
  name: string;
  location: string;
  active: boolean;
}

interface TemplateDefaultConfig {
  price?: number;
  modifier?: number;
  modifierType?: "percentage" | "fixed";
}

interface TemplateConfig {
  defaultConfig?: TemplateDefaultConfig;
  apartments?: Record<string, TemplateDefaultConfig & { minStay?: number; maxStay?: number; isBlocked?: boolean }>;
  minStay?: number;
  maxStay?: number;
  isBlocked?: boolean;
}

interface PriceTemplate {
  id: number;
  name: string;
  description: string | null;
  config: TemplateConfig;
  isPreset: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TemplatePayload {
  name: string;
  description: string | null;
  config: TemplateConfig;
}

interface ApplyChange {
  apartmentId: number;
  apartmentName: string;
  date: string;
  oldPrice: number | null;
  newPrice: number | null;
  minStay: number | null;
  maxStay: number | null;
  isBlocked: boolean;
}

interface ApplyResponse {
  dryRun: boolean;
  templateName: string;
  changes?: ApplyChange[];
  applied?: number;
  message: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apartments: Apartment[];
  dateFrom?: string;
  dateTo?: string;
}

type WizardStep = "list" | "create" | "edit" | "apply-select-dates" | "apply-select-apts" | "apply-preview";

export default function PriceTemplatesDialog({ open, onOpenChange, apartments, dateFrom, dateTo }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<WizardStep>("list");
  const [selectedTemplate, setSelectedTemplate] = useState<PriceTemplate | null>(null);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formModifier, setFormModifier] = useState("");
  const [formModifierType, setFormModifierType] = useState<"percentage" | "fixed">("percentage");
  const [formMinStay, setFormMinStay] = useState("");
  const [formMaxStay, setFormMaxStay] = useState("");
  const [formIsBlocked, setFormIsBlocked] = useState(false);

  const [applyDateFrom, setApplyDateFrom] = useState(dateFrom || "");
  const [applyDateTo, setApplyDateTo] = useState(dateTo || "");
  const [applyApartmentIds, setApplyApartmentIds] = useState<Set<number>>(new Set());
  const [previewData, setPreviewData] = useState<ApplyResponse | null>(null);

  const { data: templates = [], isLoading } = useQuery<PriceTemplate[]>({
    queryKey: ["/api/price-templates"],
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplatePayload) => {
      const res = await apiRequest("POST", "/api/price-templates", data);
      return res.json() as Promise<PriceTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-templates"] });
      toast({ title: "Szablon utworzony" });
      resetForm();
      setStep("list");
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TemplatePayload }) => {
      const res = await apiRequest("PUT", `/api/price-templates/${id}`, data);
      return res.json() as Promise<PriceTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-templates"] });
      toast({ title: "Szablon zaktualizowany" });
      resetForm();
      setStep("list");
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/price-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/price-templates"] });
      toast({ title: "Szablon usunięty" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const applyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { dateFrom: string; dateTo: string; apartmentIds: number[]; dryRun: boolean } }) => {
      const res = await apiRequest("POST", `/api/price-templates/${id}/apply`, data);
      return res.json() as Promise<ApplyResponse>;
    },
    onSuccess: (data: ApplyResponse) => {
      if (data.dryRun) {
        setPreviewData(data);
        setStep("apply-preview");
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/daily-prices"] });
        queryClient.invalidateQueries({ queryKey: ["/api/price-templates"] });
        toast({ title: "Szablon zastosowany", description: data.message });
        resetApply();
        setStep("list");
      }
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormPrice("");
    setFormModifier("");
    setFormModifierType("percentage");
    setFormMinStay("");
    setFormMaxStay("");
    setFormIsBlocked(false);
    setSelectedTemplate(null);
  };

  const resetApply = () => {
    setApplyDateFrom(dateFrom || "");
    setApplyDateTo(dateTo || "");
    setApplyApartmentIds(new Set());
    setPreviewData(null);
    setSelectedTemplate(null);
  };

  const loadTemplateIntoForm = (t: PriceTemplate) => {
    setFormName(t.name);
    setFormDescription(t.description || "");
    const cfg = t.config;
    const defCfg = cfg.defaultConfig || {};
    setFormPrice(defCfg.price !== undefined ? String(defCfg.price) : "");
    setFormModifier(defCfg.modifier !== undefined ? String(defCfg.modifier) : "");
    setFormModifierType(defCfg.modifierType || "percentage");
    setFormMinStay(cfg.minStay !== undefined ? String(cfg.minStay) : "");
    setFormMaxStay(cfg.maxStay !== undefined ? String(cfg.maxStay) : "");
    setFormIsBlocked(cfg.isBlocked || false);
    setSelectedTemplate(t);
  };

  const buildConfig = (): TemplateConfig => {
    const config: TemplateConfig = { defaultConfig: {} };
    if (formPrice) config.defaultConfig!.price = Number(formPrice);
    if (formModifier) {
      config.defaultConfig!.modifier = Number(formModifier);
      config.defaultConfig!.modifierType = formModifierType;
    }
    if (formMinStay) config.minStay = Number(formMinStay);
    if (formMaxStay) config.maxStay = Number(formMaxStay);
    config.isBlocked = formIsBlocked;
    return config;
  };

  const handleSave = () => {
    if (!formName.trim()) {
      toast({ title: "Podaj nazwę szablonu", variant: "destructive" });
      return;
    }
    const payload: TemplatePayload = {
      name: formName.trim(),
      description: formDescription.trim() || null,
      config: buildConfig(),
    };
    if (step === "edit" && selectedTemplate) {
      updateMutation.mutate({ id: selectedTemplate.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleStartApply = (t: PriceTemplate) => {
    setSelectedTemplate(t);
    setApplyDateFrom(dateFrom || "");
    setApplyDateTo(dateTo || "");
    setApplyApartmentIds(new Set());
    setPreviewData(null);
    setStep("apply-select-dates");
  };

  const handlePreview = () => {
    if (!selectedTemplate) return;
    applyMutation.mutate({
      id: selectedTemplate.id,
      data: {
        dateFrom: applyDateFrom,
        dateTo: applyDateTo,
        apartmentIds: Array.from(applyApartmentIds),
        dryRun: true,
      },
    });
  };

  const handleApply = () => {
    if (!selectedTemplate) return;
    applyMutation.mutate({
      id: selectedTemplate.id,
      data: {
        dateFrom: applyDateFrom,
        dateTo: applyDateTo,
        apartmentIds: Array.from(applyApartmentIds),
        dryRun: false,
      },
    });
  };

  const getConfigSummary = (config: TemplateConfig) => {
    const parts: string[] = [];
    const def = config.defaultConfig || {};
    if (def.price) parts.push(`Cena: ${def.price} PLN`);
    if (def.modifier) {
      const sign = def.modifier > 0 ? "+" : "";
      parts.push(def.modifierType === "percentage" ? `${sign}${def.modifier}%` : `${sign}${def.modifier} PLN`);
    }
    if (config.minStay) parts.push(`Min. pobyt: ${config.minStay}`);
    if (config.maxStay) parts.push(`Max. pobyt: ${config.maxStay}`);
    if (config.isBlocked) parts.push("Zablokowane");
    return parts.join(" | ") || "Brak konfiguracji";
  };

  const activeApartments = useMemo(() => apartments.filter(a => a.active), [apartments]);

  const hasRelevantChange = (c: ApplyChange): boolean => {
    return (c.newPrice !== null && c.newPrice !== c.oldPrice) ||
      c.minStay !== null ||
      c.maxStay !== null ||
      c.isBlocked === true;
  };

  const dialogTitle = () => {
    switch (step) {
      case "list": return "Szablony cenowe";
      case "create": return "Nowy szablon";
      case "edit": return `Edytuj: ${selectedTemplate?.name}`;
      case "apply-select-dates": return `Zastosuj: ${selectedTemplate?.name} — Wybór dat`;
      case "apply-select-apts": return `Zastosuj: ${selectedTemplate?.name} — Wybór apartamentów`;
      case "apply-preview": return `Zastosuj: ${selectedTemplate?.name} — Podgląd zmian`;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { resetForm(); resetApply(); setStep("list"); } onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" data-testid="dialog-price-templates">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookTemplate className="h-5 w-5" />
            {dialogTitle()}
          </DialogTitle>
        </DialogHeader>

        {step === "list" && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <Button variant="outline" size="sm" className="self-start" onClick={() => { resetForm(); setStep("create"); }} data-testid="button-create-template">
              <Plus className="h-4 w-4 mr-1" />
              Nowy szablon
            </Button>

            <ScrollArea className="flex-1 max-h-[55vh]">
              {isLoading ? (
                <div className="py-8 text-center text-muted-foreground">Ładowanie...</div>
              ) : templates.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">Brak szablonów</div>
              ) : (
                <div className="space-y-2 pr-2">
                  {templates.map(t => (
                    <Card key={t.id} className="overflow-hidden" data-testid={`card-template-${t.id}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm" data-testid={`text-template-name-${t.id}`}>{t.name}</span>
                              {t.isPreset && <Badge variant="secondary" className="text-[10px] h-4">Preset</Badge>}
                            </div>
                            {t.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              {getConfigSummary(t.config)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartApply(t)} title="Zastosuj" data-testid={`button-apply-template-${t.id}`}>
                              <Play className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { loadTemplateIntoForm(t); setStep("edit"); }} title="Edytuj" data-testid={`button-edit-template-${t.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              if (confirm(`Usunąć szablon "${t.name}"?`)) deleteMutation.mutate(t.id);
                            }} title="Usuń" data-testid={`button-delete-template-${t.id}`}>
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}

        {(step === "create" || step === "edit") && (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nazwa szablonu</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="np. Wakacje letnie" data-testid="input-template-name" />
            </div>
            <div className="space-y-1">
              <Label>Opis</Label>
              <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Opcjonalny opis..." rows={2} data-testid="input-template-description" />
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-sm font-medium">Konfiguracja cen</p>
              <div className="space-y-1">
                <Label>Cena stała (PLN)</Label>
                <Input type="number" value={formPrice} onChange={e => setFormPrice(e.target.value)} placeholder="np. 350" data-testid="input-template-price" />
              </div>
              <div className="text-xs text-muted-foreground text-center">— lub mnożnik —</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Mnożnik</Label>
                  <Input type="number" value={formModifier} onChange={e => setFormModifier(e.target.value)} placeholder="np. 30" data-testid="input-template-modifier" />
                </div>
                <div className="space-y-1">
                  <Label>Typ mnożnika</Label>
                  <Select value={formModifierType} onValueChange={(v) => setFormModifierType(v as "percentage" | "fixed")}>
                    <SelectTrigger data-testid="select-template-modifier-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Procent (%)</SelectItem>
                      <SelectItem value="fixed">Kwota (PLN)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Min. pobyt (noce)</Label>
                  <Input type="number" value={formMinStay} onChange={e => setFormMinStay(e.target.value)} placeholder="np. 2" data-testid="input-template-min-stay" />
                </div>
                <div className="space-y-1">
                  <Label>Max. pobyt (noce)</Label>
                  <Input type="number" value={formMaxStay} onChange={e => setFormMaxStay(e.target.value)} placeholder="np. 14" data-testid="input-template-max-stay" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={formIsBlocked} onCheckedChange={setFormIsBlocked} data-testid="switch-template-blocked" />
                <Label>Zablokuj daty</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { resetForm(); setStep("list"); }} data-testid="button-template-cancel">Anuluj</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-template-save">
                {(createMutation.isPending || updateMutation.isPending) ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                {step === "edit" ? "Zapisz zmiany" : "Utwórz szablon"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "apply-select-dates" && (
          <div className="space-y-4">
            {selectedTemplate?.description && (
              <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
            )}
            <div className="text-sm bg-muted/50 rounded-lg p-2">
              {getConfigSummary(selectedTemplate?.config || {})}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data od</Label>
                <Input type="date" value={applyDateFrom} onChange={e => setApplyDateFrom(e.target.value)} data-testid="input-apply-date-from" />
              </div>
              <div className="space-y-1">
                <Label>Data do</Label>
                <Input type="date" value={applyDateTo} onChange={e => setApplyDateTo(e.target.value)} data-testid="input-apply-date-to" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { resetApply(); setStep("list"); }} data-testid="button-apply-dates-back">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Wróć
              </Button>
              <Button onClick={() => setStep("apply-select-apts")} disabled={!applyDateFrom || !applyDateTo} data-testid="button-apply-dates-next">
                Dalej
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "apply-select-apts" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Okres: <strong>{applyDateFrom}</strong> — <strong>{applyDateTo}</strong>
            </p>
            <div className="space-y-2">
              <Label>Wybierz apartamenty</Label>
              <ScrollArea className="max-h-[40vh] border rounded-md p-2">
                {activeApartments.map(a => (
                  <label key={a.id} className="flex items-center gap-2 py-1 px-1 hover:bg-muted rounded text-sm cursor-pointer">
                    <Checkbox
                      checked={applyApartmentIds.has(a.id)}
                      onCheckedChange={(checked) => {
                        setApplyApartmentIds(prev => {
                          const next = new Set(prev);
                          if (checked) next.add(a.id); else next.delete(a.id);
                          return next;
                        });
                      }}
                      data-testid={`checkbox-apply-apt-${a.id}`}
                    />
                    <span>{a.name}</span>
                    {a.location && <Badge variant="outline" className="text-[10px] h-4 ml-auto">{a.location}</Badge>}
                  </label>
                ))}
              </ScrollArea>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setApplyApartmentIds(new Set(activeApartments.map(a => a.id)))} data-testid="button-apply-select-all">Zaznacz wszystko</Button>
                <Button variant="ghost" size="sm" onClick={() => setApplyApartmentIds(new Set())} data-testid="button-apply-deselect-all">Odznacz</Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("apply-select-dates")} data-testid="button-apply-apts-back">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Wróć
              </Button>
              <Button onClick={handlePreview} disabled={applyApartmentIds.size === 0 || applyMutation.isPending} data-testid="button-apply-preview">
                {applyMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Eye className="h-4 w-4 mr-1" />}
                Podgląd zmian ({applyApartmentIds.size} apt.)
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "apply-preview" && previewData && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <p className="text-sm text-muted-foreground">{previewData.message}</p>
            <ScrollArea className="flex-1 max-h-[45vh] border rounded-md">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b text-left">
                    <th className="py-1.5 px-2 text-xs">Apartament</th>
                    <th className="py-1.5 px-2 text-xs">Data</th>
                    <th className="py-1.5 px-2 text-xs">Stara cena</th>
                    <th className="py-1.5 px-2 text-xs">Nowa cena</th>
                    <th className="py-1.5 px-2 text-xs">Zmiana</th>
                    <th className="py-1.5 px-2 text-xs">Inne</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewData.changes || [])
                    .filter(hasRelevantChange)
                    .slice(0, 100)
                    .map((c: ApplyChange, i: number) => {
                      const otherChanges: string[] = [];
                      if (c.minStay !== null) otherChanges.push(`min: ${c.minStay}`);
                      if (c.maxStay !== null) otherChanges.push(`max: ${c.maxStay}`);
                      if (c.isBlocked) otherChanges.push("blokada");

                      return (
                        <tr key={i} className="border-b text-xs">
                          <td className="py-1 px-2">{c.apartmentName}</td>
                          <td className="py-1 px-2">{c.date}</td>
                          <td className="py-1 px-2">{c.oldPrice !== null ? `${Number(c.oldPrice).toFixed(0)} zł` : "—"}</td>
                          <td className="py-1 px-2 font-medium">{c.newPrice !== null ? `${Number(c.newPrice).toFixed(0)} zł` : "—"}</td>
                          <td className="py-1 px-2">
                            {c.oldPrice !== null && c.newPrice !== null ? (
                              <span className={c.newPrice > c.oldPrice ? "text-green-600" : c.newPrice < c.oldPrice ? "text-red-600" : ""}>
                                {c.newPrice > c.oldPrice ? "+" : ""}{(c.newPrice - c.oldPrice).toFixed(0)} zł
                              </span>
                            ) : c.newPrice !== null ? "nowa" : "—"}
                          </td>
                          <td className="py-1 px-2 text-muted-foreground">{otherChanges.join(", ")}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {(previewData.changes || []).filter(hasRelevantChange).length > 100 && (
                <p className="text-xs text-muted-foreground p-2">
                  ...i więcej zmian (pokazano pierwsze 100)
                </p>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("apply-select-apts")} data-testid="button-preview-back">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Wróć
              </Button>
              <Button onClick={handleApply} disabled={applyMutation.isPending} data-testid="button-apply-confirm">
                {applyMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
                {applyMutation.isPending ? "Stosowanie..." : "Zastosuj szablon"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
