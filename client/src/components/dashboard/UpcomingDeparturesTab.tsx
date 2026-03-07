import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { Reservation } from "@shared/schema";
import { SortableHeader } from "./SortableHeader";
import {
  calcRemaining, getApartmentName, statusLabel, statusVariant,
  type SortField, type SortDir,
} from "./widget-utils";

export function UpcomingDeparturesTab({ reservations, apartments, isLoading }: { reservations: Reservation[]; apartments: any[]; isLoading: boolean }) {
  const [sortField, setSortField] = useState<SortField>("endDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const upcoming = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const in7days = new Date(today);
    in7days.setDate(in7days.getDate() + 7);
    const in7daysStr = in7days.toISOString().split("T")[0];

    let data = reservations.filter(r => {
      if (r.status === "ANULOWANA") return false;
      return r.endDate >= todayStr && r.endDate <= in7daysStr;
    });

    data.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case "reservationNumber": valA = a.reservationNumber; valB = b.reservationNumber; break;
        case "apartmentName": valA = getApartmentName(a, apartments); valB = getApartmentName(b, apartments); break;
        case "startDate": valA = a.startDate; valB = b.startDate; break;
        case "endDate": valA = a.endDate; valB = b.endDate; break;
        case "guestName": valA = a.guestName; valB = b.guestName; break;
        case "price": valA = Number(a.price); valB = Number(b.price); break;
        case "remaining": valA = calcRemaining(a); valB = calcRemaining(b); break;
        default: valA = a.endDate; valB = b.endDate;
      }
      if (typeof valA === "string") return sortDir === "asc" ? valA.localeCompare(valB, "pl") : valB.localeCompare(valA, "pl");
      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return data;
  }, [reservations, apartments, sortField, sortDir]);

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}</div>;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-upcoming-departures-title">Najbliższe wyjazdy</h3>
        <p className="text-sm text-muted-foreground">Rezerwacje kończące się w ciągu najbliższych 7 dni.</p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto max-h-[50vh] lg:max-h-none">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <SortableHeader field="reservationNumber" label="Numer" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="apartmentName" label="Apartament" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="startDate" label="Przyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="endDate" label="Wyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="guestName" label="Gość" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="price" label="Kwota" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="remaining" label="Dopłata" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <TableHead className="text-xs font-semibold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {upcoming.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Brak wyjazdów w ciągu 7 dni</TableCell></TableRow>
            )}
            {upcoming.map(r => {
              const remaining = calcRemaining(r);
              return (
                <TableRow key={r.id} data-testid={`row-departure-${r.id}`}>
                  <TableCell className="font-medium text-xs whitespace-nowrap">{r.reservationNumber}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{getApartmentName(r, apartments)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.startDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-semibold">{r.endDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.guestName}</TableCell>
                  <TableCell className="text-xs font-bold whitespace-nowrap">{Number(r.price).toFixed(2)} zł</TableCell>
                  <TableCell className={`text-xs font-semibold whitespace-nowrap ${remaining > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                    {remaining.toFixed(2)} zł
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.status)} className="text-xs">{statusLabel(r.status)}</Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground" data-testid="text-departures-count">
        {upcoming.length} wyjazdów w ciągu 7 dni
      </div>
    </div>
  );
}
