import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CostTargetWizard, type WizardSelection } from "@/components/CostTargetWizard";
import { SearchableTargetSelect } from "@/components/SearchableTargetSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Search, Trash2, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, X, Pencil, Tag, Check, Scale, TrendingUp, TrendingDown, Wallet, ArrowUpDown, ArrowUp, ArrowDown, Filter, ChevronDown, ChevronUp, CheckCircle2, Ban, Minus, Loader2, Sparkles, ListFilter, Undo2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import type { SaldoEntry } from "@shared/schema";

const PAGE_SIZE = 100;

function formatDate(d: string) {
  if (!d) return "";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  return d;
}

function formatNum(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = parseFloat(v);
  if (isNaN(n)) return "";
  return n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type CostStatus = "all" | "pending" | "assigned" | "skipped";

interface AssignmentTargets {
  operational: {
    catId: string;
    title: string;
    items: { catId: string; itemIdx: number; name: string; subLabel: string | null; realizedByMonth: Record<number, number> }[];
  }[];
  apartment: {
    entryId: string;
    name: string;
    location?: string | null;
    categories: { category: string; realizedByMonth: Record<number, number> }[];
  }[];
  sublease: {
    subleaseId: number;
    tenantName: string;
    apartmentNames: string;
    unpaidPayments: { id: number; title: string; category: string; amount: string; dueDate: string }[];
  }[];
}

interface TargetOption {
  key: string;
  label: string;
  group: string;
  targetType: "operational" | "apartment" | "sublease";
  catId?: string;
  itemIdx?: number;
  entryId?: string;
  category?: string;
  subleasePaymentId?: number;
}

function targetOptionToWizardSelection(opt: TargetOption): WizardSelection {
  return {
    targetType: opt.targetType,
    catId: opt.catId,
    itemIdx: opt.itemIdx,
    entryId: opt.entryId,
    category: opt.category,
    subleasePaymentId: opt.subleasePaymentId,
    label: opt.label,
  };
}

function formatPLN(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "-";
  return num.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

function buildTargetOptions(targets: AssignmentTargets | undefined): TargetOption[] {
  if (!targets) return [];
  const opts: TargetOption[] = [];
  for (const cat of targets.operational) {
    for (const item of cat.items) {
      opts.push({
        key: `op__${item.catId}__${item.itemIdx}`,
        label: `${cat.title} → ${item.name}${item.subLabel ? ` (${item.subLabel})` : ""}`,
        group: "Koszty operacyjne",
        targetType: "operational",
        catId: item.catId,
        itemIdx: item.itemIdx,
      });
    }
  }
  for (const apt of targets.apartment) {
    for (const catEntry of apt.categories) {
      opts.push({
        key: `apt__${apt.entryId}__${catEntry.category}`,
        label: `${apt.name} → ${catEntry.category}`,
        group: "Koszty apartamentów",
        targetType: "apartment",
        entryId: apt.entryId,
        category: catEntry.category,
      });
    }
  }
  for (const sub of targets.sublease) {
    for (const pay of sub.unpaidPayments) {
      opts.push({
        key: `sub__${pay.id}`,
        label: `${sub.tenantName} → ${pay.title} (${formatPLN(pay.amount)})`,
        group: "Podnajem",
        targetType: "sublease",
        subleasePaymentId: pay.id,
      });
    }
  }
  return opts;
}

const SALDO_PERSONS = [
  { key: "ml", name: "Małgorzata Latasiewicz" },
  { key: "jg", name: "Jolanta Głodkowska" },
  { key: "mc", name: "Mateusz Cieślak" },
];

function buildTrendData(entries: SaldoEntry[], initialBalance: number) {
  const dailyMap = new Map<string, number>();
  let running = initialBalance;
  for (const e of entries) {
    if (e.cashAmount) running += parseFloat(e.cashAmount);
    if (e.date) dailyMap.set(e.date, running);
  }
  const sorted = Array.from(dailyMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const last30 = sorted.slice(-30);
  return last30.map(([date, saldo]) => ({
    date: date.slice(5).replace("-", "."),
    saldo: Math.round(saldo * 100) / 100,
  }));
}

function SaldoSparkline({ entries, initialBalance, height = 80 }: { entries: SaldoEntry[]; initialBalance: number; height?: number }) {
  const data = useMemo(() => buildTrendData(entries, initialBalance), [entries, initialBalance]);
  if (data.length < 2) return null;
  const minVal = Math.min(...data.map(d => d.saldo));
  const maxVal = Math.max(...data.map(d => d.saldo));
  const hasNegative = minVal < 0;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <defs>
          <linearGradient id="saldoGradientPos" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="saldoGradientNeg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis domain={[minVal - Math.abs(minVal * 0.1), maxVal + Math.abs(maxVal * 0.1)]} hide />
        {hasNegative && <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.5} />}
        <Tooltip
          contentStyle={{ fontSize: "11px", borderRadius: "6px", border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
          formatter={(value: number) => [`${value.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł`, "Saldo"]}
          labelFormatter={(label: string) => `Data: ${label}`}
        />
        <Area
          type="monotone"
          dataKey="saldo"
          stroke={data[data.length - 1].saldo >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"}
          fill={data[data.length - 1].saldo >= 0 ? "url(#saldoGradientPos)" : "url(#saldoGradientNeg)"}
          strokeWidth={1.5}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function SaldoPersonCard({ person, isSelected, onSelect }: { person: typeof SALDO_PERSONS[0]; isSelected: boolean; onSelect: () => void }) {
  const { data: entries = [] } = useQuery<SaldoEntry[]>({
    queryKey: ["/api/saldo", { personName: person.name }],
    queryFn: async () => {
      const res = await fetch(`/api/saldo?personName=${encodeURIComponent(person.name)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const { data: initialBalanceData } = useQuery<{ personName: string; initialBalance: string }>({
    queryKey: ["/api/saldo/initial-balance", { personName: person.name }],
    queryFn: async () => {
      const res = await fetch(`/api/saldo/initial-balance?personName=${encodeURIComponent(person.name)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });
  const ib = parseFloat(initialBalanceData?.initialBalance || "0");
  const currentSaldo = useMemo(() => {
    let running = ib;
    for (const e of entries) {
      if (e.cashAmount) running += parseFloat(e.cashAmount);
    }
    return running;
  }, [entries, ib]);
  const entryCount = entries.length;
  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : null;

  return (
    <Card
      className={`cursor-pointer transition-colors ${isSelected ? "ring-2 ring-primary" : "hover-elevate"}`}
      onClick={onSelect}
      data-testid={`card-person-${person.key}`}
    >
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold" data-testid={`text-person-name-${person.key}`}>{person.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {currentSaldo >= 0 ? <TrendingUp className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /> : <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
            <span className={`text-lg font-bold tabular-nums ${currentSaldo >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid={`text-person-saldo-${person.key}`}>
              {currentSaldo.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
            </span>
          </div>
        </div>
        <SaldoSparkline entries={entries} initialBalance={ib} height={60} />
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground flex-wrap">
          <span>{entryCount} wpisów</span>
          {lastEntry && <span>Ostatni: {formatDate(lastEntry.date)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Saldo({ personName: personNameProp }: { personName?: string }) {
  const [selectedPerson, setSelectedPerson] = useState(personNameProp || SALDO_PERSONS[0].name);
  const personName = personNameProp || selectedPerson;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [entryKindFilter, setEntryKindFilter] = useState<"ALL" | "PRZYCHOD" | "KOSZT">("ALL");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<"date" | "operationName" | "category" | "cashAmount" | "cardAmount">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importing, setImporting] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<SaldoEntry | null>(null);
  const [editEntry, setEditEntry] = useState<SaldoEntry | null>(null);

  useEffect(() => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setPaymentFilter("all");
    setTypeFilter("all");
    setEntryKindFilter("ALL");
    setCategoryFilter("all");
    setSortField("date");
    setSortDir("desc");
    setPage(0);
    setPreviewEntry(null);
    setEditEntry(null);
    setCostStatusFilter("all");
    setExpandedEntryId(null);
    setSelectedTargets({});
    setSelectedEntryIds(new Set());
    setBulkWizardSelection(null);
  }, [personName]);
  const [editForm, setEditForm] = useState({
    date: "", operationName: "", reservationNumber: "", guestName: "",
    type: "", paymentMethod: "", kasaFiskalna: "NIE", faktura: "NIE",
    cashAmount: "", saldo: "", cardAmount: "", authCode: "", notes: "",
    entryKind: "PRZYCHOD" as string, category: "",
  });
  const [activeTab, setActiveTab] = useState<"wpisy" | "kategorie" | "reguly">("wpisy");
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [editingInitialBalance, setEditingInitialBalance] = useState(false);
  const [initialBalanceInput, setInitialBalanceInput] = useState("");
  const [costStatusFilter, setCostStatusFilter] = useState<CostStatus>("all");
  const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<Record<number, WizardSelection>>({});
  const [selectedCategories, setSelectedCategories] = useState<Record<number, string>>({});
  const [aiCategorizing, setAiCategorizing] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState("");
  const [newRuleTarget, setNewRuleTarget] = useState("");
  const [importDuplicates, setImportDuplicates] = useState<{ index: number; existingId: number; date: string; operationName: string }[]>([]);
  const [skipDuplicatesOnImport, setSkipDuplicatesOnImport] = useState(true);
  const [importChecking, setImportChecking] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());
  const [bulkWizardSelection, setBulkWizardSelection] = useState<WizardSelection | null>(null);

  type SaldoRule = { pattern: string; category?: string; targetKey?: string };
  const RULES_KEY = "saldo-categorization-rules";
  const loadRules = (): SaldoRule[] => {
    try { return JSON.parse(localStorage.getItem(RULES_KEY) || "[]"); } catch { return []; }
  };
  const saveRules = (rules: SaldoRule[]) => { localStorage.setItem(RULES_KEY, JSON.stringify(rules)); };
  const [rules, setRules] = useState<SaldoRule[]>(() => loadRules());

  const [newEntry, setNewEntry] = useState({
    date: new Date().toISOString().split("T")[0],
    operationName: "",
    reservationNumber: "",
    guestName: "",
    type: "",
    paymentMethod: "",
    kasaFiskalna: "NIE",
    faktura: "NIE",
    cashAmount: "",
    cardAmount: "",
    authCode: "",
    notes: "",
    entryKind: "PRZYCHOD" as string,
    category: "",
  });

  const { data: entries = [], isLoading } = useQuery<SaldoEntry[]>({
    queryKey: ["/api/saldo", { personName }],
    queryFn: async () => {
      const res = await fetch(`/api/saldo?personName=${encodeURIComponent(personName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch saldo entries");
      return res.json();
    },
  });

  const { data: initialBalanceData } = useQuery<{ personName: string; initialBalance: string }>({
    queryKey: ["/api/saldo/initial-balance", { personName }],
    queryFn: async () => {
      const res = await fetch(`/api/saldo/initial-balance?personName=${encodeURIComponent(personName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch initial balance");
      return res.json();
    },
  });

  const initialBalance = parseFloat(initialBalanceData?.initialBalance || "0");

  const updateInitialBalanceMutation = useMutation({
    mutationFn: (value: string) => apiRequest("PUT", "/api/saldo/initial-balance", { personName, initialBalance: value }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/initial-balance", { personName }] });
      toast({ title: "Zapisano saldo początkowe" });
      setEditingInitialBalance(false);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message || "Nie udało się zapisać salda", variant: "destructive" }),
  });

  const { data: categories = [] } = useQuery<string[]>({
    queryKey: ["/api/saldo/categories", { personName }],
    queryFn: async () => {
      const res = await fetch(`/api/saldo/categories?personName=${encodeURIComponent(personName)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const { data: categoriesWithType = [] } = useQuery<{ name: string; type: string }[]>({
    queryKey: ["/api/saldo/categories-typed", { personName }],
    queryFn: async () => {
      const res = await fetch(`/api/saldo/categories?personName=${encodeURIComponent(personName)}&withType=true`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const incomeCategories = useMemo(() => categoriesWithType.filter(c => c.type === 'PRZYCHOD').map(c => c.name), [categoriesWithType]);
  const costCategories = useMemo(() => categoriesWithType.filter(c => c.type === 'KOSZT').map(c => c.name), [categoriesWithType]);

  const now = new Date();
  const { data: targets } = useQuery<AssignmentTargets>({
    queryKey: ["/api/assignment-targets", now.getFullYear(), now.getMonth() + 1],
    queryFn: async () => {
      const res = await fetch(`/api/assignment-targets?year=${now.getFullYear()}&month=${now.getMonth() + 1}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load targets");
      return res.json();
    },
  });
  const targetOptions = useMemo(() => buildTargetOptions(targets), [targets]);

  const renameCategoryMutation = useMutation({
    mutationFn: ({ oldName, newName }: { oldName: string; newName: string }) =>
      apiRequest("PUT", `/api/saldo/categories/${encodeURIComponent(oldName)}`, { newName, personName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories", { personName }] });
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories-typed", { personName }] });
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      toast({ title: "Zmieniono nazwę kategorii" });
      setEditingCat(null);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message || "Nie udało się zmienić nazwy kategorii", variant: "destructive" }),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (name: string) => apiRequest("DELETE", `/api/saldo/categories/${encodeURIComponent(name)}?personName=${encodeURIComponent(personName)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories", { personName }] });
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories-typed", { personName }] });
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      toast({ title: "Usunięto kategorię" });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message || "Nie udało się usunąć kategorii", variant: "destructive" }),
  });

  const bulkDeleteCategoryMutation = useMutation({
    mutationFn: (names: string[]) => apiRequest("POST", "/api/saldo/categories/bulk-delete", { names, personName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories", { personName }] });
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories-typed", { personName }] });
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      setSelectedCats(new Set());
      toast({ title: "Usunięto wybrane kategorie" });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message || "Nie udało się usunąć kategorii", variant: "destructive" }),
  });

  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"PRZYCHOD" | "KOSZT">("KOSZT");
  const createCategoryMutation = useMutation({
    mutationFn: ({ name, type }: { name: string; type: string }) => apiRequest("POST", "/api/saldo/categories", { name, personName, type }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories", { personName }] });
      queryClient.invalidateQueries({ queryKey: ["/api/saldo/categories-typed", { personName }] });
      toast({ title: "Dodano kategorię" });
      setNewCatName("");
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message || "Nie udało się dodać kategorii", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/saldo", { ...data, personName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      toast({ title: "Dodano wpis" });
      setShowAddDialog(false);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message || "Nie udało się dodać wpisu", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/saldo/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      toast({ title: "Zapisano zmiany" });
      setEditEntry(null);
      setPreviewEntry(null);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message || "Nie udało się zaktualizować wpisu", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/saldo/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      toast({ title: "Usunięto wpis" });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message || "Nie udało się usunąć wpisu", variant: "destructive" }),
  });

  const addRule = (pattern: string, category?: string, targetKey?: string) => {
    if (!pattern.trim()) return;
    const existing = rules.find(r => r.pattern.toLowerCase() === pattern.toLowerCase());
    if (existing) return;
    const updated = [...rules, { pattern: pattern.trim(), category, targetKey }];
    setRules(updated);
    saveRules(updated);
  };

  const removeRule = (idx: number) => {
    const updated = rules.filter((_, i) => i !== idx);
    setRules(updated);
    saveRules(updated);
  };

  const applyRulesToEntry = (entry: SaldoEntry) => {
    const text = (entry.operationName || "").toLowerCase();
    for (const rule of rules) {
      if (text.includes(rule.pattern.toLowerCase())) {
        return rule;
      }
    }
    return null;
  };

  useEffect(() => {
    if (expandedEntryId === null) return;
    const entry = entries.find(e => e.id === expandedEntryId);
    if (!entry || entry.costImported || entry.costSkipped) return;
    const rule = applyRulesToEntry(entry);
    if (rule) {
      if (rule.category && !selectedCategories[expandedEntryId]) {
        setSelectedCategories(prev => ({ ...prev, [expandedEntryId]: rule.category! }));
      }
      if (rule.targetKey && !selectedTargets[expandedEntryId]) {
        const opt = targetOptions.find(o => o.key === rule.targetKey);
        if (opt) {
          setSelectedTargets(prev => ({ ...prev, [expandedEntryId]: targetOptionToWizardSelection(opt) }));
        }
      }
    }
    if (entry.aiCategory && !selectedCategories[expandedEntryId] && !rule?.category) {
      setSelectedCategories(prev => ({ ...prev, [expandedEntryId]: entry.aiCategory! }));
    }
  }, [expandedEntryId]);

  const handleApplyRulesToAll = async () => {
    const pending = entries.filter(e => !e.costImported && !e.costSkipped);
    let applied = 0;
    const newCats: Record<number, string> = {};
    const newTargets: Record<number, WizardSelection> = {};
    for (const entry of pending) {
      const rule = applyRulesToEntry(entry);
      if (rule) {
        let didApply = false;
        if (rule.category && rule.category !== "none") {
          try {
            await apiRequest("PUT", `/api/saldo/${entry.id}`, { category: rule.category });
            newCats[entry.id] = rule.category;
            didApply = true;
          } catch {}
        }
        if (rule.targetKey) {
          const opt = targetOptions.find(o => o.key === rule.targetKey);
          if (opt) {
            newTargets[entry.id] = targetOptionToWizardSelection(opt);
            didApply = true;
          }
        }
        if (didApply) applied++;
      }
    }
    if (Object.keys(newCats).length > 0) {
      setSelectedCategories(prev => ({ ...prev, ...newCats }));
    }
    if (Object.keys(newTargets).length > 0) {
      setSelectedTargets(prev => ({ ...prev, ...newTargets }));
    }
    if (applied > 0) {
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      toast({ title: `Zastosowano reguły do ${applied} wpisów` });
    } else {
      toast({ title: "Brak pasujących reguł do zastosowania" });
    }
  };

  const handleUnassignCost = async (entryId: number) => {
    try {
      await apiRequest("POST", `/api/saldo/${entryId}/unassign-cost`);
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-targets"] });
      toast({ title: "Cofnięto przypisanie" });
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    }
  };

  const handleAssignCost = async (entryId: number) => {
    const sel = selectedTargets[entryId];
    if (!sel) return;

    const entry = entries.find(e => e.id === entryId);
    const cat = selectedCategories[entryId];
    if (cat && cat !== "none" && entry) {
      await apiRequest("PUT", `/api/saldo/${entryId}`, { category: cat });
    }

    const assignment: any = { entryId, targetType: sel.targetType };
    if (sel.targetType === "operational") {
      assignment.catId = sel.catId;
      assignment.itemIdx = sel.itemIdx;
    } else if (sel.targetType === "apartment") {
      assignment.aptEntryId = sel.entryId;
      assignment.category = sel.category;
    } else if (sel.targetType === "sublease") {
      assignment.subleasePaymentId = sel.subleasePaymentId;
    }

    const targetKey = sel.targetType === "operational" ? `op__${sel.catId}__${sel.itemIdx}` :
                      sel.targetType === "apartment" ? `apt__${sel.entryId}__${sel.category}` :
                      sel.targetType === "sublease" ? `sub__${sel.subleasePaymentId}` : "";
    if (entry) {
      const rulePattern = (entry.operationName || "").trim();
      if (rulePattern.length >= 3) {
        addRule(rulePattern, cat || undefined, targetKey);
      }
    }

    try {
      const res = await apiRequest("POST", "/api/saldo/import-to-targets", { assignments: [assignment] });
      const data = await res.json();
      const r = data.results?.[0];
      if (r?.amountMismatch) {
        if (window.confirm(`${r.message}\n\nCzy mimo to przypisać?`)) {
          await apiRequest("POST", "/api/saldo/import-to-targets", { assignments: [{ ...assignment, forceAmount: true }] });
        } else return;
      } else if (r?.duplicateWarning) {
        toast({ title: "Ostrzeżenie", description: r.message, variant: "destructive" });
        return;
      } else if (r?.skipped) {
        toast({ title: "Pominięto", description: r.message });
        return;
      } else if (!r?.success) {
        toast({ title: "Nie przypisano", description: "Brak wyniku z serwera", variant: "destructive" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-targets"] });
      toast({ title: "Przypisano do kosztów" });
      setExpandedEntryId(null);
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    }
  };

  const handleSkip = async (entryId: number) => {
    try {
      await apiRequest("POST", `/api/saldo/${entryId}/skip`);
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      toast({ title: "Wpis pominięty" });
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    }
  };

  const handleUnskip = async (entryId: number) => {
    try {
      await apiRequest("POST", `/api/saldo/${entryId}/unskip`);
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      toast({ title: "Wpis przywrócony" });
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    }
  };

  const handleAiCategorize = async () => {
    const pendingEntries = entries.filter(e => !e.costImported && !e.costSkipped);
    if (pendingEntries.length === 0) {
      toast({ title: "Brak wpisów do kategoryzacji" });
      return;
    }
    const batch = pendingEntries.slice(0, 50);
    setAiCategorizing(true);
    try {
      const res = await apiRequest("POST", "/api/saldo/ai-categorize", {
        entries: batch.map(e => ({ id: e.id, date: e.date, cashAmount: e.cashAmount, operationName: e.operationName, guestName: e.guestName, type: e.type })),
        personCategories: categoriesWithType,
        targetOptions: targetOptions.slice(0, 100).map(t => ({ key: t.key, group: t.group, label: t.label })),
      });
      const data = await res.json();
      if (data.categories && Array.isArray(data.categories)) {
        const newTargets: Record<number, WizardSelection> = {};
        const newCats: Record<number, string> = {};
        for (const cat of data.categories) {
          const idx = cat.index - 1;
          if (idx >= 0 && idx < batch.length) {
            const entryId = batch[idx].id;
            if (cat.category) newCats[entryId] = cat.category;
            if (cat.targetKey) {
              const opt = targetOptions.find(o => o.key === cat.targetKey);
              if (opt) newTargets[entryId] = targetOptionToWizardSelection(opt);
            }
          }
        }
        setSelectedCategories(prev => ({ ...prev, ...newCats }));
        setSelectedTargets(prev => ({ ...prev, ...newTargets }));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      toast({ title: `AI skategoryzowało ${data.categories?.length || 0} wpisów` });
    } catch (err: any) {
      toast({ title: "Błąd AI", description: err.message, variant: "destructive" });
    } finally {
      setAiCategorizing(false);
    }
  };

  const openEdit = (entry: SaldoEntry) => {
    setEditForm({
      date: entry.date || "",
      operationName: entry.operationName || "",
      reservationNumber: entry.reservationNumber || "",
      guestName: entry.guestName || "",
      type: entry.type || "",
      paymentMethod: entry.paymentMethod || "",
      kasaFiskalna: entry.kasaFiskalna || "NIE",
      faktura: entry.faktura || "NIE",
      cashAmount: entry.cashAmount || "",
      saldo: entry.saldo || "",
      cardAmount: entry.cardAmount || "",
      authCode: entry.authCode || "",
      notes: entry.notes || "",
      entryKind: entry.entryKind || "PRZYCHOD",
      category: entry.category || "",
    });
    setEditEntry(entry);
  };

  const handleSaveEdit = () => {
    if (!editEntry) return;
    const data: any = {
      date: editForm.date,
      operationName: editForm.operationName,
      reservationNumber: editForm.reservationNumber || null,
      guestName: editForm.guestName || null,
      type: editForm.type || null,
      paymentMethod: editForm.paymentMethod || null,
      kasaFiskalna: editForm.kasaFiskalna || null,
      faktura: editForm.faktura || null,
      cashAmount: editForm.cashAmount ? parseFloat(editForm.cashAmount).toFixed(2) : null,
      saldo: editForm.saldo ? parseFloat(editForm.saldo).toFixed(2) : null,
      cardAmount: editForm.cardAmount ? parseFloat(editForm.cardAmount).toFixed(2) : null,
      authCode: editForm.authCode || null,
      notes: editForm.notes || null,
      entryKind: editForm.entryKind || null,
      category: editForm.category || null,
    };
    updateMutation.mutate({ id: editEntry.id, data });
  };

  const paymentMethods = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { if (e.paymentMethod) s.add(e.paymentMethod); });
    return [...s].sort();
  }, [entries]);

  const types = useMemo(() => {
    const s = new Set<string>();
    entries.forEach(e => { if (e.type) s.add(e.type); });
    return [...s].sort();
  }, [entries]);

  const usedCategories = useMemo(() => {
    const cats = new Set<string>();
    entries.forEach(e => { if (e.category) cats.add(e.category); if (e.type) cats.add(e.type); });
    return [...cats].sort();
  }, [entries]);

  const hasActiveFilters = searchQuery || dateFrom || dateTo || paymentFilter !== "all" || typeFilter !== "all" || entryKindFilter !== "ALL" || categoryFilter !== "all" || costStatusFilter !== "all";

  const clearAllFilters = () => {
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setPaymentFilter("all");
    setTypeFilter("all");
    setEntryKindFilter("ALL");
    setCategoryFilter("all");
    setCostStatusFilter("all");
    setPage(0);
  };

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1 text-primary" /> : <ArrowDown className="h-3 w-3 ml-1 text-primary" />;
  };

  const filtered = useMemo(() => {
    let result = [...entries];
    if (dateFrom) result = result.filter(e => e.date >= dateFrom);
    if (dateTo) result = result.filter(e => e.date <= dateTo);
    if (paymentFilter !== "all") result = result.filter(e => e.paymentMethod === paymentFilter);
    if (typeFilter !== "all") result = result.filter(e => e.type === typeFilter);
    if (entryKindFilter !== "ALL") result = result.filter(e => e.entryKind === entryKindFilter);
    if (categoryFilter !== "all") result = result.filter(e => (e.category || e.type) === categoryFilter);
    if (costStatusFilter === "pending") result = result.filter(e => !e.costImported && !e.costSkipped);
    else if (costStatusFilter === "assigned") result = result.filter(e => e.costImported);
    else if (costStatusFilter === "skipped") result = result.filter(e => e.costSkipped);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
        (e.operationName?.toLowerCase().includes(q)) ||
        (e.guestName?.toLowerCase().includes(q)) ||
        (e.reservationNumber?.toLowerCase().includes(q)) ||
        (e.notes?.toLowerCase().includes(q))
      );
    }
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "date": cmp = (a.date || "").localeCompare(b.date || ""); break;
        case "operationName": cmp = (a.operationName || "").localeCompare(b.operationName || ""); break;
        case "category": cmp = (a.category || a.type || "").localeCompare(b.category || b.type || ""); break;
        case "cashAmount": cmp = (Number(a.cashAmount || 0)) - (Number(b.cashAmount || 0)); break;
        case "cardAmount": cmp = (Number(a.cardAmount || 0)) - (Number(b.cardAmount || 0)); break;
      }
      if (cmp === 0) cmp = a.id - b.id;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [entries, dateFrom, dateTo, paymentFilter, typeFilter, entryKindFilter, categoryFilter, costStatusFilter, searchQuery, sortField, sortDir]);

  const pendingEntries = useMemo(() =>
    filtered.filter(e => !e.costImported && !e.costSkipped && e.entryKind === "KOSZT"),
    [filtered]
  );

  const selectedSum = useMemo(() => {
    if (selectedEntryIds.size === 0) return 0;
    return entries
      .filter(e => selectedEntryIds.has(e.id))
      .reduce((sum, e) => sum + Math.abs(parseFloat(e.cashAmount || "0")), 0);
  }, [entries, selectedEntryIds]);

  const handleToggleSelect = useCallback((id: number) => {
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    if (selectedEntryIds.size === pendingEntries.length && pendingEntries.length > 0) {
      setSelectedEntryIds(new Set());
    } else {
      setSelectedEntryIds(new Set(pendingEntries.map(e => e.id)));
    }
  }, [pendingEntries, selectedEntryIds.size]);

  interface SaldoAssignment {
    entryId: number;
    targetType: "operational" | "apartment" | "sublease";
    forceAmount: boolean;
    catId?: string;
    itemIdx?: number;
    aptEntryId?: string;
    category?: string;
    subleasePaymentId?: number;
  }

  interface ImportResult {
    success?: boolean;
    skipped?: boolean;
    duplicateWarning?: boolean;
    message?: string;
  }

  const bulkAssignMutation = useMutation({
    mutationFn: async () => {
      if (!bulkWizardSelection) throw new Error("Wybierz pozycję kosztową");
      const ids = Array.from(selectedEntryIds);
      const assignments: SaldoAssignment[] = ids.map(entryId => {
        const base: SaldoAssignment = { entryId, targetType: bulkWizardSelection.targetType, forceAmount: true };
        if (bulkWizardSelection.targetType === "operational") {
          base.catId = bulkWizardSelection.catId;
          base.itemIdx = bulkWizardSelection.itemIdx;
        } else if (bulkWizardSelection.targetType === "apartment") {
          base.aptEntryId = bulkWizardSelection.entryId;
          base.category = bulkWizardSelection.category;
        } else if (bulkWizardSelection.targetType === "sublease") {
          base.subleasePaymentId = bulkWizardSelection.subleasePaymentId;
        }
        return base;
      });
      const res = await apiRequest("POST", "/api/saldo/import-to-targets", { assignments });
      return res.json() as Promise<{ results: ImportResult[] }>;
    },
    onSuccess: (data) => {
      const results = data?.results || [];
      const successCount = results.filter((r) => r?.success).length;
      const skippedCount = results.filter((r) => r?.skipped || r?.duplicateWarning).length;
      const failCount = selectedEntryIds.size - successCount - skippedCount;
      let desc = `Przypisano ${successCount} wpisów`;
      if (skippedCount > 0) desc += `, pominięto ${skippedCount}`;
      if (failCount > 0) desc += `, błędów: ${failCount}`;
      toast({ title: "Grupowe przypisanie", description: desc });
      setSelectedEntryIds(new Set());
      setBulkWizardSelection(null);
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignment-targets"] });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const bulkSkipMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/saldo/bulk-skip", {
        entryIds: Array.from(selectedEntryIds),
      });
    },
    onSuccess: () => {
      toast({ title: "Pominięto", description: `Pominięto ${selectedEntryIds.size} wpisów` });
      setSelectedEntryIds(new Set());
      setBulkWizardSelection(null);
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const runningSaldoMap = useMemo(() => {
    const map = new Map<number, number>();
    let running = initialBalance;
    for (const e of entries) {
      if (e.cashAmount) running += parseFloat(e.cashAmount);
      map.set(e.id, running);
    }
    return map;
  }, [entries, initialBalance]);

  const currentSaldo = entries.length > 0 ? (runningSaldoMap.get(entries[entries.length - 1].id) || initialBalance) : initialBalance;

  const summary = useMemo(() => {
    let totalCash = 0;
    let totalCard = 0;
    filtered.forEach(e => {
      if (e.cashAmount) totalCash += parseFloat(e.cashAmount);
      if (e.cardAmount) totalCard += parseFloat(e.cardAmount);
    });
    const pendingCount = entries.filter(e => !e.costImported && !e.costSkipped).length;
    const assignedCount = entries.filter(e => e.costImported).length;
    return { totalCash, totalCard, lastSaldo: currentSaldo, count: filtered.length, pendingCount, assignedCount };
  }, [filtered, entries, currentSaldo]);

  const handleCheckDuplicatesBeforeImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setImportChecking(true);
    setImportDuplicates([]);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const saldoSheet = wb.SheetNames.find((n: string) => n.toLowerCase().includes("saldo")) || wb.SheetNames[0];
      const ws = wb.Sheets[saldoSheet];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const checkEntries = rows.slice(0, 200).map((row: any) => {
        const dateRaw = row["Data"] || row["data"] || "";
        let date = "";
        if (typeof dateRaw === "number") {
          const d = XLSX.SSF.parse_date_code(dateRaw);
          date = `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
        } else if (typeof dateRaw === "string" && dateRaw.includes("-")) {
          date = dateRaw.split("T")[0];
        }
        return {
          date,
          operationName: row["Nazwa operacji"] || row["operationName"] || "",
          cashAmount: String(row["Suma (got.)"] || row["cashAmount"] || "0"),
        };
      }).filter((e: any) => e.date && e.operationName);

      if (checkEntries.length > 0) {
        const dupRes = await apiRequest("POST", "/api/saldo/check-duplicates", {
          personName,
          entries: checkEntries,
        });
        const dupData = await dupRes.json();
        setImportDuplicates(dupData.duplicates || []);
        if (!dupData.duplicates?.length) {
          toast({ title: "Brak duplikatów" });
        }
      }
    } catch (err: any) {
      toast({ title: "Błąd odczytu pliku", description: err.message, variant: "destructive" });
    } finally {
      setImportChecking(false);
    }
  };

  const handleImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const skipDups = skipDuplicatesOnImport && importDuplicates.length > 0;
      const replaceParam = skipDups ? "" : "replace=true&";
      const skipParam = skipDups ? "&skipDuplicates=true" : "";
      const res = await fetch(`/api/saldo/import-xlsx?${replaceParam}personName=${encodeURIComponent(personName)}${skipParam}`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message);
      queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
      const skipMsg = result.skippedDuplicates > 0 ? ` (pominięto ${result.skippedDuplicates} duplikatów)` : "";
      toast({ title: `Zaimportowano ${result.imported} wpisów z arkusza "${result.sheetName}"${skipMsg}` });
      setShowImportDialog(false);
      setImportDuplicates([]);

      const freshData = await fetch(`/api/saldo?personName=${encodeURIComponent(personName)}`, { credentials: "include" });
      if (freshData.ok) {
        const freshEntries = await freshData.json();
        const rules = JSON.parse(localStorage.getItem("saldo-categorization-rules") || "[]");
        if (rules.length > 0 && Array.isArray(freshEntries)) {
          let ruleApplied = 0;
          for (const entry of freshEntries) {
            if (entry.costImported || entry.costSkipped || entry.category) continue;
            for (const rule of rules) {
              if (entry.operationName?.toLowerCase().includes(rule.pattern?.toLowerCase())) {
                if (rule.category) {
                  try {
                    await apiRequest("PUT", `/api/saldo/${entry.id}`, { category: rule.category });
                    ruleApplied++;
                  } catch {}
                }
                break;
              }
            }
          }
          if (ruleApplied > 0) {
            queryClient.invalidateQueries({ queryKey: ["/api/saldo", { personName }] });
            toast({ title: `Automatycznie zastosowano reguły do ${ruleApplied} nowych wpisów` });
          }
        }
      }
    } catch (err: any) {
      toast({ title: "Błąd importu", description: err.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const handleAddEntry = () => {
    const data: any = {
      date: newEntry.date,
      operationName: newEntry.operationName,
      reservationNumber: newEntry.reservationNumber || null,
      guestName: newEntry.guestName || null,
      type: newEntry.type || null,
      paymentMethod: newEntry.paymentMethod || null,
      kasaFiskalna: newEntry.kasaFiskalna || null,
      faktura: newEntry.faktura || null,
      cashAmount: newEntry.cashAmount ? (newEntry.entryKind === "KOSZT" ? (-Math.abs(parseFloat(newEntry.cashAmount))).toFixed(2) : parseFloat(newEntry.cashAmount).toFixed(2)) : null,
      cardAmount: newEntry.cardAmount ? (newEntry.entryKind === "KOSZT" ? (-Math.abs(parseFloat(newEntry.cardAmount))).toFixed(2) : parseFloat(newEntry.cardAmount).toFixed(2)) : null,
      authCode: newEntry.authCode || null,
      notes: newEntry.notes || null,
      saldo: null,
      entryKind: newEntry.entryKind || null,
      category: newEntry.category || null,
    };
    createMutation.mutate(data);
  };

  return (
    <div className="space-y-4">
      <PageHeader title={personNameProp ? `Saldo - ${personName}` : "Salda"} description={personNameProp ? "Rozliczenie salda osoby." : "Rozliczenia sald osób."} icon={Scale} actions={
        <>
          <div className="flex items-center border border-border rounded-md overflow-visible">
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "wpisy" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setActiveTab("wpisy")}
              data-testid="tab-saldo-wpisy"
            >
              Wpisy
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "kategorie" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setActiveTab("kategorie")}
              data-testid="tab-saldo-kategorie"
            >
              <Tag className="h-3.5 w-3.5 inline mr-1" />Kategorie
            </button>
            <button
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${activeTab === "reguly" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setActiveTab("reguly")}
              data-testid="tab-saldo-reguly"
            >
              Reguły ({rules.length})
            </button>
          </div>
          {activeTab === "wpisy" && (
            <>
              <Button variant="outline" onClick={() => setShowAddDialog(true)} data-testid="button-add-saldo">
                <Plus className="mr-1 h-4 w-4" /> Dodaj wpis
              </Button>
              <Button variant="outline" onClick={() => setShowImportDialog(true)} data-testid="button-import-saldo">
                <Upload className="mr-1 h-4 w-4" /> Import Excel
              </Button>
            </>
          )}
        </>
      } />

      {!personNameProp && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="person-tabs">
          {SALDO_PERSONS.map(p => (
            <SaldoPersonCard
              key={p.key}
              person={p}
              isSelected={selectedPerson === p.name}
              onSelect={() => setSelectedPerson(p.name)}
            />
          ))}
        </div>
      )}

      {activeTab === "wpisy" && (
        <Card>
          <CardContent className="py-2.5 px-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saldo początkowe:</span>
                {editingInitialBalance ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={initialBalanceInput}
                      onChange={e => setInitialBalanceInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") updateInitialBalanceMutation.mutate(initialBalanceInput);
                        if (e.key === "Escape") setEditingInitialBalance(false);
                      }}
                      className="w-32"
                      autoFocus
                      data-testid="input-initial-balance"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => updateInitialBalanceMutation.mutate(initialBalanceInput)}
                      disabled={updateInitialBalanceMutation.isPending}
                      data-testid="button-save-initial-balance"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingInitialBalance(false)}
                      data-testid="button-cancel-initial-balance"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    className="text-sm font-bold tabular-nums hover:underline cursor-pointer"
                    onClick={() => { setInitialBalanceInput(initialBalance.toString()); setEditingInitialBalance(true); }}
                    data-testid="button-edit-initial-balance"
                  >
                    {formatNum(initialBalance.toFixed(2))} zł
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aktualne saldo:</span>
                <span className={`text-sm font-bold tabular-nums ${currentSaldo >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-current-saldo">
                  {formatNum(currentSaldo.toFixed(2))} zł
                </span>
              </div>
              <div className="text-xs text-muted-foreground ml-auto">
                Tylko płatności gotówkowe wpływają na saldo
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "kategorie" && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Nazwa nowej kategorii"
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && newCatName.trim()) createCategoryMutation.mutate({ name: newCatName.trim(), type: newCatType }); }}
                  className="max-w-xs"
                  data-testid="input-new-category"
                />
                <div className="flex items-center border border-border rounded-md overflow-visible">
                  <button
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${newCatType === "PRZYCHOD" ? "bg-green-600 text-white" : "hover:bg-muted"}`}
                    onClick={() => setNewCatType("PRZYCHOD")}
                    data-testid="toggle-cat-type-przychod"
                  >
                    Przychód
                  </button>
                  <button
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${newCatType === "KOSZT" ? "bg-red-600 text-white" : "hover:bg-muted"}`}
                    onClick={() => setNewCatType("KOSZT")}
                    data-testid="toggle-cat-type-koszt"
                  >
                    Koszt
                  </button>
                </div>
                <Button
                  size="sm"
                  onClick={() => { if (newCatName.trim()) createCategoryMutation.mutate({ name: newCatName.trim(), type: newCatType }); }}
                  disabled={!newCatName.trim() || createCategoryMutation.isPending}
                  data-testid="button-add-category"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Dodaj kategorię
                </Button>
              </div>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-muted-foreground">Lista kategorii. Możesz zmienić nazwę lub usunąć kategorie.</p>
                {selectedCats.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Usunąć ${selectedCats.size} wybranych kategorii? Kategorie zostaną usunięte ze wszystkich powiązanych wpisów.`))
                        bulkDeleteCategoryMutation.mutate([...selectedCats]);
                    }}
                    disabled={bulkDeleteCategoryMutation.isPending}
                    data-testid="button-bulk-delete-cats"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Usuń zaznaczone ({selectedCats.size})
                  </Button>
                )}
              </div>
              {[{ label: "Kategorie przychodów", type: "PRZYCHOD" as const, color: "text-green-600" }, { label: "Kategorie kosztów", type: "KOSZT" as const, color: "text-red-600" }].map(section => {
                const sectionCats = categoriesWithType.filter(c => c.type === section.type).map(c => c.name);
                return (
                  <div key={section.type} className="space-y-0">
                    <div className={`flex items-center gap-2 py-2 px-2 bg-muted/30 border-b border-border`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${section.color}`}>{section.label}</span>
                      <span className="text-xs text-muted-foreground">({sectionCats.length})</span>
                    </div>
                    {sectionCats.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3 px-2 border-b border-border">Brak kategorii tego typu.</p>
                    ) : (
                      sectionCats.map(cat => (
                        <div key={cat} className={`flex items-center gap-2 py-1.5 px-2 border-b border-border last:border-b-0 ${selectedCats.has(cat) ? "bg-accent/20" : ""}`}>
                          <input
                            type="checkbox"
                            checked={selectedCats.has(cat)}
                            onChange={e => {
                              const next = new Set(selectedCats);
                              if (e.target.checked) next.add(cat);
                              else next.delete(cat);
                              setSelectedCats(next);
                            }}
                            className="h-4 w-4 rounded border-border"
                            data-testid={`checkbox-cat-${cat}`}
                          />
                          {editingCat === cat ? (
                            <>
                              <Input
                                className="flex-1"
                                value={editingCatName}
                                onChange={e => setEditingCatName(e.target.value)}
                                autoFocus
                                onKeyDown={e => { if (e.key === "Enter" && editingCatName.trim()) renameCategoryMutation.mutate({ oldName: cat, newName: editingCatName.trim() }); }}
                                data-testid={`input-rename-cat-${cat}`}
                              />
                              <Button size="sm" variant="outline" onClick={() => { if (editingCatName.trim()) renameCategoryMutation.mutate({ oldName: cat, newName: editingCatName.trim() }); }} disabled={!editingCatName.trim() || renameCategoryMutation.isPending} data-testid={`button-save-cat-${cat}`}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingCat(null)} data-testid={`button-cancel-cat-${cat}`}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm font-medium" data-testid={`text-cat-${cat}`}>{cat}</span>
                              <Button size="sm" variant="ghost" onClick={() => { setEditingCat(cat); setEditingCatName(cat); }} data-testid={`button-edit-cat-${cat}`}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Usunąć kategorię "${cat}"? Kategoria zostanie usunięta ze wszystkich wpisów.`)) deleteCategoryMutation.mutate(cat); }} data-testid={`button-delete-cat-${cat}`}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "reguly" && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Reguły automatycznie sugerują kategorię i pozycję kosztową na podstawie nazwy operacji. Reguły są zapisywane lokalnie w przeglądarce.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Wzorzec (np. Czynsz, Prąd...)"
                  value={newRulePattern}
                  onChange={e => setNewRulePattern(e.target.value)}
                  className="max-w-[200px]"
                  data-testid="input-new-rule-pattern"
                />
                <Select value={newRuleCategory || "none"} onValueChange={v => setNewRuleCategory(v === "none" ? "" : v)}>
                  <SelectTrigger className="w-[180px]" data-testid="select-new-rule-category">
                    <SelectValue placeholder="Kategoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— brak —</SelectItem>
                    {categories.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <SearchableTargetSelect
                  items={targetOptions}
                  value={newRuleTarget || ""}
                  onValueChange={v => setNewRuleTarget(v === "__clear__" ? "" : v)}
                  placeholder="Pozycja kosztowa..."
                  clearLabel="— brak —"
                  triggerClassName="w-[280px]"
                  data-testid="select-new-rule-target"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (newRulePattern.trim()) {
                      addRule(newRulePattern.trim(), newRuleCategory || undefined, newRuleTarget || undefined);
                      setNewRulePattern("");
                      setNewRuleCategory("");
                      setNewRuleTarget("");
                    }
                  }}
                  disabled={!newRulePattern.trim()}
                  data-testid="button-add-rule"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Dodaj regułę
                </Button>
              </div>
              {rules.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3">Brak reguł. Reguły są tworzone automatycznie po przypisaniu wpisu lub możesz dodać je ręcznie powyżej.</p>
              ) : (
                <div className="border rounded-md divide-y">
                  {rules.map((rule, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded" data-testid={`text-rule-pattern-${idx}`}>{rule.pattern}</span>
                      {rule.category && <Badge variant="outline" className="text-[10px]">{rule.category}</Badge>}
                      {rule.targetKey && (
                        <span className="text-xs text-muted-foreground">
                          → {targetOptions.find(o => o.key === rule.targetKey)?.label || rule.targetKey}
                        </span>
                      )}
                      <button
                        className="ml-auto text-muted-foreground hover:text-destructive"
                        onClick={() => removeRule(idx)}
                        data-testid={`button-remove-rule-${idx}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "wpisy" && <>
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="text-center md:text-left md:min-w-[200px]">
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Aktualne saldo — {personName.split(" ")[0]}</div>
              <div className={`text-3xl font-bold tabular-nums ${summary.lastSaldo >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} data-testid="text-saldo-current">{summary.lastSaldo.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground justify-center md:justify-start flex-wrap">
                <span>{summary.count} wpisów</span>
                <span>Got.: {summary.totalCash.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</span>
                <span>Karta: {summary.totalCard.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</span>
                {summary.pendingCount > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-medium" data-testid="text-pending-count">
                    {summary.pendingCount} oczekuje
                  </span>
                )}
                {summary.assignedCount > 0 && (
                  <span className="text-green-600 dark:text-green-400 font-medium" data-testid="text-assigned-count">
                    {summary.assignedCount} przypisanych
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAiCategorize}
                  disabled={aiCategorizing || summary.pendingCount === 0}
                  data-testid="button-ai-categorize"
                >
                  {aiCategorizing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
                  Kategoryzuj AI
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleApplyRulesToAll}
                  disabled={summary.pendingCount === 0}
                  data-testid="button-apply-rules"
                >
                  <ListFilter className="h-3.5 w-3.5 mr-1" />
                  Zastosuj reguły
                </Button>
              </div>
            </div>
            <div className="flex-1 w-full min-w-0" data-testid="chart-saldo-trend">
              <div className="text-xs text-muted-foreground mb-1">Trend salda (ostatnie 30 dni z wpisami)</div>
              <SaldoSparkline entries={entries} initialBalance={initialBalance} height={100} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Szukaj po nazwie, gościu, nr rezerwacji..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
              data-testid="input-saldo-search"
            />
          </div>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtry
            {hasActiveFilters && <span className="ml-1 h-2 w-2 rounded-full bg-primary inline-block" />}
            {showFilters ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} data-testid="button-clear-saldo-filters">
              <X className="h-3.5 w-3.5 mr-1" /> Wyczyść
            </Button>
          )}
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-3 pt-3 border-t">
            <div className="space-y-1">
              <Label className="text-xs">Data od</Label>
              <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(0); }} data-testid="input-saldo-date-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Data do</Label>
              <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(0); }} data-testid="input-saldo-date-to" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Typ wpisu</Label>
              <Select value={entryKindFilter} onValueChange={(v: any) => { setEntryKindFilter(v); setPage(0); }}>
                <SelectTrigger data-testid="select-saldo-entry-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Wszystkie</SelectItem>
                  <SelectItem value="PRZYCHOD">Przychody</SelectItem>
                  <SelectItem value="KOSZT">Koszty</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Kategoria</Label>
              <Select value={categoryFilter} onValueChange={v => { setCategoryFilter(v); setPage(0); }}>
                <SelectTrigger data-testid="select-saldo-category-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {usedCategories.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Płatność</Label>
              <Select value={paymentFilter} onValueChange={v => { setPaymentFilter(v); setPage(0); }}>
                <SelectTrigger data-testid="select-saldo-payment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {paymentMethods.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rodzaj</Label>
              <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(0); }}>
                <SelectTrigger data-testid="select-saldo-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  {types.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status kosztu</Label>
              <Select value={costStatusFilter} onValueChange={(v: any) => { setCostStatusFilter(v); setPage(0); }}>
                <SelectTrigger data-testid="select-saldo-cost-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="pending">Oczekujące</SelectItem>
                  <SelectItem value="assigned">Przypisane</SelectItem>
                  <SelectItem value="skipped">Pominięte</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </Card>

      {selectedEntryIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg sticky top-0 z-20" data-testid="bulk-action-bar">
          <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
            Zaznaczono {selectedEntryIds.size} • Suma: {formatPLN(selectedSum)}
          </span>
          <button
            onClick={() => { setSelectedEntryIds(new Set()); setBulkWizardSelection(null); }}
            className="p-0.5 rounded hover:bg-blue-200 dark:hover:bg-blue-800 text-blue-600 dark:text-blue-400"
            data-testid="button-clear-selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="h-4 w-px bg-blue-200 dark:bg-blue-700 mx-1" />
          <CostTargetWizard
            targets={targets}
            onSelect={(sel) => setBulkWizardSelection(sel)}
            value={bulkWizardSelection?.label || ""}
            onClear={bulkWizardSelection ? () => setBulkWizardSelection(null) : undefined}
            placeholder="Pozycja kosztowa..."
            triggerClassName="w-[260px] text-xs h-7"
            txMonth={new Date().getMonth()}
            data-testid="bulk-select-target"
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!bulkWizardSelection || bulkAssignMutation.isPending}
            onClick={() => bulkAssignMutation.mutate()}
            data-testid="button-bulk-assign"
          >
            {bulkAssignMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Przypisz {selectedEntryIds.size}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            disabled={bulkSkipMutation.isPending}
            onClick={() => {
              if (window.confirm(`Czy na pewno chcesz pominąć ${selectedEntryIds.size} wpisów?`)) {
                bulkSkipMutation.mutate();
              }
            }}
            data-testid="button-bulk-skip"
          >
            {bulkSkipMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            Pomiń {selectedEntryIds.size}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Ładowanie danych...</div>
      ) : (
        <>
        {hasActiveFilters && (
          <div className="text-sm text-muted-foreground" data-testid="text-filter-count">
            Wyświetlono {filtered.length} z {entries.length} wpisów
          </div>
        )}
        <div className="rounded-md border border-border bg-card overflow-x-auto table-scroll-container" onScroll={(e) => { const el = e.currentTarget; const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 10; if (atEnd) el.classList.add('scrolled-end'); else el.classList.remove('scrolled-end'); }}>
          <table className="w-full text-[10px] sm:text-xs border-collapse" style={{ minWidth: "1300px" }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted/80 dark:bg-muted/50">
                <th className="border-b border-border border-r px-1 py-2 w-[28px] text-center sticky left-0 z-30 bg-muted/80 dark:bg-muted/50" data-testid="header-saldo-checkbox">
                  {pendingEntries.length > 0 && (
                    <Checkbox
                      checked={selectedEntryIds.size === pendingEntries.length && pendingEntries.length > 0}
                      onCheckedChange={handleToggleSelectAll}
                      className="h-[11px] w-[11px]"
                      data-testid="checkbox-select-all"
                    />
                  )}
                </th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none sticky left-[28px] z-30 bg-muted/80 dark:bg-muted/50 w-[90px] text-left cursor-pointer hover:bg-muted/90" onClick={() => toggleSort("date")} data-testid="header-saldo-date">
                  <div className="flex items-center">Data<SortIcon field="date" /></div>
                </th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[200px] text-left cursor-pointer hover:bg-muted/90" onClick={() => toggleSort("operationName")} data-testid="header-saldo-operationName">
                  <div className="flex items-center">Nazwa operacji<SortIcon field="operationName" /></div>
                </th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[80px] text-left" data-testid="header-saldo-reservationNumber">Nr rez.</th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[180px] text-left" data-testid="header-saldo-guestName">Imię i nazwisko</th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[130px] text-left cursor-pointer hover:bg-muted/90" onClick={() => toggleSort("category")} data-testid="header-saldo-type">
                  <div className="flex items-center">Kategoria<SortIcon field="category" /></div>
                </th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[90px] text-left" data-testid="header-saldo-paymentMethod">Płatność</th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[50px] text-center" data-testid="header-saldo-kasaFiskalna">KF</th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[50px] text-center" data-testid="header-saldo-faktura">FV</th>
                <th className="border-b border-border border-r-2 px-2 py-2 font-bold select-none w-[100px] text-right cursor-pointer hover:bg-muted/90" onClick={() => toggleSort("cashAmount")} data-testid="header-saldo-cashAmount">
                  <div className="flex items-center justify-end">Suma (got.)<SortIcon field="cashAmount" /></div>
                </th>
                <th className="border-b border-border border-r-2 px-2 py-2 font-bold select-none w-[100px] text-right" data-testid="header-saldo-saldo">Saldo</th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[80px] text-left" data-testid="header-saldo-authCode">Kod aut.</th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[100px] text-right cursor-pointer hover:bg-muted/90" onClick={() => toggleSort("cardAmount")} data-testid="header-saldo-cardAmount">
                  <div className="flex items-center justify-end">Kwota kartą<SortIcon field="cardAmount" /></div>
                </th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none text-left" data-testid="header-saldo-notes">Uwagi</th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[100px] text-left" data-testid="header-saldo-createdBy">Wprowadził</th>
                <th className="border-b border-border border-r px-2 py-2 font-bold select-none w-[80px] text-center" data-testid="header-saldo-cost-status">Koszty</th>
                <th className="border-b border-border px-2 py-2 text-center font-bold w-[65px]"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((entry, idx) => {
                const cashVal = entry.cashAmount ? parseFloat(entry.cashAmount) : null;
                const isCostAssigned = !!entry.costImported;
                const isCostSkipped = !!entry.costSkipped;
                const isCostPending = !isCostAssigned && !isCostSkipped;
                const isExpanded = expandedEntryId === entry.id;
                const rowBg = isCostAssigned
                  ? "bg-green-50/60 dark:bg-green-950/20"
                  : isCostSkipped
                    ? "opacity-50"
                    : entry.operationName === "SALDO POCZĄTKOWE"
                      ? "bg-blue-50 dark:bg-blue-950/30 font-semibold"
                      : entry.entryKind === "KOSZT" || (cashVal !== null && cashVal < 0)
                        ? "bg-red-50 dark:bg-red-950/20"
                        : idx % 2 === 0 ? "" : "bg-muted/20 dark:bg-muted/10";
                return (
                  <React.Fragment key={entry.id}>
                  <tr
                    className={`group hover:bg-accent/30 cursor-pointer ${rowBg} ${selectedEntryIds.has(entry.id) ? "!bg-blue-50/80 dark:!bg-blue-950/30" : ""}`}
                    onClick={() => { if (isCostPending) { setExpandedEntryId(isExpanded ? null : entry.id); } else { setPreviewEntry(entry); } }}
                    data-testid={`row-saldo-${entry.id}`}
                  >
                    <td className="sticky left-0 z-[5] bg-inherit border-b border-r border-border px-1 py-1.5 text-center w-[28px]" onClick={(e) => e.stopPropagation()}>
                      {isCostPending && entry.entryKind === "KOSZT" && (
                        <Checkbox
                          checked={selectedEntryIds.has(entry.id)}
                          onCheckedChange={() => handleToggleSelect(entry.id)}
                          className="h-[11px] w-[11px]"
                          data-testid={`checkbox-entry-${entry.id}`}
                        />
                      )}
                    </td>
                    <td className="sticky left-[28px] z-[5] bg-inherit border-b border-r border-border px-2 py-1.5 tabular-nums" data-testid={`cell-date-${entry.id}`}>{formatDate(entry.date)}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 truncate font-semibold" data-testid={`cell-op-${entry.id}`}>{entry.operationName}</td>
                    <td className="border-b border-r border-border px-2 py-1.5" data-testid={`cell-resnum-${entry.id}`}>{entry.reservationNumber || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 truncate" data-testid={`cell-guest-${entry.id}`}>{entry.guestName || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 truncate" data-testid={`cell-type-${entry.id}`}>{entry.category || entry.type || ""}{entry.aiCategory && !entry.category ? <span className="text-purple-500 text-[9px] ml-1" title="Sugestia AI">AI: {entry.aiCategory}</span> : null}</td>
                    <td className="border-b border-r border-border px-2 py-1.5" data-testid={`cell-payment-${entry.id}`}>{entry.paymentMethod || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-center" data-testid={`cell-kf-${entry.id}`}>{entry.kasaFiskalna || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-center" data-testid={`cell-fv-${entry.id}`}>{entry.faktura || ""}</td>
                    <td className={`border-b border-r-2 border-border px-2 py-1.5 text-right tabular-nums font-semibold ${cashVal !== null && cashVal < 0 ? "text-red-600 dark:text-red-400" : cashVal !== null && cashVal > 0 ? "text-green-600 dark:text-green-400" : ""}`} data-testid={`cell-cash-${entry.id}`}>{formatNum(entry.cashAmount)}</td>
                    <td className="border-b border-r-2 border-border px-2 py-1.5 text-right tabular-nums font-bold" data-testid={`cell-saldo-${entry.id}`}>{formatNum((runningSaldoMap.get(entry.id) ?? 0).toFixed(2))}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 tabular-nums" data-testid={`cell-auth-${entry.id}`}>{entry.authCode || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-right tabular-nums" data-testid={`cell-card-${entry.id}`}>{formatNum(entry.cardAmount)}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-muted-foreground truncate" data-testid={`cell-notes-${entry.id}`}>{entry.notes || ""}</td>
                    <td className="border-b border-r border-border px-2 py-1.5 text-muted-foreground text-[10px]" data-testid={`cell-createdby-${entry.id}`}>{entry.createdBy || "-"}</td>
                    <td className="border-b border-r border-border px-1 py-1.5" data-testid={`cell-cost-status-${entry.id}`}>
                      {isCostAssigned ? (
                        <div className="flex items-center gap-0.5">
                          <Badge variant="outline" className="text-[9px] border-green-500 text-green-600 dark:text-green-400 gap-0.5 px-1 py-0 cursor-default max-w-[140px]" title={(() => {
                            if (entry.costTargetType === "operational") {
                              const cat = targets?.operational?.find(c => c.items.some(i => i.catId === entry.costTargetCatId && i.itemIdx === entry.costTargetItemIdx));
                              const item = cat?.items.find(i => i.catId === entry.costTargetCatId && i.itemIdx === entry.costTargetItemIdx);
                              return cat && item ? `${cat.title} → ${item.name}` : `Opłaty: ${entry.costTargetCatId}`;
                            }
                            if (entry.costTargetType === "apartment") {
                              const apt = targets?.apartment?.find(a => a.entryId === entry.costTargetEntryId);
                              return `${apt?.name || entry.costTargetEntryId} → ${entry.costTargetCategory}`;
                            }
                            if (entry.costTargetType === "sublease") return `Podnajem #${entry.costTargetSubleasePaymentId}`;
                            return "Przypisane";
                          })()}>
                            <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">
                              {(() => {
                                if (entry.costTargetType === "operational") {
                                  const cat = targets?.operational?.find(c => c.items.some(i => i.catId === entry.costTargetCatId && i.itemIdx === entry.costTargetItemIdx));
                                  const item = cat?.items.find(i => i.catId === entry.costTargetCatId && i.itemIdx === entry.costTargetItemIdx);
                                  return item?.name || entry.costTargetCatId || "Operacyjne";
                                }
                                if (entry.costTargetType === "apartment") {
                                  const apt = targets?.apartment?.find(a => a.entryId === entry.costTargetEntryId);
                                  return apt?.name || entry.costTargetEntryId || "Apartament";
                                }
                                if (entry.costTargetType === "sublease") return "Podnajem";
                                return "✓";
                              })()}
                            </span>
                          </Badge>
                          <button
                            onClick={(e) => { e.stopPropagation(); if (window.confirm("Czy na pewno chcesz cofnąć przypisanie kosztów?")) handleUnassignCost(entry.id); }}
                            className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            title="Cofnij przypisanie"
                            data-testid={`button-unassign-${entry.id}`}
                          >
                            <Undo2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : isCostSkipped ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUnskip(entry.id); }}
                          title="Pominięte — kliknij aby przywrócić"
                          data-testid={`button-unskip-${entry.id}`}
                        >
                          <Badge variant="outline" className="text-[9px] border-muted-foreground/30 text-muted-foreground gap-0.5 px-1 py-0 cursor-pointer hover:border-primary">
                            <Ban className="h-2.5 w-2.5" />
                          </Badge>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setExpandedEntryId(isExpanded ? null : entry.id); }}
                          title="Oczekuje — kliknij aby przypisać"
                          data-testid={`button-expand-cost-${entry.id}`}
                        >
                          <Badge variant="outline" className="text-[9px] border-amber-500 text-amber-600 dark:text-amber-400 gap-0.5 px-1 py-0 cursor-pointer hover:border-primary">
                            <Minus className="h-2.5 w-2.5" />
                          </Badge>
                        </button>
                      )}
                    </td>
                    <td className="border-b border-border px-1 py-1.5 text-center">
                      <div className="flex items-center gap-0.5 justify-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewEntry(entry); }}
                          className="invisible group-hover:visible text-muted-foreground hover:text-foreground p-0.5"
                          data-testid={`button-preview-saldo-${entry.id}`}
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                          className="invisible group-hover:visible text-muted-foreground hover:text-foreground p-0.5"
                          data-testid={`button-edit-saldo-${entry.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm("Usunąć ten wpis?")) {
                              deleteMutation.mutate(entry.id);
                            }
                          }}
                          className="invisible group-hover:visible text-muted-foreground hover:text-destructive p-0.5"
                          data-testid={`button-delete-saldo-${entry.id}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && isCostPending && (
                    <tr className="bg-muted/20 border-b border-border/30">
                      <td colSpan={17} className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Select value={selectedCategories[entry.id] || ""} onValueChange={v => setSelectedCategories(prev => ({ ...prev, [entry.id]: v }))}>
                            <SelectTrigger className="h-7 text-xs w-[180px]" data-testid={`select-category-${entry.id}`}>
                              <SelectValue placeholder="Kategoria saldo..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none" className="text-xs">— brak —</SelectItem>
                              {categories.map(c => (
                                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <CostTargetWizard
                            targets={targets}
                            onSelect={(sel) => setSelectedTargets(prev => ({ ...prev, [entry.id]: sel }))}
                            value={selectedTargets[entry.id]?.label || ""}
                            onClear={selectedTargets[entry.id] ? () => setSelectedTargets(prev => { const n = { ...prev }; delete n[entry.id]; return n; }) : undefined}
                            placeholder="Pozycja kosztowa..."
                            triggerClassName="h-7 text-xs w-[300px]"
                            txMonth={new Date(entry.date).getMonth()}
                            data-testid={`select-target-${entry.id}`}
                          />
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            disabled={!selectedTargets[entry.id]}
                            onClick={(e) => { e.stopPropagation(); handleAssignCost(entry.id); }}
                            data-testid={`button-assign-${entry.id}`}
                          >
                            Przypisz
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={(e) => { e.stopPropagation(); handleSkip(entry.id); }}
                            data-testid={`button-skip-${entry.id}`}
                          >
                            Pomiń
                          </Button>
                          {(entry.aiCategory || applyRulesToEntry(entry)) && (
                            <span className="text-[10px] text-purple-500 ml-2">
                              <Sparkles className="h-3 w-3 inline mr-0.5" />
                              {entry.aiCategory ? `AI: ${entry.aiCategory}` : ""}
                              {applyRulesToEntry(entry) ? ` Reguła: "${applyRulesToEntry(entry)!.pattern}"` : ""}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-muted-foreground">
            Strona {page + 1} z {totalPages} ({filtered.length} wpisów)
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(0)} data-testid="button-saldo-first-page">
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(p => p - 1)} data-testid="button-saldo-prev-page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1 mx-1">
              <Input
                type="number"
                min={1}
                max={totalPages}
                value={page + 1}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 1 && val <= totalPages) setPage(val - 1);
                }}
                className="w-16 text-center"
                data-testid="input-saldo-go-to-page"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">z {totalPages}</span>
            </div>
            <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} data-testid="button-saldo-next-page">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)} data-testid="button-saldo-last-page">
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      </>}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dodaj wpis do salda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Label className="shrink-0">Typ wpisu:</Label>
              <div className="flex items-center border border-border rounded-md overflow-visible">
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${newEntry.entryKind === "PRZYCHOD" ? "bg-green-600 text-white" : "hover:bg-muted"}`}
                  onClick={() => setNewEntry(p => ({ ...p, entryKind: "PRZYCHOD" }))}
                  data-testid="toggle-new-przychod"
                >
                  Przychód
                </button>
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${newEntry.entryKind === "KOSZT" ? "bg-red-600 text-white" : "hover:bg-muted"}`}
                  onClick={() => setNewEntry(p => ({ ...p, entryKind: "KOSZT" }))}
                  data-testid="toggle-new-koszt"
                >
                  Koszt
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={newEntry.date} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} data-testid="input-new-saldo-date" />
              </div>
              <div className="space-y-1">
                <Label>Nazwa operacji</Label>
                <Input value={newEntry.operationName} onChange={e => setNewEntry(p => ({ ...p, operationName: e.target.value }))} placeholder={newEntry.entryKind === "PRZYCHOD" ? "np. GRAND BALTIC 203" : "np. Zakup środków czystości"} data-testid="input-new-saldo-op" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>{newEntry.entryKind === "KOSZT" ? "Kategoria kosztu" : "Kategoria przychodu"}</Label>
                <Select value={newEntry.category || "none"} onValueChange={v => setNewEntry(p => ({ ...p, category: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-new-saldo-category">
                    <SelectValue placeholder="Wybierz kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— brak —</SelectItem>
                    {(newEntry.entryKind === "KOSZT" ? costCategories : incomeCategories).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Nr rezerwacji</Label>
                <Input value={newEntry.reservationNumber} onChange={e => {
                  const val = e.target.value;
                  setNewEntry(p => ({ ...p, reservationNumber: val }));
                  if (val.trim().length >= 2) {
                    fetch(`/api/reservations/by-number/${encodeURIComponent(val.trim())}`, { credentials: "include" })
                      .then(r => r.ok ? r.json() : null)
                      .then(data => {
                        if (data) {
                          setNewEntry(p => ({
                            ...p,
                            guestName: data.guestName || p.guestName,
                            operationName: data.apartmentNames?.length ? (p.operationName || data.apartmentNames.join(", ")) : p.operationName,
                          }));
                        }
                      }).catch(() => {});
                  }
                }} data-testid="input-new-saldo-resnum" />
              </div>
              <div className="space-y-1">
                <Label>Imię i nazwisko</Label>
                <Input value={newEntry.guestName} onChange={e => setNewEntry(p => ({ ...p, guestName: e.target.value }))} data-testid="input-new-saldo-guest" />
              </div>
              <div className="space-y-1">
                <Label>Sposób płatności</Label>
                <Select value={newEntry.paymentMethod || "none"} onValueChange={v => setNewEntry(p => ({ ...p, paymentMethod: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-new-saldo-payment">
                    <SelectValue placeholder="Wybierz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    <SelectItem value="GOTÓWKA">GOTÓWKA</SelectItem>
                    <SelectItem value="KARTA">KARTA</SelectItem>
                    <SelectItem value="BLIK">BLIK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Suma (gotówka)</Label>
                <Input type="number" step="0.01" value={newEntry.cashAmount} onChange={e => setNewEntry(p => ({ ...p, cashAmount: e.target.value }))} placeholder="0.00" data-testid="input-new-saldo-cash" />
              </div>
              <div className="space-y-1">
                <Label>Kwota kartą</Label>
                <Input type="number" step="0.01" value={newEntry.cardAmount} onChange={e => setNewEntry(p => ({ ...p, cardAmount: e.target.value }))} placeholder="0.00" data-testid="input-new-saldo-card" />
              </div>
              <div className="space-y-1">
                <Label>Kod autoryzacji</Label>
                <Input value={newEntry.authCode} onChange={e => setNewEntry(p => ({ ...p, authCode: e.target.value }))} data-testid="input-new-saldo-auth" />
              </div>
              <div className="space-y-1">
                <Label>Uwagi</Label>
                <Input value={newEntry.notes} onChange={e => setNewEntry(p => ({ ...p, notes: e.target.value }))} data-testid="input-new-saldo-notes" />
              </div>
              <div className="space-y-1">
                <Label>Kasa fiskalna</Label>
                <Select value={newEntry.kasaFiskalna} onValueChange={v => setNewEntry(p => ({ ...p, kasaFiskalna: v }))}>
                  <SelectTrigger data-testid="select-new-saldo-kf">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAK">TAK</SelectItem>
                    <SelectItem value="NIE">NIE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Faktura</Label>
                <Select value={newEntry.faktura} onValueChange={v => setNewEntry(p => ({ ...p, faktura: v }))}>
                  <SelectTrigger data-testid="select-new-saldo-fv">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAK">TAK</SelectItem>
                    <SelectItem value="NIE">NIE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddEntry} disabled={!newEntry.operationName.trim() || !newEntry.date || createMutation.isPending} data-testid="button-confirm-add-saldo">
              Dodaj wpis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={(open) => { setShowImportDialog(open); if (!open) { setImportDuplicates([]); setImportChecking(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import salda z Excela</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Wybierz plik Excel (.xlsx) z arkuszem "Saldo". Istniejące dane zostaną zastąpione.
            </p>
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={() => { setImportDuplicates([]); }}
              data-testid="input-saldo-file"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckDuplicatesBeforeImport}
              disabled={importChecking}
              data-testid="button-check-duplicates"
            >
              {importChecking ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Search className="h-3.5 w-3.5 mr-1" />}
              Sprawdź duplikaty
            </Button>
            {importDuplicates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400" data-testid="text-duplicates-found">
                  Znaleziono {importDuplicates.length} potencjalnych duplikatów:
                </p>
                <div className="max-h-32 overflow-y-auto border rounded-md divide-y text-xs">
                  {importDuplicates.map((d, i) => (
                    <div key={i} className="px-2 py-1 bg-amber-50 dark:bg-amber-950/20">
                      {formatDate(d.date)} — {d.operationName}
                    </div>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDuplicatesOnImport}
                    onChange={e => setSkipDuplicatesOnImport(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                    data-testid="checkbox-skip-duplicates"
                  />
                  Pomiń duplikaty przy imporcie
                </label>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setShowImportDialog(false); setImportDuplicates([]); }} data-testid="button-cancel-saldo-import">
              Anuluj
            </Button>
            <Button onClick={handleImport} disabled={importing} data-testid="button-confirm-saldo-import">
              {importing ? "Importowanie..." : "Importuj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewEntry} onOpenChange={(open) => { if (!open) setPreviewEntry(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-saldo-preview">
          <DialogHeader>
            <DialogTitle>Podgląd wpisu</DialogTitle>
          </DialogHeader>
          {previewEntry && (() => {
            const cashVal = previewEntry.cashAmount ? parseFloat(previewEntry.cashAmount) : null;
            const cardVal = previewEntry.cardAmount ? parseFloat(previewEntry.cardAmount) : null;
            const saldoVal = previewEntry.saldo ? parseFloat(previewEntry.saldo) : null;
            const fields: { label: string; value: string; highlight?: string }[] = [
              { label: "Typ wpisu", value: previewEntry.entryKind === "KOSZT" ? "Koszt" : "Przychód", highlight: previewEntry.entryKind === "KOSZT" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400" },
              ...(previewEntry.entryKind === "KOSZT" && previewEntry.category ? [{ label: "Kategoria", value: previewEntry.category }] : []),
              { label: "Data", value: formatDate(previewEntry.date) },
              { label: "Nazwa operacji", value: previewEntry.operationName || "" },
              { label: "Nr rezerwacji", value: previewEntry.reservationNumber || "" },
              { label: "Imię i nazwisko", value: previewEntry.guestName || "" },
              { label: "Kategoria", value: previewEntry.type || "" },
              { label: "Sposób płatności", value: previewEntry.paymentMethod || "" },
              { label: "Kasa fiskalna", value: previewEntry.kasaFiskalna || "" },
              { label: "Faktura", value: previewEntry.faktura || "" },
              {
                label: "Suma (gotówka)",
                value: formatNum(previewEntry.cashAmount) ? `${formatNum(previewEntry.cashAmount)} zł` : "",
                highlight: cashVal !== null ? (cashVal < 0 ? "text-red-600 dark:text-red-400" : cashVal > 0 ? "text-green-600 dark:text-green-400" : "") : "",
              },
              {
                label: "Saldo",
                value: formatNum(previewEntry.saldo) ? `${formatNum(previewEntry.saldo)} zł` : "",
                highlight: saldoVal !== null ? (saldoVal < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400") : "",
              },
              { label: "Kod autoryzacji", value: previewEntry.authCode || "" },
              {
                label: "Kwota kartą",
                value: formatNum(previewEntry.cardAmount) ? `${formatNum(previewEntry.cardAmount)} zł` : "",
                highlight: cardVal !== null && cardVal > 0 ? "text-blue-600 dark:text-blue-400" : "",
              },
              { label: "Uwagi", value: previewEntry.notes || "" },
              { label: "Wprowadził", value: previewEntry.createdBy || "" },
            ];
            return (
              <div className="space-y-1 py-2" data-testid="preview-saldo-content">
                {fields.map(({ label, value, highlight }) => (
                  <div key={label} className="flex items-start gap-3 py-1.5 border-b border-border last:border-b-0">
                    <span className="text-xs text-muted-foreground w-[130px] shrink-0 pt-0.5">{label}</span>
                    <span className={`text-sm font-medium break-words ${highlight || ""}`} data-testid={`preview-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                      {value || <span className="text-muted-foreground/50">—</span>}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewEntry(null)} data-testid="button-close-saldo-preview">
              Zamknij
            </Button>
            <Button onClick={() => { if (previewEntry) { openEdit(previewEntry); setPreviewEntry(null); } }} data-testid="button-edit-from-preview">
              <Pencil className="mr-1 h-4 w-4" /> Edytuj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editEntry} onOpenChange={(open) => { if (!open) setEditEntry(null); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-saldo-edit">
          <DialogHeader>
            <DialogTitle>Edytuj wpis</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Label className="shrink-0">Typ wpisu:</Label>
              <div className="flex items-center border border-border rounded-md overflow-visible">
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${editForm.entryKind === "PRZYCHOD" ? "bg-green-600 text-white" : "hover:bg-muted"}`}
                  onClick={() => setEditForm(p => ({ ...p, entryKind: "PRZYCHOD" }))}
                  data-testid="toggle-edit-przychod"
                >
                  Przychód
                </button>
                <button
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${editForm.entryKind === "KOSZT" ? "bg-red-600 text-white" : "hover:bg-muted"}`}
                  onClick={() => setEditForm(p => ({ ...p, entryKind: "KOSZT" }))}
                  data-testid="toggle-edit-koszt"
                >
                  Koszt
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data</Label>
                <Input type="date" value={editForm.date} onChange={e => setEditForm(p => ({ ...p, date: e.target.value }))} data-testid="input-edit-saldo-date" />
              </div>
              <div className="space-y-1">
                <Label>Nazwa operacji</Label>
                <Input value={editForm.operationName} onChange={e => setEditForm(p => ({ ...p, operationName: e.target.value }))} data-testid="input-edit-saldo-op" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>{editForm.entryKind === "KOSZT" ? "Kategoria kosztu" : "Kategoria przychodu"}</Label>
                <Select value={editForm.category || "none"} onValueChange={v => setEditForm(p => ({ ...p, category: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-edit-saldo-category">
                    <SelectValue placeholder="Wybierz kategorię" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— brak —</SelectItem>
                    {(editForm.entryKind === "KOSZT" ? costCategories : incomeCategories).map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Nr rezerwacji</Label>
                <Input value={editForm.reservationNumber} onChange={e => {
                  const val = e.target.value;
                  setEditForm(p => ({ ...p, reservationNumber: val }));
                  if (val.trim().length >= 2) {
                    fetch(`/api/reservations/by-number/${encodeURIComponent(val.trim())}`, { credentials: "include" })
                      .then(r => r.ok ? r.json() : null)
                      .then(data => {
                        if (data) {
                          setEditForm(p => ({
                            ...p,
                            guestName: data.guestName || p.guestName,
                            operationName: (Array.isArray(data.apartmentNames) && data.apartmentNames.length > 0)
                              ? (p.operationName || data.apartmentNames.join(", "))
                              : p.operationName,
                          }));
                        }
                      }).catch(() => {});
                  }
                }} data-testid="input-edit-saldo-resnum" />
              </div>
              <div className="space-y-1">
                <Label>Imię i nazwisko</Label>
                <Input value={editForm.guestName} onChange={e => setEditForm(p => ({ ...p, guestName: e.target.value }))} data-testid="input-edit-saldo-guest" />
              </div>
              <div className="space-y-1">
                <Label>Sposób płatności</Label>
                <Select value={editForm.paymentMethod || "none"} onValueChange={v => setEditForm(p => ({ ...p, paymentMethod: v === "none" ? "" : v }))}>
                  <SelectTrigger data-testid="select-edit-saldo-payment">
                    <SelectValue placeholder="Wybierz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    <SelectItem value="GOTÓWKA">GOTÓWKA</SelectItem>
                    <SelectItem value="KARTA">KARTA</SelectItem>
                    <SelectItem value="BLIK">BLIK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Suma (gotówka)</Label>
                <Input type="number" step="0.01" value={editForm.cashAmount} onChange={e => setEditForm(p => ({ ...p, cashAmount: e.target.value }))} data-testid="input-edit-saldo-cash" />
              </div>
              <div className="space-y-1">
                <Label>Saldo</Label>
                <Input type="number" step="0.01" value={editForm.saldo} onChange={e => setEditForm(p => ({ ...p, saldo: e.target.value }))} data-testid="input-edit-saldo-saldo" />
              </div>
              <div className="space-y-1">
                <Label>Kwota kartą</Label>
                <Input type="number" step="0.01" value={editForm.cardAmount} onChange={e => setEditForm(p => ({ ...p, cardAmount: e.target.value }))} data-testid="input-edit-saldo-card" />
              </div>
              <div className="space-y-1">
                <Label>Kod autoryzacji</Label>
                <Input value={editForm.authCode} onChange={e => setEditForm(p => ({ ...p, authCode: e.target.value }))} data-testid="input-edit-saldo-auth" />
              </div>
              <div className="space-y-1">
                <Label>Kasa fiskalna</Label>
                <Select value={editForm.kasaFiskalna} onValueChange={v => setEditForm(p => ({ ...p, kasaFiskalna: v }))}>
                  <SelectTrigger data-testid="select-edit-saldo-kf">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAK">TAK</SelectItem>
                    <SelectItem value="NIE">NIE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Faktura</Label>
                <Select value={editForm.faktura} onValueChange={v => setEditForm(p => ({ ...p, faktura: v }))}>
                  <SelectTrigger data-testid="select-edit-saldo-fv">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TAK">TAK</SelectItem>
                    <SelectItem value="NIE">NIE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Uwagi</Label>
                <Input value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} data-testid="input-edit-saldo-notes" />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditEntry(null)} data-testid="button-cancel-edit-saldo">
              Anuluj
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editForm.operationName.trim() || !editForm.date || updateMutation.isPending} data-testid="button-save-edit-saldo">
              {updateMutation.isPending ? "Zapisywanie..." : "Zapisz zmiany"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
