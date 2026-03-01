import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { EmployeeContract, Employee } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  FileCheck,
  Plus,
  Search,
  X,
  Download,
  Pencil,
  Trash2,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
} from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { TablePageSkeleton } from "@/components/PageSkeleton";

type ContractWithEmployee = EmployeeContract & {
  employeeName?: string;
  computedStatus?: string;
};

const TYPE_LABELS: Record<string, string> = {
  UMOWA_O_PRACE: "Umowa o pracę",
  UMOWA_ZLECENIE: "Umowa zlecenie",
  UMOWA_O_DZIELO: "Umowa o dzieło",
  ANEKS: "Aneks",
  WYPOWIEDZENIE: "Wypowiedzenie",
};

const STATUS_LABELS: Record<string, string> = {
  AKTYWNA: "Aktywna",
  "ZAKOŃCZONA": "Zakończona",
  WYPOWIEDZIANA: "Wypowiedziana",
  "KOŃCZĄCA_SIĘ": "Kończąca się",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  AKTYWNA: "default",
  "ZAKOŃCZONA": "secondary",
  WYPOWIEDZIANA: "destructive",
  "KOŃCZĄCA_SIĘ": "outline",
};

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCurrency(val: string | null | undefined): string {
  if (!val) return "—";
  return `${Number(val).toFixed(2)} zł`;
}

const emptyForm = {
  employeeId: "",
  type: "UMOWA_O_PRACE",
  title: "",
  startDate: "",
  endDate: "",
  salary: "",
  hourlyRate: "",
  position: "",
  workHours: "",
  trialPeriod: false,
  trialEndDate: "",
  signedDate: "",
  status: "AKTYWNA",
  notes: "",
};

