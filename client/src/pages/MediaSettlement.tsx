import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sublease, Apartment, SubleaseMeterReading, SubleaseMeterSetting } from "@shared/schema";
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
import { Zap, Droplets, FileText, Save, ChevronDown, ChevronUp, Check } from "lucide-react";

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

function getMonthsBetween(startDate: string, endDate: string): string[] {
  const months: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (current <= lastMonth) {
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
  return `${names[parseInt(m, 10) - 1]} ${y}`;
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
}: {
  initialValue: string;
  onSave: (val: string) => void;
  placeholder?: string;
  step?: string;
  className?: string;
  testId?: string;
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
        type="number"
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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState<string>("");

  const apt = apartments.find((a) => a.id === sublease.apartmentId);
  const aptName = apt?.name || `Apt #${sublease.apartmentId}`;
  const tenantName = sublease.tenantType === "firma"
    ? sublease.companyName || ""
    : `${sublease.firstName || ""} ${sublease.lastName || ""}`.trim();

  const months = useMemo(
    () => getMonthsBetween(sublease.startDate, sublease.endDate),
    [sublease.startDate, sublease.endDate]
  );

  const readingsKey = [`/api/subleases/${sublease.id}/meter-readings`];
  const settingsKey = [`/api/subleases/${sublease.id}/meter-settings`];

  const { data: readings = [], isLoading: readingsLoading } = useQuery<SubleaseMeterReading[]>({
    queryKey: readingsKey,
  });

  const { data: settings = [], isLoading: settingsLoading } = useQuery<SubleaseMeterSetting[]>({
    queryKey: settingsKey,
  });

  const saveSetting = useMutation({
    mutationFn: async (data: { meterType: string; unitPrice?: string; initialReading?: string }) => {
      await apiRequest("POST", `/api/subleases/${sublease.id}/meter-settings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsKey });
      toast({ title: "Zapisano ustawienia" });
    },
  });

  const saveReading = useMutation({
    mutationFn: async (data: { meterType: string; yearMonth: string; reading: string }) => {
      await apiRequest("POST", `/api/subleases/${sublease.id}/meter-readings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: readingsKey });
      toast({ title: "Zapisano odczyt" });
    },
  });

  const getSetting = useCallback(
    (type: MeterType) => settings.find((s) => s.meterType === type),
    [settings]
  );

  const getReading = useCallback(
    (type: MeterType, ym: string) => readings.find((r) => r.meterType === type && r.yearMonth === ym),
    [readings]
  );

  const computeConsumption = useCallback(
    (type: MeterType, monthIndex: number) => {
      const setting = getSetting(type);
      const initialReading = parseFloat(setting?.initialReading || "0") || 0;
      const ym = months[monthIndex];
      const currentReading = getReading(type, ym);
      if (!currentReading?.reading) return null;
      const currentVal = parseFloat(currentReading.reading) || 0;
      if (monthIndex === 0) {
        return currentVal - initialReading;
      }
      const prevYm = months[monthIndex - 1];
      const prevReading = getReading(type, prevYm);
      if (!prevReading?.reading) {
        return currentVal - initialReading;
      }
      return currentVal - (parseFloat(prevReading.reading) || 0);
    },
    [getSetting, getReading, months]
  );

  const computeCost = useCallback(
    (type: MeterType, monthIndex: number) => {
      const consumption = computeConsumption(type, monthIndex);
      if (consumption === null) return null;
      const setting = getSetting(type);
      const price = parseFloat(setting?.unitPrice || "0") || 0;
      return consumption * price;
    },
    [computeConsumption, getSetting]
  );

  const getMonthlySummary = useCallback(
    (ym: string) => {
      const mi = months.indexOf(ym);
      if (mi < 0) return null;
      const types: MeterType[] = ["electricity", "cold_water", "hot_water"];
      let total = 0;
      const items = types.map((type) => {
        const cost = computeCost(type, mi);
        const consumption = computeConsumption(type, mi);
        if (cost !== null) total += cost;
        return {
          type,
          label: METER_TYPES[type].label,
          unit: METER_TYPES[type].unit,
          consumption,
          unitPrice: parseFloat(getSetting(type)?.unitPrice || "0") || 0,
          cost,
        };
      });
      return { items, total };
    },
    [months, computeCost, computeConsumption, getSetting]
  );

  const renderMeterTab = (types: MeterType[]) => {
    return types.map((type) => {
      const setting = getSetting(type);
      const info = METER_TYPES[type];
      return (
        <div key={type} className="space-y-3">
          {types.length > 1 && (
            <h4 className="font-medium text-sm flex items-center gap-2">
              <info.icon className="w-4 h-4" />
              {info.label}
            </h4>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">
                Cena jednostkowa ({info.unit === "kWh" ? "zł/kWh" : `zł/${info.unit}`})
              </Label>
              <InlineEditInput
                key={`price-${type}-${setting?.id ?? "new"}`}
                testId={`input-unit-price-${type}-${sublease.id}`}
                initialValue={setting?.unitPrice || ""}
                step="0.01"
                placeholder="0.00"
                onSave={(val) => {
                  saveSetting.mutate({ meterType: type, unitPrice: val, initialReading: setting?.initialReading || "0" });
                }}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stan początkowy ({formatDate(sublease.startDate)})</Label>
              <InlineEditInput
                key={`init-${type}-${setting?.id ?? "new"}`}
                testId={`input-initial-reading-${type}-${sublease.id}`}
                initialValue={setting?.initialReading || ""}
                step="0.001"
                placeholder="0.000"
                onSave={(val) => {
                  saveSetting.mutate({ meterType: type, initialReading: val, unitPrice: setting?.unitPrice || "0" });
                }}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[80px]">Miesiąc</TableHead>
                  <TableHead className="min-w-[120px]">Stan licznika</TableHead>
                  <TableHead className="min-w-[100px]">Zużycie ({info.unit})</TableHead>
                  <TableHead className="min-w-[100px]">Koszt (PLN)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((ym, mi) => {
                  const reading = getReading(type, ym);
                  const consumption = computeConsumption(type, mi);
                  const cost = computeCost(type, mi);
                  return (
                    <TableRow key={ym}>
                      <TableCell className="font-medium text-sm">{monthLabel(ym)}</TableCell>
                      <TableCell>
                        <InlineEditInput
                          key={`${type}-${ym}-${reading?.id ?? "new"}`}
                          testId={`input-reading-${type}-${ym}-${sublease.id}`}
                          initialValue={reading?.reading || ""}
                          step="0.001"
                          placeholder="—"
                          className="w-28"
                          onSave={(val) => {
                            saveReading.mutate({ meterType: type, yearMonth: ym, reading: val });
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-sm">
                        {consumption !== null ? formatNum(consumption, 3) : "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {cost !== null ? `${formatNum(cost)} zł` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      );
    });
  };

  const isLoading = readingsLoading || settingsLoading;

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
              data-testid={`button-summary-${sublease.id}`}
              onClick={(e) => {
                e.stopPropagation();
                const now = new Date();
                const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                setSummaryMonth(months.includes(currentYm) ? currentYm : months[months.length - 1] || "");
                setSummaryOpen(true);
              }}
            >
              <FileText className="w-4 h-4 mr-1" />
              Podsumowanie
            </Button>
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
            )}
          </CardContent>
        )}
      </Card>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Podsumowanie kosztów mediów</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Najemca: <span className="font-medium text-foreground">{tenantName}</span></p>
              <p className="text-sm text-muted-foreground">Mieszkanie: <span className="font-medium text-foreground">{aptName}</span></p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Miesiąc rozliczeniowy</Label>
              <select
                className="w-full border rounded-md p-2 mt-1 bg-background"
                data-testid="select-summary-month"
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(e.target.value)}
              >
                {months.map((ym) => (
                  <option key={ym} value={ym}>{monthLabel(ym)}</option>
                ))}
              </select>
            </div>
            {summaryMonth && (() => {
              const summary = getMonthlySummary(summaryMonth);
              if (!summary) return null;
              return (
                <div className="space-y-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medium</TableHead>
                        <TableHead className="text-right">Zużycie</TableHead>
                        <TableHead className="text-right">Cena jedn.</TableHead>
                        <TableHead className="text-right">Koszt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.items.map((item) => (
                        <TableRow key={item.type}>
                          <TableCell className="font-medium">{item.label}</TableCell>
                          <TableCell className="text-right">
                            {item.consumption !== null ? `${formatNum(item.consumption, 3)} ${item.unit}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {item.unitPrice > 0 ? `${formatNum(item.unitPrice, 4)} zł` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {item.cost !== null ? `${formatNum(item.cost)} zł` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <span className="font-medium">Razem</span>
                    <span className="text-lg font-bold">{formatNum(summary.total)} zł</span>
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" data-testid="button-close-summary">Zamknij</Button>
            </DialogClose>
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
