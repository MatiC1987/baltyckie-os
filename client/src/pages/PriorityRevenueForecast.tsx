import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Apartment, Location } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TrendingUp, ChevronLeft, ChevronRight, Copy, ArrowRight, Layers, FileSpreadsheet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import * as XLSX from "xlsx";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const MONTHS_FULL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

const LOCATION_COLORS: Record<string, string> = {
  "GRAND BALTIC": "bg-blue-600 dark:bg-blue-700",
  "BULWAR PORTOWY": "bg-emerald-600 dark:bg-emerald-700",
  "WCZASOWA": "bg-purple-600 dark:bg-purple-700",
  "NA WYDMIE": "bg-amber-600 dark:bg-amber-700",
  "PRZEWŁOKA": "bg-rose-600 dark:bg-rose-700",
};

function getLocColor(name: string): string {
  return LOCATION_COLORS[name] || "bg-slate-600 dark:bg-slate-700";
}

function formatNum(v: number): string {
  if (v === 0) return "";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

type RevenueForecast = {
  id: number;
  year: number;
  month: number;
  apartmentId: number | null;
  locationName: string | null;
  forecast: string;
  actual: string;
  rentalType?: string | null;
};

type ForecastCell = { value: number; rentalType: string | null };

function EditableCell({
  value,
  onSave,
  isCurrentMonth,
  isLongTerm,
}: {
  value: number;
  onSave: (v: number) => void;
  isCurrentMonth: boolean;
  isLongTerm: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(value === 0 ? "" : String(value));
    setEditing(true);
  };

  const commit = () => {
    const parsed = parseFloat(draft.replace(",", "."));
    onSave(isNaN(parsed) ? 0 : parsed);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        className="w-full text-right tabular-nums bg-white dark:bg-zinc-900 border border-primary rounded px-1 py-0 text-xs outline-none"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
      />
    );
  }

  const bgClass = isLongTerm
    ? "bg-purple-100/70 dark:bg-purple-950/40"
    : isCurrentMonth
      ? "bg-cyan-50/60 dark:bg-cyan-950/20"
      : "";

  return (
    <div
      className={`text-right tabular-nums cursor-pointer hover:bg-primary/10 rounded px-1 py-0.5 min-h-[1.5rem] text-xs ${bgClass} ${value > 0 ? "" : "text-muted-foreground/30"}`}
      onClick={startEdit}
      data-testid="cell-forecast"
    >
      {isLongTerm && value > 0 ? (
        <span className="flex items-center justify-end gap-0.5">
          <span className="text-[8px] font-bold text-purple-600 dark:text-purple-400">DT</span>
          {formatNum(value)}
        </span>
      ) : (
        value > 0 ? formatNum(value) : "—"
      )}
    </div>
  );
}