export { UmowyPracownicze };
export default function UmowyPracownicze() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractWithEmployee | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<ContractWithEmployee | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: contracts, isLoading } = useQuery<ContractWithEmployee[]>({
    queryKey: ["/api/employee-contracts"],
  });

  const { data: expiringContracts } = useQuery<ContractWithEmployee[]>({
    queryKey: ["/api/employee-contracts/expiring"],
  });

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/employee-contracts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-contracts/expiring"] });
      toast({ title: "Umowa została dodana" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać umowy", variant: "destructive" });
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PUT", `/api/employee-contracts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-contracts/expiring"] });
      toast({ title: "Umowa została zaktualizowana" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się zaktualizować umowy", variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/employee-contracts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employee-contracts/expiring"] });
      toast({ title: "Umowa została usunięta" });
      setSheetOpen(false);
      setSelectedContract(null);
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się usunąć umowy", variant: "destructive" });
    },
  });

  function openAdd() {
    setEditingContract(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(contract: ContractWithEmployee) {
    setEditingContract(contract);
    setForm({
      employeeId: String(contract.employeeId),
      type: contract.type,
      title: contract.title,
      startDate: contract.startDate,
      endDate: contract.endDate || "",
      salary: contract.salary || "",
      hourlyRate: contract.hourlyRate || "",
      position: contract.position || "",
      workHours: contract.workHours || "",
      trialPeriod: contract.trialPeriod || false,
      trialEndDate: contract.trialEndDate || "",
      signedDate: contract.signedDate || "",
      status: contract.status,
      notes: contract.notes || "",
    });
    setDialogOpen(true);
  }

  function openDetails(contract: ContractWithEmployee) {
    setSelectedContract(contract);
    setSheetOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingContract(null);
    setForm({ ...emptyForm });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId || !form.title || !form.startDate) {
      toast({ title: "Błąd", description: "Pracownik, tytuł i data rozpoczęcia są wymagane", variant: "destructive" });
      return;
    }

    const payload = {
      employeeId: Number(form.employeeId),
      type: form.type,
      title: form.title,
      startDate: form.startDate,
      endDate: form.endDate || null,
      salary: form.salary || null,
      hourlyRate: form.hourlyRate || null,
      position: form.position || null,
      workHours: form.workHours || null,
      trialPeriod: form.trialPeriod,
      trialEndDate: form.trialPeriod ? (form.trialEndDate || null) : null,
      signedDate: form.signedDate || null,
      status: form.status,
      notes: form.notes || null,
    };

    if (editingContract) {
      updateMut.mutate({ id: editingContract.id, data: payload });
    } else {
      createMut.mutate(payload);
    }
  }

  function handleGeneratePdf(contractId: number) {
    window.open(`/api/employee-contracts/${contractId}/generate-pdf`, "_blank");
  }

  function setField(field: string, value: any) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const filtered = (contracts || []).filter((c) => {
    if (filterType !== "all" && c.type !== filterType) return false;
    const displayStatus = c.computedStatus || c.status;
    if (filterStatus !== "all" && displayStatus !== filterStatus) return false;
    if (filterEmployee !== "all" && String(c.employeeId) !== filterEmployee) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !c.title.toLowerCase().includes(q) &&
        !(c.employeeName || "").toLowerCase().includes(q) &&
        !(c.position || "").toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const activeCount = (contracts || []).filter(c => (c.computedStatus || c.status) === "AKTYWNA").length;
  const expiringCount = (expiringContracts || []).length;

  const uniqueEmployees = new Map<number, string>();
  (contracts || []).forEach(c => {
    if (c.employeeName) uniqueEmployees.set(c.employeeId, c.employeeName);
  });

  if (isLoading) return <TablePageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <Button onClick={openAdd} data-testid="button-add-contract">
          <Plus className="mr-2 h-4 w-4" /> Dodaj umowę
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-emerald-500/10">
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aktywne umowy</p>
              <p className="text-2xl font-bold" data-testid="text-active-contracts-count">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kończące się wkrótce</p>
              <p className="text-2xl font-bold" data-testid="text-expiring-contracts-count">{expiringCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Wszystkie umowy</p>
              <p className="text-2xl font-bold" data-testid="text-total-contracts-count">{(contracts || []).length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {expiringCount > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="font-semibold text-sm text-amber-700 dark:text-amber-300">
                {expiringCount} {expiringCount === 1 ? "umowa wygasa" : "umów wygasa"} w ciągu 30 dni
              </span>
            </div>
            <div className="space-y-1">
              {(expiringContracts || []).map(c => (
                <div key={c.id} className="flex items-center gap-3 text-sm" data-testid={`expiring-contract-${c.id}`}>
                  <span className="font-medium">{c.employeeName}</span>
                  <span className="text-muted-foreground">{c.title}</span>
                  <Badge variant="outline" className="text-xs">do {formatDate(c.endDate)}</Badge>
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
            data-testid="input-search-contracts"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
            <SelectValue placeholder="Typ umowy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie typy</SelectItem>
            <SelectItem value="UMOWA_O_PRACE">Umowa o pracę</SelectItem>
            <SelectItem value="UMOWA_ZLECENIE">Umowa zlecenie</SelectItem>
            <SelectItem value="UMOWA_O_DZIELO">Umowa o dzieło</SelectItem>
            <SelectItem value="ANEKS">Aneks</SelectItem>
            <SelectItem value="WYPOWIEDZENIE">Wypowiedzenie</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie statusy</SelectItem>
            <SelectItem value="AKTYWNA">Aktywna</SelectItem>
            <SelectItem value="ZAKOŃCZONA">Zakończona</SelectItem>
            <SelectItem value="WYPOWIEDZIANA">Wypowiedziana</SelectItem>
            <SelectItem value="KOŃCZĄCA_SIĘ">Kończąca się</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-employee">
            <SelectValue placeholder="Pracownik" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy pracownicy</SelectItem>
            {Array.from(uniqueEmployees.entries()).map(([id, name]) => (
              <SelectItem key={id} value={String(id)}>{name}</SelectItem>
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

      {contracts && contracts.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="Brak umów pracowniczych"
          description="Dodaj pierwszą umowę pracowniczą."
          actionLabel="Dodaj umowę"
          onAction={openAdd}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pracownik</TableHead>
                  <TableHead>Typ umowy</TableHead>
                  <TableHead>Tytuł</TableHead>
                  <TableHead>Okres</TableHead>
                  <TableHead>Wynagrodzenie</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-28">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((contract) => {
                  const displayStatus = contract.computedStatus || contract.status;
                  return (
                    <TableRow
                      key={contract.id}
                      className="cursor-pointer hover-elevate"
                      onClick={() => openDetails(contract)}
                      data-testid={`row-contract-${contract.id}`}
                    >
                      <TableCell className="font-medium text-sm">{contract.employeeName || "—"}</TableCell>
                      <TableCell className="text-sm">{TYPE_LABELS[contract.type] || contract.type}</TableCell>
                      <TableCell className="text-sm">{contract.title}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(contract.startDate)} — {formatDate(contract.endDate)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {contract.salary ? formatCurrency(contract.salary) : contract.hourlyRate ? `${Number(contract.hourlyRate).toFixed(2)} zł/h` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={STATUS_VARIANTS[displayStatus] || "outline"}
                          data-testid={`badge-status-${contract.id}`}
                        >
                          {STATUS_LABELS[displayStatus] || displayStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(contract)}
                            data-testid={`button-edit-contract-${contract.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleGeneratePdf(contract.id)}
                            data-testid={`button-pdf-contract-${contract.id}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMut.mutate(contract.id)}
                            data-testid={`button-delete-contract-${contract.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Brak umów spełniających kryteria
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editingContract ? "Edytuj umowę" : "Dodaj umowę pracowniczą"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Pracownik *</Label>
                <Select value={form.employeeId} onValueChange={(v) => setField("employeeId", v)}>
                  <SelectTrigger data-testid="select-form-employee">
                    <SelectValue placeholder="Wybierz pracownika" />
                  </SelectTrigger>
                  <SelectContent>
                    {(employees || []).map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Typ umowy *</Label>
                <Select value={form.type} onValueChange={(v) => setField("type", v)}>
                  <SelectTrigger data-testid="select-form-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UMOWA_O_PRACE">Umowa o pracę</SelectItem>
                    <SelectItem value="UMOWA_ZLECENIE">Umowa zlecenie</SelectItem>
                    <SelectItem value="UMOWA_O_DZIELO">Umowa o dzieło</SelectItem>
                    <SelectItem value="ANEKS">Aneks</SelectItem>
                    <SelectItem value="WYPOWIEDZENIE">Wypowiedzenie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tytuł umowy *</Label>
              <Input
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="np. Umowa o pracę na czas określony"
                data-testid="input-form-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data rozpoczęcia *</Label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setField("startDate", e.target.value)}
                  data-testid="input-form-start-date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data zakończenia</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setField("endDate", e.target.value)}
                  data-testid="input-form-end-date"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stanowisko</Label>
                <Input
                  value={form.position}
                  onChange={(e) => setField("position", e.target.value)}
                  placeholder="np. Pracownik recepcji"
                  data-testid="input-form-position"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Wymiar czasu pracy</Label>
                <Input
                  value={form.workHours}
                  onChange={(e) => setField("workHours", e.target.value)}
                  placeholder="np. Pełny etat"
                  data-testid="input-form-work-hours"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Wynagrodzenie brutto (zł)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.salary}
                  onChange={(e) => setField("salary", e.target.value)}
                  placeholder="0.00"
                  data-testid="input-form-salary"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stawka godzinowa (zł/h)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.hourlyRate}
                  onChange={(e) => setField("hourlyRate", e.target.value)}
                  placeholder="0.00"
                  data-testid="input-form-hourly-rate"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data podpisania</Label>
                <Input
                  type="date"
                  value={form.signedDate}
                  onChange={(e) => setField("signedDate", e.target.value)}
                  data-testid="input-form-signed-date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={(v) => setField("status", v)}>
                  <SelectTrigger data-testid="select-form-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AKTYWNA">Aktywna</SelectItem>
                    <SelectItem value="ZAKOŃCZONA">Zakończona</SelectItem>
                    <SelectItem value="WYPOWIEDZIANA">Wypowiedziana</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.trialPeriod}
                onCheckedChange={(v) => setField("trialPeriod", v)}
                data-testid="switch-trial-period"
              />
              <Label className="text-sm">Okres próbny</Label>
            </div>

            {form.trialPeriod && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data końca okresu próbnego</Label>
                <Input
                  type="date"
                  value={form.trialEndDate}
                  onChange={(e) => setField("trialEndDate", e.target.value)}
                  data-testid="input-form-trial-end-date"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Notatki</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setField("notes", e.target.value)}
                placeholder="Dodatkowe informacje..."
                className="resize-none"
                data-testid="textarea-form-notes"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending} data-testid="button-submit-contract">
                {editingContract ? "Zapisz zmiany" : "Dodaj umowę"}
              </Button>
              <Button type="button" variant="outline" onClick={closeDialog} data-testid="button-cancel-contract">
                Anuluj
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedContract && (
            <>
              <SheetHeader>
                <SheetTitle data-testid="text-sheet-title">{selectedContract.title}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Pracownik</p>
                    <p className="text-sm font-medium" data-testid="text-detail-employee">{selectedContract.employeeName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Typ umowy</p>
                    <p className="text-sm font-medium" data-testid="text-detail-type">{TYPE_LABELS[selectedContract.type] || selectedContract.type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Data rozpoczęcia</p>
                    <p className="text-sm font-medium" data-testid="text-detail-start">{formatDate(selectedContract.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Data zakończenia</p>
                    <p className="text-sm font-medium" data-testid="text-detail-end">{formatDate(selectedContract.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Stanowisko</p>
                    <p className="text-sm font-medium" data-testid="text-detail-position">{selectedContract.position || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Wymiar czasu pracy</p>
                    <p className="text-sm font-medium" data-testid="text-detail-work-hours">{selectedContract.workHours || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Wynagrodzenie brutto</p>
                    <p className="text-sm font-medium" data-testid="text-detail-salary">{formatCurrency(selectedContract.salary)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Stawka godzinowa</p>
                    <p className="text-sm font-medium" data-testid="text-detail-hourly-rate">
                      {selectedContract.hourlyRate ? `${Number(selectedContract.hourlyRate).toFixed(2)} zł/h` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Status</p>
                    <Badge
                      variant={STATUS_VARIANTS[selectedContract.computedStatus || selectedContract.status] || "outline"}
                      data-testid="badge-detail-status"
                    >
                      {STATUS_LABELS[selectedContract.computedStatus || selectedContract.status] || selectedContract.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Data podpisania</p>
                    <p className="text-sm font-medium" data-testid="text-detail-signed">{formatDate(selectedContract.signedDate)}</p>
                  </div>
                </div>

                {selectedContract.trialPeriod && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Okres próbny do</p>
                    <p className="text-sm font-medium" data-testid="text-detail-trial">{formatDate(selectedContract.trialEndDate)}</p>
                  </div>
                )}

                {selectedContract.notes && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Notatki</p>
                    <p className="text-sm" data-testid="text-detail-notes">{selectedContract.notes}</p>
                  </div>
                )}

                {selectedContract.fileUrl && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Skan umowy</p>
                    <a
                      href={selectedContract.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 dark:text-blue-400 underline"
                      data-testid="link-detail-file"
                    >
                      Pobierz / otwórz plik
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-4 border-t">
                  <Button onClick={() => handleGeneratePdf(selectedContract.id)} data-testid="button-detail-generate-pdf">
                    <Download className="mr-2 h-4 w-4" /> Generuj PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSheetOpen(false);
                      openEdit(selectedContract);
                    }}
                    data-testid="button-detail-edit"
                  >
                    <Pencil className="mr-2 h-4 w-4" /> Edytuj
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => deleteMut.mutate(selectedContract.id)}
                    disabled={deleteMut.isPending}
                    data-testid="button-detail-delete"
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Usuń
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
