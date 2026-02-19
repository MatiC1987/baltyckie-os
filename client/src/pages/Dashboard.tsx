import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useReservations } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { differenceInDays } from "date-fns";
import {
  ArrowUp, ArrowDown, ArrowUpDown, Plane, PlaneTakeoff, Wallet, Landmark, Banknote, Bitcoin, HandCoins, Pencil, Check, X, AlertCircle, CalendarClock, FileWarning, TrendingUp, Target, Scale,
} from "lucide-react";
import type { Reservation, Lease, SubleasePayment } from "@shared/schema";

type CompanyBalanceAccount = {
  id: number;
  name: string;
  type: string | null;
  category: string | null;
  balanceSource: string | null;
  latestBalance: string;
};

type CompanyBalance = {
  accounts: CompanyBalanceAccount[];
  totalBalance: string;
};

function getAccountIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("pekao") || lower.includes("santander")) return Landmark;
  if (lower.includes("saldo")) return Scale;
  if (lower.includes("krypto")) return Bitcoin;
  if (lower.includes("pożyczki")) return HandCoins;
  return Wallet;
}

type ForecastMonth = {
  year: number;
  month: number;
  actual: number;
  reservationRevenue: number;
  subleaseRevenue: number;
  daysInMonth: number;
  dayOfMonth: number;
  daysRemaining: number;
};

type SubleasePaymentExtended = SubleasePayment & {
  subleaseTenantName: string;
  subleaseApartmentIds: number[];
};

function useCompanyBalance() {
  return useQuery<CompanyBalance>({ queryKey: ["/api/company-balance"] });
}

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

const MONTH_NAMES = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

function forecastStorageKey(year: number) { return `forecast-data-${year}`; }

