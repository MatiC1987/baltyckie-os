import { useState, useMemo, useCallback, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Apartment, Location, OwnerPayment } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";

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

function storageKey(year: number) { return `costs-apartments-data-${year}`; }

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

export default function CostsApartments() {
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

  const apartmentIds = useMemo(() => apartments.map(a => a.id), [apartments]);
  const allPaymentsQueries = useQuery<OwnerPayment[]>({
    queryKey: ["/api/owner-payments/all", apartmentIds],
    queryFn: async () => {
      const results = await Promise.all(
        apartmentIds.map(async (id) => {
          const res = await fetch(`/api/apartments/${id}/payments`, { credentials: "include" });
          if (!res.ok) return [];
          return res.json();
        })
      );
      return results.flat();
    },
    enabled: apartmentIds.length > 0,
  });

  const paymentsByApartment = useMemo(() => {
    const map: Record<number, OwnerPayment[]> = {};
    for (const p of (allPaymentsQueries.data || [])) {
      if (!map[p.apartmentId]) map[p.apartmentId] = [];
      map[p.apartmentId].push(p);
    }
    return map;
  }, [allPaymentsQueries.data]);

  const categoriesForApartment = useCallback((aptId: number): string[] => {
    const payments = paymentsByApartment[aptId] || [];
    const cats = new Set<string>();
    payments.forEach(p => cats.add(p.category));
    return [...cats].sort();
  }, [paymentsByApartment]);

  const getCellKey = (aptId: number, category: string) => `${aptId}-${category}`;

  const handleCellChange = useCallback((key: string, month: number, field: "p" | "r", value: string) => {
    setData(prev => {
      const next = { ...prev };
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

  const handleYearChange = (y: string) => {
    const newYear = Number(y);
    setYear(newYear);
    setData(loadData(newYear));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-costs-apartments-title">Koszty (Apartamenty)</h1>
          <p className="text-muted-foreground text-sm">Zestawienie kosztów w podziale na apartamenty i lokalizacje</p>
        </div>
        <Select value={String(year)} onValueChange={handleYearChange}>
          <SelectTrigger className="w-[100px]" data-testid="select-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border border-border bg-card overflow-x-auto" data-testid="table-costs-apartments">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 text-left px-2 py-1 border-r-2 border-b border-border min-w-[200px]">Pozycja</th>
              {MONTHS.map((m, i) => (
                <Fragment key={i}>
                  <th className="px-1 py-1 border-r border-b border-border text-center w-[60px] min-w-[60px] text-[10px] bg-muted/20 dark:bg-muted/10">P</th>
                  <th className="px-1 py-1 border-r border-b border-border text-center w-[60px] min-w-[60px]">R</th>
                  <th className="px-1 py-1 border-r-2 border-b border-border text-center w-[60px] min-w-[60px]">S</th>
                </Fragment>
              ))}
              <th className="sticky right-0 z-10 bg-muted/50 px-1 py-1 border-r border-b border-border text-center w-[60px] min-w-[60px] text-[10px]">P</th>
              <th className="sticky right-0 z-10 bg-muted/50 px-1 py-1 border-r border-b border-border text-center w-[60px] min-w-[60px]" style={{ right: 120 }}>R</th>
              <th className="sticky right-0 z-10 bg-muted/50 px-1 py-1 border-b border-border text-center w-[60px] min-w-[60px]" style={{ right: 60 }}>S</th>
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
                      data-testid={`location-header-${group.location}`}
                    >
                      <span className="flex items-center gap-1">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {group.location}
                      </span>
                    </td>
                    {MONTHS.map((_, mi) => {
                      let prognoza = 0, rzeczywiste = 0;
                      group.apartments.forEach(apt => {
                        const cats = categoriesForApartment(apt.id);
                        cats.forEach(cat => {
                          const key = getCellKey(apt.id, cat);
                          const cell = data[key]?.[mi];
                          if (cell) { prognoza += cell.p; rzeczywiste += cell.r; }
                        });
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
                        const cats = categoriesForApartment(apt.id);
                        cats.forEach(cat => {
                          const key = getCellKey(apt.id, cat);
                          for (let m = 0; m < 12; m++) {
                            const cell = data[key]?.[m];
                            if (cell) { tp += cell.p; tr += cell.r; }
                          }
                        });
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
                    const cats = categoriesForApartment(apt.id);
                    return (
                      <Fragment key={apt.id}>
                        <tr className="bg-muted/20">
                          <td className="sticky left-0 z-10 bg-muted/20 px-2 py-1 border-r-2 border-b border-border font-semibold pl-6">
                            {apt.name}
                          </td>
                          {MONTHS.map((_, mi) => {
                            let prognoza = 0, rzeczywiste = 0;
                            cats.forEach(cat => {
                              const key = getCellKey(apt.id, cat);
                              const cell = data[key]?.[mi];
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
                            let tp = 0, tr2 = 0;
                            cats.forEach(cat => {
                              const key = getCellKey(apt.id, cat);
                              for (let m = 0; m < 12; m++) {
                                const cell = data[key]?.[m];
                                if (cell) { tp += cell.p; tr2 += cell.r; }
                              }
                            });
                            const ts = tp - tr2;
                            return (
                              <>
                                <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10">{formatNum(tp)}</td>
                                <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums font-semibold">{formatNum(tr2)}</td>
                                <td className={`border-b border-border px-1 py-1 text-right tabular-nums ${saldoColor(ts)}`}>{formatNum(ts)}</td>
                              </>
                            );
                          })()}
                        </tr>
                        {cats.map(cat => {
                          const key = getCellKey(apt.id, cat);
                          return (
                            <tr key={cat}>
                              <td className="sticky left-0 z-10 bg-card px-2 py-0.5 border-r-2 border-b border-border text-muted-foreground pl-10 text-[11px]">
                                {cat}
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
                                        onChange={(e) => handleCellChange(key, mi, "p", e.target.value)}
                                        data-testid={`input-p-${apt.id}-${cat}-${mi}`}
                                      />
                                    </td>
                                    <td className="border-r border-b border-border px-0 py-0">
                                      <input
                                        type="number"
                                        className="w-full h-full px-1 py-0.5 text-right text-[11px] tabular-nums bg-transparent outline-none focus:bg-primary/5"
                                        value={cell.r || ""}
                                        onChange={(e) => handleCellChange(key, mi, "r", e.target.value)}
                                        data-testid={`input-r-${apt.id}-${cat}-${mi}`}
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
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
