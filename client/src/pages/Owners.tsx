import { useState, useMemo } from "react";
import { useOwners, useCreateOwner, useUpdateOwner, useDeleteOwner } from "@/hooks/use-owners";
import { useApartments } from "@/hooks/use-apartments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Users, Home, MapPin, Plus, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { type Owner, type Apartment, type InsertOwner, insertOwnerSchema } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { type Lease } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

export default function Owners() {
  const { data: ownersList, isLoading: ownersLoading } = useOwners();
  const { data: apartments } = useApartments();
  const { data: leases } = useQuery<Lease[]>({
    queryKey: ['/api/leases'],
  });
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

  const getActiveLease = (aptId: number) => {
    if (!leases) return null;
    const today = new Date().toISOString().split('T')[0];
    return leases.find(l =>
      l.apartmentId === aptId &&
      l.startDate <= today &&
      (!l.endDate || l.endDate >= today)
    );
  };

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

      <div className="space-y-6">
        {ownersList?.map((owner) => {
          const ownerApts = ownerApartmentsMap.get(owner.id) || [];
          return (
            <Card key={owner.id} data-testid={`card-owner-${owner.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-owner-name-${owner.id}`}>{owner.name}</CardTitle>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        {owner.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {owner.phone}
                          </span>
                        )}
                        {owner.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {owner.email}
                          </span>
                        )}
                        <span>{ownerApts.length} {ownerApts.length === 1 ? 'apartament' : ownerApts.length < 5 ? 'apartamenty' : 'apartamentów'}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingOwner(owner)}
                    data-testid={`button-edit-owner-${owner.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {(ownerApts.length > 0 || owner.notes) && (
                <CardContent>
                  {owner.notes && (
                    <p className="text-sm text-muted-foreground mb-3">{owner.notes}</p>
                  )}
                  <div className="space-y-3">
                    {ownerApts.map((apt) => {
                      const lease = getActiveLease(apt.id);
                      return (
                        <div
                          key={apt.id}
                          className="flex items-center justify-between flex-wrap gap-2 p-3 rounded-lg bg-muted/50"
                          data-testid={`row-owner-apartment-${apt.id}`}
                        >
                          <div className="flex items-center gap-3">
                            {apt.photoUrl ? (
                              <img src={apt.photoUrl} alt={apt.name} className="h-8 w-8 rounded-md object-cover" />
                            ) : (
                              <Home className="h-4 w-4 text-muted-foreground" />
                            )}
                            <div>
                              <div className="font-medium text-sm">{apt.name}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {apt.location || "Brak lokalizacji"}
                                {apt.address && <span>| {apt.address}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {lease && (
                              <Badge variant="outline" className="text-xs">
                                Najem: {lease.startDate} — {lease.endDate || "bezterminowo"}
                              </Badge>
                            )}
                            <Badge variant={apt.active ? "default" : "secondary"}>
                              {apt.active ? "Aktywny" : "Nieaktywny"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {(!ownersList || ownersList.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">
            Brak właścicieli. Kliknij "Dodaj właściciela" aby dodać pierwszego.
          </div>
        )}
      </div>

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
      phone: "",
      email: "",
      notes: "",
    }
  });

  const onSubmit = (data: InsertOwner) => {
    createOwner.mutate(data, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="owner-name">Imię i nazwisko</Label>
        <Input id="owner-name" {...form.register("name")} placeholder="Jan Kowalski" data-testid="input-owner-name" />
        {form.formState.errors.name && <span className="text-sm text-destructive">{form.formState.errors.name.message}</span>}
      </div>
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
      phone: owner.phone || "",
      email: owner.email || "",
      notes: owner.notes || "",
    }
  });

  const onSubmit = (data: InsertOwner) => {
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
        <Label htmlFor="edit-owner-name">Imię i nazwisko</Label>
        <Input id="edit-owner-name" {...form.register("name")} data-testid="input-edit-owner-name" />
        {form.formState.errors.name && <span className="text-sm text-destructive">{form.formState.errors.name.message}</span>}
      </div>
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
