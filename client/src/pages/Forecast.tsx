import { useState, useMemo, useCallback, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Apartment, Location } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function formatNum(v: number): string {
  if (v === 0) return "";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function saldoColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (v < 0) return "text-red-600 dark:text-red-400 font-semibold";
  return "";
}

function storageKey(year: number) { return `forecast-data-${year}`; }

function loadData(year: number): Record<string, Record<number, { p: number; r: number }>> {
  try {
    const raw = localStorage.getItem(storageKey(year));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveData(year: number, data: Record<string, Record<number, { p: number; r: number }>>) {
  localStorage.setItem(storageKey(year), JSON.stringify(data));
}

export default function Forecast() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(() => loadData(year));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: apartments = [] } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"] });

  const sortedLocations = useMemo(() =>
    [...locations].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [locations]
  );

  const apartmentsByLocation = useMemo(() => {
    const groups: { location: string; apartments: Apartment[] }[] = [];
    for (const loc of sortedLocations) {
      const apts = apartments.filter(a => a.location === loc.name && a.active !== false);
      if (apts.length > 0) groups.push({ location: loc.name, apartments: apts });
    }
    const unassigned = apartments.filter(a => a.active !== false && !sortedLocations.some(l => l.name === a.location));
    if (unassigned.length > 0) groups.push({ location: "Inne", apartments: unassigned });
    return groups;
  }, [apartments, sortedLocations]);

  const handleCellChange = useCallback((aptId: number, month: number, field: "p" | "r", value: string) => {
    setData(prev => {
      const next = { ...prev };
      const key = String(aptId);
      if (!next[key]) next[key] = {};
      if (!next[key][month]) next[key][month] = { p: 0, r: 0 };
      next[key][month] = { ...next[key][month], [field]: parseFloat(value) || 0 };
      saveData(year, next);
      return next;
    });
  }, [year]);

  const toggleLocation = (loc: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(loc)) next.delete(loc);
      else next.add(loc);
      return next;
    });
  };

  const { toast } = useToast();

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/import-forecast");
      return res.json();
    },
    onSuccess: (result: { data: Record<number, Record<number, Record<number, { p: number; r: number }>>>; summary: Record<number, number>; message: string }) => {
      let totalImported = 0;
      for (const [yr, apts] of Object.entries(result.data)) {
        const yearNum = Number(yr);
        const existing = loadData(yearNum);
        const merged = { ...existing };
        for (const [aptId, months] of Object.entries(apts as Record<string, Record<number, { p: number; r: number }>>)) {
          if (!merged[aptId]) merged[aptId] = {};
          for (const [month, val] of Object.entries(months as Record<number, { p: number; r: number }>)) {
            merged[aptId][Number(month)] = val;
            totalImported++;
          }
        }
        saveData(yearNum, merged);
      }
      setData(loadData(year));
      const yearsList = Object.keys(result.summary).sort().join(", ");
      toast({
        title: "Import zakończony",
        description: `Zaimportowano dane prognozy dla lat: ${yearsList} (${totalImported} rekordów)`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Błąd importu",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleYearChange = (y: string) => {
    const newYear = Number(y);
    setYear(newYear);
    setData(loadData(newYear));
  };

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = 2022; y <= currentYear + 1; y++) {
      years.push(y);
    }
    return years;
  }, [currentYear]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-forecast-title">Prognoza</h1>
          <p className="text-muted-foreground text-sm">Prognoza przychodów w podziale na apartamenty i lokalizacje</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => importMutation.mutate()}
            disabled={importMutation.isPending}
            data-testid="button-import-forecast"
          >
            {importMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-1.5">Import z Excel</span>
          </Button>
          <Select value={String(year)} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto" data-testid="table-forecast">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 text-left px-2 py-1 border-r-2 border-b border-border min-w-[200px]">Apartament</th>
              {MONTHS.map((m, i) => (
                <Fragment key={i}>
                  <th className="px-1 py-1 border-r border-b border-border text-center w-[60px] min-w-[60px] text-[10px] bg-muted/20 dark:bg-muted/10">P</th>
                  <th className="px-1 py-1 border-r border-b border-border text-center w-[60px] min-w-[60px]">R</th>
                  <th className="px-1 py-1 border-r-2 border-b border-border text-center w-[60px] min-w-[60px]">S</th>
                </Fragment>
              ))}
              <th className="px-1 py-1 border-r border-b border-border text-center w-[60px] min-w-[60px] text-[10px] bg-muted/20 dark:bg-muted/10">P</th>
              <th className="px-1 py-1 border-r border-b border-border text-center w-[60px] min-w-[60px]">R</th>
              <th className="px-1 py-1 border-b border-border text-center w-[60px] min-w-[60px]">S</th>
            </tr>
            <tr className="bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted/30 text-left px-2 py-1 border-r-2 border-b border-border"></th>
              {MONTHS.map((m, i) => (
                <th key={i} colSpan={3} className="px-1 py-1 border-r-2 border-b border-border text-center font-bold text-muted-foreground text-[10px]">{m}</th>
              ))}
              <th colSpan={3} className="px-1 py-1 border-b border-border text-center font-bold text-muted-foreground text-[10px]">ROZLICZENIE ROCZNE</th>
            </tr>
          </thead>
          <tbody>
            {apartmentsByLocation.map((group) => {
              const isCollapsed = collapsed.has(group.location);
              return (
                <Fragment key={group.location}>
                  <tr className="bg-muted/40">
                    <td
                      className="sticky left-0 z-10 bg-muted/40 px-2 py-1.5 border-r-2 border-b border-border font-bold text-muted-foreground uppercase tracking-wide cursor-pointer"
                      onClick={() => toggleLocation(group.location)}
                      data-testid={`forecast-location-${group.location}`}
                    >
                      <span className="flex items-center gap-1">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {group.location}
                      </span>
                    </td>
                    {MONTHS.map((_, mi) => {
                      let prognoza = 0, rzeczywiste = 0;
                      group.apartments.forEach(apt => {
                        const cell = data[String(apt.id)]?.[mi];
                        if (cell) { prognoza += cell.p; rzeczywiste += cell.r; }
                      });
                      const saldo = prognoza - rzeczywiste;
                      return (
                        <Fragment key={mi}>
                          <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10">{formatNum(prognoza)}</td>
                          <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums font-semibold">{formatNum(rzeczywiste)}</td>
                          <td className={`border-r-2 border-b border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                        </Fragment>
                      );
                    })}
                    {(() => {
                      let tp = 0, tr = 0;
                      group.apartments.forEach(apt => {
                        for (let m = 0; m < 12; m++) {
                          const cell = data[String(apt.id)]?.[m];
                          if (cell) { tp += cell.p; tr += cell.r; }
                        }
                      });
                      const ts = tp - tr;
                      return (
                        <>
                          <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10">{formatNum(tp)}</td>
                          <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums font-semibold">{formatNum(tr)}</td>
                          <td className={`border-b border-border px-1 py-1 text-right tabular-nums ${saldoColor(ts)}`}>{formatNum(ts)}</td>
                        </>
                      );
                    })()}
                  </tr>
                  {!isCollapsed && group.apartments.map(apt => {
                    const key = String(apt.id);
                    return (
                      <tr key={apt.id}>
                        <td className="sticky left-0 z-10 bg-card px-2 py-0.5 border-r-2 border-b border-border pl-6 font-medium">
                          {apt.name}
                        </td>
                        {MONTHS.map((_, mi) => {
                          const cell = data[key]?.[mi] || { p: 0, r: 0 };
                          const saldo = cell.p - cell.r;
                          return (
                            <Fragment key={mi}>
                              <td className="border-r border-b border-border px-0 py-0 bg-muted/20 dark:bg-muted/10">
                                <input
                                  type="number"
                                  className="w-full h-full px-1 py-0.5 text-right text-[10px] tabular-nums bg-transparent outline-none focus:bg-primary/5"
                                  value={cell.p || ""}
                                  onChange={(e) => handleCellChange(apt.id, mi, "p", e.target.value)}
                                  data-testid={`input-forecast-p-${apt.id}-${mi}`}
                                />
                              </td>
                              <td className="border-r border-b border-border px-0 py-0">
                                <input
                                  type="number"
                                  className="w-full h-full px-1 py-0.5 text-right text-[11px] tabular-nums bg-transparent outline-none focus:bg-primary/5"
                                  value={cell.r || ""}
                                  onChange={(e) => handleCellChange(apt.id, mi, "r", e.target.value)}
                                  data-testid={`input-forecast-r-${apt.id}-${mi}`}
                                />
                              </td>
                              <td className={`border-r-2 border-b border-border px-1 py-0.5 text-right tabular-nums text-[11px] ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                            </Fragment>
                          );
                        })}
                        {(() => {
                          let tp = 0, tr2 = 0;
                          for (let m = 0; m < 12; m++) {
                            const cell = data[key]?.[m];
                            if (cell) { tp += cell.p; tr2 += cell.r; }
                          }
                          const ts = tp - tr2;
                          return (
                            <>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10">{formatNum(tp)}</td>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums font-semibold">{formatNum(tr2)}</td>
                              <td className={`border-b border-border px-1 py-0.5 text-right tabular-nums ${saldoColor(ts)}`}>{formatNum(ts)}</td>
                            </>
                          );
                        })()}
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
