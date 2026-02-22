import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Apartment, Location, RevenueForecast, CostForecast, Owner, OwnerContract } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Calculator, Copy, FileSpreadsheet, Download, FileText,
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, Upload, Loader2,
  TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUp, ArrowDown, X
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];
const OP_CATEGORIES = [
  { id: "wynagrodzenia", label: "Wynagrodzenia" },
  { id: "zus", label: "ZUS" },
  { id: "podatki", label: "Podatki" },
  { id: "uslugi", label: "Uslugi" },
  { id: "reklama", label: "Reklama" },
  { id: "biuro", label: "Biuro" },
  { id: "media_wspolne", label: "Media wspolne" },
  { id: "ubezpieczenia", label: "Ubezpieczenia" },
  { id: "inne", label: "Inne" },
];

function formatNum(v: number): string {
  if (v === 0) return "\u2014";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function saldoColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "";
}

const CUR_MONTH_BG = "bg-cyan-50/60 dark:bg-cyan-950/20";

export default function Prognoza() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState("przychody");
  const [collapsedLocs, setCollapsedLocs] = useState<Record<string, boolean>>({});
  const [selectedApt, setSelectedApt] = useState<number | null>(null);
  const [contractsOpen, setContractsOpen] = useState(false);
  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<OwnerContract | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState(String(currentYear + 1));
  const [pdfParsedData, setPdfParsedData] = useState<any>(null);
  const { toast } = useToast();
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const yearOptions = useMemo(() => {
    const opts = [];
    for (let y = 2022; y <= currentYear + 2; y++) opts.push(y);
    return opts;
  }, [currentYear]);

  const { data: apartments = [] } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"] });
  const { data: owners = [] } = useQuery<Owner[]>({ queryKey: ["/api/owners"] });
  const { data: revForecasts = [], isLoading: revLoading } = useQuery<RevenueForecast[]>({
    queryKey: ["/api/revenue-forecasts", year],
    queryFn: async () => { const r = await fetch(`/api/revenue-forecasts?year=${year}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });
  const { data: costForecasts = [], isLoading: costLoading } = useQuery<CostForecast[]>({
    queryKey: ["/api/cost-forecasts", year],
    queryFn: async () => { const r = await fetch(`/api/cost-forecasts?year=${year}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });
  const { data: contracts = [] } = useQuery<OwnerContract[]>({ queryKey: ["/api/owner-contracts"] });

  const { data: allRevForecasts = [], isLoading: allRevLoading } = useQuery<RevenueForecast[]>({
    queryKey: ["/api/revenue-forecasts", "all", selectedApt],
    queryFn: async () => {
      if (!selectedApt) return [];
      const years = Array.from({ length: currentYear + 2 - 2022 }, (_, i) => 2022 + i);
      const responses = await Promise.all(
        years.map(y => fetch(`/api/revenue-forecasts?year=${y}`, { credentials: "include" }).then(r => r.ok ? r.json() : []))
      );
      return responses.flat().filter((f: RevenueForecast) => f.apartmentId === selectedApt);
    },
    enabled: !!selectedApt,
  });

  const { data: allCostForecasts = [], isLoading: allCostLoading } = useQuery<CostForecast[]>({
    queryKey: ["/api/cost-forecasts", "all", selectedApt],
    queryFn: async () => {
      if (!selectedApt) return [];
      const years = Array.from({ length: currentYear + 2 - 2022 }, (_, i) => 2022 + i);
      const responses = await Promise.all(
        years.map(y => fetch(`/api/cost-forecasts?year=${y}`, { credentials: "include" }).then(r => r.ok ? r.json() : []))
      );
      return responses.flat().filter((f: CostForecast) => f.apartmentId === selectedApt);
    },
    enabled: !!selectedApt,
  });

  const activeApts = useMemo(() => apartments.filter(a => a.active !== false), [apartments]);
  const sortedLocs = useMemo(() => [...locations].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)), [locations]);

  const revLookup = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of revForecasts) {
      if (f.apartmentId) m[`${f.apartmentId}-${f.month}`] = Number(f.forecast) || 0;
    }
    return m;
  }, [revForecasts]);

  const costLookup = useMemo(() => {
    const m: Record<string, { forecast: number; actual: number; sourceType: string | null }> = {};
    for (const f of costForecasts) {
      const key = f.apartmentId ? `apt-${f.apartmentId}-${f.month}` : `cat-${f.category}-${f.month}`;
      m[key] = { forecast: Number(f.forecast) || 0, actual: Number(f.actual) || 0, sourceType: f.sourceType };
    }
    return m;
  }, [costForecasts]);

  useEffect(() => { setLocalEdits({}); }, [year]);

  const getVal = useCallback((prefix: string, key: string): number => {
    if (`${prefix}-${key}` in localEdits) return parseFloat(localEdits[`${prefix}-${key}`]) || 0;
    if (prefix === "rev") return revLookup[key] || 0;
    if (prefix === "cost") return costLookup[`apt-${key}`]?.forecast || 0;
    if (prefix === "op-f") return costLookup[`cat-${key}`]?.forecast || 0;
    if (prefix === "op-a") return costLookup[`cat-${key}`]?.actual || 0;
    return 0;
  }, [localEdits, revLookup, costLookup]);

  const getDisplay = useCallback((prefix: string, key: string): string => {
    const editKey = `${prefix}-${key}`;
    if (editKey in localEdits) return localEdits[editKey];
    let val = 0;
    if (prefix === "rev") val = revLookup[key] || 0;
    else if (prefix === "cost") val = costLookup[`apt-${key}`]?.forecast || 0;
    else if (prefix === "op-f") val = costLookup[`cat-${key}`]?.forecast || 0;
    else if (prefix === "op-a") val = costLookup[`cat-${key}`]?.actual || 0;
    return val ? String(val) : "";
  }, [localEdits, revLookup, costLookup]);

  const revMutation = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/revenue-forecasts", d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/revenue-forecasts", year] }),
  });

  const costMutation = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/cost-forecasts", d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cost-forecasts", year] }),
  });

  const handleEdit = useCallback((prefix: string, key: string, value: string, mutData: any) => {
    const editKey = `${prefix}-${key}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    if (debounceTimers.current[editKey]) clearTimeout(debounceTimers.current[editKey]);
    debounceTimers.current[editKey] = setTimeout(() => {
      if (prefix === "rev") revMutation.mutate(mutData);
      else costMutation.mutate(mutData);
    }, 500);
  }, [revMutation, costMutation]);

  const generateCostsMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/owner-contracts/generate-costs", { year }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-forecasts", year] });
      toast({ title: "Wygenerowano", description: "Koszty z umow zostaly wygenerowane" });
    },
    onError: (e: Error) => toast({ title: "Blad", description: e.message, variant: "destructive" }),
  });

  const excelImportMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("year", String(year));
      const res = await fetch("/api/forecasts/import-excel", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/revenue-forecasts", year] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-forecasts", year] });
      toast({ title: "Zaimportowano", description: data.message });
    },
    onError: (e: Error) => toast({ title: "Blad importu", description: e.message, variant: "destructive" }),
  });

  const copyMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/forecasts/copy", { sourceYear: year, targetYear: Number(copyTarget), copyRevenue: true, copyCosts: true }),
    onSuccess: () => {
      setCopyDialogOpen(false);
      toast({ title: "Skopiowano", description: `Dane skopiowane do roku ${copyTarget}` });
    },
    onError: (e: Error) => toast({ title: "Blad", description: e.message, variant: "destructive" }),
  });

  const contractMutation = useMutation({
    mutationFn: (d: { method: string; url: string; body?: any }) => apiRequest(d.method, d.url, d.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-contracts"] });
      setContractFormOpen(false);
      setEditingContract(null);
      setPdfParsedData(null);
      toast({ title: "Zapisano" });
    },
    onError: (e: Error) => toast({ title: "Blad", description: e.message, variant: "destructive" }),
  });

  const deleteContractMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/owner-contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-contracts"] });
      toast({ title: "Usunieto" });
    },
  });

  const toggleLoc = (name: string) => setCollapsedLocs(p => ({ ...p, [name]: !p[name] }));

  const aptsByLocation = useMemo(() => {
    const map: Record<string, Apartment[]> = {};
    for (const loc of sortedLocs) {
      const apts = activeApts.filter(a => a.location === loc.name).sort((a, b) => a.name.localeCompare(b.name, "pl"));
      if (apts.length > 0) map[loc.name] = apts;
    }
    const unassigned = activeApts.filter(a => !a.location || !sortedLocs.some(l => l.name === a.location));
    if (unassigned.length > 0) map["Bez lokalizacji"] = unassigned;
    return map;
  }, [activeApts, sortedLocs]);

  function renderSpreadsheet(type: "rev" | "cost") {
    const prefix = type === "rev" ? "rev" : "cost";
    const isLoading = type === "rev" ? revLoading : costLoading;
    if (isLoading) return <Skeleton className="h-64 w-full" data-testid="skeleton-loading" />;

    let grandTotal = Array(12).fill(0);
    const locEntries = Object.entries(aptsByLocation);

    return (
      <div className="rounded-md border border-border overflow-x-auto" data-testid={`table-${type}`}>
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 text-left px-3 py-2 border-r border-b border-border min-w-[180px] font-medium text-muted-foreground">Apartament</th>
              {MONTHS.map((m, i) => (
                <th key={i} className={`px-2 py-2 border-b border-border text-center font-medium min-w-[85px] ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`} data-testid={`th-${type}-month-${i}`}>{m}</th>
              ))}
              <th className="px-2 py-2 border-b border-border text-center font-bold min-w-[90px] bg-muted/30">Razem</th>
            </tr>
          </thead>
          <tbody>
            {locEntries.map(([locName, apts]) => {
              const collapsed = collapsedLocs[locName];
              const locTotals = Array(12).fill(0);
              apts.forEach(apt => {
                for (let m = 0; m < 12; m++) locTotals[m] += getVal(prefix, `${apt.id}-${m}`);
              });
              locTotals.forEach((v, i) => { grandTotal[i] += v; });
              const locSum = locTotals.reduce((s, v) => s + v, 0);

              return (
                <tbody key={locName}>
                  <tr className="bg-muted/40 cursor-pointer hover:bg-muted/60" onClick={() => toggleLoc(locName)} data-testid={`row-loc-${locName}`}>
                    <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2 border-r border-b border-border font-bold text-sm flex items-center gap-1">
                      {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {locName}
                    </td>
                    {locTotals.map((v, i) => (
                      <td key={i} className={`px-2 py-2 border-b border-border text-right font-semibold tabular-nums ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{formatNum(v)}</td>
                    ))}
                    <td className="px-2 py-2 border-b border-border text-right font-bold tabular-nums bg-muted/30">{formatNum(locSum)}</td>
                  </tr>
                  {!collapsed && apts.map(apt => {
                    let rowTotal = 0;
                    return (
                      <tr key={apt.id} data-testid={`row-${type}-apt-${apt.id}`}>
                        <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-b border-border">
                          <button className="text-left text-sm hover:underline" onClick={() => setSelectedApt(apt.id)} data-testid={`btn-apt-${apt.id}`}>{apt.name}</button>
                        </td>
                        {Array.from({ length: 12 }, (_, m) => {
                          const key = `${apt.id}-${m}`;
                          const val = getVal(prefix, key);
                          rowTotal += val;
                          const source = type === "cost" ? costLookup[`apt-${key}`]?.sourceType : null;
                          return (
                            <td key={m} className={`px-1 py-1 border-b border-border ${m === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>
                              <div className="flex items-center gap-0.5">
                                {type === "cost" && source && (
                                  <span className="text-[10px] shrink-0" title={source === "contract" ? "Z umowy" : "Reczne"}>
                                    {source === "contract" ? <FileText className="h-3 w-3 text-blue-500" /> : <Pencil className="h-3 w-3 text-muted-foreground" />}
                                  </span>
                                )}
                                <input
                                  type="number"
                                  className="w-full text-right text-[11px] tabular-nums bg-transparent rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={getDisplay(prefix, key)}
                                  onChange={e => {
                                    const mutData = type === "rev"
                                      ? { year, month: m, apartmentId: apt.id, forecast: String(parseFloat(e.target.value) || 0) }
                                      : { year, month: m, apartmentId: apt.id, category: "czynsz_wlasciciel", forecast: String(parseFloat(e.target.value) || 0) };
                                    handleEdit(prefix, key, e.target.value, mutData);
                                  }}
                                  placeholder="0"
                                  data-testid={`input-${type}-${apt.id}-${m}`}
                                />
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 border-b border-border text-right font-semibold tabular-nums bg-muted/10">{formatNum(rowTotal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              );
            })}
            <tr className="bg-muted/60 font-bold" data-testid={`row-${type}-grand-total`}>
              <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2 border-r border-border">RAZEM</td>
              {grandTotal.map((v, i) => (
                <td key={i} className={`px-2 py-2 border-border text-right tabular-nums ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{formatNum(v)}</td>
              ))}
              <td className="px-2 py-2 border-border text-right tabular-nums bg-muted/30">{formatNum(grandTotal.reduce((s: number, v: number) => s + v, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  function renderOperationalCosts() {
    if (costLoading) return <Skeleton className="h-64 w-full" />;
    let grandForecast = Array(12).fill(0);
    let grandActual = Array(12).fill(0);

    return (
      <div className="rounded-md border border-border overflow-x-auto" data-testid="table-operational">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 text-left px-3 py-2 border-r border-b border-border min-w-[180px] font-medium text-muted-foreground">Kategoria</th>
              {MONTHS.map((m, i) => (
                <th key={i} className={`px-2 py-2 border-b border-border text-center font-medium min-w-[85px] ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{m}</th>
              ))}
              <th className="px-2 py-2 border-b border-border text-center font-bold min-w-[90px] bg-muted/30">Razem</th>
            </tr>
          </thead>
          <tbody>
            {OP_CATEGORIES.map(cat => {
              const catKey = `operational_${cat.id}`;
              let fTotal = 0, aTotal = 0;
              return (
                <tbody key={cat.id}>
                  <tr className="bg-muted/20" data-testid={`row-op-header-${cat.id}`}>
                    <td colSpan={14} className="sticky left-0 z-10 bg-muted/20 px-3 py-1.5 border-b border-border font-semibold text-sm">{cat.label}</td>
                  </tr>
                  <tr data-testid={`row-op-forecast-${cat.id}`}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-1 border-r border-b border-border text-muted-foreground pl-6">P (prognoza)</td>
                    {Array.from({ length: 12 }, (_, m) => {
                      const key = `${catKey}-${m}`;
                      const val = getVal("op-f", key);
                      fTotal += val;
                      grandForecast[m] += val;
                      return (
                        <td key={m} className={`px-1 py-1 border-b border-border ${m === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>
                          <input
                            type="number"
                            className="w-full text-right text-[11px] tabular-nums bg-transparent rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={getDisplay("op-f", key)}
                            onChange={e => handleEdit("op-f", key, e.target.value, { year, month: m, category: catKey, forecast: String(parseFloat(e.target.value) || 0) })}
                            placeholder="0"
                            data-testid={`input-op-f-${cat.id}-${m}`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 border-b border-border text-right font-semibold tabular-nums bg-muted/10">{formatNum(fTotal)}</td>
                  </tr>
                  <tr data-testid={`row-op-actual-${cat.id}`}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-1 border-r border-b border-border text-muted-foreground pl-6">R (rzeczywiste)</td>
                    {Array.from({ length: 12 }, (_, m) => {
                      const key = `${catKey}-${m}`;
                      const val = getVal("op-a", key);
                      aTotal += val;
                      grandActual[m] += val;
                      return (
                        <td key={m} className={`px-1 py-1 border-b border-border ${m === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>
                          <input
                            type="number"
                            className="w-full text-right text-[11px] tabular-nums bg-transparent rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={getDisplay("op-a", key)}
                            onChange={e => handleEdit("op-a", key, e.target.value, { year, month: m, category: catKey, actual: String(parseFloat(e.target.value) || 0) })}
                            placeholder="0"
                            data-testid={`input-op-a-${cat.id}-${m}`}
                          />
                        </td>
                      );
                    })}
                    <td className="px-2 py-1 border-b border-border text-right font-semibold tabular-nums bg-muted/10">{formatNum(aTotal)}</td>
                  </tr>
                </tbody>
              );
            })}
            <tr className="bg-muted/60 font-bold" data-testid="row-op-grand-total">
              <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2 border-r border-border">RAZEM P</td>
              {grandForecast.map((v, i) => (
                <td key={i} className={`px-2 py-2 border-border text-right tabular-nums ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{formatNum(v)}</td>
              ))}
              <td className="px-2 py-2 border-border text-right tabular-nums bg-muted/30">{formatNum(grandForecast.reduce((s: number, v: number) => s + v, 0))}</td>
            </tr>
            <tr className="bg-muted/40 font-bold" data-testid="row-op-grand-actual">
              <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2 border-r border-border">RAZEM R</td>
              {grandActual.map((v, i) => (
                <td key={i} className={`px-2 py-2 border-border text-right tabular-nums ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{formatNum(v)}</td>
              ))}
              <td className="px-2 py-2 border-border text-right tabular-nums bg-muted/30">{formatNum(grandActual.reduce((s: number, v: number) => s + v, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  function renderSummary() {
    if (revLoading || costLoading) return <Skeleton className="h-64 w-full" />;

    const totalRevByMonth = Array(12).fill(0);
    const totalCostByMonth = Array(12).fill(0);
    activeApts.forEach(apt => {
      for (let m = 0; m < 12; m++) {
        totalRevByMonth[m] += getVal("rev", `${apt.id}-${m}`);
        totalCostByMonth[m] += getVal("cost", `${apt.id}-${m}`);
      }
    });
    OP_CATEGORIES.forEach(cat => {
      for (let m = 0; m < 12; m++) totalCostByMonth[m] += getVal("op-f", `operational_${cat.id}-${m}`);
    });

    const totalRev = totalRevByMonth.reduce((s, v) => s + v, 0);
    const totalCost = totalCostByMonth.reduce((s, v) => s + v, 0);
    const netResult = totalRev - totalCost;

    const aptResults = activeApts.map(apt => {
      let rev = 0, cost = 0;
      for (let m = 0; m < 12; m++) {
        rev += getVal("rev", `${apt.id}-${m}`);
        cost += getVal("cost", `${apt.id}-${m}`);
      }
      return { apt, net: rev - cost };
    }).sort((a, b) => b.net - a.net);

    const best = aptResults[0];
    const worst = aptResults[aptResults.length - 1];

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card data-testid="kpi-total-rev">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground font-medium">Przychody (prognoza)</p>
                <div className="h-8 w-8 rounded-md bg-emerald-500/10 flex items-center justify-center shrink-0"><TrendingUp className="h-4 w-4 text-emerald-600" /></div>
              </div>
              <p className="text-xl font-bold mt-1 tabular-nums text-emerald-600 dark:text-emerald-400">{formatNum(totalRev)} zl</p>
            </CardContent>
          </Card>
          <Card data-testid="kpi-total-cost">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground font-medium">Koszty (prognoza)</p>
                <div className="h-8 w-8 rounded-md bg-red-500/10 flex items-center justify-center shrink-0"><TrendingDown className="h-4 w-4 text-red-600" /></div>
              </div>
              <p className="text-xl font-bold mt-1 tabular-nums text-red-600 dark:text-red-400">{formatNum(totalCost)} zl</p>
            </CardContent>
          </Card>
          <Card data-testid="kpi-net-result">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground font-medium">Wynik netto</p>
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0"><DollarSign className="h-4 w-4 text-primary" /></div>
              </div>
              <p className={`text-xl font-bold mt-1 tabular-nums ${saldoColor(netResult)}`}>{formatNum(netResult)} zl</p>
            </CardContent>
          </Card>
          <Card data-testid="kpi-best-worst">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground font-medium">Najlepszy / Najgorszy</p>
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0"><BarChart3 className="h-4 w-4 text-primary" /></div>
              </div>
              {best && <p className="text-xs mt-1"><span className="text-emerald-600 dark:text-emerald-400 font-semibold">{best.apt.name}</span> <span className="tabular-nums">{formatNum(best.net)} zl</span></p>}
              {worst && worst !== best && <p className="text-xs"><span className="text-red-600 dark:text-red-400 font-semibold">{worst.apt.name}</span> <span className="tabular-nums">{formatNum(worst.net)} zl</span></p>}
            </CardContent>
          </Card>
        </div>

        <div className="rounded-md border border-border overflow-x-auto" data-testid="table-summary">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 text-left px-3 py-2 border-r border-b border-border min-w-[180px] font-medium text-muted-foreground">Lokalizacja</th>
                {MONTHS.map((m, i) => (
                  <th key={i} className={`px-2 py-2 border-b border-border text-center font-medium min-w-[85px] ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{m}</th>
                ))}
                <th className="px-2 py-2 border-b border-border text-center font-bold min-w-[90px] bg-muted/30">Razem</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(aptsByLocation).map(([locName, apts]) => {
                const netByMonth = Array(12).fill(0);
                apts.forEach(apt => {
                  for (let m = 0; m < 12; m++) {
                    netByMonth[m] += getVal("rev", `${apt.id}-${m}`) - getVal("cost", `${apt.id}-${m}`);
                  }
                });
                const locNet = netByMonth.reduce((s, v) => s + v, 0);
                return (
                  <tr key={locName} data-testid={`row-summary-${locName}`}>
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 border-r border-b border-border font-semibold">{locName}</td>
                    {netByMonth.map((v, i) => (
                      <td key={i} className={`px-2 py-2 border-b border-border text-right tabular-nums font-semibold ${saldoColor(v)} ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{formatNum(v)}</td>
                    ))}
                    <td className={`px-2 py-2 border-b border-border text-right tabular-nums font-bold bg-muted/10 ${saldoColor(locNet)}`}>{formatNum(locNet)}</td>
                  </tr>
                );
              })}
              <tr className="bg-muted/60 font-bold" data-testid="row-summary-total">
                <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2 border-r border-border">RAZEM</td>
                {Array.from({ length: 12 }, (_, i) => {
                  const net = totalRevByMonth[i] - totalCostByMonth[i];
                  return <td key={i} className={`px-2 py-2 border-border text-right tabular-nums ${saldoColor(net)} ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{formatNum(net)}</td>;
                })}
                <td className={`px-2 py-2 border-border text-right tabular-nums bg-muted/30 ${saldoColor(netResult)}`}>{formatNum(netResult)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function handleContractSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = {
      ownerId: fd.get("ownerId") ? Number(fd.get("ownerId")) : null,
      apartmentId: fd.get("apartmentId") ? Number(fd.get("apartmentId")) : null,
      monthlyRent: fd.get("monthlyRent") || null,
      additionalFees: fd.get("additionalFees") || null,
      startDate: fd.get("startDate") || null,
      endDate: fd.get("endDate") || null,
      contractType: fd.get("contractType") || "UMOWA",
      parentContractId: fd.get("parentContractId") ? Number(fd.get("parentContractId")) : null,
      notes: fd.get("notes") || null,
      status: fd.get("status") || "AKTYWNA",
    };
    if (editingContract) {
      contractMutation.mutate({ method: "PUT", url: `/api/owner-contracts/${editingContract.id}`, body });
    } else {
      contractMutation.mutate({ method: "POST", url: "/api/owner-contracts", body });
    }
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("files", file);
    try {
      const res = await fetch("/api/parse-owner-contract-pdf", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Blad parsowania PDF");
      const data = await res.json();
      setPdfParsedData(data);
      setEditingContract(null);
      setContractFormOpen(true);
      toast({ title: "PDF sparsowany", description: "Sprawdz dane i zapisz umowe" });
    } catch (err: any) {
      toast({ title: "Blad", description: err.message, variant: "destructive" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <PageHeader
        title="Prognoza finansowa"
        icon={Calculator}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-[100px]" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setCopyDialogOpen(true)} data-testid="btn-copy-year">
              <Copy className="h-4 w-4 mr-1" /> Kopiuj rok
            </Button>
            <Button variant="outline" size="sm" onClick={() => excelInputRef.current?.click()} data-testid="btn-import-excel">
              {excelImportMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />} Import Excel
            </Button>
            <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => {
              const file = e.target.files?.[0];
              if (file) excelImportMutation.mutate(file);
              e.target.value = "";
            }} />
            <Button variant="outline" size="sm" onClick={() => {
              window.open(`/api/forecasts/export-excel?year=${year}`, '_blank');
            }} data-testid="btn-export-excel">
              <Download className="h-4 w-4 mr-1" /> Eksport Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => setContractsOpen(true)} data-testid="btn-contracts">
              <FileText className="h-4 w-4 mr-1" /> Umowy z wlascicielami
            </Button>
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="tabs-forecast">
          <TabsTrigger value="przychody" data-testid="tab-przychody">Przychody</TabsTrigger>
          <TabsTrigger value="koszty_apt" data-testid="tab-koszty-apt">Koszty apartamentowe</TabsTrigger>
          <TabsTrigger value="koszty_op" data-testid="tab-koszty-op">Koszty operacyjne</TabsTrigger>
          <TabsTrigger value="podsumowanie" data-testid="tab-podsumowanie">Podsumowanie</TabsTrigger>
        </TabsList>

        <TabsContent value="przychody" className="mt-4">
          {renderSpreadsheet("rev")}
        </TabsContent>

        <TabsContent value="koszty_apt" className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => generateCostsMutation.mutate()} disabled={generateCostsMutation.isPending} data-testid="btn-generate-costs">
              {generateCostsMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
              Generuj z umow
            </Button>
          </div>
          {renderSpreadsheet("cost")}
        </TabsContent>

        <TabsContent value="koszty_op" className="mt-4">
          {renderOperationalCosts()}
        </TabsContent>

        <TabsContent value="podsumowanie" className="mt-4">
          {renderSummary()}
        </TabsContent>
      </Tabs>

      <Sheet open={!!selectedApt} onOpenChange={() => setSelectedApt(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto" data-testid="panel-apt-details">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">{apartments.find(a => a.id === selectedApt)?.name || "Apartament"}</SheetTitle>
            </div>
            <p className="text-xs text-muted-foreground">{apartments.find(a => a.id === selectedApt)?.location || "Brak lokalizacji"}</p>
          </SheetHeader>
          {selectedApt && (() => {
            const apt = apartments.find(a => a.id === selectedApt);
            if (!apt) return null;
            if (allRevLoading || allCostLoading) return <div className="mt-4 flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /><span className="ml-2 text-sm text-muted-foreground">Ladowanie danych historycznych...</span></div>;
            const aptContract = contracts.find(c => c.apartmentId === selectedApt && c.status === "AKTYWNA");
            const owner = aptContract?.ownerId ? owners.find(o => o.id === aptContract.ownerId) : (apt.ownerId ? owners.find(o => o.id === apt.ownerId) : null);

            const yearlyRevenue: Record<number, number> = {};
            const yearlyCost: Record<number, number> = {};
            const monthlyByYear: Record<number, number[]> = {};

            for (const f of allRevForecasts) {
              yearlyRevenue[f.year] = (yearlyRevenue[f.year] || 0) + (Number(f.forecast) || 0);
              if (!monthlyByYear[f.year]) monthlyByYear[f.year] = Array(12).fill(0);
              monthlyByYear[f.year][f.month] += Number(f.forecast) || 0;
            }
            for (const f of allCostForecasts) {
              yearlyCost[f.year] = (yearlyCost[f.year] || 0) + (Number(f.forecast) || 0);
            }

            const allYears = [...new Set([...Object.keys(yearlyRevenue), ...Object.keys(yearlyCost)].map(Number))].sort();
            const trendData = allYears.map(y => ({
              year: String(y),
              przychod: yearlyRevenue[y] || 0,
              koszt: yearlyCost[y] || 0,
              wynik: (yearlyRevenue[y] || 0) - (yearlyCost[y] || 0),
            }));

            const currentRev = yearlyRevenue[year] || 0;
            const prevRev = yearlyRevenue[year - 1] || 0;
            const revChange = prevRev > 0 ? ((currentRev - prevRev) / prevRev * 100) : 0;
            const avgMonthly = currentRev / 12;

            const monthNames = MONTHS;
            const monthChartData = monthNames.map((m, i) => {
              const entry: any = { month: m };
              allYears.forEach(y => {
                entry[String(y)] = monthlyByYear[y]?.[i] || 0;
              });
              return entry;
            });

            const chartColors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

            return (
              <div className="mt-4 space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <Card className="p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Przychod {year}</p>
                    <p className="text-sm font-bold tabular-nums">{formatNum(currentRev)} PLN</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Sr. miesieczna</p>
                    <p className="text-sm font-bold tabular-nums">{formatNum(avgMonthly)} PLN</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-[10px] text-muted-foreground font-medium">Zmiana r/r</p>
                    <p className={`text-sm font-bold tabular-nums flex items-center gap-1 ${revChange > 0 ? "text-emerald-600" : revChange < 0 ? "text-red-600" : ""}`}>
                      {revChange > 0 ? <ArrowUp className="h-3 w-3" /> : revChange < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                      {revChange !== 0 ? `${revChange > 0 ? "+" : ""}${revChange.toFixed(0)}%` : "\u2014"}
                    </p>
                  </Card>
                </div>

                {trendData.length > 1 && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Trend roczny</p>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                          <ReTooltip formatter={(v: number) => `${v.toLocaleString("pl-PL")} PLN`} />
                          <Bar dataKey="przychod" fill="#3b82f6" name="Przychod" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="koszt" fill="#ef4444" name="Koszt" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {allYears.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Porownanie miesieczne</p>
                    <div className="h-40">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={monthChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="month" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                          <ReTooltip formatter={(v: number) => `${v.toLocaleString("pl-PL")} PLN`} />
                          {allYears.map((y, i) => (
                            <Line key={y} type="monotone" dataKey={String(y)} stroke={chartColors[i % chartColors.length]} strokeWidth={y === year ? 2.5 : 1} dot={false} name={String(y)} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold mb-2">Zestawienie roczne</p>
                  <div className="rounded-md border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-2 py-1.5 border-b border-border">Rok</th>
                          <th className="text-right px-2 py-1.5 border-b border-border">Przychod</th>
                          <th className="text-right px-2 py-1.5 border-b border-border">Koszt</th>
                          <th className="text-right px-2 py-1.5 border-b border-border">Wynik</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allYears.map(y => {
                          const rev = yearlyRevenue[y] || 0;
                          const cost = yearlyCost[y] || 0;
                          const net = rev - cost;
                          return (
                            <tr key={y} className={y === year ? "bg-cyan-50/40 dark:bg-cyan-950/20" : ""}>
                              <td className="px-2 py-1 border-b border-border font-medium">{y}</td>
                              <td className="px-2 py-1 border-b border-border text-right tabular-nums">{formatNum(rev)}</td>
                              <td className="px-2 py-1 border-b border-border text-right tabular-nums text-red-600 dark:text-red-400">{formatNum(cost)}</td>
                              <td className={`px-2 py-1 border-b border-border text-right tabular-nums font-semibold ${saldoColor(net)}`}>{formatNum(net)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {(aptContract || owner) && (
                  <div>
                    <p className="text-xs font-semibold mb-2">Umowa z wlascicielem</p>
                    <Card className="p-3 space-y-2">
                      {owner && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Wlasciciel:</span>
                          <span className="text-xs font-medium">{owner.name}</span>
                        </div>
                      )}
                      {aptContract && (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Czynsz:</span>
                            <span className="text-xs font-bold">{formatNum(Number(aptContract.monthlyRent) || 0)} PLN/mies.</span>
                          </div>
                          {aptContract.additionalFees && Number(aptContract.additionalFees) > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Oplaty dod.:</span>
                              <span className="text-xs font-medium">{formatNum(Number(aptContract.additionalFees))} PLN/mies.</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Okres:</span>
                            <span className="text-xs">{aptContract.startDate} - {aptContract.endDate || "bezterminowo"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Status:</span>
                            <Badge variant={aptContract.status === "AKTYWNA" ? "default" : "secondary"} className="text-[10px]">{aptContract.status}</Badge>
                          </div>
                        </>
                      )}
                      {!aptContract && owner && (
                        <p className="text-xs text-muted-foreground italic">Brak aktywnej umowy. Dodaj umowe w sekcji "Umowy z wlascicielami".</p>
                      )}
                    </Card>
                  </div>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kopiuj dane prognozy</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Skopiuj przychody i koszty z roku {year} do:</p>
            <Select value={copyTarget} onValueChange={setCopyTarget}>
              <SelectTrigger data-testid="select-copy-target"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.filter(y => y !== year).map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>Anuluj</Button>
            <Button onClick={() => copyMutation.mutate()} disabled={copyMutation.isPending} data-testid="btn-copy-confirm">
              {copyMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Copy className="h-4 w-4 mr-1" />}
              Kopiuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={contractsOpen} onOpenChange={setContractsOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Umowy z wlascicielami</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" onClick={() => { setEditingContract(null); setPdfParsedData(null); setContractFormOpen(true); }} data-testid="btn-add-contract">
                <Plus className="h-4 w-4 mr-1" /> Dodaj umowe
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="btn-import-pdf">
                <Upload className="h-4 w-4 mr-1" /> Import PDF
              </Button>
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} />
            </div>
            <div className="space-y-2">
              {contracts.length === 0 && <p className="text-sm text-muted-foreground">Brak umow</p>}
              {contracts.map(c => {
                const ownerName = owners.find(o => o.id === c.ownerId)?.name || "—";
                const aptName = apartments.find(a => a.id === c.apartmentId)?.name || "—";
                return (
                  <Card key={c.id} data-testid={`card-contract-${c.id}`}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="space-y-1">
                          <p className="font-semibold text-sm">{ownerName} &mdash; {aptName}</p>
                          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                            <span>Czynsz: {c.monthlyRent ? `${Number(c.monthlyRent).toLocaleString("pl-PL")} zl` : "—"}</span>
                            {c.additionalFees && Number(c.additionalFees) > 0 && <span>+ {Number(c.additionalFees).toLocaleString("pl-PL")} zl</span>}
                            <span>{c.startDate || "—"} &rarr; {c.endDate || "bezterminowo"}</span>
                            <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                            <Badge variant="outline" className="text-[10px]">{c.contractType}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => { setEditingContract(c); setPdfParsedData(null); setContractFormOpen(true); }} data-testid={`btn-edit-contract-${c.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Usunac umowe?")) deleteContractMutation.mutate(c.id); }} data-testid={`btn-delete-contract-${c.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={contractFormOpen} onOpenChange={v => { setContractFormOpen(v); if (!v) { setEditingContract(null); setPdfParsedData(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingContract ? "Edytuj umowe" : "Dodaj umowe"}</DialogTitle></DialogHeader>
          <form onSubmit={handleContractSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Wlasciciel</Label>
                <Select name="ownerId" defaultValue={String(editingContract?.ownerId || pdfParsedData?.ownerId || "")}>
                  <SelectTrigger data-testid="select-contract-owner"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>
                    {owners.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Apartament</Label>
                <Select name="apartmentId" defaultValue={String(editingContract?.apartmentId || pdfParsedData?.apartmentId || "")}>
                  <SelectTrigger data-testid="select-contract-apt"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                  <SelectContent>
                    {apartments.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Czynsz miesiecznie</Label>
                <Input name="monthlyRent" type="number" step="0.01" defaultValue={editingContract?.monthlyRent || pdfParsedData?.monthlyRent || ""} data-testid="input-contract-rent" />
              </div>
              <div>
                <Label>Oplaty dodatkowe</Label>
                <Input name="additionalFees" type="number" step="0.01" defaultValue={editingContract?.additionalFees || pdfParsedData?.additionalFees || ""} data-testid="input-contract-fees" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data od</Label>
                <Input name="startDate" type="date" defaultValue={editingContract?.startDate || pdfParsedData?.startDate || ""} data-testid="input-contract-start" />
              </div>
              <div>
                <Label>Data do</Label>
                <Input name="endDate" type="date" defaultValue={editingContract?.endDate || pdfParsedData?.endDate || ""} data-testid="input-contract-end" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <Select name="contractType" defaultValue={editingContract?.contractType || "UMOWA"}>
                  <SelectTrigger data-testid="select-contract-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UMOWA">UMOWA</SelectItem>
                    <SelectItem value="ANEKS">ANEKS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select name="status" defaultValue={editingContract?.status || "AKTYWNA"}>
                  <SelectTrigger data-testid="select-contract-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AKTYWNA">AKTYWNA</SelectItem>
                    <SelectItem value="ZAKONCZONA">ZAKONCZONA</SelectItem>
                    <SelectItem value="ROZWIAZANA">ROZWIAZANA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Umowa nadrzedna (opcjonalnie)</Label>
              <Select name="parentContractId" defaultValue={String(editingContract?.parentContractId || "")}>
                <SelectTrigger data-testid="select-contract-parent"><SelectValue placeholder="Brak" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Brak</SelectItem>
                  {contracts.filter(c => c.id !== editingContract?.id).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      #{c.id} - {apartments.find(a => a.id === c.apartmentId)?.name || "?"} ({c.startDate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notatki</Label>
              <Textarea name="notes" defaultValue={editingContract?.notes || pdfParsedData?.notes || ""} rows={3} data-testid="input-contract-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContractFormOpen(false)}>Anuluj</Button>
              <Button type="submit" disabled={contractMutation.isPending} data-testid="btn-save-contract">
                {contractMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Zapisz
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
