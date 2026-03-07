import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import type { SubleasePaymentExtended } from "./widget-utils";

export function UnpaidSubleasesTab({ payments, apartments }: { payments: SubleasePaymentExtended[]; apartments: any[] }) {
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const ITEMS_LIMIT = 10;
  const today = new Date().toISOString().split("T")[0];
  const in7days = new Date();
  in7days.setDate(in7days.getDate() + 7);
  const in7daysStr = in7days.toISOString().split("T")[0];

  const todayPayments = useMemo(() =>
    payments.filter(p => p.status === "do_oplacenia" && p.dueDate <= today),
    [payments, today]
  );

  const upcomingPayments = useMemo(() =>
    payments.filter(p => p.status === "do_oplacenia" && p.dueDate > today && p.dueDate <= in7daysStr),
    [payments, today, in7daysStr]
  );

  const getAptNames = (p: SubleasePaymentExtended) => {
    if (p.apartmentId) {
      const apt = apartments.find(a => a.id === p.apartmentId);
      return apt?.name || "—";
    }
    return p.subleaseApartmentIds.map(id => apartments.find(a => a.id === id)?.name || "?").join(", ") || "—";
  };

  const totalOverdue = todayPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalUpcoming = upcomingPayments.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold" data-testid="text-unpaid-subleases-title">Nieopłacone podnajmy</h3>
        <p className="text-sm text-muted-foreground">Płatności z podnajem - rozliczenie do zapłaty.</p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-base font-medium">Zaległe i na dziś ({todayPayments.length})</h4>
          {todayPayments.length > 0 && (
            <Badge variant="destructive" data-testid="badge-overdue-sublease-total">
              {totalOverdue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
            </Badge>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Najemca</TableHead>
                <TableHead className="text-xs font-semibold">Apartament</TableHead>
                <TableHead className="text-xs font-semibold">Tytuł</TableHead>
                <TableHead className="text-xs font-semibold">Termin</TableHead>
                <TableHead className="text-xs font-semibold">Kwota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayPayments.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Brak zaległych płatności</TableCell></TableRow>
              )}
              {(showAllOverdue ? todayPayments : todayPayments.slice(0, ITEMS_LIMIT)).map(p => (
                <TableRow key={p.id} data-testid={`row-overdue-sublease-${p.id}`}>
                  <TableCell className="text-xs whitespace-nowrap">{p.subleaseTenantName}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{getAptNames(p)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{p.title}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-semibold text-red-600 dark:text-red-400">{p.dueDate}</TableCell>
                  <TableCell className="text-xs font-bold whitespace-nowrap">{Number(p.amount).toFixed(2)} zł</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {todayPayments.length > ITEMS_LIMIT && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAllOverdue(!showAllOverdue)} data-testid="button-show-more-overdue-subleases">
              {showAllOverdue ? "Pokaż mniej" : `Pokaż więcej (${todayPayments.length - ITEMS_LIMIT})`}
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h4 className="text-base font-medium">Najbliższe 7 dni ({upcomingPayments.length})</h4>
          {upcomingPayments.length > 0 && (
            <Badge variant="secondary" data-testid="badge-upcoming-sublease-total">
              {totalUpcoming.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
            </Badge>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Najemca</TableHead>
                <TableHead className="text-xs font-semibold">Apartament</TableHead>
                <TableHead className="text-xs font-semibold">Tytuł</TableHead>
                <TableHead className="text-xs font-semibold">Termin</TableHead>
                <TableHead className="text-xs font-semibold">Kwota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcomingPayments.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Brak płatności w najbliższych 7 dniach</TableCell></TableRow>
              )}
              {(showAllUpcoming ? upcomingPayments : upcomingPayments.slice(0, ITEMS_LIMIT)).map(p => (
                <TableRow key={p.id} data-testid={`row-upcoming-sublease-${p.id}`}>
                  <TableCell className="text-xs whitespace-nowrap">{p.subleaseTenantName}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{getAptNames(p)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{p.title}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{p.dueDate}</TableCell>
                  <TableCell className="text-xs font-bold whitespace-nowrap">{Number(p.amount).toFixed(2)} zł</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {upcomingPayments.length > ITEMS_LIMIT && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowAllUpcoming(!showAllUpcoming)} data-testid="button-show-more-upcoming-subleases">
              {showAllUpcoming ? "Pokaż mniej" : `Pokaż więcej (${upcomingPayments.length - ITEMS_LIMIT})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
