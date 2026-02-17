import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Shield } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

interface AppUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  permissions: string[];
  active: boolean;
  createdAt: string | null;
}

const ALL_SECTIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "calendar", label: "Terminarz" },
  { id: "reservations", label: "Rezerwacje" },
  { id: "arrivals", label: "Przyjazdy" },
  { id: "finance", label: "Finanse" },
  { id: "podnajem", label: "Podnajem" },
  { id: "contracts", label: "Umowy" },
  { id: "apartments", label: "Apartamenty" },
  { id: "owners", label: "Właściciele" },
  { id: "employees", label: "Pracownicy" },
  { id: "import", label: "Import/Eksport" },
  { id: "settings", label: "Ustawienia" },
];

const emptyForm = {
  email: "",
  firstName: "",
  lastName: "",
  password: "",
  permissions: [] as string[],
};

export default function UserAccounts() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: users = [], isLoading } = useQuery<AppUser[]>({
    queryKey: ["/api/app-users"],
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => apiRequest("POST", "/api/app-users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      toast({ title: "Użytkownik został dodany" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof emptyForm> }) =>
      apiRequest("PUT", `/api/app-users/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      toast({ title: "Dane użytkownika zostały zaktualizowane" });
      closeDialog();
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/app-users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      toast({ title: "Użytkownik został usunięty" });
    },
  });

  function openAdd() {
    setEditingUser(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(user: AppUser) {
    setEditingUser(user);
    setForm({
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      password: "",
      permissions: user.permissions || [],
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingUser(null);
    setForm({ ...emptyForm });
  }

  function handleSubmit() {
    if (editingUser) {
      const data: any = { ...form };
      if (!data.password) delete data.password;
      updateMutation.mutate({ id: editingUser.id, data });
    } else {
      createMutation.mutate(form);
    }
  }

  function togglePermission(sectionId: string) {
    setForm(prev => {
      const perms = prev.permissions.includes(sectionId)
        ? prev.permissions.filter(p => p !== sectionId)
        : [...prev.permissions, sectionId];
      return { ...prev, permissions: perms };
    });
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-user-accounts-title">Konta użytkowników</h1>
          <p className="text-muted-foreground text-sm">Zarządzanie użytkownikami systemu i ich uprawnieniami</p>
        </div>
        <Button onClick={openAdd} data-testid="button-add-user">
          <Plus className="h-4 w-4 mr-2" />
          Dodaj użytkownika
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Imię i nazwisko</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Uprawnienia</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Brak użytkowników. Dodaj pierwszego użytkownika.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user, idx) => (
                    <TableRow key={user.id} className={idx % 2 === 1 ? "bg-muted/30" : ""} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium" data-testid={`cell-user-name-${user.id}`}>
                        {user.firstName} {user.lastName}
                      </TableCell>
                      <TableCell data-testid={`cell-user-email-${user.id}`}>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(user.permissions || []).length === 0 ? (
                            <span className="text-xs text-muted-foreground">Brak uprawnień</span>
                          ) : (
                            (user.permissions || []).slice(0, 4).map(p => {
                              const section = ALL_SECTIONS.find(s => s.id === p);
                              return (
                                <Badge key={p} variant="secondary" className="text-xs">
                                  {section?.label || p}
                                </Badge>
                              );
                            })
                          )}
                          {(user.permissions || []).length > 4 && (
                            <Badge variant="outline" className="text-xs">+{user.permissions.length - 4}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(user)} data-testid={`button-edit-user-${user.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" data-testid={`button-delete-user-${user.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Usunąć użytkownika?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Czy na pewno chcesz usunąć użytkownika {user.firstName} {user.lastName}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(user.id)}>Usuń</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edytuj użytkownika" : "Dodaj użytkownika"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Imię</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  data-testid="input-user-first-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Nazwisko</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  data-testid="input-user-last-name"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                data-testid="input-user-email"
              />
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? "Nowe hasło (opcjonalnie)" : "Hasło"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingUser ? "Pozostaw puste aby nie zmieniać" : ""}
                data-testid="input-user-password"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Uprawnienia do sekcji
              </Label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {ALL_SECTIONS.map(section => (
                  <label
                    key={section.id}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                    data-testid={`checkbox-permission-${section.id}`}
                  >
                    <Checkbox
                      checked={form.permissions.includes(section.id)}
                      onCheckedChange={() => togglePermission(section.id)}
                    />
                    {section.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Anuluj</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.email || !form.firstName || !form.lastName || (!editingUser && !form.password)}
              data-testid="button-save-user"
            >
              {editingUser ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
