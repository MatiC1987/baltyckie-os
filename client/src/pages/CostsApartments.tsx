import { useState, useMemo, useCallback, useEffect, Fragment, useRef } from "react";
import type React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Apartment, Location } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown, ChevronRight, Plus, X, Calculator,
  BarChart3, GripVertical, Trash2, Pencil, Archive, RotateCcw,
  Copy, ArrowRight, Eraser, DatabaseBackup, Palette,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { getHeatMapBg, Sparkline } from "@/components/DataVizHelpers";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { FullscreenWrapper, useFullscreen, FullscreenToggleButton } from "@/components/FullscreenWrapper";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const MONTHS_PL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

const CATEGORY_COLORS = [
  { label: "Niebieski", value: "bg-blue-600 dark:bg-blue-700" },
  { label: "Czerwony", value: "bg-red-600 dark:bg-red-700" },
  { label: "Fioletowy", value: "bg-purple-600 dark:bg-purple-700" },
  { label: "Zielony", value: "bg-emerald-600 dark:bg-emerald-700" },
  { label: "Bursztynowy", value: "bg-amber-600 dark:bg-amber-700" },
  { label: "Różowy", value: "bg-pink-600 dark:bg-pink-700" },
  { label: "Błękitny", value: "bg-cyan-600 dark:bg-cyan-700" },
  { label: "Szary", value: "bg-slate-600 dark:bg-slate-700" },
  { label: "Indygo", value: "bg-indigo-600 dark:bg-indigo-700" },
  { label: "Pomarańczowy", value: "bg-orange-600 dark:bg-orange-700" },
];

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
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
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

type CellData = { p: number; r: number };
type DataMap = Record<string, Record<number, CellData>>;
type CategoriesMap = Record<string, string[]>;
type ColorMap = Record<string, Record<string, { color: string; archived?: boolean }>>;
type EntryColorMap = Record<string, string>;
type SortOrderMap = Record<string, string[]>;

// Legacy localStorage readers — used ONLY during one-time migration, then abandoned
function _legacyLoadData(year: number): DataMap {
  try { const r = localStorage.getItem(`costs-apartments-data-${year}`); if (r) return JSON.parse(r); } catch {}
  return {};
}
function _legacyLoadCategories(): CategoriesMap {
  try { const r = localStorage.getItem("costs-apartments-categories"); if (r) return JSON.parse(r); } catch {}
  return {};
}
function _legacyLoadColorMap(): ColorMap {
  try { const r = localStorage.getItem("costs-apartments-colors"); if (r) return JSON.parse(r); } catch {}
  return {};
}
function _legacyLoadEntryColorMap(): EntryColorMap {
  try { const r = localStorage.getItem("costs-apartments-entry-colors"); if (r) return JSON.parse(r); } catch {}
  return {};
}
function _legacyLoadSortOrder(): SortOrderMap {
  try { const r = localStorage.getItem("costs-apartments-sort-order"); if (r) return JSON.parse(r); } catch {}
  return {};
}

