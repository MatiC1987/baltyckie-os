import type React from "react";
import { useState, useMemo, useCallback, useRef, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getAuthHeaders } from "@/lib/auth-token";
import type { CostSchedule, CostSchedulePayment, OperationalCostForecast } from "@shared/schema";
import { DEFAULT_OPLATY_CATEGORIES, loadOplatyCategories, type OplatyCostCategory, type OplatyCostItem } from "@/lib/oplaty-defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ResponsiveFormDialog } from "@/components/ResponsiveFormDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown, ChevronRight, Plus, Trash2, Copy, ArrowRight, ArrowDown, ArrowLeft,
  Pencil, CalendarPlus, CheckCircle2, XCircle, AlertTriangle, Calendar, Link2, Receipt, BarChart3, Archive, RotateCcw, MoreHorizontal,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { SwipeableRow } from "@/components/SwipeableRow";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { format, addMonths, addQuarters, addYears, parseISO, isBefore, isAfter, startOfMonth } from "date-fns";
import { pl } from "date-fns/locale";

type CostItem = OplatyCostItem;
type CostCategory = OplatyCostCategory;

const CATEGORY_COLORS: Record<string, string> = {
  "Niebieski": "#2563eb",
  "Czerwony": "#dc2626",
  "Fioletowy": "#9333ea",
  "Zielony": "#059669",
  "Bursztynowy": "#d97706",
  "Różowy": "#db2777",
  "Błękitny": "#0891b2",
  "Szary": "#475569",
  "Indygo": "#4f46e5",
  "Pomarańczowy": "#ea580c",
};

const COLOR_PRESETS = Object.entries(CATEGORY_COLORS).map(([label, hex]) => ({ label, hex }));

function isHexColor(c: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(c);
}

