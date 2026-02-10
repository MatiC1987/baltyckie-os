import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronRight } from "lucide-react";

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

const CATEGORIES: CostCategory[] = [
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

export default function CostsExpenses() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [cellData, setCellData] = useState<Record<CellKey, number>>(() => loadData(currentYear));
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<CellKey | null>(null);
  const [editValue, setEditValue] = useState("");

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
    CATEGORIES.forEach(cat => {
      const s = getCategoryAnnualSummary(cat);
      prognoza += s.prognoza;
      rzeczywiste += s.rzeczywiste;
    });
    return { prognoza, rzeczywiste, saldo: prognoza - rzeczywiste };
  }, [getCategoryAnnualSummary]);

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
        <div className="flex items-center gap-3">
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

      <div className="rounded-md border border-border bg-card overflow-x-auto" data-testid="table-oplaty">
        <table className="w-full text-xs border-collapse" style={{ minWidth: "2000px" }}>
          <thead className="sticky top-0 z-[100]">
            <tr className="bg-muted/80 dark:bg-muted/50">
              <th className="sticky left-0 z-[110] bg-muted/80 dark:bg-muted/50 border-b border-r border-border px-2 py-1.5 text-left font-bold w-[200px] min-w-[200px]" rowSpan={2}>
                Pozycja
              </th>
              {MONTHS_SHORT.map((m, i) => (
                <th key={i} colSpan={3} className="border-b border-r border-border px-1 py-1.5 text-center font-bold">
                  {m}
                </th>
              ))}
              <th colSpan={3} className="border-b border-border px-1 py-1.5 text-center font-bold bg-muted dark:bg-muted/70">
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
            {CATEGORIES.map(cat => {
              const isCollapsed = collapsedCategories.has(cat.id);
              const annualCat = getCategoryAnnualSummary(cat);
              return (
                <Fragment key={cat.id}>
                  <tr
                    className={`${cat.color} text-white cursor-pointer select-none`}
                    onClick={() => toggleCategory(cat.id)}
                    data-testid={`row-category-${cat.id}`}
                  >
                    <td className={`sticky left-0 z-[105] ${cat.color} border-b border-r border-border/30 px-2 py-1.5 font-bold flex items-center gap-1`}>
                      {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {cat.title}
                    </td>
                    {Array.from({ length: 12 }, (_, m) => {
                      const s = getCategorySummary(cat, m);
                      return (
                        <Fragment key={m}>
                          <td className="border-b border-r border-border/30 px-1 py-1.5 text-right font-semibold tabular-nums">{formatNum(s.prognoza)}</td>
                          <td className="border-b border-r border-border/30 px-1 py-1.5 text-right font-semibold tabular-nums">{formatNum(s.rzeczywiste)}</td>
                          <td className={`border-b border-r border-border/30 px-1 py-1.5 text-right font-semibold tabular-nums ${s.saldo > 0 ? "text-green-200" : s.saldo < 0 ? "text-red-200" : ""}`}>{formatNum(s.saldo)}</td>
                        </Fragment>
                      );
                    })}
                    <td className="border-b border-r border-border/30 px-1 py-1.5 text-right font-bold tabular-nums">{formatNum(annualCat.prognoza)}</td>
                    <td className="border-b border-r border-border/30 px-1 py-1.5 text-right font-bold tabular-nums">{formatNum(annualCat.rzeczywiste)}</td>
                    <td className={`border-b border-border/30 px-1 py-1.5 text-right font-bold tabular-nums ${annualCat.saldo > 0 ? "text-green-200" : annualCat.saldo < 0 ? "text-red-200" : ""}`}>{formatNum(annualCat.saldo)}</td>
                  </tr>
                  {!isCollapsed && cat.items.map((item, idx) => {
                    const annualItem = getItemAnnualSummary(cat.id, idx);
                    return (
                      <tr
                        key={idx}
                        className="hover:bg-muted/30 dark:hover:bg-muted/20"
                        data-testid={`row-item-${cat.id}-${idx}`}
                      >
                        <td className="sticky left-0 z-[105] bg-card border-b border-r border-border px-2 py-1 text-left">
                          <div className="font-medium truncate">{item.name}</div>
                          {item.subLabel && <div className="text-[10px] text-muted-foreground truncate">{item.subLabel}</div>}
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
              <td className="sticky left-0 z-[105] bg-muted/80 dark:bg-muted/50 border-t-2 border-r border-border px-2 py-2 text-left">
                SUMA
              </td>
              {Array.from({ length: 12 }, (_, m) => {
                let prognoza = 0;
                let rzeczywiste = 0;
                CATEGORIES.forEach(cat => {
                  const s = getCategorySummary(cat, m);
                  prognoza += s.prognoza;
                  rzeczywiste += s.rzeczywiste;
                });
                const saldo = prognoza - rzeczywiste;
                return (
                  <Fragment key={m}>
                    <td className="border-t-2 border-r border-border px-1 py-2 text-right tabular-nums">{formatNum(prognoza)}</td>
                    <td className="border-t-2 border-r border-border px-1 py-2 text-right tabular-nums">{formatNum(rzeczywiste)}</td>
                    <td className={`border-t-2 border-r border-border px-1 py-2 text-right tabular-nums ${saldoColor(saldo)}`}>{formatNum(saldo)}</td>
                  </Fragment>
                );
              })}
              <td className="border-t-2 border-r border-border px-1 py-2 text-right tabular-nums bg-muted dark:bg-muted/70">{formatNum(grandTotal.prognoza)}</td>
              <td className="border-t-2 border-r border-border px-1 py-2 text-right tabular-nums bg-muted dark:bg-muted/70">{formatNum(grandTotal.rzeczywiste)}</td>
              <td className={`border-t-2 border-border px-1 py-2 text-right tabular-nums bg-muted dark:bg-muted/70 ${saldoColor(grandTotal.saldo)}`}>{formatNum(grandTotal.saldo)}</td>
            </tr>
          </tbody>
        </table>
      </div>
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
      className={`${className} px-1 py-1 text-right tabular-nums cursor-pointer hover:bg-accent/50`}
      onDoubleClick={() => startEditing(cellKey)}
      data-testid={`cell-${cellKey}`}
    >
      {value !== 0 ? value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}
    </td>
  );
}
