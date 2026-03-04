import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sublease, Apartment, SubleaseMeterReading, SubleaseMeterSetting, SubleaseMeterPrice, MediaSettlementReport, AccountingNote, SubleaseElectricityCharge } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Zap, Droplets, FileText, ChevronDown, ChevronUp, Check, Plus, Trash2, History, ClipboardCheck, CircleDollarSign, Pencil, Gauge, Download, Settings2, FileUp, AlertTriangle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}

function formatNum(v: number | string | null | undefined, decimals = 2): string {
  if (v === null || v === undefined || v === "") return "";
  const n = typeof v === "number" ? v : parseFloat(v);
  if (isNaN(n)) return "";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

async function downloadNoteById(noteId: number) {
  const response = await fetch(`/api/accounting-notes/${noteId}/download`, { credentials: "include" });
  if (!response.ok) throw new Error("Nie udało się pobrać noty");
  const blob = await response.blob();
  const contentDisposition = response.headers.get("Content-Disposition");
  let fileName = "nota_ksiegowa.pdf";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename="?([^"]+)"?/);
    if (match) fileName = decodeURIComponent(match[1]);
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const METER_TYPES = {
  electricity: { label: "Energia elektryczna", unit: "kWh", icon: Zap },
  cold_water: { label: "Woda zimna", unit: "m³", icon: Droplets },
  hot_water: { label: "Woda ciepła", unit: "m³", icon: Droplets },
};

type MeterType = keyof typeof METER_TYPES;

function InlineEditInput({
  initialValue,
  onSave,
  placeholder,
  step,
  className,
  testId,
  type,
}: {
  initialValue: string;
  onSave: (val: string) => void;
  placeholder?: string;
  step?: string;
  className?: string;
  testId?: string;
  type?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [dirty, setDirty] = useState(false);

  const handleSave = useCallback(() => {
    if (value !== initialValue) {
      onSave(value);
      setDirty(false);
    }
  }, [value, initialValue, onSave]);

  return (
    <div className="flex items-center gap-1">
      <Input
        data-testid={testId}
        type={type || "number"}
        step={step || "0.01"}
        placeholder={placeholder || "0.00"}
        className={className}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setDirty(e.target.value !== initialValue);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
        }}
      />
      {dirty && (
        <Button
          size="icon"
          variant="ghost"
          data-testid={testId ? `${testId}-confirm` : undefined}
          onClick={handleSave}
          className="shrink-0"
        >
          <Check className="w-4 h-4 text-green-600" />
        </Button>
      )}
    </div>
  );
}

