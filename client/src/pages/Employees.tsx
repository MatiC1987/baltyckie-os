import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Employee, InsertEmployee } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Phone, Mail, UserCircle, Upload, X } from "lucide-react";

const POSITIONS: Record<string, string> = {
  KIEROWNIK_RECEPCJI: "Kierownik recepcji",
  PRACOWNIK_RECEPCJI: "Pracownik recepcji",
  FINANCIAL_MANAGER: "Financial Manager",
  KONSERWATOR: "Konserwator",
  OSOBA_SPRZATAJACA: "Osoba sprzątająca",
};

const COOPERATION_TYPES: Record<string, string> = {
  ETAT: "Etat",
  PRACA_NA_H: "Praca na godziny",
};

const CONTRACT_TYPES: Record<string, string> = {
  CZAS_OKRESLONY: "Na czas określony",
  CZAS_NIEOKRESLONY: "Na czas nieokreślony",
};

const STATUS_LABELS: Record<string, string> = {
  AKTYWNY: "Aktywny",
  NIEAKTYWNY: "Nieaktywny",
};

function useEmployees() {
  return useQuery<Employee[]>({
    queryKey: [api.employees.list.path],
    queryFn: async () => {
      const res = await fetch(api.employees.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });
}

const emptyForm: InsertEmployee = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  cooperationType: "ETAT",
  contractType: "CZAS_NIEOKRESLONY",
  contractStart: "",
  contractEnd: "",
  position: "PRACOWNIK_RECEPCJI",
  hourlyRate: "",
  comment: "",
  status: "AKTYWNY",
  photoUrl: "",
};

export default function Employees() {
  const { data: employees, isLoading } = useEmployees();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<InsertEmployee>({ ...emptyForm });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      setForm(prev => ({ ...prev, photoUrl: response.objectPath }));
      toast({ title: "Sukces", description: "Zdjęcie zostało przesłane" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się przesłać zdjęcia", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertEmployee) => {
      const res = await fetch(api.employees.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create employee");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
      toast({ title: "Sukces", description: "Pracownik został dodany" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać pracownika", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertEmployee> }) => {
      const res = await fetch(buildUrl('/api/employees/:id', { id }), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update employee");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
      toast({ title: "Sukces", description: "Dane pracownika zostały zaktualizowane" });
      closeDialog();
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się zaktualizować danych", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl('/api/employees/:id', { id }), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete employee");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
      toast({ title: "Sukces", description: "Pracownik został usunięty" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się usunąć pracownika", variant: "destructive" });
    },
  });

  function openAdd() {
    setEditingEmployee(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(emp: Employee) {
    setEditingEmployee(emp);
    setForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      phone: emp.phone || "",
      email: emp.email || "",
      cooperationType: emp.cooperationType,
      contractType: emp.contractType || "CZAS_NIEOKRESLONY",
      contractStart: emp.contractStart || "",
      contractEnd: emp.contractEnd || "",
      position: emp.position,
      hourlyRate: emp.hourlyRate || "",
      comment: emp.comment || "",
      status: emp.status,
      photoUrl: emp.photoUrl || "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingEmployee(null);
    setForm({ ...emptyForm });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName || !form.lastName) {
      toast({ title: "Błąd", description: "Imię i nazwisko są wymagane", variant: "destructive" });
      return;
    }

    const cleanedData = {
      ...form,
      phone: form.phone || null,
      email: form.email || null,
      contractType: form.cooperationType === "ETAT" ? form.contractType : null,
      contractStart: form.cooperationType === "ETAT" ? (form.contractStart || null) : null,
      contractEnd: form.cooperationType === "ETAT" && form.contractType === "CZAS_OKRESLONY" ? (form.contractEnd || null) : null,
      hourlyRate: form.hourlyRate || null,
      comment: form.comment || null,
      photoUrl: form.photoUrl || null,
    };

    if (editingEmployee) {
      updateMutation.mutate({ id: editingEmployee.id, data: cleanedData });
    } else {
      createMutation.mutate(cleanedData as InsertEmployee);
    }
  }

  function setField(field: keyof InsertEmployee, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  const isEtat = form.cooperationType === "ETAT";
  const isCzasOkreslony = form.contractType === "CZAS_OKRESLONY";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Pracownicy</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-employees-title">Pracownicy</h2>
          <p className="text-muted-foreground">Zarządzanie danymi pracowników.</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-employee">
          <Plus className="mr-2 h-4 w-4" /> Dodaj pracownika
        </Button>
      </div>

      {(!employees || employees.length === 0) ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <UserCircle className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Brak pracowników. Dodaj pierwszego pracownika.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold w-12"></TableHead>
                <TableHead className="text-xs font-semibold">Imię i nazwisko</TableHead>
                <TableHead className="text-xs font-semibold">Stanowisko</TableHead>
                <TableHead className="text-xs font-semibold">Kontakt</TableHead>
                <TableHead className="text-xs font-semibold">Współpraca</TableHead>
                <TableHead className="text-xs font-semibold">Umowa</TableHead>
                <TableHead className="text-xs font-semibold">Stawka/h</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold w-20">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => (
                <TableRow key={emp.id} data-testid={`row-employee-${emp.id}`} className={emp.status === "NIEAKTYWNY" ? "opacity-50" : ""}>
                  <TableCell>
                    {emp.photoUrl ? (
                      <img src={emp.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover border border-border" />
                    ) : (
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-sm whitespace-nowrap">
                    {emp.firstName} {emp.lastName}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {POSITIONS[emp.position] || emp.position}
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-col gap-0.5">
                      {emp.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /> {emp.phone}</span>}
                      {emp.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {emp.email}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {COOPERATION_TYPES[emp.cooperationType] || emp.cooperationType}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {emp.cooperationType === "ETAT" ? (
                      <div className="flex flex-col gap-0.5">
                        <span>{CONTRACT_TYPES[emp.contractType || ""] || "—"}</span>
                        {emp.contractStart && <span className="text-muted-foreground">{emp.contractStart}{emp.contractEnd ? ` — ${emp.contractEnd}` : ""}</span>}
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-semibold whitespace-nowrap">
                    {emp.hourlyRate ? `${Number(emp.hourlyRate).toFixed(2)} zł` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={emp.status === "AKTYWNY" ? "default" : "secondary"} data-testid={`badge-status-${emp.id}`}>
                      {STATUS_LABELS[emp.status] || emp.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(emp)} data-testid={`button-edit-employee-${emp.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(emp.id)} data-testid={`button-delete-employee-${emp.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="text-sm text-muted-foreground" data-testid="text-employees-count">
        Łącznie {employees?.length || 0} pracowników
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-employee-dialog-title">
              {editingEmployee ? "Edytuj pracownika" : "Dodaj pracownika"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-2">
            <div className="flex items-center gap-4">
              <div className="shrink-0">
                {form.photoUrl ? (
                  <img src={form.photoUrl} alt="" className="h-16 w-16 rounded-full object-cover border border-border" />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {(form.firstName || "?").charAt(0)}{(form.lastName || "?").charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs text-muted-foreground">Zdjęcie profilowe</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-upload-employee-photo"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {isUploading ? "Przesyłanie..." : form.photoUrl ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
                  </Button>
                  {form.photoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setField("photoUrl", "")}
                      data-testid="button-remove-employee-photo"
                    >
                      <X className="mr-1 h-3 w-3" /> Usuń
                    </Button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) await uploadFile(file);
                      e.target.value = "";
                    }}
                    data-testid="input-employee-photo"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Imię *</Label>
                <Input
                  value={form.firstName}
                  onChange={e => setField("firstName", e.target.value)}
                  required
                  data-testid="input-employee-first-name"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nazwisko *</Label>
                <Input
                  value={form.lastName}
                  onChange={e => setField("lastName", e.target.value)}
                  required
                  data-testid="input-employee-last-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Numer telefonu</Label>
                <Input
                  value={form.phone || ""}
                  onChange={e => setField("phone", e.target.value)}
                  placeholder="+48..."
                  data-testid="input-employee-phone"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <Input
                  type="email"
                  value={form.email || ""}
                  onChange={e => setField("email", e.target.value)}
                  placeholder="adres@email.pl"
                  data-testid="input-employee-email"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Zakres współpracy *</Label>
                <Select value={form.cooperationType} onValueChange={v => setField("cooperationType", v)}>
                  <SelectTrigger data-testid="select-employee-cooperation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COOPERATION_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stanowisko *</Label>
                <Select value={form.position} onValueChange={v => setField("position", v)}>
                  <SelectTrigger data-testid="select-employee-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(POSITIONS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isEtat && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Rodzaj umowy</Label>
                  <Select value={form.contractType || "CZAS_NIEOKRESLONY"} onValueChange={v => setField("contractType", v)}>
                    <SelectTrigger data-testid="select-employee-contract-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CONTRACT_TYPES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div />
              </div>
            )}

            {isEtat && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Początek umowy</Label>
                  <Input
                    type="date"
                    value={form.contractStart || ""}
                    onChange={e => setField("contractStart", e.target.value)}
                    data-testid="input-employee-contract-start"
                  />
                </div>
                {isCzasOkreslony && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Koniec umowy</Label>
                    <Input
                      type="date"
                      value={form.contractEnd || ""}
                      onChange={e => setField("contractEnd", e.target.value)}
                      data-testid="input-employee-contract-end"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Stawka godzinowa (PLN)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.hourlyRate || ""}
                  onChange={e => setField("hourlyRate", e.target.value)}
                  placeholder="0.00"
                  data-testid="input-employee-hourly-rate"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={form.status} onValueChange={v => setField("status", v)}>
                  <SelectTrigger data-testid="select-employee-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Dodatkowy komentarz</Label>
              <Textarea
                value={form.comment || ""}
                onChange={e => setField("comment", e.target.value)}
                placeholder="Uwagi, notatki..."
                className="resize-none"
                rows={3}
                data-testid="input-employee-comment"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={closeDialog} data-testid="button-cancel-employee">
                Anuluj
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-employee">
                {(createMutation.isPending || updateMutation.isPending) ? "Zapisywanie..." : "Zapisz"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
