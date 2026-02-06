import { useState } from "react";
import { useApartments, useCreateApartment } from "@/hooks/use-apartments";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Plus, Home, MapPin } from "lucide-react";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertApartmentSchema, type InsertApartment } from "@shared/schema";

export default function Apartments() {
  const { data: apartments, isLoading } = useApartments();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const columns = [
    {
      header: "Nazwa",
      cell: (apt: any) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
            <Home className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-slate-900">{apt.name}</div>
            <div className="text-xs text-slate-500">ID: #{apt.id}</div>
          </div>
        </div>
      )
    },
    {
      header: "Lokalizacja",
      cell: (apt: any) => (
        <div className="flex items-center gap-2 text-slate-600">
          <MapPin className="h-4 w-4" />
          {apt.location || "Brak danych"}
        </div>
      )
    },
    {
      header: "Właściciel",
      accessorKey: "ownerName",
    },
    {
      header: "Status",
      cell: (apt: any) => (
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${apt.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
          {apt.active ? "Aktywny" : "Nieaktywny"}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Apartamenty</h2>
          <p className="text-muted-foreground">Zarządzaj swoją bazą nieruchomości.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-lg shadow-primary/20">
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

      <DataTable 
        data={apartments || []} 
        columns={columns} 
        isLoading={isLoading}
        emptyMessage="Brak apartamentów. Dodaj pierwszy!"
      />
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
        <Input id="name" {...form.register("name")} placeholder="np. Apartament Widokowy" />
        {form.formState.errors.name && <span className="text-sm text-red-500">{form.formState.errors.name.message}</span>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Lokalizacja</Label>
        <Input id="location" {...form.register("location")} placeholder="np. Gdańsk" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Adres</Label>
        <Input id="address" {...form.register("address")} placeholder="ul. Długa 1/2" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ownerName">Właściciel</Label>
        <Input id="ownerName" {...form.register("ownerName")} placeholder="Jan Kowalski" />
      </div>
      
      <DialogFooter>
        <Button type="submit" disabled={createApartment.isPending}>
          {createApartment.isPending ? "Dodawanie..." : "Dodaj apartament"}
        </Button>
      </DialogFooter>
    </form>
  );
}
