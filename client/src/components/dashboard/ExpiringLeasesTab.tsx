import { useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { differenceInDays } from "date-fns";
import type { Lease } from "@shared/schema";

export function ExpiringLeasesTab({ leases, apartments }: { leases: Lease[]; apartments: any[] }) {
  const expiringLeases = useMemo(() => {
    const today = new Date();
    const in6months = new Date(today);
    in6months.setMonth(in6months.getMonth() + 6);
    const todayStr = today.toISOString().split("T")[0];
    const in6monthsStr = in6months.toISOString().split("T")[0];

    return leases
      .filter(l => l.endDate && l.endDate >= todayStr && l.endDate <= in6monthsStr)
      .sort((a, b) => (a.endDate || "").localeCompare(b.endDate || ""));
  }, [leases]);

  const getAptName = (lease: Lease) => {
    if (!lease.apartmentId) return "—";
    const apt = apartments.find(a => a.id === lease.apartmentId);
    return apt?.name || "—";
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-expiring-leases-title">Kończące się umowy</h3>
        <p className="text-sm text-muted-foreground">Umowy najmu kończące się w ciągu najbliższych 6 miesięcy.</p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold">Apartament</TableHead>
              <TableHead className="text-xs font-semibold">Najemca</TableHead>
              <TableHead className="text-xs font-semibold">Początek</TableHead>
              <TableHead className="text-xs font-semibold">Koniec</TableHead>
              <TableHead className="text-xs font-semibold">Czynsz</TableHead>
              <TableHead className="text-xs font-semibold">Pozostało dni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expiringLeases.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Brak kończących się umów w najbliższych 6 miesiącach</TableCell></TableRow>
            )}
            {expiringLeases.map(l => {
              const daysLeft = l.endDate ? differenceInDays(new Date(l.endDate), new Date()) : 0;
              return (
                <TableRow key={l.id} data-testid={`row-expiring-lease-${l.id}`}>
                  <TableCell className="text-xs whitespace-nowrap font-medium">{getAptName(l)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{l.tenantName || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{l.startDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-semibold">{l.endDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-bold">{Number(l.rentAmount).toFixed(2)} zł</TableCell>
                  <TableCell className={`text-xs whitespace-nowrap font-semibold ${daysLeft < 30 ? "text-red-600 dark:text-red-400" : daysLeft < 90 ? "text-orange-600 dark:text-orange-400" : ""}`}>
                    {daysLeft} dni
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="text-sm text-muted-foreground" data-testid="text-expiring-count">
        {expiringLeases.length} kończących się umów
      </div>
    </div>
  );
}
