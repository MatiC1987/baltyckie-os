import { useState, useMemo } from "react";
import { useReservations } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowUpDown, ArrowUp, ArrowDown, Filter, Plane } from "lucide-react";
import type { Reservation } from "@shared/schema";

type SortField = "reservationNumber" | "addDate" | "apartmentName" | "startDate" | "endDate" | "guestName" | "price" | "prepayment" | "paidAmount" | "remaining";
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

export default function Arrivals() {
  const { data: reservations, isLoading } = useReservations();
  const { data: apartments } = useApartments();

  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

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
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Brak przyjętych rezerwacji
                </TableCell>
              </TableRow>
            )}
            {arrivals.map(r => {
              const remaining = calcRemaining(r);
              return (
                <TableRow key={r.id} data-testid={`row-arrival-page-${r.id}`}>
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
