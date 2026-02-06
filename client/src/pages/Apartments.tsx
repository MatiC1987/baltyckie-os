import { useState, useMemo } from "react";
import { useApartments, useCreateApartment } from "@/hooks/use-apartments";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Home, Building2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertApartmentSchema, type InsertApartment, type Apartment } from "@shared/schema";

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);

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
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            <Home className="h-5 w-5" />
          </div>
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
      header: "Status",
      cell: (apt: any) => (
        <Badge variant={apt.active ? "default" : "secondary"}>
          {apt.active ? "Aktywny" : "Nieaktywny"}
        </Badge>
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
