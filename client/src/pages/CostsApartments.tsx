import { useState, useMemo, useCallback, useEffect, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Apartment, Location } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Settings, Plus, X, FolderInput, FileDown, Calculator, BarChart3, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { getHeatMapBg, Sparkline } from "@/components/DataVizHelpers";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { FullscreenWrapper, useFullscreen, FullscreenToggleButton } from "@/components/FullscreenWrapper";

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

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "—";
  const change = ((current - previous) / previous) * 100;
  return (change >= 0 ? "+" : "") + change.toFixed(0) + "%";
}

function costChangeColor(current: number, previous: number): string {
  if (previous === 0) return "text-muted-foreground";
  if (current < previous) return "text-emerald-600 dark:text-emerald-400";
  if (current > previous) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
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

type ContractCostItem = { name: string; monthlyAmount: number; contractId: number };
type ContractCostData = Record<string, { apartmentId: number; apartmentName: string; location: string; items: ContractCostItem[] }>;
type ConflictEntry = { entryId: string; category: string; existingValue: number; contractValue: number; contractName: string };

export function CostsApartmentsContent({ embedded = false, externalYear }: { embedded?: boolean; externalYear?: number }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(externalYear ?? currentYear);
  const [data, setData] = useState(() => loadData(externalYear ?? currentYear));
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [categoriesMap, setCategoriesMap] = useState<CategoriesMap>(() => loadCategories());
  const [editingEntry, setEditingEntry] = useState<CostEntry | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingContracts, setIsImportingContracts] = useState(false);
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [conflicts, setConflicts] = useState<ConflictEntry[]>([]);
  const [pendingContractData, setPendingContractData] = useState<{ entries: { key: string; month: number; value: number }[] } | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, "existing" | "contract">>({});
  const { toast } = useToast();

  useEffect(() => {
    if (externalYear !== undefined && externalYear !== year) {
      setYear(externalYear);
      setData(loadData(externalYear));
      if (compareYear === externalYear) {
        setCompareYear(null);
      }
    }
  }, [externalYear]);

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

  const handleImportFromContracts = async () => {
    setIsImportingContracts(true);
    try {
      const res = await fetch(`/api/apartment-contract-costs?year=${year}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Brak danych');
      const contractData: ContractCostData = await res.json();

      if (Object.keys(contractData).length === 0) {
        toast({ title: "Brak danych", description: "Nie znaleziono aktywnych umów z właścicielami na ten rok" });
        setIsImportingContracts(false);
        return;
      }

      const freshData = loadData(year);
      const newCats = { ...categoriesMap };
      const entriesToApply: { key: string; month: number; value: number }[] = [];
      const foundConflicts: ConflictEntry[] = [];
      const seenConflictKeys = new Set<string>();

      for (const [entryId, contractEntry] of Object.entries(contractData)) {
        const existingCats = newCats[entryId] || (entryId === "gb-all" ? [...DEFAULT_CATEGORIES_GRAND_BALTIC] : [...DEFAULT_CATEGORIES_INDIVIDUAL]);
        const updatedCats = [...existingCats];

        for (const item of contractEntry.items) {
          if (!updatedCats.includes(item.name)) {
            updatedCats.push(item.name);
          }
          const key = `${entryId}__${item.name}`;
          const conflictKey = `${entryId}||${item.name}`;
          let hasConflict = false;
          let conflictExistingValue = 0;

          for (let m = 0; m < 12; m++) {
            const existingCell = freshData[key]?.[m];
            const existingP = existingCell?.p || 0;

            if (existingP > 0 && existingP !== item.monthlyAmount) {
              hasConflict = true;
              conflictExistingValue = existingP;
            }
          }

          if (hasConflict && !seenConflictKeys.has(conflictKey)) {
            seenConflictKeys.add(conflictKey);
            foundConflicts.push({
              entryId,
              category: item.name,
              existingValue: conflictExistingValue,
              contractValue: item.monthlyAmount,
              contractName: contractEntry.apartmentName,
            });
          } else if (!hasConflict) {
            for (let m = 0; m < 12; m++) {
              entriesToApply.push({ key, month: m, value: item.monthlyAmount });
            }
          }
        }

        newCats[entryId] = updatedCats;
      }

      if (foundConflicts.length > 0) {
        setConflicts(foundConflicts);
        setPendingContractData({ entries: entriesToApply });
        setCategoriesMap(newCats);
        saveCategories(newCats);
        const defaultResolutions: Record<string, "existing" | "contract"> = {};
        foundConflicts.forEach(c => { defaultResolutions[`${c.entryId}||${c.category}`] = "contract"; });
        setConflictResolutions(defaultResolutions);
      } else {
        setCategoriesMap(newCats);
        saveCategories(newCats);
        applyContractEntries(entriesToApply);
        toast({ title: "Import zakończony", description: `Zaimportowano koszty z ${Object.keys(contractData).length} pozycji umów` });
      }
    } catch (err) {
      toast({ title: "Błąd importu", description: "Nie udało się zaimportować danych z umów", variant: "destructive" });
    } finally {
      setIsImportingContracts(false);
    }
  };

  const applyContractEntries = (entries: { key: string; month: number; value: number }[]) => {
    const freshData = loadData(year);
    const next = { ...freshData };
    for (const e of entries) {
      if (!next[e.key]) next[e.key] = {};
      if (!next[e.key][e.month]) next[e.key][e.month] = { p: 0, r: 0 };
      next[e.key][e.month] = { ...next[e.key][e.month], p: e.value };
    }
    saveData(year, next);
    setData(next);
  };

  const resolveConflicts = () => {
    const allEntries = [...(pendingContractData?.entries || [])];

    conflicts.forEach(c => {
      const resKey = `${c.entryId}||${c.category}`;
      const resolution = conflictResolutions[resKey] || "contract";
      if (resolution === "contract") {
        const key = `${c.entryId}__${c.category}`;
        for (let m = 0; m < 12; m++) {
          allEntries.push({ key, month: m, value: c.contractValue });
        }
      }
    });

    applyContractEntries(allEntries);
    setConflicts([]);
    setPendingContractData(null);
    toast({ title: "Import zakończony", description: "Koszty z umów zostały zaimportowane" });
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

  const compareData = useMemo(() => compareYear !== null ? loadData(compareYear) : {}, [compareYear]);

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
  const fullscreen = useFullscreen();

  return (
    <div className={embedded ? "space-y-4" : "p-6 space-y-4"}>
      {!embedded && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <PageHeader title="Koszty apartamentów" description="Analiza kosztów w podziale na apartamenty." icon={Calculator} />
          <div className="flex items-center gap-2 flex-wrap">
            <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
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
            <Select value={compareYear !== null ? String(compareYear) : "none"} onValueChange={(v) => setCompareYear(v === "none" ? null : Number(v))}>
              <SelectTrigger className="w-[140px]" data-testid="select-compare-year">
                <SelectValue placeholder="Porównaj z..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Brak —</SelectItem>
                {Array.from({ length: currentYear - 2022 + 2 }, (_, i) => 2022 + i).filter(y => y !== year).map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={() => setShowChart(!showChart)} data-testid="button-toggle-chart-costs">
          <BarChart3 className="mr-1 h-3 w-3" /> {showChart ? "Ukryj wykres" : "Pokaż wykres"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleImportFromContracts}
          disabled={isImportingContracts}
          data-testid="button-import-from-contracts"
        >
          <FileDown className="mr-1 h-3 w-3" />
          {isImportingContracts ? "Importowanie..." : "Import z umów"}
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
                <Bar dataKey="Prognoza" fill="hsl(222, 47%, 11%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Rzeczywiste" fill="#00CCFF" radius={[2, 2, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <FullscreenWrapper title={`Koszty apartamentów ${year}`} isFullscreen={fullscreen.isFullscreen} onExit={fullscreen.exit}>
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

        {compareYear !== null && (() => {
          const getCompareEntrySumsForYear = (entry: CostEntry, sourceData: DataMap): number => {
            let total = 0;
            entry.categories.forEach(cat => {
              const key = getCellKey(entry.id, cat);
              for (let m = 0; m < 12; m++) {
                const cell = sourceData[key]?.[m];
                if (cell) total += cell.r;
              }
            });
            return total;
          };

          const getCompareLocationTotal = (items: CostEntry[], sourceData: DataMap): number => {
            return items.reduce((sum, entry) => sum + getCompareEntrySumsForYear(entry, sourceData), 0);
          };

          const yoyChartData = MONTHS.map((name, m) => {
            let mainR = 0, compR = 0;
            costEntries.forEach(group => {
              group.items.forEach(entry => {
                entry.categories.forEach(cat => {
                  const key = getCellKey(entry.id, cat);
                  const mainCell = data[key]?.[m];
                  if (mainCell) mainR += mainCell.r;
                  const compCell = compareData[key]?.[m];
                  if (compCell) compR += compCell.r;
                });
              });
            });
            return { name, [String(year)]: Math.round(mainR), [String(compareYear)]: Math.round(compR) };
          });

          return (
            <div className="space-y-4 mt-4">
              <Card data-testid="card-yoy-costs-comparison">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">{`Porównanie rok do roku: ${year} vs ${compareYear}`}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="rounded-md border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left px-3 py-2 border-b border-border">Lokalizacja</th>
                          <th className="text-right px-3 py-2 border-b border-border">R {year} (PLN)</th>
                          <th className="text-right px-3 py-2 border-b border-border">R {compareYear} (PLN)</th>
                          <th className="text-right px-3 py-2 border-b border-border">Zmiana</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costEntries.map(group => {
                          const mainTotal = getCompareLocationTotal(group.items, data);
                          const compTotal = getCompareLocationTotal(group.items, compareData);
                          return (
                            <tr key={group.location} className="border-b border-border last:border-b-0">
                              <td className="px-3 py-2 font-semibold">{group.location}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatNum(mainTotal)}</td>
                              <td className="px-3 py-2 text-right tabular-nums">{formatNum(compTotal)}</td>
                              <td className={`px-3 py-2 text-right tabular-nums font-semibold ${costChangeColor(mainTotal, compTotal)}`}>{pctChange(mainTotal, compTotal)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-yoy-costs-chart">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">{`Koszty rzeczywiste: ${year} vs ${compareYear}`}</CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-3">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={yoyChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(value: number) => [`${value.toLocaleString("pl-PL")} zł`]} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line type="monotone" dataKey={String(year)} stroke="#00CCFF" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey={String(compareYear)} stroke="hsl(222, 47%, 11%)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          );
        })()}
      </FullscreenWrapper>

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

      <Dialog open={conflicts.length > 0} onOpenChange={(open) => { if (!open) { setConflicts([]); setPendingContractData(null); } }}>
        <DialogContent className="sm:max-w-[600px]" aria-describedby="conflict-dialog-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Wykryto konflikty wartości
            </DialogTitle>
          </DialogHeader>
          <p id="conflict-dialog-desc" className="text-sm text-muted-foreground">
            Dla poniższych pozycji wartości prognozowane w arkuszu różnią się od wartości w umowach. Wybierz, którą wartość zachować:
          </p>
          <div className="max-h-[400px] overflow-y-auto space-y-2">
            {conflicts.map(c => {
              const resKey = `${c.entryId}||${c.category}`;
              return (
                <div key={resKey} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{c.contractName} — {c.category}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`conflict-${resKey}`}
                        checked={conflictResolutions[resKey] === "existing"}
                        onChange={() => setConflictResolutions(p => ({ ...p, [resKey]: "existing" }))}
                      />
                      <span>Obecna: <strong>{c.existingValue.toLocaleString("pl-PL")} zł</strong></span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`conflict-${resKey}`}
                        checked={conflictResolutions[resKey] === "contract"}
                        onChange={() => setConflictResolutions(p => ({ ...p, [resKey]: "contract" }))}
                      />
                      <span>Z umowy: <strong>{c.contractValue.toLocaleString("pl-PL")} zł</strong></span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConflicts([]); setPendingContractData(null); }} data-testid="button-cancel-conflicts">Anuluj</Button>
            <Button onClick={resolveConflicts} data-testid="button-resolve-conflicts">Zastosuj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CostsApartments() {
  return <CostsApartmentsContent />;
}
