import { useState } from "react";
import { useReservations, useCreateReservation } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReservationSchema, type InsertReservation } from "@shared/schema";
import { format } from "date-fns";

export default function Reservations() {
  const { data: reservations, isLoading } = useReservations();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const columns = [
    {
      header: "Numer",
      accessorKey: "reservationNumber",
      className: "font-medium"
    },
    {
      header: "Gość",
      accessorKey: "guestName",
    },
    {
      header: "Data przyjazdu",
      cell: (r: any) => format(new Date(r.startDate), "yyyy-MM-dd"),
    },
    {
      header: "Data wyjazdu",
      cell: (r: any) => format(new Date(r.endDate), "yyyy-MM-dd"),
    },
    {
      header: "Cena",
      cell: (r: any) => <span className="font-bold">{r.price} PLN</span>
    },
    {
      header: "Status",
      cell: (r: any) => (
        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
          {r.status}
        </span>
      )
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-reservations-title">Rezerwacje</h2>
          <p className="text-muted-foreground">Lista wszystkich rezerwacji krótkoterminowych.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="shadow-lg shadow-primary/20" data-testid="button-add-reservation">
              <Plus className="mr-2 h-4 w-4" /> Dodaj rezerwację
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nowa rezerwacja</DialogTitle>
            </DialogHeader>
            <ReservationForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable 
        data={reservations || []} 
        columns={columns} 
        isLoading={isLoading}
      />
    </div>
  );
}

function ReservationForm({ onSuccess }: { onSuccess: () => void }) {
  const createReservation = useCreateReservation();
  const { data: apartments } = useApartments();
  
  const form = useForm<InsertReservation>({
    resolver: zodResolver(insertReservationSchema),
    defaultValues: {
      reservationNumber: `RES-${Date.now().toString().slice(-6)}`,
      status: "CONFIRMED",
      prepayment: "0",
      surcharge: "0",
    }
  });

  const onSubmit = (data: InsertReservation) => {
    createReservation.mutate(data, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 grid grid-cols-2 gap-4">
      <div className="space-y-2 col-span-2">
        <Label>Apartament</Label>
        <Controller
          control={form.control}
          name="apartmentId"
          render={({ field }) => (
            <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
              <SelectTrigger data-testid="select-reservation-apartment">
                <SelectValue placeholder="Wybierz apartament" />
              </SelectTrigger>
              <SelectContent>
                {apartments?.map((apt) => (
                  <SelectItem key={apt.id} value={apt.id.toString()}>{apt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label>Gość</Label>
        <Input {...form.register("guestName")} placeholder="Imię i nazwisko" data-testid="input-reservation-guest" />
      </div>
      <div className="space-y-2">
        <Label>Cena (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("price")} data-testid="input-reservation-price" />
      </div>

      <div className="space-y-2">
        <Label>Data przyjazdu</Label>
        <Input type="date" {...form.register("startDate")} data-testid="input-reservation-start" />
      </div>
      <div className="space-y-2">
        <Label>Data wyjazdu</Label>
        <Input type="date" {...form.register("endDate")} data-testid="input-reservation-end" />
      </div>

      <div className="space-y-2">
        <Label>Zaliczka</Label>
        <Input type="number" step="0.01" {...form.register("prepayment")} data-testid="input-reservation-prepayment" />
      </div>
      <div className="space-y-2">
        <Label>Dopłata</Label>
        <Input type="number" step="0.01" {...form.register("surcharge")} data-testid="input-reservation-surcharge" />
      </div>
      
      <div className="col-span-2 pt-4 flex justify-end">
        <Button type="submit" disabled={createReservation.isPending} data-testid="button-submit-reservation">
          {createReservation.isPending ? "Zapisywanie..." : "Zapisz rezerwację"}
        </Button>
      </div>
    </form>
  );
}
