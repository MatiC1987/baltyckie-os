import { useState, useMemo } from "react";
import { useReservations, useCreateReservation, useUpdateReservation } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, Filter } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReservationSchema, type InsertReservation, type Reservation } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type SortField = "reservationNumber" | "addDate" | "apartmentName" | "startDate" | "endDate" | "guestName" | "price" | "prepayment" | "paidAmount" | "remaining" | "status";
type SortDir = "asc" | "desc";

function getApartmentName(reservation: Reservation, apartments: any[]): string {
  if (!reservation.apartmentId) return "—";
  const apt = apartments.find((a: any) => a.id === reservation.apartmentId);
  return apt?.name || "—";
}

function calcRemaining(r: Reservation): number {
  const price = Number(r.price) || 0;
  const prepayment = Number(r.prepayment) || 0;
  const paid = Number(r.paidAmount) || 0;
  return Math.max(0, price - prepayment - paid);
}

function statusLabel(status: string): string {
  switch (status) {
    case "DO_OPLACENIA": return "DO OPŁACENIA";
    case "PRZYJETA": return "PRZYJĘTA";
    case "ANULOWANA": return "ANULOWANA";
    default: return status;
  }
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PRZYJETA": return "default";
    case "ANULOWANA": return "destructive";
    case "DO_OPLACENIA": return "secondary";
    default: return "outline";
  }
}

