import { useState, useMemo, useCallback, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Apartment, Location } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Settings, Plus, X, FolderInput, Calculator, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { getHeatMapBg, Sparkline } from "@/components/DataVizHelpers";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

const DEFAULT_CATEGORIES_INDIVIDUAL = [
  "RATA DLA WŁAŚCICIELA",
  "CZYNSZ DO WSPÓLNOTY",
  "ROZLICZENIE ROCZNE",
  "ENERGIA - ENERGA",
];

const DEFAULT_CATEGORIES_GRAND_BALTIC = [
  "RATA DLA WŁAŚCICIELA",
  "GAZ - PGNiG",
  "ENERGIA - ENERGA",
  "WODOCIĄGI",
  "WYWÓZ ŚMIECI - ZGK",
];

const GRAND_BALTIC_LOCATION = "GRAND BALTIC";

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
function categoriesStorageKey() { return `costs-apartments-categories`; }

type CellData = { p: number; r: number };
type DataMap = Record<string, Record<number, CellData>>;
type CategoriesMap = Record<string, string[]>;

function loadData(year: number): DataMap {
  try {
    const raw = localStorage.getItem(storageKey(year));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveData(year: number, data: DataMap) {
  localStorage.setItem(storageKey(year), JSON.stringify(data));
}

function loadCategories(): CategoriesMap {
  try {
    const raw = localStorage.getItem(categoriesStorageKey());
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveCategories(cats: CategoriesMap) {
  localStorage.setItem(categoriesStorageKey(), JSON.stringify(cats));
}

interface CostEntry {
  id: string;
  name: string;
  isGrandBaltic: boolean;
  categories: string[];
  apartmentIds: number[];
}

export default function CostsApartments() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState(() => loadData(year));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [categoriesMap, setCategoriesMap] = useState<CategoriesMap>(() => loadCategories());
  const [editingEntry, setEditingEntry] = useState<CostEntry | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleImportFromExcel = async () => {
    setIsImporting(true);
    try {
      const res = await fetch('/api/costs-apartments/import-data', { credentials: 'include' });
      if (!res.ok) throw new Error('Brak danych');
      const importData = await res.json();
      const { data: yearlyData, categories } = importData;

      let totalEntries = 0;
      for (const [yr, entries] of Object.entries(yearlyData as Record<string, DataMap>)) {
        const existing = loadData(Number(yr));
        const merged = { ...existing, ...entries };
        saveData(Number(yr), merged);
        totalEntries += Object.keys(entries).length;
      }

      if (categories) {
        const existingCats = loadCategories();
        const mergedCats = { ...existingCats, ...categories };
        saveCategories(mergedCats);
        setCategoriesMap(mergedCats);
      }

      setData(loadData(year));
      toast({ title: "Import zakończony", description: `Zaimportowano dane dla ${Object.keys(yearlyData).length} lat (${totalEntries} pozycji)` });
    } catch (err) {
      toast({ title: "Błąd importu", description: "Nie udało się zaimportować danych", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const { data: apartments = [] } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"] });

  const sortedLocations = useMemo(() =>
    [...locations].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [locations]
  );

  const costEntries = useMemo(() => {
    const entries: { location: string; items: CostEntry[] }[] = [];

    for (const loc of sortedLocations) {
      const locApts = apartments.filter(a => a.location === loc.name && a.active !== false);
      if (locApts.length === 0) continue;

      if (loc.name === GRAND_BALTIC_LOCATION) {
        const gbEntry: CostEntry = {
          id: `gb-all`,
          name: GRAND_BALTIC_LOCATION,
          isGrandBaltic: true,
          categories: categoriesMap[`gb-all`] || DEFAULT_CATEGORIES_GRAND_BALTIC,
          apartmentIds: locApts.map(a => a.id),
        };
        entries.push({ location: loc.name, items: [gbEntry] });
      } else {
        const items: CostEntry[] = locApts.map(apt => ({
          id: `apt-${apt.id}`,
          name: apt.name,
          isGrandBaltic: false,
          categories: categoriesMap[`apt-${apt.id}`] || [...DEFAULT_CATEGORIES_INDIVIDUAL],
          apartmentIds: [apt.id],
        }));
        entries.push({ location: loc.name, items });
      }
    }

    const unassigned = apartments.filter(a => a.active !== false && !sortedLocations.some(l => l.name === a.location));
    if (unassigned.length > 0) {
      entries.push({
        location: "Inne",
        items: unassigned.map(apt => ({
          id: `apt-${apt.id}`,
          name: apt.name,
          isGrandBaltic: false,
          categories: categoriesMap[`apt-${apt.id}`] || [...DEFAULT_CATEGORIES_INDIVIDUAL],
          apartmentIds: [apt.id],
        }))
      });
    }

    return entries;
  }, [apartments, sortedLocations, categoriesMap]);

  const getCellKey = (entryId: string, category: string) => `${entryId}__${category}`;

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

  const openCategoryEditor = (entry: CostEntry) => {
    setEditingEntry(entry);
    setEditCategories([...entry.categories]);
    setNewCategory("");
  };

  const saveCategoryEdits = () => {
    if (!editingEntry) return;
    const next = { ...categoriesMap, [editingEntry.id]: editCategories };
    setCategoriesMap(next);
    saveCategories(next);
    setEditingEntry(null);
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (trimmed && !editCategories.includes(trimmed)) {
      setEditCategories([...editCategories, trimmed]);
      setNewCategory("");
    }
  };

  const removeCategory = (idx: number) => {
    setEditCategories(editCategories.filter((_, i) => i !== idx));
  };

  const getEntrySums = (entry: CostEntry, month: number): { p: number; r: number } => {
    let p = 0, r = 0;
    entry.categories.forEach(cat => {
      const key = getCellKey(entry.id, cat);
      const cell = data[key]?.[month];
      if (cell) { p += cell.p; r += cell.r; }
    });
    return { p, r };
  };

  const getEntryYearTotal = (entry: CostEntry): { p: number; r: number } => {
    let p = 0, r = 0;
    for (let m = 0; m < 12; m++) {
      const s = getEntrySums(entry, m);
      p += s.p;
      r += s.r;
    }
    return { p, r };
  };

  const costsHeatMax = useMemo(() => {
    let max = 0;
    costEntries.forEach(group => {
      group.items.forEach(entry => {
        for (let m = 0; m < 12; m++) {
          const s = getEntrySums(entry, m);
          if (s.r > max) max = s.r;
        }
      });
    });
    return max;
  }, [costEntries, data]);

  const getEntrySparklineData = useCallback((entry: CostEntry): number[] => {
    return Array.from({ length: 12 }, (_, m) => getEntrySums(entry, m).r);
  }, [data]);

  const getLocationSums = (items: CostEntry[], month: number): { p: number; r: number } => {
    let p = 0, r = 0;
    items.forEach(entry => {
      const s = getEntrySums(entry, month);
      p += s.p;
      r += s.r;
    });
    return { p, r };
  };

  const getLocationYearTotal = (items: CostEntry[]): { p: number; r: number } => {
    let p = 0, r = 0;
    for (let m = 0; m < 12; m++) {
      const s = getLocationSums(items, m);
      p += s.p;
      r += s.r;
    }
    return { p, r };
  };

  const monthlyCostChart = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      let p = 0, r = 0;
      costEntries.forEach(group => {
        const s = getLocationSums(group.items, m);
        p += s.p;
        r += s.r;
      });
      return { name: MONTHS[m], Prognoza: Math.round(p), Rzeczywiste: Math.round(r) };
    });
  }, [costEntries, data]);

  const [showChart, setShowChart] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader title="Koszty apartamentów" description="Analiza kosztów w podziale na apartamenty." icon={Calculator} />
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleImportFromExcel}
            disabled={isImporting}
            data-testid="button-import-costs"
          >
            <FolderInput className="h-4 w-4 mr-1" />
            {isImporting ? "Importowanie..." : "Import z Excel"}
          </Button>
          <Select value={String(year)} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: currentYear - 2022 + 2 }, (_, i) => 2022 + i).map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={() => setShowChart(!showChart)} data-testid="button-toggle-chart-costs">
          <BarChart3 className="mr-1 h-3 w-3" /> {showChart ? "Ukryj wykres" : "Pokaż wykres"}
        </Button>
      </div>

      {showChart && (
        <Card className="mb-4" data-testid="card-monthly-cost-chart">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm">Prognoza vs Rzeczywiste koszty - podsumowanie miesięczne</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={200}>
              <RechartsBarChart data={monthlyCostChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => [`${value.toLocaleString("pl-PL")} zł`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Prognoza" fill="hsl(var(--chart-1))" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Rzeczywiste" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="rounded-md border border-border bg-card overflow-x-auto" data-testid="table-costs-apartments">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/30">
              <th className="sticky left-0 z-10 bg-muted/30 text-left px-2 py-1 border-r-2 border-b border-border min-w-[220px]"></th>
              {MONTHS.map((m, i) => (
                <th key={i} colSpan={3} className={`px-1 py-1 border-r-2 border-b border-border text-center font-bold text-muted-foreground text-[10px] ${i === currentMonth && year === currentYear ? "bg-primary/10" : ""}`}>{m}</th>
              ))}
              <th colSpan={3} className="px-1 py-1 border-b border-border text-center font-bold text-muted-foreground text-[10px]">RAZEM</th>
            </tr>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 text-left px-2 py-1 border-r-2 border-b border-border min-w-[220px]">Pozycja</th>
              {MONTHS.map((_, i) => (
                <Fragment key={i}>
                  <th className={`px-1 py-1 border-r border-b border-border text-center w-[55px] min-w-[55px] text-[10px] bg-muted/20 dark:bg-muted/10 ${i === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>P</th>
                  <th className={`px-1 py-1 border-r border-b border-border text-center w-[55px] min-w-[55px] ${i === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>R</th>
                  <th className={`px-1 py-1 border-r-2 border-b border-border text-center w-[55px] min-w-[55px] ${i === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>S</th>
                </Fragment>
              ))}
              <th className="px-1 py-1 border-r border-b border-border text-center w-[60px] min-w-[60px] text-[10px] bg-muted/20 dark:bg-muted/10">P</th>
              <th className="px-1 py-1 border-r border-b border-border text-center w-[60px] min-w-[60px]">R</th>
              <th className="px-1 py-1 border-b border-border text-center w-[60px] min-w-[60px]">S</th>
            </tr>
          </thead>
          <tbody>
            {costEntries.map((group) => {
              const isCollapsed = collapsed.has(group.location);
              const locYear = getLocationYearTotal(group.items);
              const locYearS = locYear.p - locYear.r;
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
                      const s = getLocationSums(group.items, mi);
                      const saldo = s.p - s.r;
                      return (
                        <Fragment key={mi}>
                          <td className={`border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10 ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(s.p)}</td>
                          <td className={`border-r border-b border-border px-1 py-1 text-right tabular-nums font-semibold ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(s.r)}</td>
                          <td className={`border-r-2 border-b border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)} ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(saldo)}</td>
                        </Fragment>
                      );
                    })}
                    <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10 font-bold">{formatNum(locYear.p)}</td>
                    <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums font-bold">{formatNum(locYear.r)}</td>
                    <td className={`border-b border-border px-1 py-1 text-right tabular-nums font-bold ${saldoColor(locYearS)}`}>{formatNum(locYearS)}</td>
                  </tr>

                  {!isCollapsed && group.items.map(entry => {
                    const entryYear = getEntryYearTotal(entry);
                    const entryYearS = entryYear.p - entryYear.r;
                    return (
                      <Fragment key={entry.id}>
                        <tr className="bg-muted/20">
                          <td className="sticky left-0 z-10 bg-muted/20 px-2 py-1 border-r-2 border-b border-border font-semibold pl-6">
                            <span className="flex items-center gap-1.5">
                              <span className="flex-1 min-w-0 truncate">{entry.name}</span>
                              <Sparkline data={getEntrySparklineData(entry)} width={50} height={14} color="rgb(239, 68, 68)" />
                              <button
                                onClick={() => openCategoryEditor(entry)}
                                className="opacity-40 hover:opacity-100 transition-opacity"
                                title="Edytuj kategorie kosztów"
                                data-testid={`button-edit-categories-${entry.id}`}
                              >
                                <Settings className="h-3 w-3" />
                              </button>
                            </span>
                          </td>
                          {MONTHS.map((_, mi) => {
                            const s = getEntrySums(entry, mi);
                            const saldo = s.p - s.r;
                            return (
                              <Fragment key={mi}>
                                <td className={`border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10 ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(s.p)}</td>
                                <td className={`border-r border-b border-border px-1 py-1 text-right tabular-nums font-semibold ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""} ${getHeatMapBg(s.r, costsHeatMax, "expense")}`}>{formatNum(s.r)}</td>
                                <td className={`border-r-2 border-b border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)} ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(saldo)}</td>
                              </Fragment>
                            );
                          })}
                          <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10 font-semibold">{formatNum(entryYear.p)}</td>
                          <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums font-semibold">{formatNum(entryYear.r)}</td>
                          <td className={`border-b border-border px-1 py-1 text-right tabular-nums font-semibold ${saldoColor(entryYearS)}`}>{formatNum(entryYearS)}</td>
                        </tr>

                        {entry.categories.map(cat => {
                          const key = getCellKey(entry.id, cat);
                          let catYearP = 0, catYearR = 0;
                          for (let m = 0; m < 12; m++) {
                            const cell = data[key]?.[m];
                            if (cell) { catYearP += cell.p; catYearR += cell.r; }
                          }
                          const catYearS = catYearP - catYearR;
                          return (
                            <tr key={cat}>
                              <td className="sticky left-0 z-10 bg-card px-2 py-0.5 border-r-2 border-b border-border text-muted-foreground pl-10 text-[11px]" data-testid={`label-category-${entry.id}-${cat}`}>
                                {cat}
                              </td>
                              {MONTHS.map((_, mi) => {
                                const cell = data[key]?.[mi] || { p: 0, r: 0 };
                                const saldo = cell.p - cell.r;
                                return (
                                  <Fragment key={mi}>
                                    <td className={`border-r border-b border-border px-0 py-0 bg-muted/10 dark:bg-muted/5 ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>
                                      <input
                                        type="number"
                                        className="w-full h-full px-1 py-0.5 text-right text-[10px] tabular-nums bg-transparent outline-none focus:bg-primary/5"
                                        value={cell.p || ""}
                                        onChange={(e) => handleCellChange(key, mi, "p", e.target.value)}
                                        data-testid={`input-p-${entry.id}-${cat}-${mi}`}
                                      />
                                    </td>
                                    <td className={`border-r border-b border-border px-0 py-0 ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>
                                      <input
                                        type="number"
                                        className="w-full h-full px-1 py-0.5 text-right text-[11px] tabular-nums bg-transparent outline-none focus:bg-primary/5"
                                        value={cell.r || ""}
                                        onChange={(e) => handleCellChange(key, mi, "r", e.target.value)}
                                        data-testid={`input-r-${entry.id}-${cat}-${mi}`}
                                      />
                                    </td>
                                    <td className={`border-r-2 border-b border-border px-1 py-0.5 text-right tabular-nums text-[11px] ${saldoColor(saldo)} ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(saldo)}</td>
                                  </Fragment>
                                );
                              })}
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10">{formatNum(catYearP)}</td>
                              <td className="border-r border-b border-border px-1 py-0.5 text-right tabular-nums font-semibold">{formatNum(catYearR)}</td>
                              <td className={`border-b border-border px-1 py-0.5 text-right tabular-nums ${saldoColor(catYearS)}`}>{formatNum(catYearS)}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}

            {(() => {
              let grandP = 0, grandR = 0;
              costEntries.forEach(group => {
                for (let m = 0; m < 12; m++) {
                  const s = getLocationSums(group.items, m);
                  grandP += s.p;
                  grandR += s.r;
                }
              });
              const grandS = grandP - grandR;
              return (
                <tr className="bg-muted/50 font-bold border-t-2 border-border">
                  <td className="sticky left-0 z-10 bg-muted/50 px-2 py-2 border-r-2 border-border uppercase">SUMA ŁĄCZNA</td>
                  {MONTHS.map((_, mi) => {
                    let mp = 0, mr = 0;
                    costEntries.forEach(group => {
                      const s = getLocationSums(group.items, mi);
                      mp += s.p;
                      mr += s.r;
                    });
                    const ms = mp - mr;
                    return (
                      <Fragment key={mi}>
                        <td className={`border-r border-border px-1 py-2 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10 ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(mp)}</td>
                        <td className={`border-r border-border px-1 py-2 text-right tabular-nums ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(mr)}</td>
                        <td className={`border-r-2 border-border px-1 py-2 text-right tabular-nums ${saldoColor(ms)} ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(ms)}</td>
                      </Fragment>
                    );
                  })}
                  <td className="border-r border-border px-1 py-2 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10">{formatNum(grandP)}</td>
                  <td className="border-r border-border px-1 py-2 text-right tabular-nums">{formatNum(grandR)}</td>
                  <td className={`border-border px-1 py-2 text-right tabular-nums ${saldoColor(grandS)}`}>{formatNum(grandS)}</td>
                </tr>
              );
            })()}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editingEntry} onOpenChange={(open) => { if (!open) setEditingEntry(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Kategorie kosztów — {editingEntry?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editCategories.map((cat, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={cat}
                  onChange={(e) => {
                    const next = [...editCategories];
                    next[idx] = e.target.value;
                    setEditCategories(next);
                  }}
                  className="text-sm"
                  data-testid={`input-edit-category-${idx}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => removeCategory(idx)}
                  data-testid={`button-remove-category-${idx}`}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nowa kategoria..."
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } }}
                className="text-sm"
                data-testid="input-new-category"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={addCategory}
                data-testid="button-add-category"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)} data-testid="button-cancel-categories">Anuluj</Button>
            <Button onClick={saveCategoryEdits} data-testid="button-save-categories">Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