function getCatBgColor(colorValue: string): string {
  if (isHexColor(colorValue)) return colorValue;
  const tailwindMap: Record<string, string> = {
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
  return tailwindMap[colorValue] || "#2563eb";
}

const DEFAULT_CATEGORIES = DEFAULT_OPLATY_CATEGORIES;

const MONTHS_SHORT = [
  "STY", "LUT", "MAR", "KWI", "MAJ", "CZE",
  "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU",
];

const MONTHS_LABELS = [
  "Sty", "Lut", "Mar", "Kwi", "Maj", "Cze",
  "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru",
];

const SCHEDULE_CATEGORIES = [
  "WYNAGRODZENIA",
  "ZUS & PODATKI",
  "KREDYTY & POŻYCZKI",
  "NIERUCHOMOŚCI",
  "OBSŁUGA PRAWNO-KSIĘGOWA",
  "MARKETING & REKLAMA",
  "USŁUGI",
  "POZOSTAŁE",
];

const FREQUENCIES: { value: string; label: string }[] = [
  { value: "monthly", label: "Miesięcznie" },
  { value: "quarterly", label: "Kwartalnie" },
  { value: "yearly", label: "Rocznie" },
  { value: "one_time", label: "Jednorazowo" },
];

type CellKey = string;

function makeCellKey(catId: string, itemIdx: number, month: number, field: "prognoza" | "rzeczywiste"): CellKey {
  return `${catId}__${itemIdx}__${month}__${field}`;
}

function getStorageKey(year: number) {
  return `oplaty-data-${year}`;
}

function _legacyLoadData(year: number): Record<CellKey, number> {
  try {
    const raw = localStorage.getItem(getStorageKey(year));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function _legacyLoadCategories(): CostCategory[] {
  try {
    const raw = localStorage.getItem("oplaty-categories");
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function apiRowsToCellData(rows: Array<{ catId: string; itemIdx: number; month: number; prognoza: string | null; realized: string | null }>): Record<CellKey, number> {
  const out: Record<CellKey, number> = {};
  for (const r of rows) {
    const p = Number(r.prognoza) || 0;
    const rv = Number(r.realized) || 0;
    if (p !== 0) out[makeCellKey(r.catId, r.itemIdx, r.month, "prognoza")] = p;
    if (rv !== 0) out[makeCellKey(r.catId, r.itemIdx, r.month, "rzeczywiste")] = rv;
  }
  return out;
}

function cellDataToBulkPayload(year: number, cells: Record<CellKey, number>) {
  const grouped: Record<string, { catId: string; itemIdx: number; month: number; prognoza?: number; realized?: number }> = {};
  for (const [key, val] of Object.entries(cells)) {
    const parts = key.split("__");
    const catId = parts[0], itemIdx = parseInt(parts[1]), month = parseInt(parts[2]), field = parts[3];
    const gk = `${catId}__${itemIdx}__${month}`;
    if (!grouped[gk]) grouped[gk] = { catId, itemIdx, month };
    if (field === "prognoza") grouped[gk].prognoza = val;
    else grouped[gk].realized = val;
  }
  return Object.values(grouped).map(g => {
    const row: any = { year, catId: g.catId, itemIdx: g.itemIdx, month: g.month };
    if (g.prognoza !== undefined) row.prognoza = g.prognoza;
    if (g.realized !== undefined) row.realized = g.realized;
    return row;
  });
}

function parseDateLocal(dateStr: string): { year: number; month: number } {
  const parts = dateStr.split("-");
  return { year: parseInt(parts[0]), month: parseInt(parts[1]) - 1 };
}

function buildScheduleOverlay(
  schedules: CostSchedule[],
  payments: CostSchedulePayment[],
  year: number
): Record<CellKey, number> {
  const overlay: Record<CellKey, number> = {};
  const paymentsBySchedule: Record<number, CostSchedulePayment[]> = {};
  for (const p of payments) {
    if (!paymentsBySchedule[p.scheduleId]) paymentsBySchedule[p.scheduleId] = [];
    paymentsBySchedule[p.scheduleId].push(p);
  }
  for (const schedule of schedules) {
    if (!schedule.active) continue;
    if (!schedule.linkCategoryId || schedule.linkItemIndex === null || schedule.linkItemIndex === undefined) continue;
    const catId = schedule.linkCategoryId;
    const itemIdx = schedule.linkItemIndex;
    const schPayments = paymentsBySchedule[schedule.id] || [];
    for (let month = 0; month < 12; month++) {
      const monthPayments = schPayments.filter(p => {
        const d = parseDateLocal(p.dueDate);
        return d.year === year && d.month === month;
      });
      if (monthPayments.length > 0) {
        const prognozaKey = makeCellKey(catId, itemIdx, month, "prognoza");
        const rzeczKey = makeCellKey(catId, itemIdx, month, "rzeczywiste");
        let prognozaTotal = 0;
        let rzeczTotal = 0;
        for (const p of monthPayments) {
          const amt = parseFloat(p.amount || "0");
          const forecast = p.forecastAmount ? parseFloat(p.forecastAmount) : amt;
          prognozaTotal += isNaN(forecast) ? amt : forecast;
          if (p.status === "OPLACONE") {
            rzeczTotal += amt;
          }
        }
        if (prognozaTotal !== 0) overlay[prognozaKey] = (overlay[prognozaKey] || 0) + prognozaTotal;
        if (rzeczTotal !== 0) overlay[rzeczKey] = (overlay[rzeczKey] || 0) + rzeczTotal;
      }
    }
  }
  return overlay;
}

function buildPaymentStatusMap(
  schedules: CostSchedule[],
  payments: CostSchedulePayment[],
  year: number
): Record<string, "paid" | "overdue" | "pending"> {
  const map: Record<string, "paid" | "overdue" | "pending"> = {};
  const now = new Date();
  const paymentsBySchedule: Record<number, CostSchedulePayment[]> = {};
  for (const p of payments) {
    if (!paymentsBySchedule[p.scheduleId]) paymentsBySchedule[p.scheduleId] = [];
    paymentsBySchedule[p.scheduleId].push(p);
  }
  for (const schedule of schedules) {
    if (!schedule.active) continue;
    if (!schedule.linkCategoryId || schedule.linkItemIndex === null || schedule.linkItemIndex === undefined) continue;
    const catId = schedule.linkCategoryId;
    const itemIdx = schedule.linkItemIndex;
    const schPayments = paymentsBySchedule[schedule.id] || [];
    for (let month = 0; month < 12; month++) {
      const monthPayments = schPayments.filter(p => {
        const d = parseDateLocal(p.dueDate);
        return d.year === year && d.month === month;
      });
      if (monthPayments.length === 0) continue;
      const key = `${catId}__${itemIdx}__${month}`;
      const allPaid = monthPayments.every(p => p.status === "OPLACONE");
      const hasOverdue = monthPayments.some(p => p.status === "NIEOPLACONE" && isBefore(parseISO(p.dueDate), now));
      if (allPaid) {
        map[key] = "paid";
      } else if (hasOverdue) {
        map[key] = "overdue";
      } else {
        map[key] = "pending";
      }
    }
  }
  return map;
}

function generatePaymentDates(startDate: string, endDate: string | null, frequency: string): string[] {
  const dates: string[] = [];
  let current = parseISO(startDate);
  const end = endDate ? parseISO(endDate) : addYears(new Date(), 2);
  if (frequency === "one_time") {
    return [startDate];
  }
  while (!isAfter(current, end) && dates.length < 120) {
    dates.push(format(current, "yyyy-MM-dd"));
    if (frequency === "monthly") current = addMonths(current, 1);
    else if (frequency === "quarterly") current = addQuarters(current, 1);
    else if (frequency === "yearly") current = addYears(current, 1);
    else break;
  }
  return dates;
}

function freqLabel(f: string): string {
  return FREQUENCIES.find(x => x.value === f)?.label || f;
}

function formatNum(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (isNaN(n) || n === 0) return "";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNum2(v: number | string | null | undefined): string {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  if (isNaN(n) || n === 0) return "0,00";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "\u2014";
  const change = ((current - previous) / previous) * 100;
  return (change >= 0 ? "+" : "") + change.toFixed(0) + "%";
}

function costChangeColor(current: number, previous: number): string {
  if (previous === 0) return "text-muted-foreground";
  if (current < previous) return "text-emerald-600 dark:text-emerald-400";
  if (current > previous) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function TransposedEditableCell({
  value, isEditing, editValue, onStartEdit, onCommitEdit, onCancelEdit, onEditValueChange,
  isCurrentMonth, className = "", onKeyDown, onCommitAndMoveDown, onFillToEnd, isServerManaged,
}: {
  value: number; isEditing: boolean; editValue: string;
  onStartEdit: () => void; onCommitEdit: () => void; onCancelEdit: () => void;
  onEditValueChange: (v: string) => void;
  isCurrentMonth?: boolean; className?: string;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  onCommitAndMoveDown?: () => void; onFillToEnd?: () => void;
  isServerManaged?: boolean;
}) {
  return (
    <td
      className={`group/cell border-b border-r border-border/60 px-1.5 py-1 text-right tabular-nums relative select-none
        ${isCurrentMonth ? "bg-primary/[0.04]" : ""}
        ${isServerManaged ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}
        ${className}`}
      onDoubleClick={onStartEdit}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); onStartEdit(); }
        onKeyDown?.(e);
      }}
      title={isServerManaged ? "Wartość z modułu Prognoza" : undefined}
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
          <span className="text-[11px] min-h-[18px] cursor-cell flex-1">{formatNum(value)}</span>
        </div>
      )}
    </td>
  );
}

export function CostsExpensesContent({ embedded = false, externalYear, onTotalsChange, onMonthlyDataChange }: { embedded?: boolean; externalYear?: number; onTotalsChange?: (prognoza: number, realized: number) => void; onMonthlyDataChange?: (data: Array<{p: number, r: number}>) => void }) {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selectedYear, setSelectedYear] = useState(externalYear ?? currentYear);
  const [compareYear, setCompareYear] = useState<number | null>(null);

  const [drillLevel, setDrillLevel] = useState<"categories" | "items">("categories");
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);

  const { data: dbRows = [] } = useQuery<Array<{ catId: string; itemIdx: number; month: number; prognoza: string | null; realized: string | null }>>({
    queryKey: ["/api/op-cost-data", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/op-cost-data?year=${selectedYear}`, { credentials: "include", headers: { ...getAuthHeaders() } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: dbCategories } = useQuery<CostCategory[]>({
    queryKey: ["/api/op-cost-categories"],
    staleTime: 60000,
    refetchInterval: 60000,
  });

  const baseDbCellData = useMemo(() => apiRowsToCellData(dbRows), [dbRows]);

  const [cellData, setCellData] = useState<Record<CellKey, number>>({});
  const [categories, setCategories] = useState<CostCategory[]>(DEFAULT_CATEGORIES);

  useEffect(() => {
    if (dbCategories != null) {
      if (dbCategories.length > 0) {
        setCategories(dbCategories);
      } else {
        const legacyCats = _legacyLoadCategories();
        if (legacyCats.length > 0) {
          setCategories(legacyCats);
          fetch("/api/op-cost-categories", { method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, credentials: "include", body: JSON.stringify(legacyCats) });
          localStorage.removeItem("oplaty-categories");
        } else {
          setCategories(DEFAULT_CATEGORIES);
        }
      }
    }
  }, [dbCategories]);

  useEffect(() => {
    setCellData(baseDbCellData);
    if (Object.keys(baseDbCellData).length === 0 && !localStorage.getItem(`migrated-op-cost-to-db-v1-${selectedYear}`)) {
      const legacy = _legacyLoadData(selectedYear);
      if (Object.keys(legacy).length > 0) {
        setCellData(legacy);
        const payload = cellDataToBulkPayload(selectedYear, legacy);
        fetch("/api/op-cost-data/bulk", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, credentials: "include", body: JSON.stringify({ cells: payload }) })
          .then(() => {
            localStorage.setItem(`migrated-op-cost-to-db-v1-${selectedYear}`, "1");
            localStorage.removeItem(getStorageKey(selectedYear));
            queryClient.invalidateQueries({ queryKey: ["/api/op-cost-data", selectedYear] });
          });
      } else {
        localStorage.setItem(`migrated-op-cost-to-db-v1-${selectedYear}`, "1");
      }
    }
  }, [baseDbCellData, selectedYear]);

  const pendingCellsRef = useRef<Record<CellKey, number>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingCells = useCallback((year: number) => {
    const pending = { ...pendingCellsRef.current };
    if (Object.keys(pending).length === 0) return;
    pendingCellsRef.current = {};
    const payload = cellDataToBulkPayload(year, pending);
    fetch("/api/op-cost-data/bulk", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, credentials: "include", body: JSON.stringify({ cells: payload }) })
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/op-cost-data", year] }));
  }, []);

  const queueCellSave = useCallback((key: CellKey, val: number, year: number) => {
    pendingCellsRef.current[key] = val;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => flushPendingCells(year), 600);
  }, [flushPendingCells]);

  const dbSaveCategories = useCallback((cats: CostCategory[]) => {
    fetch("/api/op-cost-categories", { method: "PUT", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, credentials: "include", body: JSON.stringify(cats) })
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/op-cost-categories"] }));
  }, []);

  useEffect(() => {
    if (externalYear !== undefined && externalYear !== selectedYear) {
      setSelectedYear(externalYear);
      if (compareYear === externalYear) {
        setCompareYear(null);
      }
    }
  }, [externalYear]);

  const { data: costSchedules = [] } = useQuery<CostSchedule[]>({
    queryKey: ["/api/cost-schedules"],
  });
  const { data: costSchedulePayments = [] } = useQuery<CostSchedulePayment[]>({
    queryKey: ["/api/cost-schedule-payments"],
  });

  const { data: serverForecasts = [] } = useQuery<OperationalCostForecast[]>({
    queryKey: ["/api/operational-cost-forecasts", selectedYear],
    queryFn: async () => {
      const res = await fetch(`/api/operational-cost-forecasts?year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const serverForecastLookup = useMemo(() => {
    const lookup: Record<string, number> = {};
    for (const f of serverForecasts) {
      const key = makeCellKey(f.categoryId, f.itemIndex, f.month, "prognoza");
      lookup[key] = Number(f.forecast) || 0;
    }
    return lookup;
  }, [serverForecasts]);

  const scheduleOverlay = useMemo(
    () => buildScheduleOverlay(costSchedules, costSchedulePayments, selectedYear),
    [costSchedules, costSchedulePayments, selectedYear]
  );

  const paymentStatusMap = useMemo(
    () => buildPaymentStatusMap(costSchedules, costSchedulePayments, selectedYear),
    [costSchedules, costSchedulePayments, selectedYear]
  );

  const [showArchived, setShowArchived] = useState(false);
  const activeCategories = useMemo(() => categories.filter(c => !c.archived), [categories]);
  const archivedCategories = useMemo(() => categories.filter(c => c.archived), [categories]);

  const [editingCell, setEditingCell] = useState<CellKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [editSubLabelValue, setEditSubLabelValue] = useState("");

  const [addItemCatId, setAddItemCatId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemSubLabel, setNewItemSubLabel] = useState("");

  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatTitle, setNewCatTitle] = useState("");
  const [newCatColor, setNewCatColor] = useState(COLOR_PRESETS[0].hex);
  const [showCopyToNextYear, setShowCopyToNextYear] = useState(false);
  const [editCatDialog, setEditCatDialog] = useState<CostCategory | null>(null);
  const [editCatTitle, setEditCatTitle] = useState("");
  const [editCatColor, setEditCatColor] = useState("");

  const [forecastPrompt, setForecastPrompt] = useState<{
    catId: string; itemIdx: number; month: number; amount: number; itemName: string; catTitle: string;
  } | null>(null);
  const [forecastPromptOption, setForecastPromptOption] = useState<"one_time" | "remaining" | "all">("remaining");

  const addToForecastMutation = useMutation({
    mutationFn: async (params: { catId: string; itemIdx: number; months: number[]; amount: number }) => {
      const entries = params.months.map(m => ({
        year: selectedYear,
        month: m,
        categoryId: params.catId,
        itemIndex: params.itemIdx,
        forecast: String(params.amount),
      }));
      return apiRequest("POST", "/api/operational-cost-forecasts/bulk", { entries });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operational-cost-forecasts"] });
      toast({ title: "Dodano do prognozy", description: "Wartości prognozowane zostały zaktualizowane" });
      setForecastPrompt(null);
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać do prognozy", variant: "destructive" });
    },
  });

  const [sheetItem, setSheetItem] = useState<{ catId: string; itemIdx: number } | null>(null);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [editSchedule, setEditSchedule] = useState<CostSchedule | null>(null);

  const createSchedule = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/cost-schedules", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedules"] });
      setShowScheduleDialog(false);
      toast({ title: "Dodano harmonogram kosztów" });
    },
  });

  const updateScheduleMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/cost-schedules/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedules"] });
      setEditSchedule(null);
      toast({ title: "Zaktualizowano harmonogram" });
    },
  });

  const deleteSchedule = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/cost-schedules/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedule-payments"] });
      toast({ title: "Usunięto harmonogram" });
    },
  });

  const createPayment = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/cost-schedule-payments", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedule-payments"] });
    },
  });

  const updatePayment = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/cost-schedule-payments/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedule-payments"] });
    },
  });

  const deletePayment = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/cost-schedule-payments/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedule-payments"] });
    },
  });

  const paymentsBySchedule = useMemo(() => {
    const map: Record<number, CostSchedulePayment[]> = {};
    for (const p of costSchedulePayments) {
      if (!map[p.scheduleId]) map[p.scheduleId] = [];
      map[p.scheduleId].push(p);
    }
    return map;
  }, [costSchedulePayments]);

  const linkedSchedules = useMemo(() => {
    if (!sheetItem) return [];
    return costSchedules.filter(
      s => s.linkCategoryId === sheetItem.catId && s.linkItemIndex === sheetItem.itemIdx
    );
  }, [costSchedules, sheetItem]);

  const updateCategories = useCallback((newCats: CostCategory[]) => {
    setCategories(newCats);
    dbSaveCategories(newCats);
  }, [dbSaveCategories]);

  const handleArchiveCategory = useCallback((catId: string) => {
    const newCats = categories.map(c => c.id === catId ? { ...c, archived: true } : c);
    updateCategories(newCats);
    toast({ title: "Zarchiwizowano kategorię" });
  }, [categories, updateCategories, toast]);

  const handleRestoreCategory = useCallback((catId: string) => {
    const newCats = categories.map(c => c.id === catId ? { ...c, archived: false } : c);
    updateCategories(newCats);
    toast({ title: "Przywrócono kategorię" });
  }, [categories, updateCategories, toast]);

  const handleArchiveItem = useCallback((catId: string, itemIdx: number) => {
    const newCats = categories.map(cat => {
      if (cat.id !== catId) return cat;
      const newItems = [...cat.items];
      newItems[itemIdx] = { ...newItems[itemIdx], archived: true };
      return { ...cat, items: newItems };
    });
    updateCategories(newCats);
    toast({ title: "Zarchiwizowano pozycję" });
  }, [categories, updateCategories, toast]);

  const handleRestoreItem = useCallback((catId: string, itemIdx: number) => {
    const newCats = categories.map(cat => {
      if (cat.id !== catId) return cat;
      const newItems = [...cat.items];
      newItems[itemIdx] = { ...newItems[itemIdx], archived: false };
      return { ...cat, items: newItems };
    });
    updateCategories(newCats);
    toast({ title: "Przywrócono pozycję" });
  }, [categories, updateCategories, toast]);

  const archivedItems = useMemo(() => {
    const items: { catId: string; catTitle: string; catColor: string; itemIdx: number; item: CostItem }[] = [];
    for (const cat of categories) {
      if (cat.archived) continue;
      cat.items.forEach((item, idx) => {
        if (item.archived) {
          items.push({ catId: cat.id, catTitle: cat.title, catColor: cat.color, itemIdx: idx, item });
        }
      });
    }
    return items;
  }, [categories]);

  const handleYearChange = useCallback((year: string) => {
    const y = parseInt(year);
    setSelectedYear(y);
  }, []);

  const getCellValue = useCallback((key: CellKey): number => {
    if (key.endsWith("__prognoza") && key in serverForecastLookup) {
      return serverForecastLookup[key];
    }
    if (key in scheduleOverlay) return scheduleOverlay[key];
    return cellData[key] || 0;
  }, [cellData, scheduleOverlay, serverForecastLookup]);

  const parseCellKey = useCallback((key: CellKey) => {
    const parts = key.split("__");
    return { catId: parts[0], itemIdx: parseInt(parts[1]), month: parseInt(parts[2]), field: parts[3] as "prognoza" | "rzeczywiste" };
  }, []);

  const startEditing = useCallback((key: CellKey) => {
    if (key.endsWith("__prognoza") && key in serverForecastLookup) {
      setEditingCell(key);
      setEditValue(serverForecastLookup[key]?.toString() || "");
      return;
    }
    setEditingCell(key);
    setEditValue(cellData[key]?.toString() || "");
  }, [cellData, serverForecastLookup]);

  const commitEdit = useCallback(() => {
    if (editingCell) {
      const val = parseFloat(editValue) || 0;
      if (editingCell.endsWith("__prognoza") && editingCell in serverForecastLookup) {
        const { catId, itemIdx, month } = parseCellKey(editingCell);
        if (val === 0) {
          fetch("/api/operational-cost-forecasts/delete", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            credentials: "include",
            body: JSON.stringify({ year: selectedYear, month, categoryId: catId, itemIndex: itemIdx }),
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/operational-cost-forecasts"] });
          });
        } else {
          apiRequest("POST", "/api/operational-cost-forecasts/bulk", {
            entries: [{ year: selectedYear, month, categoryId: catId, itemIndex: itemIdx, forecast: String(val) }],
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/operational-cost-forecasts"] });
          });
        }
        setEditingCell(null);
        return;
      }
      const newData = { ...cellData };
      if (val === 0) {
        delete newData[editingCell];
      } else {
        newData[editingCell] = val;
      }
      setCellData(newData);
      queueCellSave(editingCell, val, selectedYear);
      if (val > 0 && editingCell.endsWith("__rzeczywiste")) {
        const { catId, itemIdx, month } = parseCellKey(editingCell);
        const prognozaKey = makeCellKey(catId, itemIdx, month, "prognoza");
        const hasServerForecast = prognozaKey in serverForecastLookup;
        const hasLocalForecast = prognozaKey in newData && newData[prognozaKey] > 0;
        if (!hasServerForecast && !hasLocalForecast) {
          const cat = categories.find(c => c.id === catId);
          const item = cat?.items[itemIdx];
          if (cat && item) {
            setForecastPrompt({
              catId, itemIdx, month, amount: val,
              itemName: item.name, catTitle: cat.title,
            });
            setForecastPromptOption("remaining");
          }
        }
      }
      setEditingCell(null);
    }
  }, [editingCell, editValue, cellData, selectedYear, serverForecastLookup, categories, parseCellKey, queueCellSave]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleFillToEnd = useCallback((catId: string, itemIdx: number, month: number, field: "prognoza" | "rzeczywiste") => {
    const sourceKey = makeCellKey(catId, itemIdx, month, field);
    const sourceVal = getCellValue(sourceKey);
    if (sourceVal === 0) return;

    if (field === "prognoza" && sourceKey in serverForecastLookup) {
      const entries = [];
      for (let m = month; m < 12; m++) {
        entries.push({ year: selectedYear, month: m, categoryId: catId, itemIndex: itemIdx, forecast: String(sourceVal) });
      }
      apiRequest("POST", "/api/operational-cost-forecasts/bulk", { entries }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/operational-cost-forecasts"] });
      });
      return;
    }

    const newData = { ...cellData };
    for (let m = month; m < 12; m++) {
      const k = makeCellKey(catId, itemIdx, m, field);
      newData[k] = sourceVal;
      queueCellSave(k, sourceVal, selectedYear);
    }
    setCellData(newData);
  }, [cellData, selectedYear, serverForecastLookup, getCellValue, queueCellSave]);

  const handleCopyForecastToNextYear = useCallback(async () => {
    const nextYear = selectedYear + 1;
    const cells: Array<{ year: number; catId: string; itemIdx: number; month: number; prognoza: number; realized: number }> = [];
    for (const cat of categories) {
      cat.items.forEach((_, itemIdx) => {
        for (let m = 0; m < 12; m++) {
          const sourceKey = makeCellKey(cat.id, itemIdx, m, "prognoza");
          const val = cellData[sourceKey] || 0;
          if (val !== 0) {
            cells.push({ year: nextYear, catId: cat.id, itemIdx, month: m, prognoza: val, realized: 0 });
          }
        }
      });
    }
    if (cells.length > 0) {
      await fetch("/api/op-cost-data/bulk", { method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, credentials: "include", body: JSON.stringify({ cells }) });
      queryClient.invalidateQueries({ queryKey: ["/api/op-cost-data", nextYear] });
    }
    setShowCopyToNextYear(false);
  }, [selectedYear, categories, cellData]);

  const startEditingName = useCallback((catId: string, itemIdx: number) => {
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const item = cat.items[itemIdx];
    const key = `${catId}__${itemIdx}`;
    setEditingName(key);
    setEditNameValue(item.name);
    setEditSubLabelValue(item.subLabel || "");
  }, [categories]);

  const commitNameEdit = useCallback(() => {
    if (!editingName) return;
    const [catId, idxStr] = editingName.split("__");
    const idx = parseInt(idxStr);
    const trimmedName = editNameValue.trim();
    if (!trimmedName) { setEditingName(null); return; }
    const newCats = categories.map(cat => {
      if (cat.id !== catId) return cat;
      const newItems = [...cat.items];
      newItems[idx] = { ...newItems[idx], name: trimmedName, subLabel: editSubLabelValue.trim() || undefined };
      return { ...cat, items: newItems };
    });
    updateCategories(newCats);
    setEditingName(null);
  }, [editingName, editNameValue, editSubLabelValue, categories, updateCategories]);

  const cancelNameEdit = useCallback(() => {
    setEditingName(null);
  }, []);

  const handleAddItem = useCallback(() => {
    if (!addItemCatId || !newItemName.trim()) return;
    const newCats = categories.map(cat => {
      if (cat.id !== addItemCatId) return cat;
      return {
        ...cat,
        items: [...cat.items, { name: newItemName.trim(), subLabel: newItemSubLabel.trim() || undefined }],
      };
    });
    updateCategories(newCats);
    setNewItemName("");
    setNewItemSubLabel("");
    setAddItemCatId(null);
  }, [addItemCatId, newItemName, newItemSubLabel, categories, updateCategories]);

  const handleDeleteItem = useCallback((catId: string, itemIdx: number) => {
    const newCats = categories.map(cat => {
      if (cat.id !== catId) return cat;
      const newItems = cat.items.filter((_, i) => i !== itemIdx);
      return { ...cat, items: newItems };
    });
    updateCategories(newCats);
    fetch(`/api/op-cost-data/item/${encodeURIComponent(catId)}/${itemIdx}`, {
      method: "DELETE",
      credentials: "include",
    }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/op-cost-data"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operational-cost-forecasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-schedules"] });
    });
  }, [categories, updateCategories]);

  const handleAddCategory = useCallback(() => {
    if (!newCatTitle.trim()) return;
    const id = newCatTitle.trim().toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]/g, "-").replace(/-+/g, "-");
    const newCat: CostCategory = {
      id: `${id}-${Date.now()}`,
      title: newCatTitle.trim().toUpperCase(),
      color: newCatColor,
      items: [],
    };
    updateCategories([...categories, newCat]);
    setNewCatTitle("");
    setNewCatColor(COLOR_PRESETS[0].hex);
    setShowAddCategory(false);
  }, [newCatTitle, newCatColor, categories, updateCategories]);

  const handleDeleteCategory = useCallback((catId: string) => {
    updateCategories(categories.filter(c => c.id !== catId));
  }, [categories, updateCategories]);

  const openEditCatDialog = useCallback((cat: CostCategory) => {
    setEditCatDialog(cat);
    setEditCatTitle(cat.title);
    setEditCatColor(cat.color);
  }, []);

  const handleSaveEditCat = useCallback(() => {
    if (!editCatDialog || !editCatTitle.trim()) return;
    const newCats = categories.map(c => {
      if (c.id !== editCatDialog.id) return c;
      return { ...c, title: editCatTitle.trim().toUpperCase(), color: editCatColor };
    });
    updateCategories(newCats);
    setEditCatDialog(null);
  }, [editCatDialog, editCatTitle, editCatColor, categories, updateCategories]);

  const getCategorySummary = useCallback((cat: CostCategory, month: number, includeArchived = false) => {
    let prognoza = 0;
    let rzeczywiste = 0;
    cat.items.forEach((item, idx) => {
      if (!includeArchived && item.archived) return;
      prognoza += getCellValue(makeCellKey(cat.id, idx, month, "prognoza"));
      rzeczywiste += getCellValue(makeCellKey(cat.id, idx, month, "rzeczywiste"));
    });
    return { prognoza, rzeczywiste, saldo: prognoza - rzeczywiste };
  }, [getCellValue]);

  const getCategoryAnnualSummary = useCallback((cat: CostCategory, includeArchived = false) => {
    let prognoza = 0;
    let rzeczywiste = 0;
    for (let m = 0; m < 12; m++) {
      const s = getCategorySummary(cat, m, includeArchived);
      prognoza += s.prognoza;
      rzeczywiste += s.rzeczywiste;
    }
    return { prognoza, rzeczywiste, saldo: prognoza - rzeczywiste };
  }, [getCategorySummary]);

  const getItemAnnualSummary = useCallback((catId: string, itemIdx: number) => {
    let prognoza = 0;
    let rzeczywiste = 0;
    for (let m = 0; m < 12; m++) {
      prognoza += getCellValue(makeCellKey(catId, itemIdx, m, "prognoza"));
      rzeczywiste += getCellValue(makeCellKey(catId, itemIdx, m, "rzeczywiste"));
    }
    return { prognoza, rzeczywiste, saldo: prognoza - rzeczywiste };
  }, [getCellValue]);

  const grandTotal = useMemo(() => {
    let prognoza = 0;
    let rzeczywiste = 0;
    activeCategories.forEach(cat => {
      const s = getCategoryAnnualSummary(cat);
      prognoza += s.prognoza;
      rzeczywiste += s.rzeczywiste;
    });
    return { prognoza, rzeczywiste, saldo: prognoza - rzeczywiste };
  }, [activeCategories, getCategoryAnnualSummary]);

  const currentMonthTableTotals = useMemo(() => {
    let prognoza = 0;
    let rzeczywiste = 0;
    activeCategories.forEach(cat => {
      const s = getCategorySummary(cat, currentMonth);
      prognoza += s.prognoza;
      rzeczywiste += s.rzeczywiste;
    });
    return { prognoza, rzeczywiste };
  }, [activeCategories, getCategorySummary, currentMonth]);

  useEffect(() => {
    onTotalsChange?.(grandTotal.prognoza, grandTotal.rzeczywiste);
  }, [grandTotal.prognoza, grandTotal.rzeczywiste]);

  const MONTHS_SHORT_CHART = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
  const monthlySummaryChart = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      let prognoza = 0;
      let rzeczywiste = 0;
      activeCategories.forEach(cat => {
        const s = getCategorySummary(cat, m);
        prognoza += s.prognoza;
        rzeczywiste += s.rzeczywiste;
      });
      return { name: MONTHS_SHORT_CHART[m], Prognoza: Math.round(prognoza), Rzeczywiste: Math.round(rzeczywiste) };
    });
  }, [activeCategories, getCategorySummary]);

  useEffect(() => {
    if (!onMonthlyDataChange) return;
    onMonthlyDataChange(monthlySummaryChart.map(m => ({ p: m.Prognoza, r: m.Rzeczywiste })));
  }, [monthlySummaryChart]);

  const [showChart, setShowChart] = useState(false);

  const saldoColor = (n: number) => {
    if (n > 0) return "text-emerald-600 dark:text-emerald-400";
    if (n < 0) return "text-red-600 dark:text-red-400";
    return "";
  };

  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  const { data: compareDbRows = [] } = useQuery<Array<{ catId: string; itemIdx: number; month: number; prognoza: string | null; realized: string | null }>>({
    queryKey: ["/api/op-cost-data", compareYear],
    queryFn: async () => {
      if (compareYear === null) return [];
      const res = await fetch(`/api/op-cost-data?year=${compareYear}`, { credentials: "include", headers: { ...getAuthHeaders() } });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: compareYear !== null,
    staleTime: 60000,
  });

  const compareCellData = useMemo(() => {
    if (compareYear === null) return {};
    return apiRowsToCellData(compareDbRows);
  }, [compareYear, compareDbRows]);

  const compareScheduleOverlay = useMemo(() => {
    if (compareYear === null) return {};
    return buildScheduleOverlay(costSchedules, costSchedulePayments, compareYear);
  }, [compareYear, costSchedules, costSchedulePayments]);

  const compareMonthlyTotals = useMemo(() => {
    if (compareYear === null) return Array(12).fill(0) as number[];
    return Array.from({ length: 12 }, (_, m) => {
      let total = 0;
      activeCategories.forEach(cat => {
        cat.items.forEach((_, idx) => {
          const key = makeCellKey(cat.id, idx, m, "rzeczywiste");
          if (key in compareScheduleOverlay) {
            total += compareScheduleOverlay[key];
          } else {
            total += compareCellData[key] || 0;
          }
        });
      });
      return total;
    });
  }, [compareYear, activeCategories, compareCellData, compareScheduleOverlay]);

  const currentMonthlyTotals = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      let total = 0;
      activeCategories.forEach(cat => {
        const s = getCategorySummary(cat, m);
        total += s.rzeczywiste;
      });
      return total;
    });
  }, [activeCategories, getCategorySummary]);

  const yoyChartData = useMemo(() => {
    if (compareYear === null) return [];
    return MONTHS_SHORT_CHART.map((name, i) => ({
      name,
      [selectedYear]: Math.round(currentMonthlyTotals[i]),
      [compareYear]: Math.round(compareMonthlyTotals[i]),
    }));
  }, [compareYear, selectedYear, currentMonthlyTotals, compareMonthlyTotals]);

  const handleGeneratePayments = async (schedule: CostSchedule) => {
    const existing = paymentsBySchedule[schedule.id] || [];
    const existingDates = new Set(existing.map(p => p.dueDate));
    const dates = generatePaymentDates(schedule.startDate, schedule.endDate, schedule.frequency);
    const newDates = dates.filter(d => !existingDates.has(d));
    if (newDates.length === 0) {
      toast({ title: "Brak nowych terminów do wygenerowania" });
      return;
    }
    for (const dueDate of newDates) {
      await createPayment.mutateAsync({
        scheduleId: schedule.id,
        dueDate,
        amount: schedule.amount,
        status: "NIEOPLACONE",
      });
    }
    toast({ title: `Wygenerowano ${newDates.length} płatności` });
  };

  const handleTogglePaymentStatus = (payment: CostSchedulePayment) => {
    const newStatus = payment.status === "OPLACONE" ? "NIEOPLACONE" : "OPLACONE";
    updatePayment.mutate({
      id: payment.id,
      data: {
        status: newStatus,
        paidDate: newStatus === "OPLACONE" ? format(new Date(), "yyyy-MM-dd") : null,
      },
    });
  };

  const openItemSheet = useCallback((catId: string, itemIdx: number) => {
    setSheetItem({ catId, itemIdx });
  }, []);

  const openScheduleDialogForItem = useCallback(() => {
    setShowScheduleDialog(true);
    setEditSchedule(null);
  }, []);

  const sheetItemData = useMemo(() => {
    if (!sheetItem) return null;
    const cat = categories.find(c => c.id === sheetItem.catId);
    if (!cat) return null;
    const item = cat.items[sheetItem.itemIdx];
    if (!item) return null;
    return { cat, item };
  }, [sheetItem, categories]);

  const selectedCategory = useMemo(() => {
    if (!selectedCatId) return null;
    return categories.find(c => c.id === selectedCatId) || null;
  }, [selectedCatId, categories]);

  const renderCategoryCard = (cat: CostCategory) => {
    const catHex = getCatBgColor(cat.color);
    const headerBg = catHex || 'hsl(var(--sidebar))';
    let catYearP = 0, catYearR = 0;

    return (
      <Card key={cat.id} className="overflow-hidden border-sidebar-border" style={{ borderColor: headerBg }} data-testid={`card-category-${cat.id}`}>
        <CardHeader className="px-3 py-2" style={{ backgroundColor: headerBg, color: '#fff', minHeight: '36px' }}>
          <div className="flex items-center justify-between gap-2" style={{ minHeight: '20px' }}>
            <CardTitle
              className="text-xs font-bold leading-tight cursor-pointer hover:underline"
              style={{ color: '#fff' }}
              onClick={() => { setDrillLevel("items"); setSelectedCatId(cat.id); }}
              data-testid={`text-category-name-${cat.id}`}
            >
              {cat.title}
            </CardTitle>
            <div className="flex items-center gap-0.5 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setAddItemCatId(cat.id); }}
                className="p-1 rounded hover:bg-white/10"
                style={{ color: '#fff' }}
                title="Dodaj pozycję"
                data-testid={`button-add-item-${cat.id}`}
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded hover:bg-white/10 shrink-0" style={{ color: '#fff' }} data-testid={`button-options-cat-${cat.id}`}>
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[140px]">
                  <DropdownMenuItem onClick={() => openEditCatDialog(cat)} data-testid={`btn-edit-cat-${cat.id}`}>
                    <Pencil className="h-3 w-3 mr-2" /> Edytuj
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleArchiveCategory(cat.id)} data-testid={`btn-archive-${cat.id}`}>
                    <Archive className="h-3 w-3 mr-2" /> Archiwizuj
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { if (window.confirm(`Usunąć kategorię "${cat.title}" i wszystkie jej pozycje?`)) handleDeleteCategory(cat.id); }} className="text-destructive" data-testid={`button-delete-category-${cat.id}`}>
                    <Trash2 className="h-3 w-3 mr-2" /> Usuń
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-[11px] sm:text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '26%' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: 'hsl(var(--sidebar) / 0.08)' }}>
                <th className="border-b border-r border-border px-2 py-1 text-left font-medium text-[10px] text-muted-foreground">Mies.</th>
                <th className="border-b border-r border-border/60 px-1 py-1 text-center font-medium text-[10px] text-muted-foreground">P</th>
                <th className="border-b border-r border-border/60 px-1 py-1 text-center font-medium text-[10px] text-muted-foreground">R</th>
                <th className="border-b border-border px-1 py-1 text-center font-medium text-[10px] text-muted-foreground">S</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS_LABELS.map((monthLabel, mi) => {
                const isCurrentMo = mi === currentMonth && selectedYear === currentYear;
                const s = getCategorySummary(cat, mi);
                catYearP += s.prognoza;
                catYearR += s.rzeczywiste;
                return (
                  <tr
                    key={mi}
                    className={`transition-colors duration-300 hover:bg-muted/20 dark:hover:bg-muted/10
                      ${isCurrentMo ? "bg-primary/[0.06] dark:bg-primary/[0.08]" : ""}`}
                    data-testid={`row-cat-month-${cat.id}-${mi}`}
                  >
                    <td className="border-b border-r border-border px-2 py-1 font-semibold text-[10px]">
                      <div className="flex items-center gap-1">
                        <span>{monthLabel}</span>
                        {isCurrentMo && <Badge variant="secondary" className="text-[7px] px-0.5 py-0 h-3.5 leading-none">teraz</Badge>}
                      </div>
                    </td>
                    <td className="border-b border-r border-border/60 px-1.5 py-1 text-right tabular-nums text-[10px] text-muted-foreground">{formatNum(s.prognoza)}</td>
                    <td className="border-b border-r border-border/60 px-1.5 py-1 text-right tabular-nums text-[10px] font-medium">{formatNum(s.rzeczywiste)}</td>
                    <td className={`border-b border-border px-1.5 py-1 text-right tabular-nums text-[10px] font-semibold ${saldoColor(s.saldo)}`}>{formatNum(s.saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold" style={{ backgroundColor: headerBg, color: '#fff' }}>
                <td className="border-t px-2 py-1.5 text-[10px]">ROCZNIE</td>
                <td className="border-t px-1.5 py-1.5 text-right tabular-nums text-[10px]" style={{ opacity: 0.7 }}>{formatNum(catYearP)}</td>
                <td className="border-t px-1.5 py-1.5 text-right tabular-nums text-[10px]">{formatNum(catYearR)}</td>
                <td className="border-t px-1.5 py-1.5 text-right tabular-nums text-[10px]" style={{ color: (catYearP - catYearR) > 0 ? '#4ade80' : (catYearP - catYearR) < 0 ? '#f87171' : '#fff' }}>{formatNum(catYearP - catYearR)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    );
  };

  const renderItemCard = (cat: CostCategory, item: CostItem, idx: number) => {
    const catHex = getCatBgColor(cat.color);
    const headerBg = catHex || 'hsl(var(--sidebar))';
    let itemYearP = 0, itemYearR = 0;
    const nameKey = `${cat.id}__${idx}`;
    const isEditingThisName = editingName === nameKey;
    const hasLinkedSchedule = costSchedules.some(
      s => s.linkCategoryId === cat.id && s.linkItemIndex === idx
    );

    return (
      <Card key={`${cat.id}-${idx}`} className="overflow-hidden border-sidebar-border" style={{ borderColor: headerBg }} data-testid={`card-item-${cat.id}-${idx}`}>
        <CardHeader className="px-3 py-2" style={{ backgroundColor: headerBg, color: '#fff', minHeight: '36px' }}>
          <div className="flex items-center justify-between gap-2" style={{ minHeight: '20px' }}>
            {isEditingThisName ? (
              <div className="space-y-0.5 flex-1">
                <input
                  autoFocus
                  value={editNameValue}
                  onChange={e => setEditNameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitNameEdit();
                    if (e.key === "Escape") cancelNameEdit();
                  }}
                  className="w-full px-1 py-0.5 text-xs font-medium bg-white/20 outline-none rounded-sm text-white placeholder-white/60"
                  placeholder="Nazwa"
                  data-testid={`input-name-${nameKey}`}
                />
                <input
                  value={editSubLabelValue}
                  onChange={e => setEditSubLabelValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") commitNameEdit();
                    if (e.key === "Escape") cancelNameEdit();
                  }}
                  onBlur={commitNameEdit}
                  className="w-full px-1 py-0.5 text-[10px] bg-white/10 outline-none rounded-sm text-white/70 placeholder-white/40"
                  placeholder="Podtytuł (opcjonalnie)"
                  data-testid={`input-sublabel-${nameKey}`}
                />
              </div>
            ) : (
              <div
                className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer"
                onClick={() => openItemSheet(cat.id, idx)}
                onDoubleClick={(e) => { e.stopPropagation(); startEditingName(cat.id, idx); }}
              >
                <CardTitle className="text-xs font-bold leading-tight truncate" style={{ color: '#fff' }} data-testid={`text-item-name-${cat.id}-${idx}`}>
                  {item.name}
                </CardTitle>
                {item.subLabel && <span className="text-[10px] opacity-70 truncate">({item.subLabel})</span>}
                {hasLinkedSchedule && <Link2 className="h-2.5 w-2.5 opacity-60 shrink-0" />}
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 rounded hover:bg-white/10 shrink-0" style={{ color: '#fff' }} data-testid={`button-options-item-${cat.id}-${idx}`}>
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem onClick={() => startEditingName(cat.id, idx)} data-testid={`btn-edit-name-${cat.id}-${idx}`}>
                  <Pencil className="h-3 w-3 mr-2" /> Edytuj nazwę
                </DropdownMenuItem>
                {serverForecasts.some(f => f.categoryId === cat.id && f.itemIndex === idx) && (
                  <DropdownMenuItem onClick={() => {
                    if (window.confirm(`Wyczyścić wszystkie prognozy dla "${item.name}"?`)) {
                      const toDelete = serverForecasts.filter(f => f.categoryId === cat.id && f.itemIndex === idx);
                      Promise.all(toDelete.map(f =>
                        fetch("/api/operational-cost-forecasts/delete", {
                          method: "POST",
                          headers: { "Content-Type": "application/json", ...getAuthHeaders() },
                          credentials: "include",
                          body: JSON.stringify({ year: f.year, month: f.month, categoryId: f.categoryId, itemIndex: f.itemIndex }),
                        })
                      )).then(() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/operational-cost-forecasts"] });
                        toast({ title: "Wyczyszczono prognozy" });
                      });
                    }
                  }} data-testid={`button-clear-forecasts-${cat.id}-${idx}`}>
                    <XCircle className="h-3 w-3 mr-2" /> Wyczyść prognozy
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleArchiveItem(cat.id, idx)} data-testid={`button-archive-item-${cat.id}-${idx}`}>
                  <Archive className="h-3 w-3 mr-2" /> Archiwizuj
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { if (window.confirm(`Usunąć pozycję "${item.name}"?`)) handleDeleteItem(cat.id, idx); }} className="text-destructive" data-testid={`button-delete-item-${cat.id}-${idx}`}>
                  <Trash2 className="h-3 w-3 mr-2" /> Usuń
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-[11px] sm:text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '26%' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: 'hsl(var(--sidebar) / 0.08)' }}>
                <th className="border-b border-r border-border px-2 py-1 text-left font-medium text-[10px] text-muted-foreground">Mies.</th>
                <th className="border-b border-r border-border/60 px-1 py-1 text-center font-medium text-[10px] text-muted-foreground">P</th>
                <th className="border-b border-r border-border/60 px-1 py-1 text-center font-medium text-[10px] text-muted-foreground">R</th>
                <th className="border-b border-border px-1 py-1 text-center font-medium text-[10px] text-muted-foreground">S</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS_LABELS.map((monthLabel, mi) => {
                const isCurrentMo = mi === currentMonth && selectedYear === currentYear;
                const pKey = makeCellKey(cat.id, idx, mi, "prognoza");
                const rKey = makeCellKey(cat.id, idx, mi, "rzeczywiste");
                const pVal = getCellValue(pKey);
                const rVal = getCellValue(rKey);
                const saldo = pVal - rVal;
                itemYearP += pVal;
                itemYearR += rVal;
                const payStatus = paymentStatusMap[`${cat.id}__${idx}__${mi}`];
                return (
                  <tr
                    key={mi}
                    className={`transition-colors duration-300 hover:bg-muted/20 dark:hover:bg-muted/10
                      ${isCurrentMo ? "bg-primary/[0.06] dark:bg-primary/[0.08]" : ""}
                      ${payStatus === "overdue" ? "bg-red-50/50 dark:bg-red-950/10" : ""}
                      ${payStatus === "paid" ? "bg-emerald-50/30 dark:bg-emerald-950/10" : ""}`}
                    data-testid={`row-item-month-${cat.id}-${idx}-${mi}`}
                  >
                    <td className="border-b border-r border-border px-2 py-1 font-semibold text-[10px]">
                      <div className="flex items-center gap-1">
                        {payStatus && (
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${payStatus === "paid" ? "bg-emerald-500" : payStatus === "overdue" ? "bg-red-500" : "bg-amber-500"}`} title={payStatus === "paid" ? "Opłacone" : payStatus === "overdue" ? "Zaległe" : "Oczekujące"} />
                        )}
                        <span>{monthLabel}</span>
                        {isCurrentMo && <Badge variant="secondary" className="text-[7px] px-0.5 py-0 h-3.5 leading-none">teraz</Badge>}
                      </div>
                    </td>
                    <TransposedEditableCell
                      value={pVal}
                      isEditing={editingCell === pKey}
                      editValue={editValue}
                      onStartEdit={() => startEditing(pKey)}
                      onCommitEdit={commitEdit}
                      onCancelEdit={cancelEdit}
                      onEditValueChange={setEditValue}
                      isCurrentMonth={isCurrentMo}
                      className="text-muted-foreground"
                      isServerManaged={pKey in serverForecastLookup}
                      onCommitAndMoveDown={() => {
                        commitEdit();
                        if (mi < 11) setTimeout(() => startEditing(makeCellKey(cat.id, idx, mi + 1, "prognoza")), 0);
                      }}
                      onFillToEnd={mi < 11 ? () => handleFillToEnd(cat.id, idx, mi, "prognoza") : undefined}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown" && mi < 11) {
                          e.preventDefault();
                          startEditing(makeCellKey(cat.id, idx, mi + 1, "prognoza"));
                        }
                        if (e.key === "ArrowUp" && mi > 0) {
                          e.preventDefault();
                          startEditing(makeCellKey(cat.id, idx, mi - 1, "prognoza"));
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
                      onCommitAndMoveDown={() => {
                        commitEdit();
                        if (mi < 11) setTimeout(() => startEditing(makeCellKey(cat.id, idx, mi + 1, "rzeczywiste")), 0);
                      }}
                      onFillToEnd={mi < 11 ? () => handleFillToEnd(cat.id, idx, mi, "rzeczywiste") : undefined}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowDown" && mi < 11) {
                          e.preventDefault();
                          startEditing(makeCellKey(cat.id, idx, mi + 1, "rzeczywiste"));
                        }
                        if (e.key === "ArrowUp" && mi > 0) {
                          e.preventDefault();
                          startEditing(makeCellKey(cat.id, idx, mi - 1, "rzeczywiste"));
                        }
                        if (e.key === "ArrowLeft") {
                          e.preventDefault();
                          startEditing(pKey);
                        }
                      }}
                    />
                    <td className={`border-b border-border px-1.5 py-1 text-right tabular-nums text-[11px] font-semibold ${saldoColor(saldo)}`}>
                      {formatNum(saldo)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold" style={{ backgroundColor: headerBg, color: '#fff' }}>
                <td className="border-t px-2 py-1.5 text-[10px]">ROCZNIE</td>
                <td className="border-t px-1.5 py-1.5 text-right tabular-nums text-[10px]" style={{ opacity: 0.7 }}>{formatNum(itemYearP)}</td>
                <td className="border-t px-1.5 py-1.5 text-right tabular-nums text-[10px]">{formatNum(itemYearR)}</td>
                <td className="border-t px-1.5 py-1.5 text-right tabular-nums text-[10px]" style={{ color: (itemYearP - itemYearR) > 0 ? '#4ade80' : (itemYearP - itemYearR) < 0 ? '#f87171' : '#fff' }}>{formatNum(itemYearP - itemYearR)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    );
  };

  const renderRazemCard = (level: "categories" | "items") => {
    let totalYearP = 0, totalYearR = 0;
    const headerBg = 'hsl(var(--sidebar))';

    return (
      <Card className="overflow-hidden ring-2 ring-sidebar" style={{ borderColor: 'hsl(var(--sidebar))' }} data-testid="card-category-summary">
        <CardHeader className="px-3 py-2" style={{ backgroundColor: headerBg, color: '#fff', minHeight: '36px' }}>
          <div className="flex items-center justify-between gap-2" style={{ minHeight: '20px' }}>
            <CardTitle className="text-xs font-bold leading-tight" style={{ color: '#fff' }} data-testid="card-title-summary">
              RAZEM
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0" style={{ backgroundColor: 'hsl(var(--sidebar) / 0.95)' }}>
          <table className="w-full text-[11px] sm:text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '26%' }} />
              <col style={{ width: '26%' }} />
            </colgroup>
            <thead>
              <tr style={{ backgroundColor: 'hsl(var(--sidebar) / 0.8)' }}>
                <th className="border-b border-r border-sidebar-border/30 px-2 py-1 text-left font-medium text-[10px]" style={{ color: 'hsl(var(--sidebar-foreground) / 0.5)' }}>Mies.</th>
                <th className="border-b border-r border-sidebar-border/30 px-1 py-1 text-center font-medium text-[10px]" style={{ color: 'hsl(var(--sidebar-foreground) / 0.5)' }}>P</th>
                <th className="border-b border-r border-sidebar-border/30 px-1 py-1 text-center font-medium text-[10px]" style={{ color: 'hsl(var(--sidebar-foreground) / 0.5)' }}>R</th>
                <th className="border-b border-sidebar-border/30 px-1 py-1 text-center font-medium text-[10px]" style={{ color: 'hsl(var(--sidebar-foreground) / 0.5)' }}>S</th>
              </tr>
            </thead>
            <tbody>
              {MONTHS_LABELS.map((monthLabel, mi) => {
                const isCurrentMo = mi === currentMonth && selectedYear === currentYear;
                let pVal = 0, rVal = 0;

                if (level === "categories") {
                  activeCategories.forEach(cat => {
                    const s = getCategorySummary(cat, mi);
                    pVal += s.prognoza;
                    rVal += s.rzeczywiste;
                  });
                } else if (selectedCategory) {
                  selectedCategory.items.forEach((item, itemIdx) => {
                    if (item.archived) return;
                    pVal += getCellValue(makeCellKey(selectedCategory.id, itemIdx, mi, "prognoza"));
                    rVal += getCellValue(makeCellKey(selectedCategory.id, itemIdx, mi, "rzeczywiste"));
                  });
                }

                const saldo = pVal - rVal;
                totalYearP += pVal;
                totalYearR += rVal;

                return (
                  <tr
                    key={mi}
                    className="hover:bg-white/5"
                    style={{ color: 'hsl(var(--sidebar-foreground))' }}
                    data-testid={`row-summary-month-${mi}`}
                  >
                    <td className="border-b border-r border-sidebar-border/30 px-2 py-1 font-semibold text-[10px]" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
                      <div className="flex items-center gap-1">
                        <span>{monthLabel}</span>
                        {isCurrentMo && <Badge variant="secondary" className="text-[7px] px-0.5 py-0 h-3.5 leading-none">teraz</Badge>}
                      </div>
                    </td>
                    <td className="border-b border-r border-sidebar-border/30 px-1.5 py-1 text-right tabular-nums text-[10px] font-semibold" style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)' }}>{formatNum(pVal)}</td>
                    <td className="border-b border-r border-sidebar-border/30 px-1.5 py-1 text-right tabular-nums text-[10px] font-bold" style={{ color: 'hsl(var(--sidebar-foreground))' }}>{formatNum(rVal)}</td>
                    <td className="border-b border-sidebar-border/30 px-1.5 py-1 text-right tabular-nums text-[10px] font-bold" style={{ color: saldo > 0 ? '#4ade80' : saldo < 0 ? '#f87171' : 'hsl(var(--sidebar-foreground))' }}>{formatNum(saldo)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-bold" style={{ backgroundColor: 'hsl(var(--sidebar))', color: '#fff' }}>
                <td className="border-t border-sidebar-border/30 px-2 py-1.5 text-[10px]">ROCZNIE</td>
                <td className="border-t border-sidebar-border/30 px-1.5 py-1.5 text-right tabular-nums text-[10px]" style={{ opacity: 0.7 }}>{formatNum(totalYearP)}</td>
                <td className="border-t border-sidebar-border/30 px-1.5 py-1.5 text-right tabular-nums text-[10px]">{formatNum(totalYearR)}</td>
                <td className="border-t border-sidebar-border/30 px-1.5 py-1.5 text-right tabular-nums text-[10px]" style={{ color: (totalYearP - totalYearR) > 0 ? '#4ade80' : (totalYearP - totalYearR) < 0 ? '#f87171' : '#fff' }}>{formatNum(totalYearP - totalYearR)}</td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="Opłaty"
          description="Zarządzanie kosztami i wydatkami."
          icon={Receipt}
          actions={
            <>
              <Button variant="outline" onClick={() => setShowCopyToNextYear(true)} data-testid="button-copy-forecast-next-year">
                <ArrowRight className="mr-1 h-4 w-4" /> Kopiuj prognozę na {selectedYear + 1}
              </Button>
              <Button variant="outline" onClick={() => setShowAddCategory(true)} data-testid="button-add-category">
                <Plus className="mr-1 h-4 w-4" /> Kategoria
              </Button>
              <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                <SelectTrigger className="w-[120px]" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={compareYear !== null ? compareYear.toString() : "none"}
                onValueChange={(v) => setCompareYear(v === "none" ? null : parseInt(v))}
              >
                <SelectTrigger className="w-[160px]" data-testid="select-compare-year">
                  <SelectValue placeholder="Porównaj z..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Brak —</SelectItem>
                  {years.filter(y => y !== selectedYear).map(y => (
                    <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />
      )}

      {embedded && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowCopyToNextYear(true)} data-testid="button-copy-forecast-next-year">
            <ArrowRight className="mr-1 h-4 w-4" /> Kopiuj prognozę na {selectedYear + 1}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddCategory(true)} data-testid="button-add-category">
            <Plus className="mr-1 h-4 w-4" /> Kategoria
          </Button>
          <Select
            value={compareYear !== null ? compareYear.toString() : "none"}
            onValueChange={(v) => setCompareYear(v === "none" ? null : parseInt(v))}
          >
            <SelectTrigger className="w-[160px]" data-testid="select-compare-year">
              <SelectValue placeholder="Porównaj z..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Brak —</SelectItem>
              {years.filter(y => y !== selectedYear).map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Do opłacenia ({MONTHS_SHORT[currentMonth]})</p>
            </div>
            <p className="text-lg sm:text-xl font-bold mt-1 tabular-nums" data-testid="text-current-unpaid">{formatNum2(currentMonthTableTotals.prognoza)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Opłacone ({MONTHS_SHORT[currentMonth]})</p>
            </div>
            <p className="text-lg sm:text-xl font-bold mt-1 text-green-600 tabular-nums" data-testid="text-paid-this-month">{formatNum2(currentMonthTableTotals.rzeczywiste)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Prognoza roczna</p>
            <p className="text-lg sm:text-xl font-bold mt-1 tabular-nums" data-testid="text-total-prognoza">{grandTotal.prognoza.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
            <p className="text-xs text-muted-foreground mt-0.5">Zrealizowane: {grandTotal.rzeczywiste.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Button variant="outline" size="sm" onClick={() => setShowChart(!showChart)} data-testid="button-toggle-chart">
          <BarChart3 className="mr-1 h-3 w-3" /> {showChart ? "Ukryj wykres" : "Pokaż wykres"}
        </Button>
      </div>

      {showChart && (
        <Card className="mb-4" data-testid="card-monthly-chart">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm">Prognoza vs Rzeczywiste - podsumowanie miesięczne</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={200}>
              <RechartsBarChart data={monthlySummaryChart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number) => [`${value.toLocaleString("pl-PL")} zł`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Prognoza" fill="#6366f1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Rzeczywiste" fill="#00CCFF" radius={[2, 2, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {compareYear !== null && (
        <>
          <Card data-testid="card-yoy-expenses-chart" className="mb-4">
            <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm">Koszty rzeczywiste: {selectedYear} vs {compareYear}</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={yoyChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 10 }} className="fill-muted-foreground" tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => [`${value.toLocaleString("pl-PL")} zł`]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey={selectedYear.toString()} stroke="#00CCFF" strokeWidth={2} dot={{ r: 3 }} name={`${selectedYear}`} />
                  <Line type="monotone" dataKey={compareYear.toString()} stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name={`${compareYear}`} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card data-testid="card-yoy-expenses-comparison" className="mb-4">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">Porównanie rok do roku: {selectedYear} vs {compareYear}</CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/60 dark:bg-muted/40">
                      <th className="border-b border-border px-3 py-1.5 text-left font-medium">Miesiąc</th>
                      <th className="border-b border-border px-3 py-1.5 text-right font-medium">{selectedYear} (koszty)</th>
                      <th className="border-b border-border px-3 py-1.5 text-right font-medium">{compareYear} (koszty)</th>
                      <th className="border-b border-border px-3 py-1.5 text-right font-medium">Zmiana</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS_SHORT_CHART.map((monthName, i) => {
                      const curr = currentMonthlyTotals[i];
                      const prev = compareMonthlyTotals[i];
                      return (
                        <tr key={i} className="border-b border-border/50">
                          <td className="px-3 py-1.5 font-medium">{monthName}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatNum(curr)}</td>
                          <td className="px-3 py-1.5 text-right tabular-nums">{formatNum(prev)}</td>
                          <td className={`px-3 py-1.5 text-right tabular-nums font-medium ${costChangeColor(curr, prev)}`}>{pctChange(curr, prev)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bg-muted/60 dark:bg-muted/40 font-bold">
                      <td className="px-3 py-1.5">RAZEM</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatNum(currentMonthlyTotals.reduce((a, b) => a + b, 0))}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatNum(compareMonthlyTotals.reduce((a, b) => a + b, 0))}</td>
                      <td className={`px-3 py-1.5 text-right tabular-nums ${costChangeColor(currentMonthlyTotals.reduce((a, b) => a + b, 0), compareMonthlyTotals.reduce((a, b) => a + b, 0))}`}>
                        {pctChange(currentMonthlyTotals.reduce((a, b) => a + b, 0), compareMonthlyTotals.reduce((a, b) => a + b, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {drillLevel === "categories" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4" data-testid="grid-categories">
          {activeCategories.map(cat => renderCategoryCard(cat))}
          {renderRazemCard("categories")}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-2">
            <Button variant="outline" size="sm" onClick={() => { setDrillLevel("categories"); setSelectedCatId(null); }} data-testid="button-back-to-categories">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Powrót
            </Button>
            {selectedCategory && (
              <>
                <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: getCatBgColor(selectedCategory.color) }} />
                <h2 className="text-sm font-bold" data-testid="text-selected-category">{selectedCategory.title}</h2>
                <Badge variant="secondary" className="text-xs">{selectedCategory.items.filter(i => !i.archived).length} pozycji</Badge>
                <Button variant="outline" size="sm" onClick={() => setAddItemCatId(selectedCategory.id)} data-testid="button-add-item-drill">
                  <Plus className="mr-1 h-3 w-3" /> Pozycja
                </Button>
              </>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4" data-testid="grid-items">
            {selectedCategory?.items.map((item, idx) => {
              if (item.archived) return null;
              return renderItemCard(selectedCategory, item, idx);
            })}
            {renderRazemCard("items")}
          </div>
        </>
      )}

      {(archivedCategories.length > 0 || archivedItems.length > 0) && (
        <div className="mt-4" data-testid="archived-operational-costs">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
            data-testid="toggle-archive"
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Archive className="h-4 w-4" />
            ARCHIWUM
            <Badge variant="secondary" className="text-xs">{archivedCategories.length + archivedItems.length}</Badge>
          </button>
          {showArchived && (
            <div className="space-y-3 opacity-60">
              {archivedCategories.map(cat => {
                let catP = 0, catR = 0;
                cat.items.forEach((item, iIdx) => {
                  for (let mi = 0; mi < 12; mi++) {
                    catP += getCellValue(makeCellKey(cat.id, iIdx, mi, "prognoza"));
                    catR += getCellValue(makeCellKey(cat.id, iIdx, mi, "rzeczywiste"));
                  }
                });
                return (
                  <Card key={cat.id} className="overflow-hidden" data-testid={`card-archived-cat-${cat.id}`}>
                    <CardHeader className="px-3 py-2" style={{ backgroundColor: getCatBgColor(cat.color), color: '#fff' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-xs font-bold">{cat.title}</CardTitle>
                          <div className="flex gap-3 mt-1 text-[10px] opacity-80">
                            <span>P: {catP.toLocaleString("pl-PL")} zł</span>
                            <span>R: {catR.toLocaleString("pl-PL")} zł</span>
                            <span>S: {(catP - catR).toLocaleString("pl-PL")} zł</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestoreCategory(cat.id)}
                          className="p-1 rounded hover:bg-white/10"
                          title="Przywróć kategorię"
                          data-testid={`btn-restore-${cat.id}`}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
              {archivedItems.map(({ catId, catTitle, itemIdx, item }) => {
                let itemP = 0, itemR = 0;
                for (let mi = 0; mi < 12; mi++) {
                  itemP += getCellValue(makeCellKey(catId, itemIdx, mi, "prognoza"));
                  itemR += getCellValue(makeCellKey(catId, itemIdx, mi, "rzeczywiste"));
                }
                return (
                  <Card key={`${catId}-${itemIdx}`} className="overflow-hidden" data-testid={`card-archived-item-${catId}-${itemIdx}`}>
                    <CardContent className="py-2 px-3 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-medium">{item.name}</span>
                        {item.subLabel && <span className="text-[10px] text-muted-foreground ml-1">({item.subLabel})</span>}
                        <span className="text-[10px] text-muted-foreground ml-2">z: {catTitle}</span>
                        <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground">
                          <span>P: {itemP.toLocaleString("pl-PL")} zł</span>
                          <span>R: {itemR.toLocaleString("pl-PL")} zł</span>
                          <span>S: {(itemP - itemR).toLocaleString("pl-PL")} zł</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRestoreItem(catId, itemIdx)}
                        className="text-muted-foreground hover:text-emerald-600 p-1"
                        title="Przywróć pozycję"
                        data-testid={`button-restore-item-${catId}-${itemIdx}`}
                      >
                        <RotateCcw className="h-3 w-3" />
                      </button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Sheet open={!!sheetItem} onOpenChange={(open) => { if (!open) setSheetItem(null); }}>
        <SheetContent className="w-full sm:w-[480px] sm:max-w-[480px] overflow-y-auto" data-testid="sheet-cost-detail">
          {sheetItemData && sheetItem && (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{sheetItemData.item.name}</SheetTitle>
                {sheetItemData.item.subLabel && (
                  <p className="text-sm text-muted-foreground">{sheetItemData.item.subLabel}</p>
                )}
                <Badge variant="secondary" className="w-fit text-xs">{sheetItemData.cat.title}</Badge>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Prognoza {selectedYear}</p>
                    <p className="text-lg font-bold" data-testid="text-sheet-prognoza">
                      {getItemAnnualSummary(sheetItem.catId, sheetItem.itemIdx).prognoza.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Rzeczywiste</p>
                    <p className="text-lg font-bold" data-testid="text-sheet-rzeczywiste">
                      {getItemAnnualSummary(sheetItem.catId, sheetItem.itemIdx).rzeczywiste.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Saldo</p>
                    <p className={`text-lg font-bold ${saldoColor(getItemAnnualSummary(sheetItem.catId, sheetItem.itemIdx).saldo)}`} data-testid="text-sheet-saldo">
                      {getItemAnnualSummary(sheetItem.catId, sheetItem.itemIdx).saldo >= 0 ? "+" : ""}
                      {getItemAnnualSummary(sheetItem.catId, sheetItem.itemIdx).saldo.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm">Powiązane harmonogramy</h3>
                    <Button size="sm" variant="outline" onClick={openScheduleDialogForItem} data-testid="button-add-schedule-from-sheet">
                      <Plus className="h-3 w-3 mr-1" /> Harmonogram
                    </Button>
                  </div>

                  {linkedSchedules.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Brak powiązanych harmonogramów. Dodaj harmonogram, aby automatycznie śledzić płatności.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {linkedSchedules.map(schedule => {
                        const payments = (paymentsBySchedule[schedule.id] || [])
                          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
                        const paidCount = payments.filter(p => p.status === "OPLACONE").length;
                        const overdueCount = payments.filter(
                          p => p.status === "NIEOPLACONE" && isBefore(parseISO(p.dueDate), new Date())
                        ).length;

                        return (
                          <SwipeableRow
                            key={schedule.id}
                            onSwipeLeft={() => {
                              if (confirm("Usunąć ten harmonogram i wszystkie powiązane płatności?")) {
                                deleteSchedule.mutate(schedule.id);
                              }
                            }}
                            leftLabel="Usuń"
                            leftIcon="delete"
                          >
                          <Card data-testid={`card-schedule-${schedule.id}`}>
                            <CardContent className="p-3 space-y-3">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium text-sm">{schedule.name}</p>
                                  <div className="flex flex-wrap items-center gap-1 mt-1">
                                    <Badge variant="secondary" className="text-xs">{schedule.category}</Badge>
                                    <Badge variant="outline" className="text-xs">{freqLabel(schedule.frequency)}</Badge>
                                    <span className="text-xs text-muted-foreground">{formatNum2(schedule.amount)} zł</span>
                                    {!schedule.active && <Badge variant="destructive" className="text-xs">Nieaktywny</Badge>}
                                  </div>
                                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                                    <span>od {schedule.startDate}</span>
                                    {schedule.endDate && <span>do {schedule.endDate}</span>}
                                    {payments.length > 0 && <span>{paidCount}/{payments.length} opłaconych</span>}
                                    {overdueCount > 0 && <span className="text-red-600 font-medium">{overdueCount} zaległych</span>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button size="icon" variant="ghost" onClick={() => handleGeneratePayments(schedule)} title="Generuj płatności" data-testid={`button-generate-${schedule.id}`}>
                                    <CalendarPlus className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => setEditSchedule(schedule)} data-testid={`button-edit-schedule-${schedule.id}`}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => {
                                    if (confirm("Usunąć ten harmonogram i wszystkie powiązane płatności?")) {
                                      deleteSchedule.mutate(schedule.id);
                                    }
                                  }} data-testid={`button-delete-schedule-${schedule.id}`}>
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              {payments.length > 0 && (
                                <div className="border-t pt-2 max-h-[300px] overflow-y-auto">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-left text-xs text-muted-foreground">
                                        <th className="py-1 px-1 font-medium">Termin</th>
                                        <th className="py-1 px-1 font-medium">Kwota</th>
                                        <th className="py-1 px-1 font-medium">Status</th>
                                        <th className="py-1 px-1 w-8"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {payments.map(payment => {
                                        const isOverdue = payment.status === "NIEOPLACONE" && isBefore(parseISO(payment.dueDate), new Date());
                                        return (
                                          <tr
                                            key={payment.id}
                                            className={`border-t ${isOverdue ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                                            data-testid={`row-payment-${payment.id}`}
                                          >
                                            <td className="py-1.5 px-1 text-xs">
                                              <span className={isOverdue ? "text-red-600 font-medium" : ""}>
                                                {format(parseISO(payment.dueDate), "dd.MM.yyyy")}
                                              </span>
                                            </td>
                                            <td className="py-1.5 px-1 text-xs font-medium">{formatNum2(payment.amount)} zł</td>
                                            <td className="py-1.5 px-1">
                                              <button onClick={() => handleTogglePaymentStatus(payment)} data-testid={`button-toggle-status-${payment.id}`}>
                                                {payment.status === "OPLACONE" ? (
                                                  <StatusBadge status="OPLACONE" className="no-default-hover-elevate no-default-active-elevate" />
                                                ) : (
                                                  <StatusBadge status="DO_OPLACENIA" className="no-default-hover-elevate no-default-active-elevate" />
                                                )}
                                              </button>
                                            </td>
                                            <td className="py-1.5 px-1">
                                              <Button size="icon" variant="ghost" onClick={() => {
                                                if (confirm("Usunąć tę płatność?")) deletePayment.mutate(payment.id);
                                              }} data-testid={`button-delete-payment-${payment.id}`}>
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                          </SwipeableRow>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ScheduleDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        onSave={(data) => createSchedule.mutate(data)}
        isPending={createSchedule.isPending}
        title="Dodaj harmonogram kosztów"
        defaultLinkCategoryId={sheetItem?.catId}
        defaultLinkItemIndex={sheetItem?.itemIdx}
      />

      {editSchedule && (
        <ScheduleDialog
          open={!!editSchedule}
          onOpenChange={(open) => { if (!open) setEditSchedule(null); }}
          onSave={(data) => updateScheduleMut.mutate({ id: editSchedule.id, data })}
          isPending={updateScheduleMut.isPending}
          title="Edytuj harmonogram"
          initial={editSchedule}
        />
      )}

      <Dialog open={addItemCatId !== null} onOpenChange={(open) => { if (!open) setAddItemCatId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Dodaj pozycję kosztową</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nazwa</Label>
              <Input
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                placeholder="np. NOWY PRACOWNIK"
                onKeyDown={e => { if (e.key === "Enter") handleAddItem(); }}
                data-testid="input-new-item-name"
              />
            </div>
            <div className="space-y-1">
              <Label>Podtytuł (opcjonalnie)</Label>
              <Input
                value={newItemSubLabel}
                onChange={e => setNewItemSubLabel(e.target.value)}
                placeholder="np. Dział, firma"
                onKeyDown={e => { if (e.key === "Enter") handleAddItem(); }}
                data-testid="input-new-item-sublabel"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddItem} disabled={!newItemName.trim()} data-testid="button-confirm-add-item">
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nowa kategoria kosztów</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nazwa kategorii</Label>
              <Input
                value={newCatTitle}
                onChange={e => setNewCatTitle(e.target.value)}
                placeholder="np. TRANSPORT"
                onKeyDown={e => { if (e.key === "Enter") handleAddCategory(); }}
                data-testid="input-new-category-name"
              />
            </div>
            <div className="space-y-1">
              <Label>Kolor</Label>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="color"
                  value={newCatColor}
                  onChange={e => setNewCatColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                  data-testid="input-new-category-color-picker"
                />
                <span className="text-xs text-muted-foreground">{newCatColor}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setNewCatColor(c.hex)}
                    className={`w-8 h-8 rounded-md ${newCatColor === c.hex ? "ring-2 ring-offset-2 ring-[#5ADBFA]" : ""}`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                    data-testid={`color-${c.label}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddCategory} disabled={!newCatTitle.trim()} data-testid="button-confirm-add-category">
              Dodaj kategorię
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editCatDialog !== null} onOpenChange={(open) => { if (!open) setEditCatDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edytuj kategorię</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nazwa kategorii</Label>
              <Input
                value={editCatTitle}
                onChange={e => setEditCatTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleSaveEditCat(); }}
                data-testid="input-edit-category-name"
              />
            </div>
            <div className="space-y-1">
              <Label>Kolor</Label>
              <div className="flex items-center gap-3 mb-2">
                <input
                  type="color"
                  value={isHexColor(editCatColor) ? editCatColor : getCatBgColor(editCatColor)}
                  onChange={e => setEditCatColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-border"
                  data-testid="input-edit-category-color-picker"
                />
                <span className="text-xs text-muted-foreground">{isHexColor(editCatColor) ? editCatColor : getCatBgColor(editCatColor)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c.hex}
                    onClick={() => setEditCatColor(c.hex)}
                    className={`w-8 h-8 rounded-md ${editCatColor === c.hex ? "ring-2 ring-offset-2 ring-[#5ADBFA]" : ""}`}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                    data-testid={`edit-color-${c.label}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditCatDialog(null)} data-testid="button-cancel-edit-category">Anuluj</Button>
            <Button onClick={handleSaveEditCat} disabled={!editCatTitle.trim()} data-testid="button-save-edit-category">
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCopyToNextYear} onOpenChange={setShowCopyToNextYear}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Kopiuj prognozę na {selectedYear + 1}</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm text-muted-foreground">
              Wszystkie wartości z kolumn <strong>P (Prognoza)</strong> z roku <strong>{selectedYear}</strong> zostaną skopiowane do kolumn <strong>P (Prognoza)</strong> na rok <strong>{selectedYear + 1}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">
              Jeśli w roku {selectedYear + 1} istnieją już prognozowane wartości, zostaną one nadpisane.
            </p>
            <p className="text-sm text-muted-foreground">
              Wartości rzeczywiste (R) nie zostaną zmienione.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCopyToNextYear(false)} data-testid="button-cancel-copy-forecast">
              Anuluj
            </Button>
            <Button onClick={handleCopyForecastToNextYear} data-testid="button-confirm-copy-forecast">
              <Copy className="mr-1 h-4 w-4" /> Kopiuj prognozę
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={forecastPrompt !== null} onOpenChange={(open) => { if (!open) setForecastPrompt(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-forecast-prompt">
          <DialogHeader>
            <DialogTitle>Dodać do prognozy?</DialogTitle>
          </DialogHeader>
          {forecastPrompt && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted-foreground">
                Wprowadzono koszt <strong>{forecastPrompt.amount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</strong> dla pozycji
                &ldquo;{forecastPrompt.itemName}&rdquo; ({forecastPrompt.catTitle}).
              </p>
              <p className="text-sm text-muted-foreground">
                Czy chcesz dodać tę kwotę do prognozy operacyjnej?
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="forecastOption" checked={forecastPromptOption === "one_time"} onChange={() => setForecastPromptOption("one_time")} data-testid="radio-forecast-one-time" />
                  Tylko {MONTHS_SHORT[forecastPrompt.month]} (jednorazowo)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="forecastOption" checked={forecastPromptOption === "remaining"} onChange={() => setForecastPromptOption("remaining")} data-testid="radio-forecast-remaining" />
                  {MONTHS_SHORT[forecastPrompt.month]} - GRU (pozostałe miesiące)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="forecastOption" checked={forecastPromptOption === "all"} onChange={() => setForecastPromptOption("all")} data-testid="radio-forecast-all" />
                  STY - GRU (cały rok)
                </label>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setForecastPrompt(null)} data-testid="btn-skip-forecast">
              Pomiń
            </Button>
            <Button
              size="sm"
              disabled={addToForecastMutation.isPending}
              onClick={() => {
                if (!forecastPrompt) return;
                let months: number[];
                if (forecastPromptOption === "one_time") {
                  months = [forecastPrompt.month];
                } else if (forecastPromptOption === "remaining") {
                  months = Array.from({ length: 12 - forecastPrompt.month }, (_, i) => forecastPrompt.month + i);
                } else {
                  months = Array.from({ length: 12 }, (_, i) => i);
                }
                addToForecastMutation.mutate({
                  catId: forecastPrompt.catId,
                  itemIdx: forecastPrompt.itemIdx,
                  months,
                  amount: forecastPrompt.amount,
                });
              }}
              data-testid="btn-confirm-forecast"
            >
              {addToForecastMutation.isPending ? "Dodaję..." : "Dodaj do prognozy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CostsExpenses() {
  return <CostsExpensesContent />;
}

function ScheduleDialog({
  open,
  onOpenChange,
  onSave,
  isPending,
  title,
  initial,
  defaultLinkCategoryId,
  defaultLinkItemIndex,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: Record<string, unknown>) => void;
  isPending: boolean;
  title: string;
  initial?: CostSchedule;
  defaultLinkCategoryId?: string;
  defaultLinkItemIndex?: number;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [category, setCategory] = useState(initial?.category || SCHEDULE_CATEGORIES[0]);
  const [amount, setAmount] = useState(initial?.amount || "");
  const [frequency, setFrequency] = useState(initial?.frequency || "monthly");
  const [startDate, setStartDate] = useState(initial?.startDate || format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(initial?.endDate || "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [active, setActive] = useState(initial?.active !== false);
  const [linkCategoryId, setLinkCategoryId] = useState(
    initial?.linkCategoryId || defaultLinkCategoryId || ""
  );
  const [linkItemIndex, setLinkItemIndex] = useState<string>(
    initial?.linkItemIndex !== null && initial?.linkItemIndex !== undefined
      ? String(initial.linkItemIndex)
      : defaultLinkItemIndex !== undefined
        ? String(defaultLinkItemIndex)
        : ""
  );

  const oplatyCategories = useMemo(() => loadOplatyCategories(), []);
  const selectedOplatyCat = useMemo(
    () => oplatyCategories.find(c => c.id === linkCategoryId),
    [oplatyCategories, linkCategoryId]
  );

  const handleSubmit = () => {
    if (!name || !amount || !startDate) return;
    onSave({
      name,
      category,
      amount,
      frequency,
      startDate,
      endDate: endDate || null,
      notes: notes || null,
      active,
      linkCategoryId: linkCategoryId || null,
      linkItemIndex: linkItemIndex !== "" ? parseInt(linkItemIndex) : null,
    });
  };

  return (
    <ResponsiveFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      className="max-w-lg max-h-[90vh] overflow-y-auto"
      footer={
        <div className="flex gap-2 w-full sm:w-auto sm:justify-end justify-stretch">
          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button
            className="flex-1 sm:flex-none"
            onClick={handleSubmit}
            disabled={isPending || !name || !amount || !startDate}
            data-testid="button-save-schedule"
          >
            {isPending ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </div>
      }
    >
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Nazwa</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Czynsz biuro, ZUS..."
              data-testid="input-schedule-name"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Kategoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-schedule-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Częstotliwość</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger data-testid="select-schedule-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Kwota (zł)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              data-testid="input-schedule-amount"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data rozpoczęcia</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-schedule-start"
              />
            </div>
            <div className="space-y-1">
              <Label>Data zakończenia</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-schedule-end"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Notatki</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              data-testid="input-schedule-notes"
            />
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Powiązanie z arkuszem Opłaty</p>
            <p className="text-xs text-muted-foreground mb-3">
              Wybierz pozycję w zakładce Koszty (Opłaty), aby automatycznie uzupełniać prognozę i rzeczywiste wydatki.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Kategoria Opłaty</Label>
                <Select
                  value={linkCategoryId}
                  onValueChange={(v) => { setLinkCategoryId(v); setLinkItemIndex(""); }}
                >
                  <SelectTrigger data-testid="select-link-category">
                    <SelectValue placeholder="Brak powiązania" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Brak powiązania</SelectItem>
                    {oplatyCategories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pozycja</Label>
                <Select
                  value={linkItemIndex}
                  onValueChange={setLinkItemIndex}
                  disabled={!linkCategoryId || linkCategoryId === "none"}
                >
                  <SelectTrigger data-testid="select-link-item">
                    <SelectValue placeholder="Wybierz pozycję" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedOplatyCat?.items.map((item, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {item.name}{item.subLabel ? ` (${item.subLabel})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {initial && (
            <div className="flex items-center gap-2">
              <Label>Aktywny</Label>
              <Button
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => setActive(!active)}
                data-testid="button-toggle-active"
              >
                {active ? "Tak" : "Nie"}
              </Button>
            </div>
          )}
        </div>
    </ResponsiveFormDialog>
  );
}
