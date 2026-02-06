import { useState, useMemo } from "react";
import { useApartments, useCreateApartment, useUpdateApartment, useDeleteApartment } from "@/hooks/use-apartments";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Home, Building2, Pencil, Trash2, Paperclip, FileText, Upload, X, Camera, ImageIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertApartmentSchema, type InsertApartment, type Apartment, type Lease, type Attachment } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";

const LOCATIONS = [
  "BULWAR PORTOWY",
  "NA WYDMIE",
  "WCZASOWA",
  "GRAND BALTIC",
  "PRZEWŁOKA",
  "INNE",
] as const;

const OTHER_LABEL = "INNE";

function normalizeKey(loc: string): string {
  return loc.trim().toUpperCase();
}

export default function Apartments() {
  const { data: apartments, isLoading } = useApartments();
  const { data: leases } = useQuery<Lease[]>({ queryKey: ['/api/leases'] });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);

  const leaseMap = useMemo(() => {
    if (!leases) return new Map<number, Lease>();
    const map = new Map<number, Lease>();
    const today = new Date().toISOString().split('T')[0];
    for (const l of leases) {
      if (l.apartmentId && l.startDate <= today && (!l.endDate || l.endDate >= today)) {
        if (!map.has(l.apartmentId) || l.startDate > (map.get(l.apartmentId)!.startDate)) {
          map.set(l.apartmentId, l);
        }
      }
    }
    if (leases.length > 0) {
      for (const l of leases) {
        if (l.apartmentId && !map.has(l.apartmentId)) {
          if (!map.has(l.apartmentId) || l.startDate > (map.get(l.apartmentId)!.startDate)) {
            map.set(l.apartmentId, l);
          }
        }
      }
    }
    return map;
  }, [leases]);

  const groupedApartments = useMemo(() => {
    const groups: { label: string; apartments: Apartment[] }[] = LOCATIONS.map(loc => ({
      label: loc,
      apartments: [],
    }));

    if (apartments) {
      for (const apt of apartments) {
        const loc = apt.location?.trim() || "";
        const key = normalizeKey(loc);
        const group = groups.find(g => normalizeKey(g.label) === key);
        if (group) {
          group.apartments.push(apt);
        } else {
          const otherGroup = groups.find(g => g.label === OTHER_LABEL);
          if (otherGroup) otherGroup.apartments.push(apt);
        }
      }
    }

    return groups;
  }, [apartments]);

  const columns = [
    {
      header: "Nazwa",
      cell: (apt: any) => (
        <div className="flex items-center gap-3">
          {apt.photoUrl ? (
            <img
              src={apt.photoUrl}
              alt={apt.name}
              className="h-10 w-10 rounded-lg object-cover"
              data-testid={`img-apartment-photo-${apt.id}`}
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Home className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className="font-semibold" data-testid={`text-apartment-name-${apt.id}`}>{apt.name}</div>
            <div className="text-xs text-muted-foreground">{apt.address || `ID: #${apt.id}`}</div>
          </div>
        </div>
      )
    },
    {
      header: "Właściciel",
      accessorKey: "ownerName" as const,
    },
    {
      header: "Umowa najmu",
      cell: (apt: any) => {
        const lease = leaseMap.get(apt.id);
        if (!lease) return <span className="text-xs text-muted-foreground">Brak umowy</span>;
        const today = new Date().toISOString().split('T')[0];
        const isActive = lease.startDate <= today && (!lease.endDate || lease.endDate >= today);
        return (
          <div className="text-xs" data-testid={`text-lease-dates-${apt.id}`}>
            <div className="flex items-center gap-1">
              <Badge variant={isActive ? "default" : "secondary"} className="text-xs">
                {isActive ? "Aktywna" : "Nieaktywna"}
              </Badge>
            </div>
            <div className="text-muted-foreground mt-1">
              {lease.startDate} — {lease.endDate || "bezterminowo"}
            </div>
          </div>
        );
      }
    },
    {
      header: "Status",
      cell: (apt: any) => (
        <Badge variant={apt.active ? "default" : "secondary"}>
          {apt.active ? "Aktywny" : "Nieaktywny"}
        </Badge>
      )
    },
    {
      header: "",
      cell: (apt: any) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditingApartment(apt)}
            data-testid={`button-edit-apartment-${apt.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight" data-testid="text-apartments-title">Apartamenty</h2>
            <p className="text-muted-foreground">Zarządzaj swoją bazą nieruchomości.</p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 w-full bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-apartments-title">Apartamenty</h2>
          <p className="text-muted-foreground">Zarządzaj swoją bazą nieruchomości.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-apartment">
              <Plus className="mr-2 h-4 w-4" /> Dodaj apartament
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dodaj nowy apartament</DialogTitle>
            </DialogHeader>
            <ApartmentForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-total">{apartments?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Wszystkie</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-active">{apartments?.filter(a => a.active).length || 0}</div>
            <div className="text-xs text-muted-foreground">Aktywne</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-locations">{groupedApartments.filter(g => g.apartments.length > 0).length}</div>
            <div className="text-xs text-muted-foreground">Lokalizacje</div>
          </CardContent>
        </Card>
      </div>

      {groupedApartments.map((group) => (
        <div key={group.label} className="space-y-3" data-testid={`group-location-${group.label.toLowerCase().replace(/\s+/g, '-').replace(/ł/g, 'l')}`}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold">{group.label}</h3>
              <Badge variant="secondary" className="text-xs">{group.apartments.length}</Badge>
            </div>
          </div>
          {group.apartments.length > 0 ? (
            <DataTable
              data={group.apartments}
              columns={columns}
              emptyMessage="Brak apartamentów w tej lokalizacji."
            />
          ) : (
            <div className="text-sm text-muted-foreground pl-11">
              Brak apartamentów w tej lokalizacji.
            </div>
          )}
        </div>
      ))}

      <Dialog open={!!editingApartment} onOpenChange={(open) => { if (!open) setEditingApartment(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edytuj apartament — {editingApartment?.name}</DialogTitle>
          </DialogHeader>
          {editingApartment && (
            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1" data-testid="tab-edit-details">Dane</TabsTrigger>
                <TabsTrigger value="photo" className="flex-1" data-testid="tab-edit-photo">
                  <Camera className="h-4 w-4 mr-1" /> Zdjęcie
                </TabsTrigger>
                <TabsTrigger value="attachments" className="flex-1" data-testid="tab-edit-attachments">
                  <Paperclip className="h-4 w-4 mr-1" /> Załączniki
                </TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <EditApartmentForm
                  apartment={editingApartment}
                  onSuccess={() => setEditingApartment(null)}
                />
              </TabsContent>
              <TabsContent value="photo">
                <PhotoSection apartment={editingApartment} />
              </TabsContent>
              <TabsContent value="attachments">
                <AttachmentsSection apartmentId={editingApartment.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApartmentForm({ onSuccess }: { onSuccess: () => void }) {
  const createApartment = useCreateApartment();
  const form = useForm<InsertApartment>({
    resolver: zodResolver(insertApartmentSchema),
    defaultValues: {
      name: "",
      location: "",
      address: "",
      ownerName: "",
      active: true,
    }
  });

  const onSubmit = (data: InsertApartment) => {
    createApartment.mutate(data, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nazwa apartamentu</Label>
        <Input id="name" {...form.register("name")} placeholder="np. Apartament Widokowy" data-testid="input-apartment-name" />
        {form.formState.errors.name && <span className="text-sm text-destructive">{form.formState.errors.name.message}</span>}
      </div>
      <div className="space-y-2">
        <Label>Lokalizacja</Label>
        <Controller
          control={form.control}
          name="location"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ""}>
              <SelectTrigger data-testid="select-apartment-location">
                <SelectValue placeholder="Wybierz lokalizację" />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Adres</Label>
        <Input id="address" {...form.register("address")} placeholder="ul. Długa 1/2" data-testid="input-apartment-address" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerName">Właściciel</Label>
        <Input id="ownerName" {...form.register("ownerName")} placeholder="Jan Kowalski" data-testid="input-apartment-owner" />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={createApartment.isPending} data-testid="button-submit-apartment">
          {createApartment.isPending ? "Dodawanie..." : "Dodaj apartament"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditApartmentForm({ apartment, onSuccess }: { apartment: Apartment; onSuccess: () => void }) {
  const updateApartment = useUpdateApartment();
  const deleteApartment = useDeleteApartment();
  const form = useForm<InsertApartment>({
    resolver: zodResolver(insertApartmentSchema),
    defaultValues: {
      name: apartment.name,
      location: apartment.location || "",
      address: apartment.address || "",
      ownerName: apartment.ownerName || "",
      active: apartment.active,
    }
  });

  const onSubmit = (data: InsertApartment) => {
    updateApartment.mutate({ id: apartment.id, ...data }, {
      onSuccess: () => onSuccess()
    });
  };

  const handleDelete = () => {
    if (window.confirm("Czy na pewno chcesz usunąć ten apartament?")) {
      deleteApartment.mutate(apartment.id, {
        onSuccess: () => onSuccess()
      });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="edit-name">Nazwa apartamentu</Label>
        <Input id="edit-name" {...form.register("name")} data-testid="input-edit-apartment-name" />
        {form.formState.errors.name && <span className="text-sm text-destructive">{form.formState.errors.name.message}</span>}
      </div>
      <div className="space-y-2">
        <Label>Lokalizacja</Label>
        <Controller
          control={form.control}
          name="location"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ""}>
              <SelectTrigger data-testid="select-edit-apartment-location">
                <SelectValue placeholder="Wybierz lokalizację" />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-address">Adres</Label>
        <Input id="edit-address" {...form.register("address")} data-testid="input-edit-apartment-address" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-ownerName">Właściciel</Label>
        <Input id="edit-ownerName" {...form.register("ownerName")} data-testid="input-edit-apartment-owner" />
      </div>
      <div className="flex items-center gap-3">
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              data-testid="switch-edit-apartment-active"
            />
          )}
        />
        <Label>Aktywny</Label>
      </div>

      <DialogFooter className="flex-wrap gap-2">
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={deleteApartment.isPending}
          data-testid="button-delete-apartment"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {deleteApartment.isPending ? "Usuwanie..." : "Usuń"}
        </Button>
        <Button type="submit" disabled={updateApartment.isPending} data-testid="button-save-apartment">
          {updateApartment.isPending ? "Zapisywanie..." : "Zapisz zmiany"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function PhotoSection({ apartment }: { apartment: Apartment }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateApartment = useUpdateApartment();

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      updateApartment.mutate(
        { id: apartment.id, photoUrl: response.objectPath },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/apartments'] });
            toast({ title: "Sukces", description: "Zdjęcie zostało zaktualizowane" });
          },
        }
      );
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się przesłać zdjęcia", variant: "destructive" });
    },
  });

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    updateApartment.mutate(
      { id: apartment.id, photoUrl: null },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/apartments'] });
          toast({ title: "Sukces", description: "Zdjęcie zostało usunięte" });
        },
      }
    );
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col items-center gap-4">
        {apartment.photoUrl ? (
          <div className="relative">
            <img
              src={apartment.photoUrl}
              alt={apartment.name}
              className="w-48 h-48 rounded-lg object-cover border"
              data-testid="img-apartment-photo-preview"
            />
            <Button
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2"
              onClick={handleRemovePhoto}
              disabled={updateApartment.isPending}
              data-testid="button-remove-photo"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="w-48 h-48 rounded-lg bg-muted flex flex-col items-center justify-center gap-2 border border-dashed" data-testid="placeholder-no-photo">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Brak zdjęcia</span>
          </div>
        )}

        <Label htmlFor="photo-upload" className="cursor-pointer">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover-elevate">
            <Camera className="h-4 w-4" />
            {isUploading ? "Przesyłanie..." : apartment.photoUrl ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
          </div>
          <input
            id="photo-upload"
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoSelect}
            disabled={isUploading}
            data-testid="input-apartment-photo"
          />
        </Label>
        <p className="text-xs text-muted-foreground text-center">
          Obsługiwane formaty: JPG, PNG, WebP
        </p>
      </div>
    </div>
  );
}

function AttachmentsSection({ apartmentId }: { apartmentId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (response) => {
      await fetch(`/api/apartments/${apartmentId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileName: currentFileName,
          objectPath: response.objectPath,
          fileType: currentFileType,
          category: selectedCategory,
        }),
      });
      queryClient.invalidateQueries({ queryKey: ['/api/apartments', apartmentId, 'attachments'] });
      toast({ title: "Sukces", description: "Załącznik został dodany" });
      setCurrentFileName('');
      setCurrentFileType('');
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się przesłać pliku", variant: "destructive" });
    },
  });

  const [currentFileName, setCurrentFileName] = useState('');
  const [currentFileType, setCurrentFileType] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('UMOWA');

  const { data: attachmentsList } = useQuery<Attachment[]>({
    queryKey: ['/api/apartments', apartmentId, 'attachments'],
    queryFn: async () => {
      const res = await fetch(`/api/apartments/${apartmentId}/attachments`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch attachments');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/apartments', apartmentId, 'attachments'] });
      toast({ title: "Sukces", description: "Załącznik usunięty" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCurrentFileName(file.name);
    setCurrentFileType(file.type);
    await uploadFile(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40" data-testid="select-attachment-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UMOWA">Umowa</SelectItem>
            <SelectItem value="ANEKS">Aneks</SelectItem>
            <SelectItem value="INNY">Inny</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="file-attach" className="cursor-pointer">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover-elevate">
            <Upload className="h-4 w-4" />
            {isUploading ? "Przesyłanie..." : "Dodaj plik"}
          </div>
          <input
            id="file-attach"
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileSelect}
            disabled={isUploading}
            data-testid="input-attachment-file"
          />
        </Label>
      </div>

      <div className="space-y-2">
        {attachmentsList && attachmentsList.length > 0 ? (
          attachmentsList.map((att) => (
            <div key={att.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50" data-testid={`row-attachment-${att.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <a
                    href={att.objectPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline truncate block"
                    data-testid={`link-attachment-${att.id}`}
                  >
                    {att.fileName}
                  </a>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{att.category}</Badge>
                    {att.uploadedAt && <span>{new Date(att.uploadedAt).toLocaleDateString('pl-PL')}</span>}
                  </div>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteMutation.mutate(att.id)}
                disabled={deleteMutation.isPending}
                data-testid={`button-delete-attachment-${att.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground text-center py-6">
            Brak załączników. Dodaj skan umowy lub aneks.
          </div>
        )}
      </div>
    </div>
  );
}
