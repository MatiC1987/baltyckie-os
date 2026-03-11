import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertCircle, CalendarClock, FileWarning, Wrench, GraduationCap, FileSignature,
} from "lucide-react";
import type { Reservation } from "@shared/schema";
import { SortableHeader } from "./SortableHeader";
import {
  calcRemaining, getApartmentName,
  type SortField, type SortDir, type DashboardReminders,
} from "./widget-utils";

function PendingReadingsReminder() {
  const { data: pendingReadings } = useQuery<{ subleaseId: number; readings: any[] }[]>({ queryKey: ["/api/pending-meter-readings"] });
  const count = pendingReadings?.reduce((s, g) => s + g.readings.length, 0) || 0;
  if (count === 0) return null;
  return (
    <Card className="border-amber-500/50" data-testid="card-pending-readings-reminder">
      <CardContent className="py-3 px-4">
        <Link href="/podnajem?tab=media">
          <div className="flex items-center gap-2 text-sm cursor-pointer hover-elevate" data-testid="reminder-pending-readings">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>Odczyty liczników do weryfikacji: <strong>{count}</strong></span>
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

export function UnpaidArrivalsTab({ reservations, apartments, isLoading, reminders, expiringTrainings, expiringContracts }: {
  reservations: Reservation[];
  apartments: any[];
  isLoading: boolean;
  reminders?: DashboardReminders;
  expiringTrainings?: { id: number; name: string; status: string; employeeName: string; expiryDate: string | null }[];
  expiringContracts?: { id: number; title: string; employeeName: string; endDate: string | null }[];
}) {
  const [sortField, setSortField] = useState<SortField>("endDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showAll, setShowAll] = useState(false);
  const ITEMS_LIMIT = 10;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const unpaidCompleted = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let data = reservations.filter(r => {
      if (r.status === "ANULOWANA") return false;
      if (!r.startDate || r.startDate < "2026-01-01") return false;
      const remaining = calcRemaining(r);
      return remaining > 0 && r.endDate && r.endDate <= today;
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

  const totalUnpaid = useMemo(() => unpaidCompleted.reduce((s, r) => s + calcRemaining(r), 0), [unpaidCompleted]);

  if (isLoading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}</div>;

  const hasReminders = (reminders && (
    reminders.expiringExams.length > 0 ||
    reminders.overdueCosts > 0 ||
    reminders.overdueSubleasePayments > 0 ||
    reminders.expiringLeases.length > 0 ||
    reminders.expiringSubleases.length > 0 ||
    (reminders.upcomingInspections && reminders.upcomingInspections.length > 0)
  )) || (expiringTrainings && expiringTrainings.length > 0) || (expiringContracts && expiringContracts.length > 0);

  return (
    <div className="space-y-3">
      <PendingReadingsReminder />
      {hasReminders && (
        <Card data-testid="card-reminders">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Przypomnienia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reminders?.overdueCosts && reminders.overdueCosts > 0 && (
              <Link href="/v2/koszty">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid="reminder-overdue-costs">
                  <FileWarning className="h-4 w-4 text-red-500 shrink-0" />
                  <span>Zaległe opłaty kosztów: <strong>{reminders.overdueCosts}</strong></span>
                </div>
              </Link>
            )}
            {reminders?.overdueSubleasePayments && reminders.overdueSubleasePayments > 0 && (
              <Link href="/podnajem">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid="reminder-overdue-sublease">
                  <FileWarning className="h-4 w-4 text-red-500 shrink-0" />
                  <span>Zaległe płatności podnajmu: <strong>{reminders.overdueSubleasePayments}</strong></span>
                </div>
              </Link>
            )}
            {(reminders?.expiringExams || []).map(exam => (
              <Link key={exam.id} href="/employees">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-exam-${exam.id}`}>
                  <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Badanie <strong>{exam.examName}</strong> pracownika {exam.employeeName} wygasa {exam.validUntil}</span>
                </div>
              </Link>
            ))}
            {(reminders?.expiringLeases || []).map(lease => (
              <Link key={lease.id} href="/apartment-schedule">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-lease-${lease.id}`}>
                  <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Najem {lease.tenantName || "—"} kończy się {lease.endDate}</span>
                </div>
              </Link>
            ))}
            {(reminders?.expiringSubleases || []).map(sub => (
              <Link key={sub.id} href="/podnajem">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-sublease-${sub.id}`}>
                  <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Podnajem {sub.tenantName || "—"} kończy się {sub.endDate}</span>
                </div>
              </Link>
            ))}
            {(reminders?.upcomingInspections || []).map(insp => {
              const typeLabels: Record<string, string> = {
                GAZOWY: "gazowy", ELEKTRYCZNY: "elektryczny", KOMINIARSKI: "kominiarski",
                WENTYLACYJNY: "wentylacyjny", BUDOWLANY: "budowlany", PPOZ: "p.poż.", INNE: "inny"
              };
              return (
                <Link key={insp.id} href="/przeglady">
                  <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-inspection-${insp.id}`}>
                    <Wrench className={`h-4 w-4 shrink-0 ${insp.isOverdue ? 'text-red-500' : 'text-amber-500'}`} />
                    <span>
                      {insp.isOverdue ? "Przeterminowany" : "Zbliżający się"} przegląd {typeLabels[insp.inspectionType] || insp.inspectionType} — {insp.nextDate}
                    </span>
                  </div>
                </Link>
              );
            })}
            {(expiringTrainings || []).length > 0 && (
              <Link href="/szkolenia">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid="reminder-expiring-trainings">
                  <GraduationCap className="h-4 w-4 text-amber-500 shrink-0" />
                  <span><strong>{(expiringTrainings || []).length}</strong> szkoleń wygasa w ciągu 30 dni</span>
                </div>
              </Link>
            )}
            {(expiringContracts || []).length > 0 && (
              <Link href="/umowy-pracownicze">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid="reminder-expiring-contracts">
                  <FileSignature className="h-4 w-4 text-amber-500 shrink-0" />
                  <span><strong>{(expiringContracts || []).length}</strong> umów pracowniczych kończy się w ciągu 30 dni</span>
                </div>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-unpaid-arrivals-title">Nieopłacone przyjazdy</h3>
          <p className="text-sm text-muted-foreground">Zakończone rezerwacje z nieopłaconą dopłatą.</p>
        </div>
        {unpaidCompleted.length > 0 && (
          <Badge variant="destructive" data-testid="badge-unpaid-total">
            Łącznie: {totalUnpaid.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
          </Badge>
        )}
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {unpaidCompleted.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Brak nieopłaconych rezerwacji</TableCell></TableRow>
            )}
            {(showAll ? unpaidCompleted : unpaidCompleted.slice(0, ITEMS_LIMIT)).map(r => (
              <TableRow key={r.id} data-testid={`row-unpaid-${r.id}`}>
                <TableCell className="font-medium text-xs whitespace-nowrap">{r.reservationNumber}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{getApartmentName(r, apartments)}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.startDate}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.endDate}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{r.guestName}</TableCell>
                <TableCell className="text-xs whitespace-nowrap">{Number(r.price).toFixed(2)} zł</TableCell>
                <TableCell className="text-xs font-semibold whitespace-nowrap text-red-600 dark:text-red-400">{calcRemaining(r).toFixed(2)} zł</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-muted-foreground" data-testid="text-unpaid-count">
          {unpaidCompleted.length} nieopłaconych rezerwacji
        </div>
        {unpaidCompleted.length > ITEMS_LIMIT && (
          <Button variant="outline" size="sm" onClick={() => setShowAll(!showAll)} data-testid="button-show-more-unpaid">
            {showAll ? "Pokaż mniej" : `Pokaż więcej (${unpaidCompleted.length - ITEMS_LIMIT})`}
          </Button>
        )}
      </div>
    </div>
  );
}