function loadForecastData(year: number): Record<string, Record<number, { p: number; r: number }>> {
  try {
    const raw = localStorage.getItem(forecastStorageKey(year));
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function getForecastForMonth(year: number, month: number): number {
  const data = loadForecastData(year);
  let total = 0;
  for (const aptKey of Object.keys(data)) {
    const monthData = data[aptKey]?.[month];
    if (monthData) total += monthData.p || 0;
  }
  return total;
}

export default function Dashboard() {
  const { data: reservations, isLoading: reservationsLoading } = useReservations();
  const { data: apartments } = useApartments();
  const { data: companyBalance, isLoading: balanceLoading } = useCompanyBalance();
  const { data: leases } = useQuery<Lease[]>({ queryKey: ["/api/leases"] });
  const { data: allSubleasePayments } = useQuery<SubleasePaymentExtended[]>({ queryKey: ["/api/dashboard/all-sublease-payments"] });
  const { data: forecastData } = useQuery<ForecastMonth[]>({ queryKey: ["/api/dashboard/revenue-forecast"] });
  const { data: reminders } = useQuery<{
    expiringExams: { id: number; examName: string; validUntil: string; employeeName: string }[];
    overdueCosts: number;
    overdueSubleasePayments: number;
    upcomingArrivals: number;
    expiringLeases: { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null }[];
    expiringSubleases: { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null }[];
  }>({ queryKey: ["/api/dashboard-reminders"] });
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [editingBalance, setEditingBalance] = useState("");

  const updateBalanceMutation = useMutation({
    mutationFn: ({ accountId, balance }: { accountId: number; balance: string }) =>
      apiRequest("POST", "/api/snapshots", {
        accountId,
        date: new Date().toISOString().split("T")[0],
        balance,
        notes: "Ręczna aktualizacja salda",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-balance"] });
      setEditingAccountId(null);
      setEditingBalance("");
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">Dashboard</h2>
        <p className="text-muted-foreground">Przegląd wyników finansowych i operacyjnych.</p>
      </div>

      <CompanyBalanceCard
        companyBalance={companyBalance}
        balanceLoading={balanceLoading}
        editingAccountId={editingAccountId}
        editingBalance={editingBalance}
        setEditingAccountId={setEditingAccountId}
        setEditingBalance={setEditingBalance}
        updateBalanceMutation={updateBalanceMutation}
      />

      <RevenueForecastSection forecastData={forecastData || []} />

      <Tabs defaultValue="unpaid-arrivals" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1" data-testid="dashboard-tabs">
          <TabsTrigger value="unpaid-arrivals" data-testid="tab-unpaid-arrivals">
            <AlertCircle className="h-4 w-4 mr-1" />
            Nieopłacone przyjazdy
          </TabsTrigger>
          <TabsTrigger value="upcoming-arrivals" data-testid="tab-upcoming-arrivals">
            <Plane className="h-4 w-4 mr-1" />
            Najbliższe przyjazdy
          </TabsTrigger>
          <TabsTrigger value="upcoming-departures" data-testid="tab-upcoming-departures">
            <PlaneTakeoff className="h-4 w-4 mr-1" />
            Najbliższe wyjazdy
          </TabsTrigger>
          <TabsTrigger value="unpaid-subleases" data-testid="tab-unpaid-subleases">
            <FileWarning className="h-4 w-4 mr-1" />
            Nieopłacone podnajmy
          </TabsTrigger>
          <TabsTrigger value="expiring-leases" data-testid="tab-expiring-leases">
            <CalendarClock className="h-4 w-4 mr-1" />
            Kończące się umowy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unpaid-arrivals">
          <UnpaidArrivalsTab reservations={reservations || []} apartments={apartments || []} isLoading={reservationsLoading} reminders={reminders} />
        </TabsContent>

        <TabsContent value="upcoming-arrivals">
          <UpcomingArrivalsTab reservations={reservations || []} apartments={apartments || []} isLoading={reservationsLoading} />
        </TabsContent>

        <TabsContent value="upcoming-departures">
          <UpcomingDeparturesTab reservations={reservations || []} apartments={apartments || []} isLoading={reservationsLoading} />
        </TabsContent>

        <TabsContent value="unpaid-subleases">
          <UnpaidSubleasesTab payments={allSubleasePayments || []} apartments={apartments || []} />
        </TabsContent>

        <TabsContent value="expiring-leases">
          <ExpiringLeasesTab leases={leases || []} apartments={apartments || []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyBalanceCard({
  companyBalance, balanceLoading, editingAccountId, editingBalance,
  setEditingAccountId, setEditingBalance, updateBalanceMutation,
}: any) {
  const saldoLinkMap: Record<string, string> = {
    "Saldo - M. Cieślak": "/saldo-mc",
    "Saldo - M. Latasiewicz": "/saldo-ml",
    "Saldo - J. Głodkowska": "/saldo-jg",
  };

  return (
    <Card data-testid="card-company-balance">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 flex-wrap text-base">
          <Wallet className="h-4 w-4" />
          Saldo firmowe
          {companyBalance && (
            <span className="text-lg font-bold ml-2" data-testid="text-total-balance">
              {Number(companyBalance.totalBalance || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        {balanceLoading ? (
          <div className="h-10 bg-muted animate-pulse rounded-lg" />
        ) : (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {companyBalance?.accounts.map((acc: CompanyBalanceAccount) => {
              const Icon = getAccountIcon(acc.name);
              const balance = Number(acc.latestBalance);
              const isEditing = editingAccountId === acc.id;
              const isAuto = acc.balanceSource === "auto_saldo";
              const saldoLink = saldoLinkMap[acc.name];

              if (isAuto && saldoLink) {
                return (
                  <Link
                    key={acc.id}
                    href={saldoLink}
                    className="rounded-lg border border-border p-2 space-y-0.5 hover-elevate block"
                    data-testid={`card-account-balance-${acc.id}`}
                  >
                    <div className="flex items-center gap-1">
                      <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-[10px] text-muted-foreground truncate">{acc.name}</span>
                    </div>
                    <div className={`text-xs font-bold ${balance < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                      {balance.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                    </div>
                    <div className="text-[9px] text-muted-foreground/60 italic">auto</div>
                  </Link>
                );
              }

              return (
                <div
                  key={acc.id}
                  className="rounded-lg border border-border p-2 space-y-0.5 group"
                  data-testid={`card-account-balance-${acc.id}`}
                >
                  <div className="flex items-center gap-1">
                    <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground truncate">{acc.name}</span>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.01"
                        value={editingBalance}
                        onChange={(e: any) => setEditingBalance(e.target.value)}
                        onKeyDown={(e: any) => {
                          if (e.key === "Enter" && editingBalance.trim()) {
                            updateBalanceMutation.mutate({ accountId: acc.id, balance: editingBalance.trim() });
                          }
                          if (e.key === "Escape") { setEditingAccountId(null); setEditingBalance(""); }
                        }}
                        className="h-6 text-xs w-full"
                        autoFocus
                        data-testid={`input-balance-${acc.id}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { if (editingBalance.trim()) updateBalanceMutation.mutate({ accountId: acc.id, balance: editingBalance.trim() }); }}
                        disabled={!editingBalance.trim() || updateBalanceMutation.isPending}
                        data-testid={`button-save-balance-${acc.id}`}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => { setEditingAccountId(null); setEditingBalance(""); }}
                        data-testid={`button-cancel-balance-${acc.id}`}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className={`text-xs font-bold ${balance < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                        {balance.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                      </span>
                      <button
                        onClick={() => { setEditingAccountId(acc.id); setEditingBalance(balance.toString()); }}
                        className="invisible group-hover:visible text-muted-foreground hover:text-foreground ml-auto"
                        data-testid={`button-edit-balance-${acc.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UnpaidArrivalsTab({ reservations, apartments, isLoading, reminders }: { reservations: Reservation[]; apartments: any[]; isLoading: boolean; reminders?: { expiringExams: { id: number; examName: string; validUntil: string; employeeName: string }[]; overdueCosts: number; overdueSubleasePayments: number; upcomingArrivals: number; expiringLeases: { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null }[]; expiringSubleases: { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null }[] } }) {
  const [sortField, setSortField] = useState<SortField>("endDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const unpaidCompleted = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    let data = reservations.filter(r => {
      if (r.status === "ANULOWANA") return false;
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

  const hasReminders = reminders && (
    reminders.expiringExams.length > 0 ||
    reminders.overdueCosts > 0 ||
    reminders.overdueSubleasePayments > 0 ||
    reminders.expiringLeases.length > 0 ||
    reminders.expiringSubleases.length > 0
  );

  return (
    <div className="space-y-3">
      {hasReminders && (
        <Card data-testid="card-reminders">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Przypomnienia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reminders!.overdueCosts > 0 && (
              <Link href="/costs-expenses">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid="reminder-overdue-costs">
                  <FileWarning className="h-4 w-4 text-red-500 shrink-0" />
                  <span>Zaległe opłaty kosztów: <strong>{reminders!.overdueCosts}</strong></span>
                </div>
              </Link>
            )}
            {reminders!.overdueSubleasePayments > 0 && (
              <Link href="/subrent-settlement">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid="reminder-overdue-sublease">
                  <FileWarning className="h-4 w-4 text-red-500 shrink-0" />
                  <span>Zaległe płatności podnajmu: <strong>{reminders!.overdueSubleasePayments}</strong></span>
                </div>
              </Link>
            )}
            {reminders!.expiringExams.map(exam => (
              <Link key={exam.id} href="/employees">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-exam-${exam.id}`}>
                  <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Badanie <strong>{exam.examName}</strong> pracownika {exam.employeeName} wygasa {exam.validUntil}</span>
                </div>
              </Link>
            ))}
            {reminders!.expiringLeases.map(lease => (
              <Link key={lease.id} href="/apartment-schedule">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-lease-${lease.id}`}>
                  <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Najem {lease.tenantName || "—"} kończy się {lease.endDate}</span>
                </div>
              </Link>
            ))}
            {reminders!.expiringSubleases.map(sub => (
              <Link key={sub.id} href="/contracts-subrent">
                <div className="flex items-center gap-2 text-sm p-2 rounded-md hover-elevate cursor-pointer" data-testid={`reminder-sublease-${sub.id}`}>
                  <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>Podnajem {sub.tenantName || "—"} kończy się {sub.endDate}</span>
                </div>
              </Link>
            ))}
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
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
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
            {unpaidCompleted.map(r => (
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
      <div className="text-sm text-muted-foreground" data-testid="text-unpaid-count">
        {unpaidCompleted.length} nieopłaconych rezerwacji
      </div>
    </div>
  );
}

function UpcomingArrivalsTab({ reservations, apartments, isLoading }: { reservations: Reservation[]; apartments: any[]; isLoading: boolean }) {
  const [sortField, setSortField] = useState<SortField>("startDate");
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
      return r.startDate >= todayStr && r.startDate <= in7daysStr;
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
        default: valA = a.startDate; valB = b.startDate;
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
        <h3 className="text-lg font-semibold" data-testid="text-upcoming-arrivals-title">Najbliższe przyjazdy</h3>
        <p className="text-sm text-muted-foreground">Rezerwacje rozpoczynające się w ciągu najbliższych 7 dni.</p>
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
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
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Brak rezerwacji w ciągu 7 dni</TableCell></TableRow>
            )}
            {upcoming.map(r => {
              const remaining = calcRemaining(r);
              return (
                <TableRow key={r.id} data-testid={`row-upcoming-${r.id}`}>
                  <TableCell className="font-medium text-xs whitespace-nowrap">{r.reservationNumber}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{getApartmentName(r, apartments)}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap font-semibold">{r.startDate}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.endDate}</TableCell>
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
      <div className="text-sm text-muted-foreground" data-testid="text-upcoming-count">
        {upcoming.length} rezerwacji w ciągu 7 dni
      </div>
    </div>
  );
}

function UpcomingDeparturesTab({ reservations, apartments, isLoading }: { reservations: Reservation[]; apartments: any[]; isLoading: boolean }) {
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
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
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

function UnpaidSubleasesTab({ payments, apartments }: { payments: SubleasePaymentExtended[]; apartments: any[] }) {
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
              {todayPayments.map(p => (
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
              {upcomingPayments.map(p => (
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
      </div>
    </div>
  );
}

function ExpiringLeasesTab({ leases, apartments }: { leases: Lease[]; apartments: any[] }) {
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

function RevenueForecastSection({ forecastData }: { forecastData: ForecastMonth[] }) {
  const cards = useMemo(() => {
    return forecastData.map(m => {
      const forecast = getForecastForMonth(m.year, m.month);
      const pct = forecast > 0 ? m.actual / forecast : 0;
      const remaining = Math.max(0, forecast - m.actual);
      const dailyNeeded = m.daysRemaining > 0 ? remaining / m.daysRemaining : 0;
      return {
        ...m,
        forecast,
        pct,
        remaining,
        dailyNeeded,
        monthName: MONTH_NAMES[m.month],
      };
    });
  }, [forecastData]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold" data-testid="text-forecast-title">Realizacja prognozy przychodów</h3>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {cards.map((c) => {
          const now = new Date();
          const isCurrentMonth = c.year === now.getFullYear() && c.month === now.getMonth();
          const isPastMonth = c.year < now.getFullYear() || (c.year === now.getFullYear() && c.month < now.getMonth());
          return (
            <Card key={`${c.year}-${c.month}`} className={isCurrentMonth ? "border-primary/30" : isPastMonth ? "opacity-75" : ""} data-testid={`card-forecast-${c.year}-${c.month}`}>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                  <span>{c.monthName}</span>
                  {isCurrentMonth && <Badge variant="outline" className="text-[10px]">Bieżący</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Prognoza</span>
                  <span className="font-medium" data-testid={`text-forecast-value-${c.year}-${c.month}`}>
                    {c.forecast > 0 ? c.forecast.toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł" : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Rzeczywiste</span>
                  <span className="font-bold" data-testid={`text-actual-value-${c.year}-${c.month}`}>
                    {c.actual.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                  </span>
                </div>
                {(c.reservationRevenue > 0 || c.subleaseRevenue > 0) && (
                  <div className="pl-2 border-l-2 border-muted space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Rezerwacje</span>
                      <span data-testid={`text-reservation-revenue-${c.year}-${c.month}`}>
                        {c.reservationRevenue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Podnajem</span>
                      <span data-testid={`text-sublease-revenue-${c.year}-${c.month}`}>
                        {c.subleaseRevenue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Realizacja</span>
                  <span className={`font-bold ${c.forecast > 0 ? (c.pct >= 1 ? "text-emerald-600 dark:text-emerald-400" : c.pct >= 0.7 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400") : "text-muted-foreground"}`}
                    data-testid={`text-pct-value-${c.year}-${c.month}`}
                  >
                    {c.forecast > 0 ? (c.pct * 100).toFixed(0) + "%" : "—"}
                  </span>
                </div>
                {c.forecast > 0 && (
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div
                      className={`h-1.5 rounded-full transition-all ${c.pct >= 1 ? "bg-emerald-500" : c.pct >= 0.7 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, c.pct * 100)}%` }}
                    />
                  </div>
                )}
                {c.daysRemaining > 0 && c.forecast > 0 && c.remaining > 0 && (
                  <div className="pt-1 border-t border-border mt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Brakuje / dzień</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400" data-testid={`text-daily-needed-${c.year}-${c.month}`}>
                        {c.dailyNeeded.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Pozostało {c.daysRemaining} dni · brakuje {c.remaining.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                    </div>
                  </div>
                )}
                {c.forecast > 0 && c.pct >= 1 && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-1">
                    <TrendingUp className="h-3 w-3" />
                    Plan zrealizowany
                  </div>
                )}
                {c.forecast === 0 && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Uzupełnij prognozę w zakładce Prognoza P/R/S
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
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
