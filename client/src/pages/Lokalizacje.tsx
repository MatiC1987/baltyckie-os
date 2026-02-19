import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Plus, Trash2, Pencil, MapPin } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TablePageSkeleton } from "@/components/PageSkeleton";
import { useToast } from "@/hooks/use-toast";
import type { Location } from "@shared/schema";

function useLocations() {
  return useQuery<Location[]>({
    queryKey: ["/api/locations"],
  });
}

export default function Lokalizacje() {
  const { data: locations, isLoading } = useLocations();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [editingLoc, setEditingLoc] = useState<Location | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; address?: string; photoUrl?: string }) => {
      const res = await apiRequest("POST", "/api/locations", { ...data, sortOrder: (locations?.length || 0) });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Sukces", description: "Lokalizacja dodana" });
      setShowAdd(false);
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się dodać lokalizacji", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<{ name: string; address: string; photoUrl: string }> }) => {
      const res = await apiRequest("PUT", `/api/locations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Sukces", description: "Lokalizacja zaktualizowana" });
      setEditingLoc(null);
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się zaktualizować", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/locations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Sukces", description: "Lokalizacja usunięta" });
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się usunąć", variant: "destructive" }),
  });

  if (isLoading && !locations) return <TablePageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lokalizacje"
        description="Zarządzanie kategoriami lokalizacji apartamentów."
        icon={MapPin}
        actions={
          <Button onClick={() => setShowAdd(true)} data-testid="button-add-location">
            <Plus className="mr-2 h-4 w-4" /> Dodaj lokalizację
          </Button>
        }
      />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Nazwa lokalizacji</TableHead>
                <TableHead>Adres</TableHead>
                <TableHead>Zdjęcie</TableHead>
                <TableHead className="w-24">Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations?.map((loc, idx) => (
                <TableRow key={loc.id} data-testid={`row-location-${loc.id}`}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      {loc.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{loc.address || "—"}</TableCell>
                  <TableCell>
                    {loc.photoUrl ? (
                      <img src={loc.photoUrl} alt={loc.name} className="h-10 w-16 object-cover rounded-md" />
                    ) : (
                      <span className="text-muted-foreground text-xs">Brak</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditingLoc(loc)} data-testid={`button-edit-location-${loc.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(loc.id)} data-testid={`button-delete-location-${loc.id}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!locations || locations.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Brak lokalizacji. Kliknij "Dodaj lokalizację" aby dodać pierwszą.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LocationDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      {editingLoc && (
        <LocationDialog
          open={!!editingLoc}
          onClose={() => setEditingLoc(null)}
          onSubmit={(data) => updateMutation.mutate({ id: editingLoc.id, data })}
          isPending={updateMutation.isPending}
          initial={editingLoc}
        />
      )}
    </div>
  );
}

function LocationDialog({
  open, onClose, onSubmit, isPending, initial,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; address?: string; photoUrl?: string }) => void;
  isPending: boolean;
  initial?: { name: string; address?: string | null; photoUrl?: string | null };
}) {
  const [name, setName] = useState(initial?.name || "");
  const [address, setAddress] = useState(initial?.address || "");
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), address: address.trim() || undefined, photoUrl: photoUrl.trim() || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edytuj lokalizację" : "Dodaj lokalizację"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nazwa lokalizacji</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="np. GRAND BALTIC" data-testid="input-location-name" />
          </div>
          <div className="space-y-2">
            <Label>Adres lokalizacji</Label>
            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="np. ul. Bałtycka 1" data-testid="input-location-address" />
          </div>
          <div className="space-y-2">
            <Label>Zdjęcie prezentacyjne (URL)</Label>
            <Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="URL zdjęcia" data-testid="input-location-photo" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={isPending} data-testid="button-submit-location">
              {isPending ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
