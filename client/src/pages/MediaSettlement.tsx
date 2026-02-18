import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sublease, Apartment, SubleaseMeterReading, SubleaseMeterSetting, SubleaseMeterPrice, MediaSettlementReport } from "@shared/schema";
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
import { Zap, Droplets, FileText, ChevronDown, ChevronUp, Check, Plus, Trash2, History, ClipboardCheck, CircleDollarSign } from "lucide-react";

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

  const apt = apartments.find((a) => a.id === sublease.apartmentId);
  const aptName = apt?.name || `Apt #${sublease.apartmentId}`;
  const tenantName = sublease.tenantType === "firma"
    ? sublease.companyName || ""
    : `${sublease.firstName || ""} ${sublease.lastName || ""}`.trim();

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

  const getCurrentPeriodData = useCallback(() => {
    const types: MeterType[] = ["electricity", "cold_water", "hot_water"];
    let total = 0;
    const periodFrom = currentPeriodFrom;
    const periodTo = currentPeriodTo;

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
        const unitPrice = getPriceAtDate(type, curr.date);
        periodConsumption += consumption;
        periodCost += consumption * unitPrice;
        prevValue = curr.value;
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
    return { items, total, periodFrom, periodTo };
  }, [getReadingsForType, getSetting, getPriceAtDate, currentPeriodFrom, currentPeriodTo, sublease.startDate]);

  const createReport = useMutation({
    mutationFn: async () => {
      const data = getCurrentPeriodData();
      const elec = data.items.find(i => i.type === "electricity");
      const cold = data.items.find(i => i.type === "cold_water");
      const hot = data.items.find(i => i.type === "hot_water");
      await apiRequest("POST", `/api/subleases/${sublease.id}/settlement-reports`, {
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
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportsKey });
      setGenerateOpen(false);
      toast({ title: "Wygenerowano raport rozliczeniowy" });
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

  const deleteReport = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/settlement-reports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportsKey });
      toast({ title: "Usunięto raport" });
    },
  });

  const renderMeterTab = (types: MeterType[]) => {
    return types.map((type) => {
      const setting = getSetting(type);
      const info = METER_TYPES[type];
      const typeReadings = getReadingsForType(type);
      const initialDate = setting?.initialDate || sublease.startDate;

      const typePrices = prices.filter((p) => p.meterType === type);
      const hasHistoricalPrices = typePrices.length > 0;

      return (
        <div key={type} className="space-y-3">
          {types.length > 1 && (
            <h4 className="font-medium text-sm flex items-center gap-2">
              <info.icon className="w-4 h-4" />
              {info.label}
            </h4>
          )}
          <div className="grid grid-cols-3 gap-3">
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
                  <TableHead className="min-w-[100px]">Cena jedn.</TableHead>
                  <TableHead className="min-w-[100px]">Koszt (PLN)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {typeReadings.map((reading, ri) => {
                  const row = computeRow(type, ri);
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
                      <TableCell className="text-sm text-muted-foreground">
                        {row.unitPrice > 0 ? `${formatNum(row.unitPrice, 4)} zł` : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {row.cost !== null ? `${formatNum(row.cost)} zł` : "—"}
                      </TableCell>
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
                {reports.filter(r => r.paymentStatus === "NIEOPLACONE").length} nieop\u0142acone
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
                    Historia rozlicze\u0144
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Okres</TableHead>
                        <TableHead className="text-right">Energia</TableHead>
                        <TableHead className="text-right">Woda zimna</TableHead>
                        <TableHead className="text-right">Woda ciep\u0142a</TableHead>
                        <TableHead className="text-right">Razem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reports.map((report) => (
                        <TableRow key={report.id} data-testid={`row-report-${report.id}`}>
                          <TableCell className="text-sm">
                            {formatDate(report.periodFrom)} — {formatDate(report.periodTo)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {report.electricityCost ? `${formatNum(report.electricityCost)} z\u0142` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {report.coldWaterCost ? `${formatNum(report.coldWaterCost)} z\u0142` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {report.hotWaterCost ? `${formatNum(report.hotWaterCost)} z\u0142` : "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            {report.totalCost ? `${formatNum(report.totalCost)} z\u0142` : "—"}
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
                                  OP\u0141ACONE
                                </>
                              ) : (
                                <>
                                  <CircleDollarSign className="w-3 h-3 mr-1" />
                                  NIEOP\u0141ACONE
                                </>
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-delete-report-${report.id}`}
                              onClick={() => deleteReport.mutate(report.id)}
                            >
                              <Trash2 className="w-3 h-3 text-destructive" />
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
            <DialogTitle>Generuj rozliczenie medi\u00f3w</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Najemca: <span className="font-medium text-foreground">{tenantName}</span></p>
              <p className="text-sm text-muted-foreground">Mieszkanie: <span className="font-medium text-foreground">{aptName}</span></p>
            </div>
            {(() => {
              const data = getCurrentPeriodData();
              return (
                <div className="space-y-3">
                  <div className="p-3 bg-muted/50 rounded-md">
                    <p className="text-sm font-medium">Okres rozliczeniowy:</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(data.periodFrom)} — {formatDate(data.periodTo)}
                    </p>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medium</TableHead>
                        <TableHead className="text-right">{`Zu\u017cycie`}</TableHead>
                        <TableHead className="text-right">Koszt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.items.map((item) => (
                        <TableRow key={item.type}>
                          <TableCell className="font-medium">{item.label}</TableCell>
                          <TableCell className="text-right">
                            {item.totalConsumption > 0 ? `${formatNum(item.totalConsumption, 3)} ${item.unit}` : "\u2014"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.totalCost > 0 ? `${formatNum(item.totalCost)} z\u0142` : "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <span className="font-medium">Razem do zap\u0142aty</span>
                    <span className="text-lg font-bold">{formatNum(data.total)} z\u0142</span>
                  </div>
                  {data.total <= 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Brak odczyt\u00f3w w bie\u017c\u0105cym okresie. Dodaj odczyty licznik\u00f3w, aby wygenerowa\u0107 rozliczenie.
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
              {createReport.isPending ? "Generowanie..." : "Potwierd\u017a i generuj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Rozliczenie mediów</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Umowy podnajmu z rozliczeniem mediów według liczników
          </p>
        </div>
        <Badge variant="secondary" data-testid="badge-count">
          {mediaSubleases.length} {mediaSubleases.length === 1 ? "umowa" : "umów"}
        </Badge>
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
          {mediaSubleases.map((s) => (
            <SubleaseMediaCard key={s.id} sublease={s} apartments={apartments} />
          ))}
        </div>
      )}
    </div>
  );
}
