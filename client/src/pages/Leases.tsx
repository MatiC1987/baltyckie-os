import { useState } from "react";
import { useLeases, useCreateLease } from "@/hooks/use-leases";
import { useApartments } from "@/hooks/use-apartments";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Plus, FileText } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeaseSchema, type InsertLease } from "@shared/schema";

export default function Leases() {
  const { data: leases, isLoading } = useLeases();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const columns = [
    {
      header: "Apartament",
      cell: (l: any) => (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
            <FileText className="h-4 w-4" />
          </div>
          <span className="font-medium">#{l.apartmentId}</span>
        </div>
      )
    },
    {
      header: "Najemca",
      accessorKey: "tenantName" as const,
    },
    {
      header: "Czynsz",
      cell: (l: any) => <span className="font-bold">{l.rentAmount} PLN</span>
    },
    {
      header: "Czynsz do wspólnoty",
      cell: (l: any) => <span>{l.communityFee || "0"} PLN</span>
    },
    {
      header: "Okres",
      cell: (l: any) => (
        <span className="text-sm">
          {l.startDate} {l.endDate ? `- ${l.endDate}` : '- bezterminowa'}
        </span>
      )
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-leases-title">Umowy najmu</h2>
          <p className="text-muted-foreground">Zarzadzaj umowami dlugoterminowego najmu.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-lease">
              <Plus className="mr-2 h-4 w-4" /> Dodaj umowe
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nowa umowa najmu</DialogTitle>
            </DialogHeader>
            <LeaseForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        data={leases || []}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="Brak umow najmu. Dodaj pierwsza!"
      />
    </div>
  );
}

function LeaseForm({ onSuccess }: { onSuccess: () => void }) {
  const createLease = useCreateLease();
  const { data: apartments } = useApartments();

  const form = useForm<InsertLease>({
    resolver: zodResolver(insertLeaseSchema),
    defaultValues: {
      rentAmount: "0",
      communityFee: "0",
      tenantName: "",
      description: "",
    }
  });

  const onSubmit = (data: InsertLease) => {
    createLease.mutate(data, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label>Apartament</Label>
          <Controller
            control={form.control}
            name="apartmentId"
            render={({ field }) => (
              <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                <SelectTrigger data-testid="select-lease-apartment">
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
          <Label>Najemca</Label>
          <Input {...form.register("tenantName")} placeholder="Imie i nazwisko" data-testid="input-lease-tenant" />
        </div>
        <div className="space-y-2">
          <Label>Czynsz (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("rentAmount")} data-testid="input-lease-rent" />
        </div>

        <div className="space-y-2">
          <Label>Data poczatku</Label>
          <Input type="date" {...form.register("startDate")} data-testid="input-lease-start" />
        </div>
        <div className="space-y-2">
          <Label>Data konca (opcjonalnie)</Label>
          <Input type="date" {...form.register("endDate")} data-testid="input-lease-end" />
        </div>

        <div className="space-y-2">
          <Label>Czynsz do wspólnoty (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("communityFee")} data-testid="input-lease-community" />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={createLease.isPending} data-testid="button-submit-lease">
          {createLease.isPending ? "Zapisywanie..." : "Zapisz umowe"}
        </Button>
      </DialogFooter>
    </form>
  );
}
