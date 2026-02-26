import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Apartment, Location } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ChevronLeft, ChevronRight, Copy, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

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
};

function EditableCell({
  value,
  onSave,
  isCurrentMonth,
}: {
  value: number;
  onSave: (v: number) => void;
  isCurrentMonth: boolean;
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

  return (
    <div
      className={`text-right tabular-nums cursor-pointer hover:bg-primary/10 rounded px-1 py-0.5 min-h-[1.5rem] text-xs ${isCurrentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""} ${value > 0 ? "" : "text-muted-foreground/30"}`}
      onClick={startEdit}
      data-testid={`cell-forecast-${value}`}
    >
      {value > 0 ? formatNum(value) : "—"}
    </div>
  );
}

export default function PriorityRevenueForecast() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showCopyAptDialog, setShowCopyAptDialog] = useState(false);
  const [copySourceApt, setCopySourceApt] = useState<string>("");
  const [copyTargetApt, setCopyTargetApt] = useState<string>("");
  const { toast } = useToast();

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
    const m: Record<string, number> = {};
    for (const f of forecasts) {
      if (f.apartmentId) {
        m[`${f.apartmentId}__${f.month}`] = parseFloat(f.forecast || "0");
      }
    }
    return m;
  }, [forecasts]);

  const upsertMutation = useMutation({
    mutationFn: (body: { year: number; month: number; apartmentId: number; forecast: string }) =>
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
    const nextYear = year + 1;
    let count = 0;
    for (const apt of activeApts) {
      for (let m = 0; m < 12; m++) {
        const val = forecastMap[`${apt.id}__${m}`] || 0;
        if (val > 0) {
          await apiRequest("PUT", "/api/revenue-forecasts", {
            year: nextYear,
            month: m,
            apartmentId: apt.id,
            forecast: String(val),
          });
          count++;
        }
      }
    }
    queryClient.invalidateQueries({ queryKey: [`/api/revenue-forecasts?year=${nextYear}`] });
    toast({ title: "Skopiowano prognozy", description: `Skopiowano ${count} wartości na rok ${nextYear}` });
    setShowCopyDialog(false);
    setYear(nextYear);
  };

  const copyFromApartment = async () => {
    const srcId = Number(copySourceApt);
    const tgtId = Number(copyTargetApt);
    if (!srcId || !tgtId || srcId === tgtId) return;
    let count = 0;
    for (let m = 0; m < 12; m++) {
      const val = forecastMap[`${srcId}__${m}`] || 0;
      await apiRequest("PUT", "/api/revenue-forecasts", {
        year,
        month: m,
        apartmentId: tgtId,
        forecast: String(val),
      });
      count++;
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
      for (let m = 0; m < 12; m++) {
        sum += forecastMap[`${apt.id}__${m}`] || 0;
      }
    }
    return sum;
  }, [forecastMap, activeApts]);

  const aptsByLocation = useMemo(() => {
    const map: Record<string, Apartment[]> = {};
    for (const loc of sortedLocations) {
      map[loc.name] = activeApts.filter(a => a.location === loc.name);
    }
    const unassigned = activeApts.filter(a => !sortedLocations.some(l => l.name === a.location));
    if (unassigned.length > 0) map["Inne"] = unassigned;
    return map;
  }, [activeApts, sortedLocations]);

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
          <Button variant="outline" size="sm" onClick={() => setShowCopyAptDialog(true)} data-testid="button-copy-from-apt">
            <Copy className="h-4 w-4 mr-1" /> Kopiuj z apt.
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCopyDialog(true)} data-testid="button-copy-to-next-year">
            <ArrowRight className="h-4 w-4 mr-1" /> Kopiuj na {year + 1}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="col-span-1">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Łączna prognoza {year}</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{totalForecast.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} PLN</p>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Jak używać</p>
            <p className="text-xs text-muted-foreground mt-1">Kliknij komórkę aby edytować prognozowaną kwotę przychodu. Zatwierdź Enterem lub kliknięciem poza komórkę. Dane są zapisywane automatycznie.</p>
          </CardContent>
        </Card>
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
                for (let m = 0; m < 12; m++) s += forecastMap[`${apt.id}__${m}`] || 0;
                return s;
              }, 0);
              const locMonthTotals = MONTHS.map((_, mi) =>
                apts.reduce((s, apt) => s + (forecastMap[`${apt.id}__${mi}`] || 0), 0)
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
                  const aptTotal = MONTHS.reduce((s, _, mi) => s + (forecastMap[`${apt.id}__${mi}`] || 0), 0);
                  return (
                    <tr key={`apt-${apt.id}`} className="hover:bg-muted/30 dark:hover:bg-muted/20 border-b border-border/50">
                      <td className="sticky left-0 z-10 bg-background border-r border-border/30 px-2 py-1 font-medium pl-6">
                        {apt.name}
                      </td>
                      {MONTHS.map((_, mi) => (
                        <td key={mi} className={`border-r border-border/20 px-1 py-0.5 ${mi === currentMonth && year === currentYear ? "bg-cyan-50/40 dark:bg-cyan-950/10" : ""}`}>
                          <EditableCell
                            value={forecastMap[`${apt.id}__${mi}`] || 0}
                            onSave={v => handleCellSave(apt.id, mi, v)}
                            isCurrentMonth={mi === currentMonth && year === currentYear}
                          />
                        </td>
                      ))}
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
                const monthTotal = activeApts.reduce((s, apt) => s + (forecastMap[`${apt.id}__${mi}`] || 0), 0);
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

      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kopiuj prognozy na rok {year + 1}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Wszystkie wartości prognozowane za rok <strong>{year}</strong> zostaną skopiowane na rok <strong>{year + 1}</strong>. Istniejące prognozy na rok {year + 1} zostaną nadpisane.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyDialog(false)}>Anuluj</Button>
            <Button onClick={copyToNextYear} data-testid="button-confirm-copy-year">
              <ArrowRight className="h-4 w-4 mr-1" /> Kopiuj na {year + 1}
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