function PriceHistoryDialog({
  open,
  onOpenChange,
  subleaseId,
  meterType,
  prices,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subleaseId: number;
  meterType: MeterType;
  prices: SubleaseMeterPrice[];
}) {
  const { toast } = useToast();
  const [newPrice, setNewPrice] = useState("");
  const [newDate, setNewDate] = useState("");
  const pricesKey = [`/api/subleases/${subleaseId}/meter-prices`];
  const info = METER_TYPES[meterType];

  const filteredPrices = useMemo(
    () => prices.filter((p) => p.meterType === meterType).sort((a, b) => a.validFrom.localeCompare(b.validFrom)),
    [prices, meterType]
  );

  const addPrice = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/subleases/${subleaseId}/meter-prices`, {
        meterType,
        unitPrice: newPrice,
        validFrom: newDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricesKey });
      setNewPrice("");
      setNewDate("");
      toast({ title: "Dodano cenę" });
    },
  });

  const deletePrice = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/meter-prices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pricesKey });
      toast({ title: "Usunięto cenę" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Historia cen - {info.label}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Dodaj zmiany cen jednostkowych w czasie. System automatycznie zastosuje cenę obowiązującą w dniu odczytu.
          </p>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Data obowiązywania od</Label>
              <Input
                type="date"
                data-testid={`input-price-date-${meterType}`}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground">Cena ({info.unit === "kWh" ? "zł/kWh" : `zł/${info.unit}`})</Label>
              <Input
                type="number"
                step="0.0001"
                data-testid={`input-price-value-${meterType}`}
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="0.0000"
              />
            </div>
            <Button
              size="icon"
              data-testid={`button-add-price-${meterType}`}
              onClick={() => addPrice.mutate()}
              disabled={!newDate || !newPrice || addPrice.isPending}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {filteredPrices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Od dnia</TableHead>
                  <TableHead className="text-right">Cena jedn.</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPrices.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{formatDate(p.validFrom)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatNum(p.unitPrice, 4)} zł
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-delete-price-${p.id}`}
                        onClick={() => deletePrice.mutate(p.id)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Brak historii cen. Dodaj pierwszą cenę powyżej.
            </p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="button-close-prices">Zamknij</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const PREDEFINED_VARIABLE_CHARGES = [
  "Energia czynna",
  "Opłata sieciowa zmienna",
  "Opłata jakościowa",
  "Opłata OZE",
  "Opłata kogeneracyjna",
  "Akcyza",
];

const PREDEFINED_FIXED_CHARGES = [
  "Opłata dystrybucyjna stała",
  "Opłata abonamentowa",
  "Opłata mocowa",
  "Opłata przejściowa",
  "Opłata handlowa",
];

interface ImportedCharge {
  chargeName: string;
  chargeType: "variable" | "fixed";
  unitPrice: number;
  unit: string;
  vatRate: number;
  selected: boolean;
}

function ElectricityChargesDialog({
  open,
  onOpenChange,
  subleaseId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  subleaseId: number;
}) {
  const { toast } = useToast();
  const chargesKey = [`/api/subleases/${subleaseId}/electricity-charges`];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: charges = [], isLoading } = useQuery<SubleaseElectricityCharge[]>({
    queryKey: chargesKey,
    enabled: open,
  });

  const [addMode, setAddMode] = useState(false);
  const [newChargeName, setNewChargeName] = useState("");
  const [newChargeNameCustom, setNewChargeNameCustom] = useState("");
  const [newChargeType, setNewChargeType] = useState<"variable" | "fixed">("variable");
  const [newUnitPrice, setNewUnitPrice] = useState("");
  const [newValidFrom, setNewValidFrom] = useState(new Date().toISOString().slice(0, 10));

  const [editingChargeId, setEditingChargeId] = useState<number | null>(null);
  const [editNewPrice, setEditNewPrice] = useState("");
  const [editNewDate, setEditNewDate] = useState(new Date().toISOString().slice(0, 10));

  const [historyChargeName, setHistoryChargeName] = useState<string | null>(null);

  const [importMode, setImportMode] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importedCharges, setImportedCharges] = useState<ImportedCharge[]>([]);
  const [importVatRate, setImportVatRate] = useState("23");
  const [importValidFrom, setImportValidFrom] = useState(new Date().toISOString().slice(0, 10));

  const [vatRate, setVatRate] = useState("23");

  const variableCharges = useMemo(() => {
    const grouped = new Map<string, SubleaseElectricityCharge[]>();
    charges
      .filter(c => c.chargeType === "variable")
      .forEach(c => {
        const existing = grouped.get(c.chargeName) || [];
        existing.push(c);
        grouped.set(c.chargeName, existing);
      });
    const result: { name: string; latest: SubleaseElectricityCharge; count: number }[] = [];
    grouped.forEach((items, name) => {
      const sorted = [...items].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      result.push({ name, latest: sorted[0], count: items.length });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [charges]);

  const fixedCharges = useMemo(() => {
    const grouped = new Map<string, SubleaseElectricityCharge[]>();
    charges
      .filter(c => c.chargeType === "fixed")
      .forEach(c => {
        const existing = grouped.get(c.chargeName) || [];
        existing.push(c);
        grouped.set(c.chargeName, existing);
      });
    const result: { name: string; latest: SubleaseElectricityCharge; count: number }[] = [];
    grouped.forEach((items, name) => {
      const sorted = [...items].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      result.push({ name, latest: sorted[0], count: items.length });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [charges]);

  const variableSum = useMemo(
    () => variableCharges.reduce((sum, c) => sum + (parseFloat(c.latest.unitPrice) || 0), 0),
    [variableCharges]
  );

  const fixedSum = useMemo(
    () => fixedCharges.reduce((sum, c) => sum + (parseFloat(c.latest.unitPrice) || 0), 0),
    [fixedCharges]
  );

  const lastUpdated = useMemo(() => {
    if (charges.length === 0) return null;
    const sorted = [...charges].sort((a, b) => b.validFrom.localeCompare(a.validFrom));
    return sorted[0].validFrom;
  }, [charges]);

  const staleWarning = useMemo(() => {
    if (!lastUpdated) return false;
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return new Date(lastUpdated) < threeMonthsAgo;
  }, [lastUpdated]);

  const historyCharges = useMemo(() => {
    if (!historyChargeName) return [];
    return charges
      .filter(c => c.chargeName === historyChargeName)
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
  }, [charges, historyChargeName]);

  const addCharge = useMutation({
    mutationFn: async () => {
      const name = newChargeName === "__custom__" ? newChargeNameCustom : newChargeName;
      await apiRequest("POST", `/api/subleases/${subleaseId}/electricity-charges`, {
        chargeName: name,
        chargeType: newChargeType,
        unitPrice: newUnitPrice,
        validFrom: newValidFrom,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chargesKey });
      setAddMode(false);
      setNewChargeName("");
      setNewChargeNameCustom("");
      setNewUnitPrice("");
      toast({ title: "Dodano opłatę" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const updateCharge = useMutation({
    mutationFn: async ({ chargeId, chargeName, chargeType }: { chargeId: number; chargeName: string; chargeType: string }) => {
      await apiRequest("POST", `/api/subleases/${subleaseId}/electricity-charges`, {
        chargeName,
        chargeType,
        unitPrice: editNewPrice,
        validFrom: editNewDate,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chargesKey });
      setEditingChargeId(null);
      setEditNewPrice("");
      toast({ title: "Dodano nową stawkę (stara zachowana w historii)" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const deleteCharge = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/electricity-charges/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chargesKey });
      toast({ title: "Usunięto opłatę" });
    },
  });

  const bulkImport = useMutation({
    mutationFn: async (items: { chargeName: string; chargeType: string; unitPrice: string; validFrom: string }[]) => {
      await apiRequest("POST", `/api/subleases/${subleaseId}/electricity-charges/bulk`, { charges: items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chargesKey });
      setImportMode(false);
      setImportedCharges([]);
      toast({ title: "Zaimportowano opłaty" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd importu", description: err.message, variant: "destructive" });
    },
  });

  const handleFileUpload = async (file: File) => {
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/subleases/${subleaseId}/import-electricity-invoice`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Błąd importu");
      }
      const data = await res.json();
      const parsed: ImportedCharge[] = (data.charges || []).map((c: any) => ({
        chargeName: c.chargeName || "",
        chargeType: c.chargeType || "variable",
        unitPrice: typeof c.unitPrice === "number" ? c.unitPrice : parseFloat(c.unitPrice) || 0,
        unit: c.unit || (c.chargeType === "fixed" ? "mc" : "kWh"),
        vatRate: c.vatRate || data.vatRate || 23,
        selected: true,
      }));
      setImportedCharges(parsed);
      if (data.vatRate) setImportVatRate(String(data.vatRate));
      setImportMode(true);
    } catch (err: any) {
      toast({ title: "Błąd importu faktury", description: err.message, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportConfirm = () => {
    const selected = importedCharges.filter(c => c.selected);
    if (selected.length === 0) return;
    const items = selected.map(c => ({
      chargeName: c.chargeName,
      chargeType: c.chargeType,
      unitPrice: c.unitPrice.toFixed(4),
      validFrom: importValidFrom,
    }));
    bulkImport.mutate(items);
  };

  const resolvedName = newChargeName === "__custom__" ? newChargeNameCustom : newChargeName;
  const canAdd = resolvedName.trim() && newUnitPrice && newValidFrom;

  const renderChargeRow = (item: { name: string; latest: SubleaseElectricityCharge; count: number }, isVariable: boolean) => {
    const isEditing = editingChargeId === item.latest.id;
    return (
      <TableRow key={item.name} data-testid={`row-charge-${item.latest.id}`}>
        <TableCell className="text-sm font-medium">{item.name}</TableCell>
        <TableCell className="text-right text-sm">
          {isEditing ? (
            <Input
              type="number"
              step="0.0001"
              value={editNewPrice}
              onChange={(e) => setEditNewPrice(e.target.value)}
              className="w-28 ml-auto"
              data-testid={`input-edit-charge-price-${item.latest.id}`}
            />
          ) : (
            <span>{formatNum(item.latest.unitPrice, 4)} zł</span>
          )}
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {isEditing ? (
            <Input
              type="date"
              value={editNewDate}
              onChange={(e) => setEditNewDate(e.target.value)}
              className="w-36"
              data-testid={`input-edit-charge-date-${item.latest.id}`}
            />
          ) : (
            formatDate(item.latest.validFrom)
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 justify-end">
            {isEditing ? (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  data-testid={`button-confirm-edit-charge-${item.latest.id}`}
                  disabled={!editNewPrice || updateCharge.isPending}
                  onClick={() =>
                    updateCharge.mutate({
                      chargeId: item.latest.id,
                      chargeName: item.name,
                      chargeType: item.latest.chargeType,
                    })
                  }
                >
                  <Check className="w-4 h-4 text-green-600" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingChargeId(null)}
                  data-testid={`button-cancel-edit-charge-${item.latest.id}`}
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  data-testid={`button-edit-charge-${item.latest.id}`}
                  title="Zmień stawkę (nowy wpis)"
                  onClick={() => {
                    setEditingChargeId(item.latest.id);
                    setEditNewPrice(item.latest.unitPrice);
                    setEditNewDate(new Date().toISOString().slice(0, 10));
                  }}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                {item.count > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid={`button-history-charge-${item.latest.id}`}
                    title={`Historia zmian (${item.count})`}
                    onClick={() => setHistoryChargeName(item.name)}
                  >
                    <History className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  data-testid={`button-delete-charge-${item.latest.id}`}
                  onClick={() => deleteCharge.mutate(item.latest.id)}
                >
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Konfiguracja opłat za energię elektryczną
          </DialogTitle>
        </DialogHeader>

        {staleWarning && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
            <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Stawki nie były aktualizowane od ponad 3 miesięcy. Sprawdź, czy są aktualne.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : importMode ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-medium">Porównanie stawek — stare vs nowe z faktury</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setImportMode(false); setImportedCharges([]); }}
                data-testid="button-cancel-import"
              >
                Anuluj
              </Button>
            </div>

            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data obowiązywania od</Label>
                <Input
                  type="date"
                  value={importValidFrom}
                  onChange={(e) => setImportValidFrom(e.target.value)}
                  className="w-40"
                  data-testid="input-import-valid-from"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stawka VAT (%)</Label>
                <Input
                  type="number"
                  value={importVatRate}
                  onChange={(e) => setImportVatRate(e.target.value)}
                  className="w-24"
                  data-testid="input-import-vat-rate"
                />
              </div>
            </div>

            {(() => {
              const currentByName = new Map<string, number>();
              [...variableCharges, ...fixedCharges].forEach(c => {
                currentByName.set(c.name, parseFloat(c.latest.unitPrice) || 0);
              });
              const hasChanges = importedCharges.some(ic => {
                const current = currentByName.get(ic.chargeName);
                return current !== undefined && Math.abs(current - ic.unitPrice) > 0.00005;
              });
              const hasNew = importedCharges.some(ic => !currentByName.has(ic.chargeName));

              return (
                <>
                  {(hasChanges || hasNew) && (
                    <div className="rounded-md border p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                      <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                        {hasChanges && hasNew
                          ? "Wykryto zmiany stawek oraz nowe pozycje. Sprawdź porównanie i potwierdź import."
                          : hasChanges
                          ? "Wykryto zmiany stawek. Sprawdź porównanie poniżej i potwierdź import."
                          : "Wykryto nowe pozycje opłat. Sprawdź i potwierdź import."}
                      </p>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Nazwa opłaty</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead className="text-right">Aktualna stawka</TableHead>
                        <TableHead className="text-right">Nowa stawka</TableHead>
                        <TableHead className="text-right">Zmiana</TableHead>
                        <TableHead>Jednostka</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importedCharges.map((ic, idx) => {
                        const currentPrice = currentByName.get(ic.chargeName);
                        const isNew = currentPrice === undefined;
                        const diff = isNew ? null : ic.unitPrice - currentPrice;
                        const diffPct = isNew || currentPrice === 0 ? null : ((diff! / currentPrice) * 100);
                        const isHigher = diff !== null && diff > 0.00005;
                        const isLower = diff !== null && diff < -0.00005;
                        const isUnchanged = diff !== null && Math.abs(diff) <= 0.00005;

                        return (
                          <TableRow
                            key={idx}
                            data-testid={`row-import-charge-${idx}`}
                            className={isNew ? "bg-blue-50/50 dark:bg-blue-950/20" : isHigher ? "bg-red-50/50 dark:bg-red-950/20" : isLower ? "bg-green-50/50 dark:bg-green-950/20" : ""}
                          >
                            <TableCell>
                              <Checkbox
                                checked={ic.selected}
                                onCheckedChange={(checked) => {
                                  const updated = [...importedCharges];
                                  updated[idx] = { ...updated[idx], selected: !!checked };
                                  setImportedCharges(updated);
                                }}
                                data-testid={`checkbox-import-charge-${idx}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={ic.chargeName}
                                onChange={(e) => {
                                  const updated = [...importedCharges];
                                  updated[idx] = { ...updated[idx], chargeName: e.target.value };
                                  setImportedCharges(updated);
                                }}
                                className="text-sm"
                                data-testid={`input-import-name-${idx}`}
                              />
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">
                                {ic.chargeType === "variable" ? "zmienna" : "stała"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {isNew ? (
                                <Badge variant="outline" className="text-blue-600 dark:text-blue-400 no-default-hover-elevate no-default-active-elevate">NOWA</Badge>
                              ) : (
                                <span>{currentPrice.toFixed(4)} zł</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.0001"
                                value={ic.unitPrice}
                                onChange={(e) => {
                                  const updated = [...importedCharges];
                                  updated[idx] = { ...updated[idx], unitPrice: parseFloat(e.target.value) || 0 };
                                  setImportedCharges(updated);
                                }}
                                className="w-28 ml-auto"
                                data-testid={`input-import-price-${idx}`}
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm">
                              {isNew ? (
                                <span className="text-blue-600 dark:text-blue-400">—</span>
                              ) : isUnchanged ? (
                                <span className="text-muted-foreground">bez zmian</span>
                              ) : (
                                <span className={isHigher ? "text-red-600 dark:text-red-400 font-medium" : "text-green-600 dark:text-green-400 font-medium"}>
                                  {isHigher ? "+" : ""}{diff!.toFixed(4)} zł
                                  {diffPct !== null && ` (${isHigher ? "+" : ""}${diffPct.toFixed(1)}%)`}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {ic.unit}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {(() => {
                    const selectedImported = importedCharges.filter(c => c.selected);
                    const newVarSum = selectedImported.filter(c => c.chargeType === "variable").reduce((s, c) => s + c.unitPrice, 0);
                    const newFixSum = selectedImported.filter(c => c.chargeType === "fixed").reduce((s, c) => s + c.unitPrice, 0);
                    const oldVarSum = variableSum;
                    const oldFixSum = fixedSum;
                    return (
                      <div className="rounded-md border p-3 bg-muted/30 space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Podsumowanie po imporcie:</p>
                        <div className="flex gap-6 text-sm">
                          <span>Zmienne: <span className="text-muted-foreground">{oldVarSum.toFixed(4)}</span> → <span className="font-medium">{newVarSum.toFixed(4)} zł/kWh</span></span>
                          <span>Stałe: <span className="text-muted-foreground">{oldFixSum.toFixed(4)}</span> → <span className="font-medium">{newFixSum.toFixed(4)} zł/mc</span></span>
                        </div>
                      </div>
                    );
                  })()}
                </>
              );
            })()}

            <div className="flex justify-end gap-2">
              <Button
                data-testid="button-confirm-import"
                disabled={bulkImport.isPending || importedCharges.filter(c => c.selected).length === 0}
                onClick={handleImportConfirm}
              >
                {bulkImport.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Check className="w-4 h-4 mr-1" />
                )}
                Potwierdź zmianę stawek ({importedCharges.filter(c => c.selected).length})
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Opłaty zmienne (za kWh)</h3>
                <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                  Suma: {formatNum(variableSum, 4)} zł/kWh
                </Badge>
              </div>
              {variableCharges.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nazwa</TableHead>
                      <TableHead className="text-right">Cena netto</TableHead>
                      <TableHead>Obowiązuje od</TableHead>
                      <TableHead className="text-right w-28">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variableCharges.map(item => renderChargeRow(item, true))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Brak opłat zmiennych</p>
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Opłaty stałe (za miesiąc)</h3>
                <Badge variant="outline" className="no-default-hover-elevate no-default-active-elevate">
                  Suma: {formatNum(fixedSum, 2)} zł/mc
                </Badge>
              </div>
              {fixedCharges.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nazwa</TableHead>
                      <TableHead className="text-right">Cena netto</TableHead>
                      <TableHead>Obowiązuje od</TableHead>
                      <TableHead className="text-right w-28">Akcje</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fixedCharges.map(item => renderChargeRow(item, false))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-2">Brak opłat stałych</p>
              )}
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-2 p-3 bg-muted/50 rounded-md flex-wrap">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Stawka VAT</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="1"
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    className="w-20"
                    data-testid="input-vat-rate"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
              <div className="text-right space-y-1">
                <p className="text-xs text-muted-foreground">Zmienne: {formatNum(variableSum, 4)} zł/kWh</p>
                <p className="text-xs text-muted-foreground">Stałe: {formatNum(fixedSum, 2)} zł/mc</p>
              </div>
            </div>

            {addMode ? (
              <div className="space-y-3 p-3 border rounded-md">
                <h4 className="text-sm font-medium">Dodaj nową opłatę</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Typ opłaty</Label>
                    <Select
                      value={newChargeType}
                      onValueChange={(v) => {
                        setNewChargeType(v as "variable" | "fixed");
                        setNewChargeName("");
                      }}
                    >
                      <SelectTrigger data-testid="select-charge-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="variable">Zmienna (za kWh)</SelectItem>
                        <SelectItem value="fixed">Stała (za miesiąc)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nazwa opłaty</Label>
                    <Select
                      value={newChargeName}
                      onValueChange={setNewChargeName}
                    >
                      <SelectTrigger data-testid="select-charge-name">
                        <SelectValue placeholder="Wybierz..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(newChargeType === "variable" ? PREDEFINED_VARIABLE_CHARGES : PREDEFINED_FIXED_CHARGES).map(name => (
                          <SelectItem key={name} value={name}>{name}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">Inna...</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {newChargeName === "__custom__" && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nazwa własna</Label>
                    <Input
                      value={newChargeNameCustom}
                      onChange={(e) => setNewChargeNameCustom(e.target.value)}
                      placeholder="Nazwa opłaty"
                      data-testid="input-charge-name-custom"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Cena netto ({newChargeType === "variable" ? "zł/kWh" : "zł/mc"})
                    </Label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={newUnitPrice}
                      onChange={(e) => setNewUnitPrice(e.target.value)}
                      placeholder="0.0000"
                      data-testid="input-charge-price"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Obowiązuje od</Label>
                    <Input
                      type="date"
                      value={newValidFrom}
                      onChange={(e) => setNewValidFrom(e.target.value)}
                      data-testid="input-charge-valid-from"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddMode(false)}
                    data-testid="button-cancel-add-charge"
                  >
                    Anuluj
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canAdd || addCharge.isPending}
                    onClick={() => addCharge.mutate()}
                    data-testid="button-save-charge"
                  >
                    {addCharge.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                    Dodaj
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAddMode(true)}
                  data-testid="button-add-charge"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Dodaj opłatę
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importLoading}
                  data-testid="button-import-invoice"
                >
                  {importLoading ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <FileUp className="w-4 h-4 mr-1" />
                  )}
                  {importLoading ? "Analizowanie..." : "Importuj z faktury PDF"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
          </div>
        )}

        <Dialog open={!!historyChargeName} onOpenChange={(v) => { if (!v) setHistoryChargeName(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Historia zmian — {historyChargeName}</DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obowiązuje od</TableHead>
                  <TableHead className="text-right">Cena netto</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyCharges.map(c => (
                  <TableRow key={c.id} data-testid={`row-history-charge-${c.id}`}>
                    <TableCell className="text-sm">{formatDate(c.validFrom)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      {formatNum(c.unitPrice, 4)} zł
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-delete-history-charge-${c.id}`}
                        onClick={() => deleteCharge.mutate(c.id)}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DialogFooter>
              <Button variant="outline" onClick={() => setHistoryChargeName(null)} data-testid="button-close-history">
                Zamknij
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="button-close-charges">Zamknij</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditReportDialog({
  report,
  open,
  onOpenChange,
  onSave,
  isPending,
}: {
  report: MediaSettlementReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Record<string, unknown>) => void;
  isPending: boolean;
}) {
  const [periodFrom, setPeriodFrom] = useState(report.periodFrom || "");
  const [periodTo, setPeriodTo] = useState(report.periodTo || "");
  const [elecConsumption, setElecConsumption] = useState(report.electricityConsumption || "");
  const [elecCost, setElecCost] = useState(report.electricityCost || "");
  const [elecFixedCharges, setElecFixedCharges] = useState(report.electricityFixedCharges || "");
  const [elecVatRate, setElecVatRate] = useState(report.electricityVatRate || "23");
  const [elecNetto, setElecNetto] = useState(report.electricityNetto || "");
  const [elecBrutto, setElecBrutto] = useState(report.electricityBrutto || "");
  const [coldConsumption, setColdConsumption] = useState(report.coldWaterConsumption || "");
  const [coldCost, setColdCost] = useState(report.coldWaterCost || "");
  const [hotConsumption, setHotConsumption] = useState(report.hotWaterConsumption || "");
  const [hotCost, setHotCost] = useState(report.hotWaterCost || "");
  const [paymentStatus, setPaymentStatus] = useState(report.paymentStatus || "NIEOPLACONE");

  const hasVatFields = !!(elecNetto && parseFloat(String(elecNetto)) > 0);

  const totalCost = hasVatFields
    ? (parseFloat(String(elecBrutto)) || 0) + (parseFloat(String(coldCost)) || 0) + (parseFloat(String(hotCost)) || 0)
    : [elecCost, coldCost, hotCost].reduce((sum, v) => sum + (parseFloat(String(v)) || 0), 0);

  const handleSubmit = () => {
    const data: Record<string, unknown> = {
      periodFrom,
      periodTo,
      electricityConsumption: elecConsumption || null,
      electricityCost: hasVatFields ? elecBrutto : (elecCost || null),
      coldWaterConsumption: coldConsumption || null,
      coldWaterCost: coldCost || null,
      hotWaterConsumption: hotConsumption || null,
      hotWaterCost: hotCost || null,
      totalCost: totalCost.toFixed(2),
      paymentStatus,
    };
    if (hasVatFields) {
      data.electricityFixedCharges = elecFixedCharges || null;
      data.electricityVatRate = elecVatRate || "23";
      data.electricityNetto = elecNetto || null;
      data.electricityBrutto = elecBrutto || null;
    }
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj rozliczenie</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data od</Label>
              <Input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                data-testid="input-edit-period-from"
              />
            </div>
            <div className="space-y-1">
              <Label>Data do</Label>
              <Input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                data-testid="input-edit-period-to"
              />
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-1"><Zap className="w-4 h-4" /> Energia elektryczna</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Zużycie (kWh)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={elecConsumption}
                  onChange={(e) => setElecConsumption(e.target.value)}
                  data-testid="input-edit-elec-consumption"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Opłaty stałe (zł)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={elecFixedCharges}
                  onChange={(e) => setElecFixedCharges(e.target.value)}
                  data-testid="input-edit-elec-fixed"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Netto (zł)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={elecNetto}
                  onChange={(e) => {
                    setElecNetto(e.target.value);
                    const n = parseFloat(e.target.value) || 0;
                    const vat = parseFloat(String(elecVatRate)) || 23;
                    setElecBrutto((n * (1 + vat / 100)).toFixed(2));
                    setElecCost((n * (1 + vat / 100)).toFixed(2));
                  }}
                  data-testid="input-edit-elec-netto"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">VAT (%)</Label>
                <Input
                  type="number"
                  step="1"
                  value={elecVatRate}
                  onChange={(e) => {
                    setElecVatRate(e.target.value);
                    const n = parseFloat(String(elecNetto)) || 0;
                    const vat = parseFloat(e.target.value) || 23;
                    setElecBrutto((n * (1 + vat / 100)).toFixed(2));
                    setElecCost((n * (1 + vat / 100)).toFixed(2));
                  }}
                  data-testid="input-edit-elec-vat"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Brutto (zł)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={elecBrutto}
                  onChange={(e) => setElecBrutto(e.target.value)}
                  data-testid="input-edit-elec-brutto"
                  className="font-medium"
                />
              </div>
            </div>

            <Separator />
            <h4 className="text-sm font-medium flex items-center gap-1"><Droplets className="w-4 h-4" /> Woda zimna</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Zużycie (m³)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={coldConsumption}
                  onChange={(e) => setColdConsumption(e.target.value)}
                  data-testid="input-edit-cold-consumption"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Koszt (zł)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={coldCost}
                  onChange={(e) => setColdCost(e.target.value)}
                  data-testid="input-edit-cold-cost"
                />
              </div>
            </div>

            <Separator />
            <h4 className="text-sm font-medium flex items-center gap-1"><Droplets className="w-4 h-4" /> Woda ciepła</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Zużycie (m³)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={hotConsumption}
                  onChange={(e) => setHotConsumption(e.target.value)}
                  data-testid="input-edit-hot-consumption"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Koszt (zł)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={hotCost}
                  onChange={(e) => setHotCost(e.target.value)}
                  data-testid="input-edit-hot-cost"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
            <span className="font-medium">Razem</span>
            <span className="text-lg font-bold">{formatNum(totalCost)} zł</span>
          </div>

          <div className="space-y-1">
            <Label>Status płatności</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={paymentStatus === "NIEOPLACONE" ? "default" : "outline"}
                onClick={() => setPaymentStatus("NIEOPLACONE")}
                data-testid="button-edit-status-nieoplacone"
              >
                NIEOPŁACONE
              </Button>
              <Button
                size="sm"
                variant={paymentStatus === "OPLACONE" ? "default" : "outline"}
                className={paymentStatus === "OPLACONE" ? "bg-green-600 text-white" : ""}
                onClick={() => setPaymentStatus("OPLACONE")}
                data-testid="button-edit-status-oplacone"
              >
                OPŁACONE
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Anuluj</Button>
          </DialogClose>
          <Button
            data-testid="button-save-edit-report"
            disabled={isPending || !periodFrom || !periodTo}
            onClick={handleSubmit}
          >
            {isPending ? "Zapisywanie..." : "Zapisz zmiany"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubleaseMediaCard({
  sublease,
  apartments,
}: {
  sublease: Sublease;
  apartments: Apartment[];
}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("electricity");
  const [expanded, setExpanded] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [priceHistoryOpen, setPriceHistoryOpen] = useState(false);
  const [priceHistoryType, setPriceHistoryType] = useState<MeterType>("electricity");
  const [newReadingDate, setNewReadingDate] = useState("");
  const [newReadingValue, setNewReadingValue] = useState("");
  const [addingReadingType, setAddingReadingType] = useState<MeterType | null>(null);
  const [editReport, setEditReport] = useState<MediaSettlementReport | null>(null);
  const [chargesDialogOpen, setChargesDialogOpen] = useState(false);

  const apt = apartments.find((a) => a.id === sublease.apartmentId);
  const aptName = apt?.name || `Apt #${sublease.apartmentId}`;
  const tenantName = sublease.tenantType === "firma"
    ? sublease.companyName || ""
    : `${sublease.firstName || ""} ${sublease.lastName || ""}`.trim();

  const notesKey = ["/api/accounting-notes", sublease.id];
  const { data: accountingNotes = [] } = useQuery<AccountingNote[]>({
    queryKey: notesKey,
    queryFn: () => fetch(`/api/accounting-notes?subleaseId=${sublease.id}`, { credentials: "include" }).then(r => r.json()),
  });

  const readingsKey = [`/api/subleases/${sublease.id}/meter-readings`];
  const settingsKey = [`/api/subleases/${sublease.id}/meter-settings`];
  const pricesKey = [`/api/subleases/${sublease.id}/meter-prices`];
  const reportsKey = [`/api/subleases/${sublease.id}/settlement-reports`];

  const { data: readings = [], isLoading: readingsLoading } = useQuery<SubleaseMeterReading[]>({
    queryKey: readingsKey,
  });

  const { data: settings = [], isLoading: settingsLoading } = useQuery<SubleaseMeterSetting[]>({
    queryKey: settingsKey,
  });

  const { data: prices = [], isLoading: pricesLoading } = useQuery<SubleaseMeterPrice[]>({
    queryKey: pricesKey,
  });

  const { data: reports = [] } = useQuery<MediaSettlementReport[]>({
    queryKey: [`/api/subleases/${sublease.id}/settlement-reports`],
  });

  const chargesKey = [`/api/subleases/${sublease.id}/electricity-charges`];
  const { data: electricityCharges = [] } = useQuery<SubleaseElectricityCharge[]>({
    queryKey: chargesKey,
  });

  const saveSetting = useMutation({
    mutationFn: async (data: { meterType: string; unitPrice?: string; initialReading?: string; initialDate?: string }) => {
      await apiRequest("POST", `/api/subleases/${sublease.id}/meter-settings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKey });
      toast({ title: "Zapisano ustawienia" });
    },
  });

  const saveReading = useMutation({
    mutationFn: async (data: { meterType: string; readingDate: string; reading: string }) => {
      await apiRequest("POST", `/api/subleases/${sublease.id}/meter-readings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readingsKey });
      toast({ title: "Zapisano odczyt" });
    },
  });

  const deleteReading = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/meter-readings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readingsKey });
      toast({ title: "Usunięto odczyt" });
    },
  });

  const getSetting = useCallback(
    (type: MeterType) => settings.find((s) => s.meterType === type),
    [settings]
  );

  const getReadingsForType = useCallback(
    (type: MeterType) =>
      readings
        .filter((r) => r.meterType === type && r.readingDate)
        .sort((a, b) => (a.readingDate || "").localeCompare(b.readingDate || "")),
    [readings]
  );

  const getPriceAtDate = useCallback(
    (type: MeterType, date: string): number => {
      const typePrices = prices
        .filter((p) => p.meterType === type)
        .sort((a, b) => b.validFrom.localeCompare(a.validFrom));
      const applicable = typePrices.find((p) => p.validFrom <= date);
      if (applicable) return parseFloat(applicable.unitPrice) || 0;
      const setting = getSetting(type);
      return parseFloat(setting?.unitPrice || "0") || 0;
    },
    [prices, getSetting]
  );

  const computeRow = useCallback(
    (type: MeterType, readingIndex: number) => {
      const typeReadings = getReadingsForType(type);
      const setting = getSetting(type);
      const current = typeReadings[readingIndex];
      if (!current?.reading || !current.readingDate) return { days: null, consumption: null, cost: null, unitPrice: 0 };

      const currentVal = parseFloat(current.reading) || 0;
      const initialDate = setting?.initialDate || sublease.startDate;
      const initialReading = parseFloat(setting?.initialReading || "0") || 0;
      const unitPrice = getPriceAtDate(type, current.readingDate);

      let prevDate: string;
      let prevVal: number;

      if (readingIndex === 0) {
        prevDate = initialDate;
        prevVal = initialReading;
      } else {
        const prev = typeReadings[readingIndex - 1];
        prevDate = prev.readingDate || initialDate;
        prevVal = parseFloat(prev.reading || "0") || 0;
      }

      const days = daysBetween(prevDate, current.readingDate);
      const consumption = currentVal - prevVal;
      const cost = consumption * unitPrice;

      return { days, consumption, cost, unitPrice };
    },
    [getReadingsForType, getSetting, getPriceAtDate, sublease.startDate]
  );

  const lastReportPeriodTo = useMemo(() => {
    if (reports.length === 0) return null;
    const sorted = [...reports].sort((a, b) => b.periodTo.localeCompare(a.periodTo));
    return sorted[0].periodTo;
  }, [reports]);

  const currentPeriodFrom = useMemo(() => {
    return lastReportPeriodTo || sublease.startDate;
  }, [lastReportPeriodTo, sublease.startDate]);

  const currentPeriodTo = useMemo(() => {
    return new Date().toISOString().slice(0, 10);
  }, []);

  const getElectricityChargesAtDate = useCallback((date: string) => {
    const chargesByName = new Map<string, SubleaseElectricityCharge>();
    for (const charge of electricityCharges) {
      if (charge.validFrom <= date) {
        const existing = chargesByName.get(charge.chargeName);
        if (!existing || charge.validFrom > existing.validFrom) {
          chargesByName.set(charge.chargeName, charge);
        }
      }
    }
    return Array.from(chargesByName.values());
  }, [electricityCharges]);

  const getCurrentPeriodData = useCallback(() => {
    const types: MeterType[] = ["electricity", "cold_water", "hot_water"];
    let total = 0;
    const periodFrom = currentPeriodFrom;
    const periodTo = currentPeriodTo;
    let elecNetto = 0;
    let elecBrutto = 0;
    let elecFixedCharges = 0;
    let elecVatRate = 23;
    let elecVariableDetails: { name: string; consumption: number; unitPrice: number; cost: number }[] = [];
    let elecFixedDetails: { name: string; unitPrice: number; months: number; cost: number }[] = [];
    const useNewCharges = electricityCharges.length > 0;

    const items = types.map((type) => {
      const typeReadings = getReadingsForType(type);
      const setting = getSetting(type);
      const initialDate = setting?.initialDate || sublease.startDate;
      const initialReading = parseFloat(setting?.initialReading || "0") || 0;

      let periodConsumption = 0;
      let periodCost = 0;

      const allPoints = [
        { date: initialDate, value: initialReading },
        ...typeReadings.map(r => ({ date: r.readingDate || "", value: parseFloat(r.reading || "0") || 0 }))
      ].sort((a, b) => a.date.localeCompare(b.date));

      const baselinePoint = allPoints.filter(p => p.date <= periodFrom).pop();
      const baselineValue = baselinePoint ? baselinePoint.value : initialReading;

      const periodReadings = allPoints.filter(p => p.date > periodFrom && p.date <= periodTo);

      let prevValue = baselineValue;
      for (const curr of periodReadings) {
        const consumption = curr.value - prevValue;
        if (type === "electricity" && useNewCharges) {
          periodConsumption += consumption;
        } else {
          const unitPrice = getPriceAtDate(type, curr.date);
          periodConsumption += consumption;
          periodCost += consumption * unitPrice;
        }
        prevValue = curr.value;
      }

      if (type === "electricity" && useNewCharges && periodConsumption > 0) {
        const charges = getElectricityChargesAtDate(periodTo);
        const variableCharges = charges.filter(c => c.chargeType === "variable");
        const fixedCharges = charges.filter(c => c.chargeType === "fixed");

        let variableTotal = 0;
        elecVariableDetails = variableCharges.map(c => {
          const price = parseFloat(c.unitPrice);
          const cost = periodConsumption * price;
          variableTotal += cost;
          return { name: c.chargeName, consumption: periodConsumption, unitPrice: price, cost };
        });

        const fromDate = new Date(periodFrom);
        const toDate = new Date(periodTo);
        const months = Math.max(1, Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24 * 30)));

        let fixedTotal = 0;
        elecFixedDetails = fixedCharges.map(c => {
          const price = parseFloat(c.unitPrice);
          const cost = price * months;
          fixedTotal += cost;
          return { name: c.chargeName, unitPrice: price, months, cost };
        });

        elecFixedCharges = fixedTotal;
        elecNetto = variableTotal + fixedTotal;
        elecBrutto = elecNetto * (1 + elecVatRate / 100);
        periodCost = elecBrutto;
      }

      total += periodCost;
      return {
        type,
        label: METER_TYPES[type].label,
        unit: METER_TYPES[type].unit,
        totalConsumption: periodConsumption,
        totalCost: periodCost,
      };
    });
    return {
      items, total, periodFrom, periodTo,
      elecNetto, elecBrutto, elecFixedCharges, elecVatRate,
      elecVariableDetails, elecFixedDetails,
      useNewCharges,
    };
  }, [getReadingsForType, getSetting, getPriceAtDate, getElectricityChargesAtDate, currentPeriodFrom, currentPeriodTo, sublease.startDate, electricityCharges]);

  const createReport = useMutation({
    mutationFn: async () => {
      const data = getCurrentPeriodData();
      const elec = data.items.find(i => i.type === "electricity");
      const cold = data.items.find(i => i.type === "cold_water");
      const hot = data.items.find(i => i.type === "hot_water");
      const reportData: Record<string, unknown> = {
        periodFrom: data.periodFrom,
        periodTo: data.periodTo,
        electricityConsumption: elec?.totalConsumption?.toFixed(3) || "0",
        electricityCost: elec?.totalCost?.toFixed(2) || "0",
        coldWaterConsumption: cold?.totalConsumption?.toFixed(3) || "0",
        coldWaterCost: cold?.totalCost?.toFixed(2) || "0",
        hotWaterConsumption: hot?.totalConsumption?.toFixed(3) || "0",
        hotWaterCost: hot?.totalCost?.toFixed(2) || "0",
        totalCost: data.total.toFixed(2),
        paymentStatus: "NIEOPLACONE",
      };
      if (data.useNewCharges) {
        reportData.electricityFixedCharges = data.elecFixedCharges.toFixed(2);
        reportData.electricityVatRate = data.elecVatRate.toFixed(2);
        reportData.electricityNetto = data.elecNetto.toFixed(2);
        reportData.electricityBrutto = data.elecBrutto.toFixed(2);
      }
      const res = await apiRequest("POST", `/api/subleases/${sublease.id}/settlement-reports`, reportData);
      return res;
    },
    onSuccess: async (res) => {
      queryClient.invalidateQueries({ queryKey: reportsKey });
      setGenerateOpen(false);
      toast({ title: "Wygenerowano raport rozliczeniowy" });
      try {
        const report = await res.json();
        if (report?.id) {
          await apiRequest("POST", "/api/accounting-notes/generate", { reportId: report.id, subleaseId: sublease.id });
          queryClient.invalidateQueries({ queryKey: notesKey });
          toast({ title: "Wygenerowano notę księgową" });
        }
      } catch (noteErr: any) {
        toast({ title: "Błąd generowania noty księgowej", description: noteErr?.message || "Spróbuj wygenerować notę ręcznie", variant: "destructive" });
      }
    },
  });

  const updateReportStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      await apiRequest("PATCH", `/api/settlement-reports/${id}/status`, { paymentStatus: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportsKey });
      toast({ title: "Zaktualizowano status płatności" });
    },
  });

  const updateReport = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/settlement-reports/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportsKey });
      toast({ title: "Zaktualizowano rozliczenie" });
      setEditReport(null);
    },
  });

  const deleteReport = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/settlement-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportsKey });
      toast({ title: "Usunięto raport" });
    },
  });

  const downloadNoteById = async (noteId: number) => {
    try {
      const res = await fetch(`/api/accounting-notes/${noteId}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Nie udało się pobrać noty");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("content-disposition");
      const match = disposition?.match(/filename="?(.+)"?/);
      a.download = match?.[1] || `nota_${noteId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Błąd pobierania noty", description: err.message, variant: "destructive" });
    }
  };

  const generateNote = useMutation({
    mutationFn: async (reportId: number) => {
      const res = await apiRequest("POST", "/api/accounting-notes/generate", { reportId, subleaseId: sublease.id });
      return res.json();
    },
    onSuccess: async (note: AccountingNote) => {
      queryClient.invalidateQueries({ queryKey: notesKey });
      toast({ title: `Wygenerowano notę ${note.noteNumber}` });
      await downloadNoteById(note.id);
    },
    onError: (err: Error) => {
      toast({ title: "Błąd generowania noty", description: err.message, variant: "destructive" });
    },
  });

  const computeElecRowCost = useCallback(
    (consumption: number, readingDate: string) => {
      const charges = getElectricityChargesAtDate(readingDate);
      if (charges.length === 0) return { netto: 0, brutto: 0, varSum: 0, fixSum: 0 };
      const varCharges = charges.filter(c => c.chargeType === "variable");
      const fixCharges = charges.filter(c => c.chargeType === "fixed");
      const varSum = varCharges.reduce((s, c) => s + (parseFloat(c.unitPrice) || 0), 0);
      const fixSum = fixCharges.reduce((s, c) => s + (parseFloat(c.unitPrice) || 0), 0);
      const netto = consumption * varSum + fixSum;
      const brutto = netto * 1.23;
      return { netto, brutto, varSum, fixSum };
    },
    [getElectricityChargesAtDate]
  );

  const renderMeterTab = (types: MeterType[]) => {
    return types.map((type) => {
      const setting = getSetting(type);
      const info = METER_TYPES[type];
      const typeReadings = getReadingsForType(type);
      const initialDate = setting?.initialDate || sublease.startDate;

      const typePrices = prices.filter((p) => p.meterType === type);
      const hasHistoricalPrices = typePrices.length > 0;

      const isElecWithCharges = type === "electricity" && electricityCharges.length > 0;

      const currentVarSum = isElecWithCharges
        ? electricityCharges
            .filter(c => c.chargeType === "variable")
            .reduce((grouped, c) => {
              const existing = grouped.get(c.chargeName);
              if (!existing || c.validFrom > existing.validFrom) grouped.set(c.chargeName, c);
              return grouped;
            }, new Map<string, SubleaseElectricityCharge>())
        : new Map();
      const currentFixSum = isElecWithCharges
        ? electricityCharges
            .filter(c => c.chargeType === "fixed")
            .reduce((grouped, c) => {
              const existing = grouped.get(c.chargeName);
              if (!existing || c.validFrom > existing.validFrom) grouped.set(c.chargeName, c);
              return grouped;
            }, new Map<string, SubleaseElectricityCharge>())
        : new Map();
      const varTotal = Array.from(currentVarSum.values()).reduce((s, c) => s + (parseFloat(c.unitPrice) || 0), 0);
      const fixTotal = Array.from(currentFixSum.values()).reduce((s, c) => s + (parseFloat(c.unitPrice) || 0), 0);

      return (
        <div key={type} className="space-y-3">
          {types.length > 1 && (
            <h4 className="font-medium text-sm flex items-center gap-2">
              <info.icon className="w-4 h-4" />
              {info.label}
            </h4>
          )}
          <div className={`grid ${isElecWithCharges ? "grid-cols-2 md:grid-cols-4" : "grid-cols-3"} gap-3`}>
            <div>
              <Label className="text-xs text-muted-foreground">Stan początkowy</Label>
              <InlineEditInput
                key={`init-${type}-${setting?.id ?? "new"}`}
                testId={`input-initial-reading-${type}-${sublease.id}`}
                initialValue={setting?.initialReading || ""}
                step="0.001"
                placeholder="0.000"
                onSave={(val) => {
                  saveSetting.mutate({
                    meterType: type,
                    initialReading: val,
                    unitPrice: setting?.unitPrice || "0",
                    initialDate: setting?.initialDate || sublease.startDate,
                  });
                }}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Data stanu początkowego</Label>
              <InlineEditInput
                key={`initdate-${type}-${setting?.id ?? "new"}-${setting?.initialDate || sublease.startDate}`}
                testId={`input-initial-date-${type}-${sublease.id}`}
                initialValue={setting?.initialDate || sublease.startDate}
                type="date"
                placeholder=""
                onSave={(val) => {
                  saveSetting.mutate({
                    meterType: type,
                    initialDate: val,
                    initialReading: setting?.initialReading || "0",
                    unitPrice: setting?.unitPrice || "0",
                  });
                }}
              />
            </div>
            {isElecWithCharges ? (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground">Opłaty zmienne</Label>
                  <div className="text-sm font-medium mt-1">{formatNum(varTotal, 4)} zł/kWh</div>
                  <p className="text-xs text-muted-foreground">{currentVarSum.size} pozycji</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Opłaty stałe</Label>
                  <div className="text-sm font-medium mt-1">{formatNum(fixTotal, 4)} zł/mc</div>
                  <div className="flex items-center gap-1 mt-1">
                    <p className="text-xs text-muted-foreground">{currentFixSum.size} pozycji</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2"
                      data-testid={`button-show-charges-${sublease.id}`}
                      onClick={() => setChargesOpen(true)}
                    >
                      <FileText className="w-3 h-3 mr-1" />
                      Cennik
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <Label className="text-xs text-muted-foreground">
                  {hasHistoricalPrices ? "Cena bazowa" : "Cena jednostkowa"} ({info.unit === "kWh" ? "zł/kWh" : `zł/${info.unit}`})
                </Label>
                <div className="flex items-center gap-1">
                  <InlineEditInput
                    key={`price-${type}-${setting?.id ?? "new"}`}
                    testId={`input-unit-price-${type}-${sublease.id}`}
                    initialValue={setting?.unitPrice || ""}
                    step="0.0001"
                    placeholder="0.0000"
                    onSave={(val) => {
                      saveSetting.mutate({
                        meterType: type,
                        unitPrice: val,
                        initialReading: setting?.initialReading || "0",
                        initialDate: setting?.initialDate || sublease.startDate,
                      });
                    }}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    data-testid={`button-price-history-${type}-${sublease.id}`}
                    onClick={() => {
                      setPriceHistoryType(type);
                      setPriceHistoryOpen(true);
                    }}
                    title="Historia cen"
                  >
                    <History className="w-4 h-4" />
                  </Button>
                </div>
                {hasHistoricalPrices && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {typePrices.length} zmian{typePrices.length === 1 ? "a" : typePrices.length < 5 ? "y" : ""} cen
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-2 mb-1">
            Stan początkowy: <span className="font-medium text-foreground">{formatNum(setting?.initialReading, 3) || "—"}</span>
            z dnia <span className="font-medium text-foreground">{formatDate(initialDate)}</span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Data odczytu</TableHead>
                  <TableHead className="min-w-[80px]">Ilość dni</TableHead>
                  <TableHead className="min-w-[120px]">Stan licznika</TableHead>
                  <TableHead className="min-w-[100px]">Zużycie ({info.unit})</TableHead>
                  {isElecWithCharges ? (
                    <>
                      <TableHead className="min-w-[100px]">Netto</TableHead>
                      <TableHead className="min-w-[100px]">Brutto (z VAT)</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="min-w-[100px]">Cena jedn.</TableHead>
                      <TableHead className="min-w-[100px]">Koszt (PLN)</TableHead>
                    </>
                  )}
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typeReadings.map((reading, ri) => {
                  const row = computeRow(type, ri);
                  const elecCost = isElecWithCharges && row.consumption !== null && reading.readingDate
                    ? computeElecRowCost(row.consumption, reading.readingDate)
                    : null;
                  return (
                    <TableRow key={reading.id}>
                      <TableCell className="text-sm font-medium">
                        {formatDate(reading.readingDate)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.days !== null ? row.days : "—"}
                      </TableCell>
                      <TableCell>
                        <InlineEditInput
                          key={`${type}-${reading.id}-${reading.reading}`}
                          testId={`input-reading-${type}-${reading.id}-${sublease.id}`}
                          initialValue={reading.reading || ""}
                          step="0.001"
                          placeholder="—"
                          className="w-28"
                          onSave={(val) => {
                            saveReading.mutate({
                              meterType: type,
                              readingDate: reading.readingDate || "",
                              reading: val,
                            });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.consumption !== null ? formatNum(row.consumption, 3) : "—"}
                      </TableCell>
                      {isElecWithCharges ? (
                        <>
                          <TableCell className="text-sm text-muted-foreground">
                            {elecCost ? `${formatNum(elecCost.netto)} zł` : "—"}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {elecCost ? `${formatNum(elecCost.brutto)} zł` : "—"}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="text-sm text-muted-foreground">
                            {row.unitPrice > 0 ? `${formatNum(row.unitPrice, 4)} zł` : "—"}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {row.cost !== null ? `${formatNum(row.cost)} zł` : "—"}
                          </TableCell>
                        </>
                      )}
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          data-testid={`button-delete-reading-${reading.id}`}
                          onClick={() => deleteReading.mutate(reading.id)}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow>
                  <TableCell colSpan={7}>
                    {addingReadingType === type ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="date"
                          data-testid={`input-new-reading-date-${type}-${sublease.id}`}
                          value={newReadingDate}
                          onChange={(e) => setNewReadingDate(e.target.value)}
                          className="w-40"
                        />
                        <Input
                          type="number"
                          step="0.001"
                          data-testid={`input-new-reading-value-${type}-${sublease.id}`}
                          value={newReadingValue}
                          onChange={(e) => setNewReadingValue(e.target.value)}
                          placeholder="Stan licznika"
                          className="w-32"
                        />
                        <Button
                          size="sm"
                          data-testid={`button-save-new-reading-${type}-${sublease.id}`}
                          disabled={!newReadingDate || !newReadingValue || saveReading.isPending}
                          onClick={() => {
                            saveReading.mutate(
                              { meterType: type, readingDate: newReadingDate, reading: newReadingValue },
                              {
                                onSuccess: () => {
                                  setNewReadingDate("");
                                  setNewReadingValue("");
                                  setAddingReadingType(null);
                                },
                              }
                            );
                          }}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Zapisz
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAddingReadingType(null);
                            setNewReadingDate("");
                            setNewReadingValue("");
                          }}
                        >
                          Anuluj
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid={`button-add-reading-${type}-${sublease.id}`}
                        onClick={() => setAddingReadingType(type)}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Dodaj odczyt
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      );
    });
  };

  const isLoading = readingsLoading || settingsLoading || pricesLoading;

  return (
    <>
      <Card data-testid={`card-sublease-media-${sublease.id}`}>
        <CardHeader
          className="flex flex-row items-center justify-between gap-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-base">{tenantName}</CardTitle>
            <Badge variant="secondary">{aptName}</Badge>
            <span className="text-xs text-muted-foreground">
              {formatDate(sublease.startDate)} — {formatDate(sublease.endDate)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              data-testid={`button-electricity-charges-${sublease.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setChargesDialogOpen(true);
              }}
            >
              <Settings2 className="w-4 h-4 mr-1" />
              Opłaty prądu
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid={`button-generate-report-${sublease.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setGenerateOpen(true);
              }}
            >
              <ClipboardCheck className="w-4 h-4 mr-1" />
              Generuj rozliczenie
            </Button>
            {reports.filter(r => r.paymentStatus === "NIEOPLACONE").length > 0 && (
              <Badge variant="destructive" className="no-default-hover-elevate no-default-active-elevate">
                {reports.filter(r => r.paymentStatus === "NIEOPLACONE").length} nieopłacone
              </Badge>
            )}
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </CardHeader>
        {expanded && (
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : (
              <>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="electricity" data-testid={`tab-electricity-${sublease.id}`}>
                    <Zap className="w-4 h-4 mr-1" />
                    Energia elektryczna
                  </TabsTrigger>
                  <TabsTrigger value="water" data-testid={`tab-water-${sublease.id}`}>
                    <Droplets className="w-4 h-4 mr-1" />
                    Rozliczenie wody
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="electricity">
                  {renderMeterTab(["electricity"])}
                </TabsContent>
                <TabsContent value="water">
                  <div className="space-y-6">
                    {renderMeterTab(["cold_water", "hot_water"])}
                  </div>
                </TabsContent>
              </Tabs>

              {reports.length > 0 && (
                <div className="mt-6 pt-4 border-t space-y-3">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Historia rozliczeń
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Okres</TableHead>
                        <TableHead className="text-right">Energia</TableHead>
                        <TableHead className="text-right">Woda zimna</TableHead>
                        <TableHead className="text-right">Woda ciepła</TableHead>
                        <TableHead className="text-right">Razem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => (
                        <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
                          <TableCell className="text-sm">
                            {formatDate(report.periodFrom)} — {formatDate(report.periodTo)}
                          </TableCell>
                          <TableCell className="text-right text-sm" title={
                            report.electricityNetto && Number(report.electricityNetto) > 0
                              ? `Netto: ${formatNum(report.electricityNetto)} zł + VAT ${report.electricityVatRate || 23}% = Brutto: ${formatNum(report.electricityBrutto)} zł`
                              : undefined
                          }>
                            {report.electricityBrutto && Number(report.electricityBrutto) > 0
                              ? `${formatNum(report.electricityBrutto)} zł`
                              : report.electricityCost ? `${formatNum(report.electricityCost)} zł` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {report.coldWaterCost ? `${formatNum(report.coldWaterCost)} zł` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {report.hotWaterCost ? `${formatNum(report.hotWaterCost)} zł` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {report.totalCost ? `${formatNum(report.totalCost)} zł` : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={report.paymentStatus === "OPLACONE" ? "default" : "outline"}
                              data-testid={`button-status-${report.id}`}
                              className={report.paymentStatus === "OPLACONE" ? "bg-green-600 hover:bg-green-600 text-white" : ""}
                              onClick={() => {
                                const newStatus = report.paymentStatus === "NIEOPLACONE" ? "OPLACONE" : "NIEOPLACONE";
                                updateReportStatus.mutate({ id: report.id, status: newStatus });
                              }}
                            >
                              {report.paymentStatus === "OPLACONE" ? (
                                <>
                                  <Check className="w-3 h-3 mr-1" />
                                  OPŁACONE
                                </>
                              ) : (
                                <>
                                  <CircleDollarSign className="w-3 h-3 mr-1" />
                                  NIEOPŁACONE
                                </>
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {(() => {
                                const existingNote = accountingNotes.find(n => n.reportId === report.id);
                                return existingNote ? (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    data-testid={`button-download-note-${report.id}`}
                                    title={`Pobierz notę ${existingNote.noteNumber}`}
                                    onClick={() => downloadNoteById(existingNote.id)}
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                ) : (
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    data-testid={`button-generate-note-${report.id}`}
                                    title="Generuj notę księgową"
                                    disabled={generateNote.isPending}
                                    onClick={() => generateNote.mutate(report.id)}
                                  >
                                    <FileText className="w-3 h-3" />
                                  </Button>
                                );
                              })()}
                              <Button
                                size="icon"
                                variant="ghost"
                                data-testid={`button-edit-report-${report.id}`}
                                onClick={() => setEditReport(report)}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                data-testid={`button-delete-report-${report.id}`}
                                onClick={() => deleteReport.mutate(report.id)}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {accountingNotes.length > 0 && (
                <div className="mt-6 pt-4 border-t space-y-3">
                  <h3 className="font-medium text-sm flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Noty księgowe
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numer</TableHead>
                        <TableHead>Plik</TableHead>
                        <TableHead>Data wygenerowania</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountingNotes.map((note) => (
                        <TableRow key={note.id} data-testid={`row-note-${note.id}`}>
                          <TableCell className="text-sm font-medium">{note.noteNumber}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{note.fileName}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {note.generatedAt ? new Date(note.generatedAt).toLocaleDateString("pl-PL") : ""}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-download-saved-note-${note.id}`}
                              title="Pobierz notę"
                              onClick={() => downloadNoteById(note.id)}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      <PriceHistoryDialog
        open={priceHistoryOpen}
        onOpenChange={setPriceHistoryOpen}
        subleaseId={sublease.id}
        meterType={priceHistoryType}
        prices={prices}
      />

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generuj rozliczenie mediów</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Najemca: <span className="font-medium text-foreground">{tenantName}</span></p>
              <p className="text-sm text-muted-foreground">Mieszkanie: <span className="font-medium text-foreground">{aptName}</span></p>
            </div>
            {(() => {
              const data = getCurrentPeriodData();
              const elecItem = data.items.find(i => i.type === "electricity");
              return (
                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-sm font-medium">Okres rozliczeniowy:</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(data.periodFrom)} — {formatDate(data.periodTo)}
                    </p>
                  </div>

                  {data.useNewCharges && elecItem && elecItem.totalConsumption > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-1"><Zap className="w-4 h-4" /> Energia elektryczna — {formatNum(elecItem.totalConsumption, 3)} kWh</p>
                      {data.elecVariableDetails.length > 0 && (
                        <div className="ml-4">
                          <p className="text-xs text-muted-foreground mb-1">Opłaty zmienne (za kWh):</p>
                          <Table>
                            <TableBody>
                              {data.elecVariableDetails.map((d, i) => (
                                <TableRow key={i} className="text-xs">
                                  <TableCell className="py-1">{d.name}</TableCell>
                                  <TableCell className="py-1 text-right">{formatNum(d.unitPrice, 4)} zł/kWh</TableCell>
                                  <TableCell className="py-1 text-right">{formatNum(d.cost)} zł</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      {data.elecFixedDetails.length > 0 && (
                        <div className="ml-4">
                          <p className="text-xs text-muted-foreground mb-1">Opłaty stałe (za miesiąc):</p>
                          <Table>
                            <TableBody>
                              {data.elecFixedDetails.map((d, i) => (
                                <TableRow key={i} className="text-xs">
                                  <TableCell className="py-1">{d.name}</TableCell>
                                  <TableCell className="py-1 text-right">{formatNum(d.unitPrice, 2)} zł/mc × {d.months}</TableCell>
                                  <TableCell className="py-1 text-right">{formatNum(d.cost)} zł</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                      <div className="ml-4 text-sm space-y-0.5">
                        <div className="flex justify-between"><span>Netto:</span><span>{formatNum(data.elecNetto)} zł</span></div>
                        <div className="flex justify-between"><span>VAT {data.elecVatRate}%:</span><span>{formatNum(data.elecBrutto - data.elecNetto)} zł</span></div>
                        <div className="flex justify-between font-semibold"><span>Brutto:</span><span>{formatNum(data.elecBrutto)} zł</span></div>
                      </div>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medium</TableHead>
                        <TableHead className="text-right">Zużycie</TableHead>
                        <TableHead className="text-right">Koszt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((item) => (
                        <TableRow key={item.type}>
                          <TableCell className="font-medium">{item.label}</TableCell>
                          <TableCell className="text-right">
                            {item.totalConsumption > 0 ? `${formatNum(item.totalConsumption, 3)} ${item.unit}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.totalCost > 0 ? `${formatNum(item.totalCost)} zł` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <span className="font-medium">Razem do zapłaty</span>
                    <span className="text-lg font-bold">{formatNum(data.total)} zł</span>
                  </div>
                  {data.total <= 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Brak odczytów w bieżącym okresie. Dodaj odczyty liczników, aby wygenerować rozliczenie.
                    </p>
                  )}
                </div>
              );
            })()}
          </div>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" data-testid="button-cancel-generate">Anuluj</Button>
            </DialogClose>
            <Button
              data-testid="button-confirm-generate"
              disabled={createReport.isPending || getCurrentPeriodData().total <= 0}
              onClick={() => createReport.mutate()}
            >
              <ClipboardCheck className="w-4 h-4 mr-1" />
              {createReport.isPending ? "Generowanie..." : "Potwierdź i generuj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editReport && (
        <EditReportDialog
          report={editReport}
          open={!!editReport}
          onOpenChange={(open) => { if (!open) setEditReport(null); }}
          onSave={(data) => updateReport.mutate({ id: editReport.id, data })}
          isPending={updateReport.isPending}
        />
      )}

      <ElectricityChargesDialog
        open={chargesDialogOpen}
        onOpenChange={setChargesDialogOpen}
        subleaseId={sublease.id}
      />
    </>
  );
}

interface PendingReadingGroup {
  subleaseId: number;
  apartmentName: string;
  tenantName: string;
  readings: SubleaseMeterReading[];
}

function PendingReadingsSection({ apartments }: { apartments: Apartment[] }) {
  const { toast } = useToast();
  const pendingKey = ["/api/pending-meter-readings"];
  const { data: pendingGroups = [], isLoading } = useQuery<PendingReadingGroup[]>({
    queryKey: pendingKey,
  });

  const confirmReadings = useMutation({
    mutationFn: async (readingIds: number[]) => {
      await apiRequest("POST", "/api/meter-readings/confirm", { readingIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingKey });
      toast({ title: "Odczyty zatwierdzone" });
    },
  });

  const confirmAndSettle = useMutation({
    mutationFn: async ({ subleaseId, readingIds }: { subleaseId: number; readingIds: number[] }) => {
      await apiRequest("POST", "/api/meter-readings/confirm", { readingIds });
      queryClient.invalidateQueries({ queryKey: [`/api/subleases/${subleaseId}/meter-readings`] });
      return subleaseId;
    },
    onSuccess: (subleaseId) => {
      queryClient.invalidateQueries({ queryKey: pendingKey });
      toast({ title: "Odczyty zatwierdzone — otwórz kartę podnajmu poniżej, aby wygenerować rozliczenie" });
      setTimeout(() => {
        const el = document.querySelector(`[data-testid="card-sublease-media-${subleaseId}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    },
  });

  if (isLoading || pendingGroups.length === 0) return null;

  return (
    <Card className="border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/10" data-testid="card-pending-readings">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Odczyty do weryfikacji ({pendingGroups.reduce((s, g) => s + g.readings.length, 0)})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingGroups.map((group) => {
          const readingIds = group.readings.map(r => r.id);
          return (
            <div key={group.subleaseId} className="p-3 bg-background rounded-lg border" data-testid={`pending-group-${group.subleaseId}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium text-sm">{group.apartmentName}</span>
                  <span className="text-muted-foreground text-sm ml-2">— {group.tenantName}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={confirmReadings.isPending || confirmAndSettle.isPending}
                    onClick={() => confirmReadings.mutate(readingIds)}
                    data-testid={`button-confirm-readings-${group.subleaseId}`}
                  >
                    <Check className="w-3 h-3 mr-1" />
                    Zatwierdź odczyty
                  </Button>
                  <Button
                    size="sm"
                    disabled={confirmAndSettle.isPending || confirmReadings.isPending}
                    onClick={() => confirmAndSettle.mutate({ subleaseId: group.subleaseId, readingIds })}
                    data-testid={`button-confirm-settle-${group.subleaseId}`}
                  >
                    <ClipboardCheck className="w-3 h-3 mr-1" />
                    Zatwierdź i rozlicz
                  </Button>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medium</TableHead>
                    <TableHead>Data odczytu</TableHead>
                    <TableHead className="text-right">Wartość</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.readings.map((reading) => (
                    <TableRow key={reading.id} data-testid={`row-pending-reading-${reading.id}`}>
                      <TableCell className="text-sm">
                        {reading.meterType === "electricity" && <><Zap className="w-3 h-3 inline mr-1" />Energia</>}
                        {reading.meterType === "cold_water" && <><Droplets className="w-3 h-3 inline mr-1" />Woda zimna</>}
                        {reading.meterType === "hot_water" && <><Droplets className="w-3 h-3 inline mr-1" />Woda ciepła</>}
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(reading.readingDate)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {reading.reading} {reading.meterType === "electricity" ? "kWh" : "m³"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-amber-600 border-amber-400 text-xs">
                          Oczekuje
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default function MediaSettlement() {
  const { data: subleases = [], isLoading: subleasesLoading } = useQuery<Sublease[]>({
    queryKey: ["/api/subleases"],
  });

  const { data: apartments = [], isLoading: apartmentsLoading } = useQuery<Apartment[]>({
    queryKey: ["/api/apartments"],
  });

  const mediaSubleases = useMemo(
    () => subleases.filter((s) => s.mediaByMeters),
    [subleases]
  );

  const isLoading = subleasesLoading || apartmentsLoading;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader title="Rozliczenie mediów" description="Rozliczenia zużycia mediów w podnajmach." icon={Gauge} actions={
          <Badge variant="secondary" data-testid="badge-count">
            {mediaSubleases.length} {mediaSubleases.length === 1 ? "umowa" : "umów"}
          </Badge>
        } />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : mediaSubleases.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Droplets className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Brak umów podnajmu z włączoną opcją rozliczenia mediów według liczników.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Aby dodać, edytuj umowę podnajmu i zaznacz opcję "Rozliczenie mediów według liczników".
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <PendingReadingsSection apartments={apartments} />
          {mediaSubleases.map((s) => (
            <SubleaseMediaCard key={s.id} sublease={s} apartments={apartments} />
          ))}
        </div>
      )}
    </div>
  );
}
