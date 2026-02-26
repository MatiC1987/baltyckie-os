import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Issue, Apartment } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Wrench,
  Search,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type IssueWithApartment = Issue & { apartmentName?: string };

const PRIORITY_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PILNY: { label: "Pilny", variant: "destructive" },
  WYSOKI: { label: "Wysoki", variant: "default" },
  NORMALNY: { label: "Normalny", variant: "secondary" },
  NISKI: { label: "Niski", variant: "outline" },
};

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  OTWARTE: { label: "Otwarte", variant: "destructive" },
  W_REALIZACJI: { label: "W realizacji", variant: "default" },
  "ROZWIĄZANE": { label: "Rozwiązane", variant: "secondary" },
  "ZAMKNIĘTE": { label: "Zamknięte", variant: "outline" },
};

const CATEGORY_LABELS: Record<string, string> = {
  hydraulika: "Hydraulika",
  elektryka: "Elektryka",
  AGD: "AGD",
  meble: "Meble",
  "ogólne": "Ogólne",
  inne: "Inne",
};

function getPriorityBadge(priority: string) {
  const info = PRIORITY_MAP[priority] || { label: priority, variant: "outline" as const };
  return <Badge variant={info.variant} data-testid={`badge-priority-${priority}`}>{info.label}</Badge>;
}

