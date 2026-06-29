import { useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { differenceInDays } from "date-fns";
import type { Lease } from "@shared/schema";
import type { DashboardReminders } from "./widget-utils";

type LeaseRow = { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null };

interface Props {
  leases: Lease[];
  apartments: any[];
  expiredLeases?: LeaseRow[];
  expiringLeases?: LeaseRow[];
}

export function ExpiringLeasesTab({ leases, apartments, expiredLeases = [], expiringLeases: expiringFromReminders }: Props) {
  const today = new Date().toISOString().split("T")[0];

  const expiringLeases = useMemo(() => {
    if (expiringFromReminders) return expiringFromReminders;
    const in6months = new Date();
    in6months.setMonth(in6months.getMonth() + 6);
    const in6monthsStr = in6months.toISOString().split("T")[0];
    return leases
      .filter(l => l.endDate && l.endDate >= today && l.endDate <= in6monthsStr)
      .sort((a, b) => (a.endDate || "").localeCompare(b.endDate || ""));
  }, [leases, expiringFromReminders, today]);

  const getAptName = (aptId: number | null) => {
    if (!aptId) return "—";
    return apartments.find(a => a.id === aptId)?.name || "—";
  };

  const daysSince = (dateStr: string | null) =>
    dateStr ? differenceInDays(new Date(), new Date(dateStr)) : 0;
  const daysLeft = (dateStr: string | null) =>
    dateStr ? differenceInDays(new Date(dateStr), new Date()) : 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-expiring-leases-title">Umowy najmu</h3>
        <p className="text-sm text-muted-foreground">Wygasłe i kończące się umowy najmu.</p>
      </div>

      {expiredLeases.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-destructive">Wygasłe umowy</span>
            <Badge variant="destructive">{expiredLeases.length}</Badge>
          </div>
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-destructive/10">
                  <TableHead className="text-xs font-semibold">Apartament</TableHead>
                  <TableHead className="text-xs font-semibold">Najemca</TableHead>
                  <TableHead className="text-xs font-semibold">Data wygaśnięcia</TableHead>
                  <TableHead className="text-xs font-semibold">Dni od wygaśnięcia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expiredLeases.map(l => (
                  <TableRow key={l.id} data-testid={`row-expired-lease-${l.id}`}>
                    <TableCell className="text-xs font-medium">{getAptName(l.apartmentId)}</TableCell>
                    <TableCell className="text-xs">{l.tenantName || "—"}</TableCell>
                    <TableCell className="text-xs font-semibold text-destructive">{l.endDate}</TableCell>
                    <TableCell className="text-xs font-bold text-destructive">{daysSince(l.endDate)} dni temu</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Kończące się (6 miesięcy)</span>
          {expiringLeases.length > 0 && <Badge variant="secondary">{expiringLeases.length}</Badge>}
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Apartament</TableHead>
                <TableHead className="text-xs font-semibold">Najemca</TableHead>
                <TableHead className="text-xs font-semibold">Koniec</TableHead>
                <TableHead className="text-xs font-semibold">Pozostało</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiringLeases.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Brak kończących się umów w najbliższych 6 miesiącach
                  </TableCell>
                </TableRow>
              )}
              {expiringLeases.map(l => {
                const left = daysLeft(l.endDate);
                return (
                  <TableRow key={l.id} data-testid={`row-expiring-lease-${l.id}`}>
                    <TableCell className="text-xs font-medium">{getAptName(l.apartmentId)}</TableCell>
                    <TableCell className="text-xs">{l.tenantName || "—"}</TableCell>
                    <TableCell className="text-xs font-semibold">{l.endDate}</TableCell>
                    <TableCell className={`text-xs font-semibold ${left < 30 ? "text-destructive" : left < 90 ? "text-orange-600 dark:text-orange-400" : ""}`}>
                      {left} dni
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="text-sm text-muted-foreground" data-testid="text-expiring-count">
        {expiredLeases.length > 0 && <span className="text-destructive font-medium">{expiredLeases.length} wygasłych · </span>}
        {expiringLeases.length} kończących się
      </div>
    </div>
  );
}
