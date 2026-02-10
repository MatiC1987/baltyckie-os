import { useState, useMemo } from "react";
import { useOwners, useCreateOwner, useUpdateOwner, useDeleteOwner } from "@/hooks/use-owners";
import { useApartments } from "@/hooks/use-apartments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { type Owner, type Apartment, type InsertOwner, insertOwnerSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

export default function Owners() {
  const { data: ownersList, isLoading: ownersLoading } = useOwners();
  const { data: apartments } = useApartments();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);

  const ownerApartmentsMap = useMemo(() => {
    const map = new Map<number, Apartment[]>();
    if (apartments && ownersList) {
      for (const apt of apartments) {
        if (apt.ownerId) {
          if (!map.has(apt.ownerId)) map.set(apt.ownerId, []);
          map.get(apt.ownerId)!.push(apt);
        }
      }
    }
    return map;
  }, [apartments, ownersList]);

  const unassignedApartments = useMemo(() => {
    if (!apartments) return [];
    return apartments.filter(apt => !apt.ownerId);
  }, [apartments]);


  if (ownersLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-owners-title">Właściciele</h2>
          <p className="text-muted-foreground">Zarządzaj właścicielami i ich apartamentami.</p>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 w-full bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-owners-title">Właściciele</h2>
          <p className="text-muted-foreground">Zarządzaj właścicielami i ich apartamentami.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-owner">
              <Plus className="mr-2 h-4 w-4" /> Dodaj właściciela
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dodaj nowego właściciela</DialogTitle>
            </DialogHeader>
            <OwnerForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-owners-count">{ownersList?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Właścicieli</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-apartments-total">{apartments?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Apartamentów</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-unassigned">{unassignedApartments.length}</div>
            <div className="text-xs text-muted-foreground">Bez właściciela</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 px-3 font-medium">Właściciel</th>
                <th className="py-2 px-3 font-medium">Typ</th>
                <th className="py-2 px-3 font-medium">NIP</th>
                <th className="py-2 px-3 font-medium">Telefon</th>
                <th className="py-2 px-3 font-medium">Email</th>
                <th className="py-2 px-3 font-medium">Apartamenty</th>
                <th className="py-2 px-3 font-medium">Notatki</th>
                <th className="py-2 px-3 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {ownersList?.map((owner) => {
                const ownerApts = ownerApartmentsMap.get(owner.id) || [];
                return (
                  <tr
                    key={owner.id}
                    className="border-b last:border-b-0 hover-elevate"
                    data-testid={`card-owner-${owner.id}`}
                  >
                    <td className="py-2 px-3 font-medium whitespace-nowrap" data-testid={`text-owner-name-${owner.id}`}>
                      {owner.name}
                    </td>
                    <td className="py-2 px-3" data-testid={`badge-owner-type-${owner.id}`}>
                      <Badge variant={owner.ownerType === "firma" ? "default" : "secondary"}>
                        {owner.ownerType === "firma" ? "Firma" : "Osoba fiz."}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {owner.ownerType === "firma" && owner.nip ? owner.nip : "—"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {owner.phone || "—"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                      {owner.email || "—"}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {ownerApts.length > 0 ? ownerApts.map((apt) => (
                          <Badge key={apt.id} variant="outline" className="text-xs" data-testid={`row-owner-apartment-${apt.id}`}>
                            {apt.name}
                          </Badge>
                        )) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate" title={owner.notes || ""}>
                      {owner.notes || "—"}
                    </td>
                    <td className="py-2 px-3">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingOwner(owner)}
                        data-testid={`button-edit-owner-${owner.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(!ownersList || ownersList.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            Brak właścicieli. Kliknij "Dodaj właściciela" aby dodać pierwszego.
          </div>
        )}
      </Card>

      <Dialog open={!!editingOwner} onOpenChange={(open) => { if (!open) setEditingOwner(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edytuj właściciela</DialogTitle>
          </DialogHeader>
          {editingOwner && (
            <EditOwnerForm
              owner={editingOwner}
              onSuccess={() => setEditingOwner(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OwnerForm({ onSuccess }: { onSuccess: () => void }) {
  const createOwner = useCreateOwner();
  const form = useForm<InsertOwner>({
    resolver: zodResolver(insertOwnerSchema),
    defaultValues: {
      name: "",
      ownerType: "osoba_fizyczna",
      nip: "",
      phone: "",
      email: "",
      notes: "",
    }
  });

  const ownerType = form.watch("ownerType");

  const onSubmit = (data: InsertOwner) => {
    if (data.ownerType === "osoba_fizyczna") {
      data.nip = null;
    }
    createOwner.mutate(data, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Typ właściciela</Label>
        <Select
          value={ownerType || "osoba_fizyczna"}
          onValueChange={(val) => form.setValue("ownerType", val)}
          data-testid="select-owner-type"
        >
          <SelectTrigger data-testid="select-owner-type-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="osoba_fizyczna">Osoba fizyczna</SelectItem>
            <SelectItem value="firma">Firma</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner-name">{ownerType === "firma" ? "Nazwa firmy" : "Imię i nazwisko"}</Label>
        <Input id="owner-name" {...form.register("name")} placeholder={ownerType === "firma" ? "Nazwa firmy Sp. z o.o." : "Jan Kowalski"} data-testid="input-owner-name" />
        {form.formState.errors.name && <span className="text-sm text-destructive">{form.formState.errors.name.message}</span>}
      </div>
      {ownerType === "firma" && (
        <div className="space-y-2">
          <Label htmlFor="owner-nip">NIP</Label>
          <Input id="owner-nip" {...form.register("nip")} placeholder="1234567890" data-testid="input-owner-nip" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="owner-phone">Telefon</Label>
        <Input id="owner-phone" {...form.register("phone")} placeholder="+48 123 456 789" data-testid="input-owner-phone" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner-email">Email</Label>
        <Input id="owner-email" {...form.register("email")} placeholder="jan@example.com" data-testid="input-owner-email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="owner-notes">Notatki</Label>
        <Textarea id="owner-notes" {...form.register("notes")} placeholder="Dodatkowe informacje..." data-testid="input-owner-notes" />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={createOwner.isPending} data-testid="button-submit-owner">
          {createOwner.isPending ? "Dodawanie..." : "Dodaj właściciela"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditOwnerForm({ owner, onSuccess }: { owner: Owner; onSuccess: () => void }) {
  const updateOwner = useUpdateOwner();
  const deleteOwner = useDeleteOwner();
  const form = useForm<InsertOwner>({
    resolver: zodResolver(insertOwnerSchema),
    defaultValues: {
      name: owner.name,
      ownerType: owner.ownerType || "osoba_fizyczna",
      nip: owner.nip || "",
      phone: owner.phone || "",
      email: owner.email || "",
      notes: owner.notes || "",
    }
  });

  const ownerType = form.watch("ownerType");

  const onSubmit = (data: InsertOwner) => {
    if (data.ownerType === "osoba_fizyczna") {
      data.nip = null;
    }
    updateOwner.mutate({ id: owner.id, ...data }, {
      onSuccess: () => onSuccess()
    });
  };

  const handleDelete = () => {
    if (window.confirm("Czy na pewno chcesz usunąć tego właściciela? Powiązane apartamenty stracą przypisanie.")) {
      deleteOwner.mutate(owner.id, {
        onSuccess: () => onSuccess()
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Typ właściciela</Label>
        <Select
          value={ownerType || "osoba_fizyczna"}
          onValueChange={(val) => form.setValue("ownerType", val)}
          data-testid="select-edit-owner-type"
        >
          <SelectTrigger data-testid="select-edit-owner-type-trigger">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="osoba_fizyczna">Osoba fizyczna</SelectItem>
            <SelectItem value="firma">Firma</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-owner-name">{ownerType === "firma" ? "Nazwa firmy" : "Imię i nazwisko"}</Label>
        <Input id="edit-owner-name" {...form.register("name")} data-testid="input-edit-owner-name" />
        {form.formState.errors.name && <span className="text-sm text-destructive">{form.formState.errors.name.message}</span>}
      </div>
      {ownerType === "firma" && (
        <div className="space-y-2">
          <Label htmlFor="edit-owner-nip">NIP</Label>
          <Input id="edit-owner-nip" {...form.register("nip")} placeholder="1234567890" data-testid="input-edit-owner-nip" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="edit-owner-phone">Telefon</Label>
        <Input id="edit-owner-phone" {...form.register("phone")} data-testid="input-edit-owner-phone" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-owner-email">Email</Label>
        <Input id="edit-owner-email" {...form.register("email")} data-testid="input-edit-owner-email" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-owner-notes">Notatki</Label>
        <Textarea id="edit-owner-notes" {...form.register("notes")} data-testid="input-edit-owner-notes" />
      </div>
      <DialogFooter className="flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleteOwner.isPending}
          data-testid="button-delete-owner"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteOwner.isPending ? "Usuwanie..." : "Usuń"}
        </Button>
        <Button type="submit" disabled={updateOwner.isPending} data-testid="button-save-owner">
          {updateOwner.isPending ? "Zapisywanie..." : "Zapisz zmiany"}
        </Button>
      </DialogFooter>
    </form>
  );
}
