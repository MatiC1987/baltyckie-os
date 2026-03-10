import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { authenticatedUrl, getAuthHeaders } from "@/lib/auth-token";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/PageHeader";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  Scale, Plus, Search, Pencil, Trash2, Calendar,
  FileText, AlertTriangle, Clock, ChevronDown, ChevronRight,
  Gavel, Users, DollarSign, Upload, Download,
  MessageSquare, CheckCircle, ArrowLeft, Paperclip, X, Loader2
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
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
  { value: "ROZPRAWA", label: "Rozprawa", icon: Gavel, color: "text-red-400", bg: "bg-red-500/15 border-red-500/30" },
  { value: "PISMO", label: "Pismo", icon: FileText, color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30" },
  { value: "TERMIN", label: "Termin", icon: Calendar, color: "text-orange-400", bg: "bg-orange-500/15 border-orange-500/30" },
  { value: "DECYZJA", label: "Decyzja", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30" },
  { value: "PLATNOSC", label: "Płatność", icon: DollarSign, color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/30" },
  { value: "SPOTKANIE", label: "Spotkanie", icon: Users, color: "text-violet-400", bg: "bg-violet-500/15 border-violet-500/30" },
  { value: "INNE", label: "Inne", icon: MessageSquare, color: "text-slate-400", bg: "bg-slate-500/15 border-slate-500/30" },
];

function getStatusBadge(status: string) {
  return <StatusBadge status={status} />;
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

function extractFileName(path: string): string {
  const raw = path.split("/").pop() || path;
  return raw.replace(/^\d+_/, "");
}

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
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingCase, setEditingCase] = useState<LegalCase | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LegalCase | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [tagInput, setTagInput] = useState("");
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventForm, setEventForm] = useState({ eventDate: "", eventType: "INNE", title: "", description: "", outcome: "" });
  const [editingEvent, setEditingEvent] = useState<LegalCaseEvent | null>(null);
  const [deleteEventTarget, setDeleteEventTarget] = useState<LegalCaseEvent | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [showSummary, setShowSummary] = useState(true);
  const eventFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingEventId, setUploadingEventId] = useState<number | null>(null);

  const { data: cases = [], isLoading } = useQuery<LegalCase[]>({
    queryKey: ["/api/legal-cases"],
  });

  const { data: apartments = [] } = useQuery<any[]>({
    queryKey: ["/api/apartments"],
  });

  const { data: caseDetail } = useQuery<LegalCase & { events: LegalCaseEvent[] }>({
    queryKey: ["/api/legal-cases", selectedCaseId],
    enabled: !!selectedCaseId,
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
      if (selectedCaseId) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCaseId] });
      toast({ title: "Sukces", description: "Sprawa została zaktualizowana" });
      setShowForm(false);
      setEditingCase(null);
      setForm({ ...emptyForm });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/legal-cases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/legal-cases"] });
      toast({ title: "Usunięto", description: "Sprawa została usunięta" });
      setDeleteTarget(null);
      if (selectedCaseId) setSelectedCaseId(null);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const createEventMutation = useMutation({
    mutationFn: ({ caseId, data }: { caseId: number; data: any }) =>
      apiRequest("POST", `/api/legal-cases/${caseId}/events`, data),
    onSuccess: () => {
      if (selectedCaseId) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCaseId] });
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
      if (selectedCaseId) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCaseId] });
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
      if (selectedCaseId) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCaseId] });
      toast({ title: "Usunięto", description: "Zdarzenie usunięte" });
      setDeleteEventTarget(null);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const uploadEventFileMutation = useMutation({
    mutationFn: async ({ eventId, file }: { eventId: number; file: File }) => {
      setUploadingEventId(eventId);
      const fd = new FormData();
      fd.append("file", file);
      const resp = await fetch(`/api/legal-case-events/${eventId}/upload`, {
        method: "POST",
        body: fd,
        headers: getAuthHeaders(),
        credentials: "include",
      });
      if (!resp.ok) throw new Error((await resp.json()).message || "Błąd uploadu");
      return resp.json();
    },
    onSuccess: () => {
      if (selectedCaseId) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCaseId] });
      toast({ title: "Sukces", description: "Plik przesłany" });
      setUploadingEventId(null);
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
      setUploadingEventId(null);
    },
  });

  const deleteAttachmentMutation = useMutation({
    mutationFn: ({ eventId, objectPath }: { eventId: number; objectPath: string }) =>
      apiRequest("DELETE", `/api/legal-case-events/${eventId}/attachments`, { objectPath }),
    onSuccess: () => {
      if (selectedCaseId) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCaseId] });
      toast({ title: "Usunięto", description: "Załącznik usunięty" });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const uploadCaseDocMutation = useMutation({
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
      if (selectedCaseId) queryClient.invalidateQueries({ queryKey: ["/api/legal-cases", selectedCaseId] });
      queryClient.invalidateQueries({ queryKey: ["/api/legal-cases"] });
      toast({ title: "Sukces", description: "Dokument przesłany" });
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    let result = [...cases];
    if (filterStatus !== "all") result = result.filter(c => c.status === filterStatus);
    if (filterType !== "all") result = result.filter(c => c.caseType === filterType);
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
      const da = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const db = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return db - da;
    });
    return result;
  }, [cases, filterStatus, filterType, search]);

  const stats = useMemo(() => {
    const total = cases.length;
    const inProgress = cases.filter(c => c.status === "W_TOKU").length;
    const upcoming = cases.filter(c =>
      isUpcoming(c.nextHearingDate, 14) || isUpcoming(c.deadlineDate, 14)
    ).length;
    const totalClaims = cases.reduce((sum, c) => sum + (parseFloat(c.claimAmount || "0") || 0), 0);
    return { total, inProgress, upcoming, totalClaims };
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
    } else if (selectedCaseId) {
      createEventMutation.mutate({ caseId: selectedCaseId, data: eventForm });
    }
  }

  function toggleEventExpanded(eventId: number) {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  const detail = caseDetail;
  const events = caseDetail?.events || [];

  if (selectedCaseId) {
    return (
      <div className="space-y-4" data-testid="page-sprawy-sadowe-detail">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => { setSelectedCaseId(null); setExpandedEvents(new Set()); setShowSummary(true); }}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" /> Powrót do listy
          </Button>
        </div>

        {!detail ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Ładowanie...
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2" data-testid="text-case-title">
                  <Scale className="h-5 w-5 text-primary" />
                  {detail.title}
                </h1>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {detail.caseNumber && (
                    <span className="text-sm font-mono text-muted-foreground" data-testid="text-case-number">
                      Sygn.: {detail.caseNumber}
                    </span>
                  )}
                  {getStatusBadge(detail.status || "NOWA")}
                  {getPriorityBadge(detail.priority || "NORMALNY")}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openEdit(detail as LegalCase)} data-testid="button-edit-case">
                  <Pencil className="h-3.5 w-3.5" /> Edytuj
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-red-400 hover:text-red-300" onClick={() => setDeleteTarget(detail as LegalCase)} data-testid="button-delete-case">
                  <Trash2 className="h-3.5 w-3.5" /> Usuń
                </Button>
              </div>
            </div>

            <Card>
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setShowSummary(v => !v)}
                data-testid="button-toggle-summary"
              >
                <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Podsumowanie sprawy</span>
                {showSummary ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
              {showSummary && (
                <CardContent className="pt-0 pb-4 px-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2 text-sm">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Informacje</h4>
                      {detail.caseType && <div><span className="text-muted-foreground">Typ:</span> <span className="capitalize">{detail.caseType}</span></div>}
                      {detail.role && <div><span className="text-muted-foreground">Rola:</span> <span className="capitalize">{detail.role}</span></div>}
                      {detail.courtName && <div><span className="text-muted-foreground">Sąd:</span> {detail.courtName}</div>}
                      {detail.judge && <div><span className="text-muted-foreground">Sędzia:</span> {detail.judge}</div>}
                    </div>
                    <div className="space-y-2 text-sm">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Strony</h4>
                      {detail.opposingParty && <div><span className="text-muted-foreground">Przeciwnik:</span> {detail.opposingParty}</div>}
                      {detail.opposingPartyContact && <div className="text-muted-foreground text-xs">{detail.opposingPartyContact}</div>}
                      {detail.lawyerName && <div><span className="text-muted-foreground">Prawnik:</span> {detail.lawyerName}</div>}
                      {detail.lawyerContact && <div className="text-muted-foreground text-xs">{detail.lawyerContact}</div>}
                      {detail.tenantName && <div><span className="text-muted-foreground">Najemca:</span> {detail.tenantName}</div>}
                    </div>
                    <div className="space-y-2 text-sm">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase">Finanse i terminy</h4>
                      <div><span className="text-muted-foreground">Roszczenie:</span> <span className="font-mono">{formatPLN(detail.claimAmount)}</span></div>
                      <div><span className="text-muted-foreground">Uzyskano:</span> <span className="font-mono">{formatPLN(detail.settledAmount)}</span></div>
                      <div><span className="text-muted-foreground">Koszty:</span> <span className="font-mono">{formatPLN(detail.legalCosts)}</span></div>
                      {detail.filingDate && <div><span className="text-muted-foreground">Złożono:</span> {format(parseISO(detail.filingDate), "dd.MM.yyyy")}</div>}
                      {detail.nextHearingDate && (
                        <div className={isUpcoming(detail.nextHearingDate, 7) ? "text-orange-400 font-medium" : ""}>
                          <span className="text-muted-foreground">Rozprawa:</span> {format(parseISO(detail.nextHearingDate), "dd.MM.yyyy")}
                        </div>
                      )}
                      {detail.deadlineDate && (
                        <div className={isOverdue(detail.deadlineDate) ? "text-red-400 font-medium" : isUpcoming(detail.deadlineDate, 7) ? "text-orange-400 font-medium" : ""}>
                          <span className="text-muted-foreground">Termin:</span> {format(parseISO(detail.deadlineDate), "dd.MM.yyyy")}
                          {isOverdue(detail.deadlineDate) && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </div>
                      )}
                      {detail.closedDate && <div><span className="text-muted-foreground">Zakończono:</span> {format(parseISO(detail.closedDate), "dd.MM.yyyy")}</div>}
                    </div>
                  </div>
                  {detail.description && (
                    <div className="mt-3 p-3 rounded-lg bg-muted/50 text-sm">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">Opis</span>
                      <p className="mt-1 whitespace-pre-wrap">{detail.description}</p>
                    </div>
                  )}
                  {detail.notes && (
                    <div className="mt-2 p-3 rounded-lg bg-muted/50 text-sm">
                      <span className="text-xs font-semibold text-muted-foreground uppercase">Notatki</span>
                      <p className="mt-1 whitespace-pre-wrap">{detail.notes}</p>
                    </div>
                  )}
                  {detail.tags && detail.tags.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap mt-3">
                      {detail.tags.map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                    </div>
                  )}
                  {detail.documentUrls && detail.documentUrls.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Dokumenty sprawy</h4>
                      <div className="space-y-1">
                        {detail.documentUrls.map((url, i) => (
                          <a
                            key={i}
                            href={authenticatedUrl(`/api/legal-case-files?path=${encodeURIComponent(url)}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded bg-muted/50 hover:bg-muted text-sm transition-colors"
                            data-testid={`doc-case-${i}`}
                          >
                            <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="flex-1 truncate">{extractFileName(url)}</span>
                            <Download className="h-3.5 w-3.5 text-primary shrink-0" />
                          </a>
                        ))}
                      </div>
                      <label className="cursor-pointer inline-block mt-2">
                        <Button variant="outline" size="sm" className="gap-1 pointer-events-none" data-testid="button-upload-case-doc">
                          <Upload className="h-3.5 w-3.5" /> Dodaj dokument
                        </Button>
                        <input
                          type="file"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file && selectedCaseId) uploadCaseDocMutation.mutate({ caseId: selectedCaseId, file });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  )}
                  {(!detail.documentUrls || detail.documentUrls.length === 0) && (
                    <div className="mt-3">
                      <label className="cursor-pointer inline-block">
                        <Button variant="outline" size="sm" className="gap-1 pointer-events-none" data-testid="button-upload-case-doc">
                          <Upload className="h-3.5 w-3.5" /> Dodaj dokument do sprawy
                        </Button>
                        <input
                          type="file"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file && selectedCaseId) uploadCaseDocMutation.mutate({ caseId: selectedCaseId, file });
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>

            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" /> Linia czasu ({events.length})
              </h2>
              <Button size="sm" className="gap-1.5" onClick={openEventCreate} data-testid="button-add-event">
                <Plus className="h-3.5 w-3.5" /> Dodaj zdarzenie
              </Button>
            </div>

            {events.length === 0 ? (
              <EmptyState variant="card" icon={Clock} title="Brak zdarzeń w tej sprawie" description="Dodaj pierwsze zdarzenie do linii czasu." />
            ) : (
              <div className="relative ml-5">
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-border" />

                {events.map((ev) => {
                  const evType = EVENT_TYPES.find(t => t.value === ev.eventType) || EVENT_TYPES[EVENT_TYPES.length - 1];
                  const EvIcon = evType.icon;
                  const isExpanded = expandedEvents.has(ev.id);
                  const hasDesc = !!(ev.description || ev.outcome);
                  const attachments = ev.documentUrls || [];

                  return (
                    <div key={ev.id} className="relative pl-8 pb-6 group" data-testid={`event-${ev.id}`}>
                      <div className={`absolute left-0 top-1 -translate-x-1/2 w-9 h-9 rounded-full border-2 flex items-center justify-center z-10 ${evType.bg} ${evType.color}`}>
                        <EvIcon className="h-4 w-4" />
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span className="font-mono" data-testid={`text-event-date-${ev.id}`}>
                          {ev.eventDate ? format(parseISO(ev.eventDate), "dd.MM.yyyy") : ""}
                        </span>
                        <Badge variant="outline" className={`text-[10px] h-4 px-1.5 ${evType.color}`}>{evType.label}</Badge>
                      </div>

                      <div
                        className={`rounded-lg border bg-card p-3 transition-colors ${hasDesc || attachments.length > 0 ? "cursor-pointer hover:bg-muted/30" : ""}`}
                        onClick={() => (hasDesc || attachments.length > 0) && toggleEventExpanded(ev.id)}
                        data-testid={`card-event-${ev.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {(hasDesc || attachments.length > 0) && (
                              isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="font-medium text-sm" data-testid={`text-event-title-${ev.id}`}>{ev.title}</span>
                            {attachments.length > 0 && (
                              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                                <Paperclip className="h-3 w-3" /> {attachments.length}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              setUploadingEventId(ev.id);
                              eventFileInputRef.current?.click();
                            }} data-testid={`button-upload-event-${ev.id}`}>
                              <Upload className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEventEdit(ev)} data-testid={`button-edit-event-${ev.id}`}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400" onClick={() => setDeleteEventTarget(ev)} data-testid={`button-delete-event-${ev.id}`}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
                            {ev.description && (
                              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ev.description}</p>
                            )}
                            {ev.outcome && (
                              <p className="text-sm">
                                <span className="text-muted-foreground font-medium">Wynik:</span> {ev.outcome}
                              </p>
                            )}
                            {attachments.length > 0 && (
                              <div className="space-y-1 pt-1">
                                <span className="text-xs font-semibold text-muted-foreground uppercase">Załączniki</span>
                                {attachments.map((url, i) => (
                                  <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-muted/50 text-sm" data-testid={`attachment-${ev.id}-${i}`}>
                                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="flex-1 truncate text-xs">{extractFileName(url)}</span>
                                    <a
                                      href={authenticatedUrl(`/api/legal-case-files?path=${encodeURIComponent(url)}`)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="shrink-0 text-primary hover:text-primary/80"
                                      data-testid={`link-download-${ev.id}-${i}`}
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                    </a>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-red-400 hover:text-red-300 shrink-0"
                                      onClick={() => deleteAttachmentMutation.mutate({ eventId: ev.id, objectPath: url })}
                                      data-testid={`button-delete-attachment-${ev.id}-${i}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {uploadingEventId === ev.id && uploadEventFileMutation.isPending && (
                          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Przesyłanie pliku...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <input
              ref={eventFileInputRef}
              type="file"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file && uploadingEventId) {
                  uploadEventFileMutation.mutate({ eventId: uploadingEventId, file });
                }
                e.target.value = "";
              }}
            />
          </>
        )}

        {renderEventDialog()}
        {renderCaseDialog()}
        {renderDeleteDialogs()}
      </div>
    );
  }

  function renderMasterView() {
    return (
      <div className="space-y-6" data-testid="page-sprawy-sadowe">
        <PageHeader
          title="Sprawy Sądowe"
          description="Ewidencja, śledzenie i planowanie spraw prawnych."
          icon={Scale}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
          </div>
          <Button onClick={openCreate} className="gap-1.5" data-testid="button-create-case">
            <Plus className="h-4 w-4" /> Nowa sprawa
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Ładowanie...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState variant="card" icon={Scale} title="Brak spraw sądowych" description="Kliknij &quot;Nowa sprawa&quot; aby dodać pierwszą sprawę." />
        ) : (
          <div className="grid gap-3">
            {filtered.map(c => {
              const deadlineUrgent = isUpcoming(c.deadlineDate, 7) || isOverdue(c.deadlineDate);
              const hearingUrgent = isUpcoming(c.nextHearingDate, 7);
              return (
                <Card
                  key={c.id}
                  className="hover:bg-muted/30 transition-colors cursor-pointer group"
                  onClick={() => setSelectedCaseId(c.id)}
                  data-testid={`card-case-${c.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold truncate" data-testid={`text-case-title-${c.id}`}>{c.title}</span>
                          {getStatusBadge(c.status || "NOWA")}
                          {getPriorityBadge(c.priority || "NORMALNY")}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground flex-wrap">
                          {c.caseNumber && <span className="font-mono text-xs">Sygn.: {c.caseNumber}</span>}
                          {c.opposingParty && <span>vs. {c.opposingParty}</span>}
                          {c.courtName && <span className="text-xs">{c.courtName}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {c.claimAmount && parseFloat(c.claimAmount) > 0 && (
                          <span className="font-mono text-sm font-medium">{formatPLN(c.claimAmount)}</span>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {c.nextHearingDate && (
                            <span className={hearingUrgent ? "text-orange-400 font-medium" : ""}>
                              <Gavel className="inline h-3 w-3 mr-0.5" />
                              {format(parseISO(c.nextHearingDate), "dd.MM")}
                            </span>
                          )}
                          {c.deadlineDate && (
                            <span className={deadlineUrgent ? (isOverdue(c.deadlineDate) ? "text-red-400" : "text-orange-400") + " font-medium" : ""}>
                              <Calendar className="inline h-3 w-3 mr-0.5" />
                              {format(parseISO(c.deadlineDate), "dd.MM")}
                              {isOverdue(c.deadlineDate) && <AlertTriangle className="inline h-3 w-3 ml-0.5" />}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => openEdit(c)} data-testid={`button-edit-${c.id}`}>
                        <Pencil className="h-3 w-3" /> Edytuj
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-red-400 hover:text-red-300" onClick={() => setDeleteTarget(c)} data-testid={`button-delete-${c.id}`}>
                        <Trash2 className="h-3 w-3" /> Usuń
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {renderCaseDialog()}
        {renderDeleteDialogs()}
      </div>
    );
  }

  function renderCaseDialog() {
    return (
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
    );
  }

  function renderEventDialog() {
    return (
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
              <Textarea value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} rows={3} data-testid="input-event-description" />
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
    );
  }

  function renderDeleteDialogs() {
    return (
      <>
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
      </>
    );
  }

  return renderMasterView();
}
