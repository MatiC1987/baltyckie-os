import { useState, useMemo, useCallback, useEffect, Fragment, useRef } from "react";
import type React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth-token";
import type { Apartment, Location } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronDown, ChevronRight, ChevronLeft, Plus, X, Calculator,
  BarChart3, GripVertical, Trash2, Pencil, Archive, RotateCcw,
  Copy, ArrowRight, Eraser, DatabaseBackup, Palette, MoreHorizontal,
  Download, FileSpreadsheet, MessageSquare, ArrowDown, ArrowUp,
  Building2, MapPin, Undo2, Redo2, TrendingUp, Zap, Home,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { Sparkline } from "@/components/DataVizHelpers";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { FullscreenWrapper, useFullscreen, FullscreenToggleButton } from "@/components/FullscreenWrapper";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const MONTHS_PL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

const CATEGORY_COLORS = [
  { label: "Niebieski", value: "#2563eb" },
  { label: "Czerwony", value: "#dc2626" },
  { label: "Fioletowy", value: "#9333ea" },
  { label: "Zielony", value: "#059669" },
  { label: "Bursztynowy", value: "#d97706" },
  { label: "Różowy", value: "#db2777" },
  { label: "Błękitny", value: "#0891b2" },
  { label: "Szary", value: "#475569" },
  { label: "Indygo", value: "#4f46e5" },
  { label: "Pomarańczowy", value: "#ea580c" },
];

function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function getCatBgColor(colorVal: string): string {
  if (isHexColor(colorVal)) return colorVal;
  const map: Record<string, string> = {
    "bg-blue-600 dark:bg-blue-700": "#2563eb",
    "bg-red-600 dark:bg-red-700": "#dc2626",
    "bg-purple-600 dark:bg-purple-700": "#9333ea",
    "bg-emerald-600 dark:bg-emerald-700": "#059669",
    "bg-amber-600 dark:bg-amber-700": "#d97706",
    "bg-pink-600 dark:bg-pink-700": "#db2777",
    "bg-cyan-600 dark:bg-cyan-700": "#0891b2",
    "bg-slate-600 dark:bg-slate-700": "#475569",
    "bg-indigo-600 dark:bg-indigo-700": "#4f46e5",
    "bg-orange-600 dark:bg-orange-700": "#ea580c",
  };
  return map[colorVal] || "#2563eb";
}

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

function formatNumCompact(v: number): string {
  if (v === 0) return "—";
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + "k";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function saldoColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "";
}

function saldoBg(v: number): string {
  if (v > 0) return "bg-emerald-50 dark:bg-emerald-950/30";
  if (v < 0) return "bg-red-50 dark:bg-red-950/30";
  return "";
}

type CellData = { p: number; r: number };
type DataMap = Record<string, Record<number, CellData>>;
type NotesMap = Record<string, string>;
type CategoriesMap = Record<string, string[]>;
type ColorMap = Record<string, Record<string, { color: string; archived?: boolean }>>;
type EntryColorMap = Record<string, string>;
type SortOrderMap = Record<string, string[]>;

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

