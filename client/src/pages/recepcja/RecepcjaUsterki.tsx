import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Plus, Camera, Loader2, Clock, User,
  MapPin, Tag, Filter, ChevronRight, Save, DollarSign, StickyNote,
} from "lucide-react";

const PRIORITIES = [
  { value: "PILNY", label: "Pilny" },
  { value: "WYSOKI", label: "Wysoki" },
  { value: "NORMALNY", label: "Normalny" },
  { value: "NISKI", label: "Niski" },
];

const STATUSES = [
  { value: "OTWARTE", label: "Otwarte" },
  { value: "W_REALIZACJI", label: "W realizacji" },
  { value: "ROZWIĄZANE", label: "Rozwiązane" },
  { value: "ZAMKNIĘTE", label: "Zamknięte" },
];

const CATEGORIES = [
  { value: "hydraulika", label: "Hydraulika" },
  { value: "elektryka", label: "Elektryka" },
  { value: "AGD", label: "AGD" },
  { value: "meble", label: "Meble" },
  { value: "ogólne", label: "Ogólne" },
  { value: "inne", label: "Inne" },
];

function priorityBadge(priority: string) {
  const map: Record<string, string> = {
    PILNY: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20",
    WYSOKI: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20",
    NORMALNY: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    NISKI: "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20",
  };
  return map[priority] || map.NORMALNY;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    OTWARTE: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    W_REALIZACJI: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
    "ROZWIĄZANE": "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",
    "ZAMKNIĘTE": "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/20",
  };
  return map[status] || map.OTWARTE;
}

function statusLabel(status: string) {
  return STATUSES.find(s => s.value === status)?.label || status;
}

function priorityLabel(priority: string) {
  return PRIORITIES.find(p => p.value === priority)?.label || priority;
}

function categoryLabel(category: string) {
  return CATEGORIES.find(c => c.value === category)?.label || category;
}

type IssueItem = {
  id: number;
  apartmentId: number;
  apartmentName: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  category: string;
  reportedBy: string;
  assignedTo: string | null;
  photoUrls: string[] | null;
  cost: string | null;
  notes: string | null;
  createdAt: string;
  resolvedAt: string | null;
  updatedAt: string | null;
};