export default function Reservations() {
  const { data: reservations, isLoading } = useReservations();
  const { data: apartments } = useApartments();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [showFilters, setShowFilters] = useState(false);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const filteredAndSorted = useMemo(() => {
    if (!reservations) return [];
    let data = [...reservations];

    if (filterStatus !== "ALL") {
      data = data.filter(r => r.status === filterStatus);
    }
    if (filterDateFrom) {
      data = data.filter(r => r.startDate >= filterDateFrom);
    }
    if (filterDateTo) {
      data = data.filter(r => r.startDate <= filterDateTo);
    }

    data.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case "reservationNumber": valA = a.reservationNumber; valB = b.reservationNumber; break;
        case "addDate": valA = a.addDate || ""; valB = b.addDate || ""; break;
        case "apartmentName":
          valA = getApartmentName(a, apartments || []);
          valB = getApartmentName(b, apartments || []);
          break;
        case "startDate": valA = a.startDate; valB = b.startDate; break;
        case "endDate": valA = a.endDate; valB = b.endDate; break;
        case "guestName": valA = a.guestName; valB = b.guestName; break;
        case "price": valA = Number(a.price); valB = Number(b.price); break;
        case "prepayment": valA = Number(a.prepayment); valB = Number(b.prepayment); break;
        case "paidAmount": valA = Number(a.paidAmount); valB = Number(b.paidAmount); break;
        case "remaining": valA = calcRemaining(a); valB = calcRemaining(b); break;
        case "status": valA = a.status; valB = b.status; break;
        default: valA = a.startDate; valB = b.startDate;
      }
      if (typeof valA === "string") {
        const cmp = valA.localeCompare(valB, "pl");
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return data;
  }, [reservations, apartments, sortField, sortDir, filterStatus, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterStatus("ALL");
  };

  const hasActiveFilters = filterDateFrom || filterDateTo || filterStatus !== "ALL";

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-reservations-title">Rezerwacje</h2>
          <p className="text-muted-foreground">Lista wszystkich rezerwacji krótkoterminowych.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-toggle-filters"
          >
            <Filter className="mr-2 h-4 w-4" /> Filtry
            {hasActiveFilters && <Badge variant="secondary" className="ml-2 no-default-hover-elevate no-default-active-elevate">aktywne</Badge>}
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-reservation">
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
      </div>

      {showFilters && (
        <Card data-testid="card-filters">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu od</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  data-testid="input-filter-date-from"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu do</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  data-testid="input-filter-date-to"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger data-testid="select-filter-status" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Wszystkie</SelectItem>
                    <SelectItem value="DO_OPLACENIA">DO OPŁACENIA</SelectItem>
                    <SelectItem value="PRZYJETA">PRZYJĘTA</SelectItem>
                    <SelectItem value="ANULOWANA">ANULOWANA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} data-testid="button-clear-filters">
                  Wyczyść filtry
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <SortableHeader field="reservationNumber" label="Numer" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="addDate" label="Data dodania" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="apartmentName" label="Apartament" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="startDate" label="Przyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="endDate" label="Wyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="guestName" label="Imię i nazwisko" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="price" label="Kwota pobytu" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="prepayment" label="Zaliczka" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="paidAmount" label="Wpłacona" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="remaining" label="Pozostało" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  Brak rezerwacji
                </TableCell>
              </TableRow>
            )}
            {filteredAndSorted.map(r => (
              <ReservationRow key={r.id} reservation={r} apartments={apartments || []} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground" data-testid="text-reservations-count">
        Wyświetlono {filteredAndSorted.length} z {reservations?.length || 0} rezerwacji
      </div>
    </div>
  );
}

function SortableHeader({ field, label, sortField, sortDir, onSort }: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = sortField === field;
  return (
    <TableHead>
      <button
        onClick={() => onSort(field)}
        className="flex items-center text-xs font-semibold whitespace-nowrap hover-elevate px-1 py-1 rounded"
        data-testid={`sort-${field}`}
      >
        {label}
        {isActive
          ? (sortDir === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />)
          : <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />
        }
      </button>
    </TableHead>
  );
}

function ReservationRow({ reservation: r, apartments }: { reservation: Reservation; apartments: any[] }) {
  const updateReservation = useUpdateReservation();
  const { toast } = useToast();
  const [editingPaid, setEditingPaid] = useState(false);
  const [paidValue, setPaidValue] = useState(r.paidAmount || "0");
  const [editingStatus, setEditingStatus] = useState(false);

  const isCancelled = r.status === "ANULOWANA";
  const remaining = calcRemaining(r);
  const aptName = getApartmentName(r, apartments);

  const savePaidAmount = () => {
    const numVal = Number(paidValue);
    if (isNaN(numVal) || numVal < 0) {
      toast({ title: "Błąd", description: "Podaj prawidłową kwotę", variant: "destructive" });
      return;
    }
    updateReservation.mutate({ id: r.id, data: { paidAmount: String(numVal) } });
    setEditingPaid(false);
  };

  const changeStatus = (newStatus: string) => {
    updateReservation.mutate({ id: r.id, data: { status: newStatus } });
    setEditingStatus(false);
  };

  return (
    <TableRow
      className={isCancelled ? "bg-red-50 dark:bg-red-950/30" : ""}
      data-testid={`row-reservation-${r.id}`}
    >
      <TableCell className="font-medium text-xs whitespace-nowrap" data-testid={`text-res-number-${r.id}`}>
        {r.reservationNumber}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`text-res-adddate-${r.id}`}>
        {r.addDate || "—"}
      </TableCell>
      <TableCell className="text-xs" data-testid={`text-res-apartment-${r.id}`}>
        {aptName.includes(",") ? (
          <div className="flex flex-col gap-0.5">
            {aptName.split(",").map((name, i) => (
              <span key={i} className="whitespace-nowrap">{name.trim()}</span>
            ))}
          </div>
        ) : (
          <span className="whitespace-nowrap">{aptName}</span>
        )}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`text-res-start-${r.id}`}>
        {r.startDate}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`text-res-end-${r.id}`}>
        {r.endDate}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`text-res-guest-${r.id}`}>
        {r.guestName}
      </TableCell>
      <TableCell className="text-xs font-bold whitespace-nowrap" data-testid={`text-res-price-${r.id}`}>
        {Number(r.price).toFixed(2)} zł
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`text-res-prepayment-${r.id}`}>
        {Number(r.prepayment).toFixed(2)} zł
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`cell-res-paid-${r.id}`}>
        {editingPaid ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              step="0.01"
              value={paidValue}
              onChange={e => setPaidValue(e.target.value)}
              className="w-24 h-7 text-xs"
              onKeyDown={e => { if (e.key === "Enter") savePaidAmount(); if (e.key === "Escape") setEditingPaid(false); }}
              autoFocus
              data-testid={`input-res-paid-${r.id}`}
            />
            <Button size="sm" variant="ghost" onClick={savePaidAmount} className="h-7 px-2 text-xs" data-testid={`button-save-paid-${r.id}`}>OK</Button>
          </div>
        ) : (
          <button
            onClick={() => { setPaidValue(r.paidAmount || "0"); setEditingPaid(true); }}
            className="hover-elevate px-2 py-1 rounded text-left min-w-[60px]"
            data-testid={`button-edit-paid-${r.id}`}
          >
            {Number(r.paidAmount).toFixed(2)} zł
          </button>
        )}
      </TableCell>
      <TableCell className={`text-xs font-semibold whitespace-nowrap ${remaining > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`} data-testid={`text-res-remaining-${r.id}`}>
        {remaining.toFixed(2)} zł
      </TableCell>
      <TableCell data-testid={`cell-res-status-${r.id}`}>
        {editingStatus ? (
          <Select value={r.status} onValueChange={changeStatus}>
            <SelectTrigger className="w-[150px] h-7 text-xs" data-testid={`select-res-status-${r.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DO_OPLACENIA">DO OPŁACENIA</SelectItem>
              <SelectItem value="PRZYJETA">PRZYJĘTA</SelectItem>
              <SelectItem value="ANULOWANA">ANULOWANA</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <button onClick={() => setEditingStatus(true)} data-testid={`button-edit-status-${r.id}`}>
            <Badge variant={statusVariant(r.status)} className="text-xs whitespace-nowrap">
              {statusLabel(r.status)}
            </Badge>
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}

function ReservationForm({ onSuccess }: { onSuccess: () => void }) {
  const createReservation = useCreateReservation();
  const { data: apartments } = useApartments();

  const form = useForm<InsertReservation>({
    resolver: zodResolver(insertReservationSchema),
    defaultValues: {
      reservationNumber: `RES-${Date.now().toString().slice(-6)}`,
      status: "DO_OPLACENIA",
      prepayment: "0",
      paidAmount: "0",
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
        <Label>Imię i nazwisko</Label>
        <Input {...form.register("guestName")} placeholder="Imię i nazwisko" data-testid="input-reservation-guest" />
      </div>
      <div className="space-y-2">
        <Label>Kwota pobytu (PLN)</Label>
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
        <Label>Zaliczka (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("prepayment")} data-testid="input-reservation-prepayment" />
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger data-testid="select-reservation-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DO_OPLACENIA">DO OPŁACENIA</SelectItem>
                <SelectItem value="PRZYJETA">PRZYJĘTA</SelectItem>
                <SelectItem value="ANULOWANA">ANULOWANA</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="col-span-2 pt-4 flex justify-end">
        <Button type="submit" disabled={createReservation.isPending} data-testid="button-submit-reservation">
          {createReservation.isPending ? "Zapisywanie..." : "Zapisz rezerwację"}
        </Button>
      </div>
    </form>
  );
}