const SEASON_PRESETS = [
  { label: "Sezon letni", months: [5, 6, 7, 8] },
  { label: "Poza sezonem", months: [0, 1, 2, 3, 4, 9, 10, 11] },
  { label: "Cały rok", months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

type BulkMode = "SET" | "PERCENT" | "LONG_TERM" | "SHORT_TERM";

export default function PriorityRevenueForecast() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showCopyAptDialog, setShowCopyAptDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [copySourceApt, setCopySourceApt] = useState<string>("");
  const [copyTargetApt, setCopyTargetApt] = useState<string>("");
  const [copySourceYear, setCopySourceYear] = useState<number | null>(null);
  const [copyTargetYear, setCopyTargetYear] = useState<number | null>(null);
  const [isCopying, setIsCopying] = useState(false);
  const { toast } = useToast();

  const [bulkSelectedApts, setBulkSelectedApts] = useState<Set<number>>(new Set());
  const [bulkSelectedMonths, setBulkSelectedMonths] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState<BulkMode>("SET");
  const [bulkValue, setBulkValue] = useState("");
  const [bulkApplying, setBulkApplying] = useState(false);

  const { data: forecasts = [] } = useQuery<RevenueForecast[]>({
    queryKey: [`/api/revenue-forecasts?year=${year}`],
  });

  const { data: apartments = [] } = useQuery<Apartment[]>({
    queryKey: ["/api/apartments"],
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });

  const activeApts = useMemo(() =>
    apartments.filter(a => a.active !== false),
    [apartments]
  );

  const sortedLocations = useMemo(() =>
    [...locations].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [locations]
  );

  const forecastMap = useMemo(() => {
    const m: Record<string, ForecastCell> = {};
    for (const f of forecasts) {
      if (f.apartmentId) {
        m[`${f.apartmentId}__${f.month}`] = {
          value: parseFloat(f.forecast || "0"),
          rentalType: f.rentalType || null,
        };
      }
    }
    return m;
  }, [forecasts]);

  const getVal = useCallback((aptId: number, month: number) => forecastMap[`${aptId}__${month}`]?.value || 0, [forecastMap]);
  const getType = useCallback((aptId: number, month: number) => forecastMap[`${aptId}__${month}`]?.rentalType || null, [forecastMap]);

  const upsertMutation = useMutation({
    mutationFn: (body: { year: number; month: number; apartmentId: number; forecast: string; rentalType?: string | null }) =>
      apiRequest("PUT", "/api/revenue-forecasts", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/revenue-forecasts?year=${year}`] });
    },
    onError: () => {
      toast({ title: "Błąd zapisu", variant: "destructive" });
    },
  });

  const handleCellSave = useCallback((aptId: number, month: number, value: number) => {
    upsertMutation.mutate({
      year,
      month,
      apartmentId: aptId,
      forecast: String(value),
    });
  }, [year, upsertMutation]);

  const copyToNextYear = async () => {
    const srcYear = copySourceYear ?? year;
    const tgtYear = copyTargetYear ?? year + 1;
    if (srcYear === tgtYear) {
      toast({ title: "Błąd", description: "Rok źródłowy i docelowy nie mogą być takie same", variant: "destructive" });
      return;
    }
    setIsCopying(true);
    try {
      let sourceForecasts: RevenueForecast[];
      if (srcYear === year) {
        sourceForecasts = forecasts;
      } else {
        const res = await apiRequest("GET", `/api/revenue-forecasts?year=${srcYear}`);
        sourceForecasts = await res.json();
      }
      const srcMap: Record<string, { val: number; rt: string | null }> = {};
      for (const f of sourceForecasts) {
        if (f.apartmentId) {
          srcMap[`${f.apartmentId}__${f.month}`] = { val: parseFloat(f.forecast || "0"), rt: f.rentalType || null };
        }
      }
      let count = 0;
      let errors = 0;
      for (const apt of activeApts) {
        for (let m = 0; m < 12; m++) {
          const src = srcMap[`${apt.id}__${m}`];
          const val = src?.val || 0;
          if (val > 0) {
            try {
              await apiRequest("PUT", "/api/revenue-forecasts", {
                year: tgtYear,
                month: m,
                apartmentId: apt.id,
                forecast: String(val),
                rentalType: src?.rt || null,
              });
              count++;
            } catch {
              errors++;
            }
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: [`/api/revenue-forecasts?year=${tgtYear}`] });
      if (errors > 0) {
        toast({ title: "Częściowo skopiowano", description: `Skopiowano ${count} wartości, ${errors} błędów`, variant: "destructive" });
      } else if (count === 0) {
        toast({ title: "Brak danych", description: `Nie znaleziono prognoz na rok ${srcYear} do skopiowania`, variant: "destructive" });
      } else {
        toast({ title: "Skopiowano prognozy", description: `Skopiowano ${count} wartości z ${srcYear} na ${tgtYear}` });
      }
      setShowCopyDialog(false);
      setYear(tgtYear);
    } catch (err: any) {
      toast({ title: "Błąd kopiowania", description: err?.message || "Nieznany błąd", variant: "destructive" });
    } finally {
      setIsCopying(false);
    }
  };

  const copyFromApartment = async () => {
    const srcId = Number(copySourceApt);
    const tgtId = Number(copyTargetApt);
    if (!srcId || !tgtId || srcId === tgtId) return;
    for (let m = 0; m < 12; m++) {
      const val = getVal(srcId, m);
      await apiRequest("PUT", "/api/revenue-forecasts", {
        year,
        month: m,
        apartmentId: tgtId,
        forecast: String(val),
        rentalType: getType(srcId, m),
      });
    }
    queryClient.invalidateQueries({ queryKey: [`/api/revenue-forecasts?year=${year}`] });
    const srcApt = activeApts.find(a => a.id === srcId);
    const tgtApt = activeApts.find(a => a.id === tgtId);
    toast({ title: "Skopiowano ceny", description: `Skopiowano 12 miesięcy z ${srcApt?.name} → ${tgtApt?.name}` });
    setShowCopyAptDialog(false);
  };

  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear - 3; y <= currentYear + 5; y++) arr.push(y);
    return arr;
  }, [currentYear]);

  const totalForecast = useMemo(() => {
    let sum = 0;
    for (const apt of activeApts) {
      for (let m = 0; m < 12; m++) sum += getVal(apt.id, m);
    }
    return sum;
  }, [forecastMap, activeApts, getVal]);

  const aptsByLocation = useMemo(() => {
    const map: Record<string, Apartment[]> = {};
    for (const loc of sortedLocations) {
      map[loc.name] = activeApts.filter(a => a.location === loc.name);
    }
    const unassigned = activeApts.filter(a => !sortedLocations.some(l => l.name === a.location));
    if (unassigned.length > 0) map["Inne"] = unassigned;
    return map;
  }, [activeApts, sortedLocations]);

  const bulkApply = async () => {
    if (bulkSelectedApts.size === 0 || bulkSelectedMonths.size === 0) return;
    const numVal = parseFloat(bulkValue.replace(",", "."));
    if (bulkMode !== "SHORT_TERM" && (isNaN(numVal) || (bulkMode === "SET" && numVal < 0) || (bulkMode === "LONG_TERM" && numVal <= 0))) {
      toast({ title: "Błąd", description: "Podaj prawidłową wartość", variant: "destructive" });
      return;
    }
    setBulkApplying(true);
    let count = 0;
    let errors = 0;
    for (const aptId of bulkSelectedApts) {
      for (const month of bulkSelectedMonths) {
        try {
          let forecast: string;
          let rentalType: string | null = getType(aptId, month);
          if (bulkMode === "SET") {
            forecast = String(numVal);
          } else if (bulkMode === "PERCENT") {
            const current = getVal(aptId, month);
            forecast = String(Math.round(current * (1 + numVal / 100)));
          } else if (bulkMode === "LONG_TERM") {
            forecast = String(numVal);
            rentalType = "LONG";
          } else {
            forecast = String(getVal(aptId, month));
            rentalType = null;
          }
          await apiRequest("PUT", "/api/revenue-forecasts", {
            year,
            month,
            apartmentId: aptId,
            forecast,
            rentalType,
          });
          count++;
        } catch {
          errors++;
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: [`/api/revenue-forecasts?year=${year}`] });
    if (errors > 0) {
      toast({ title: "Częściowo zapisano", description: `${count} zaktualizowanych, ${errors} błędów`, variant: "destructive" });
    } else {
      toast({ title: "Zaktualizowano", description: `Zmieniono ${count} komórek` });
    }
    setBulkApplying(false);
    setShowBulkDialog(false);
  };

  const openBulkDialog = () => {
    setBulkSelectedApts(new Set());
    setBulkSelectedMonths(new Set());
    setBulkMode("SET");
    setBulkValue("");
    setShowBulkDialog(true);
  };

  const toggleBulkApt = (id: number) => {
    setBulkSelectedApts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleBulkLocation = (locName: string) => {
    const locApts = aptsByLocation[locName] || [];
    setBulkSelectedApts(prev => {
      const next = new Set(prev);
      const allSelected = locApts.every(a => next.has(a.id));
      for (const a of locApts) {
        if (allSelected) next.delete(a.id); else next.add(a.id);
      }
      return next;
    });
  };

  const toggleBulkMonth = (m: number) => {
    setBulkSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };

  const setBulkMonthPreset = (months: number[]) => {
    setBulkSelectedMonths(new Set(months));
  };

  const toggleAllApts = () => {
    setBulkSelectedApts(prev => {
      if (prev.size === activeApts.length) return new Set();
      return new Set(activeApts.map(a => a.id));
    });
  };

  const exportToExcel = () => {
    const rows: (string | number)[][] = [];
    rows.push(["Lokalizacja", "Apartament", "Typ", ...MONTHS_FULL, "Rok"]);

    for (const [locName, apts] of Object.entries(aptsByLocation)) {
      if (apts.length === 0) continue;
      const locTotal = apts.reduce((s, apt) => {
        for (let m = 0; m < 12; m++) s += getVal(apt.id, m);
        return s;
      }, 0);
      const locMonths = MONTHS.map((_, mi) =>
        apts.reduce((s, apt) => s + getVal(apt.id, mi), 0)
      );
      rows.push([locName, "", "", ...locMonths, locTotal]);

      for (const apt of apts) {
        const aptMonths = MONTHS.map((_, mi) => getVal(apt.id, mi));
        const aptTotal = aptMonths.reduce((s, v) => s + v, 0);
        const longMonths = MONTHS.filter((_, mi) => getType(apt.id, mi) === "LONG").length;
        const typeLabel = longMonths > 6 ? "DT" : longMonths > 0 ? "KT/DT" : "KT";
        rows.push(["", apt.name, typeLabel, ...aptMonths, aptTotal]);
      }
    }

    const totalMonths = MONTHS.map((_, mi) =>
      activeApts.reduce((s, apt) => s + getVal(apt.id, mi), 0)
    );
    rows.push(["RAZEM", "", "", ...totalMonths, totalForecast]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Prognoza ${year}`);

    const colWidths = [{ wch: 18 }, { wch: 22 }, { wch: 6 }];
    for (let i = 0; i < 12; i++) colWidths.push({ wch: 12 });
    colWidths.push({ wch: 14 });
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `prognoza_przychodow_${year}.xlsx`);
    toast({ title: "Eksport zakończony", description: `Plik prognoza_przychodow_${year}.xlsx został pobrany` });
  };

  const bulkCellCount = bulkSelectedApts.size * bulkSelectedMonths.size;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          title="Prognoza Przychodów"
          description="Planowane przychody dla każdego apartamentu w ujęciu miesięcznym"
          icon={TrendingUp}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={year <= years[0]} onClick={() => setYear(y => y - 1)} data-testid="button-prev-year">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]" data-testid="select-year"><SelectValue /></SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-9 w-9" disabled={year >= years[years.length - 1]} onClick={() => setYear(y => y + 1)} data-testid="button-next-year">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={openBulkDialog} data-testid="button-bulk-edit">
            <Layers className="h-4 w-4 mr-1" /> Edycja zbiorcza
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCopyAptDialog(true)} data-testid="button-copy-from-apt">
            <Copy className="h-4 w-4 mr-1" /> Kopiuj z apt.
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setCopySourceYear(year); setCopyTargetYear(year + 1); setShowCopyDialog(true); }} data-testid="button-copy-to-next-year">
            <ArrowRight className="h-4 w-4 mr-1" /> Kopiuj rok → rok
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} data-testid="button-export-excel">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        <Card data-testid="card-total-forecast">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Łączna prognoza {year}</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{totalForecast.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} PLN</p>
            <p className="text-[10px] text-muted-foreground mt-1">Śr. na apt: {activeApts.length > 0 ? Math.round(totalForecast / activeApts.length).toLocaleString("pl-PL") : 0} PLN</p>
          </CardContent>
        </Card>
        {Object.entries(aptsByLocation).map(([locName, apts]) => {
          if (apts.length === 0) return null;
          const locTotal = apts.reduce((s, apt) => {
            for (let m = 0; m < 12; m++) s += getVal(apt.id, m);
            return s;
          }, 0);
          const avgPerApt = apts.length > 0 ? Math.round(locTotal / apts.length) : 0;
          return (
            <Card key={locName} data-testid={`card-location-${locName}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${getLocColor(locName)}`} />
                  <p className="text-xs font-medium truncate">{locName}</p>
                </div>
                <p className="text-lg font-bold mt-1 tabular-nums">{locTotal.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} PLN</p>
                <p className="text-[10px] text-muted-foreground mt-1">Śr. na apt: {avgPerApt.toLocaleString("pl-PL")} PLN</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto table-scroll-container" onScroll={(e) => { const el = e.currentTarget; const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10; if (atEnd) el.classList.add('scrolled-end'); else el.classList.remove('scrolled-end'); }}>
        <table className="w-full text-[10px] sm:text-xs border-collapse" style={{ minWidth: "900px" }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/80 dark:bg-muted/50">
              <th className="sticky left-0 z-30 bg-muted/80 dark:bg-muted/50 border-b border-r border-border px-1.5 sm:px-2 py-2 text-left font-bold min-w-[140px] sm:min-w-[200px]">
                Apartament
              </th>
              {MONTHS.map((m, i) => (
                <th key={i} className={`border-b border-r border-border px-1.5 sm:px-2 py-2 text-center font-bold min-w-[50px] sm:min-w-[70px] ${i === currentMonth && year === currentYear ? "bg-cyan-100/60 dark:bg-cyan-950/30" : ""}`}>
                  {m}
                </th>
              ))}
              <th className="border-b border-border px-1.5 sm:px-2 py-2 text-center font-bold min-w-[60px] sm:min-w-[80px] bg-muted dark:bg-muted/70">
                Rok
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(aptsByLocation).map(([locName, apts]) => {
              if (apts.length === 0) return null;
              const locColor = getLocColor(locName);
              const locTotal = apts.reduce((s, apt) => {
                for (let m = 0; m < 12; m++) s += getVal(apt.id, m);
                return s;
              }, 0);
              const locMonthTotals = MONTHS.map((_, mi) =>
                apts.reduce((s, apt) => s + getVal(apt.id, mi), 0)
              );

              return [
                <tr key={`loc-${locName}`} className={`${locColor} text-white`}>
                  <td className={`sticky left-0 z-20 ${locColor} border-b border-r border-border/30 px-2 py-1.5 font-bold text-[11px] uppercase tracking-wide`}>
                    {locName}
                  </td>
                  {locMonthTotals.map((v, i) => (
                    <td key={i} className={`border-b border-r border-border/30 px-2 py-1.5 text-right tabular-nums font-semibold ${i === currentMonth && year === currentYear ? "bg-white/10" : ""}`}>
                      {formatNum(v)}
                    </td>
                  ))}
                  <td className="border-b border-border/30 px-2 py-1.5 text-right tabular-nums font-bold bg-black/10">
                    {formatNum(locTotal)}
                  </td>
                </tr>,
                ...apts.map(apt => {
                  const aptTotal = MONTHS.reduce((s, _, mi) => s + getVal(apt.id, mi), 0);
                  return (
                    <tr key={`apt-${apt.id}`} className="hover:bg-muted/30 dark:hover:bg-muted/20 border-b border-border/50">
                      <td className="sticky left-0 z-10 bg-background border-r border-border/30 px-2 py-1 font-medium pl-6">
                        {apt.name}
                      </td>
                      {MONTHS.map((_, mi) => {
                        const isLong = getType(apt.id, mi) === "LONG";
                        return (
                          <td key={mi} className={`border-r border-border/20 px-1 py-0.5 ${isLong ? "bg-purple-50/50 dark:bg-purple-950/20" : mi === currentMonth && year === currentYear ? "bg-cyan-50/40 dark:bg-cyan-950/10" : ""}`}>
                            <EditableCell
                              value={getVal(apt.id, mi)}
                              onSave={v => handleCellSave(apt.id, mi, v)}
                              isCurrentMonth={mi === currentMonth && year === currentYear}
                              isLongTerm={isLong}
                            />
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 text-right tabular-nums font-bold text-xs bg-muted/20 dark:bg-muted/10">
                        {formatNum(aptTotal)}
                      </td>
                    </tr>
                  );
                }),
              ];
            })}

            <tr className="border-t-2 border-border font-bold bg-muted/40 dark:bg-muted/20">
              <td className="sticky left-0 z-10 bg-muted/40 dark:bg-muted/20 border-r border-border px-2 py-2 font-bold uppercase text-xs">
                RAZEM
              </td>
              {MONTHS.map((_, mi) => {
                const monthTotal = activeApts.reduce((s, apt) => s + getVal(apt.id, mi), 0);
                return (
                  <td key={mi} className={`border-r border-border/30 px-2 py-2 text-right tabular-nums font-bold ${mi === currentMonth && year === currentYear ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {formatNum(monthTotal)}
                  </td>
                );
              })}
              <td className="px-2 py-2 text-right tabular-nums font-bold bg-muted dark:bg-muted/70">
                {formatNum(totalForecast)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edycja zbiorcza</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Apartamenty</Label>
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAllApts} data-testid="button-bulk-toggle-all">
                  {bulkSelectedApts.size === activeApts.length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
                </Button>
              </div>
              <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1">
                {Object.entries(aptsByLocation).map(([locName, apts]) => {
                  if (apts.length === 0) return null;
                  const allLocSelected = apts.every(a => bulkSelectedApts.has(a.id));
                  return (
                    <div key={locName}>
                      <div
                        className="flex items-center gap-2 py-1 px-1 cursor-pointer hover:bg-muted/50 rounded"
                        onClick={() => toggleBulkLocation(locName)}
                        data-testid={`bulk-loc-${locName}`}
                      >
                        <Checkbox checked={allLocSelected} />
                        <div className={`w-2 h-2 rounded-full ${getLocColor(locName)}`} />
                        <span className="text-xs font-semibold uppercase">{locName}</span>
                      </div>
                      <div className="ml-6 space-y-0.5">
                        {apts.map(apt => (
                          <div
                            key={apt.id}
                            className="flex items-center gap-2 py-0.5 px-1 cursor-pointer hover:bg-muted/30 rounded"
                            onClick={() => toggleBulkApt(apt.id)}
                            data-testid={`bulk-apt-${apt.id}`}
                          >
                            <Checkbox checked={bulkSelectedApts.has(apt.id)} />
                            <span className="text-xs">{apt.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Wybrano: {bulkSelectedApts.size} apartamentów</p>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Miesiące</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {MONTHS.map((m, i) => (
                  <Button
                    key={i}
                    variant={bulkSelectedMonths.has(i) ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => toggleBulkMonth(i)}
                    data-testid={`bulk-month-${i}`}
                  >
                    {m}
                  </Button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SEASON_PRESETS.map(p => (
                  <Button
                    key={p.label}
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] px-2 text-muted-foreground"
                    onClick={() => setBulkMonthPreset(p.months)}
                    data-testid={`bulk-preset-${p.label}`}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Wybrano: {bulkSelectedMonths.size} miesięcy</p>
            </div>

            <div>
              <Label className="text-sm font-semibold mb-2 block">Tryb</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: "SET" as BulkMode, label: "Ustaw wartość (PLN)" },
                  { value: "PERCENT" as BulkMode, label: "Zmień o %" },
                  { value: "LONG_TERM" as BulkMode, label: "Oznacz długoterminowe" },
                  { value: "SHORT_TERM" as BulkMode, label: "Oznacz krótkoterminowe" },
                ]).map(opt => (
                  <Button
                    key={opt.value}
                    variant={bulkMode === opt.value ? "default" : "outline"}
                    size="sm"
                    className={`text-xs ${bulkMode === opt.value && opt.value === "LONG_TERM" ? "bg-purple-600 hover:bg-purple-700 text-white" : ""}`}
                    onClick={() => setBulkMode(opt.value)}
                    data-testid={`bulk-mode-${opt.value}`}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {bulkMode !== "SHORT_TERM" && (
              <div>
                <Label className="text-sm font-semibold mb-1 block">
                  {bulkMode === "SET" ? "Kwota (PLN)" : bulkMode === "PERCENT" ? "Procent zmian (%)" : "Czynsz miesięczny (PLN)"}
                </Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={bulkValue}
                  onChange={e => setBulkValue(e.target.value)}
                  placeholder={bulkMode === "PERCENT" ? "np. 10 lub -5" : "np. 3500"}
                  className="max-w-[200px]"
                  data-testid="input-bulk-value"
                />
                {bulkMode === "PERCENT" && (
                  <p className="text-[10px] text-muted-foreground mt-1">Wartość dodatnia = podwyżka, ujemna = obniżka</p>
                )}
                {bulkMode === "LONG_TERM" && (
                  <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1">Komórki zostaną oznaczone fioletowym tłem jako długoterminowe</p>
                )}
              </div>
            )}

            {bulkCellCount > 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-bulk-count">
                Zostanie zaktualizowanych <strong>{bulkCellCount}</strong> komórek
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)} disabled={bulkApplying} data-testid="button-bulk-cancel">Anuluj</Button>
            <Button
              onClick={bulkApply}
              disabled={bulkApplying || bulkSelectedApts.size === 0 || bulkSelectedMonths.size === 0 || (bulkMode !== "SHORT_TERM" && !bulkValue)}
              data-testid="button-bulk-apply"
            >
              {bulkApplying ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Zapisywanie...</>
              ) : (
                <><Layers className="h-4 w-4 mr-1" /> Zastosuj</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kopiuj prognozy między latami</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium mb-1">Rok źródłowy (skąd)</p>
                <Select value={String(copySourceYear ?? year)} onValueChange={v => setCopySourceYear(Number(v))}>
                  <SelectTrigger data-testid="select-copy-source-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Rok docelowy (dokąd)</p>
                <Select value={String(copyTargetYear ?? year + 1)} onValueChange={v => setCopyTargetYear(Number(v))}>
                  <SelectTrigger data-testid="select-copy-target-year"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Wszystkie prognozy przychodów z roku <strong>{copySourceYear ?? year}</strong> zostaną skopiowane na rok <strong>{copyTargetYear ?? year + 1}</strong>. Istniejące wartości w roku docelowym zostaną nadpisane.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)} disabled={isCopying}>Anuluj</Button>
            <Button onClick={copyToNextYear} disabled={isCopying || (copySourceYear ?? year) === (copyTargetYear ?? year + 1)} data-testid="button-confirm-copy-year">
              {isCopying ? (
                <><span className="animate-spin mr-2">⏳</span> Kopiowanie...</>
              ) : (
                <><ArrowRight className="h-4 w-4 mr-1" /> Kopiuj {copySourceYear ?? year} → {copyTargetYear ?? year + 1}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCopyAptDialog} onOpenChange={setShowCopyAptDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kopiuj ceny z innego apartamentu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium mb-1">Źródło (skąd kopiujesz)</p>
              <Select value={copySourceApt} onValueChange={setCopySourceApt}>
                <SelectTrigger data-testid="select-copy-source"><SelectValue placeholder="Wybierz apartament źródłowy" /></SelectTrigger>
                <SelectContent>
                  {activeApts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs font-medium mb-1">Cel (dokąd kopiujesz)</p>
              <Select value={copyTargetApt} onValueChange={setCopyTargetApt}>
                <SelectTrigger data-testid="select-copy-target"><SelectValue placeholder="Wybierz apartament docelowy" /></SelectTrigger>
                <SelectContent>
                  {activeApts.filter(a => String(a.id) !== copySourceApt).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Skopiuje 12 miesięcy prognozy z wybranego apartamentu źródłowego do docelowego za rok {year}.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyAptDialog(false)}>Anuluj</Button>
            <Button onClick={copyFromApartment} disabled={!copySourceApt || !copyTargetApt} data-testid="button-confirm-copy-apt">
              <Copy className="h-4 w-4 mr-1" /> Kopiuj ceny
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
