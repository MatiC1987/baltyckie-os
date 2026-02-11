import { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, ChevronRight, Plus, Trash2, GripVertical, Copy, ArrowRight } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";

interface CostItem {
  name: string;
  subLabel?: string;
}

interface CostCategory {
  id: string;
  title: string;
  color: string;
  items: CostItem[];
}

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

const DEFAULT_CATEGORIES: CostCategory[] = [
  {
    id: "wynagrodzenia",
    title: "WYNAGRODZENIA",
    color: "bg-blue-600 dark:bg-blue-700",
    items: [
      { name: "MATEUSZ CIEŚLAK" },
      { name: "KRZYSZTOF CIEŚLAK" },
      { name: "JOLANTA GŁODKOWSKA" },
      { name: "KAROLINA ŁAŹDZIN" },
      { name: "MAŁGORZATA LATASIEWICZ" },
      { name: "MATEUSZ MADEJ" },
      { name: "BARBARA MAZUREK" },
      { name: "INNE" },
    ],
  },
  {
    id: "zus-podatki",
    title: "ZUS & PODATKI",
    color: "bg-red-600 dark:bg-red-700",
    items: [
      { name: "ZUS", subLabel: "Apartamenty Bałtyckie" },
      { name: "VAT-7", subLabel: "Apartamenty Bałtyckie" },
      { name: "PIT-5L", subLabel: "Apartamenty Bałtyckie" },
      { name: "PIT-4", subLabel: "Apartamenty Bałtyckie" },
      { name: "ZUS", subLabel: "Reservon" },
      { name: "VAT-7", subLabel: "Reservon" },
      { name: "PIT-5L", subLabel: "Reservon" },
      { name: "PIT-4", subLabel: "Reservon" },
    ],
  },
  {
    id: "kredyty",
    title: "KREDYTY & POŻYCZKI",
    color: "bg-purple-600 dark:bg-purple-700",
    items: [
      { name: "PFP - POŻYCZKA PŁYNNOŚCIOWA", subLabel: "AB" },
      { name: "PFR - SUBWENCJA", subLabel: "AB" },
      { name: "LEASING - MAZDA 3", subLabel: "Multirent" },
      { name: "LEASING - AUDI Q7", subLabel: "VW Leasing" },
      { name: "LEASING - AUDI A7", subLabel: "VW Leasing" },
      { name: "LEASING - VW TIGUAN", subLabel: "VW Leasing" },
      { name: "PFP - POŻYCZKA INWESTYCYJNA", subLabel: "Reservon" },
      { name: "PFP - POŻYCZKA PŁYNNOŚCIOWA", subLabel: "Reservon" },
    ],
  },
  {
    id: "nieruchomosci",
    title: "NIERUCHOMOŚCI",
    color: "bg-emerald-600 dark:bg-emerald-700",
    items: [
      { name: "CZYNSZ - OSiR", subLabel: "Magazyn PKS" },
      { name: "CZYNSZ - OSiR", subLabel: "Biuro PKS" },
      { name: "OGRZEWANIE - OSiR" },
      { name: "ENERGA - OSiR" },
      { name: "CZYNSZ (GS SAMOPOMOC)" },
      { name: "ENERGIA+WODA (GS SAMOPOMOC)" },
      { name: "OGRZEWANIE (GS SAMOPOMOC)" },
      { name: "WYWÓZ ŚMIECI" },
      { name: "CZYNSZ DO WSPÓLNOTY" },
      { name: "ENERGA" },
    ],
  },
  {
    id: "ksiegowosc",
    title: "OBSŁUGA PRAWNO-KSIĘGOWA",
    color: "bg-amber-600 dark:bg-amber-700",
    items: [
      { name: "PERFEKT - BIURO KSIĘGOWE", subLabel: "AB" },
      { name: "ARTUR BARYŁO - OBSŁUGA PRAWNA" },
      { name: "OPŁATY SĄDOWE" },
      { name: "KRD - KRAJOWY REJESTR DŁUGÓW" },
      { name: "PERFEKT - BIURO KSIĘGOWE", subLabel: "Reservon" },
    ],
  },
  {
    id: "reklama",
    title: "MARKETING & REKLAMA",
    color: "bg-pink-600 dark:bg-pink-700",
    items: [
      { name: "BOOKING.COM", subLabel: "Prowizja" },
      { name: "PROFITROOM", subLabel: "Channel Manager" },
      { name: "PROFITLAB", subLabel: "Marketing Automation" },
      { name: "GOOGLE ADS", subLabel: "Adrian Ginda" },
      { name: "GOOGLE ADS" },
      { name: "AGENT" },
    ],
  },
  {
    id: "uslugi",
    title: "USŁUGI",
    color: "bg-cyan-600 dark:bg-cyan-700",
    items: [
      { name: "VECTRA" },
      { name: "NC+" },
      { name: "WP TV", subLabel: "Luxuro+Modern" },
      { name: "INTERARENA", subLabel: "Grand Baltic+Luxuro" },
      { name: "ORANGE" },
      { name: "T-MOBILE" },
      { name: "MICROSOFT OFFICE" },
      { name: "ORANGE", subLabel: "Reservon" },
      { name: "T-MOBILE", subLabel: "Reservon" },
    ],
  },
  {
    id: "pozostale",
    title: "POZOSTAŁE",
    color: "bg-slate-600 dark:bg-slate-700",
    items: [
      { name: "CHEMIA + BHP" },
      { name: "DOPOSAŻENIA APARTAMENTÓW" },
      { name: "REMONTY APARTAMENTÓW" },
      { name: "POLISY & UBEZPIECZENIA" },
      { name: "PRALNIA MIETER (KOSZALIN)" },
      { name: "INNE" },
      { name: "INNE", subLabel: "Reservon" },
      { name: "INNE", subLabel: "Inne" },
    ],
  },
];

