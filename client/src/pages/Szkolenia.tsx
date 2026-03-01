import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Employee, EmployeeTraining } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  GraduationCap,
  Plus,
  Search,
  X,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { TablePageSkeleton } from "@/components/PageSkeleton";

type TrainingWithStatus = EmployeeTraining & {
  status: string;
  employeeName: string;
};

const TRAINING_TYPES: Record<string, string> = {
  BHP: "BHP",
  PPO: "PPO",
  PIERWSZA_POMOC: "Pierwsza pomoc",
  HACCP: "HACCP",
  RODO: "RODO",
  INNE: "Inne",
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  AKTUALNE: { label: "Aktualne", variant: "default" },
  "WYGASAJĄCE": { label: "Wygasające", variant: "secondary" },
  "WYGASŁE": { label: "Wygasłe", variant: "destructive" },
};

function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getStatusBadge(status: string) {
  const info = STATUS_CONFIG[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant} data-testid={`badge-training-status-${status}`}>{info.label}</Badge>;
}

const emptyForm = {
  employeeId: "",
  name: "",
  type: "BHP",
  provider: "",
  completedDate: "",
  expiryDate: "",
  certificateNumber: "",
  notes: "",
};

export { Szkolenia };
export default function Szkolenia() {
  const { toast } = useToast();
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<TrainingWithStatus | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState<TrainingWithStatus | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: trainings, isLoading } = useQuery<TrainingWithStatus[]>({
    queryKey: ["/api/employee-trainings"],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: expiringTrainings } = useQuery<TrainingWithStatus[]>({
    queryKey: ["/api/employee-trainings/expiring"],
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/employee-trainings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-trainings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-trainings/expiring"] });
      toast({ title: "Szkolenie zostało dodane" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać szkolenia", variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PUT", `/api/employee-trainings/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-trainings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-trainings/expiring"] });
      toast({ title: "Szkolenie zostało zaktualizowane" });
      closeDialog();
      setSheetOpen(false);
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się zaktualizować szkolenia", variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/employee-trainings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-trainings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-trainings/expiring"] });
      toast({ title: "Szkolenie zostało usunięte" });
      setSheetOpen(false);
      setSelectedTraining(null);
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się usunąć szkolenia", variant: "destructive" });
    },
  });

  function openAdd() {
    setEditingTraining(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(training: TrainingWithStatus) {
    setEditingTraining(training);
    setForm({
      employeeId: String(training.employeeId),
      name: training.name,
      type: training.type,
      provider: training.provider || "",
      completedDate: training.completedDate || "",
      expiryDate: training.expiryDate || "",
      certificateNumber: training.certificateNumber || "",
      notes: training.notes || "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingTraining(null);
    setForm({ ...emptyForm });
  }

  function openDetail(training: TrainingWithStatus) {
    setSelectedTraining(training);
    setSheetOpen(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId || !form.name || !form.completedDate) {
      toast({ title: "Błąd", description: "Pracownik, nazwa szkolenia i data ukończenia są wymagane", variant: "destructive" });
      return;
    }

    const data = {
      employeeId: Number(form.employeeId),
      name: form.name,
      type: form.type,
      provider: form.provider || null,
      completedDate: form.completedDate,
      expiryDate: form.expiryDate || null,
      certificateNumber: form.certificateNumber || null,
      notes: form.notes || null,
    };

    if (editingTraining) {
      updateMut.mutate({ id: editingTraining.id, data });
    } else {
      createMut.mutate(data);
    }
  }

  function setField(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const filtered = (trainings || []).filter((t) => {
    if (filterType !== "all" && t.type !== filterType) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterEmployee !== "all" && String(t.employeeId) !== filterEmployee) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !t.name.toLowerCase().includes(q) &&
        !t.employeeName.toLowerCase().includes(q) &&
        !(t.provider || "").toLowerCase().includes(q) &&
        !(t.certificateNumber || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const expiringCount = (expiringTrainings || []).filter(t => t.status === "WYGASAJĄCE").length;
  const expiredCount = (expiringTrainings || []).filter(t => t.status === "WYGASŁE").length;

  if (isLoading) return <TablePageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openAdd} data-testid="button-add-training">
          <Plus className="mr-2 h-4 w-4" /> Dodaj szkolenie
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wszystkie szkolenia</p>
              <p className="text-2xl font-bold" data-testid="text-total-trainings">{(trainings || []).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wygasające</p>
              <p className="text-2xl font-bold" data-testid="text-expiring-trainings">{expiringCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wygasłe</p>
              <p className="text-2xl font-bold" data-testid="text-expired-trainings">{expiredCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {(expiringTrainings || []).length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-sm text-amber-700 dark:text-amber-300">Szkolenia wymagające uwagi</span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {(expiringTrainings || []).map(t => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 text-sm cursor-pointer p-1 rounded-md hover-elevate"
                  onClick={() => openDetail(t)}
                  data-testid={`alert-training-${t.id}`}
                >
                  <span className="font-medium">{t.employeeName}</span>
                  <span className="text-muted-foreground">{t.name}</span>
                  {getStatusBadge(t.status)}
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(t.expiryDate)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-trainings"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
            <SelectValue placeholder="Typ szkolenia" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie typy</SelectItem>
            {Object.entries(TRAINING_TYPES).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            <SelectItem value="AKTUALNE">Aktualne</SelectItem>
            <SelectItem value="WYGASAJĄCE">Wygasające</SelectItem>
            <SelectItem value="WYGASŁE">Wygasłe</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-employee">
            <SelectValue placeholder="Pracownik" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy pracownicy</SelectItem>
            {(employees || []).map(emp => (
              <SelectItem key={emp.id} value={String(emp.id)}>
                {emp.firstName} {emp.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterType !== "all" || filterStatus !== "all" || filterEmployee !== "all" || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterType("all");
              setFilterStatus("all");
              setFilterEmployee("all");
              setSearchQuery("");
            }}
            data-testid="button-clear-filters"
          >
            <X className="h-4 w-4 mr-1" /> Wyczyść filtry
          </Button>
        )}
      </div>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState
          icon={GraduationCap}
          title="Brak szkoleń"
          description="Dodaj pierwsze szkolenie pracownika."
          actionLabel="Dodaj szkolenie"
          onAction={openAdd}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pracownik</TableHead>
                  <TableHead>Szkolenie</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Data ukończenia</TableHead>
                  <TableHead>Data wygaśnięcia</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Certyfikat</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover-elevate"
                    onClick={() => openDetail(t)}
                    data-testid={`row-training-${t.id}`}
                  >
                    <TableCell className="font-medium text-sm">{t.employeeName}</TableCell>
                    <TableCell className="text-sm">{t.name}</TableCell>
                    <TableCell className="text-sm">{TRAINING_TYPES[t.type] || t.type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(t.completedDate)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDate(t.expiryDate)}</TableCell>
                    <TableCell>{getStatusBadge(t.status)}</TableCell>
                    <TableCell className="text-sm">
                      {t.certificateNumber ? (
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                          {t.certificateNumber}
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingTraining ? "Edytuj szkolenie" : "Dodaj szkolenie"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Pracownik</Label>
              <Select value={form.employeeId} onValueChange={(v) => setField("employeeId", v)}>
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Wybierz pracownika" />
                </SelectTrigger>
                <SelectContent>
                  {(employees || []).map(emp => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.firstName} {emp.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nazwa szkolenia</Label>
              <Input
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
                placeholder="np. Szkolenie BHP wstępne"
                required
                data-testid="input-training-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Typ szkolenia</Label>
                <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                  <SelectTrigger data-testid="select-training-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRAINING_TYPES).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Organizator</Label>
                <Input
                  value={form.provider}
                  onChange={(e) => setField("provider", e.target.value)}
                  placeholder="Nazwa organizatora"
                  data-testid="input-provider"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data ukończenia</Label>
                <Input
                  type="date"
                  value={form.completedDate}
                  onChange={(e) => setField("completedDate", e.target.value)}
                  required
                  data-testid="input-completed-date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data wygaśnięcia</Label>
                <Input
                  type="date"
                  value={form.expiryDate}
                  onChange={(e) => setField("expiryDate", e.target.value)}
                  data-testid="input-expiry-date"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Numer certyfikatu</Label>
              <Input
                value={form.certificateNumber}
                onChange={(e) => setField("certificateNumber", e.target.value)}
                placeholder="Nr certyfikatu"
                data-testid="input-certificate-number"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Notatki</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Dodatkowe informacje..."
                className="resize-none"
                data-testid="textarea-notes"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending} data-testid="button-submit-training">
                {editingTraining ? "Zapisz zmiany" : "Dodaj szkolenie"}
              </Button>
              <Button type="button" variant="outline" onClick={closeDialog} data-testid="button-cancel-training">
                Anuluj
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedTraining && (
            <>
              <SheetHeader>
                <SheetTitle data-testid="text-detail-title">{selectedTraining.name}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pracownik</p>
                    <p className="text-sm font-medium" data-testid="text-detail-employee">{selectedTraining.employeeName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Typ</p>
                    <p className="text-sm font-medium" data-testid="text-detail-type">{TRAINING_TYPES[selectedTraining.type] || selectedTraining.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Organizator</p>
                    <p className="text-sm font-medium" data-testid="text-detail-provider">{selectedTraining.provider || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <div data-testid="text-detail-status">{getStatusBadge(selectedTraining.status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Data ukończenia</p>
                    <p className="text-sm font-medium" data-testid="text-detail-completed">{formatDate(selectedTraining.completedDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Data wygaśnięcia</p>
                    <p className="text-sm font-medium" data-testid="text-detail-expiry">{formatDate(selectedTraining.expiryDate)}</p>
                  </div>
                </div>

                {selectedTraining.certificateNumber && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Numer certyfikatu</p>
                    <p className="text-sm font-medium flex items-center gap-1" data-testid="text-detail-certificate">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {selectedTraining.certificateNumber}
                    </p>
                  </div>
                )}

                {selectedTraining.certificateFileUrl && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Skan certyfikatu</p>
                    <a
                      href={selectedTraining.certificateFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 underline"
                      data-testid="link-certificate-file"
                    >
                      Otwórz plik
                    </a>
                  </div>
                )}

                {selectedTraining.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notatki</p>
                    <p className="text-sm" data-testid="text-detail-notes">{selectedTraining.notes}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-4 border-t">
                  <Button
                    onClick={() => {
                      setSheetOpen(false);
                      openEdit(selectedTraining);
                    }}
                    data-testid="button-edit-training"
                  >
                    Edytuj
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMut.mutate(selectedTraining.id)}
                    disabled={deleteMut.isPending}
                    data-testid="button-delete-training"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Usuń
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