export default function RecepcjaUsterki() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [detailIssue, setDetailIssue] = useState<IssueItem | null>(null);

  const { data: issues = [], isLoading } = useQuery<IssueItem[]>({
    queryKey: ["/api/recepcja/issues"],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", "/api/recepcja/issues");
      return r.json();
    },
  });

  const { data: apartments = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/recepcja/apartments"],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", "/api/recepcja/apartments");
      return r.json();
    },
  });

  const { data: employees = [] } = useQuery<{ id: number; firstName: string; lastName: string; position: string }[]>({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", "/api/recepcja/rcp/employees");
      return r.json();
    },
  });

  const filtered = issues.filter(i => {
    if (filterStatus !== "all" && i.status !== filterStatus) return false;
    if (filterPriority !== "all" && i.priority !== filterPriority) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-usterki-title">Usterki</h1>
          <Badge variant="secondary" data-testid="badge-usterki-count">{issues.length}</Badge>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-issue">
              <Plus className="h-4 w-4 mr-1" />
              Zgłoś usterkę
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nowe zgłoszenie usterki</DialogTitle>
            </DialogHeader>
            <AddIssueForm
              apartments={apartments}
              onSuccess={() => {
                setAddOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/recepcja/issues"] });
                toast({ title: "Zgłoszenie dodane" });
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            {STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-priority">
            <SelectValue placeholder="Priorytet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie priorytety</SelectItem>
            {PRIORITIES.map(p => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground" data-testid="text-no-issues">
          Brak zgłoszeń usterek
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(issue => (
            <Card
              key={issue.id}
              className="p-4 cursor-pointer hover-elevate"
              onClick={() => setDetailIssue(issue)}
              data-testid={`card-issue-${issue.id}`}
            >
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm" data-testid={`text-issue-title-${issue.id}`}>{issue.title}</span>
                    <Badge className={priorityBadge(issue.priority)} data-testid={`badge-priority-${issue.id}`}>
                      {priorityLabel(issue.priority)}
                    </Badge>
                    <Badge className={statusBadge(issue.status)} data-testid={`badge-status-${issue.id}`}>
                      {statusLabel(issue.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {issue.apartmentName || `Apt #${issue.apartmentId}`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {categoryLabel(issue.category)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(issue.createdAt).toLocaleDateString("pl-PL")}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!detailIssue} onOpenChange={(o) => { if (!o) setDetailIssue(null); }}>
        <SheetContent className="overflow-y-auto">
          {detailIssue && (
            <IssueDetail
              issue={detailIssue}
              employees={employees}
              onUpdated={(updated) => {
                setDetailIssue({ ...detailIssue, ...updated });
                queryClient.invalidateQueries({ queryKey: ["/api/recepcja/issues"] });
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AddIssueForm({ apartments, onSuccess }: {
  apartments: { id: number; name: string }[];
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [apartmentId, setApartmentId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMALNY");
  const [category, setCategory] = useState("ogólne");
  const [files, setFiles] = useState<File[]>([]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await recepcjaFetch("POST", "/api/recepcja/issues", {
        apartmentId: Number(apartmentId),
        title,
        description: description || null,
        priority,
        category,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Błąd");
      }
      const issue = await res.json();

      if (files.length > 0) {
        const formData = new FormData();
        files.forEach(f => formData.append("photos", f));
        const token = localStorage.getItem("recepcja_token");
        const photoRes = await fetch(`/api/recepcja/issues/${issue.id}/photos`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        if (!photoRes.ok) {
          console.error("Photo upload failed");
        }
      }
      return issue;
    },
    onSuccess: () => onSuccess(),
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const canSubmit = apartmentId && title.trim();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Apartament</Label>
        <Select value={apartmentId} onValueChange={setApartmentId}>
          <SelectTrigger data-testid="select-issue-apartment">
            <SelectValue placeholder="Wybierz apartament" />
          </SelectTrigger>
          <SelectContent>
            {apartments.map(a => (
              <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Tytuł</Label>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Np. Cieknący kran w łazience"
          data-testid="input-issue-title"
        />
      </div>

      <div className="space-y-2">
        <Label>Opis</Label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Szczegółowy opis usterki..."
          className="resize-none"
          data-testid="input-issue-description"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1 space-y-2">
          <Label>Priorytet</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger data-testid="select-issue-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-2">
          <Label>Kategoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger data-testid="select-issue-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Zdjęcia</Label>
        <div
          className="border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-primary transition-colors"
          onClick={() => fileRef.current?.click()}
          data-testid="dropzone-issue-photos"
        >
          <Camera className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Kliknij aby dodać zdjęcia (max 5)</p>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept="image/*"
            onChange={e => {
              if (e.target.files) setFiles(Array.from(e.target.files).slice(0, 5));
            }}
          />
        </div>
        {files.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {files.map((f, i) => (
              <Badge key={i} variant="secondary">{f.name}</Badge>
            ))}
          </div>
        )}
      </div>

      <Button
        className="w-full"
        disabled={!canSubmit || createMutation.isPending}
        onClick={() => createMutation.mutate()}
        data-testid="button-submit-issue"
      >
        {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
        Zgłoś usterkę
      </Button>
    </div>
  );
}

function IssueDetail({ issue, employees, onUpdated }: {
  issue: IssueItem;
  employees: { id: number; firstName: string; lastName: string; position: string }[];
  onUpdated: (updated: Partial<IssueItem>) => void;
}) {
  const { toast } = useToast();
  const [editStatus, setEditStatus] = useState(issue.status);
  const [editAssignedTo, setEditAssignedTo] = useState(issue.assignedTo || "");
  const [editNotes, setEditNotes] = useState(issue.notes || "");
  const [editCost, setEditCost] = useState(issue.cost || "");
  const [dirty, setDirty] = useState(false);

  const konserwators = employees.filter(e => ["KONSERWATOR", "OSOBA_SPRZATAJACA", "PRACOWNIK_RECEPCJI"].includes(e.position));

  const updateMutation = useMutation({
    mutationFn: async () => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/issues/${issue.id}`, {
        status: editStatus,
        assignedTo: editAssignedTo || null,
        notes: editNotes || null,
        cost: editCost || null,
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: (updated: IssueItem) => {
      toast({ title: "Zapisano zmiany" });
      setDirty(false);
      onUpdated(updated);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const handleChange = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    setDirty(true);
  };

  return (
    <div className="space-y-5">
      <SheetHeader>
        <SheetTitle data-testid="text-issue-detail-title">{issue.title}</SheetTitle>
      </SheetHeader>

      <div className="flex items-center gap-2 flex-wrap">
        <Badge className={priorityBadge(issue.priority)}>{priorityLabel(issue.priority)}</Badge>
        <Badge className={statusBadge(editStatus)}>{statusLabel(editStatus)}</Badge>
        <Badge variant="outline">{categoryLabel(issue.category)}</Badge>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{issue.apartmentName || `Apartament #${issue.apartmentId}`}</span>
        </div>
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>Zgłosił: {issue.reportedBy}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>Utworzono: {new Date(issue.createdAt).toLocaleString("pl-PL")}</span>
        </div>
        {issue.resolvedAt && (
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>Rozwiązano: {new Date(issue.resolvedAt).toLocaleString("pl-PL")}</span>
          </div>
        )}
      </div>

      {issue.description && (
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Opis</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-issue-description">{issue.description}</p>
        </div>
      )}

      <div className="space-y-3 border-t pt-4">
        <h4 className="text-sm font-semibold">Zarządzanie</h4>

        <div className="space-y-1.5">
          <Label className="text-xs">Status</Label>
          <Select value={editStatus} onValueChange={handleChange(setEditStatus)}>
            <SelectTrigger className="h-8 text-sm" data-testid="select-detail-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><User className="h-3 w-3" />Przypisz do</Label>
          <Select value={editAssignedTo || "none"} onValueChange={v => handleChange(setEditAssignedTo)(v === "none" ? "" : v)}>
            <SelectTrigger className="h-8 text-sm" data-testid="select-detail-assigned">
              <SelectValue placeholder="Nieprzypisana" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nieprzypisana</SelectItem>
              {konserwators.map(e => (
                <SelectItem key={e.id} value={`${e.firstName} ${e.lastName}`}>{e.firstName} {e.lastName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><DollarSign className="h-3 w-3" />Koszt naprawy (zł)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={editCost}
            onChange={e => handleChange(setEditCost)(e.target.value)}
            className="h-8 text-sm"
            placeholder="np. 150.00"
            data-testid="input-detail-cost"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1"><StickyNote className="h-3 w-3" />Notatki</Label>
          <Textarea
            value={editNotes}
            onChange={e => handleChange(setEditNotes)(e.target.value)}
            className="text-sm resize-none"
            rows={3}
            placeholder="Uwagi, postęp prac..."
            data-testid="input-detail-notes"
          />
        </div>

        {dirty && (
          <Button className="w-full" size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-issue">
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Zapisz zmiany
          </Button>
        )}
      </div>

      {issue.photoUrls && issue.photoUrls.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Zdjęcia ({issue.photoUrls.length})</h4>
          <div className="grid grid-cols-2 gap-2">
            {issue.photoUrls.map((url, i) => (
              <div key={i} className="rounded-md overflow-hidden border bg-muted aspect-square flex items-center justify-center">
                <img
                  src={`/api/objects/${url}`}
                  alt={`Zdjęcie ${i + 1}`}
                  className="object-cover w-full h-full"
                  data-testid={`img-issue-photo-${i}`}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-medium">Historia</h4>
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{issue.reportedBy}</span> zgłosił usterkę — {new Date(issue.createdAt).toLocaleString("pl-PL")}
            </div>
          </div>
          {issue.status !== "OTWARTE" && issue.updatedAt && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Status zmieniony na <span className="font-medium text-foreground">{statusLabel(editStatus)}</span> — {new Date(issue.updatedAt).toLocaleString("pl-PL")}
              </div>
            </div>
          )}
          {issue.resolvedAt && (
            <div className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 shrink-0" />
              <div className="text-xs text-muted-foreground">
                Rozwiązano — {new Date(issue.resolvedAt).toLocaleString("pl-PL")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