const MONTHS_SHORT = [
  "STY", "LUT", "MAR", "KWI", "MAJ", "CZE",
  "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU",
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

export default function CostsExpenses() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [cellData, setCellData] = useState<Record<CellKey, number>>(() => loadData(currentYear));
  const [categories, setCategories] = useState<CostCategory[]>(() => loadCategories());
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

  const dragCatRef = useRef<string | null>(null);
  const dragOverCatRef = useRef<string | null>(null);
  const dragItemRef = useRef<{ catId: string; idx: number } | null>(null);
  const dragOverItemRef = useRef<{ catId: string; idx: number } | null>(null);
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [dragItemKey, setDragItemKey] = useState<string | null>(null);

  const [selectedCell, setSelectedCell] = useState<CellKey | null>(null);
  const [fillRangeEnd, setFillRangeEnd] = useState<number | null>(null);
  const fillDragging = useRef(false);

  const updateCategories = useCallback((newCats: CostCategory[]) => {
    setCategories(newCats);
    saveCategories(newCats);
  }, []);

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
    return cellData[key] || 0;
  }, [cellData]);

  const startEditing = useCallback((key: CellKey) => {
    setEditingCell(key);
    setEditValue(cellData[key]?.toString() || "");
  }, [cellData]);

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
      setEditingCell(null);
    }
  }, [editingCell, editValue, cellData, selectedYear]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const parseCellKey = useCallback((key: CellKey) => {
    const parts = key.split("__");
    return { catId: parts[0], itemIdx: parseInt(parts[1]), month: parseInt(parts[2]), field: parts[3] as "prognoza" | "rzeczywiste" };
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
          const targetKey = makeCellKey(cat.id, itemIdx, m, "prognoza");
          const val = cellData[sourceKey] || 0;
          if (val !== 0) {
            newNextYearData[targetKey] = val;
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
    categories.forEach(cat => {
      const s = getCategoryAnnualSummary(cat);
      prognoza += s.prognoza;
      rzeczywiste += s.rzeczywiste;
    });
    return { prognoza, rzeczywiste, saldo: prognoza - rzeczywiste };
  }, [categories, getCategoryAnnualSummary]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-costs-title">Opłaty</h2>
          <p className="text-muted-foreground">Zestawienie kosztów operacyjnych: prognoza vs rzeczywiste</p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Prognoza roczna</div>
              <div className="text-xl font-bold mt-1" data-testid="text-total-prognoza">{grandTotal.prognoza.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Rzeczywiste roczne</div>
              <div className="text-xl font-bold mt-1" data-testid="text-total-rzeczywiste">{grandTotal.rzeczywiste.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Saldo roczne</div>
              <div className={`text-xl font-bold mt-1 ${saldoColor(grandTotal.saldo)}`} data-testid="text-total-saldo">{grandTotal.saldo >= 0 ? "+" : ""}{grandTotal.saldo.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedCell && cellData[selectedCell] !== undefined && cellData[selectedCell] !== 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Zaznaczona komórka: <strong>{cellData[selectedCell]?.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</strong> zł</span>
          <Button variant="outline" size="sm" onClick={handleFillToEnd} data-testid="button-fill-to-end">
            <Copy className="mr-1 h-3 w-3" /> Wypełnij do grudnia
          </Button>
          <span className="text-muted-foreground/60">lub przeciągnij kwadracik w rogu komórki</span>
        </div>
      )}

      <div className="rounded-md border border-border bg-card overflow-x-auto" data-testid="table-oplaty" onMouseUp={handleMouseUp}>
        <table className="w-full text-xs border-collapse" style={{ minWidth: "2000px" }}>
          <thead className="sticky top-0 z-[100]">
            <tr className="bg-muted/80 dark:bg-muted/50">
              <th className="sticky left-0 z-[110] bg-muted/80 dark:bg-muted/50 border-b border-r border-border px-2 py-1 text-left font-bold w-[220px] min-w-[220px]" rowSpan={2}>
                Pozycja
              </th>
              {MONTHS_SHORT.map((m, i) => (
                <th key={i} colSpan={3} className="border-b border-r border-border px-1 py-1 text-center font-bold">
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
                  <th className="border-b border-r border-border px-1 py-1 text-center font-medium text-muted-foreground w-[55px]">P</th>
                  <th className="border-b border-r border-border px-1 py-1 text-center font-medium text-muted-foreground w-[55px]">R</th>
                  <th className={`border-b border-border px-1 py-1 text-center font-medium text-muted-foreground w-[55px] ${mi < 12 ? "border-r" : ""}`}>S</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map(cat => {
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
                    <td className={`sticky left-0 z-[105] ${cat.color} border-b border-r border-border/30 px-1 py-1 font-bold`}>
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
                        <span className="cursor-pointer flex items-center gap-1 flex-1 min-w-0" onClick={() => toggleCategory(cat.id)}>
                          {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                          <span className="truncate">{cat.title}</span>
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
                          <td className={`border-b border-r border-border/30 px-1 py-1 text-right font-semibold tabular-nums ${s.saldo > 0 ? "text-green-200" : s.saldo < 0 ? "text-red-200" : ""}`}>{formatNum(s.saldo)}</td>
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
                    return (
                      <tr
                        key={idx}
                        className={`hover:bg-muted/30 dark:hover:bg-muted/20 group ${isDraggingItem ? "opacity-40" : ""}`}
                        data-testid={`row-item-${cat.id}-${idx}`}
                        onDragOver={(e) => handleItemDragOver(e, cat.id, idx)}
                        onDrop={handleItemDragEnd}
                      >
                        <td className="sticky left-0 z-[105] bg-card border-b border-r border-border px-1 py-1 text-left">
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
                                className="flex-1 cursor-pointer hover:bg-accent/50 rounded-sm px-0.5 min-w-0"
                                onDoubleClick={() => startEditingName(cat.id, idx)}
                                data-testid={`name-${nameKey}`}
                              >
                                <span className="font-medium truncate">{item.name}</span>
                                {item.subLabel && <span className="text-[10px] text-muted-foreground ml-1">({item.subLabel})</span>}
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
                                className="border-b border-r border-border"
                                isSelected={selectedCell === pKey}
                                isInRange={isInFillRange(pKey)}
                                onCellClick={handleCellClick}
                                onFillHandleMouseDown={handleFillHandleMouseDown}
                                onCellMouseEnter={handleCellMouseEnter}
                                month={m}
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
                                className="border-b border-r border-border"
                                isSelected={selectedCell === rKey}
                                isInRange={isInFillRange(rKey)}
                                onCellClick={handleCellClick}
                                onFillHandleMouseDown={handleFillHandleMouseDown}
                                onCellMouseEnter={handleCellMouseEnter}
                                month={m}
                              />
                              <td className={`border-b border-r border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)}`}>
                                {formatNum(saldo)}
                              </td>
                            </Fragment>
                          );
                        })}
                        <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/30 dark:bg-muted/20">{formatNum(annualItem.prognoza)}</td>
                        <td className="border-b border-r border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/30 dark:bg-muted/20">{formatNum(annualItem.rzeczywiste)}</td>
                        <td className={`border-b border-border px-1 py-1 text-right tabular-nums font-semibold bg-muted/30 dark:bg-muted/20 ${saldoColor(annualItem.saldo)}`}>{formatNum(annualItem.saldo)}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            <tr className="bg-muted/80 dark:bg-muted/50 font-bold">
              <td className="sticky left-0 z-[105] bg-muted/80 dark:bg-muted/50 border-t-2 border-r border-border px-2 py-1 text-left">
                SUMA
              </td>
              {Array.from({ length: 12 }, (_, m) => {
                let prognoza = 0;
                let rzeczywiste = 0;
                categories.forEach(cat => {
                  const s = getCategorySummary(cat, m);
                  prognoza += s.prognoza;
                  rzeczywiste += s.rzeczywiste;
                });
                const saldo = prognoza - rzeczywiste;
                return (
                  <Fragment key={m}>
                    <td className="border-t-2 border-r border-border px-1 py-1 text-right tabular-nums">{formatNum(prognoza)}</td>
                    <td className="border-t-2 border-r border-border px-1 py-1 text-right tabular-nums">{formatNum(rzeczywiste)}</td>
                    <td className={`border-t-2 border-r border-border px-1 py-1 text-right tabular-nums ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                  </Fragment>
                );
              })}
              <td className="border-t-2 border-r border-border px-1 py-1 text-right tabular-nums bg-muted dark:bg-muted/70">{formatNum(grandTotal.prognoza)}</td>
              <td className="border-t-2 border-r border-border px-1 py-1 text-right tabular-nums bg-muted dark:bg-muted/70">{formatNum(grandTotal.rzeczywiste)}</td>
              <td className={`border-t-2 border-border px-1 py-1 text-right tabular-nums bg-muted dark:bg-muted/70 ${saldoColor(grandTotal.saldo)}`}>{formatNum(grandTotal.saldo)}</td>
            </tr>
          </tbody>
        </table>
      </div>

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
    </div>
  );
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
      className={`${className} px-1 py-1 text-right tabular-nums cursor-pointer hover:bg-accent/50 relative select-none ${isSelected ? "ring-2 ring-[#5ADBFA] ring-inset z-10" : ""} ${isInRange ? "bg-[#5ADBFA]/15" : ""}`}
      onDoubleClick={() => startEditing(cellKey)}
      onClick={() => onCellClick(cellKey)}
      onMouseEnter={() => onCellMouseEnter(month)}
      data-testid={`cell-${cellKey}`}
    >
      {value !== 0 ? value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
      {isSelected && value !== 0 && (
        <span
          onMouseDown={onFillHandleMouseDown}
          className="absolute -bottom-[3px] -right-[3px] w-[7px] h-[7px] bg-[#5ADBFA] border border-white cursor-crosshair z-20"
          data-testid={`fill-handle-${cellKey}`}
        />
      )}
    </td>
  );
}