function getStatusBadge(status: string) {
  const info = STATUS_MAP[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant} data-testid={`badge-status-${status}`}>{info.label}</Badge>;
}

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function Usterki() {
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterApartment, setFilterApartment] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIssue, setSelectedIssue] = useState<IssueWithApartment | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const { data: issues, isLoading } = useQuery<IssueWithApartment[]>({
    queryKey: ["/api/issues"],
  });

  const { data: apartments } = useQuery<Apartment[]>({
    queryKey: ["/api/apartments"],
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PUT", `/api/issues/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      toast({ title: "Zgłoszenie zaktualizowane" });
      setSheetOpen(false);
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się zaktualizować zgłoszenia", variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/issues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/issues"] });
      toast({ title: "Zgłoszenie usunięte" });
      setSheetOpen(false);
      setSelectedIssue(null);
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się usunąć zgłoszenia", variant: "destructive" });
    },
  });

  const openIssue = (issue: IssueWithApartment) => {
    setSelectedIssue(issue);
    setEditStatus(issue.status);
    setEditPriority(issue.priority);
    setEditAssignedTo(issue.assignedTo || "");
    setEditCost(issue.cost || "");
    setEditNotes(issue.notes || "");
    setSheetOpen(true);
  };

  const handleSave = () => {
    if (!selectedIssue) return;
    updateMut.mutate({
      id: selectedIssue.id,
      data: {
        status: editStatus,
        priority: editPriority,
        assignedTo: editAssignedTo || null,
        cost: editCost || null,
        notes: editNotes || null,
      },
    });
  };

  const filtered = (issues || []).filter((issue) => {
    if (filterStatus !== "all" && issue.status !== filterStatus) return false;
    if (filterPriority !== "all" && issue.priority !== filterPriority) return false;
    if (filterApartment !== "all" && String(issue.apartmentId) !== filterApartment) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !issue.title.toLowerCase().includes(q) &&
        !(issue.description || "").toLowerCase().includes(q) &&
        !(issue.apartmentName || "").toLowerCase().includes(q) &&
        !(issue.reportedBy || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const openCount = (issues || []).filter(i => i.status === "OTWARTE" || i.status === "W_REALIZACJI").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usterki"
        description="Zarządzanie zgłoszeniami usterek w apartamentach"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Otwarte zgłoszenia</p>
              <p className="text-2xl font-bold" data-testid="text-open-issues-count">{openCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-amber-500/10">
              <Wrench className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">W realizacji</p>
              <p className="text-2xl font-bold" data-testid="text-in-progress-count">
                {(issues || []).filter(i => i.status === "W_REALIZACJI").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-emerald-500/10">
              <AlertTriangle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wszystkie</p>
              <p className="text-2xl font-bold" data-testid="text-total-issues-count">{(issues || []).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-issues"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            <SelectItem value="OTWARTE">Otwarte</SelectItem>
            <SelectItem value="W_REALIZACJI">W realizacji</SelectItem>
            <SelectItem value="ROZWIĄZANE">Rozwiązane</SelectItem>
            <SelectItem value="ZAMKNIĘTE">Zamknięte</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-priority">
            <SelectValue placeholder="Priorytet" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie priorytety</SelectItem>
            <SelectItem value="PILNY">Pilny</SelectItem>
            <SelectItem value="WYSOKI">Wysoki</SelectItem>
            <SelectItem value="NORMALNY">Normalny</SelectItem>
            <SelectItem value="NISKI">Niski</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterApartment} onValueChange={setFilterApartment}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-apartment">
            <SelectValue placeholder="Apartament" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie apartamenty</SelectItem>
            {(apartments || []).map((apt) => (
              <SelectItem key={apt.id} value={String(apt.id)}>{apt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterStatus !== "all" || filterPriority !== "all" || filterApartment !== "all" || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterStatus("all");
              setFilterPriority("all");
              setFilterApartment("all");
              setSearchQuery("");
            }}
            data-testid="button-clear-filters"
          >
            <X className="h-4 w-4 mr-1" /> Wyczyść filtry
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Apartament</TableHead>
                  <TableHead>Tytuł</TableHead>
                  <TableHead>Priorytet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kategoria</TableHead>
                  <TableHead>Zgłosił</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Koszt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((issue) => (
                  <TableRow
                    key={issue.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => openIssue(issue)}
                    data-testid={`row-issue-${issue.id}`}
                  >
                    <TableCell className="font-medium text-sm">{issue.apartmentName || `#${issue.apartmentId}`}</TableCell>
                    <TableCell className="text-sm">{issue.title}</TableCell>
                    <TableCell>{getPriorityBadge(issue.priority)}</TableCell>
                    <TableCell>{getStatusBadge(issue.status)}</TableCell>
                    <TableCell className="text-sm">{CATEGORY_LABELS[issue.category] || issue.category}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{issue.reportedBy}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(issue.createdAt)}</TableCell>
                    <TableCell className="text-sm">{issue.cost ? `${issue.cost} zł` : "—"}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Brak zgłoszeń
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedIssue && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedIssue.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Apartament</p>
                    <p className="text-sm font-medium" data-testid="text-detail-apartment">
                      {selectedIssue.apartmentName || `#${selectedIssue.apartmentId}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Kategoria</p>
                    <p className="text-sm font-medium" data-testid="text-detail-category">
                      {CATEGORY_LABELS[selectedIssue.category] || selectedIssue.category}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Zgłosił</p>
                    <p className="text-sm font-medium" data-testid="text-detail-reported-by">{selectedIssue.reportedBy}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Data zgłoszenia</p>
                    <p className="text-sm font-medium" data-testid="text-detail-date">{formatDate(selectedIssue.createdAt)}</p>
                  </div>
                </div>

                {selectedIssue.description && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Opis</p>
                    <p className="text-sm" data-testid="text-detail-description">{selectedIssue.description}</p>
                  </div>
                )}

                {selectedIssue.photoUrls && selectedIssue.photoUrls.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                      <ImageIcon className="h-4 w-4" /> Zdjęcia ({selectedIssue.photoUrls.length})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedIssue.photoUrls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={url}
                            alt={`Zdjęcie ${idx + 1}`}
                            className="rounded-md w-full h-32 object-cover"
                            data-testid={`img-issue-photo-${idx}`}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3 pt-4 border-t">
                  <p className="text-sm font-semibold">Zarządzanie</p>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger data-testid="select-edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OTWARTE">Otwarte</SelectItem>
                        <SelectItem value="W_REALIZACJI">W realizacji</SelectItem>
                        <SelectItem value="ROZWIĄZANE">Rozwiązane</SelectItem>
                        <SelectItem value="ZAMKNIĘTE">Zamknięte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Priorytet</p>
                    <Select value={editPriority} onValueChange={setEditPriority}>
                      <SelectTrigger data-testid="select-edit-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PILNY">Pilny</SelectItem>
                        <SelectItem value="WYSOKI">Wysoki</SelectItem>
                        <SelectItem value="NORMALNY">Normalny</SelectItem>
                        <SelectItem value="NISKI">Niski</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Przypisany do</p>
                    <Input
                      value={editAssignedTo}
                      onChange={(e) => setEditAssignedTo(e.target.value)}
                      placeholder="Imię i nazwisko"
                      data-testid="input-edit-assigned-to"
                    />
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Koszt naprawy (zł)</p>
                    <Input
                      type="number"
                      step="0.01"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                      placeholder="0.00"
                      data-testid="input-edit-cost"
                    />
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notatki</p>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Notatki admina..."
                      className="resize-none"
                      data-testid="textarea-edit-notes"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={updateMut.isPending}
                      data-testid="button-save-issue"
                    >
                      Zapisz zmiany
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (selectedIssue) deleteMut.mutate(selectedIssue.id);
                      }}
                      disabled={deleteMut.isPending}
                      data-testid="button-delete-issue"
                    >
                      Usuń
                    </Button>
                  </div>
                </div>

                {selectedIssue.resolvedAt && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground">
                      Rozwiązano: {formatDate(selectedIssue.resolvedAt)}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