async function dbBulkSaveCells(cells: { year: number; entryId: string; category: string; month: number; prognoza: string; realized: string; note?: string | null }[]) {
  if (cells.length === 0) return;
  const CHUNK = 500;
  for (let i = 0; i < cells.length; i += CHUNK) {
    await fetch('/api/apt-cost-data/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, credentials: 'include',
      body: JSON.stringify({ cells: cells.slice(i, i + CHUNK) }),
    });
  }
}
async function dbSaveSettings(entryId: string, settings: Partial<{ categories: string[]; colors: Record<string, { color: string; archived?: boolean }>; entryColor: string; sortOrder: string[] }>) {
  await fetch(`/api/apt-cost-settings/${entryId}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, credentials: 'include',
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

type UndoAction = { type: "cell"; key: string; month: number; field: "p" | "r"; oldValue: number; newValue: number; entryId: string; category: string };

function TransposedEditableCell({
  value, isEditing, editValue, onStartEdit, onCommitEdit, onCancelEdit, onEditValueChange,
  isCurrentMonth, className = "", flashKey, onKeyDown, cellRef, note, compareValue, onCommitAndMoveDown, onFillToEnd,
}: {
  value: number; isEditing: boolean; editValue: string;
  onStartEdit: () => void; onCommitEdit: () => void; onCancelEdit: () => void;
  onEditValueChange: (v: string) => void;
  isCurrentMonth?: boolean; className?: string; flashKey?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void; cellRef?: React.Ref<HTMLTableCellElement>;
  note?: string; compareValue?: number; onCommitAndMoveDown?: () => void; onFillToEnd?: () => void;
}) {
  const [flash, setFlash] = useState(false);
  const prevFlashKey = useRef(flashKey);
  useEffect(() => {
    if (flashKey && flashKey !== prevFlashKey.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 600);
      prevFlashKey.current = flashKey;
      return () => clearTimeout(t);
    }
  }, [flashKey]);

  return (
    <td
      ref={cellRef}
      className={`group/cell border-b border-r border-border/60 px-1.5 py-1 text-right tabular-nums relative select-none transition-colors duration-200
        ${isCurrentMonth ? "bg-primary/[0.04]" : ""}
        ${flash ? "!bg-emerald-200/60 dark:!bg-emerald-800/40" : ""}
        ${className}`}
      onDoubleClick={onStartEdit}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); onStartEdit(); }
        onKeyDown?.(e);
      }}
    >
      {isEditing ? (
        <input
          type="number"
          autoFocus
          className="w-full h-full px-1 py-0 text-right text-[11px] tabular-nums bg-primary/5 outline-none border-0 rounded"
          value={editValue}
          onChange={(e) => onEditValueChange(e.target.value)}
          onBlur={onCommitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); if (onCommitAndMoveDown) onCommitAndMoveDown(); else onCommitEdit(); }
            if (e.key === "Escape") onCancelEdit();
            if (e.key === "Tab") { e.preventDefault(); onCommitEdit(); }
          }}
        />
      ) : (
        <div className="flex items-center gap-0.5">
          {onFillToEnd && value !== 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); onFillToEnd(); }}
              className="opacity-0 group-hover/cell:opacity-100 transition-opacity text-muted-foreground/40 hover:text-primary shrink-0"
              title="Wypełnij do końca roku"
              data-testid="button-fill-to-end"
            >
              <ArrowDown className="h-2.5 w-2.5" />
            </button>
          )}
          <div className="flex flex-col items-end gap-0 flex-1">
            <span className="min-h-[18px] cursor-cell">{formatNum(value)}</span>
            {compareValue !== undefined && compareValue !== 0 && (
              <span className="text-[9px] text-muted-foreground/60">{formatNum(compareValue)}</span>
            )}
          </div>
        </div>
      )}
      {note && (
        <div className="absolute top-0 right-0 w-0 h-0 border-t-[6px] border-t-amber-400 border-l-[6px] border-l-transparent" title={note} />
      )}
    </td>
  );
}

export function CostsApartmentsContent({ embedded = false, externalYear, onTotalsChange, onMonthlyDataChange, triggerMonthHighlight, onMonthHighlightDone }: { embedded?: boolean; externalYear?: number; onTotalsChange?: (prognoza: number, realized: number) => void; onMonthlyDataChange?: (data: Array<{p: number, r: number}>) => void; triggerMonthHighlight?: number | null; onMonthHighlightDone?: () => void }) {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const queryClient = useQueryClient();
  const [year, setYear] = useState(externalYear ?? currentYear);
  const [data, setData] = useState<DataMap>({});
  const [notesMap, setNotesMap] = useState<NotesMap>({});
  const [categoriesMap, setCategoriesMap] = useState<CategoriesMap>({});
  const [colorMap, setColorMap] = useState<ColorMap>({});
  const [entryColorMap, setEntryColorMap] = useState<EntryColorMap>({});
  const [sortOrderMap, setSortOrderMap] = useState<SortOrderMap>({});
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [isImportingHistory, setIsImportingHistory] = useState(false);
  const { toast } = useToast();

  const [hasPendingEdits, setHasPendingEdits] = useState(false);

  const [drillLevel, setDrillLevel] = useState<"locations" | "apartments" | "table">("locations");
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const [showYoY, setShowYoY] = useState(false);
  const [showBulkCopy, setShowBulkCopy] = useState(false);
  const [bulkCopySource, setBulkCopySource] = useState(0);
  const [bulkCopyStart, setBulkCopyStart] = useState(1);
  const [bulkCopyEnd, setBulkCopyEnd] = useState(11);
  const [bulkCopyFields, setBulkCopyFields] = useState<"p" | "r" | "both">("both");
  const [showForecast, setShowForecast] = useState(false);
  const [forecastMethod, setForecastMethod] = useState<"avg" | "prev" | "recent">("avg");
  const [forecastPreview, setForecastPreview] = useState<Array<{ cat: string; month: number; oldVal: number; newVal: number }> | null>(null);
  const [cellNoteDialog, setCellNoteDialog] = useState<{ entryId: string; category: string; month: number } | null>(null);
  const [cellNoteText, setCellNoteText] = useState("");
  const [savedFlashKeys, setSavedFlashKeys] = useState<Set<string>>(new Set());
  const flashCounter = useRef(0);

  const undoStack = useRef<UndoAction[]>([]);
  const redoStack = useRef<UndoAction[]>([]);

  const { data: aptCostRows, isLoading: isLoadingCostData } = useQuery<any[]>({
    queryKey: ['/api/apt-cost-data', year],
    queryFn: async () => {
      const res = await fetch(`/api/apt-cost-data?year=${year}`, { credentials: 'include', headers: { ...getAuthHeaders() } });
      if (!res.ok) throw new Error('Failed to load apt cost data');
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: hasPendingEdits ? false : 30000,
  });
  const { data: compareCostRows } = useQuery<any[]>({
    queryKey: ['/api/apt-cost-data', compareYear],
    queryFn: async () => {
      if (compareYear === null) return [];
      const res = await fetch(`/api/apt-cost-data?year=${compareYear}`, { credentials: 'include', headers: { ...getAuthHeaders() } });
      if (!res.ok) throw new Error('Failed to load compare cost data');
      return res.json();
    },
    enabled: compareYear !== null,
    staleTime: 30000,
  });
  const { data: settingsRows } = useQuery<any[]>({
    queryKey: ['/api/apt-cost-settings'],
    queryFn: async () => {
      const res = await fetch('/api/apt-cost-settings', { credentials: 'include', headers: { ...getAuthHeaders() } });
      if (!res.ok) throw new Error('Failed to load apt cost settings');
      return res.json();
    },
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const pendingCellsRef = useRef<Map<string, { year: number; entryId: string; category: string; month: number; prognoza: string; realized: string }>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingCells = useCallback(async () => {
    if (pendingCellsRef.current.size === 0) { setHasPendingEdits(false); return; }
    const cells = Array.from(pendingCellsRef.current.values());
    const cellKeys = Array.from(pendingCellsRef.current.keys());
    pendingCellsRef.current.clear();
    try {
      await dbBulkSaveCells(cells);
      queryClient.invalidateQueries({ queryKey: ['/api/apt-cost-data', year] });
      flashCounter.current += 1;
      const newFlash = new Set(cellKeys.map(k => `${k}__${flashCounter.current}`));
      setSavedFlashKeys(newFlash);
      setTimeout(() => setSavedFlashKeys(new Set()), 700);
    } catch (err) { console.error('Błąd zapisu komórek:', err); }
    setHasPendingEdits(false);
  }, [year, queryClient]);

  useEffect(() => {
    if (!aptCostRows) return;
    if (pendingCellsRef.current.size > 0) return;
    const m: DataMap = {};
    const n: NotesMap = {};
    for (const r of aptCostRows) {
      const key = `${r.entryId}__${r.category}`;
      if (!m[key]) m[key] = {};
      m[key][r.month] = { p: parseFloat(r.prognoza ?? '0'), r: parseFloat(r.realized ?? '0') };
      if (r.note) n[`${r.entryId}__${r.category}__${r.month}`] = r.note;
    }
    setData(m);
    setNotesMap(n);
  }, [aptCostRows]);

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

  const [editEntryColorDialog, setEditEntryColorDialog] = useState<string | null>(null);
  const [editEntryColor, setEditEntryColor] = useState("");

  const [resetEntryDialog, setResetEntryDialog] = useState<{ entryId: string; entryName: string } | null>(null);
  const [apartmentSheet, setApartmentSheet] = useState<string | null>(null);
  const [categorySheet, setCategorySheet] = useState<{ entryId: string; cat: string } | null>(null);
  const [highlightMonth, setHighlightMonth] = useState<number | null>(null);

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
      await fetch(`/api/apt-cost-data?year=${year}`, { method: 'DELETE', credentials: 'include', headers: { ...getAuthHeaders() } });
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

  const selectedEntry = useMemo(() => {
    if (!selectedEntryId) return null;
    for (const group of costEntries) {
      const found = group.items.find(e => e.id === selectedEntryId);
      if (found) return found;
    }
    return null;
  }, [selectedEntryId, costEntries]);

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

  const handleCellChange = useCallback((entryId: string, category: string, month: number, field: "p" | "r", value: string, skipUndo = false) => {
    const key = getCellKeyOld(entryId, category);
    if (!skipUndo) {
      const oldValue = data[key]?.[month]?.[field] || 0;
      undoStack.current.push({ type: "cell", key, month, field, oldValue, newValue: parseFloat(value) || 0, entryId, category });
      redoStack.current = [];
    }
    setHasPendingEdits(true);
    setData(prev => {
      const next = { ...prev };
      if (!next[key]) next[key] = {};
      if (!next[key][month]) next[key][month] = { p: 0, r: 0 };
      const newCell = { ...next[key][month], [field]: parseFloat(value) || 0 };
      next[key][month] = newCell;
      const cellKey = `${year}__${entryId}__${category}__${month}`;
      pendingCellsRef.current.set(cellKey, { year, entryId, category, month, prognoza: String(newCell.p), realized: String(newCell.r) });
      return next;
    });
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(flushPendingCells, 600);
  }, [year, flushPendingCells, data]);

  const handleUndo = useCallback(() => {
    const action = undoStack.current.pop();
    if (!action) return;
    redoStack.current.push(action);
    handleCellChange(action.entryId, action.category, action.month, action.field, String(action.oldValue), true);
  }, [handleCellChange]);

  const handleRedo = useCallback(() => {
    const action = redoStack.current.pop();
    if (!action) return;
    undoStack.current.push(action);
    handleCellChange(action.entryId, action.category, action.month, action.field, String(action.newValue), true);
  }, [handleCellChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

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

  const handleFillToEnd = useCallback((entryId: string, category: string, month: number, field: "p" | "r") => {
    const sourceVal = getCellValue(entryId, category, month, field);
    for (let m = month; m < 12; m++) {
      handleCellChange(entryId, category, m, field, sourceVal.toString());
    }
    toast({ title: "Wypełniono", description: `Wartość skopiowana do grudnia` });
  }, [getCellValue, handleCellChange, toast]);

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

  const handleYearChange = (y: string) => {
    const newYear = Number(y);
    setYear(newYear);
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
      await fetch(`/api/apt-cost-data?year=${year}&entryId=${entryId}`, { method: 'DELETE', credentials: 'include', headers: { ...getAuthHeaders() } });
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

  const allEntriesTotal = useMemo(() => {
    let p = 0, r = 0;
    costEntries.forEach(group => { const s = getLocationYearTotal(group.items); p += s.p; r += s.r; });
    return { p, r };
  }, [costEntries, getLocationYearTotal]);

  const allEntriesMonthlyTotals = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      let p = 0, r = 0;
      costEntries.forEach(group => { const s = getLocationSums(group.items, m); p += s.p; r += s.r; });
      return { p, r };
    });
  }, [costEntries, getLocationSums]);

  useEffect(() => {
    onTotalsChange?.(allEntriesTotal.p, allEntriesTotal.r);
  }, [allEntriesTotal.p, allEntriesTotal.r]);

  useEffect(() => {
    if (!onMonthlyDataChange) return;
    onMonthlyDataChange(allEntriesMonthlyTotals);
  }, [allEntriesMonthlyTotals]);

  useEffect(() => {
    if (triggerMonthHighlight === null || triggerMonthHighlight === undefined) return;
    setHighlightMonth(triggerMonthHighlight);
    const timer = setTimeout(() => {
      setHighlightMonth(null);
      onMonthHighlightDone?.();
    }, 2000);
    return () => clearTimeout(timer);
  }, [triggerMonthHighlight]);

  const [showChart, setShowChart] = useState(false);
  const fullscreen = useFullscreen();

  const handleImportHistory = useCallback(async () => {
    setIsImportingHistory(true);
    try {
      const resp = await fetch('/api/apt-cost-data/seed', { method: 'POST', credentials: 'include', headers: { ...getAuthHeaders() } });
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

  const handleExcelExport = useCallback(() => {
    const params = new URLSearchParams({ year: String(year) });
    if (selectedEntry) params.set('entryId', selectedEntry.id);
    window.open(`/api/apt-cost-data/export-excel?${params.toString()}`, '_blank');
  }, [year, selectedEntry]);

  const handleBulkCopy = useCallback(() => {
    if (!selectedEntry) return;
    if (bulkCopyStart > bulkCopyEnd) {
      toast({ title: "Błąd zakresu", description: "Miesiąc początkowy musi być przed końcowym", variant: "destructive" });
      return;
    }
    const entry = selectedEntry;
    for (let m = bulkCopyStart; m <= bulkCopyEnd; m++) {
      entry.categories.forEach(cat => {
        if (bulkCopyFields === "p" || bulkCopyFields === "both") {
          const val = getCellValue(entry.id, cat, bulkCopySource, "p");
          handleCellChange(entry.id, cat, m, "p", String(val));
        }
        if (bulkCopyFields === "r" || bulkCopyFields === "both") {
          const val = getCellValue(entry.id, cat, bulkCopySource, "r");
          handleCellChange(entry.id, cat, m, "r", String(val));
        }
      });
    }
    setShowBulkCopy(false);
    toast({ title: "Skopiowano", description: `Dane z ${MONTHS[bulkCopySource]} skopiowane na miesiące ${MONTHS[bulkCopyStart]}–${MONTHS[bulkCopyEnd]}` });
  }, [selectedEntry, bulkCopySource, bulkCopyStart, bulkCopyEnd, bulkCopyFields, getCellValue, handleCellChange, toast]);

  const generateForecastPreview = useCallback(() => {
    if (!selectedEntry) return;
    const entry = selectedEntry;
    const preview: Array<{ cat: string; month: number; oldVal: number; newVal: number }> = [];
    entry.categories.forEach(cat => {
      for (let m = 0; m < 12; m++) {
        const currentP = getCellValue(entry.id, cat, m, "p");
        if (currentP !== 0) continue;
        let forecastVal = 0;
        if (forecastMethod === "avg" && compareYear !== null) {
          const compKey = getCellKeyOld(entry.id, cat);
          let total = 0, count = 0;
          for (let pm = 0; pm < 12; pm++) {
            const v = compareData[compKey]?.[pm]?.r || 0;
            if (v > 0) { total += v; count++; }
          }
          forecastVal = count > 0 ? total / count : 0;
        } else if (forecastMethod === "prev" && compareYear !== null) {
          const compKey = getCellKeyOld(entry.id, cat);
          forecastVal = compareData[compKey]?.[m]?.r || 0;
        } else if (forecastMethod === "recent") {
          const vals: number[] = [];
          for (let pm = Math.max(0, m - 3); pm < m; pm++) {
            const v = getCellValue(entry.id, cat, pm, "r");
            if (v > 0) vals.push(v);
          }
          forecastVal = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        }
        if (forecastVal > 0) {
          preview.push({ cat, month: m, oldVal: currentP, newVal: Math.round(forecastVal * 100) / 100 });
        }
      }
    });
    setForecastPreview(preview);
  }, [selectedEntry, forecastMethod, compareYear, compareData, getCellValue]);

  const handleAutoForecast = useCallback(() => {
    if (!forecastPreview || !selectedEntry) return;
    for (const item of forecastPreview) {
      handleCellChange(selectedEntry.id, item.cat, item.month, "p", String(item.newVal));
    }
    setShowForecast(false);
    setForecastPreview(null);
    toast({ title: "Prognoza wygenerowana", description: `Uzupełniono ${forecastPreview.length} pustych komórek P dla ${selectedEntry.name}` });
  }, [selectedEntry, forecastPreview, handleCellChange, toast]);

  const handleSaveNote = useCallback(async () => {
    if (!cellNoteDialog) return;
    const { entryId, category, month } = cellNoteDialog;
    const noteKey = `${entryId}__${category}__${month}`;
    setNotesMap(prev => ({ ...prev, [noteKey]: cellNoteText }));
    const key = getCellKeyOld(entryId, category);
    const cell = data[key]?.[month] || { p: 0, r: 0 };
    await dbBulkSaveCells([{ year, entryId, category, month, prognoza: String(cell.p), realized: String(cell.r), note: cellNoteText === "" ? "" : cellNoteText }]);
    setCellNoteDialog(null);
    toast({ title: "Notatka zapisana" });
  }, [cellNoteDialog, cellNoteText, data, year, toast]);

  const grandTotal = useMemo(() => {
    let p = 0, r = 0;
    costEntries.forEach(group => { const s = getLocationYearTotal(group.items); p += s.p; r += s.r; });
    return { p, r, s: p - r };
  }, [costEntries, getLocationYearTotal]);

  const currentMonthTotals = useMemo(() => {
    let p = 0, r = 0;
    costEntries.forEach(group => { const s = getLocationSums(group.items, currentMonth); p += s.p; r += s.r; });
    return { p, r, s: p - r };
  }, [costEntries, getLocationSums, currentMonth]);

  const getEntrySparklineData = useCallback((entry: CostEntry): number[] => {
    return Array.from({ length: 12 }, (_, m) => getEntrySums(entry, m).r);
  }, [getEntrySums]);

  const monthlyCostChart = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      let p = 0, r = 0;
      costEntries.forEach(group => { const s = getLocationSums(group.items, m); p += s.p; r += s.r; });
      return { name: MONTHS[m], Prognoza: Math.round(p), Rzeczywiste: Math.round(r) };
    });
  }, [costEntries, getLocationSums]);

  const selectedLocationGroup = useMemo(() => {
    if (!selectedLocation) return null;
    return costEntries.find(g => g.location === selectedLocation) || null;
  }, [selectedLocation, costEntries]);

  const navigateToLocation = (loc: string) => {
    setSelectedLocation(loc);
    setSelectedEntryId(null);
    setDrillLevel("apartments");
  };

  const navigateToEntry = (entry: CostEntry) => {
    setSelectedEntryId(entry.id);
    setDrillLevel("table");
  };

  const navigateBack = () => {
    if (drillLevel === "table") {
      setSelectedEntryId(null);
      setDrillLevel("apartments");
    } else if (drillLevel === "apartments") {
      setSelectedLocation(null);
      setDrillLevel("locations");
    }
  };

  const navigateHome = () => {
    setSelectedEntryId(null);
    setSelectedLocation(null);
    setDrillLevel("locations");
  };

  const renderBreadcrumb = () => {
    if (drillLevel === "locations") return null;
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3" data-testid="breadcrumb-nav">
        <button onClick={navigateHome} className="hover:text-foreground transition-colors flex items-center gap-1" data-testid="breadcrumb-home">
          <Home className="h-3.5 w-3.5" /> Lokalizacje
        </button>
        {selectedLocation && (
          <>
            <ChevronRight className="h-3 w-3" />
            <button onClick={() => { setSelectedEntryId(null); setDrillLevel("apartments"); }} className="hover:text-foreground transition-colors" data-testid="breadcrumb-location">
              {selectedLocation}
            </button>
          </>
        )}
        {selectedEntry && (
          <>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium" data-testid="breadcrumb-entry">{selectedEntry.name}</span>
          </>
        )}
      </div>
    );
  };

  const renderLocationTiles = () => {
    if (isLoadingCostData) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="location-tiles">
        {costEntries.map((group, gi) => {
          const yearTot = getLocationYearTotal(group.items);
          const saldo = yearTot.p - yearTot.r;
          const pct = yearTot.p > 0 ? Math.round(yearTot.r / yearTot.p * 100) : 0;
          const monthTot = getLocationSums(group.items, currentMonth);
          return (
            <Card
              key={group.location}
              className="group cursor-pointer hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 overflow-hidden"
              onClick={() => navigateToLocation(group.location)}
              data-testid={`tile-location-${group.location.replace(/\s+/g, "-").toLowerCase()}`}
            >
              <div className="h-1.5 w-full" style={{ backgroundColor: CATEGORY_COLORS[gi % CATEGORY_COLORS.length].value }} />
              <CardContent className="pt-4 pb-4 px-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg text-white" style={{ backgroundColor: CATEGORY_COLORS[gi % CATEGORY_COLORS.length].value }}>
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm" data-testid={`location-name-${group.location}`}>{group.location}</h3>
                      <p className="text-xs text-muted-foreground">{group.items.length} {group.items.length === 1 ? "pozycja" : group.items.length < 5 ? "pozycje" : "pozycji"}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Budżet roczny</span>
                    <span className="font-semibold tabular-nums">{formatNumCompact(yearTot.p)} zł</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Zrealizowane: <span className="font-medium">{pct}%</span></span>
                    <span className={`font-semibold tabular-nums ${saldoColor(saldo)}`}>{saldo >= 0 ? "+" : ""}{formatNumCompact(saldo)} zł</span>
                  </div>
                  {year === currentYear && (
                    <div className="flex justify-between text-xs pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">{MONTHS[currentMonth]}: R</span>
                      <span className="font-semibold tabular-nums">{formatNumCompact(monthTot.r)} zł</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const renderApartmentTiles = () => {
    if (!selectedLocationGroup) return null;
    const items = selectedLocationGroup.items;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={navigateBack} data-testid="button-back-to-locations">
            <ChevronLeft className="h-4 w-4 mr-1" /> Wróć
          </Button>
          <h2 className="text-lg font-bold">{selectedLocation}</h2>
          <Badge variant="secondary">{items.length} {items.length === 1 ? "pozycja" : items.length < 5 ? "pozycje" : "pozycji"}</Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" data-testid="apartment-tiles">
          {items.map((entry, ei) => {
            const yearTot = getEntryYearTotal(entry);
            const saldo = yearTot.p - yearTot.r;
            const pct = yearTot.p > 0 ? Math.round(yearTot.r / yearTot.p * 100) : 0;
            const entryColor = getEntryColor(entry.id, ei);
            return (
              <Card
                key={entry.id}
                className="group cursor-pointer hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30 transition-all duration-300 overflow-hidden"
                onClick={() => navigateToEntry(entry)}
                data-testid={`tile-apartment-${entry.id}`}
              >
                <div className="h-1 w-full" style={{ backgroundColor: getCatBgColor(entryColor) }} />
                <CardContent className="pt-3 pb-3 px-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="p-1.5 rounded-md text-white shrink-0" style={{ backgroundColor: getCatBgColor(entryColor) }}>
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <h3 className="font-bold text-sm truncate" data-testid={`apartment-name-${entry.id}`}>{entry.name}</h3>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-1" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkline data={getEntrySparklineData(entry)} width={80} height={20} color="rgb(99, 102, 241)" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct > 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">R: {formatNumCompact(yearTot.r)} / P: {formatNumCompact(yearTot.p)}</span>
                      <span className={`font-semibold ${saldoColor(saldo)}`}>{saldo >= 0 ? "+" : ""}{formatNumCompact(saldo)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTransposedTable = () => {
    if (!selectedEntry) return null;
    const entry = selectedEntry;
    const cats = entry.categories;

    const renderCategoryCard = (cat: string, isSummary = false) => {
      let catYearP = 0, catYearR = 0;
      const catColorRaw = !isSummary ? (colorMap[entry.id]?.[cat]?.color || "") : "";
      const catHex = catColorRaw ? getCatBgColor(catColorRaw) : "";
      const headerBg = isSummary ? 'hsl(var(--sidebar))' : catHex || 'hsl(var(--sidebar))';
      const headerFg = '#ffffff';
      return (
        <Card className={`overflow-hidden flex flex-col ${isSummary ? "ring-2 ring-sidebar" : "border-sidebar-border"}`} style={{ borderColor: isSummary ? 'hsl(var(--sidebar))' : 'hsl(var(--sidebar))' }} data-testid={isSummary ? "card-category-summary" : `card-category-${cat.replace(/\s+/g, "-").toLowerCase()}`}>
          <CardHeader className="px-3 py-2" style={{ backgroundColor: headerBg, color: headerFg, minHeight: '40px' }}>
            <div className="flex items-center justify-between gap-2" style={{ minHeight: '24px' }}>
              <CardTitle className="text-xs font-bold leading-tight" style={{ color: headerFg }} data-testid={isSummary ? "card-title-summary" : `card-title-${cat}`}>
                {isSummary ? "RAZEM" : cat}
              </CardTitle>
              {!isSummary && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-1 rounded hover:bg-white/10 shrink-0" style={{ color: 'hsl(var(--sidebar-foreground))' }} data-testid={`btn-options-${entry.id}-${cat}`}>
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[140px]">
                    <DropdownMenuItem onClick={() => openEditCatDialog(entry.id, cat)} data-testid={`btn-edit-cat-${entry.id}-${cat}`}>
                      <Pencil className="h-3 w-3 mr-2" /> Edytuj
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleArchiveCategory(entry.id, cat)} data-testid={`btn-archive-${entry.id}-${cat}`}>
                      <Archive className="h-3 w-3 mr-2" /> Archiwizuj
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { if (window.confirm(`Usunąć kategorię "${cat}"?`)) handleDeleteCategory(entry.id, cat); }} className="text-destructive" data-testid={`btn-delete-${entry.id}-${cat}`}>
                      <Trash2 className="h-3 w-3 mr-2" /> Usuń
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1" style={isSummary ? { backgroundColor: 'hsl(var(--sidebar) / 0.95)' } : undefined}>
            <table className="w-full text-[11px] sm:text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '60px' }} />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr style={isSummary ? { backgroundColor: 'hsl(var(--sidebar) / 0.8)' } : { backgroundColor: 'hsl(var(--sidebar) / 0.08)' }}>
                  <th className={`border-b border-r px-2 py-1 text-left font-medium text-[10px] ${isSummary ? "border-sidebar-border/30" : "border-border text-muted-foreground"}`} style={isSummary ? { color: 'hsl(var(--sidebar-foreground) / 0.5)' } : undefined}>Mies.</th>
                  <th className={`border-b border-r px-1 py-1 text-center font-medium text-[10px] ${isSummary ? "border-sidebar-border/30" : "border-border/60 text-muted-foreground"}`} style={isSummary ? { color: 'hsl(var(--sidebar-foreground) / 0.5)' } : undefined}>P</th>
                  <th className={`border-b border-r px-1 py-1 text-center font-medium text-[10px] ${isSummary ? "border-sidebar-border/30" : "border-border/60 text-muted-foreground"}`} style={isSummary ? { color: 'hsl(var(--sidebar-foreground) / 0.5)' } : undefined}>R</th>
                  <th className={`border-b px-1 py-1 text-center font-medium text-[10px] ${isSummary ? "border-sidebar-border/30" : "border-border text-muted-foreground"}`} style={isSummary ? { color: 'hsl(var(--sidebar-foreground) / 0.5)' } : undefined}>S</th>
                </tr>
              </thead>
              <tbody>
                {MONTHS.map((monthLabel, mi) => {
                  const isCurrentMo = mi === currentMonth && year === currentYear;
                  const isHighlighted = highlightMonth === mi;

                  let pVal: number, rVal: number;
                  if (isSummary) {
                    pVal = 0; rVal = 0;
                    cats.forEach(c => {
                      pVal += getCellValue(entry.id, c, mi, "p");
                      rVal += getCellValue(entry.id, c, mi, "r");
                    });
                  } else {
                    pVal = getCellValue(entry.id, cat, mi, "p");
                    rVal = getCellValue(entry.id, cat, mi, "r");
                  }
                  const saldo = pVal - rVal;
                  catYearP += pVal;
                  catYearR += rVal;

                  const pKey = makeCellKey(entry.id, cat, mi, "p");
                  const rKey = makeCellKey(entry.id, cat, mi, "r");
                  const noteKey = `${entry.id}__${cat}__${mi}`;
                  const note = notesMap[noteKey];
                  const compKey = getCellKeyOld(entry.id, cat);
                  const compP = showYoY && compareData[compKey]?.[mi]?.p;
                  const compR = showYoY && compareData[compKey]?.[mi]?.r;

                  return (
                    <tr
                      key={mi}
                      className={`transition-colors duration-300
                        ${isSummary ? "" : isCurrentMo ? "bg-primary/[0.06] dark:bg-primary/[0.08]" : ""}
                        ${isSummary ? "" : isHighlighted ? "bg-yellow-100/60 dark:bg-yellow-800/20" : ""}
                        ${isSummary ? "hover:bg-white/5" : "hover:bg-muted/20 dark:hover:bg-muted/10"}`}
                      style={isCurrentMo
                        ? { ...(isSummary ? { color: 'hsl(var(--sidebar-foreground))' } : {}), outline: `1.5px solid ${headerBg}`, outlineOffset: '-1.5px' }
                        : (isSummary ? { color: 'hsl(var(--sidebar-foreground))' } : undefined)}
                      data-testid={isSummary ? `row-summary-month-${mi}` : `row-month-${cat}-${mi}`}
                    >
                      <td className={`border-b border-r px-2 py-1 font-semibold text-[10px]
                        ${isSummary ? "border-sidebar-border/30" : "border-border"}
                        ${isSummary ? "" : isCurrentMo ? "bg-primary/[0.06] dark:bg-primary/[0.08]" : ""}
                        ${isSummary ? "" : isHighlighted ? "bg-yellow-100/60 dark:bg-yellow-800/20" : ""}`}
                      style={isSummary ? { color: 'hsl(var(--sidebar-foreground))' } : undefined}>
                        <div className="flex items-center gap-1">
                          <span>{MONTHS[mi]}</span>
                          {isCurrentMo && <Badge variant="secondary" className="text-[7px] px-0.5 py-0 h-3.5 leading-none">teraz</Badge>}
                        </div>
                      </td>
                      {isSummary ? (
                        <>
                          <td className="border-b border-r border-sidebar-border/30 px-1.5 py-1 text-right tabular-nums text-[9px] font-semibold overflow-hidden" style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)' }}>{formatNum(pVal)}</td>
                          <td className="border-b border-r border-sidebar-border/30 px-1.5 py-1 text-right tabular-nums text-[10px] font-bold overflow-hidden" style={{ color: 'hsl(var(--sidebar-foreground))' }}>{formatNum(rVal)}</td>
                          <td className="border-b border-sidebar-border/30 px-1.5 py-1 text-right tabular-nums text-[10px] font-bold overflow-hidden" style={{ color: saldo > 0 ? '#4ade80' : saldo < 0 ? '#f87171' : 'hsl(var(--sidebar-foreground))' }}>{formatNum(saldo)}</td>
                        </>
                      ) : (
                        <>
                          <TransposedEditableCell
                            value={pVal}
                            isEditing={editingCell === pKey}
                            editValue={editValue}
                            onStartEdit={() => startEditing(pKey)}
                            onCommitEdit={commitEdit}
                            onCancelEdit={cancelEdit}
                            onEditValueChange={setEditValue}
                            isCurrentMonth={isCurrentMo}
                            className="text-muted-foreground text-[9px]"
                            compareValue={compP || undefined}
                            flashKey={[...savedFlashKeys].find(k => k.startsWith(`${year}__${entry.id}__${cat}__${mi}__`))}
                            onCommitAndMoveDown={() => {
                              commitEdit();
                              if (mi < 11) setTimeout(() => startEditing(makeCellKey(entry.id, cat, mi + 1, "p")), 0);
                            }}
                            onFillToEnd={mi < 11 ? () => handleFillToEnd(entry.id, cat, mi, "p") : undefined}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowDown" && mi < 11) {
                                e.preventDefault();
                                startEditing(makeCellKey(entry.id, cat, mi + 1, "p"));
                              }
                              if (e.key === "ArrowUp" && mi > 0) {
                                e.preventDefault();
                                startEditing(makeCellKey(entry.id, cat, mi - 1, "p"));
                              }
                              if (e.key === "ArrowRight") {
                                e.preventDefault();
                                startEditing(rKey);
                              }
                            }}
                          />
                          <TransposedEditableCell
                            value={rVal}
                            isEditing={editingCell === rKey}
                            editValue={editValue}
                            onStartEdit={() => startEditing(rKey)}
                            onCommitEdit={commitEdit}
                            onCancelEdit={cancelEdit}
                            onEditValueChange={setEditValue}
                            isCurrentMonth={isCurrentMo}
                            className="font-medium"
                            note={note}
                            compareValue={compR || undefined}
                            flashKey={[...savedFlashKeys].find(k => k.startsWith(`${year}__${entry.id}__${cat}__${mi}__`))}
                            onCommitAndMoveDown={() => {
                              commitEdit();
                              if (mi < 11) setTimeout(() => startEditing(makeCellKey(entry.id, cat, mi + 1, "r")), 0);
                            }}
                            onFillToEnd={mi < 11 ? () => handleFillToEnd(entry.id, cat, mi, "r") : undefined}
                            onKeyDown={(e) => {
                              if (e.key === "ArrowDown" && mi < 11) {
                                e.preventDefault();
                                startEditing(makeCellKey(entry.id, cat, mi + 1, "r"));
                              }
                              if (e.key === "ArrowUp" && mi > 0) {
                                e.preventDefault();
                                startEditing(makeCellKey(entry.id, cat, mi - 1, "r"));
                              }
                              if (e.key === "ArrowLeft") {
                                e.preventDefault();
                                startEditing(pKey);
                              }
                            }}
                          />
                          <td
                            className={`group border-b border-border px-1.5 py-1 text-right tabular-nums text-[11px] font-semibold ${saldoColor(saldo)} ${saldoBg(saldo)}
                              ${isCurrentMo ? "bg-primary/[0.04]" : ""}`}
                          >
                            <div className="flex items-center justify-end gap-0.5">
                              {formatNum(saldo)}
                              {note && (
                                <button onClick={() => { setCellNoteDialog({ entryId: entry.id, category: cat, month: mi }); setCellNoteText(note); }} className="text-amber-500 hover:text-amber-600 shrink-0" title={note}>
                                  <MessageSquare className="h-2.5 w-2.5" />
                                </button>
                              )}
                              {!note && (
                                <button onClick={() => { setCellNoteDialog({ entryId: entry.id, category: cat, month: mi }); setCellNoteText(""); }} className="text-muted-foreground/30 hover:text-muted-foreground/60 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MessageSquare className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {(() => {
                  const catS = catYearP - catYearR;
                  return (
                    <tr className="font-bold border-t-2" style={{ backgroundColor: isSummary ? 'hsl(var(--sidebar))' : (catHex || 'hsl(var(--sidebar))'), color: 'hsl(var(--sidebar-foreground))', borderColor: 'hsl(var(--sidebar))' }}>
                      <td className="px-2 py-1.5 font-bold text-[10px] uppercase" style={{ color: 'hsl(var(--sidebar-foreground))' }}>Rocznie</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-[10px] font-bold" style={{ color: 'hsl(var(--sidebar-foreground) / 0.7)' }}>{formatNum(catYearP)}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-[11px] font-bold" style={{ color: 'hsl(var(--sidebar-foreground))' }}>{formatNum(catYearR)}</td>
                      <td className="px-1.5 py-1.5 text-right tabular-nums text-[11px] font-bold" style={{ color: catS > 0 ? '#4ade80' : catS < 0 ? '#f87171' : 'hsl(var(--sidebar-foreground))' }}>{formatNum(catS)}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </CardContent>
        </Card>
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="ghost" size="sm" onClick={navigateBack} data-testid="button-back-to-apartments">
            <ChevronLeft className="h-4 w-4 mr-1" /> Wróć
          </Button>
          <h2 className="text-lg font-bold">{entry.name}</h2>
          <Badge variant="secondary">{year}</Badge>
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => { setShowBulkCopy(true); }} data-testid="button-bulk-copy">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Kopiuj miesiąc</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setShowForecast(true)} data-testid="button-auto-forecast">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Auto-prognoza</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={showYoY ? "default" : "outline"} size="sm" onClick={() => setShowYoY(!showYoY)} disabled={compareYear === null} data-testid="button-yoy-toggle">
                    <BarChart3 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Rok do roku</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => { setAddCatEntryId(entry.id); setShowAddCategory(true); }} data-testid={`button-add-cat-${entry.id}`}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Dodaj kategorię</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => openCategoryEditor(entry)} data-testid={`button-edit-categories-${entry.id}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Edytuj kategorie</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => openEntryColorDialog(entry.id, 0)} data-testid={`button-entry-color-${entry.id}`}>
                    <Palette className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zmień kolor</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={() => setResetEntryDialog({ entryId: entry.id, entryName: entry.name })} data-testid={`button-reset-entry-${entry.id}`}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Resetuj dane</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {cats.length > 0 && (() => {
          let tileYearP = 0, tileYearR = 0;
          const tileMonthP: number[] = [];
          const tileMonthR: number[] = [];
          for (let mi = 0; mi < 12; mi++) {
            let pV = 0, rV = 0;
            cats.forEach(c => {
              pV += getCellValue(entry.id, c, mi, "p");
              rV += getCellValue(entry.id, c, mi, "r");
            });
            tileYearP += pV;
            tileYearR += rV;
            tileMonthP.push(pV);
            tileMonthR.push(rV);
          }
          const moP = tileMonthP[currentMonth] || 0;
          const moR = tileMonthR[currentMonth] || 0;
          const moS = moP - moR;
          const yearS = tileYearP - tileYearR;
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1" data-testid="summary-tiles">
              <Card className="border-sidebar/30">
                <CardContent className="py-2.5 px-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Prognoza ({MONTHS[currentMonth]})</p>
                  <p className="text-sm font-bold tabular-nums mt-0.5" data-testid="tile-month-p">{formatNum(moP)} zł</p>
                </CardContent>
              </Card>
              <Card className="border-sidebar/30">
                <CardContent className="py-2.5 px-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Rzeczywiste ({MONTHS[currentMonth]})</p>
                  <p className="text-sm font-bold tabular-nums mt-0.5 text-emerald-600" data-testid="tile-month-r">{formatNum(moR)} zł</p>
                </CardContent>
              </Card>
              <Card className="border-sidebar/30">
                <CardContent className="py-2.5 px-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo ({MONTHS[currentMonth]})</p>
                  <p className={`text-sm font-bold tabular-nums mt-0.5 ${moS > 0 ? 'text-emerald-600' : moS < 0 ? 'text-red-500' : ''}`} data-testid="tile-month-s">{formatNum(moS)} zł</p>
                </CardContent>
              </Card>
              <Card className="border-sidebar/30">
                <CardContent className="py-2.5 px-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Rocznie</p>
                  <p className="text-sm font-bold tabular-nums mt-0.5" data-testid="tile-year-total">{formatNum(tileYearR)} zł</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">P: {formatNum(tileYearP)} · S: <span className={yearS > 0 ? 'text-emerald-600' : yearS < 0 ? 'text-red-500' : ''}>{formatNum(yearS)}</span></p>
                </CardContent>
              </Card>
            </div>
          );
        })()}

        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(325px, 1fr))' }} data-testid="category-cards-grid">
          {cats.map((cat) => (
            <Fragment key={cat}>
              {renderCategoryCard(cat)}
            </Fragment>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Podpowiedzi: Kliknij dwukrotnie aby edytować · Enter / Tab potwierdza · Escape anuluje · Strzałki ↑↓ nawigacja · Ctrl+Z cofnij · Ctrl+Y ponów</span>
        </div>
      </div>
    );
  };

  return (
    <div className={embedded ? "space-y-4" : "p-6 space-y-4"}>
      {!embedded && (
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <PageHeader title="Koszty apartamentów" description="Analiza kosztów w podziale na apartamenty." icon={Calculator} />
          <div className="flex items-center gap-2 flex-wrap">
            <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
            <Button variant="outline" size="sm" onClick={handleExcelExport} data-testid="button-export-excel">
              <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={handleImportHistory} disabled={isImportingHistory} data-testid="button-import-history-costs">
              <DatabaseBackup className="mr-1 h-4 w-4" /> {isImportingHistory ? 'Importowanie...' : 'Import historii'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCopyToNextYear(true)} data-testid="button-copy-forecast-next-year">
              <ArrowRight className="mr-1 h-4 w-4" /> Kopiuj na {year + 1}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowClearAllDialog(true)} data-testid="button-clear-all-costs">
              <Eraser className="h-4 w-4 mr-1" /> Wyczyść {year}
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
          <Button variant="outline" size="sm" onClick={handleExcelExport} data-testid="button-export-excel-embedded">
            <FileSpreadsheet className="mr-1 h-3 w-3" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowCopyToNextYear(true)} data-testid="button-copy-forecast-next-year">
            <ArrowRight className="mr-1 h-3 w-3" /> Kopiuj na {year + 1}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowClearAllDialog(true)} data-testid="button-clear-all-costs-embedded">
            <Eraser className="mr-1 h-3 w-3" /> Wyczyść {year}
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

      {isLoadingCostData ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-l-4 border-l-indigo-500 shadow-sm">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Prognoza roczna</p>
              <p className="text-xl font-bold mt-1 tabular-nums" data-testid="text-total-prognoza">{grandTotal.p.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 shadow-sm">
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Zrealizowane</p>
              <p className="text-xl font-bold mt-1 tabular-nums" data-testid="text-total-rzeczywiste">{grandTotal.r.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
              {grandTotal.p > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round(grandTotal.r / grandTotal.p * 100)}% planu</p>
              )}
            </CardContent>
          </Card>
          <Card className={`border-l-4 shadow-sm ${grandTotal.s >= 0 ? "border-l-emerald-500" : "border-l-red-500"}`}>
            <CardContent className="pt-4 pb-3 px-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Saldo</p>
              <p className={`text-xl font-bold mt-1 tabular-nums ${saldoColor(grandTotal.s)}`} data-testid="text-total-saldo">
                {grandTotal.s >= 0 ? "+" : ""}{grandTotal.s.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {year === currentYear && !isLoadingCostData && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="bg-gradient-to-br from-indigo-50/50 to-transparent dark:from-indigo-950/20 dark:to-transparent shadow-sm">
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{MONTHS_PL[currentMonth]} — Prognoza</p>
              <p className="text-lg font-bold mt-1 tabular-nums">{currentMonthTotals.p.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-cyan-50/50 to-transparent dark:from-cyan-950/20 dark:to-transparent shadow-sm">
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{MONTHS_PL[currentMonth]} — Zrealizowane</p>
              <p className="text-lg font-bold mt-1 tabular-nums">{currentMonthTotals.r.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
              {currentMonthTotals.p > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round(currentMonthTotals.r / currentMonthTotals.p * 100)}% planu</p>
              )}
            </CardContent>
          </Card>
          <Card className={`bg-gradient-to-br shadow-sm ${currentMonthTotals.s >= 0 ? "from-emerald-50/50 dark:from-emerald-950/20" : "from-red-50/50 dark:from-red-950/20"} to-transparent dark:to-transparent`}>
            <CardContent className="pt-3 pb-3 px-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{MONTHS_PL[currentMonth]} — Saldo</p>
              <p className={`text-lg font-bold mt-1 tabular-nums ${saldoColor(currentMonthTotals.s)}`}>
                {currentMonthTotals.s >= 0 ? "+" : ""}{currentMonthTotals.s.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowChart(!showChart)} data-testid="button-toggle-chart-costs">
          <BarChart3 className="mr-1 h-3 w-3" /> {showChart ? "Ukryj wykres" : "Pokaż wykres"}
        </Button>
        {embedded && (
          <Button variant="outline" size="sm" onClick={handleImportHistory} disabled={isImportingHistory} data-testid="button-import-history-costs-embedded">
            <DatabaseBackup className="mr-1 h-3 w-3" /> {isImportingHistory ? 'Importowanie...' : 'Import historii'}
          </Button>
        )}
      </div>

      {showChart && (
        <Card className="shadow-sm" data-testid="card-monthly-cost-chart">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Prognoza vs Rzeczywiste — podsumowanie miesięczne</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={220}>
              <RechartsBarChart data={monthlyCostChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(value: number) => [`${value.toLocaleString("pl-PL")} zł`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Prognoza" fill="#6366f1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Rzeczywiste" fill="#00CCFF" radius={[2, 2, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <FullscreenWrapper title={`Koszty apartamentów ${year}`} isFullscreen={fullscreen.isFullscreen} onExit={fullscreen.exit}>
        <div className="space-y-4">
          {renderBreadcrumb()}
          {drillLevel === "locations" && renderLocationTiles()}
          {drillLevel === "apartments" && renderApartmentTiles()}
          {drillLevel === "table" && renderTransposedTable()}
        </div>
      </FullscreenWrapper>

      {compareYear !== null && drillLevel === "locations" && (() => {
        const yoyChartData = MONTHS.map((name, m) => {
          let mainR = 0, compR = 0;
          costEntries.forEach(group => {
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
          <Card className="shadow-sm" data-testid="card-yoy-costs-chart">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">{`Koszty rzeczywiste: ${year} vs ${compareYear}`}</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={yoyChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <RechartsTooltip formatter={(value: number) => [`${value.toLocaleString("pl-PL")} zł`]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey={String(year)} stroke="#00CCFF" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey={String(compareYear)} stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
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
              <label className="text-sm font-medium">Kolor tła karty</label>
              <div className="flex items-center gap-3 mt-2">
                <div className="grid grid-cols-5 gap-1.5 flex-1">
                  {CATEGORY_COLORS.map(c => (
                    <button
                      key={c.value}
                      className={`h-7 rounded-md ${getCatBgColor(newCatColor) === c.value ? "ring-2 ring-primary ring-offset-2" : ""}`}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setNewCatColor(c.value)}
                      title={c.label}
                      data-testid={`color-${c.label}`}
                    />
                  ))}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <label className="text-[10px] text-muted-foreground">Własny</label>
                  <input
                    type="color"
                    value={getCatBgColor(newCatColor)}
                    onChange={(e) => setNewCatColor(e.target.value)}
                    className="w-10 h-10 rounded-md border border-border cursor-pointer"
                    data-testid="new-cat-color-picker"
                  />
                </div>
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
              <label className="text-sm font-medium">Kolor tła karty</label>
              <div className="flex items-center gap-3 mt-2">
                <div className="grid grid-cols-5 gap-1.5 flex-1">
                  {CATEGORY_COLORS.map(c => (
                    <button
                      key={c.value}
                      className={`h-7 rounded-md ${getCatBgColor(editCatColor) === c.value ? "ring-2 ring-primary ring-offset-2" : ""}`}
                      style={{ backgroundColor: c.value }}
                      onClick={() => setEditCatColor(c.value)}
                      title={c.label}
                      data-testid={`edit-color-${c.label}`}
                    />
                  ))}
                </div>
                <div className="flex flex-col items-center gap-1">
                  <label className="text-[10px] text-muted-foreground">Własny</label>
                  <input
                    type="color"
                    value={getCatBgColor(editCatColor)}
                    onChange={(e) => setEditCatColor(e.target.value)}
                    className="w-10 h-10 rounded-md border border-border cursor-pointer"
                    data-testid="edit-color-picker"
                  />
                </div>
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
            <div className="flex items-center gap-3 mt-3">
              <div className="grid grid-cols-5 gap-2 flex-1">
                {CATEGORY_COLORS.map(c => (
                  <button
                    key={c.value}
                    className={`h-10 rounded-md ${getCatBgColor(editEntryColor) === c.value ? "ring-2 ring-primary ring-offset-2" : ""} transition-all`}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setEditEntryColor(c.value)}
                    title={c.label}
                    data-testid={`entry-color-${c.label}`}
                  />
                ))}
              </div>
              <div className="flex flex-col items-center gap-1">
                <label className="text-[10px] text-muted-foreground">Własny</label>
                <input
                  type="color"
                  value={getCatBgColor(editEntryColor)}
                  onChange={(e) => setEditEntryColor(e.target.value)}
                  className="w-12 h-12 rounded-md border border-border cursor-pointer"
                  data-testid="entry-color-picker"
                />
              </div>
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
            Wszystkie wartości prognozowane (P) z roku {year} zostaną skopiowane na rok {year + 1}.
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

      <Dialog open={showBulkCopy} onOpenChange={setShowBulkCopy}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Kopiuj miesiąc na zakres</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Miesiąc źródłowy</label>
              <Select value={String(bulkCopySource)} onValueChange={(v) => setBulkCopySource(Number(v))}>
                <SelectTrigger className="mt-1" data-testid="select-bulk-source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS_PL.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Od miesiąca</label>
                <Select value={String(bulkCopyStart)} onValueChange={(v) => setBulkCopyStart(Number(v))}>
                  <SelectTrigger className="mt-1" data-testid="select-bulk-start"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS_PL.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Do miesiąca</label>
                <Select value={String(bulkCopyEnd)} onValueChange={(v) => setBulkCopyEnd(Number(v))}>
                  <SelectTrigger className="mt-1" data-testid="select-bulk-end"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS_PL.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Co kopiować</label>
              <Select value={bulkCopyFields} onValueChange={(v) => setBulkCopyFields(v as "p" | "r" | "both")}>
                <SelectTrigger className="mt-1" data-testid="select-bulk-fields"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="p">Tylko Prognoza (P)</SelectItem>
                  <SelectItem value="r">Tylko Realizacja (R)</SelectItem>
                  <SelectItem value="both">P i R</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkCopy(false)}>Anuluj</Button>
            <Button onClick={handleBulkCopy} data-testid="button-confirm-bulk-copy">Kopiuj</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showForecast} onOpenChange={setShowForecast}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Auto-prognoza — {selectedEntry?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wybierz metodę generowania prognozy (P) na podstawie danych rzeczywistych (R).
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/30" data-testid="forecast-avg">
                <input type="radio" name="forecast" checked={forecastMethod === "avg"} onChange={() => { setForecastMethod("avg"); setForecastPreview(null); }} disabled={compareYear === null} />
                <div>
                  <p className="text-sm font-medium">Średnia roczna z roku poprzedniego {compareYear !== null ? `(${compareYear})` : ""}</p>
                  <p className="text-xs text-muted-foreground">{compareYear === null ? "Wybierz rok porównawczy" : `Średnia R z roku ${compareYear}`}</p>
                </div>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/30" data-testid="forecast-prev">
                <input type="radio" name="forecast" checked={forecastMethod === "prev"} onChange={() => { setForecastMethod("prev"); setForecastPreview(null); }} disabled={compareYear === null} />
                <div>
                  <p className="text-sm font-medium">Rok poprzedni {compareYear !== null ? `(${compareYear})` : ""}</p>
                  <p className="text-xs text-muted-foreground">{compareYear === null ? "Wybierz rok porównawczy" : `Kopiuj R z roku ${compareYear} jako P`}</p>
                </div>
              </label>
              <label className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/30" data-testid="forecast-recent">
                <input type="radio" name="forecast" checked={forecastMethod === "recent"} onChange={() => { setForecastMethod("recent"); setForecastPreview(null); }} />
                <div>
                  <p className="text-sm font-medium">Średnia ostatnich 3 mies.</p>
                  <p className="text-xs text-muted-foreground">Średnia krocząca z 3 poprzednich miesięcy</p>
                </div>
              </label>
            </div>
          </div>
          {forecastPreview && forecastPreview.length > 0 && (
            <div className="max-h-48 overflow-y-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1 text-left">Kategoria</th>
                    <th className="px-2 py-1 text-left">Miesiąc</th>
                    <th className="px-2 py-1 text-right">Nowa P</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastPreview.map((item, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-2 py-0.5">{item.cat}</td>
                      <td className="px-2 py-0.5">{MONTHS[item.month]}</td>
                      <td className="px-2 py-0.5 text-right">
                        <input
                          type="number"
                          className="w-20 text-right text-xs font-medium text-emerald-600 bg-transparent border-b border-emerald-300 focus:outline-none focus:border-emerald-500 px-1"
                          value={item.newVal}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setForecastPreview(prev => prev ? prev.map((p, j) => j === i ? { ...p, newVal: val } : p) : null);
                          }}
                          data-testid={`forecast-preview-input-${i}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {forecastPreview && forecastPreview.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Brak pustych komórek P do uzupełnienia.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForecast(false); setForecastPreview(null); }}>Anuluj</Button>
            {!forecastPreview ? (
              <Button onClick={generateForecastPreview} data-testid="button-preview-forecast">Podgląd</Button>
            ) : (
              <Button onClick={handleAutoForecast} disabled={!forecastPreview.length} data-testid="button-confirm-forecast">Zastosuj ({forecastPreview.length})</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cellNoteDialog} onOpenChange={(open) => { if (!open) setCellNoteDialog(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Notatka do komórki</DialogTitle>
          </DialogHeader>
          {cellNoteDialog && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {cellNoteDialog.category} · {MONTHS_PL[cellNoteDialog.month]}
              </p>
              <textarea
                className="w-full border rounded-lg p-2 text-sm min-h-[80px] bg-background"
                value={cellNoteText}
                onChange={(e) => setCellNoteText(e.target.value)}
                placeholder="Wpisz notatkę..."
                data-testid="input-cell-note"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCellNoteDialog(null)}>Anuluj</Button>
            <Button onClick={handleSaveNote} data-testid="button-save-note">Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={!!apartmentSheet} onOpenChange={(open) => { if (!open) setApartmentSheet(null); }}>
        <SheetContent className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto" data-testid="sheet-apartment">
          {(() => {
            if (!apartmentSheet) return null;
            const entry = costEntries.flatMap(g => g.items).find(e => e.id === apartmentSheet);
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

      <Sheet open={!!categorySheet} onOpenChange={(open) => { if (!open) setCategorySheet(null); }}>
        <SheetContent className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto" data-testid="sheet-category">
          {(() => {
            if (!categorySheet) return null;
            const { entryId, cat } = categorySheet;
            const entry = costEntries.flatMap(g => g.items).find(e => e.id === entryId);
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
