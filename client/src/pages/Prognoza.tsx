import { useState, useMemo, useCallback, useRef, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Apartment, Location, RevenueForecast, CostForecast, OperationalCostForecast, Owner, OwnerContract } from "@shared/schema";
import { loadOplatyCategories, type OplatyCostCategory } from "@/lib/oplaty-defaults";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Calculator, Copy, FileSpreadsheet, Download, FileText,
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, Loader2,
  TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUp, ArrowDown, X,
  CopyPlus, CalendarArrowDown, Rows3, MoreHorizontal, FolderOpen, Save, Lightbulb, ClipboardList
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paz", "Lis", "Gru"];
const MONTHS_FULL = ["Styczen", "Luty", "Marzec", "Kwiecien", "Maj", "Czerwiec", "Lipiec", "Sierpien", "Wrzesien", "Pazdziernik", "Listopad", "Grudzien"];

interface ForecastTemplate {
  id: string;
  name: string;
  values: number[];
}

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

function loadTemplates(): ForecastTemplate[] {
  try {
    return JSON.parse(localStorage.getItem("forecast_templates") || "[]");
  } catch { return []; }
}
function saveTemplates(t: ForecastTemplate[]) {
  localStorage.setItem("forecast_templates", JSON.stringify(t));
}

export default function Prognoza() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState("przychody");
  const [collapsedLocs, setCollapsedLocs] = useState<Record<string, boolean>>({});
  const [selectedApt, setSelectedApt] = useState<number | null>(null);
  const [sidePanelTab, setSidePanelTab] = useState<"formularz" | "historia">("formularz");
  const [contractsOpen, setContractsOpen] = useState(false);
  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<OwnerContract | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyTarget, setCopyTarget] = useState(String(currentYear + 1));
  const [pdfParsedData, setPdfParsedData] = useState<any>(null);
  const { toast } = useToast();
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({});
  const excelInputRef = useRef<HTMLInputElement>(null);

  const [fillYearOpen, setFillYearOpen] = useState<string | null>(null);
  const [fillYearValue, setFillYearValue] = useState("");
  const [bulkEditOpen, setBulkEditOpen] = useState<{ locName: string; type: "rev" | "cost" } | null>(null);
  const [bulkEditValue, setBulkEditValue] = useState("");
  const [templates, setTemplates] = useState<ForecastTemplate[]>(loadTemplates);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateValues, setNewTemplateValues] = useState<number[]>(Array(12).fill(0));

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
  const { data: opForecasts = [], isLoading: opLoading } = useQuery<OperationalCostForecast[]>({
    queryKey: ["/api/operational-cost-forecasts", year],
    queryFn: async () => { const r = await fetch(`/api/operational-cost-forecasts?year=${year}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });
  const opCategories = useMemo(() => loadOplatyCategories(), []);

  const { data: prevRevForecasts = [] } = useQuery<RevenueForecast[]>({
    queryKey: ["/api/revenue-forecasts", year - 1],
    queryFn: async () => { const r = await fetch(`/api/revenue-forecasts?year=${year - 1}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });
  const { data: prevCostForecasts = [] } = useQuery<CostForecast[]>({
    queryKey: ["/api/cost-forecasts", year - 1],
    queryFn: async () => { const r = await fetch(`/api/cost-forecasts?year=${year - 1}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
  });

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

  const locRevLookup = useMemo(() => {
    const m: Record<string, number> = {};
    const locNameMap: Record<string, string> = { "LUXURO PARK": "PRZEWŁOKA" };
    for (const f of revForecasts) {
      if (!f.apartmentId && f.locationName && f.locationName !== "RAZEM") {
        const mappedName = locNameMap[f.locationName] || f.locationName;
        m[`${mappedName}-${f.month}`] = Number(f.forecast) || 0;
        if (mappedName !== f.locationName) {
          m[`${f.locationName}-${f.month}`] = Number(f.forecast) || 0;
        }
      }
    }
    return m;
  }, [revForecasts]);

  const razemRevLookup = useMemo(() => {
    const m: Record<number, number> = {};
    for (const f of revForecasts) {
      if (!f.apartmentId && f.locationName === "RAZEM") {
        m[f.month] = Number(f.forecast) || 0;
      }
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

  const opLookup = useMemo(() => {
    const m: Record<string, { forecast: number; actual: number }> = {};
    for (const f of opForecasts) {
      const key = `${f.categoryId}-${f.itemIndex}-${f.month}`;
      m[key] = { forecast: Number(f.forecast) || 0, actual: Number(f.actual) || 0 };
    }
    return m;
  }, [opForecasts]);

  const prevRevLookup = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of prevRevForecasts) {
      if (f.apartmentId) m[`${f.apartmentId}-${f.month}`] = Number(f.forecast) || 0;
    }
    return m;
  }, [prevRevForecasts]);

  const prevCostLookup = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of prevCostForecasts) {
      if (f.apartmentId) m[`apt-${f.apartmentId}-${f.month}`] = Number(f.forecast) || 0;
    }
    return m;
  }, [prevCostForecasts]);

  useEffect(() => { setLocalEdits({}); }, [year]);

  const getVal = useCallback((prefix: string, key: string): number => {
    if (`${prefix}-${key}` in localEdits) return parseFloat(localEdits[`${prefix}-${key}`]) || 0;
    if (prefix === "rev") return revLookup[key] || 0;
    if (prefix === "cost") return costLookup[`apt-${key}`]?.forecast || 0;
    if (prefix === "op-f") return opLookup[key]?.forecast || 0;
    if (prefix === "op-a") return opLookup[key]?.actual || 0;
    return 0;
  }, [localEdits, revLookup, costLookup, opLookup]);

  const getDisplay = useCallback((prefix: string, key: string): string => {
    const editKey = `${prefix}-${key}`;
    if (editKey in localEdits) return localEdits[editKey];
    let val = 0;
    if (prefix === "rev") val = revLookup[key] || 0;
    else if (prefix === "cost") val = costLookup[`apt-${key}`]?.forecast || 0;
    else if (prefix === "op-f") val = opLookup[key]?.forecast || 0;
    else if (prefix === "op-a") val = opLookup[key]?.actual || 0;
    return val ? String(val) : "";
  }, [localEdits, revLookup, costLookup, opLookup]);

  const getPrevYearHint = useCallback((type: "rev" | "cost", aptId: number, month: number): string => {
    if (type === "rev") {
      const v = prevRevLookup[`${aptId}-${month}`];
      return v ? String(v) : "";
    }
    const v = prevCostLookup[`apt-${aptId}-${month}`];
    return v ? String(v) : "";
  }, [prevRevLookup, prevCostLookup]);

  const revMutation = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/revenue-forecasts", d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/revenue-forecasts", year] }),
  });

  const costMutation = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/cost-forecasts", d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/cost-forecasts", year] }),
  });

  const opMutation = useMutation({
    mutationFn: (d: any) => apiRequest("PUT", "/api/operational-cost-forecasts", d),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/operational-cost-forecasts", year] }),
  });

  const handleEdit = useCallback((prefix: string, key: string, value: string, mutData: any) => {
    const editKey = `${prefix}-${key}`;
    setLocalEdits(prev => ({ ...prev, [editKey]: value }));
    if (debounceTimers.current[editKey]) clearTimeout(debounceTimers.current[editKey]);
    debounceTimers.current[editKey] = setTimeout(() => {
      if (prefix === "rev") revMutation.mutate(mutData);
      else if (prefix === "op-f" || prefix === "op-a") opMutation.mutate(mutData);
      else costMutation.mutate(mutData);
    }, 500);
  }, [revMutation, costMutation, opMutation]);

  const fillYear = useCallback((aptId: number, type: "rev" | "cost", value: number) => {
    const prefix = type === "rev" ? "rev" : "cost";
    for (let m = 0; m < 12; m++) {
      const key = `${aptId}-${m}`;
      const mutData = type === "rev"
        ? { year, month: m, apartmentId: aptId, forecast: String(value) }
        : { year, month: m, apartmentId: aptId, category: "czynsz_wlasciciel", forecast: String(value) };
      handleEdit(prefix, key, String(value), mutData);
    }
    toast({ title: "Wypelniono", description: `Wszystkie miesiace ustawione na ${value}` });
  }, [year, handleEdit, toast]);

  const copyFromPrevMonth = useCallback((aptId: number, month: number, type: "rev" | "cost") => {
    const prefix = type === "rev" ? "rev" : "cost";
    let prevVal = 0;
    if (month > 0) {
      prevVal = getVal(prefix, `${aptId}-${month - 1}`);
    } else {
      if (type === "rev") prevVal = prevRevLookup[`${aptId}-11`] || 0;
      else prevVal = prevCostLookup[`apt-${aptId}-11`] || 0;
    }
    const key = `${aptId}-${month}`;
    const mutData = type === "rev"
      ? { year, month, apartmentId: aptId, forecast: String(prevVal) }
      : { year, month, apartmentId: aptId, category: "czynsz_wlasciciel", forecast: String(prevVal) };
    handleEdit(prefix, key, String(prevVal), mutData);
    toast({ title: "Skopiowano", description: `Wartosc ${prevVal} z poprzedniego miesiaca` });
  }, [year, getVal, prevRevLookup, prevCostLookup, handleEdit, toast]);

  const copyFromLastYear = useCallback((aptId: number, month: number, type: "rev" | "cost") => {
    const prefix = type === "rev" ? "rev" : "cost";
    let prevVal = 0;
    if (type === "rev") prevVal = prevRevLookup[`${aptId}-${month}`] || 0;
    else prevVal = prevCostLookup[`apt-${aptId}-${month}`] || 0;
    const key = `${aptId}-${month}`;
    const mutData = type === "rev"
      ? { year, month, apartmentId: aptId, forecast: String(prevVal) }
      : { year, month, apartmentId: aptId, category: "czynsz_wlasciciel", forecast: String(prevVal) };
    handleEdit(prefix, key, String(prevVal), mutData);
    toast({ title: "Skopiowano", description: `Wartosc ${prevVal} z ${year - 1}` });
  }, [year, prevRevLookup, prevCostLookup, handleEdit, toast]);

  const bulkFillLocationRef = useRef<(locName: string, type: "rev" | "cost", value: number) => void>(() => {});
  useEffect(() => {
    bulkFillLocationRef.current = (locName: string, type: "rev" | "cost", value: number) => {
      const locApts = activeApts.filter(a => a.location === locName).sort((a, b) => a.name.localeCompare(b.name, "pl"));
      const apts = locName === "Bez lokalizacji"
        ? activeApts.filter(a => !a.location || !sortedLocs.some(l => l.name === a.location))
        : locApts;
      apts.forEach(apt => fillYear(apt.id, type, value));
      toast({ title: "Wypelniono grupowo", description: `${apts.length} apartamentow ustawionych na ${value}` });
    };
  }, [activeApts, sortedLocs, fillYear, toast]);
  const bulkFillLocation = useCallback((locName: string, type: "rev" | "cost", value: number) => {
    bulkFillLocationRef.current(locName, type, value);
  }, []);

  const applyTemplate = useCallback((aptId: number, type: "rev" | "cost", template: ForecastTemplate) => {
    const prefix = type === "rev" ? "rev" : "cost";
    for (let m = 0; m < 12; m++) {
      const val = template.values[m] || 0;
      const key = `${aptId}-${m}`;
      const mutData = type === "rev"
        ? { year, month: m, apartmentId: aptId, forecast: String(val) }
        : { year, month: m, apartmentId: aptId, category: "czynsz_wlasciciel", forecast: String(val) };
      handleEdit(prefix, key, String(val), mutData);
    }
    toast({ title: "Szablon zastosowany", description: `"${template.name}" zastosowany` });
  }, [year, handleEdit, toast]);

  const saveAsTemplate = useCallback((name: string, values: number[]) => {
    const id = `tpl_${Date.now()}`;
    const newTpl: ForecastTemplate = { id, name, values };
    const updated = [...templates, newTpl];
    setTemplates(updated);
    saveTemplates(updated);
    toast({ title: "Szablon zapisany", description: `"${name}" zapisany` });
  }, [templates, toast]);

  const deleteTemplate = useCallback((id: string) => {
    const updated = templates.filter(t => t.id !== id);
    setTemplates(updated);
    saveTemplates(updated);
    toast({ title: "Szablon usuniety" });
  }, [templates, toast]);

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
      queryClient.invalidateQueries({ queryKey: ["/api/operational-cost-forecasts", year] });
      toast({ title: "Zaimportowano", description: data.message });
    },
    onError: (e: Error) => toast({ title: "Blad importu", description: e.message, variant: "destructive" }),
  });

  const copyMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/forecasts/copy", { sourceYear: year, targetYear: Number(copyTarget), copyRevenue: true, copyCosts: true }),
    onSuccess: () => {
      setCopyDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/revenue-forecasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-forecasts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/operational-cost-forecasts"] });
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
              <th className="px-1 py-2 border-b border-border min-w-[36px] bg-muted/30"></th>
            </tr>
          </thead>
          <tbody>
            {locEntries.map(([locName, apts]) => {
              const collapsed = collapsedLocs[locName];
              const locTotals = Array(12).fill(0);
              apts.forEach(apt => {
                for (let m = 0; m < 12; m++) locTotals[m] += getVal(prefix, `${apt.id}-${m}`);
              });
              if (type === "rev") {
                for (let m = 0; m < 12; m++) {
                  if (locTotals[m] === 0) {
                    const locVal = locRevLookup[`${locName}-${m}`] || 0;
                    if (locVal > 0) locTotals[m] = locVal;
                  }
                }
              }
              locTotals.forEach((v, i) => { grandTotal[i] += v; });
              const locSum = locTotals.reduce((s, v) => s + v, 0);

              return (
                <Fragment key={locName}>
                  <tr className="bg-muted/40 cursor-pointer hover:bg-muted/60" data-testid={`row-loc-${locName}`}>
                    <td className="sticky left-0 z-10 bg-muted/40 px-3 py-2 border-r border-b border-border font-bold text-sm" onClick={() => toggleLoc(locName)}>
                      <div className="flex items-center gap-1">
                        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {locName}
                      </div>
                    </td>
                    {locTotals.map((v, i) => (
                      <td key={i} className={`px-2 py-2 border-b border-border text-right font-semibold tabular-nums ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`} onClick={() => toggleLoc(locName)}>{formatNum(v)}</td>
                    ))}
                    <td className="px-2 py-2 border-b border-border text-right font-bold tabular-nums bg-muted/30" onClick={() => toggleLoc(locName)}>{formatNum(locSum)}</td>
                    <td className="px-1 py-2 border-b border-border bg-muted/30">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6" title="Edycja grupowa" data-testid={`btn-bulk-${locName}`}>
                            <Rows3 className="h-3.5 w-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="end">
                          <p className="text-xs font-semibold mb-2">Wypelnij cala lokalizacje</p>
                          <p className="text-[10px] text-muted-foreground mb-2">{locName} ({apts.length} apt.)</p>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              placeholder="Kwota"
                              className="h-8 text-xs"
                              value={bulkEditOpen?.locName === locName ? bulkEditValue : ""}
                              onChange={e => { setBulkEditOpen({ locName, type }); setBulkEditValue(e.target.value); }}
                              data-testid={`input-bulk-${locName}`}
                            />
                            <Button size="sm" className="h-8 text-xs shrink-0" onClick={() => {
                              const val = parseFloat(bulkEditValue) || 0;
                              bulkFillLocation(locName, type, val);
                              setBulkEditValue("");
                            }} data-testid={`btn-bulk-apply-${locName}`}>
                              OK
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </td>
                  </tr>
                  {!collapsed && apts.map(apt => {
                    let rowTotal = 0;
                    return (
                      <tr key={apt.id} data-testid={`row-${type}-apt-${apt.id}`}>
                        <td className="sticky left-0 z-10 bg-card px-3 py-1.5 border-r border-b border-border">
                          <button className="text-left text-sm hover:underline" onClick={() => { setSelectedApt(apt.id); setSidePanelTab("formularz"); }} data-testid={`btn-apt-${apt.id}`}>{apt.name}</button>
                        </td>
                        {Array.from({ length: 12 }, (_, m) => {
                          const key = `${apt.id}-${m}`;
                          const val = getVal(prefix, key);
                          rowTotal += val;
                          const source = type === "cost" ? costLookup[`apt-${key}`]?.sourceType : null;
                          const hint = getPrevYearHint(type, apt.id, m);
                          return (
                            <td key={m} className={`px-0 py-0 border-b border-border ${m === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>
                              <div className="flex items-center group relative">
                                {type === "cost" && source && (
                                  <span className="text-[10px] shrink-0 ml-0.5" title={source === "contract" ? "Z umowy" : "Reczne"}>
                                    {source === "contract" ? <FileText className="h-3 w-3 text-blue-500" /> : <Pencil className="h-3 w-3 text-muted-foreground" />}
                                  </span>
                                )}
                                <input
                                  type="number"
                                  className="w-full text-right text-[11px] tabular-nums bg-transparent rounded px-1 py-1 outline-none focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  value={getDisplay(prefix, key)}
                                  onChange={e => {
                                    const mutData = type === "rev"
                                      ? { year, month: m, apartmentId: apt.id, forecast: String(parseFloat(e.target.value) || 0) }
                                      : { year, month: m, apartmentId: apt.id, category: "czynsz_wlasciciel", forecast: String(parseFloat(e.target.value) || 0) };
                                    handleEdit(prefix, key, e.target.value, mutData);
                                  }}
                                  placeholder={hint || "0"}
                                  title={hint ? `${year - 1}: ${hint}` : undefined}
                                  data-testid={`input-${type}-${apt.id}-${m}`}
                                />
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <button className="absolute right-0 top-0 h-full px-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity" data-testid={`menu-cell-${type}-${apt.id}-${m}`}>
                                      <MoreHorizontal className="h-3 w-3" />
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48">
                                    <DropdownMenuItem onClick={() => copyFromPrevMonth(apt.id, m, type)} data-testid={`copy-prev-${type}-${apt.id}-${m}`}>
                                      <CopyPlus className="h-3.5 w-3.5 mr-2" />
                                      Z poprzedniego miesiaca
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => copyFromLastYear(apt.id, m, type)} data-testid={`copy-year-${type}-${apt.id}-${m}`}>
                                      <CalendarArrowDown className="h-3.5 w-3.5 mr-2" />
                                      Z zeszlego roku ({year - 1})
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 border-b border-border text-right font-semibold tabular-nums bg-muted/10">{formatNum(rowTotal)}</td>
                        <td className="px-1 py-1 border-b border-border bg-muted/10">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6" data-testid={`btn-row-menu-${type}-${apt.id}`}>
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem className="text-xs font-semibold text-muted-foreground" disabled>{apt.name}</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); }} data-testid={`btn-fill-year-${type}-${apt.id}`}>
                                <div className="w-full" onClick={e => e.stopPropagation()}>
                                  <p className="text-xs font-medium mb-1.5 flex items-center gap-1"><Rows3 className="h-3 w-3" /> Wypelnij caly rok</p>
                                  <div className="flex gap-1.5">
                                    <Input
                                      type="number"
                                      placeholder="Kwota"
                                      className="h-7 text-xs flex-1"
                                      value={fillYearOpen === `${type}-${apt.id}` ? fillYearValue : ""}
                                      onChange={e => { setFillYearOpen(`${type}-${apt.id}`); setFillYearValue(e.target.value); }}
                                      onClick={e => e.stopPropagation()}
                                    />
                                    <Button size="sm" className="h-7 text-xs px-2" onClick={e => {
                                      e.stopPropagation();
                                      fillYear(apt.id, type, parseFloat(fillYearValue) || 0);
                                      setFillYearValue("");
                                      setFillYearOpen(null);
                                    }}>
                                      OK
                                    </Button>
                                  </div>
                                </div>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {templates.length > 0 && (
                                <>
                                  {templates.map(tpl => (
                                    <DropdownMenuItem key={tpl.id} onClick={() => applyTemplate(apt.id, type, tpl)} data-testid={`btn-apply-tpl-${tpl.id}-${apt.id}`}>
                                      <FolderOpen className="h-3.5 w-3.5 mr-2" />
                                      Szablon: {tpl.name}
                                    </DropdownMenuItem>
                                  ))}
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => {
                                const values: number[] = [];
                                for (let m = 0; m < 12; m++) values.push(getVal(prefix, `${apt.id}-${m}`));
                                setNewTemplateValues(values);
                                setNewTemplateName(`${apt.name} - ${type === "rev" ? "przychody" : "koszty"}`);
                                setTemplateDialogOpen(true);
                              }} data-testid={`btn-save-as-tpl-${type}-${apt.id}`}>
                                <Save className="h-3.5 w-3.5 mr-2" />
                                Zapisz jako szablon
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => { setSelectedApt(apt.id); setSidePanelTab("formularz"); }} data-testid={`btn-form-view-${type}-${apt.id}`}>
                                <ClipboardList className="h-3.5 w-3.5 mr-2" />
                                Widok formularza
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedApt(apt.id); setSidePanelTab("historia"); }} data-testid={`btn-history-${type}-${apt.id}`}>
                                <BarChart3 className="h-3.5 w-3.5 mr-2" />
                                Historia i wykresy
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            <tr className="bg-muted/60 font-bold" data-testid={`row-${type}-grand-total`}>
              <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2 border-r border-border">RAZEM</td>
              {grandTotal.map((v, i) => (
                <td key={i} className={`px-2 py-2 border-border text-right tabular-nums ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{formatNum(v)}</td>
              ))}
              <td className="px-2 py-2 border-border text-right tabular-nums bg-muted/30">{formatNum(grandTotal.reduce((s: number, v: number) => s + v, 0))}</td>
              <td className="border-border bg-muted/30"></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  const [collapsedOpCats, setCollapsedOpCats] = useState<Set<string>>(new Set());
  const toggleOpCat = (catId: string) => setCollapsedOpCats(prev => {
    const next = new Set(prev);
    if (next.has(catId)) next.delete(catId); else next.add(catId);
    return next;
  });

  const opGrandTotals = useMemo(() => {
    const forecast = Array(12).fill(0);
    const actual = Array(12).fill(0);
    for (const cat of opCategories) {
      cat.items.forEach((_, itemIdx) => {
        for (let m = 0; m < 12; m++) {
          const key = `${cat.id}-${itemIdx}-${m}`;
          forecast[m] += getVal("op-f", key);
          actual[m] += getVal("op-a", key);
        }
      });
    }
    return { forecast, actual };
  }, [opCategories, getVal]);

  function renderOperationalCosts() {
    if (opLoading) return <Skeleton className="h-64 w-full" />;

    const CAT_COLORS: Record<string, string> = {};
    for (const cat of opCategories) CAT_COLORS[cat.id] = cat.color.replace(/\s*dark:.*/, "");

    return (
      <div className="rounded-md border border-border overflow-x-auto" data-testid="table-operational">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 text-left px-3 py-2 border-r border-b border-border min-w-[220px] font-medium text-muted-foreground">Pozycja</th>
              {MONTHS.map((m, i) => (
                <th key={i} className={`px-2 py-2 border-b border-border text-center font-medium min-w-[85px] ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{m}</th>
              ))}
              <th className="px-2 py-2 border-b border-border text-center font-bold min-w-[90px] bg-muted/30">Razem</th>
            </tr>
          </thead>
          <tbody>
            {opCategories.map(cat => {
              const isCollapsed = collapsedOpCats.has(cat.id);
              const catForecastTotal = Array(12).fill(0);
              cat.items.forEach((_, itemIdx) => {
                for (let m = 0; m < 12; m++) {
                  catForecastTotal[m] += getVal("op-f", `${cat.id}-${itemIdx}-${m}`);
                }
              });
              const catSum = catForecastTotal.reduce((s, v) => s + v, 0);

              return (
                <Fragment key={cat.id}>
                  <tr
                    className={`cursor-pointer hover:bg-muted/60 ${cat.color.split(" ")[0]} bg-opacity-20`}
                    onClick={() => toggleOpCat(cat.id)}
                    data-testid={`row-op-header-${cat.id}`}
                  >
                    <td className="sticky left-0 z-10 px-3 py-2 border-r border-b border-border font-bold text-sm">
                      <div className="flex items-center gap-1.5">
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        <span className={`w-2 h-2 rounded-full ${cat.color.split(" ")[0]}`} />
                        {cat.title}
                        <Badge variant="outline" className="text-[9px] ml-1">{cat.items.length}</Badge>
                      </div>
                    </td>
                    {catForecastTotal.map((v, i) => (
                      <td key={i} className={`px-2 py-2 border-b border-border text-right font-semibold tabular-nums ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{formatNum(v)}</td>
                    ))}
                    <td className="px-2 py-2 border-b border-border text-right font-bold tabular-nums bg-muted/30">{formatNum(catSum)}</td>
                  </tr>
                  {!isCollapsed && cat.items.map((item, itemIdx) => {
                    let itemTotal = 0;
                    return (
                      <tr key={`${cat.id}-${itemIdx}`} className="hover:bg-muted/10" data-testid={`row-op-item-${cat.id}-${itemIdx}`}>
                        <td className="sticky left-0 z-10 bg-card px-3 py-1 border-r border-b border-border pl-7">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium">{item.name}</span>
                            {item.subLabel && <span className="text-[10px] text-muted-foreground">{item.subLabel}</span>}
                          </div>
                        </td>
                        {Array.from({ length: 12 }, (_, m) => {
                          const key = `${cat.id}-${itemIdx}-${m}`;
                          const val = getVal("op-f", key);
                          itemTotal += val;
                          return (
                            <td key={m} className={`px-1 py-1 border-b border-border ${m === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>
                              <input
                                type="number"
                                className="w-full text-right text-[11px] tabular-nums bg-transparent rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-primary/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={getDisplay("op-f", key)}
                                onChange={e => handleEdit("op-f", key, e.target.value, {
                                  year, month: m, categoryId: cat.id, itemIndex: itemIdx,
                                  forecast: String(parseFloat(e.target.value) || 0),
                                })}
                                placeholder="0"
                                data-testid={`input-op-f-${cat.id}-${itemIdx}-${m}`}
                              />
                            </td>
                          );
                        })}
                        <td className="px-2 py-1 border-b border-border text-right font-semibold tabular-nums bg-muted/10">{formatNum(itemTotal)}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            <tr className="bg-muted/60 font-bold" data-testid="row-op-grand-total">
              <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2 border-r border-border">RAZEM</td>
              {opGrandTotals.forecast.map((v, i) => (
                <td key={i} className={`px-2 py-2 border-border text-right tabular-nums ${i === currentMonth && year === currentYear ? CUR_MONTH_BG : ""}`}>{formatNum(v)}</td>
              ))}
              <td className="px-2 py-2 border-border text-right tabular-nums bg-muted/30">{formatNum(opGrandTotals.forecast.reduce((s: number, v: number) => s + v, 0))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  function renderSummary() {
    if (revLoading || costLoading || opLoading) return <Skeleton className="h-64 w-full" />;

    const totalRevByMonth = Array(12).fill(0);
    const totalCostByMonth = Array(12).fill(0);
    activeApts.forEach(apt => {
      for (let m = 0; m < 12; m++) {
        totalRevByMonth[m] += getVal("rev", `${apt.id}-${m}`);
        totalCostByMonth[m] += getVal("cost", `${apt.id}-${m}`);
      }
    });
    for (let m = 0; m < 12; m++) {
      if (totalRevByMonth[m] === 0) {
        totalRevByMonth[m] = razemRevLookup[m] || 0;
      }
    }
    for (let m = 0; m < 12; m++) totalCostByMonth[m] += opGrandTotals.forecast[m];

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
                const revByMonth = Array(12).fill(0);
                const costByMonth = Array(12).fill(0);
                apts.forEach(apt => {
                  for (let m = 0; m < 12; m++) {
                    revByMonth[m] += getVal("rev", `${apt.id}-${m}`);
                    costByMonth[m] += getVal("cost", `${apt.id}-${m}`);
                  }
                });
                for (let m = 0; m < 12; m++) {
                  const rev = revByMonth[m] === 0 ? (locRevLookup[`${locName}-${m}`] || 0) : revByMonth[m];
                  netByMonth[m] = rev - costByMonth[m];
                }
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

  function renderFormView(apt: Apartment) {
    const currentTab = tab;
    const type: "rev" | "cost" = currentTab === "przychody" ? "rev" : "cost";
    const prefix = type === "rev" ? "rev" : "cost";
    const typeLabel = type === "rev" ? "Przychody" : "Koszty";

    return (
      <div className="mt-4 space-y-4" data-testid="form-view">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="text-xs">{typeLabel} {year}</Badge>
          {templates.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs" data-testid="btn-apply-template-form">
                  <FolderOpen className="h-3 w-3 mr-1" /> Zastosuj szablon
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {templates.map(tpl => (
                  <DropdownMenuItem key={tpl.id} onClick={() => applyTemplate(apt.id, type, tpl)}>
                    {tpl.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="space-y-2">
          {MONTHS_FULL.map((monthName, m) => {
            const key = `${apt.id}-${m}`;
            const hint = getPrevYearHint(type, apt.id, m);
            const isCurrent = m === currentMonth && year === currentYear;
            return (
              <div key={m} className={`flex items-center gap-3 px-3 py-2 rounded-md ${isCurrent ? "bg-cyan-50/60 dark:bg-cyan-950/20 ring-1 ring-cyan-200 dark:ring-cyan-800" : "bg-muted/20"}`} data-testid={`form-row-${m}`}>
                <span className="text-xs font-medium w-24 shrink-0">{monthName}</span>
                <Input
                  type="number"
                  className="h-8 text-sm flex-1 max-w-[160px]"
                  value={getDisplay(prefix, key)}
                  onChange={e => {
                    const mutData = type === "rev"
                      ? { year, month: m, apartmentId: apt.id, forecast: String(parseFloat(e.target.value) || 0) }
                      : { year, month: m, apartmentId: apt.id, category: "czynsz_wlasciciel", forecast: String(parseFloat(e.target.value) || 0) };
                    handleEdit(prefix, key, e.target.value, mutData);
                  }}
                  placeholder={hint || "0"}
                  data-testid={`form-input-${m}`}
                />
                <span className="text-[10px] text-muted-foreground shrink-0">PLN</span>
                {hint && (
                  <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-0.5" title={`Wartosc z ${year - 1}`}>
                    <Lightbulb className="h-3 w-3 text-amber-500" />
                    {year - 1}: {hint}
                  </span>
                )}
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6" title="Z poprzedniego miesiaca" onClick={() => copyFromPrevMonth(apt.id, m, type)} data-testid={`form-copy-prev-${m}`}>
                    <CopyPlus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" title={`Z ${year - 1}`} onClick={() => copyFromLastYear(apt.id, m, type)} data-testid={`form-copy-year-${m}`}>
                    <CalendarArrowDown className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t">
          <span className="text-xs font-semibold">Razem:</span>
          <span className="text-sm font-bold tabular-nums">
            {formatNum(Array.from({ length: 12 }, (_, m) => getVal(prefix, `${apt.id}-${m}`)).reduce((s, v) => s + v, 0))} PLN
          </span>
        </div>

        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-semibold">Szybkie wypelnianie</p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Kwota na caly rok"
              className="h-8 text-xs max-w-[160px]"
              value={fillYearOpen === `form-${apt.id}` ? fillYearValue : ""}
              onChange={e => { setFillYearOpen(`form-${apt.id}`); setFillYearValue(e.target.value); }}
              data-testid="form-fill-year-input"
            />
            <Button size="sm" className="h-8 text-xs" onClick={() => {
              fillYear(apt.id, type, parseFloat(fillYearValue) || 0);
              setFillYearValue("");
              setFillYearOpen(null);
            }} data-testid="form-fill-year-btn">
              <Rows3 className="h-3 w-3 mr-1" /> Wypelnij wszystkie
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderHistoryView(apt: Apartment) {
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

    const monthChartData = MONTHS.map((m, i) => {
      const entry: any = { month: m };
      allYears.forEach(y => {
        entry[String(y)] = monthlyByYear[y]?.[i] || 0;
      });
      return entry;
    });

    const chartColors = ["#00CCFF", "hsl(222, 47%, 11%)", "hsl(142, 71%, 45%)", "#f59e0b", "#ef4444", "#8b5cf6"];

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
                  <Bar dataKey="przychod" fill="#00CCFF" name="Przychod" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="koszt" fill="hsl(222, 47%, 11%)" name="Koszt" radius={[2, 2, 0, 0]} />
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
      paymentFrequency: fd.get("paymentFrequency") || "MIESIECZNIE",
      paymentDay: fd.get("paymentDay") ? Number(fd.get("paymentDay")) : 10,
    };
    if (editingContract) {
      contractMutation.mutate({ method: "PUT", url: `/api/owner-contracts/${editingContract.id}`, body });
    } else {
      contractMutation.mutate({ method: "POST", url: "/api/owner-contracts", body });
    }
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
            <Button variant="outline" size="sm" onClick={() => setTemplateDialogOpen(true)} data-testid="btn-templates">
              <FolderOpen className="h-4 w-4 mr-1" /> Szablony ({templates.length})
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
          <TabsTrigger value="koszty_apt" data-testid="tab-koszty-apt">Koszty (apartamenty)</TabsTrigger>
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

      {/* Side panel - form view + history */}
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
            return (
              <div className="mt-3">
                <div className="flex gap-1 border-b mb-0">
                  <button
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${sidePanelTab === "formularz" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setSidePanelTab("formularz")}
                    data-testid="side-tab-form"
                  >
                    <ClipboardList className="h-3.5 w-3.5 inline mr-1" />
                    Formularz
                  </button>
                  <button
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${sidePanelTab === "historia" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setSidePanelTab("historia")}
                    data-testid="side-tab-history"
                  >
                    <BarChart3 className="h-3.5 w-3.5 inline mr-1" />
                    Historia
                  </button>
                </div>
                {sidePanelTab === "formularz" ? renderFormView(apt) : renderHistoryView(apt)}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Copy year dialog */}
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

      {/* Templates dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Szablony prognoz</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Zapisane szablony</p>
              {templates.length === 0 && <p className="text-xs text-muted-foreground italic">Brak zapisanych szablonow. Uzyj menu wiersza, aby zapisac aktualne wartosci jako szablon.</p>}
              {templates.map(tpl => (
                <Card key={tpl.id} className="p-3" data-testid={`template-card-${tpl.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{tpl.name}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tpl.values.map((v, i) => (
                          <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded tabular-nums">{MONTHS[i]}: {v || "—"}</span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">Razem: {formatNum(tpl.values.reduce((s, v) => s + v, 0))} PLN</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => deleteTemplate(tpl.id)} data-testid={`btn-delete-tpl-${tpl.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground">Nowy szablon</p>
              <div>
                <Label className="text-xs">Nazwa szablonu</Label>
                <Input
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  placeholder="np. Apartament standardowy"
                  className="h-8 text-xs mt-1"
                  data-testid="input-template-name"
                />
              </div>
              <div className="grid grid-cols-4 gap-2">
                {MONTHS.map((m, i) => (
                  <div key={i}>
                    <Label className="text-[10px]">{m}</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={newTemplateValues[i] || ""}
                      onChange={e => {
                        const updated = [...newTemplateValues];
                        updated[i] = parseFloat(e.target.value) || 0;
                        setNewTemplateValues(updated);
                      }}
                      placeholder="0"
                      data-testid={`input-tpl-month-${i}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="text-xs"
                  disabled={!newTemplateName.trim()}
                  onClick={() => {
                    saveAsTemplate(newTemplateName, newTemplateValues);
                    setNewTemplateName("");
                    setNewTemplateValues(Array(12).fill(0));
                  }}
                  data-testid="btn-save-new-template"
                >
                  <Save className="h-3.5 w-3.5 mr-1" /> Zapisz szablon
                </Button>
                <span className="text-[10px] text-muted-foreground">Razem: {formatNum(newTemplateValues.reduce((s, v) => s + v, 0))} PLN</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contracts sheet */}
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
            </div>
            <div className="space-y-3">
              {contracts.length === 0 && <p className="text-sm text-muted-foreground">Brak umow</p>}
              {(() => {
                const grouped = new Map<number, OwnerContract[]>();
                const rootContracts: OwnerContract[] = [];
                contracts.forEach(c => {
                  if (!c.parentContractId) {
                    rootContracts.push(c);
                    if (!grouped.has(c.id)) grouped.set(c.id, []);
                  }
                });
                contracts.forEach(c => {
                  if (c.parentContractId) {
                    const chain = grouped.get(c.parentContractId);
                    if (chain) chain.push(c);
                    else grouped.set(c.parentContractId, [c]);
                  }
                });
                const standalone = contracts.filter(c => c.parentContractId && !rootContracts.some(r => r.id === c.parentContractId));
                const aptGroups = new Map<number, { root: OwnerContract[]; annexes: Map<number, OwnerContract[]> }>();
                rootContracts.forEach(c => {
                  const aptId = c.apartmentId || 0;
                  if (!aptGroups.has(aptId)) aptGroups.set(aptId, { root: [], annexes: new Map() });
                  const g = aptGroups.get(aptId)!;
                  g.root.push(c);
                  g.annexes.set(c.id, grouped.get(c.id) || []);
                });
                standalone.forEach(c => {
                  const aptId = c.apartmentId || 0;
                  if (!aptGroups.has(aptId)) aptGroups.set(aptId, { root: [], annexes: new Map() });
                  aptGroups.get(aptId)!.root.push(c);
                });

                return Array.from(aptGroups.entries()).map(([aptId, group]) => {
                  const aptName = apartments.find(a => a.id === aptId)?.name || "Brak apartamentu";
                  return (
                    <div key={aptId} className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{aptName}</h4>
                      {group.root.map(c => {
                        const ownerName = owners.find(o => o.id === c.ownerId)?.name || "\u2014";
                        const annexes = group.annexes.get(c.id) || [];
                        const hasChain = annexes.length > 0;
                        return (
                          <div key={c.id} className="space-y-0">
                            <Card className={hasChain ? "rounded-b-none border-b-0" : ""} data-testid={`card-contract-${c.id}`}>
                              <CardContent className="py-3 px-4">
                                <div className="flex items-start justify-between gap-2 flex-wrap">
                                  <div className="space-y-1">
                                    <p className="font-semibold text-sm">{ownerName}</p>
                                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                                      <span>Czynsz: {c.monthlyRent ? `${Number(c.monthlyRent).toLocaleString("pl-PL")} zl` : "\u2014"}</span>
                                      {c.additionalFees && Number(c.additionalFees) > 0 && <span>+ {Number(c.additionalFees).toLocaleString("pl-PL")} zl</span>}
                                      <span>{c.startDate || "\u2014"} &rarr; {c.endDate || "bezterminowo"}</span>
                                      <Badge variant={c.status === "AKTYWNA" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
                                      <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950">{c.contractType}</Badge>
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
                            {annexes.length > 0 && (
                              <div className="border border-t-0 rounded-b-lg bg-muted/30 dark:bg-muted/10">
                                <div className="px-4 py-1.5">
                                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Aneksy ({annexes.length})</span>
                                </div>
                                {annexes.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || "")).map((ax, idx) => (
                                  <div key={ax.id} className={`px-4 py-2 flex items-center justify-between gap-2 ${idx < annexes.length - 1 ? "border-b border-border/50" : ""}`} data-testid={`card-annex-${ax.id}`}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="w-4 flex flex-col items-center shrink-0">
                                        <div className="w-px h-2 bg-border" />
                                        <div className="w-2 h-2 rounded-full bg-[#5ADBFA] border-2 border-background" />
                                        {idx < annexes.length - 1 && <div className="w-px h-2 bg-border" />}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <Badge variant="outline" className="text-[9px] bg-amber-50 dark:bg-amber-950">ANEKS</Badge>
                                          <span className="text-xs">{ax.startDate} &rarr; {ax.endDate || "bezterminowo"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                          {ax.monthlyRent && <span>Czynsz: {Number(ax.monthlyRent).toLocaleString("pl-PL")} zl</span>}
                                          {ax.notes && <span className="truncate max-w-[200px]">{ax.notes}</span>}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingContract(ax); setPdfParsedData(null); setContractFormOpen(true); }} data-testid={`btn-edit-annex-${ax.id}`}>
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm("Usunac aneks?")) deleteContractMutation.mutate(ax.id); }} data-testid={`btn-delete-annex-${ax.id}`}>
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Contract form dialog */}
      <Dialog open={contractFormOpen} onOpenChange={v => { setContractFormOpen(v); if (!v) { setEditingContract(null); setPdfParsedData(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingContract ? "Edytuj umowe" : pdfParsedData ? `Import ${pdfParsedData.contractType === "ANEKS" ? "aneksu" : "umowy"} (AI)` : "Dodaj umowe"}</DialogTitle></DialogHeader>
          {pdfParsedData && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs space-y-1">
              <p className="font-medium text-blue-700 dark:text-blue-300">Dane odczytane z dokumentu:</p>
              {pdfParsedData.ownerName && <p>Wlasciciel: <strong>{pdfParsedData.ownerName}</strong></p>}
              {pdfParsedData.apartmentName && <p>Apartament: <strong>{pdfParsedData.apartmentName}</strong> {pdfParsedData.apartmentAddress && `(${pdfParsedData.apartmentAddress})`}</p>}
              {pdfParsedData.contractType === "ANEKS" && pdfParsedData.parentContractRef && (
                <p className="text-amber-700 dark:text-amber-300">Aneks do: <strong>{pdfParsedData.parentContractRef}</strong></p>
              )}
              {pdfParsedData.changedFields && pdfParsedData.changedFields.length > 0 && (
                <p>Zmienione pola: {pdfParsedData.changedFields.join(", ")}</p>
              )}
            </div>
          )}
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
                <Label>Czestotliwosc platnosci</Label>
                <Select name="paymentFrequency" defaultValue={editingContract?.paymentFrequency || pdfParsedData?.paymentFrequency || "MIESIECZNIE"}>
                  <SelectTrigger data-testid="select-contract-frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MIESIECZNIE">Miesiecznie</SelectItem>
                    <SelectItem value="KWARTALNIE">Kwartalnie</SelectItem>
                    <SelectItem value="POLROCZNIE">Polrocznie</SelectItem>
                    <SelectItem value="ROCZNIE">Rocznie</SelectItem>
                    <SelectItem value="NIEREGULARNE">Nieregularne</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dzien platnosci</Label>
                <Input name="paymentDay" type="number" min="1" max="28" defaultValue={editingContract?.paymentDay || pdfParsedData?.paymentDay || "10"} data-testid="input-contract-pay-day" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <Select name="contractType" defaultValue={editingContract?.contractType || pdfParsedData?.contractType || "UMOWA"}>
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
              <Select name="parentContractId" defaultValue={String(editingContract?.parentContractId || pdfParsedData?.parentContractId || "")}>
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
