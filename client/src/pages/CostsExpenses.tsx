import type React from "react";
import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CostSchedule, CostSchedulePayment, OperationalCostForecast } from "@shared/schema";
import { DEFAULT_OPLATY_CATEGORIES, loadOplatyCategories, type OplatyCostCategory, type OplatyCostItem } from "@/lib/oplaty-defaults";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { FullscreenWrapper, useFullscreen, FullscreenToggleButton } from "@/components/FullscreenWrapper";
import {
  ChevronDown, ChevronRight, Plus, Trash2, GripVertical, Copy, ArrowRight,
  Pencil, CalendarPlus, CheckCircle2, XCircle, AlertTriangle, Calendar, Link2, Receipt, BarChart3, Archive, RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { getHeatMapBg, Sparkline } from "@/components/DataVizHelpers";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { format, addMonths, addQuarters, addYears, parseISO, isBefore, isAfter, startOfMonth } from "date-fns";
import { pl } from "date-fns/locale";

type CostItem = OplatyCostItem;
type CostCategory = OplatyCostCategory;

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

const DEFAULT_CATEGORIES = DEFAULT_OPLATY_CATEGORIES;

const MONTHS_SHORT = [
  "STY", "LUT", "MAR", "KWI", "MAJ", "CZE",
  "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU",
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

function loadData(year: number): Record<CellKey, number> {
  try {
    const raw = localStorage.getItem(getStorageKey(year));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveData(year: number, data: Record<CellKey, number>) {
  localStorage.setItem(getStorageKey(year), JSON.stringify(data));
}

function loadCategories(): CostCategory[] {
  try {
    const raw = localStorage.getItem("oplaty-categories");
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_CATEGORIES;
}

function saveCategories(cats: CostCategory[]) {
  localStorage.setItem("oplaty-categories", JSON.stringify(cats));
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

export function CostsExpensesContent({ embedded = false, externalYear }: { embedded?: boolean; externalYear?: number }) {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [selectedYear, setSelectedYear] = useState(externalYear ?? currentYear);
  const [compareYear, setCompareYear] = useState<number | null>(null);
  const [cellData, setCellData] = useState<Record<CellKey, number>>(() => loadData(externalYear ?? currentYear));
  const [categories, setCategories] = useState<CostCategory[]>(() => loadCategories());

  useEffect(() => {
    if (externalYear !== undefined && externalYear !== selectedYear) {
      setSelectedYear(externalYear);
      setCellData(loadData(externalYear));
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

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
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
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0].value);
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
      toast({ title: "Dodano do prognozy", description: "Wartosci prognozowane zostaly zaktualizowane" });
      setForecastPrompt(null);
    },
    onError: () => {
      toast({ title: "Blad", description: "Nie udalo sie dodac do prognozy", variant: "destructive" });
    },
  });

  const dragCatRef = useRef<string | null>(null);
  const dragOverCatRef = useRef<string | null>(null);
  const dragItemRef = useRef<{ catId: string; idx: number } | null>(null);
  const dragOverItemRef = useRef<{ catId: string; idx: number } | null>(null);
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [dragItemKey, setDragItemKey] = useState<string | null>(null);

  const [selectedCell, setSelectedCell] = useState<CellKey | null>(null);
  const [fillRangeEnd, setFillRangeEnd] = useState<number | null>(null);
  const fillDragging = useRef(false);

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

  const overdueSummary = useMemo(() => {
    const now = new Date();
    const overduePayments = costSchedulePayments.filter(
      p => p.status === "NIEOPLACONE" && isBefore(parseISO(p.dueDate), now)
    );
    const overdueAmount = overduePayments.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
    const currentMonthPayments = costSchedulePayments.filter(p => {
      const d = parseDateLocal(p.dueDate);
      return d.year === currentYear && d.month === currentMonth;
    });
    const currentMonthUnpaid = currentMonthPayments.filter(p => p.status === "NIEOPLACONE");
    const currentMonthUnpaidAmount = currentMonthUnpaid.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
    const paidThisMonth = currentMonthPayments.filter(p => p.status === "OPLACONE");
    const paidThisMonthAmount = paidThisMonth.reduce((s, p) => s + parseFloat(p.amount || "0"), 0);
    const activeSchedules = costSchedules.filter(s => s.active && s.category !== "APARTAMENTY");
    const monthlyTotal = activeSchedules.reduce((sum, s) => {
      const amt = parseFloat(s.amount || "0");
      if (s.frequency === "monthly") return sum + amt;
      if (s.frequency === "quarterly") return sum + amt / 3;
      if (s.frequency === "yearly") return sum + amt / 12;
      return sum;
    }, 0);

    return {
      overdueCount: overduePayments.length,
      overdueAmount,
      currentMonthUnpaidCount: currentMonthUnpaid.length,
      currentMonthUnpaidAmount,
      paidThisMonthCount: paidThisMonth.length,
      paidThisMonthAmount,
      monthlyTotal,
      activeSchedules: activeSchedules.length,
    };
  }, [costSchedulePayments, costSchedules, currentYear, currentMonth]);

  const linkedSchedules = useMemo(() => {
    if (!sheetItem) return [];
    return costSchedules.filter(
      s => s.linkCategoryId === sheetItem.catId && s.linkItemIndex === sheetItem.itemIdx
    );
  }, [costSchedules, sheetItem]);

  const updateCategories = useCallback((newCats: CostCategory[]) => {
    setCategories(newCats);
    saveCategories(newCats);
  }, []);

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

  const handleCatDragStart = useCallback((catId: string) => {
    dragCatRef.current = catId;
    setDragCatId(catId);
  }, []);

  const handleCatDragOver = useCallback((e: React.DragEvent, catId: string) => {
    e.preventDefault();
    dragOverCatRef.current = catId;
  }, []);

  const handleCatDragEnd = useCallback(() => {
    const fromId = dragCatRef.current;
    const toId = dragOverCatRef.current;
    setDragCatId(null);
    dragCatRef.current = null;
    dragOverCatRef.current = null;
    if (!fromId || !toId || fromId === toId) return;
    const newCats = [...categories];
    const fromIdx = newCats.findIndex(c => c.id === fromId);
    const toIdx = newCats.findIndex(c => c.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = newCats.splice(fromIdx, 1);
    newCats.splice(toIdx, 0, moved);
    updateCategories(newCats);
  }, [categories, updateCategories]);

  const handleItemDragStart = useCallback((catId: string, idx: number) => {
    dragItemRef.current = { catId, idx };
    setDragItemKey(`${catId}__${idx}`);
  }, []);

  const handleItemDragOver = useCallback((e: React.DragEvent, catId: string, idx: number) => {
    e.preventDefault();
    dragOverItemRef.current = { catId, idx };
  }, []);

  const handleItemDragEnd = useCallback(() => {
    const from = dragItemRef.current;
    const to = dragOverItemRef.current;
    setDragItemKey(null);
    dragItemRef.current = null;
    dragOverItemRef.current = null;
    if (!from || !to) return;
    if (from.catId === to.catId && from.idx === to.idx) return;
    const newCats = categories.map(c => ({ ...c, items: [...c.items] }));
    const fromCat = newCats.find(c => c.id === from.catId);
    const toCat = newCats.find(c => c.id === to.catId);
    if (!fromCat || !toCat) return;
    const [movedItem] = fromCat.items.splice(from.idx, 1);
    toCat.items.splice(to.idx, 0, movedItem);
    updateCategories(newCats);
  }, [categories, updateCategories]);

  const handleYearChange = useCallback((year: string) => {
    const y = parseInt(year);
    setSelectedYear(y);
    setCellData(loadData(y));
  }, []);

  const toggleCategory = useCallback((catId: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId);
      else next.add(catId);
      return next;
    });
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
      return;
    }
    setEditingCell(key);
    setEditValue(cellData[key]?.toString() || "");
  }, [cellData, serverForecastLookup]);

  const commitEdit = useCallback(() => {
    if (editingCell) {
      const val = parseFloat(editValue) || 0;
      const newData = { ...cellData };
      if (val === 0) {
        delete newData[editingCell];
      } else {
        newData[editingCell] = val;
      }
      setCellData(newData);
      saveData(selectedYear, newData);

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
              itemName: item.label, catTitle: cat.title,
            });
            setForecastPromptOption("remaining");
          }
        }
      }

      setEditingCell(null);
    }
  }, [editingCell, editValue, cellData, selectedYear, serverForecastLookup, categories, parseCellKey]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

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
    if (fillDragging.current && selectedCell) {
      setFillRangeEnd(month);
    }
  }, [selectedCell]);

  const handleMouseUp = useCallback(() => {
    if (fillDragging.current && selectedCell && fillRangeEnd !== null) {
      const source = parseCellKey(selectedCell);
      const sourceVal = cellData[selectedCell] || 0;
      const startM = Math.min(source.month, fillRangeEnd);
      const endM = Math.max(source.month, fillRangeEnd);
      if (startM !== endM) {
        const newData = { ...cellData };
        for (let m = startM; m <= endM; m++) {
          const k = makeCellKey(source.catId, source.itemIdx, m, source.field);
          if (sourceVal === 0) {
            delete newData[k];
          } else {
            newData[k] = sourceVal;
          }
        }
        setCellData(newData);
        saveData(selectedYear, newData);
      }
    }
    fillDragging.current = false;
    setFillRangeEnd(null);
  }, [selectedCell, fillRangeEnd, cellData, selectedYear, parseCellKey]);

  const isInFillRange = useCallback((key: CellKey): boolean => {
    if (!selectedCell || fillRangeEnd === null) return false;
    const source = parseCellKey(selectedCell);
    const target = parseCellKey(key);
    if (source.catId !== target.catId || source.itemIdx !== target.itemIdx || source.field !== target.field) return false;
    const startM = Math.min(source.month, fillRangeEnd);
    const endM = Math.max(source.month, fillRangeEnd);
    return target.month >= startM && target.month <= endM;
  }, [selectedCell, fillRangeEnd, parseCellKey]);

  const handleFillToEnd = useCallback(() => {
    if (!selectedCell) return;
    const source = parseCellKey(selectedCell);
    const sourceVal = cellData[selectedCell] || 0;
    const newData = { ...cellData };
    for (let m = source.month; m < 12; m++) {
      const k = makeCellKey(source.catId, source.itemIdx, m, source.field);
      if (sourceVal === 0) {
        delete newData[k];
      } else {
        newData[k] = sourceVal;
      }
    }
    setCellData(newData);
    saveData(selectedYear, newData);
    setSelectedCell(null);
  }, [selectedCell, cellData, selectedYear, parseCellKey]);

  const handleCopyForecastToNextYear = useCallback(() => {
    const nextYear = selectedYear + 1;
    const existingNextYearData = loadData(nextYear);
    const newNextYearData = { ...existingNextYearData };
    for (const cat of categories) {
      cat.items.forEach((_, itemIdx) => {
        for (let m = 0; m < 12; m++) {
          const sourceKey = makeCellKey(cat.id, itemIdx, m, "prognoza");
          const val = cellData[sourceKey] || 0;
          if (val !== 0) {
            newNextYearData[sourceKey] = val;
          }
        }
      });
    }
    saveData(nextYear, newNextYearData);
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
      newItems[idx] = { name: trimmedName, subLabel: editSubLabelValue.trim() || undefined };
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
    setNewCatColor(CATEGORY_COLORS[0].value);
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

  const getCategorySummary = useCallback((cat: CostCategory, month: number) => {
    let prognoza = 0;
    let rzeczywiste = 0;
    cat.items.forEach((_, idx) => {
      prognoza += getCellValue(makeCellKey(cat.id, idx, month, "prognoza"));
      rzeczywiste += getCellValue(makeCellKey(cat.id, idx, month, "rzeczywiste"));
    });
    return { prognoza, rzeczywiste, saldo: prognoza - rzeczywiste };
  }, [getCellValue]);

  const getCategoryAnnualSummary = useCallback((cat: CostCategory) => {
    let prognoza = 0;
    let rzeczywiste = 0;
    for (let m = 0; m < 12; m++) {
      const s = getCategorySummary(cat, m);
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

  const expenseHeatMax = useMemo(() => {
    let max = 0;
    activeCategories.forEach(cat => {
      cat.items.forEach((_, idx) => {
        for (let m = 0; m < 12; m++) {
          const rVal = getCellValue(makeCellKey(cat.id, idx, m, "rzeczywiste"));
          if (rVal > max) max = rVal;
        }
      });
    });
    return max;
  }, [activeCategories, getCellValue]);

  const getItemSparklineData = useCallback((catId: string, itemIdx: number): number[] => {
    return Array.from({ length: 12 }, (_, m) => getCellValue(makeCellKey(catId, itemIdx, m, "rzeczywiste")));
  }, [getCellValue]);

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

  const [showChart, setShowChart] = useState(false);
  const fullscreen = useFullscreen();

  const formatNum = (n: number) => {
    if (n === 0) return "";
    return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const saldoColor = (n: number) => {
    if (n > 0) return "text-emerald-600 dark:text-emerald-400";
    if (n < 0) return "text-red-600 dark:text-red-400";
    return "";
  };

  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);

  const compareCellData = useMemo(() => {
    if (compareYear === null) return {};
    return loadData(compareYear);
  }, [compareYear]);

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

  const getCellStatusColor = (catId: string, itemIdx: number, month: number): string => {
    const key = `${catId}__${itemIdx}__${month}`;
    const status = paymentStatusMap[key];
    if (status === "paid") return "bg-emerald-50/60 dark:bg-emerald-950/20";
    if (status === "overdue") return "bg-red-50/60 dark:bg-red-950/20";
    return "";
  };

  const sheetItemData = useMemo(() => {
    if (!sheetItem) return null;
    const cat = categories.find(c => c.id === sheetItem.catId);
    if (!cat) return null;
    const item = cat.items[sheetItem.itemIdx];
    if (!item) return null;
    return { cat, item };
  }, [sheetItem, categories]);

  return (
    <div className="space-y-4">
      {!embedded && (
        <PageHeader
          title="Opłaty"
          description="Zarządzanie kosztami i wydatkami."
          icon={Receipt}
          actions={
            <>
              <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
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
          <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
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

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Zaległe płatności</p>
            </div>
            <p className="text-xl font-bold mt-1 text-red-600" data-testid="text-overdue-count">{overdueSummary.overdueCount}</p>
            <p className="text-xs text-muted-foreground">{formatNum2(overdueSummary.overdueAmount)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground">Do opłacenia ({MONTHS_SHORT[currentMonth]})</p>
            </div>
            <p className="text-xl font-bold mt-1" data-testid="text-current-unpaid">{overdueSummary.currentMonthUnpaidCount}</p>
            <p className="text-xs text-muted-foreground">{formatNum2(overdueSummary.currentMonthUnpaidAmount)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <p className="text-xs text-muted-foreground">Opłacone ({MONTHS_SHORT[currentMonth]})</p>
            </div>
            <p className="text-xl font-bold mt-1 text-green-600" data-testid="text-paid-this-month">{overdueSummary.paidThisMonthCount}</p>
            <p className="text-xs text-muted-foreground">{formatNum2(overdueSummary.paidThisMonthAmount)} zł</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Koszty miesięczne (harmonogram)</p>
            <p className="text-xl font-bold mt-1" data-testid="text-monthly-total">{formatNum2(overdueSummary.monthlyTotal)} zł</p>
            <p className="text-xs text-muted-foreground">{overdueSummary.activeSchedules} aktywnych</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Prognoza roczna</p>
            <p className="text-xl font-bold mt-1" data-testid="text-total-prognoza">{grandTotal.prognoza.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
            <p className={`text-xs ${saldoColor(grandTotal.saldo)}`}>Saldo: {grandTotal.saldo >= 0 ? "+" : ""}{grandTotal.saldo.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</p>
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
                <Bar dataKey="Prognoza" fill="hsl(222, 47%, 11%)" radius={[2, 2, 0, 0]} />
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
                  <Line type="monotone" dataKey={compareYear.toString()} stroke="hsl(222, 47%, 11%)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name={`${compareYear}`} />
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

      {selectedCell && cellData[selectedCell] !== undefined && cellData[selectedCell] !== 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Zaznaczona komórka: <strong>{cellData[selectedCell]?.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</strong> zł</span>
          <Button variant="outline" size="sm" onClick={handleFillToEnd} data-testid="button-fill-to-end">
            <Copy className="mr-1 h-3 w-3" /> Wypełnij do grudnia
          </Button>
          <span className="text-muted-foreground/60">lub przeciągnij kwadracik w rogu komórki</span>
        </div>
      )}

      <FullscreenWrapper title={`Opłaty i koszty ${selectedYear}`} toolbar={<div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setShowChart(!showChart)}><BarChart3 className="mr-1 h-3 w-3" />{showChart ? "Ukryj wykres" : "Pokaż wykres"}</Button></div>} isFullscreen={fullscreen.isFullscreen} onExit={fullscreen.exit}>
      <div className="rounded-md border border-border bg-card overflow-x-auto" data-testid="table-oplaty" onMouseUp={handleMouseUp}>
        <table className="w-full text-xs border-collapse" style={{ minWidth: "2000px" }}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-muted/80 dark:bg-muted/50">
              <th className="sticky left-0 z-30 bg-muted/80 dark:bg-muted/50 border-b border-r border-border px-2 py-1 text-right font-bold w-[220px] min-w-[220px]" rowSpan={2}>
                Pozycja
              </th>
              {MONTHS_SHORT.map((m, i) => (
                <th key={i} colSpan={3} className="border-b border-r-2 border-border px-1 py-1 text-center font-bold">
                  {m}
                </th>
              ))}
              <th colSpan={3} className="border-b border-border px-1 py-1 text-center font-bold bg-muted dark:bg-muted/70">
                ROCZNIE
              </th>
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
            {activeCategories.map(cat => {
              const isCollapsed = collapsedCategories.has(cat.id);
              const annualCat = getCategoryAnnualSummary(cat);
              const isDraggingCat = dragCatId === cat.id;
              return (
                <Fragment key={cat.id}>
                  <tr
                    className={`${cat.color} text-white select-none ${isDraggingCat ? "opacity-40" : ""}`}
                    data-testid={`row-category-${cat.id}`}
                    onDragOver={(e) => handleCatDragOver(e, cat.id)}
                    onDrop={handleCatDragEnd}
                  >
                    <td className={`sticky left-0 z-20 ${cat.color} border-b border-r border-border/30 px-1 py-1 font-bold`}>
                      <div className="flex items-center gap-0.5">
                        <span
                          draggable
                          onDragStart={() => handleCatDragStart(cat.id)}
                          onDragEnd={handleCatDragEnd}
                          className="cursor-grab active:cursor-grabbing opacity-60 hover:opacity-100 shrink-0"
                          data-testid={`drag-category-${cat.id}`}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                        <span className="cursor-pointer shrink-0" onClick={() => toggleCategory(cat.id)} data-testid={`button-toggle-category-${cat.id}`}>
                          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </span>
                        <span
                          className="truncate flex-1 min-w-0 cursor-pointer hover:underline"
                          onClick={(e) => { e.stopPropagation(); openEditCatDialog(cat); }}
                          title="Kliknij aby edytować kategorię"
                          data-testid={`text-category-name-${cat.id}`}
                        >
                          {cat.title}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setAddItemCatId(cat.id); }}
                          className="opacity-60 hover:opacity-100 p-0.5 rounded shrink-0"
                          title="Dodaj pozycję"
                          data-testid={`button-add-item-${cat.id}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleArchiveCategory(cat.id); }}
                          className="opacity-40 hover:opacity-100 p-0.5 rounded shrink-0"
                          title="Archiwizuj kategorię"
                          data-testid={`btn-archive-${cat.id}`}
                        >
                          <Archive className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Usunąć kategorię "${cat.title}" i wszystkie jej pozycje?`)) {
                              handleDeleteCategory(cat.id);
                            }
                          }}
                          className="opacity-40 hover:opacity-100 p-0.5 rounded shrink-0"
                          title="Usuń kategorię"
                          data-testid={`button-delete-category-${cat.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    {Array.from({ length: 12 }, (_, m) => {
                      const s = getCategorySummary(cat, m);
                      return (
                        <Fragment key={m}>
                          <td className="border-b border-r border-border/30 px-1 py-1 text-right font-semibold tabular-nums">{formatNum(s.prognoza)}</td>
                          <td className="border-b border-r border-border/30 px-1 py-1 text-right font-semibold tabular-nums">{formatNum(s.rzeczywiste)}</td>
                          <td className={`border-b border-r-2 border-border/30 px-1 py-1 text-right font-semibold tabular-nums ${s.saldo > 0 ? "text-green-200" : s.saldo < 0 ? "text-red-200" : ""}`}>{formatNum(s.saldo)}</td>
                        </Fragment>
                      );
                    })}
                    <td className="border-b border-r border-border/30 px-1 py-1 text-right font-bold tabular-nums">{formatNum(annualCat.prognoza)}</td>
                    <td className="border-b border-r border-border/30 px-1 py-1 text-right font-bold tabular-nums">{formatNum(annualCat.rzeczywiste)}</td>
                    <td className={`border-b border-border/30 px-1 py-1 text-right font-bold tabular-nums ${annualCat.saldo > 0 ? "text-green-200" : annualCat.saldo < 0 ? "text-red-200" : ""}`}>{formatNum(annualCat.saldo)}</td>
                  </tr>
                  {!isCollapsed && cat.items.map((item, idx) => {
                    const annualItem = getItemAnnualSummary(cat.id, idx);
                    const nameKey = `${cat.id}__${idx}`;
                    const isEditingThisName = editingName === nameKey;
                    const isDraggingItem = dragItemKey === nameKey;
                    const hasLinkedSchedule = costSchedules.some(
                      s => s.linkCategoryId === cat.id && s.linkItemIndex === idx
                    );
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-muted/30 dark:hover:bg-muted/20 group ${isDraggingItem ? "opacity-40" : ""}`}
                        data-testid={`row-item-${cat.id}-${idx}`}
                        onDragOver={(e) => handleItemDragOver(e, cat.id, idx)}
                        onDrop={handleItemDragEnd}
                      >
                        <td className="sticky left-0 z-20 bg-card border-b border-r border-border px-1 py-1 text-right">
                          {isEditingThisName ? (
                            <div className="space-y-0.5 pl-4">
                              <input
                                autoFocus
                                value={editNameValue}
                                onChange={e => setEditNameValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === "Enter") commitNameEdit();
                                  if (e.key === "Escape") cancelNameEdit();
                                }}
                                className="w-full px-1 py-0.5 text-xs font-medium bg-background border-0 outline-none ring-2 ring-[#5ADBFA] rounded-sm"
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
                                className="w-full px-1 py-0.5 text-[10px] text-muted-foreground bg-background border-0 outline-none ring-1 ring-border rounded-sm"
                                placeholder="Podtytuł (opcjonalnie)"
                                data-testid={`input-sublabel-${nameKey}`}
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <span
                                draggable
                                onDragStart={() => handleItemDragStart(cat.id, idx)}
                                onDragEnd={handleItemDragEnd}
                                className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0"
                                data-testid={`drag-item-${cat.id}-${idx}`}
                              >
                                <GripVertical className="h-3 w-3" />
                              </span>
                              <div
                                className="flex-1 cursor-pointer hover:bg-accent/50 rounded-sm px-0.5 min-w-0 flex items-center gap-1"
                                onClick={() => openItemSheet(cat.id, idx)}
                                onDoubleClick={() => startEditingName(cat.id, idx)}
                                data-testid={`name-${nameKey}`}
                              >
                                <span className="font-medium truncate hover:underline">{item.name}</span>
                                {item.subLabel && <span className="text-[10px] text-muted-foreground ml-1">({item.subLabel})</span>}
                                {hasLinkedSchedule && <Link2 className="inline h-2.5 w-2.5 ml-1 text-muted-foreground" />}
                                <Sparkline data={getItemSparklineData(cat.id, idx)} width={50} height={14} color="rgb(239, 68, 68)" />
                              </div>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Usunąć pozycję "${item.name}"?`)) {
                                    handleDeleteItem(cat.id, idx);
                                  }
                                }}
                                className="invisible group-hover:visible text-muted-foreground hover:text-destructive p-0.5 shrink-0"
                                data-testid={`button-delete-item-${cat.id}-${idx}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        {Array.from({ length: 12 }, (_, m) => {
                          const pKey = makeCellKey(cat.id, idx, m, "prognoza");
                          const rKey = makeCellKey(cat.id, idx, m, "rzeczywiste");
                          const pVal = getCellValue(pKey);
                          const rVal = getCellValue(rKey);
                          const saldo = pVal - rVal;
                          const statusBg = getCellStatusColor(cat.id, idx, m);
                          return (
                            <Fragment key={m}>
                              <EditableCell
                                cellKey={pKey}
                                value={pVal}
                                editingCell={editingCell}
                                editValue={editValue}
                                setEditValue={setEditValue}
                                startEditing={startEditing}
                                commitEdit={commitEdit}
                                cancelEdit={cancelEdit}
                                className={`border-b border-r border-border bg-muted/20 dark:bg-muted/10 text-[10px] ${statusBg}`}
                                isSelected={selectedCell === pKey}
                                isInRange={isInFillRange(pKey)}
                                onCellClick={handleCellClick}
                                onFillHandleMouseDown={handleFillHandleMouseDown}
                                onCellMouseEnter={handleCellMouseEnter}
                                month={m}
                                isServerManaged={pKey in serverForecastLookup}
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
                                className={`border-b border-r border-border font-semibold ${statusBg} ${getHeatMapBg(rVal, expenseHeatMax, "expense")}`}
                                isSelected={selectedCell === rKey}
                                isInRange={isInFillRange(rKey)}
                                onCellClick={handleCellClick}
                                onFillHandleMouseDown={handleFillHandleMouseDown}
                                onCellMouseEnter={handleCellMouseEnter}
                                month={m}
                              />
                              <td className={`border-b border-r-2 border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)} ${statusBg}`}>
                                {formatNum(saldo)}
                              </td>
                            </Fragment>
                          );
                        })}
                        <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums bg-muted/30 dark:bg-muted/20 text-[10px]">{formatNum(annualItem.prognoza)}</td>
                        <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/30 dark:bg-muted/20">{formatNum(annualItem.rzeczywiste)}</td>
                        <td className={`border-b border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/30 dark:bg-muted/20 ${saldoColor(annualItem.saldo)}`}>{formatNum(annualItem.saldo)}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            <tr className="bg-muted/80 dark:bg-muted/50 font-bold">
              <td className="sticky left-0 z-20 bg-muted/80 dark:bg-muted/50 border-t-2 border-r border-border px-2 py-1 text-right">
                SUMA
              </td>
              {Array.from({ length: 12 }, (_, m) => {
                let prognoza = 0;
                let rzeczywiste = 0;
                activeCategories.forEach(cat => {
                  const s = getCategorySummary(cat, m);
                  prognoza += s.prognoza;
                  rzeczywiste += s.rzeczywiste;
                });
                const saldo = prognoza - rzeczywiste;
                return (
                  <Fragment key={m}>
                    <td className="border-t-2 border-r border-border px-1 py-1 text-right tabular-nums text-[10px] bg-muted/20 dark:bg-muted/10">{formatNum(prognoza)}</td>
                    <td className="border-t-2 border-r border-border px-1 py-1 text-right tabular-nums font-semibold">{formatNum(rzeczywiste)}</td>
                    <td className={`border-t-2 border-r-2 border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                  </Fragment>
                );
              })}
              <td className="border-t-2 border-r border-border px-1 py-1 text-right tabular-nums bg-muted dark:bg-muted/70 text-[10px]">{formatNum(grandTotal.prognoza)}</td>
              <td className="border-t-2 border-r border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted dark:bg-muted/70">{formatNum(grandTotal.rzeczywiste)}</td>
              <td className={`border-t-2 border-border px-1 py-1 text-right tabular-nums bg-muted dark:bg-muted/70 ${saldoColor(grandTotal.saldo)}`}>{formatNum(grandTotal.saldo)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      </FullscreenWrapper>

      {archivedCategories.length > 0 && (
        <div className="mt-4" data-testid="archived-operational-costs">
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-2"
            data-testid="toggle-archive"
          >
            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Archive className="h-4 w-4" />
            ARCHIWUM
            <Badge variant="secondary" className="text-xs">{archivedCategories.length}</Badge>
          </button>
          {showArchived && (
            <div className="rounded-md border border-border bg-card overflow-x-auto opacity-60">
              <table className="w-full text-xs border-collapse" style={{ minWidth: "2000px" }}>
                <thead className="sticky top-0 z-20">
                  <tr className="bg-muted/80 dark:bg-muted/50">
                    <th className="sticky left-0 z-30 bg-muted/80 dark:bg-muted/50 border-b border-r border-border px-2 py-1 text-right font-bold w-[220px] min-w-[220px]" rowSpan={2}>
                      Pozycja
                    </th>
                    {MONTHS_SHORT.map((m, i) => (
                      <th key={i} colSpan={3} className="border-b border-r-2 border-border px-1 py-1 text-center font-bold">
                        {m}
                      </th>
                    ))}
                    <th colSpan={3} className="border-b border-border px-1 py-1 text-center font-bold bg-muted dark:bg-muted/70">
                      ROCZNIE
                    </th>
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
                  {archivedCategories.map(cat => {
                    const isCollapsed = collapsedCategories.has(cat.id);
                    const annualCat = getCategoryAnnualSummary(cat);
                    return (
                      <Fragment key={cat.id}>
                        <tr className={`${cat.color} text-white select-none`} data-testid={`row-archived-category-${cat.id}`}>
                          <td className={`sticky left-0 z-20 ${cat.color} border-b border-r border-border/30 px-1 py-1 font-bold`}>
                            <div className="flex items-center gap-0.5">
                              <span className="cursor-pointer shrink-0" onClick={() => toggleCategory(cat.id)}>
                                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </span>
                              <span className="truncate flex-1 min-w-0">{cat.title}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRestoreCategory(cat.id); }}
                                className="opacity-60 hover:opacity-100 p-0.5 rounded shrink-0"
                                title="Przywróć kategorię"
                                data-testid={`btn-restore-${cat.id}`}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          {Array.from({ length: 12 }, (_, m) => {
                            const s = getCategorySummary(cat, m);
                            return (
                              <Fragment key={m}>
                                <td className="border-b border-r border-border/30 px-1 py-1 text-right font-semibold tabular-nums">{formatNum(s.prognoza)}</td>
                                <td className="border-b border-r border-border/30 px-1 py-1 text-right font-semibold tabular-nums">{formatNum(s.rzeczywiste)}</td>
                                <td className={`border-b border-r-2 border-border/30 px-1 py-1 text-right font-semibold tabular-nums ${s.saldo > 0 ? "text-green-200" : s.saldo < 0 ? "text-red-200" : ""}`}>{formatNum(s.saldo)}</td>
                              </Fragment>
                            );
                          })}
                          <td className="border-b border-r border-border/30 px-1 py-1 text-right font-bold tabular-nums">{formatNum(annualCat.prognoza)}</td>
                          <td className="border-b border-r border-border/30 px-1 py-1 text-right font-bold tabular-nums">{formatNum(annualCat.rzeczywiste)}</td>
                          <td className={`border-b border-border/30 px-1 py-1 text-right font-bold tabular-nums ${annualCat.saldo > 0 ? "text-green-200" : annualCat.saldo < 0 ? "text-red-200" : ""}`}>{formatNum(annualCat.saldo)}</td>
                        </tr>
                        {!isCollapsed && cat.items.map((item, idx) => {
                          const annualItem = getItemAnnualSummary(cat.id, idx);
                          return (
                            <tr key={idx} className="hover:bg-muted/30 dark:hover:bg-muted/20" data-testid={`row-archived-item-${cat.id}-${idx}`}>
                              <td className="sticky left-0 z-20 bg-card border-b border-r border-border px-1 py-1 text-right">
                                <div className="flex items-center gap-0.5 pl-4">
                                  <span className="font-medium truncate">{item.name}</span>
                                  {item.subLabel && <span className="text-[10px] text-muted-foreground ml-1">({item.subLabel})</span>}
                                </div>
                              </td>
                              {Array.from({ length: 12 }, (_, m) => {
                                const pVal = getCellValue(makeCellKey(cat.id, idx, m, "prognoza"));
                                const rVal = getCellValue(makeCellKey(cat.id, idx, m, "rzeczywiste"));
                                const saldo = pVal - rVal;
                                return (
                                  <Fragment key={m}>
                                    <td className="border-b border-r border-border bg-muted/20 dark:bg-muted/10 px-1 py-1 text-right tabular-nums text-[10px]">{formatNum(pVal)}</td>
                                    <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums font-semibold">{formatNum(rVal)}</td>
                                    <td className={`border-b border-r-2 border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                                  </Fragment>
                                );
                              })}
                              <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums bg-muted/30 dark:bg-muted/20 text-[10px]">{formatNum(annualItem.prognoza)}</td>
                              <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/30 dark:bg-muted/20">{formatNum(annualItem.rzeczywiste)}</td>
                              <td className={`border-b border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/30 dark:bg-muted/20 ${saldoColor(annualItem.saldo)}`}>{formatNum(annualItem.saldo)}</td>
                            </tr>
                          );
                        })}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Sheet open={!!sheetItem} onOpenChange={(open) => { if (!open) setSheetItem(null); }}>
        <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto" data-testid="sheet-cost-detail">
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
                <div className="grid grid-cols-3 gap-3">
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
                          <Card key={schedule.id} data-testid={`card-schedule-${schedule.id}`}>
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
                                                  <Badge className="bg-green-600 text-white text-[10px] no-default-hover-elevate no-default-active-elevate">
                                                    <CheckCircle2 className="w-3 h-3 mr-0.5" />
                                                    OPŁACONE
                                                  </Badge>
                                                ) : (
                                                  <Badge variant="destructive" className="text-[10px] no-default-hover-elevate no-default-active-elevate">
                                                    <XCircle className="w-3 h-3 mr-0.5" />
                                                    NIEOPŁACONE
                                                  </Badge>
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
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setNewCatColor(c.value)}
                    className={`w-8 h-8 rounded-md ${c.value} ${newCatColor === c.value ? "ring-2 ring-offset-2 ring-[#5ADBFA]" : ""}`}
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
              <div className="flex flex-wrap gap-2">
                {CATEGORY_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setEditCatColor(c.value)}
                    className={`w-8 h-8 rounded-md ${c.value} ${editCatColor === c.value ? "ring-2 ring-offset-2 ring-[#5ADBFA]" : ""}`}
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
            <DialogTitle>Dodac do prognozy?</DialogTitle>
          </DialogHeader>
          {forecastPrompt && (
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted-foreground">
                Wprowadziles koszt <strong>{forecastPrompt.amount.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zl</strong> dla pozycji
                &ldquo;{forecastPrompt.itemName}&rdquo; ({forecastPrompt.catTitle}).
              </p>
              <p className="text-sm text-muted-foreground">
                Czy chcesz dodac te kwote do prognozy operacyjnej?
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="forecastOption" checked={forecastPromptOption === "one_time"} onChange={() => setForecastPromptOption("one_time")} data-testid="radio-forecast-one-time" />
                  Tylko {MONTHS_SHORT[forecastPrompt.month]} (jednorazowo)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="forecastOption" checked={forecastPromptOption === "remaining"} onChange={() => setForecastPromptOption("remaining")} data-testid="radio-forecast-remaining" />
                  {MONTHS_SHORT[forecastPrompt.month]} - GRU (pozostale miesiace)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="forecastOption" checked={forecastPromptOption === "all"} onChange={() => setForecastPromptOption("all")} data-testid="radio-forecast-all" />
                  STY - GRU (caly rok)
                </label>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setForecastPrompt(null)} data-testid="btn-skip-forecast">
              Pomin
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
              {addToForecastMutation.isPending ? "Dodaje..." : "Dodaj do prognozy"}
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

function Fragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function EditableCell({
  cellKey,
  value,
  editingCell,
  editValue,
  setEditValue,
  startEditing,
  commitEdit,
  cancelEdit,
  className,
  isSelected,
  isInRange,
  onCellClick,
  onFillHandleMouseDown,
  onCellMouseEnter,
  month,
  isServerManaged,
}: {
  cellKey: CellKey;
  value: number;
  editingCell: string | null;
  editValue: string;
  setEditValue: (v: string) => void;
  startEditing: (key: CellKey) => void;
  commitEdit: () => void;
  cancelEdit: () => void;
  className?: string;
  isSelected: boolean;
  isInRange: boolean;
  onCellClick: (key: CellKey) => void;
  onFillHandleMouseDown: (e: React.MouseEvent) => void;
  onCellMouseEnter: (month: number) => void;
  month: number;
  isServerManaged?: boolean;
}) {
  const isEditing = editingCell === cellKey;

  if (isEditing) {
    return (
      <td className={`${className} p-0`}>
        <input
          type="number"
          step="0.01"
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") cancelEdit();
          }}
          className="w-full h-full px-1 py-1 text-right text-xs bg-background border-0 outline-none ring-2 ring-[#5ADBFA] tabular-nums"
          data-testid={`input-cell-${cellKey}`}
        />
      </td>
    );
  }

  return (
    <td
      className={`${className} px-1 py-1 text-right tabular-nums relative select-none ${isServerManaged ? "cursor-default bg-blue-50/40 dark:bg-blue-950/20" : "cursor-pointer hover:bg-accent/50"} ${isSelected ? "ring-2 ring-[#5ADBFA] ring-inset z-10" : ""} ${isInRange ? "bg-[#5ADBFA]/15" : ""}`}
      onDoubleClick={() => startEditing(cellKey)}
      onClick={() => onCellClick(cellKey)}
      onMouseEnter={() => onCellMouseEnter(month)}
      title={isServerManaged ? "Wartość z modułu Prognoza" : undefined}
      data-testid={`cell-${cellKey}`}
    >
      {value !== 0 ? value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
      {isSelected && value !== 0 && !isServerManaged && (
        <span
          onMouseDown={onFillHandleMouseDown}
          className="absolute -bottom-[3px] -right-[3px] w-[7px] h-[7px] bg-[#5ADBFA] border border-white cursor-crosshair z-20"
          data-testid={`fill-handle-${cellKey}`}
        />
      )}
    </td>
  );
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Anuluj</Button>
          </DialogClose>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !name || !amount || !startDate}
            data-testid="button-save-schedule"
          >
            {isPending ? "Zapisywanie..." : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
