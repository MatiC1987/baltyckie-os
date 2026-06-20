import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Shield, ScrollText, Camera, X, Fingerprint, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { UserAvatar } from "@/components/UserAvatar";
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
  profileImageUrl: string | null;
  createdAt: string | null;
}

interface WebauthnDevice {
  id: number;
  deviceName: string;
  createdAt: string;
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
    onError: (err: any) => toast({ title: "Błąd", description: err.message || "Nie udało się usunąć użytkownika", variant: "destructive" }),
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  async function handlePhotoUpload(file: File) {
    if (!editingUser) return;
    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(`/api/users/${editingUser.id}/profile-photo`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Błąd uploadu");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      toast({ title: "Zdjęcie zostało zapisane" });
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePhotoDelete() {
    if (!editingUser) return;
    try {
      await fetch(`/api/users/${editingUser.id}/profile-photo`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["/api/app-users"] });
      toast({ title: "Zdjęcie zostało usunięte" });
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    }
  }

  const { data: webauthnDevices = [], isLoading: loadingDevices } = useQuery<WebauthnDevice[]>({
    queryKey: ["/api/app-users", editingUser?.id, "webauthn-credentials"],
    queryFn: async () => {
      if (!editingUser) return [];
      const res = await apiRequest("GET", `/api/app-users/${editingUser.id}/webauthn-credentials`);
      return res.json();
    },
    enabled: !!editingUser && dialogOpen,
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: ({ userId, credId }: { userId: number; credId: number }) =>
      apiRequest("DELETE", `/api/app-users/${userId}/webauthn-credentials/${credId}`),
    onSuccess: () => {
      if (editingUser) {
        queryClient.invalidateQueries({ queryKey: ["/api/app-users", editingUser.id, "webauthn-credentials"] });
      }
      toast({ title: "Urządzenie zostało usunięte" });
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const deleteAllDevicesMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest("DELETE", `/api/app-users/${userId}/webauthn-credentials`),
    onSuccess: () => {
      if (editingUser) {
        queryClient.invalidateQueries({ queryKey: ["/api/app-users", editingUser.id, "webauthn-credentials"] });
      }
      toast({ title: "Wszystkie urządzenia zostały usunięte" });
    },
    onError: (err: any) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
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
      <PageHeader title="Konta użytkowników" description="Zarządzanie kontami i uprawnieniami użytkowników." icon={ScrollText} actions={
        <Button onClick={openAdd} data-testid="button-add-user">
          <Plus className="h-4 w-4 mr-2" />
          Dodaj użytkownika
        </Button>
      } />

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
                  <EmptyState variant="inline" colSpan={4} icon={Shield} title="Brak użytkowników" description="Dodaj pierwszego użytkownika." />
                ) : (
                  users.map((user, idx) => (
                    <TableRow key={user.id} className={idx % 2 === 1 ? "bg-muted/30" : ""} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium" data-testid={`cell-user-name-${user.id}`}>
                        <div className="flex items-center gap-2.5">
                          <UserAvatar userId={user.id} firstName={user.firstName} lastName={user.lastName} size="sm" />
                          <span>{user.firstName} {user.lastName}</span>
                        </div>
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
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edytuj użytkownika" : "Dodaj użytkownika"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingUser && (
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <UserAvatar userId={editingUser.id} firstName={editingUser.firstName} lastName={editingUser.lastName} size="lg" />
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    disabled={uploadingPhoto}
                    data-testid="button-change-photo"
                  >
                    <Camera className="h-5 w-5 text-white" />
                  </button>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => photoInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    data-testid="button-upload-photo"
                  >
                    <Camera className="h-3.5 w-3.5 mr-1.5" />
                    {uploadingPhoto ? "Wgrywanie..." : "Zmień zdjęcie"}
                  </Button>
                  {editingUser.profileImageUrl && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePhotoDelete}
                      className="text-red-500 hover:text-red-600 h-7"
                      data-testid="button-delete-photo"
                    >
                      <X className="h-3.5 w-3.5 mr-1" />
                      Usuń zdjęcie
                    </Button>
                  )}
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}
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

            {editingUser && (
              <div className="space-y-2 border-t pt-4">
                <Label className="flex items-center gap-2">
                  <Fingerprint className="h-4 w-4" />
                  Urządzenia biometryczne
                </Label>
                {loadingDevices ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Ładowanie...
                  </div>
                ) : webauthnDevices.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    Brak zarejestrowanych urządzeń biometrycznych.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {webauthnDevices.map(device => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between rounded-lg border p-2.5"
                        data-testid={`device-row-${device.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Fingerprint className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{device.deviceName || "Urządzenie"}</p>
                            <p className="text-xs text-muted-foreground">
                              {device.createdAt ? new Date(device.createdAt).toLocaleDateString("pl-PL") : ""}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-600"
                          onClick={() => deleteDeviceMutation.mutate({ userId: editingUser.id, credId: device.id })}
                          disabled={deleteDeviceMutation.isPending}
                          data-testid={`button-delete-device-${device.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    {webauthnDevices.length > 1 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-red-500 hover:text-red-600"
                            data-testid="button-delete-all-devices"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                            Usuń wszystkie urządzenia
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Usunąć wszystkie urządzenia?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Użytkownik nie będzie mógł logować się biometrycznie do momentu ponownej rejestracji urządzenia.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Anuluj</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteAllDevicesMutation.mutate(editingUser.id)}>
                              Usuń wszystkie
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                )}
              </div>
            )}
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
