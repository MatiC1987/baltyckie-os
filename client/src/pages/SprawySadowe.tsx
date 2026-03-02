import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { format, differenceInDays, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Scale, Plus, Search, Filter, Pencil, Trash2, Eye, Calendar,
  FileText, AlertTriangle, Clock, ChevronDown, ChevronUp,
  Gavel, Users, Building2, DollarSign, Upload, Download,
  MessageSquare, CheckCircle, XCircle, ArrowUpDown, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import type { LegalCase, LegalCaseEvent } from "@shared/schema";

const CASE_TYPES = [
  { value: "cywilna", label: "Cywilna" },
  { value: "karna", label: "Karna" },
  { value: "administracyjna", label: "Administracyjna" },
  { value: "egzekucyjna", label: "Egzekucyjna" },
  { value: "windykacyjna", label: "Windykacyjna" },
];

const STATUSES = [
  { value: "NOWA", label: "Nowa", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { value: "W_TOKU", label: "W toku", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { value: "ZAWIESZONA", label: "Zawieszona", color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  { value: "ZAKONCZONA", label: "Zakończona", color: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  { value: "WYGRANA", label: "Wygrana", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  { value: "PRZEGRANA", label: "Przegrana", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  { value: "UGODA", label: "Ugoda", color: "bg-violet-500/20 text-violet-400 border-violet-500/30" },
];

const PRIORITIES = [
  { value: "NISKI", label: "Niski", color: "bg-slate-500/20 text-slate-400" },
  { value: "NORMALNY", label: "Normalny", color: "bg-blue-500/20 text-blue-400" },
  { value: "WYSOKI", label: "Wysoki", color: "bg-orange-500/20 text-orange-400" },
  { value: "KRYTYCZNY", label: "Krytyczny", color: "bg-red-500/20 text-red-400" },
];

const ROLES = [
  { value: "powód", label: "Powód" },
  { value: "pozwany", label: "Pozwany" },
  { value: "wierzyciel", label: "Wierzyciel" },
  { value: "dłużnik", label: "Dłużnik" },
  { value: "interwenient", label: "Interwenient" },
];

const EVENT_TYPES = [
  { value: "ROZPRAWA", label: "Rozprawa", icon: Gavel, color: "text-red-400" },
  { value: "PISMO", label: "Pismo", icon: FileText, color: "text-blue-400" },
  { value: "TERMIN", label: "Termin", icon: Calendar, color: "text-orange-400" },
  { value: "DECYZJA", label: "Decyzja", icon: CheckCircle, color: "text-emerald-400" },
  { value: "PLATNOSC", label: "Płatność", icon: DollarSign, color: "text-yellow-400" },
  { value: "SPOTKANIE", label: "Spotkanie", icon: Users, color: "text-violet-400" },
  { value: "INNE", label: "Inne", icon: MessageSquare, color: "text-slate-400" },
];

function getStatusBadge(status: string) {
  const s = STATUSES.find(st => st.value === status);
  return s ? <Badge variant="outline" className={s.color} data-testid={`badge-status-${status}`}>{s.label}</Badge> : <Badge variant="outline">{status}</Badge>;
}

function getPriorityBadge(priority: string) {
  const p = PRIORITIES.find(pr => pr.value === priority);
  return p ? <Badge variant="outline" className={p.color} data-testid={`badge-priority-${priority}`}>{p.label}</Badge> : null;
}

function formatPLN(amount: string | number | null | undefined): string {
  if (!amount) return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(n);
}

function isUpcoming(dateStr: string | null | undefined, days: number): boolean {
  if (!dateStr) return false;
  const diff = differenceInDays(parseISO(dateStr), new Date());
  return diff >= 0 && diff <= days;
}

function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  return differenceInDays(parseISO(dateStr), new Date()) < 0;
}

type SortField = "caseNumber" | "title" | "status" | "priority" | "nextHearingDate" | "deadlineDate" | "claimAmount";

const emptyForm = {
  caseNumber: "", title: "", description: "", caseType: "", status: "NOWA",
  priority: "NORMALNY", role: "", courtName: "", judge: "",
  opposingParty: "", opposingPartyContact: "", lawyerName: "", lawyerContact: "",
  apartmentId: null as number | null, tenantName: "",
  claimAmount: "", settledAmount: "", legalCosts: "",
  filingDate: "", nextHearingDate: "", deadlineDate: "", closedDate: "",
  notes: "", tags: [] as string[],
};

export default function SprawySadowe() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [sortField, setSortField] = useState<SortField>("deadlineDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showForm, setShowForm] = useState(false);
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  const [selectedCase, setSelectedCase] = useState<(LegalCase & { events?: LegalCaseEvent[] }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LegalCase | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tagInput, setTagInput] = useState("");
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ eventDate: "", eventType: "INNE", title: "", description: "", outcome: "" });
  const [editingEvent, setEditingEvent] = useState<LegalCaseEvent | null>(null);
  const [deleteEventTarget, setDeleteEventTarget] = useState<LegalCaseEvent | null>(null);

  const { data: cases = [], isLoading } = useQuery<LegalCase[]>({
    queryKey: ["/api/legal-cases"],
  });

  const { data: apartments = [] } = useQuery<any[]>({
    queryKey: ["/api/apartments"],
  });

  const { data: caseDetail } = useQuery<LegalCase & { events: LegalCaseEvent[] }>({
    queryKey: ["/api/legal-cases", selectedCase?.id],
    enabled: !!selectedCase?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/legal-cases", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legal-cases"] });
      toast({ title: "Sukces", description: "Sprawa została utworzona" });
      setShowForm(false);
      setForm({ ...emptyForm });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/legal-cases/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legal-cases"] });
      toast({ title: "Sukces", description: "Sprawa została zaktualizowana" });
      setShowForm(false);
      setEditingCase(null);
      setForm({ ...emptyForm });
      if (selectedCase) {
        queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCase.id] });
      }
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/legal-cases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legal-cases"] });
      toast({ title: "Usunięto", description: "Sprawa została usunięta" });
      setDeleteTarget(null);
      if (selectedCase) setSelectedCase(null);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const createEventMutation = useMutation({
    mutationFn: ({ caseId, data }: { caseId: number; data: any }) =>
      apiRequest("POST", `/api/legal-cases/${caseId}/events`, data),
    onSuccess: () => {
      if (selectedCase) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCase.id] });
      toast({ title: "Sukces", description: "Zdarzenie dodane" });
      setShowEventForm(false);
      setEventForm({ eventDate: "", eventType: "INNE", title: "", description: "", outcome: "" });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/legal-case-events/${id}`, data),
    onSuccess: () => {
      if (selectedCase) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCase.id] });
      toast({ title: "Sukces", description: "Zdarzenie zaktualizowane" });
      setShowEventForm(false);
      setEditingEvent(null);
      setEventForm({ eventDate: "", eventType: "INNE", title: "", description: "", outcome: "" });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/legal-case-events/${id}`),
    onSuccess: () => {
      if (selectedCase) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCase.id] });
      toast({ title: "Usunięto", description: "Zdarzenie usunięte" });
      setDeleteEventTarget(null);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ caseId, file }: { caseId: number; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/legal-cases/${caseId}/documents`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!resp.ok) throw new Error((await resp.json()).message || "Błąd uploadu");
      return resp.json();
    },
    onSuccess: () => {
      if (selectedCase) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCase.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/legal-cases"] });
      toast({ title: "Sukces", description: "Dokument przesłany" });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    let result = [...cases];
    if (filterStatus !== "all") result = result.filter(c => c.status === filterStatus);
    if (filterType !== "all") result = result.filter(c => c.caseType === filterType);
    if (filterPriority !== "all") result = result.filter(c => c.priority === filterPriority);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(c =>
        (c.title?.toLowerCase().includes(s)) ||
        (c.caseNumber?.toLowerCase().includes(s)) ||
        (c.opposingParty?.toLowerCase().includes(s)) ||
        (c.tenantName?.toLowerCase().includes(s))
      );
    }
    result.sort((a, b) => {
      let va: any = (a as any)[sortField];
      let vb: any = (b as any)[sortField];
      if (va == null) va = sortDir === "asc" ? "zzz" : "";
      if (vb == null) vb = sortDir === "asc" ? "zzz" : "";
      if (sortField === "claimAmount") { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });
    return result;
  }, [cases, filterStatus, filterType, filterPriority, search, sortField, sortDir]);

  const stats = useMemo(() => {
    const total = cases.length;
    const inProgress = cases.filter(c => c.status === "W_TOKU").length;
    const upcoming = cases.filter(c =>
      isUpcoming(c.nextHearingDate, 14) || isUpcoming(c.deadlineDate, 14)
    ).length;
    const totalClaims = cases.reduce((sum, c) => sum + (parseFloat(c.claimAmount || "0") || 0), 0);
    const totalCosts = cases.reduce((sum, c) => sum + (parseFloat(c.legalCosts || "0") || 0), 0);
    return { total, inProgress, upcoming, totalClaims, totalCosts };
  }, [cases]);

  function openCreate() {
    setEditingCase(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  }

  function openEdit(c: LegalCase) {
    setEditingCase(c);
    setForm({
      caseNumber: c.caseNumber || "",
      title: c.title || "",
      description: c.description || "",
      caseType: c.caseType || "",
      status: c.status || "NOWA",
      priority: c.priority || "NORMALNY",
      role: c.role || "",
      courtName: c.courtName || "",
      judge: c.judge || "",
      opposingParty: c.opposingParty || "",
      opposingPartyContact: c.opposingPartyContact || "",
      lawyerName: c.lawyerName || "",
      lawyerContact: c.lawyerContact || "",
      apartmentId: c.apartmentId || null,
      tenantName: c.tenantName || "",
      claimAmount: c.claimAmount || "",
      settledAmount: c.settledAmount || "",
      legalCosts: c.legalCosts || "",
      filingDate: c.filingDate || "",
      nextHearingDate: c.nextHearingDate || "",
      deadlineDate: c.deadlineDate || "",
      closedDate: c.closedDate || "",
      notes: c.notes || "",
      tags: c.tags || [],
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.title.trim()) {
      toast({ title: "Błąd", description: "Tytuł jest wymagany", variant: "destructive" });
      return;
    }
    const payload: any = {
      ...form,
      claimAmount: form.claimAmount || null,
      settledAmount: form.settledAmount || null,
      legalCosts: form.legalCosts || null,
      apartmentId: form.apartmentId || null,
      filingDate: form.filingDate || null,
      nextHearingDate: form.nextHearingDate || null,
      deadlineDate: form.deadlineDate || null,
      closedDate: form.closedDate || null,
      caseType: form.caseType || null,
      role: form.role || null,
    };
    if (editingCase) {
      updateMutation.mutate({ id: editingCase.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, t] }));
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  }

  function openEventCreate() {
    setEditingEvent(null);
    setEventForm({ eventDate: "", eventType: "INNE", title: "", description: "", outcome: "" });
    setShowEventForm(true);
  }

  function openEventEdit(ev: LegalCaseEvent) {
    setEditingEvent(ev);
    setEventForm({
      eventDate: ev.eventDate || "",
      eventType: ev.eventType || "INNE",
      title: ev.title || "",
      description: ev.description || "",
      outcome: ev.outcome || "",
    });
    setShowEventForm(true);
  }

  function handleEventSubmit() {
    if (!eventForm.title.trim() || !eventForm.eventDate) {
      toast({ title: "Błąd", description: "Tytuł i data są wymagane", variant: "destructive" });
      return;
    }
    if (editingEvent) {
      updateEventMutation.mutate({ id: editingEvent.id, data: eventForm });
    } else if (selectedCase) {
      createEventMutation.mutate({ caseId: selectedCase.id, data: eventForm });
    }
  }

  const detail = caseDetail || selectedCase;
  const events = caseDetail?.events || [];

  return (
    <div className="space-y-6" data-testid="page-sprawy-sadowe">
      <PageHeader
        title="Sprawy Sądowe"
        description="Ewidencja, śledzenie i planowanie spraw prawnych."
        icon={Scale}
      />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-card" data-testid="tile-total">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Wszystkie sprawy</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-yellow-500/30" data-testid="tile-in-progress">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">W toku</div>
          </CardContent>
        </Card>
        <Card className="bg-card border-orange-500/30" data-testid="tile-upcoming">
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-orange-400">{stats.upcoming}</div>
            <div className="text-xs text-muted-foreground">Nadchodzące terminy</div>
          </CardContent>
        </Card>
        <Card className="bg-card" data-testid="tile-claims">
          <CardContent className="p-4">
            <div className="text-lg font-bold">{formatPLN(stats.totalClaims)}</div>
            <div className="text-xs text-muted-foreground">Roszczenia</div>
          </CardContent>
        </Card>
        <Card className="bg-card" data-testid="tile-costs">
          <CardContent className="p-4">
            <div className="text-lg font-bold">{formatPLN(stats.totalCosts)}</div>
            <div className="text-xs text-muted-foreground">Koszty prawne</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 w-56"
              data-testid="input-search"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40" data-testid="select-filter-type">
              <SelectValue placeholder="Typ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie typy</SelectItem>
              {CASE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-36" data-testid="select-filter-priority">
              <SelectValue placeholder="Priorytet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} className="gap-1.5" data-testid="button-create-case">
          <Plus className="h-4 w-4" /> Nowa sprawa
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Ładowanie...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Brak spraw sądowych</p>
            <p className="text-sm mt-1">Kliknij "Nowa sprawa" aby dodać pierwszą sprawę.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  {[
                    { field: "caseNumber" as SortField, label: "Sygnatura" },
                    { field: "title" as SortField, label: "Tytuł" },
                    { field: "status" as SortField, label: "Status" },
                    { field: "priority" as SortField, label: "Priorytet" },
                  ].map(col => (
                    <th key={col.field} className="px-3 py-2.5 text-left font-medium cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort(col.field)} data-testid={`th-${col.field}`}>
                      <div className="flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-left font-medium">Strona przeciwna</th>
                  <th className="px-3 py-2.5 text-right font-medium cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("claimAmount")} data-testid="th-claimAmount">
                    <div className="flex items-center justify-end gap-1">Kwota <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("nextHearingDate")} data-testid="th-nextHearingDate">
                    <div className="flex items-center gap-1">Rozprawa <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium cursor-pointer select-none hover:bg-muted/80" onClick={() => toggleSort("deadlineDate")} data-testid="th-deadlineDate">
                    <div className="flex items-center gap-1">Termin <ArrowUpDown className="h-3 w-3 text-muted-foreground" /></div>
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const deadlineUrgent = isUpcoming(c.deadlineDate, 7) || isOverdue(c.deadlineDate);
                  const hearingUrgent = isUpcoming(c.nextHearingDate, 7);
                  return (
                    <tr
                      key={c.id}
                      className="border-b hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => setSelectedCase(c)}
                      data-testid={`row-case-${c.id}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs">{c.caseNumber || "—"}</td>
                      <td className="px-3 py-2.5 max-w-[200px] truncate font-medium">{c.title}</td>
                      <td className="px-3 py-2.5">{getStatusBadge(c.status || "NOWA")}</td>
                      <td className="px-3 py-2.5">{getPriorityBadge(c.priority || "NORMALNY")}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{c.opposingParty || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono">{formatPLN(c.claimAmount)}</td>
                      <td className={`px-3 py-2.5 ${hearingUrgent ? "text-orange-400 font-medium" : "text-muted-foreground"}`}>
                        {c.nextHearingDate ? format(parseISO(c.nextHearingDate), "dd.MM.yyyy") : "—"}
                      </td>
                      <td className={`px-3 py-2.5 ${deadlineUrgent ? (isOverdue(c.deadlineDate) ? "text-red-400" : "text-orange-400") + " font-medium" : "text-muted-foreground"}`}>
                        {c.deadlineDate ? format(parseISO(c.deadlineDate), "dd.MM.yyyy") : "—"}
                        {isOverdue(c.deadlineDate) && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedCase(c)} data-testid={`button-view-${c.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)} data-testid={`button-edit-${c.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-300" onClick={() => setDeleteTarget(c)} data-testid={`button-delete-${c.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(v) => { if (!v) { setShowForm(false); setEditingCase(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCase ? "Edytuj sprawę" : "Nowa sprawa sądowa"}</DialogTitle>
            <DialogDescription>
              {editingCase ? "Zmień dane sprawy i zapisz." : "Wypełnij dane nowej sprawy sądowej."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Sygnatura</Label>
              <Input value={form.caseNumber} onChange={e => setForm(p => ({ ...p, caseNumber: e.target.value }))} placeholder="np. I C 123/25" data-testid="input-case-number" />
            </div>
            <div className="space-y-1.5">
              <Label>Tytuł *</Label>
              <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Krótki opis sprawy" data-testid="input-title" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Opis</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} data-testid="input-description" />
            </div>
            <div className="space-y-1.5">
              <Label>Typ sprawy</Label>
              <Select value={form.caseType || "none"} onValueChange={v => setForm(p => ({ ...p, caseType: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="select-case-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Wybierz —</SelectItem>
                  {CASE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priorytet</Label>
              <Select value={form.priority} onValueChange={v => setForm(p => ({ ...p, priority: v }))}>
                <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rola firmy</Label>
              <Select value={form.role || "none"} onValueChange={v => setForm(p => ({ ...p, role: v === "none" ? "" : v }))}>
                <SelectTrigger data-testid="select-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Wybierz —</SelectItem>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2 border-t pt-3 mt-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sąd i strony</span>
            </div>
            <div className="space-y-1.5">
              <Label>Nazwa sądu</Label>
              <Input value={form.courtName} onChange={e => setForm(p => ({ ...p, courtName: e.target.value }))} data-testid="input-court" />
            </div>
            <div className="space-y-1.5">
              <Label>Sędzia</Label>
              <Input value={form.judge} onChange={e => setForm(p => ({ ...p, judge: e.target.value }))} data-testid="input-judge" />
            </div>
            <div className="space-y-1.5">
              <Label>Strona przeciwna</Label>
              <Input value={form.opposingParty} onChange={e => setForm(p => ({ ...p, opposingParty: e.target.value }))} data-testid="input-opposing-party" />
            </div>
            <div className="space-y-1.5">
              <Label>Kontakt strony przeciwnej</Label>
              <Input value={form.opposingPartyContact} onChange={e => setForm(p => ({ ...p, opposingPartyContact: e.target.value }))} data-testid="input-opposing-contact" />
            </div>
            <div className="space-y-1.5">
              <Label>Prawnik / kancelaria</Label>
              <Input value={form.lawyerName} onChange={e => setForm(p => ({ ...p, lawyerName: e.target.value }))} data-testid="input-lawyer" />
            </div>
            <div className="space-y-1.5">
              <Label>Kontakt do prawnika</Label>
              <Input value={form.lawyerContact} onChange={e => setForm(p => ({ ...p, lawyerContact: e.target.value }))} data-testid="input-lawyer-contact" />
            </div>

            <div className="md:col-span-2 border-t pt-3 mt-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Powiązania</span>
            </div>
            <div className="space-y-1.5">
              <Label>Apartament</Label>
              <Select value={form.apartmentId?.toString() || "none"} onValueChange={v => setForm(p => ({ ...p, apartmentId: v === "none" ? null : parseInt(v) }))}>
                <SelectTrigger data-testid="select-apartment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Brak —</SelectItem>
                  {apartments.map((a: any) => <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Najemca / dłużnik</Label>
              <Input value={form.tenantName} onChange={e => setForm(p => ({ ...p, tenantName: e.target.value }))} data-testid="input-tenant" />
            </div>

            <div className="md:col-span-2 border-t pt-3 mt-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kwoty (PLN)</span>
            </div>
            <div className="space-y-1.5">
              <Label>Kwota roszczenia</Label>
              <Input type="number" step="0.01" value={form.claimAmount} onChange={e => setForm(p => ({ ...p, claimAmount: e.target.value }))} data-testid="input-claim" />
            </div>
            <div className="space-y-1.5">
              <Label>Kwota uzyskana/zapłacona</Label>
              <Input type="number" step="0.01" value={form.settledAmount} onChange={e => setForm(p => ({ ...p, settledAmount: e.target.value }))} data-testid="input-settled" />
            </div>
            <div className="space-y-1.5">
              <Label>Koszty prawne</Label>
              <Input type="number" step="0.01" value={form.legalCosts} onChange={e => setForm(p => ({ ...p, legalCosts: e.target.value }))} data-testid="input-legal-costs" />
            </div>

            <div className="md:col-span-2 border-t pt-3 mt-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daty</span>
            </div>
            <div className="space-y-1.5">
              <Label>Data złożenia</Label>
              <Input type="date" value={form.filingDate} onChange={e => setForm(p => ({ ...p, filingDate: e.target.value }))} data-testid="input-filing-date" />
            </div>
            <div className="space-y-1.5">
              <Label>Następna rozprawa</Label>
              <Input type="date" value={form.nextHearingDate} onChange={e => setForm(p => ({ ...p, nextHearingDate: e.target.value }))} data-testid="input-hearing-date" />
            </div>
            <div className="space-y-1.5">
              <Label>Termin na działanie</Label>
              <Input type="date" value={form.deadlineDate} onChange={e => setForm(p => ({ ...p, deadlineDate: e.target.value }))} data-testid="input-deadline" />
            </div>
            <div className="space-y-1.5">
              <Label>Data zakończenia</Label>
              <Input type="date" value={form.closedDate} onChange={e => setForm(p => ({ ...p, closedDate: e.target.value }))} data-testid="input-closed-date" />
            </div>

            <div className="md:col-span-2 border-t pt-3 mt-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dodatkowe</span>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Notatki</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} data-testid="input-notes" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Tagi</Label>
              <div className="flex gap-2 flex-wrap mb-1.5">
                {form.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeTag(tag)}>
                    {tag} <X className="h-3 w-3" />
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  placeholder="Dodaj tag..."
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  className="flex-1"
                  data-testid="input-tag"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag} data-testid="button-add-tag">Dodaj</Button>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { setShowForm(false); setEditingCase(null); }} data-testid="button-cancel">Anuluj</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save">
              {(createMutation.isPending || updateMutation.isPending) ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCase} onOpenChange={(v) => { if (!v) setSelectedCase(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 flex-wrap">
                  <DialogTitle className="text-lg">{detail.title}</DialogTitle>
                  {getStatusBadge(detail.status || "NOWA")}
                  {getPriorityBadge(detail.priority || "NORMALNY")}
                </div>
                <DialogDescription>
                  {detail.caseNumber && <span className="font-mono">Sygn.: {detail.caseNumber}</span>}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div className="space-y-3 md:col-span-2">
                  {detail.description && (
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase">Opis</span>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{detail.description}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {detail.caseType && <div><span className="text-muted-foreground">Typ:</span> <span className="capitalize">{detail.caseType}</span></div>}
                    {detail.role && <div><span className="text-muted-foreground">Rola:</span> <span className="capitalize">{detail.role}</span></div>}
                    {detail.courtName && <div><span className="text-muted-foreground">Sąd:</span> {detail.courtName}</div>}
                    {detail.judge && <div><span className="text-muted-foreground">Sędzia:</span> {detail.judge}</div>}
                    {detail.opposingParty && <div><span className="text-muted-foreground">Strona przeciwna:</span> {detail.opposingParty}</div>}
                    {detail.lawyerName && <div><span className="text-muted-foreground">Prawnik:</span> {detail.lawyerName}</div>}
                    {detail.tenantName && <div><span className="text-muted-foreground">Najemca:</span> {detail.tenantName}</div>}
                  </div>

                  {(detail.tags && detail.tags.length > 0) && (
                    <div className="flex gap-1.5 flex-wrap">
                      {detail.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <Card>
                    <CardContent className="p-3 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Roszczenie:</span><span className="font-mono font-medium">{formatPLN(detail.claimAmount)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Uzyskano:</span><span className="font-mono">{formatPLN(detail.settledAmount)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Koszty:</span><span className="font-mono">{formatPLN(detail.legalCosts)}</span></div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 space-y-2 text-sm">
                      {detail.filingDate && <div className="flex justify-between"><span className="text-muted-foreground">Złożono:</span><span>{format(parseISO(detail.filingDate), "dd.MM.yyyy")}</span></div>}
                      {detail.nextHearingDate && (
                        <div className={`flex justify-between ${isUpcoming(detail.nextHearingDate, 7) ? "text-orange-400 font-medium" : ""}`}>
                          <span className="text-muted-foreground">Rozprawa:</span><span>{format(parseISO(detail.nextHearingDate), "dd.MM.yyyy")}</span>
                        </div>
                      )}
                      {detail.deadlineDate && (
                        <div className={`flex justify-between ${isOverdue(detail.deadlineDate) ? "text-red-400 font-medium" : isUpcoming(detail.deadlineDate, 7) ? "text-orange-400 font-medium" : ""}`}>
                          <span className="text-muted-foreground">Termin:</span>
                          <span className="flex items-center gap-1">
                            {format(parseISO(detail.deadlineDate), "dd.MM.yyyy")}
                            {isOverdue(detail.deadlineDate) && <AlertTriangle className="h-3 w-3" />}
                          </span>
                        </div>
                      )}
                      {detail.closedDate && <div className="flex justify-between"><span className="text-muted-foreground">Zakończono:</span><span>{format(parseISO(detail.closedDate), "dd.MM.yyyy")}</span></div>}
                    </CardContent>
                  </Card>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => { setSelectedCase(null); openEdit(detail as LegalCase); }} data-testid="button-edit-detail">
                      <Pencil className="h-3.5 w-3.5" /> Edytuj
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-400 hover:text-red-300 gap-1" onClick={() => setDeleteTarget(detail as LegalCase)} data-testid="button-delete-detail">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {detail.notes && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Notatki</span>
                  <p className="mt-1 whitespace-pre-wrap">{detail.notes}</p>
                </div>
              )}

              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Linia czasu
                  </h3>
                  <Button variant="outline" size="sm" className="gap-1" onClick={openEventCreate} data-testid="button-add-event">
                    <Plus className="h-3.5 w-3.5" /> Dodaj zdarzenie
                  </Button>
                </div>

                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Brak zdarzeń</p>
                ) : (
                  <div className="space-y-0 relative">
                    <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
                    {events.map((ev, idx) => {
                      const evType = EVENT_TYPES.find(t => t.value === ev.eventType) || EVENT_TYPES[EVENT_TYPES.length - 1];
                      const EvIcon = evType.icon;
                      return (
                        <div key={ev.id} className="relative flex gap-3 pb-4 group" data-testid={`event-${ev.id}`}>
                          <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center ${evType.color}`}>
                            <EvIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-sm font-medium">{ev.title}</span>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                  <span>{ev.eventDate ? format(parseISO(ev.eventDate), "dd.MM.yyyy") : ""}</span>
                                  <Badge variant="outline" className="text-[10px] h-4">{evType.label}</Badge>
                                </div>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEventEdit(ev)} data-testid={`button-edit-event-${ev.id}`}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => setDeleteEventTarget(ev)} data-testid={`button-delete-event-${ev.id}`}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            {ev.description && <p className="text-sm text-muted-foreground mt-1">{ev.description}</p>}
                            {ev.outcome && <p className="text-sm mt-1"><span className="text-muted-foreground">Wynik:</span> {ev.outcome}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Dokumenty
                  </h3>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" className="gap-1 pointer-events-none" data-testid="button-upload-doc">
                      <Upload className="h-3.5 w-3.5" /> Dodaj dokument
                    </Button>
                    <input
                      type="file"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file && selectedCase) {
                          uploadMutation.mutate({ caseId: selectedCase.id, file });
                        }
                        e.target.value = "";
                      }}
                      data-testid="input-file-upload"
                    />
                  </label>
                </div>
                {(detail.documentUrls && detail.documentUrls.length > 0) ? (
                  <div className="space-y-1.5">
                    {detail.documentUrls.map((url, i) => {
                      const fileName = url.split("/").pop() || url;
                      return (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm" data-testid={`doc-${i}`}>
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="flex-1 truncate">{fileName}</span>
                          <a
                            href={`/api/object-storage/download?path=${encodeURIComponent(url)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-xs shrink-0"
                            data-testid={`link-download-${i}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-3">Brak dokumentów</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEventForm} onOpenChange={v => { if (!v) { setShowEventForm(false); setEditingEvent(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "Edytuj zdarzenie" : "Nowe zdarzenie"}</DialogTitle>
            <DialogDescription>
              {editingEvent ? "Zmień dane zdarzenia." : "Dodaj nowe zdarzenie do linii czasu sprawy."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tytuł *</Label>
              <Input value={eventForm.title} onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))} data-testid="input-event-title" />
            </div>
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={eventForm.eventDate} onChange={e => setEventForm(p => ({ ...p, eventDate: e.target.value }))} data-testid="input-event-date" />
            </div>
            <div className="space-y-1.5">
              <Label>Typ zdarzenia</Label>
              <Select value={eventForm.eventType} onValueChange={v => setEventForm(p => ({ ...p, eventType: v }))}>
                <SelectTrigger data-testid="select-event-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Opis</Label>
              <Textarea value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} rows={2} data-testid="input-event-description" />
            </div>
            <div className="space-y-1.5">
              <Label>Wynik / rezultat</Label>
              <Input value={eventForm.outcome} onChange={e => setEventForm(p => ({ ...p, outcome: e.target.value }))} data-testid="input-event-outcome" />
            </div>
          </div>
          <DialogFooter className="mt-3">
            <Button variant="outline" onClick={() => { setShowEventForm(false); setEditingEvent(null); }}>Anuluj</Button>
            <Button onClick={handleEventSubmit} disabled={createEventMutation.isPending || updateEventMutation.isPending} data-testid="button-save-event">
              {(createEventMutation.isPending || updateEventMutation.isPending) ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={v => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć sprawę?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć sprawę "{deleteTarget?.title}"? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              data-testid="button-confirm-delete"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteEventTarget} onOpenChange={v => { if (!v) setDeleteEventTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć zdarzenie?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć zdarzenie "{deleteEventTarget?.title}"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deleteEventTarget && deleteEventMutation.mutate(deleteEventTarget.id)}
              data-testid="button-confirm-delete-event"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
