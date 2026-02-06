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

const PRIORITY_LOCATION = "BULWAR PORTOWY";
const OTHER_LABEL = "Inne";

function normalizeKey(loc: string): string {
  return loc.trim().toUpperCase();
}

export default function Apartments() {
  const { data: apartments, isLoading } = useApartments();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { groupedApartments, locationOptions } = useMemo(() => {
    const groups: Record<string, { label: string; apartments: Apartment[] }> = {};

    groups[normalizeKey(PRIORITY_LOCATION)] = { label: PRIORITY_LOCATION, apartments: [] };

    if (apartments) {
      for (const apt of apartments) {
        const loc = apt.location?.trim() || "";
        const key = loc ? normalizeKey(loc) : normalizeKey(OTHER_LABEL);
        const label = loc || OTHER_LABEL;
        if (!groups[key]) {
          groups[key] = { label, apartments: [] };
        }
        groups[key].apartments.push(apt);
      }
    }

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === normalizeKey(PRIORITY_LOCATION)) return -1;
      if (b === normalizeKey(PRIORITY_LOCATION)) return 1;
      if (a === normalizeKey(OTHER_LABEL)) return 1;
      if (b === normalizeKey(OTHER_LABEL)) return -1;
      return a.localeCompare(b, 'pl');
    });

    const sorted: [string, { label: string; apartments: Apartment[] }][] = sortedKeys.map(k => [k, groups[k]]);

    const opts = new Set<string>();
    opts.add(PRIORITY_LOCATION);
    if (apartments) {
      for (const apt of apartments) {
        if (apt.location?.trim()) opts.add(apt.location.trim());
      }
    }

    return {
      groupedApartments: sorted,
      locationOptions: Array.from(opts),
    };
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
            <ApartmentForm
              onSuccess={() => setIsDialogOpen(false)}
              locationOptions={locationOptions}
            />
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
            <div className="text-2xl font-bold" data-testid="text-stat-locations">{groupedApartments.filter(([, g]) => g.apartments.length > 0).length}</div>
            <div className="text-xs text-muted-foreground">Lokalizacje</div>
          </CardContent>
        </Card>
      </div>

      {groupedApartments.map(([key, group]) => (
        <div key={key} className="space-y-3" data-testid={`group-location-${key.toLowerCase().replace(/\s+/g, '-')}`}>
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

function ApartmentForm({ onSuccess, locationOptions }: { onSuccess: () => void; locationOptions: string[] }) {
  const createApartment = useCreateApartment();
  const [customLocation, setCustomLocation] = useState(false);
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
        {customLocation ? (
          <div className="flex gap-2">
            <Input
              {...form.register("location")}
              placeholder="Wpisz lokalizację"
              data-testid="input-apartment-location"
            />
            <Button type="button" variant="outline" onClick={() => setCustomLocation(false)} data-testid="button-select-location">
              Lista
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Controller
              control={form.control}
              name="location"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger data-testid="select-apartment-location" className="flex-1">
                    <SelectValue placeholder="Wybierz lokalizację" />
                  </SelectTrigger>
                  <SelectContent>
                    {locationOptions.map(loc => (
                      <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Button type="button" variant="outline" onClick={() => setCustomLocation(true)} data-testid="button-custom-location">
              Inna
            </Button>
          </div>
        )}
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