// DB helpers
async function dbBulkSaveCells(cells: { year: number; entryId: string; category: string; month: number; prognoza: string; realized: string }[]) {
  if (cells.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < cells.length; i += CHUNK) {
    await fetch('/api/apt-cost-data/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ cells: cells.slice(i, i + CHUNK) }),
    });
  }
}
async function dbSaveSettings(entryId: string, settings: Partial<{ categories: string[]; colors: Record<string, { color: string; archived?: boolean }>; entryColor: string; sortOrder: string[] }>) {
  await fetch(`/api/apt-cost-settings/${entryId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify(settings),
  });
}

interface CostEntry {
  id: string;
  name: string;
  isGrandBaltic: boolean;
  categories: string[];
  apartmentIds: number[];
}

type CellKey = string;
function makeCellKey(entryId: string, category: string, month: number, field: "p" | "r"): CellKey {
  return `${entryId}__${category}__${month}__${field}`;
}

function parseCellKey(key: CellKey) {
  const parts = key.split("__");
  return { entryId: parts[0], category: parts[1], month: parseInt(parts[2]), field: parts[3] as "p" | "r" };
}

function EditableCell({
  cellKey, value, editingCell, editValue, setEditValue, startEditing, commitEdit, cancelEdit,
  className = "", isSelected, isInRange, onCellClick, onFillHandleMouseDown, onCellMouseEnter, month,
}: {
  cellKey: CellKey; value: number; editingCell: CellKey | null; editValue: string;
  setEditValue: (v: string) => void; startEditing: (key: CellKey) => void;
  commitEdit: () => void; cancelEdit: () => void;
  className?: string; isSelected?: boolean; isInRange?: boolean;
  onCellClick?: (key: CellKey) => void; onFillHandleMouseDown?: (e: React.MouseEvent) => void;
  onCellMouseEnter?: (month: number) => void; month: number;
}) {
  const isEditing = editingCell === cellKey;
  return (
    <td
      className={`border-b border-r border-border px-0 py-0 text-right tabular-nums relative select-none ${className} ${isSelected ? "ring-2 ring-primary ring-inset" : ""} ${isInRange ? "bg-primary/10" : ""}`}
      onDoubleClick={() => startEditing(cellKey)}
      onClick={() => onCellClick?.(cellKey)}
      onMouseEnter={() => onCellMouseEnter?.(month)}
      data-testid={`cell-${cellKey}`}
    >
      {isEditing ? (
        <input
          type="number"
          autoFocus
          className="w-full h-full px-1 py-0.5 text-right text-[11px] tabular-nums bg-primary/5 outline-none border-0"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") cancelEdit();
          }}
        />
      ) : (
        <span className="block px-1 py-0.5 text-[11px] cursor-cell min-h-[20px]">
          {formatNum(value)}
        </span>
      )}
      {isSelected && !isEditing && onFillHandleMouseDown && (
        <div
          className="absolute bottom-0 right-0 w-2 h-2 bg-primary cursor-crosshair z-10"
          onMouseDown={onFillHandleMouseDown}
        />
      )}
    </td>
  );
}

export function CostsApartmentsContent({ embedded = false, externalYear, onTotalsChange, triggerMonthHighlight, onMonthHighlightDone }: { embedded?: boolean; externalYear?: number; onTotalsChange?: (prognoza: number, realized: number) => void; triggerMonthHighlight?: number | null; onMonthHighlightDone?: () => void }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(externalYear ?? currentYear);
  const [data, setData] = useState<DataMap>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [categoriesMap, setCategoriesMap] = useState<CategoriesMap>({});
  const [colorMap, setColorMap] = useState<ColorMap>({});
  const [entryColorMap, setEntryColorMap] = useState<EntryColorMap>({});
  const [sortOrderMap, setSortOrderMap] = useState<SortOrderMap>({});
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isImportingHistory, setIsImportingHistory] = useState(false);
  const { toast } = useToast();

  // DB queries
  const { data: aptCostRows, isLoading: isLoadingCostData } = useQuery<any[]>({
    queryKey: ['/api/apt-cost-data', year],
    staleTime: 30000,
    refetchInterval: 30000,
  });
  const { data: compareCostRows } = useQuery<any[]>({
    queryKey: ['/api/apt-cost-data', compareYear],
    enabled: compareYear !== null,
    staleTime: 30000,
  });
  const { data: settingsRows } = useQuery<any[]>({
    queryKey: ['/api/apt-cost-settings'],
    staleTime: 60000,
    refetchInterval: 60000,
  });

  // Pending cells ref for debounced DB writes
  const pendingCellsRef = useRef<Map<string, { year: number; entryId: string; category: string; month: number; prognoza: string; realized: string }>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingCells = useCallback(async () => {
    if (pendingCellsRef.current.size === 0) return;
    const cells = Array.from(pendingCellsRef.current.values());
    pendingCellsRef.current.clear();
    try { await dbBulkSaveCells(cells); } catch (err) { console.error('Błąd zapisu komórek:', err); }
  }, []);

  // Populate data state from API
  useEffect(() => {
    if (!aptCostRows) return;
    const m: DataMap = {};
    for (const r of aptCostRows) {
      const key = `${r.entryId}__${r.category}`;
      if (!m[key]) m[key] = {};
      m[key][r.month] = { p: parseFloat(r.prognoza ?? '0'), r: parseFloat(r.realized ?? '0') };
    }
    setData(m);
  }, [aptCostRows]);

  // Populate settings from API
  useEffect(() => {
    if (!settingsRows) return;
    const cats: CategoriesMap = {};
    const colors: ColorMap = {};
    const entryColors: EntryColorMap = {};
    const sortOrders: SortOrderMap = {};
    for (const s of settingsRows) {
      if (s.categories) cats[s.entryId] = s.categories as string[];
      if (s.colors) colors[s.entryId] = s.colors as Record<string, { color: string; archived?: boolean }>;
      if (s.entryColor) entryColors[s.entryId] = s.entryColor;
      if (s.sortOrder) sortOrders[s.entryId] = s.sortOrder as string[];
    }
    setCategoriesMap(cats);
    setColorMap(colors);
    setEntryColorMap(entryColors);
    setSortOrderMap(sortOrders);
  }, [settingsRows]);

  // One-time auto-migration from localStorage → DB
  useEffect(() => {
    if (isLoadingCostData || !aptCostRows || !settingsRows) return;
    const dataFlag = localStorage.getItem('migrated-apt-cost-to-db-v1');
    const settingsFlag = localStorage.getItem('migrated-apt-settings-to-db-v1');
    if (dataFlag && settingsFlag) return;

    const doMigration = async () => {
      if (!dataFlag) {
        const allCells: { year: number; entryId: string; category: string; month: number; prognoza: string; realized: string }[] = [];
        for (let y = 2022; y <= currentYear; y++) {
          const localData = _legacyLoadData(y);
          for (const key of Object.keys(localData)) {
            const parts = key.split('__');
            if (parts.length < 2) continue;
            const [entryId, ...catParts] = parts;
            const category = catParts.join('__');
            for (let m = 0; m < 12; m++) {
              const cell = localData[key]?.[m];
              if (cell && (cell.p !== 0 || cell.r !== 0)) {
                allCells.push({ year: y, entryId, category, month: m, prognoza: String(cell.p), realized: String(cell.r) });
              }
            }
          }
        }
        if (allCells.length > 0) await dbBulkSaveCells(allCells);
        localStorage.setItem('migrated-apt-cost-to-db-v1', '1');
        if (allCells.length > 0) queryClient.invalidateQueries({ queryKey: ['/api/apt-cost-data'] });
      }
      if (!settingsFlag) {
        const legacyCats = _legacyLoadCategories();
        const legacyColors = _legacyLoadColorMap();
        const legacyEntryColors = _legacyLoadEntryColorMap();
        const legacySortOrder = _legacyLoadSortOrder();
        const entryIds = new Set([...Object.keys(legacyCats), ...Object.keys(legacyColors), ...Object.keys(legacyEntryColors), ...Object.keys(legacySortOrder)]);
        for (const entryId of entryIds) {
          const s: Partial<{ categories: string[]; colors: Record<string, { color: string; archived?: boolean }>; entryColor: string; sortOrder: string[] }> = {};
          if (legacyCats[entryId]) s.categories = legacyCats[entryId];
          if (legacyColors[entryId]) s.colors = legacyColors[entryId];
          if (legacyEntryColors[entryId]) s.entryColor = legacyEntryColors[entryId];
          if (legacySortOrder[entryId]) s.sortOrder = legacySortOrder[entryId];
          if (Object.keys(s).length > 0) await dbSaveSettings(entryId, s);
        }
        localStorage.setItem('migrated-apt-settings-to-db-v1', '1');
        if (entryIds.size > 0) queryClient.invalidateQueries({ queryKey: ['/api/apt-cost-settings'] });
      }
    };
    doMigration().catch(err => console.error('Błąd migracji:', err));
  }, [aptCostRows, settingsRows, isLoadingCostData]);

  const [editingCell, setEditingCell] = useState<CellKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedCell, setSelectedCell] = useState<CellKey | null>(null);
  const [fillRangeEnd, setFillRangeEnd] = useState<number | null>(null);
  const fillDragging = useRef(false);

  const [editingEntry, setEditingEntry] = useState<CostEntry | null>(null);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [addCatEntryId, setAddCatEntryId] = useState<string | null>(null);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0].value);

  const [editCatDialog, setEditCatDialog] = useState<{ entryId: string; category: string } | null>(null);
  const [editCatName, setEditCatName] = useState("");
  const [editCatColor, setEditCatColor] = useState("");

  const [showCopyToNextYear, setShowCopyToNextYear] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [editEntryColorDialog, setEditEntryColorDialog] = useState<string | null>(null);
  const [editEntryColor, setEditEntryColor] = useState("");

  const [resetEntryDialog, setResetEntryDialog] = useState<{ entryId: string; entryName: string } | null>(null);
  const [apartmentSheet, setApartmentSheet] = useState<string | null>(null);
  const [categorySheet, setCategorySheet] = useState<{ entryId: string; cat: string } | null>(null);
  const [highlightMonth, setHighlightMonth] = useState<number | null>(null);

  const [locationTab, setLocationTab] = useState<string>(() => {
    try { return localStorage.getItem("costs-apartments-location-tab") || "GRAND BALTIC"; } catch { return "GRAND BALTIC"; }
  });

  const dragCatRef = useRef<{ entryId: string; category: string } | null>(null);
  const dragOverCatRef = useRef<{ entryId: string; category: string } | null>(null);
  const [dragCatKey, setDragCatKey] = useState<string | null>(null);

  useEffect(() => {
    if (externalYear !== undefined && externalYear !== year) {
      setYear(externalYear);
      if (compareYear === externalYear) setCompareYear(null);
    }
  }, [externalYear]);

  const handleClearAll = async () => {
    setData({});
    setShowClearAllDialog(false);
    try {
      await fetch(`/api/apt-cost-data?year=${year}`, { method: 'DELETE', credentials: 'include' });
      queryClient.invalidateQueries({ queryKey: ['/api/apt-cost-data', year] });
    } catch (err) { console.error('Błąd czyszczenia:', err); }
    toast({ title: "Dane wyczyszczone", description: `Wszystkie koszty za rok ${year} zostały usunięte` });
  };

  const { data: apartments = [] } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"] });

  const sortedLocations = useMemo(() =>
    [...locations].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [locations]
  );

  const getCategoriesForEntry = useCallback((entryId: string, isGrandBaltic: boolean): string[] => {
    const cats = categoriesMap[entryId] || (isGrandBaltic ? [...DEFAULT_CATEGORIES_GRAND_BALTIC] : [...DEFAULT_CATEGORIES_INDIVIDUAL]);
    const order = sortOrderMap[entryId];
    if (order) {
      const ordered = order.filter(c => cats.includes(c));
      const remaining = cats.filter(c => !order.includes(c));
      return [...ordered, ...remaining];
    }
    return cats;
  }, [categoriesMap, sortOrderMap]);

  const getActiveCategories = useCallback((entryId: string, isGrandBaltic: boolean): string[] => {
    const all = getCategoriesForEntry(entryId, isGrandBaltic);
    const colors = colorMap[entryId] || {};
    return all.filter(c => !colors[c]?.archived);
  }, [getCategoriesForEntry, colorMap]);

  const getArchivedCategories = useCallback((entryId: string, isGrandBaltic: boolean): string[] => {
    const all = getCategoriesForEntry(entryId, isGrandBaltic);
    const colors = colorMap[entryId] || {};
    return all.filter(c => colors[c]?.archived);
  }, [getCategoriesForEntry, colorMap]);

  const getCategoryColor = useCallback((entryId: string, category: string, defaultIdx: number): string => {
    const colors = colorMap[entryId] || {};
    if (colors[category]?.color) return colors[category].color;
    return CATEGORY_COLORS[defaultIdx % CATEGORY_COLORS.length].value;
  }, [colorMap]);

  const getEntryColor = useCallback((entryId: string, defaultIdx: number): string => {
    if (entryColorMap[entryId]) return entryColorMap[entryId];
    return CATEGORY_COLORS[defaultIdx % CATEGORY_COLORS.length].value;
  }, [entryColorMap]);

  const openEntryColorDialog = useCallback((entryId: string, defaultIdx: number) => {
    setEditEntryColorDialog(entryId);
    setEditEntryColor(getEntryColor(entryId, defaultIdx));
  }, [getEntryColor]);

  const handleSaveEntryColor = useCallback(() => {
    if (!editEntryColorDialog) return;
    const next = { ...entryColorMap, [editEntryColorDialog]: editEntryColor };
    setEntryColorMap(next);
    dbSaveSettings(editEntryColorDialog, { entryColor: editEntryColor });
    setEditEntryColorDialog(null);
  }, [editEntryColorDialog, editEntryColor, entryColorMap]);

  const costEntries = useMemo(() => {
    const entries: { location: string; items: CostEntry[] }[] = [];
    for (const loc of sortedLocations) {
      const locApts = apartments.filter(a => a.location === loc.name && a.active !== false);
      if (locApts.length === 0) continue;
      if (loc.name === GRAND_BALTIC_LOCATION) {
        entries.push({
          location: loc.name,
          items: [{
            id: "gb-all",
            name: GRAND_BALTIC_LOCATION,
            isGrandBaltic: true,
            categories: getActiveCategories("gb-all", true),
            apartmentIds: locApts.map(a => a.id),
          }],
        });
      } else {
        entries.push({
          location: loc.name,
          items: locApts.map(apt => ({
            id: `apt-${apt.id}`,
            name: apt.name,
            isGrandBaltic: false,
            categories: getActiveCategories(`apt-${apt.id}`, false),
            apartmentIds: [apt.id],
          })),
        });
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
          categories: getActiveCategories(`apt-${apt.id}`, false),
          apartmentIds: [apt.id],
        })),
      });
    }
    return entries;
  }, [apartments, sortedLocations, getActiveCategories]);

  const locationTabNames = useMemo(() => costEntries.map(g => g.location), [costEntries]);

  const validLocationTab = useMemo(() => {
    if (locationTab === "all") return "all";
    return locationTabNames.includes(locationTab) ? locationTab : "all";
  }, [locationTab, locationTabNames]);

  const handleLocationTabChange = useCallback((tab: string) => {
    setLocationTab(tab);
    try { localStorage.setItem("costs-apartments-location-tab", tab); } catch {}
  }, []);

  const filteredCostEntries = useMemo(() => {
    if (validLocationTab === "all") return costEntries;
    return costEntries.filter(g => g.location === validLocationTab);
  }, [costEntries, validLocationTab]);

  const compareData = useMemo(() => {
    if (compareYear === null || !compareCostRows) return {};
    const m: DataMap = {};
    for (const r of compareCostRows) {
      const key = `${r.entryId}__${r.category}`;
      if (!m[key]) m[key] = {};
      m[key][r.month] = { p: parseFloat(r.prognoza ?? '0'), r: parseFloat(r.realized ?? '0') };
    }
    return m;
  }, [compareYear, compareCostRows]);

  const getCellKeyOld = (entryId: string, category: string) => `${entryId}__${category}`;

  const getCellValue = useCallback((entryId: string, category: string, month: number, field: "p" | "r"): number => {
    const key = getCellKeyOld(entryId, category);
    return data[key]?.[month]?.[field] || 0;
  }, [data]);

  const handleCellChange = useCallback((entryId: string, category: string, month: number, field: "p" | "r", value: string) => {
    const key = getCellKeyOld(entryId, category);
    setData(prev => {
      const next = { ...prev };
      if (!next[key]) next[key] = {};
      if (!next[key][month]) next[key][month] = { p: 0, r: 0 };
      const newCell = { ...next[key][month], [field]: parseFloat(value) || 0 };
      next[key][month] = newCell;
      // Queue for DB write
      const cellKey = `${year}__${entryId}__${category}__${month}`;
      pendingCellsRef.current.set(cellKey, { year, entryId, category, month, prognoza: String(newCell.p), realized: String(newCell.r) });
      return next;
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushPendingCells, 600);
  }, [year, flushPendingCells]);

  const startEditing = useCallback((cellKey: CellKey) => {
    const parsed = parseCellKey(cellKey);
    const val = getCellValue(parsed.entryId, parsed.category, parsed.month, parsed.field);
    setEditingCell(cellKey);
    setEditValue(val ? val.toString() : "");
  }, [getCellValue]);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    const parsed = parseCellKey(editingCell);
    handleCellChange(parsed.entryId, parsed.category, parsed.month, parsed.field, editValue);
    setEditingCell(null);
  }, [editingCell, editValue, handleCellChange]);

  const cancelEdit = useCallback(() => { setEditingCell(null); }, []);

  const handleCellClick = useCallback((key: CellKey) => {
    setSelectedCell(key);
    setFillRangeEnd(null);
  }, []);

  const handleFillHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fillDragging.current = true;
  }, []);

  const handleCellMouseEnter = useCallback((month: number) => {
    if (fillDragging.current && selectedCell) setFillRangeEnd(month);
  }, [selectedCell]);

  const handleMouseUp = useCallback(() => {
    if (fillDragging.current && selectedCell && fillRangeEnd !== null) {
      const source = parseCellKey(selectedCell);
      const sourceVal = getCellValue(source.entryId, source.category, source.month, source.field);
      const startM = Math.min(source.month, fillRangeEnd);
      const endM = Math.max(source.month, fillRangeEnd);
      if (startM !== endM) {
        for (let m = startM; m <= endM; m++) {
          handleCellChange(source.entryId, source.category, m, source.field, sourceVal.toString());
        }
      }
    }
    fillDragging.current = false;
    setFillRangeEnd(null);
  }, [selectedCell, fillRangeEnd, getCellValue, handleCellChange]);

  const isInFillRange = useCallback((key: CellKey): boolean => {
    if (!selectedCell || fillRangeEnd === null) return false;
    const source = parseCellKey(selectedCell);
    const target = parseCellKey(key);
    if (source.entryId !== target.entryId || source.category !== target.category || source.field !== target.field) return false;
    const startM = Math.min(source.month, fillRangeEnd);
    const endM = Math.max(source.month, fillRangeEnd);
    return target.month >= startM && target.month <= endM;
  }, [selectedCell, fillRangeEnd]);

  const handleFillToEnd = useCallback(() => {
    if (!selectedCell) return;
    const source = parseCellKey(selectedCell);
    const sourceVal = getCellValue(source.entryId, source.category, source.month, source.field);
    for (let m = source.month; m < 12; m++) {
      handleCellChange(source.entryId, source.category, m, source.field, sourceVal.toString());
    }
    setSelectedCell(null);
  }, [selectedCell, getCellValue, handleCellChange]);

  const handleCopyForecastToNextYear = useCallback(async () => {
    const nextYear = year + 1;
    const cells: { year: number; entryId: string; category: string; month: number; prognoza: string; realized: string }[] = [];
    costEntries.forEach(group => {
      group.items.forEach(entry => {
        entry.categories.forEach(cat => {
          const key = getCellKeyOld(entry.id, cat);
          for (let m = 0; m < 12; m++) {
            const val = data[key]?.[m]?.p || 0;
            if (val !== 0) cells.push({ year: nextYear, entryId: entry.id, category: cat, month: m, prognoza: String(val), realized: '0' });
          }
        });
      });
    });
    if (cells.length > 0) {
      try { await dbBulkSaveCells(cells); queryClient.invalidateQueries({ queryKey: ['/api/apt-cost-data', nextYear] }); }
      catch (err) { console.error('Błąd kopiowania prognozy:', err); }
    }
    setShowCopyToNextYear(false);
    toast({ title: "Skopiowano", description: `Prognoza skopiowana na rok ${nextYear}` });
  }, [year, costEntries, data, toast, queryClient]);

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
    // Data will be loaded from DB via useQuery when year changes
  };

  const openCategoryEditor = (entry: CostEntry) => {
    setEditingEntry(entry);
    setEditCategories([...getCategoriesForEntry(entry.id, entry.isGrandBaltic)]);
    setNewCategory("");
  };

  const saveCategoryEdits = () => {
    if (!editingEntry) return;
    const next = { ...categoriesMap, [editingEntry.id]: editCategories };
    setCategoriesMap(next);
    dbSaveSettings(editingEntry.id, { categories: editCategories, sortOrder: sortOrderMap[editingEntry.id] });
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

  const handleAddCategoryWithColor = () => {
    if (!addCatEntryId || !newCatName.trim()) return;
    const name = newCatName.trim().toUpperCase();
    const existing = categoriesMap[addCatEntryId] || (addCatEntryId === "gb-all" ? [...DEFAULT_CATEGORIES_GRAND_BALTIC] : [...DEFAULT_CATEGORIES_INDIVIDUAL]);
    const newCats = existing.includes(name) ? existing : [...existing, name];
    const nextCats = { ...categoriesMap, [addCatEntryId]: newCats };
    setCategoriesMap(nextCats);
    const newColors = { ...colorMap };
    if (!newColors[addCatEntryId]) newColors[addCatEntryId] = {};
    newColors[addCatEntryId][name] = { color: newCatColor };
    setColorMap(newColors);
    dbSaveSettings(addCatEntryId, { categories: newCats, colors: newColors[addCatEntryId], sortOrder: sortOrderMap[addCatEntryId] });
    setNewCatName("");
    setNewCatColor(CATEGORY_COLORS[0].value);
    setShowAddCategory(false);
    setAddCatEntryId(null);
  };

  const handleArchiveCategory = useCallback((entryId: string, category: string) => {
    const newColors = { ...colorMap };
    if (!newColors[entryId]) newColors[entryId] = {};
    newColors[entryId][category] = { ...newColors[entryId][category], archived: true };
    setColorMap(newColors);
    dbSaveSettings(entryId, { colors: newColors[entryId] });
    toast({ title: "Zarchiwizowano kategorię" });
  }, [colorMap, toast]);

  const handleRestoreCategory = useCallback((entryId: string, category: string) => {
    const newColors = { ...colorMap };
    if (newColors[entryId]?.[category]) {
      newColors[entryId][category] = { ...newColors[entryId][category], archived: false };
      setColorMap(newColors);
      dbSaveSettings(entryId, { colors: newColors[entryId] });
    }
    toast({ title: "Przywrócono kategorię" });
  }, [colorMap, toast]);

  const handleDeleteCategory = useCallback((entryId: string, category: string) => {
    const existing = categoriesMap[entryId] || [];
    const newCats = existing.filter(c => c !== category);
    setCategoriesMap({ ...categoriesMap, [entryId]: newCats });
    dbSaveSettings(entryId, { categories: newCats });
    toast({ title: "Usunięto kategorię" });
  }, [categoriesMap, toast]);

  const handleResetEntryData = useCallback(async (entryId: string) => {
    const next: DataMap = {};
    for (const key of Object.keys(data)) {
      if (!key.startsWith(`${entryId}__`)) next[key] = data[key];
    }
    setData(next);
    const nextCats = { ...categoriesMap };
    delete nextCats[entryId];
    setCategoriesMap(nextCats);
    setResetEntryDialog(null);
    try {
      await fetch(`/api/apt-cost-data?year=${year}&entryId=${entryId}`, { method: 'DELETE', credentials: 'include' });
      queryClient.invalidateQueries({ queryKey: ['/api/apt-cost-data', year] });
    } catch (err) { console.error('Błąd resetu:', err); }
    toast({ title: "Zresetowano dane", description: "Koszty zostały usunięte dla wybranego apartamentu i roku" });
  }, [year, data, categoriesMap, queryClient, toast]);

  const openEditCatDialog = useCallback((entryId: string, category: string) => {
    setEditCatDialog({ entryId, category });
    setEditCatName(category);
    setEditCatColor(colorMap[entryId]?.[category]?.color || CATEGORY_COLORS[0].value);
  }, [colorMap]);

  const handleSaveEditCat = useCallback(async () => {
    if (!editCatDialog || !editCatName.trim()) return;
    const { entryId, category } = editCatDialog;
    const newName = editCatName.trim().toUpperCase();
    let newCats = categoriesMap[entryId] || [];
    if (newName !== category) {
      newCats = newCats.map(c => c === category ? newName : c);
      setCategoriesMap({ ...categoriesMap, [entryId]: newCats });
      const oldKey = getCellKeyOld(entryId, category);
      const newKey = getCellKeyOld(entryId, newName);
      if (data[oldKey]) {
        const newData = { ...data, [newKey]: data[oldKey] };
        delete newData[oldKey];
        setData(newData);
        // Remap pending cells for new category name
        const cells: { year: number; entryId: string; category: string; month: number; prognoza: string; realized: string }[] = [];
        for (let m = 0; m < 12; m++) {
          const cell = newData[newKey]?.[m];
          if (cell) cells.push({ year, entryId, category: newName, month: m, prognoza: String(cell.p), realized: String(cell.r) });
        }
        if (cells.length > 0) await dbBulkSaveCells(cells);
      }
    }
    const newColors = { ...colorMap };
    if (!newColors[entryId]) newColors[entryId] = {};
    newColors[entryId][newName] = { ...(newColors[entryId][category] || {}), color: editCatColor };
    if (newName !== category) delete newColors[entryId][category];
    setColorMap(newColors);
    dbSaveSettings(entryId, { categories: newCats, colors: newColors[entryId] });
    setEditCatDialog(null);
  }, [editCatDialog, editCatName, editCatColor, categoriesMap, colorMap, data, year]);

  const handleCatDragStart = useCallback((entryId: string, category: string) => {
    dragCatRef.current = { entryId, category };
    setDragCatKey(`${entryId}__${category}`);
  }, []);

  const handleCatDragOver = useCallback((e: React.DragEvent, entryId: string, category: string) => {
    e.preventDefault();
    dragOverCatRef.current = { entryId, category };
  }, []);

  const handleCatDragEnd = useCallback(() => {
    const from = dragCatRef.current;
    const to = dragOverCatRef.current;
    setDragCatKey(null);
    dragCatRef.current = null;
    dragOverCatRef.current = null;
    if (!from || !to || from.entryId !== to.entryId || from.category === to.category) return;
    const entryId = from.entryId;
    const isGrandBaltic = entryId === "gb-all";
    const cats = getCategoriesForEntry(entryId, isGrandBaltic);
    const fromIdx = cats.indexOf(from.category);
    const toIdx = cats.indexOf(to.category);
    if (fromIdx === -1 || toIdx === -1) return;
    const newCats = [...cats];
    const [moved] = newCats.splice(fromIdx, 1);
    newCats.splice(toIdx, 0, moved);
    setSortOrderMap({ ...sortOrderMap, [entryId]: newCats });
    setCategoriesMap({ ...categoriesMap, [entryId]: newCats });
    dbSaveSettings(entryId, { categories: newCats, sortOrder: newCats });
  }, [getCategoriesForEntry, sortOrderMap, categoriesMap]);

  const getEntrySums = useCallback((entry: CostEntry, month: number): { p: number; r: number } => {
    let p = 0, r = 0;
    entry.categories.forEach(cat => {
      p += getCellValue(entry.id, cat, month, "p");
      r += getCellValue(entry.id, cat, month, "r");
    });
    return { p, r };
  }, [getCellValue]);

  const getEntryYearTotal = useCallback((entry: CostEntry): { p: number; r: number } => {
    let p = 0, r = 0;
    for (let m = 0; m < 12; m++) { const s = getEntrySums(entry, m); p += s.p; r += s.r; }
    return { p, r };
  }, [getEntrySums]);

  const costsHeatMax = useMemo(() => {
    let max = 0;
    filteredCostEntries.forEach(group => {
      group.items.forEach(entry => {
        for (let m = 0; m < 12; m++) {
          const s = getEntrySums(entry, m);
          if (s.r > max) max = s.r;
        }
      });
    });
    return max;
  }, [filteredCostEntries, getEntrySums]);

  const getEntrySparklineData = useCallback((entry: CostEntry): number[] => {
    return Array.from({ length: 12 }, (_, m) => getEntrySums(entry, m).r);
  }, [getEntrySums]);

  const getCatSparklineData = useCallback((entryId: string, category: string): number[] => {
    return Array.from({ length: 12 }, (_, m) => getCellValue(entryId, category, m, "r"));
  }, [getCellValue]);

  const getLocationSums = useCallback((items: CostEntry[], month: number): { p: number; r: number } => {
    let p = 0, r = 0;
    items.forEach(entry => { const s = getEntrySums(entry, month); p += s.p; r += s.r; });
    return { p, r };
  }, [getEntrySums]);

  const getLocationYearTotal = useCallback((items: CostEntry[]): { p: number; r: number } => {
    let p = 0, r = 0;
    for (let m = 0; m < 12; m++) { const s = getLocationSums(items, m); p += s.p; r += s.r; }
    return { p, r };
  }, [getLocationSums]);

  const grandTotal = useMemo(() => {
    let p = 0, r = 0;
    filteredCostEntries.forEach(group => { const s = getLocationYearTotal(group.items); p += s.p; r += s.r; });
    return { p, r, s: p - r };
  }, [filteredCostEntries, getLocationYearTotal]);

  const allEntriesTotal = useMemo(() => {
    let p = 0, r = 0;
    costEntries.forEach(group => { const s = getLocationYearTotal(group.items); p += s.p; r += s.r; });
    return { p, r };
  }, [costEntries, getLocationYearTotal]);

  useEffect(() => {
    onTotalsChange?.(allEntriesTotal.p, allEntriesTotal.r);
  }, [allEntriesTotal.p, allEntriesTotal.r]);

  const currentMonthTotals = useMemo(() => {
    let p = 0, r = 0;
    filteredCostEntries.forEach(group => { const s = getLocationSums(group.items, currentMonth); p += s.p; r += s.r; });
    return { p, r, s: p - r };
  }, [filteredCostEntries, getLocationSums, currentMonth]);

  const scrollToMonth = useCallback(() => {
    const el = document.getElementById(`month-col-${currentMonth}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setHighlightMonth(currentMonth);
    setTimeout(() => setHighlightMonth(null), 2000);
  }, [currentMonth]);

  useEffect(() => {
    if (triggerMonthHighlight === null || triggerMonthHighlight === undefined) return;
    const el = document.getElementById(`month-col-${triggerMonthHighlight}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    setHighlightMonth(triggerMonthHighlight);
    const timer = setTimeout(() => {
      setHighlightMonth(null);
      onMonthHighlightDone?.();
    }, 2000);
    return () => clearTimeout(timer);
  }, [triggerMonthHighlight]);

  const monthlyCostChart = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      let p = 0, r = 0;
      filteredCostEntries.forEach(group => { const s = getLocationSums(group.items, m); p += s.p; r += s.r; });
      return { name: MONTHS[m], Prognoza: Math.round(p), Rzeczywiste: Math.round(r) };
    });
  }, [filteredCostEntries, getLocationSums]);

  const archivedEntries = useMemo(() => {
    const result: { entryId: string; entryName: string; categories: string[] }[] = [];
    filteredCostEntries.forEach(group => {
      group.items.forEach(entry => {
        const archived = getArchivedCategories(entry.id, entry.isGrandBaltic);
        if (archived.length > 0) {
          result.push({ entryId: entry.id, entryName: entry.name, categories: archived });
        }
      });
    });
    return result;
  }, [filteredCostEntries, getArchivedCategories]);

  const [showChart, setShowChart] = useState(false);
  const fullscreen = useFullscreen();

  const selectedCellValue = useMemo(() => {
    if (!selectedCell) return 0;
    const parsed = parseCellKey(selectedCell);
    return getCellValue(parsed.entryId, parsed.category, parsed.month, parsed.field);
  }, [selectedCell, getCellValue]);

  const handleImportHistory = useCallback(async () => {
    setIsImportingHistory(true);
    try {
      const resp = await fetch('/api/apt-cost-data/seed', { method: 'POST', credentials: 'include' });
      if (!resp.ok) throw new Error(await resp.text());
      const result = await resp.json();
      if (result.skipped) {
        toast({ title: 'Dane już istnieją', description: 'Baza danych zawiera już dane historyczne. Seed pominięty.' });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/apt-cost-data'] });
        toast({ title: 'Import zakończony', description: `Zaimportowano ${result.seeded} rekordów z pliku Excel do bazy danych.` });
      }
    } catch (err: any) {
      toast({ title: 'Błąd importu', description: err.message, variant: 'destructive' });
    } finally {
      setIsImportingHistory(false);
    }
  }, [toast, queryClient]);

  return (
    <div className={embedded ? "space-y-4" : "p-6 space-y-4"} onMouseUp={handleMouseUp}>
      {!embedded && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <PageHeader title="Koszty apartamentów" description="Analiza kosztów w podziale na apartamenty." icon={Calculator} />
          <div className="flex items-center gap-2 flex-wrap">
            <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
            <Button variant="outline" onClick={handleImportHistory} disabled={isImportingHistory} data-testid="button-import-history-costs">
              <DatabaseBackup className="mr-1 h-4 w-4" /> {isImportingHistory ? 'Importowanie...' : 'Import historii'}
            </Button>
            <Button variant="outline" onClick={() => setShowCopyToNextYear(true)} data-testid="button-copy-forecast-next-year">
              <ArrowRight className="mr-1 h-4 w-4" /> Kopiuj na {year + 1}
            </Button>
            <Button variant="outline" onClick={() => setShowClearAllDialog(true)} data-testid="button-clear-all-costs">
              <Eraser className="h-4 w-4 mr-1" /> Wyczyść rok {year}
            </Button>
            <Select value={String(year)} onValueChange={handleYearChange}>
              <SelectTrigger className="w-[100px]" data-testid="select-year"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: currentYear - 2022 + 2 }, (_, i) => 2022 + i).map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={compareYear !== null ? String(compareYear) : "none"} onValueChange={(v) => setCompareYear(v === "none" ? null : Number(v))}>
              <SelectTrigger className="w-[140px]" data-testid="select-compare-year"><SelectValue placeholder="Porównaj z..." /></SelectTrigger>
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

      {embedded && (
        <div className="flex flex-wrap items-center gap-2">
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
          <Button variant="outline" size="sm" onClick={() => setShowCopyToNextYear(true)} data-testid="button-copy-forecast-next-year">
            <ArrowRight className="mr-1 h-4 w-4" /> Kopiuj na {year + 1}
          </Button>
          <Select value={compareYear !== null ? String(compareYear) : "none"} onValueChange={(v) => setCompareYear(v === "none" ? null : Number(v))}>
            <SelectTrigger className="w-[160px]" data-testid="select-compare-year"><SelectValue placeholder="Porównaj z..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Brak —</SelectItem>
              {Array.from({ length: currentYear - 2022 + 2 }, (_, i) => 2022 + i).filter(y => y !== year).map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {locationTabNames.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto pb-1" data-testid="location-tabs">
          {locationTabNames.map(name => (
            <Button
              key={name}
              variant={validLocationTab === name ? "default" : "outline"}
              size="sm"
              className="text-xs whitespace-nowrap"
              onClick={() => handleLocationTabChange(name)}
              data-testid={`tab-${name.replace(/\s+/g, "-").toLowerCase()}`}
            >
              {name}
            </Button>
          ))}
          <Button
            variant={validLocationTab === "all" ? "default" : "outline"}
            size="sm"
            className="text-xs whitespace-nowrap"
            onClick={() => handleLocationTabChange("all")}
            data-testid="tab-all"
          >
            Wszystkie
          </Button>
        </div>
      )}

      {isLoadingCostData ? (
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Prognoza roczna</p>
              <p className="text-xl font-bold mt-1 tabular-nums" data-testid="text-total-prognoza">{grandTotal.p.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Zrealizowane koszty</p>
              <p className="text-xl font-bold mt-1 tabular-nums" data-testid="text-total-rzeczywiste">{grandTotal.r.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
              {grandTotal.p > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">{Math.round(grandTotal.r / grandTotal.p * 100)}% planu</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`text-xl font-bold mt-1 tabular-nums ${saldoColor(grandTotal.s)}`} data-testid="text-total-saldo">
                {grandTotal.s >= 0 ? "+" : ""}{grandTotal.s.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {year === currentYear && !isLoadingCostData && (
        <>
          <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">{MONTHS_PL[currentMonth]} — bieżący miesiąc</p>
          <div className="grid grid-cols-3 gap-3">
            <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={scrollToMonth} data-testid="kpi-month-prognoza">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">Prognoza ({MONTHS[currentMonth]})</p>
                <p className="text-xl font-bold mt-1 tabular-nums">{currentMonthTotals.p.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={scrollToMonth} data-testid="kpi-month-realized">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">Zrealizowane ({MONTHS[currentMonth]})</p>
                <p className="text-xl font-bold mt-1 tabular-nums">{currentMonthTotals.r.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
                {currentMonthTotals.p > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">{Math.round(currentMonthTotals.r / currentMonthTotals.p * 100)}% planu</p>
                )}
              </CardContent>
            </Card>
            <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={scrollToMonth} data-testid="kpi-month-saldo">
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">Saldo ({MONTHS[currentMonth]})</p>
                <p className={`text-xl font-bold mt-1 tabular-nums ${saldoColor(currentMonthTotals.s)}`}>
                  {currentMonthTotals.s >= 0 ? "+" : ""}{currentMonthTotals.s.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <div className="flex items-center gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={() => setShowChart(!showChart)} data-testid="button-toggle-chart-costs">
          <BarChart3 className="mr-1 h-3 w-3" /> {showChart ? "Ukryj wykres" : "Pokaż wykres"}
        </Button>
        <Button variant="outline" size="sm" onClick={handleImportHistory} disabled={isImportingHistory} data-testid="button-import-history-costs-embedded">
          <DatabaseBackup className="mr-1 h-3 w-3" /> {isImportingHistory ? 'Importowanie...' : 'Import historii'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowClearAllDialog(true)} data-testid="button-clear-all-costs-embedded">
          <Eraser className="mr-1 h-3 w-3" /> Wyczyść rok {year}
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

      {selectedCell && selectedCellValue !== 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Zaznaczona komórka: <strong>{selectedCellValue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</strong> zł</span>
          <Button variant="outline" size="sm" onClick={handleFillToEnd} data-testid="button-fill-to-end">
            <Copy className="mr-1 h-3 w-3" /> Wypełnij do grudnia
          </Button>
          <span className="text-muted-foreground/60">lub przeciągnij kwadracik w rogu komórki</span>
        </div>
      )}

      <FullscreenWrapper title={`Koszty apartamentów ${year}`} isFullscreen={fullscreen.isFullscreen} onExit={fullscreen.exit}>
        <div className="rounded-md border border-border bg-card overflow-x-auto" data-testid="table-costs-apartments">
        <table className="w-full text-xs border-collapse" style={{ minWidth: "2000px" }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/80 dark:bg-muted/50">
              <th className="sticky left-0 z-30 bg-muted/80 dark:bg-muted/50 border-b border-r border-border px-2 py-1 text-right font-bold w-[220px] min-w-[220px]" rowSpan={2}>
                Pozycja
              </th>
              {MONTHS.map((m, i) => (
                <th key={i} id={`month-col-${i}`} colSpan={3} className={`border-b border-r-2 border-border px-1 py-1 text-center font-bold transition-colors duration-300 ${i === currentMonth && year === currentYear ? "bg-primary/10" : ""} ${highlightMonth === i ? "bg-yellow-200/60 dark:bg-yellow-700/40" : ""}`}>{m}</th>
              ))}
              <th colSpan={3} className="border-b border-border px-1 py-1 text-center font-bold bg-muted dark:bg-muted/70">ROCZNIE</th>
            </tr>
            <tr className="bg-muted/60 dark:bg-muted/40">
              {[...Array(13)].map((_, mi) => (
                <Fragment key={mi}>
                  <th className="border-b border-r border-border px-1 py-1 text-center font-medium text-muted-foreground w-[60px] min-w-[60px]">P</th>
                  <th className="border-b border-r border-border px-1 py-1 text-center font-medium text-muted-foreground w-[60px] min-w-[60px]">R</th>
                  <th className={`border-b border-border px-1 py-1 text-center font-medium text-muted-foreground w-[60px] min-w-[60px] ${mi < 12 ? "border-r-2" : ""}`}>S</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredCostEntries.map((group) => {
              const isCollapsed = collapsed.has(group.location);
              const locYear = getLocationYearTotal(group.items);
              const locYearS = locYear.p - locYear.r;
              return (
                <Fragment key={group.location}>
                  <tr className="bg-muted/60 dark:bg-muted/40 select-none">
                    <td
                      className="sticky left-0 z-20 bg-muted/60 dark:bg-muted/40 px-2 py-1.5 border-r border-b border-border font-bold text-muted-foreground uppercase tracking-wide cursor-pointer"
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
                    <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted dark:bg-muted/70 font-bold">{formatNum(locYear.p)}</td>
                    <td className="border-r border-b border-border px-1 py-1 text-right tabular-nums font-bold bg-muted dark:bg-muted/70">{formatNum(locYear.r)}</td>
                    <td className={`border-b border-border px-1 py-1 text-right tabular-nums font-bold bg-muted dark:bg-muted/70 ${saldoColor(locYearS)}`}>{formatNum(locYearS)}</td>
                  </tr>

                  {!isCollapsed && group.items.map((entry, entryIdx) => {
                    const entryYear = getEntryYearTotal(entry);
                    const entryYearS = entryYear.p - entryYear.r;
                    const entryColor = getEntryColor(entry.id, entryIdx);
                    return (
                      <Fragment key={entry.id}>
                        <tr className={`${entryColor} text-white select-none group`} data-testid={`entry-row-${entry.id}`}>
                          <td className={`sticky left-0 z-20 ${entryColor} px-2 py-1.5 border-r border-b border-border/30 font-bold pl-6`}>
                            <div className="flex items-center gap-1.5">
                              <span
                                className="flex-1 min-w-0 truncate cursor-pointer hover:underline"
                                onClick={() => setApartmentSheet(entry.id)}
                                title="Kliknij aby zobaczyć szczegóły"
                                data-testid={`entry-name-${entry.id}`}
                              >
                                {entry.name}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); openEntryColorDialog(entry.id, entryIdx); }}
                                className="opacity-60 hover:opacity-100 transition-opacity p-0.5 shrink-0"
                                title="Zmień kolor"
                                data-testid={`button-entry-color-${entry.id}`}
                              >
                                <Palette className="h-3 w-3" />
                              </button>
                              <Sparkline data={getEntrySparklineData(entry)} width={50} height={14} color="rgba(255,255,255,0.7)" />
                              <button
                                onClick={() => openCategoryEditor(entry)}
                                className="opacity-60 hover:opacity-100 transition-opacity p-0.5 shrink-0"
                                title="Zarządzaj kategoriami"
                                data-testid={`button-edit-categories-${entry.id}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => { setAddCatEntryId(entry.id); setShowAddCategory(true); }}
                                className="opacity-60 hover:opacity-100 transition-opacity p-0.5 shrink-0"
                                title="Dodaj kategorię"
                                data-testid={`button-add-cat-${entry.id}`}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => setResetEntryDialog({ entryId: entry.id, entryName: entry.name })}
                                className="opacity-70 hover:opacity-100 hover:text-red-300 transition-opacity p-0.5 shrink-0"
                                title="Resetuj dane (usuń wszystkie koszty)"
                                data-testid={`button-reset-entry-${entry.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          {MONTHS.map((_, mi) => {
                            const s = getEntrySums(entry, mi);
                            const saldo = s.p - s.r;
                            return (
                              <Fragment key={mi}>
                                <td className={`border-r border-b border-border/30 px-1 py-1 text-right tabular-nums text-[10px] ${mi === currentMonth && year === currentYear ? "bg-white/10" : ""}`}>{formatNum(s.p)}</td>
                                <td className={`border-r border-b border-border/30 px-1 py-1 text-right tabular-nums font-semibold ${mi === currentMonth && year === currentYear ? "bg-white/10" : ""}`}>{formatNum(s.r)}</td>
                                <td className={`border-r-2 border-b border-border/30 px-1 py-1 text-right tabular-nums font-semibold ${saldo > 0 ? "text-green-200" : saldo < 0 ? "text-red-200" : ""} ${mi === currentMonth && year === currentYear ? "bg-white/10" : ""}`}>{formatNum(saldo)}</td>
                              </Fragment>
                            );
                          })}
                          <td className="border-r border-b border-border/30 px-1 py-1 text-right tabular-nums text-[10px] font-bold">{formatNum(entryYear.p)}</td>
                          <td className="border-r border-b border-border/30 px-1 py-1 text-right tabular-nums font-bold">{formatNum(entryYear.r)}</td>
                          <td className={`border-b border-border/30 px-1 py-1 text-right tabular-nums font-bold ${entryYearS > 0 ? "text-green-200" : entryYearS < 0 ? "text-red-200" : ""}`}>{formatNum(entryYearS)}</td>
                        </tr>

                        {entry.categories.map((cat, catIdx) => {
                          let catYearP = 0, catYearR = 0;
                          for (let m = 0; m < 12; m++) {
                            catYearP += getCellValue(entry.id, cat, m, "p");
                            catYearR += getCellValue(entry.id, cat, m, "r");
                          }
                          const catYearS = catYearP - catYearR;
                          const isDragging = dragCatKey === `${entry.id}__${cat}`;
                          return (
                            <tr
                              key={cat}
                              className={`hover:bg-muted/30 dark:hover:bg-muted/20 select-none group ${isDragging ? "opacity-40" : ""}`}
                              data-testid={`row-category-${entry.id}-${cat}`}
                              onDragOver={(e) => handleCatDragOver(e, entry.id, cat)}
                              onDrop={handleCatDragEnd}
                            >
                              <td className="sticky left-0 z-20 bg-card border-b border-r border-border px-1 py-1">
                                <div className="flex items-center gap-0.5 pl-8">
                                  <span
                                    draggable
                                    onDragStart={() => handleCatDragStart(entry.id, cat)}
                                    onDragEnd={handleCatDragEnd}
                                    className="cursor-grab active:cursor-grabbing text-muted-foreground opacity-40 hover:opacity-100 shrink-0"
                                    data-testid={`drag-category-${entry.id}-${cat}`}
                                  >
                                    <GripVertical className="h-3 w-3" />
                                  </span>
                                  <span
                                    className="truncate flex-1 min-w-0 cursor-pointer hover:underline text-[11px] font-medium text-foreground"
                                    onClick={() => setCategorySheet({ entryId: entry.id, cat })}
                                    title="Kliknij aby zobaczyć szczegóły"
                                    data-testid={`label-category-${entry.id}-${cat}`}
                                  >
                                    {cat}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); openEditCatDialog(entry.id, cat); }}
                                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded shrink-0 text-muted-foreground"
                                    title="Edytuj nazwę / kolor"
                                    data-testid={`btn-edit-cat-${entry.id}-${cat}`}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <Sparkline data={getCatSparklineData(entry.id, cat)} width={40} height={12} color="rgb(239, 68, 68)" />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleArchiveCategory(entry.id, cat); }}
                                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded shrink-0 text-muted-foreground"
                                    title="Archiwizuj"
                                    data-testid={`btn-archive-${entry.id}-${cat}`}
                                  >
                                    <Archive className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm(`Usunąć kategorię "${cat}"?`)) handleDeleteCategory(entry.id, cat);
                                    }}
                                    className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-0.5 rounded shrink-0 text-muted-foreground"
                                    title="Usuń"
                                    data-testid={`btn-delete-${entry.id}-${cat}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                              {MONTHS.map((_, mi) => {
                                const pKey = makeCellKey(entry.id, cat, mi, "p");
                                const rKey = makeCellKey(entry.id, cat, mi, "r");
                                const pVal = getCellValue(entry.id, cat, mi, "p");
                                const rVal = getCellValue(entry.id, cat, mi, "r");
                                const saldo = pVal - rVal;
                                return (
                                  <Fragment key={mi}>
                                    <EditableCell
                                      cellKey={pKey}
                                      value={pVal}
                                      editingCell={editingCell}
                                      editValue={editValue}
                                      setEditValue={setEditValue}
                                      startEditing={startEditing}
                                      commitEdit={commitEdit}
                                      cancelEdit={cancelEdit}
                                      className="text-[10px] text-muted-foreground"
                                      isSelected={selectedCell === pKey}
                                      isInRange={isInFillRange(pKey)}
                                      onCellClick={handleCellClick}
                                      onFillHandleMouseDown={handleFillHandleMouseDown}
                                      onCellMouseEnter={handleCellMouseEnter}
                                      month={mi}
                                    />
                                    <EditableCell
                                      cellKey={rKey}
                                      value={rVal}
                                      editingCell={editingCell}
                                      editValue={editValue}
                                      setEditValue={setEditValue}
                                      startEditing={startEditing}
                                      commitEdit={commitEdit}
                                      cancelEdit={cancelEdit}
                                      className={`font-semibold ${getHeatMapBg(rVal, costsHeatMax, "expense")}`}
                                      isSelected={selectedCell === rKey}
                                      isInRange={isInFillRange(rKey)}
                                      onCellClick={handleCellClick}
                                      onFillHandleMouseDown={handleFillHandleMouseDown}
                                      onCellMouseEnter={handleCellMouseEnter}
                                      month={mi}
                                    />
                                    <td className={`border-b border-r-2 border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)}`}>
                                      {formatNum(saldo)}
                                    </td>
                                  </Fragment>
                                );
                              })}
                              <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/10 dark:bg-muted/5">{formatNum(catYearP)}</td>
                              <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/10 dark:bg-muted/5">{formatNum(catYearR)}</td>
                              <td className={`border-b border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/10 dark:bg-muted/5 ${saldoColor(catYearS)}`}>{formatNum(catYearS)}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}

            <tr className="bg-muted/80 dark:bg-muted/50 font-bold">
              <td className="sticky left-0 z-20 bg-muted/80 dark:bg-muted/50 border-t-2 border-r border-border px-2 py-1 text-right uppercase">SUMA</td>
              {MONTHS.map((_, mi) => {
                let mp = 0, mr = 0;
                filteredCostEntries.forEach(group => { const s = getLocationSums(group.items, mi); mp += s.p; mr += s.r; });
                const ms = mp - mr;
                return (
                  <Fragment key={mi}>
                    <td className={`border-t-2 border-r border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10 ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(mp)}</td>
                    <td className={`border-t-2 border-r border-border px-1 py-1 text-right tabular-nums font-semibold ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(mr)}</td>
                    <td className={`border-t-2 border-r-2 border-border px-1 py-1 text-right tabular-nums ${saldoColor(ms)} ${mi === currentMonth && year === currentYear ? "bg-primary/5" : ""}`}>{formatNum(ms)}</td>
                  </Fragment>
                );
              })}
              <td className="border-t-2 border-r border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted dark:bg-muted/70">{formatNum(grandTotal.p)}</td>
              <td className="border-t-2 border-r border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted dark:bg-muted/70">{formatNum(grandTotal.r)}</td>
              <td className={`border-t-2 border-border px-1 py-1 text-right tabular-nums bg-muted dark:bg-muted/70 ${saldoColor(grandTotal.s)}`}>{formatNum(grandTotal.s)}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </FullscreenWrapper>

      {archivedEntries.length > 0 && (
        <div className="mt-4" data-testid="archived-apartment-costs">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
            data-testid="toggle-archive"
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Archive className="h-4 w-4" />
            ARCHIWUM
            <Badge variant="secondary" className="text-xs">{archivedEntries.reduce((s, e) => s + e.categories.length, 0)}</Badge>
          </button>
          {showArchived && (
            <div className="rounded-md border border-border bg-card overflow-x-auto opacity-60">
              <table className="w-full text-xs border-collapse" style={{ minWidth: "2000px" }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-muted/80 dark:bg-muted/50">
                    <th className="sticky left-0 z-30 bg-muted/80 dark:bg-muted/50 border-b border-r border-border px-2 py-1 text-right font-bold w-[220px] min-w-[220px]" rowSpan={2}>Pozycja</th>
                    {MONTHS.map((m, i) => (
                      <th key={i} colSpan={3} className="border-b border-r-2 border-border px-1 py-1 text-center font-bold">{m}</th>
                    ))}
                    <th colSpan={3} className="border-b border-border px-1 py-1 text-center font-bold bg-muted dark:bg-muted/70">ROCZNIE</th>
                  </tr>
                  <tr className="bg-muted/60 dark:bg-muted/40">
                    {[...Array(13)].map((_, mi) => (
                      <Fragment key={mi}>
                        <th className="border-b border-r border-border px-1 py-1 text-center font-medium text-muted-foreground w-[60px] min-w-[60px]">P</th>
                        <th className="border-b border-r border-border px-1 py-1 text-center font-medium text-muted-foreground w-[60px] min-w-[60px]">R</th>
                        <th className={`border-b border-border px-1 py-1 text-center font-medium text-muted-foreground w-[60px] min-w-[60px] ${mi < 12 ? "border-r-2" : ""}`}>S</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {archivedEntries.map(ae => (
                    <Fragment key={ae.entryId}>
                      <tr className="bg-amber-600/80 dark:bg-amber-700/80 text-white select-none">
                        <td className="sticky left-0 z-20 bg-amber-600/80 dark:bg-amber-700/80 border-b border-r border-border/30 px-1 py-1 font-bold" colSpan={40}>
                          <div className="flex items-center gap-1.5 pl-1">
                            <Archive className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-xs">{ae.entryName}</span>
                            <Badge variant="secondary" className="text-[10px] bg-white/20 text-white border-0">{ae.categories.length}</Badge>
                          </div>
                        </td>
                      </tr>
                      {ae.categories.map(cat => {
                        let catYP = 0, catYR = 0;
                        for (let m = 0; m < 12; m++) {
                          catYP += getCellValue(ae.entryId, cat, m, "p");
                          catYR += getCellValue(ae.entryId, cat, m, "r");
                        }
                        const catYS = catYP - catYR;
                        return (
                          <tr key={cat} className="hover:bg-muted/30 dark:hover:bg-muted/20 group">
                            <td className="sticky left-0 z-20 bg-card border-b border-r border-border px-1 py-1 text-right">
                              <div className="flex items-center gap-0.5 pl-4">
                                <span className="font-medium truncate">{cat}</span>
                                <button
                                  onClick={() => handleRestoreCategory(ae.entryId, cat)}
                                  className="invisible group-hover:visible text-muted-foreground hover:text-emerald-600 p-0.5 shrink-0 ml-auto"
                                  title="Przywróć"
                                  data-testid={`btn-restore-${ae.entryId}-${cat}`}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                            {MONTHS.map((_, mi) => {
                              const pVal = getCellValue(ae.entryId, cat, mi, "p");
                              const rVal = getCellValue(ae.entryId, cat, mi, "r");
                              const saldo = pVal - rVal;
                              return (
                                <Fragment key={mi}>
                                  <td className="border-b border-r border-border bg-muted/20 dark:bg-muted/10 px-1 py-1 text-right tabular-nums text-[10px]">{formatNum(pVal)}</td>
                                  <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums font-semibold">{formatNum(rVal)}</td>
                                  <td className={`border-b border-r-2 border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                                </Fragment>
                              );
                            })}
                            <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums bg-muted/30 dark:bg-muted/20 text-[10px]">{formatNum(catYP)}</td>
                            <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/30 dark:bg-muted/20">{formatNum(catYR)}</td>
                            <td className={`border-b border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/30 dark:bg-muted/20 ${saldoColor(catYS)}`}>{formatNum(catYS)}</td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {compareYear !== null && (() => {
        const yoyChartData = MONTHS.map((name, m) => {
          let mainR = 0, compR = 0;
          filteredCostEntries.forEach(group => {
            group.items.forEach(entry => {
              entry.categories.forEach(cat => {
                const key = getCellKeyOld(entry.id, cat);
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
                  onChange={(e) => { const next = [...editCategories]; next[idx] = e.target.value; setEditCategories(next); }}
                  className="text-sm"
                  data-testid={`input-edit-category-${idx}`}
                />
                <Button size="icon" variant="ghost" onClick={() => removeCategory(idx)} data-testid={`button-remove-category-${idx}`}>
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
              <Button size="icon" variant="ghost" onClick={addCategory} data-testid="button-add-category">
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

      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Dodaj kategorię kosztów</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nazwa kategorii</label>
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="np. UBEZPIECZENIE"
                className="mt-1"
                data-testid="input-new-cat-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kolor</label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {CATEGORY_COLORS.map(c => (
                  <button
                    key={c.value}
                    className={`h-8 rounded-md ${c.value} ${newCatColor === c.value ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    onClick={() => setNewCatColor(c.value)}
                    title={c.label}
                    data-testid={`color-${c.label}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddCategory(false); setAddCatEntryId(null); }}>Anuluj</Button>
            <Button onClick={handleAddCategoryWithColor} data-testid="button-save-new-cat">Dodaj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCatDialog} onOpenChange={(open) => { if (!open) setEditCatDialog(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edytuj kategorię</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nazwa</label>
              <Input
                value={editCatName}
                onChange={(e) => setEditCatName(e.target.value)}
                className="mt-1"
                data-testid="input-edit-cat-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kolor</label>
              <div className="grid grid-cols-5 gap-2 mt-2">
                {CATEGORY_COLORS.map(c => (
                  <button
                    key={c.value}
                    className={`h-8 rounded-md ${c.value} ${editCatColor === c.value ? "ring-2 ring-primary ring-offset-2" : ""}`}
                    onClick={() => setEditCatColor(c.value)}
                    title={c.label}
                    data-testid={`edit-color-${c.label}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCatDialog(null)}>Anuluj</Button>
            <Button onClick={handleSaveEditCat} data-testid="button-save-edit-cat">Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEntryColorDialog} onOpenChange={(open) => { if (!open) setEditEntryColorDialog(null); }}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Kolor apartamentu</DialogTitle>
          </DialogHeader>
          <div>
            <label className="text-sm font-medium">Wybierz kolor</label>
            <div className="grid grid-cols-5 gap-2 mt-3">
              {CATEGORY_COLORS.map(c => (
                <button
                  key={c.value}
                  className={`h-10 rounded-md ${c.value} ${editEntryColor === c.value ? "ring-2 ring-primary ring-offset-2" : ""} transition-all`}
                  onClick={() => setEditEntryColor(c.value)}
                  title={c.label}
                  data-testid={`entry-color-${c.label}`}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntryColorDialog(null)}>Anuluj</Button>
            <Button onClick={handleSaveEntryColor} data-testid="button-save-entry-color">Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!resetEntryDialog} onOpenChange={(open) => { if (!open) setResetEntryDialog(null); }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Resetuj dane apartamentu
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Czy na pewno usunąć wszystkie koszty dla <strong>{resetEntryDialog?.entryName}</strong> za rok <strong>{year}</strong>? Tej operacji nie można cofnąć.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetEntryDialog(null)}>Anuluj</Button>
            <Button variant="destructive" onClick={() => resetEntryDialog && handleResetEntryData(resetEntryDialog.entryId)} data-testid="button-confirm-reset-entry">
              Usuń dane
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCopyToNextYear} onOpenChange={setShowCopyToNextYear}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Kopiuj prognozę na {year + 1}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Wszystkie wartości prognozowane (P) z roku {year} zostaną skopiowane na rok {year + 1}. Istniejące wartości w roku {year + 1} nie zostaną nadpisane.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCopyToNextYear(false)}>Anuluj</Button>
            <Button onClick={handleCopyForecastToNextYear} data-testid="button-confirm-copy">Kopiuj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wyczyść wszystkie koszty za rok {year}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Czy na pewno usunąć <strong>wszystkie dane kosztów apartamentów</strong> za rok <strong>{year}</strong>? Tej operacji nie można cofnąć.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearAllDialog(false)}>Anuluj</Button>
            <Button variant="destructive" onClick={handleClearAll} data-testid="button-confirm-clear-all">
              <Eraser className="h-4 w-4 mr-1" /> Wyczyść rok {year}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sheet apartamentu */}
      <Sheet open={!!apartmentSheet} onOpenChange={(open) => { if (!open) setApartmentSheet(null); }}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto" data-testid="sheet-apartment">
          {(() => {
            if (!apartmentSheet) return null;
            const entry = filteredCostEntries.flatMap(g => g.items).find(e => e.id === apartmentSheet);
            if (!entry) return null;
            const annualTotal = getEntryYearTotal(entry);
            const annualS = annualTotal.p - annualTotal.r;
            const monthP = getEntrySums(entry, currentMonth).p;
            const monthR = getEntrySums(entry, currentMonth).r;
            const monthS = monthP - monthR;
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-lg" data-testid="sheet-apt-title">{entry.name}</SheetTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{year}</Badge>
                    <Button size="sm" variant="outline" onClick={() => { setApartmentSheet(null); const idx = filteredCostEntries.flatMap(g => g.items).findIndex(e => e.id === apartmentSheet); openEntryColorDialog(apartmentSheet, idx >= 0 ? idx : 0); }} data-testid="button-apt-color">
                      <Palette className="h-3 w-3 mr-1" /> Zmień kolor
                    </Button>
                  </div>
                </SheetHeader>
                <div className="mt-6 space-y-5">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">Rok {year}</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center border rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Prognoza</p>
                        <p className="text-base font-bold tabular-nums">{annualTotal.p.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
                      </div>
                      <div className="text-center border rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Zrealizowane</p>
                        <p className="text-base font-bold tabular-nums">{annualTotal.r.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
                        {annualTotal.p > 0 && <p className="text-[10px] text-muted-foreground">{Math.round(annualTotal.r / annualTotal.p * 100)}%</p>}
                      </div>
                      <div className="text-center border rounded-lg p-2">
                        <p className="text-[10px] text-muted-foreground">Saldo</p>
                        <p className={`text-base font-bold tabular-nums ${saldoColor(annualS)}`}>{annualS >= 0 ? "+" : ""}{annualS.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
                      </div>
                    </div>
                  </div>
                  {year === currentYear && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">{MONTHS_PL[currentMonth]}</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center border rounded-lg p-2">
                          <p className="text-[10px] text-muted-foreground">Prognoza</p>
                          <p className="text-base font-bold tabular-nums">{monthP.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
                        </div>
                        <div className="text-center border rounded-lg p-2">
                          <p className="text-[10px] text-muted-foreground">Zrealizowane</p>
                          <p className="text-base font-bold tabular-nums">{monthR.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
                        </div>
                        <div className="text-center border rounded-lg p-2">
                          <p className="text-[10px] text-muted-foreground">Saldo</p>
                          <p className={`text-base font-bold tabular-nums ${saldoColor(monthS)}`}>{monthS >= 0 ? "+" : ""}{monthS.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-2">Kategorie</p>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="text-left p-2 font-medium">Kategoria</th>
                          <th className="text-right p-2 font-medium">Prognoza</th>
                          <th className="text-right p-2 font-medium">Zrealizowane</th>
                          <th className="text-right p-2 font-medium">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.categories.map(cat => {
                          let catP = 0, catR = 0;
                          for (let m = 0; m < 12; m++) { catP += getCellValue(entry.id, cat, m, "p"); catR += getCellValue(entry.id, cat, m, "r"); }
                          const catS = catP - catR;
                          return (
                            <tr key={cat} className="border-b hover:bg-muted/20 cursor-pointer" onClick={() => { setApartmentSheet(null); setCategorySheet({ entryId: entry.id, cat }); }}>
                              <td className="p-2 font-medium">{cat}</td>
                              <td className="p-2 text-right tabular-nums">{catP > 0 ? catP.toLocaleString("pl-PL", { minimumFractionDigits: 2 }) : "—"}</td>
                              <td className="p-2 text-right tabular-nums">{catR > 0 ? catR.toLocaleString("pl-PL", { minimumFractionDigits: 2 }) : "—"}</td>
                              <td className={`p-2 text-right tabular-nums ${saldoColor(catS)}`}>{catS !== 0 ? `${catS >= 0 ? "+" : ""}${catS.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}` : "—"}</td>
                            </tr>
                          );
                        })}
                        <tr className="font-bold border-t-2">
                          <td className="p-2">Razem</td>
                          <td className="p-2 text-right tabular-nums">{annualTotal.p.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</td>
                          <td className="p-2 text-right tabular-nums">{annualTotal.r.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</td>
                          <td className={`p-2 text-right tabular-nums ${saldoColor(annualS)}`}>{annualS >= 0 ? "+" : ""}{annualS.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Sheet kategorii */}
      <Sheet open={!!categorySheet} onOpenChange={(open) => { if (!open) setCategorySheet(null); }}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto" data-testid="sheet-category">
          {(() => {
            if (!categorySheet) return null;
            const { entryId, cat } = categorySheet;
            const entry = filteredCostEntries.flatMap(g => g.items).find(e => e.id === entryId);
            let totalP = 0, totalR = 0;
            for (let m = 0; m < 12; m++) { totalP += getCellValue(entryId, cat, m, "p"); totalR += getCellValue(entryId, cat, m, "r"); }
            const totalS = totalP - totalR;
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="text-lg" data-testid="sheet-cat-title">{cat}</SheetTitle>
                  {entry && <Badge variant="secondary" className="w-fit">{entry.name}</Badge>}
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center border rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">Prognoza {year}</p>
                      <p className="text-base font-bold tabular-nums">{totalP.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
                    </div>
                    <div className="text-center border rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">Zrealizowane</p>
                      <p className="text-base font-bold tabular-nums">{totalR.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
                      {totalP > 0 && <p className="text-[10px] text-muted-foreground">{Math.round(totalR / totalP * 100)}%</p>}
                    </div>
                    <div className="text-center border rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">Saldo</p>
                      <p className={`text-base font-bold tabular-nums ${saldoColor(totalS)}`}>{totalS >= 0 ? "+" : ""}{totalS.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
                    </div>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-2 font-medium">Miesiąc</th>
                        <th className="text-right p-2 font-medium">Prognoza</th>
                        <th className="text-right p-2 font-medium">Zrealizowane</th>
                        <th className="text-right p-2 font-medium">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {MONTHS.map((m, mi) => {
                        const mP = getCellValue(entryId, cat, mi, "p");
                        const mR = getCellValue(entryId, cat, mi, "r");
                        const mS = mP - mR;
                        return (
                          <tr key={mi} className={`border-b ${mi === currentMonth && year === currentYear ? "bg-cyan-50/40 dark:bg-cyan-950/10" : ""}`}>
                            <td className="p-2 font-medium">{MONTHS_PL[mi]}</td>
                            <td className="p-2 text-right tabular-nums">{mP > 0 ? mP.toLocaleString("pl-PL", { minimumFractionDigits: 2 }) : "—"}</td>
                            <td className="p-2 text-right tabular-nums">{mR > 0 ? mR.toLocaleString("pl-PL", { minimumFractionDigits: 2 }) : "—"}</td>
                            <td className={`p-2 text-right tabular-nums ${saldoColor(mS)}`}>{mS !== 0 ? `${mS >= 0 ? "+" : ""}${mS.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}` : "—"}</td>
                          </tr>
                        );
                      })}
                      <tr className="font-bold border-t-2 bg-muted/20">
                        <td className="p-2">Razem</td>
                        <td className="p-2 text-right tabular-nums">{totalP.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 text-right tabular-nums">{totalR.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</td>
                        <td className={`p-2 text-right tabular-nums ${saldoColor(totalS)}`}>{totalS >= 0 ? "+" : ""}{totalS.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function CostsApartments() {
  return <CostsApartmentsContent />;
}
