import { useState, useMemo } from "react";
import { useReservations, useUpdateReservation } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, Plane, Eye, Calendar, User, Home, CreditCard, Pencil } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReservationSchema, type InsertReservation, type Reservation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type SortField = "reservationNumber" | "addDate" | "apartmentName" | "startDate" | "endDate" | "guestName" | "price" | "prepayment" | "paidAmount" | "remaining";
type SortDir = "asc" | "desc";

function getApartmentName(reservation: Reservation, apartments: any[]): string {
  if (reservation.apartmentIds && reservation.apartmentIds.length > 1) {
    return reservation.apartmentIds.map(id => {
      const apt = apartments.find((a: any) => a.id === id);
      return apt?.name || `#${id}`;
    }).join(", ");
  }
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

export default function Arrivals() {
  const { data: reservations, isLoading } = useReservations();
  const { data: apartments } = useApartments();

  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [previewReservation, setPreviewReservation] = useState<Reservation | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const arrivals = useMemo(() => {
    if (!reservations) return [];
    let data = reservations.filter(r => r.status === "PRZYJETA");

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
        default: valA = a.startDate; valB = b.startDate;
      }
      if (typeof valA === "string") {
        const cmp = valA.localeCompare(valB, "pl");
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return data;
  }, [reservations, apartments, sortField, sortDir, filterDateFrom, filterDateTo]);

  const hasActiveFilters = filterDateFrom || filterDateTo;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Przyjazdy</h2>
          <p className="text-muted-foreground">Ładowanie danych...</p>
        </div>
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
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-arrivals-page-title">Przyjazdy</h2>
          <p className="text-muted-foreground">Rezerwacje ze statusem PRZYJĘTA, chronologicznie wg daty przyjazdu.</p>
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          data-testid="button-arrivals-page-toggle-filters"
        >
          <Filter className="mr-2 h-4 w-4" /> Filtry
          {hasActiveFilters && <Badge variant="secondary" className="ml-2 no-default-hover-elevate no-default-active-elevate">aktywne</Badge>}
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu od</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  data-testid="input-arrivals-page-filter-date-from"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu do</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  data-testid="input-arrivals-page-filter-date-to"
                />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }} data-testid="button-arrivals-page-clear-filters">
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
              <TableHead className="w-10"></TableHead>
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrivals.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  Brak przyjętych rezerwacji
                </TableCell>
              </TableRow>
            )}
            {arrivals.map(r => {
              const remaining = calcRemaining(r);
              return (
                <TableRow key={r.id} data-testid={`row-arrival-page-${r.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" onClick={() => setPreviewReservation(r)} data-testid={`button-preview-arrival-${r.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => setEditingReservation(r)} data-testid={`button-edit-arrival-${r.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-xs whitespace-nowrap">{r.reservationNumber}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.addDate || "—"}</TableCell>
                  <TableCell className="text-xs font-bold">
                    {(() => {
                      const name = getApartmentName(r, apartments || []);
                      return name.includes(",") ? (
                        <div className="flex flex-col gap-0.5">
                          {name.split(",").map((n, i) => (
                            <span key={i} className="whitespace-nowrap">{n.trim()}</span>
                          ))}
                        </div>
                      ) : (
                        <span className="whitespace-nowrap">{name}</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-semibold">{r.startDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.endDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.guestName}</TableCell>
                  <TableCell className="text-xs font-bold whitespace-nowrap">{Number(r.price).toFixed(2)} zł</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{Number(r.prepayment).toFixed(2)} zł</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{Number(r.paidAmount).toFixed(2)} zł</TableCell>
                  <TableCell className={`text-xs font-semibold whitespace-nowrap ${remaining > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                    {remaining.toFixed(2)} zł
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground" data-testid="text-arrivals-page-count">
        Wyświetlono {arrivals.length} przyjętych rezerwacji
      </div>

      <ArrivalPreviewDialog
        reservation={previewReservation}
        apartments={apartments || []}
        onClose={() => setPreviewReservation(null)}
      />

      <EditArrivalReservationDialog
        reservation={editingReservation}
        onClose={() => setEditingReservation(null)}
      />
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
        data-testid={`arrivals-page-sort-${field}`}
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

function calcNights(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function InfoRow({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-border last:border-b-0">
      <span className="text-xs text-muted-foreground w-44 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm ${highlight ? "font-bold" : "font-medium"}`}>{value || "—"}</span>
    </div>
  );
}

function ArrivalPreviewDialog({ reservation, apartments, onClose }: {
  reservation: Reservation | null;
  apartments: any[];
  onClose: () => void;
}) {
  if (!reservation) return null;

  const r = reservation;
  const aptName = getApartmentName(r, apartments);
  const remaining = calcRemaining(r);
  const nights = calcNights(r.startDate, r.endDate);
  const pricePerNight = nights > 0 ? Number(r.price) / nights : 0;

  return (
    <Dialog open={!!reservation} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap" data-testid="text-arrival-preview-title">
            <span>Rezerwacja #{r.reservationNumber}</span>
            <Badge className="text-xs whitespace-nowrap bg-green-600 hover:bg-green-700 text-white border-green-600">PRZYJĘTA</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="rounded-lg border border-border p-4 space-y-0">
            <div className="flex items-center gap-2 mb-3">
              <Home className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Apartament</span>
            </div>
            {aptName.includes(",") ? (
              <div className="flex flex-col gap-1 pl-6">
                {aptName.split(",").map((name, i) => (
                  <span key={i} className="text-sm font-bold">{name.trim()}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-bold pl-6">{aptName}</p>
            )}
          </div>

          <div className="rounded-lg border border-border p-4 space-y-0">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Gość</span>
            </div>
            <InfoRow label="Imię i nazwisko" value={r.guestName} highlight />
          </div>

          <div className="rounded-lg border border-border p-4 space-y-0">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Termin pobytu</span>
            </div>
            <InfoRow label="Data dodania" value={r.addDate} />
            <InfoRow label="Przyjazd" value={r.startDate} highlight />
            <InfoRow label="Wyjazd" value={r.endDate} highlight />
            <InfoRow label="Liczba noclegów" value={`${nights}`} />
          </div>

          <div className="rounded-lg border border-border p-4 space-y-0">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Rozliczenie</span>
            </div>
            <InfoRow label="Kwota pobytu" value={`${Number(r.price).toFixed(2)} zł`} highlight />
            <InfoRow label="Cena za noc" value={`${pricePerNight.toFixed(2)} zł`} />
            <InfoRow label="Zaliczka" value={`${Number(r.prepayment).toFixed(2)} zł`} />
            <InfoRow label="Wpłacona kwota" value={`${Number(r.paidAmount).toFixed(2)} zł`} />
            <div className="flex items-start gap-2 py-2.5 border-b border-border last:border-b-0">
              <span className="text-xs text-muted-foreground w-44 shrink-0 pt-0.5">Pozostało do zapłaty</span>
              <span className={`text-sm font-bold ${remaining > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                {remaining.toFixed(2)} zł
              </span>
            </div>
            {Number(r.surcharge) > 0 && (
              <InfoRow label="Dopłata" value={`${Number(r.surcharge).toFixed(2)} zł`} />
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={onClose} data-testid="button-close-arrival-preview">
              Zamknij
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditArrivalReservationDialog({ reservation, onClose }: {
  reservation: Reservation | null;
  onClose: () => void;
}) {
  if (!reservation) return null;
  return (
    <Dialog open={!!reservation} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-edit-arrival-reservation-title">
            Edytuj rezerwację #{reservation.reservationNumber}
          </DialogTitle>
        </DialogHeader>
        <EditArrivalForm reservation={reservation} onSuccess={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function EditArrivalForm({ reservation, onSuccess }: { reservation: Reservation; onSuccess: () => void }) {
  const updateReservation = useUpdateReservation();
  const { data: apartments } = useApartments();
  const { toast } = useToast();

  const form = useForm<InsertReservation>({
    resolver: zodResolver(insertReservationSchema),
    defaultValues: {
      reservationNumber: reservation.reservationNumber,
      apartmentId: reservation.apartmentId ?? undefined,
      addDate: reservation.addDate ?? undefined,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      guestName: reservation.guestName,
      price: reservation.price,
      prepayment: reservation.prepayment ?? "0",
      paidAmount: reservation.paidAmount ?? "0",
      surcharge: reservation.surcharge ?? "0",
      status: reservation.status,
    }
  });

  const onSubmit = (data: InsertReservation) => {
    updateReservation.mutate({ id: reservation.id, data }, {
      onSuccess: () => {
        toast({ title: "Sukces", description: "Rezerwacja zaktualizowana" });
        onSuccess();
      }
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
              <SelectTrigger data-testid="edit-arrival-select-apartment">
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
        <Label>Numer rezerwacji</Label>
        <Input {...form.register("reservationNumber")} data-testid="edit-arrival-input-number" />
      </div>
      <div className="space-y-2">
        <Label>Gość</Label>
        <Input {...form.register("guestName")} placeholder="Imię i nazwisko" data-testid="edit-arrival-input-guest" />
      </div>

      <div className="space-y-2">
        <Label>Data dodania</Label>
        <Input type="date" {...form.register("addDate")} data-testid="edit-arrival-input-adddate" />
      </div>

      <div className="space-y-2">
        <Label>Data przyjazdu</Label>
        <Input type="date" {...form.register("startDate")} data-testid="edit-arrival-input-start" />
      </div>
      <div className="space-y-2">
        <Label>Data wyjazdu</Label>
        <Input type="date" {...form.register("endDate")} data-testid="edit-arrival-input-end" />
      </div>

      <div className="space-y-2">
        <Label>Kwota pobytu (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("price")} data-testid="edit-arrival-input-price" />
      </div>
      <div className="space-y-2">
        <Label>Zaliczka (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("prepayment")} data-testid="edit-arrival-input-prepayment" />
      </div>
      <div className="space-y-2">
        <Label>Wpłacona kwota (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("paidAmount")} data-testid="edit-arrival-input-paidamount" />
      </div>
      <div className="space-y-2">
        <Label>Dopłata (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("surcharge")} data-testid="edit-arrival-input-surcharge" />
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger data-testid="edit-arrival-select-status">
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

      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onSuccess} data-testid="button-cancel-edit-arrival">
          Anuluj
        </Button>
        <Button type="submit" disabled={updateReservation.isPending} data-testid="button-submit-edit-arrival">
          {updateReservation.isPending ? "Zapisywanie..." : "Zapisz zmiany"}
        </Button>
      </div>
    </form>
  );
}
