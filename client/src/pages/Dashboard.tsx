import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useDashboardStats } from "@/hooks/use-stats";
import { useReservations } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Users, CreditCard, Home, ArrowUpDown, ArrowUp, ArrowDown, Filter, Plane, Wallet, Landmark, Banknote, Bitcoin, HandCoins, Pencil, Check, X } from "lucide-react";
import type { Reservation } from "@shared/schema";

type CompanyBalance = {
  accounts: { id: number; name: string; type: string | null; latestBalance: string }[];
  totalBalance: string;
};

function useCompanyBalance() {
  return useQuery<CompanyBalance>({
    queryKey: ["/api/company-balance"],
  });
}

function getAccountIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("pekao") || lower.includes("santander")) return Landmark;
  if (lower.includes("gotówka")) return Banknote;
  if (lower.includes("krypto")) return Bitcoin;
  if (lower.includes("pożyczki")) return HandCoins;
  return Wallet;
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

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: reservations, isLoading: reservationsLoading } = useReservations();
  const { data: apartments } = useApartments();
  const { data: companyBalance, isLoading: balanceLoading } = useCompanyBalance();
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

  const chartData = [
    { name: 'Sty', revenue: 4000, expenses: 2400 },
    { name: 'Lut', revenue: 3000, expenses: 1398 },
    { name: 'Mar', revenue: 2000, expenses: 9800 },
    { name: 'Kwi', revenue: 2780, expenses: 3908 },
    { name: 'Maj', revenue: 1890, expenses: 4800 },
    { name: 'Cze', revenue: 2390, expenses: 3800 },
    { name: 'Lip', revenue: 3490, expenses: 4300 },
  ];

  if (statsLoading) {
    return <div className="p-8">Ładowanie danych...</div>;
  }

  const StatCard = ({ title, value, subtext, icon: Icon, trend }: any) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1 flex items-center flex-wrap gap-1">
          {trend === 'up' ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : null}
          {trend === 'down' ? <ArrowDownRight className="h-3 w-3 text-red-500" /> : null}
          {subtext}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="text-dashboard-title">Dashboard</h2>
        <p className="text-muted-foreground">Przegląd wyników finansowych i operacyjnych.</p>
      </div>

      <Card data-testid="card-company-balance">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 flex-wrap">
            <Wallet className="h-5 w-5" />
            Saldo firmowe
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <div className="h-20 bg-muted animate-pulse rounded-lg" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl font-bold" data-testid="text-total-balance">
                  {Number(companyBalance?.totalBalance || 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
                </span>
                <span className="text-sm text-muted-foreground">suma wszystkich źródeł</span>
              </div>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
                {companyBalance?.accounts.map(acc => {
                  const Icon = getAccountIcon(acc.name);
                  const balance = Number(acc.latestBalance);
                  const isEditing = editingAccountId === acc.id;
                  return (
                    <div
                      key={acc.id}
                      className="rounded-lg border border-border p-3 space-y-1 group"
                      data-testid={`card-account-balance-${acc.id}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">{acc.name}</span>
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={editingBalance}
                            onChange={e => setEditingBalance(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter" && editingBalance.trim()) {
                                updateBalanceMutation.mutate({ accountId: acc.id, balance: editingBalance.trim() });
                              }
                              if (e.key === "Escape") { setEditingAccountId(null); setEditingBalance(""); }
                            }}
                            className="h-7 text-xs w-full"
                            autoFocus
                            data-testid={`input-balance-${acc.id}`}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => {
                              if (editingBalance.trim()) updateBalanceMutation.mutate({ accountId: acc.id, balance: editingBalance.trim() });
                            }}
                            disabled={!editingBalance.trim() || updateBalanceMutation.isPending}
                            data-testid={`button-save-balance-${acc.id}`}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 shrink-0"
                            onClick={() => { setEditingAccountId(null); setEditingBalance(""); }}
                            data-testid={`button-cancel-balance-${acc.id}`}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <div className={`text-sm font-bold flex-1 ${balance < 0 ? "text-red-600 dark:text-red-400" : ""}`}>
                            {balance.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                          </div>
                          <button
                            className="invisible group-hover:visible text-muted-foreground hover:text-foreground p-0.5 shrink-0"
                            onClick={() => { setEditingAccountId(acc.id); setEditingBalance(acc.latestBalance); }}
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
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList data-testid="dashboard-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">Przegląd</TabsTrigger>
          <TabsTrigger value="arrivals" data-testid="tab-arrivals">
            <Plane className="h-4 w-4 mr-1" />
            Przyjazdy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Przychody całkowite"
              value={`${stats?.totalRevenue?.toFixed(2) ?? "0.00"} PLN`}
              subtext="W tym roku"
              icon={CreditCard}
              trend="up"
            />
            <StatCard
              title="Koszty operacyjne"
              value={`${stats?.totalExpenses?.toFixed(2) ?? "0.00"} PLN`}
              subtext="-12% vs poprzedni miesiąc"
              icon={ArrowDownRight}
              trend="down"
            />
            <StatCard
              title="Dochód Netto"
              value={`${stats?.netIncome?.toFixed(2) ?? "0.00"} PLN`}
              subtext="Marża +24%"
              icon={Home}
              trend="up"
            />
            <StatCard
              title="Obłożenie"
              value={`${stats?.occupancyRate?.toFixed(1) ?? "0"}%`}
              subtext="Średnia z wszystkich lokali"
              icon={Users}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4" data-testid="card-revenue-chart">
              <CardHeader>
                <CardTitle>Przychody i Koszty</CardTitle>
              </CardHeader>
              <CardContent className="pl-2">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value} zł`} />
                      <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Przychód" />
                      <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Koszty" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-3" data-testid="card-recent-reservations">
              <CardHeader>
                <CardTitle>Ostatnie Rezerwacje</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reservations?.slice(0, 5).map((res) => (
                    <div key={res.id} className="flex items-center justify-between gap-2 p-2 hover:bg-muted/50 rounded-lg transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {res.guestName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-none">{res.guestName}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(res.startDate), 'dd MMM', { locale: pl })} - {format(new Date(res.endDate), 'dd MMM', { locale: pl })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={statusVariant(res.status)} className="text-xs">
                          {statusLabel(res.status)}
                        </Badge>
                        <div className="text-sm font-bold whitespace-nowrap">+{res.price} zł</div>
                      </div>
                    </div>
                  ))}
                  {!reservations?.length && <p className="text-sm text-muted-foreground text-center py-4">Brak ostatnich rezerwacji</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="arrivals">
          <ArrivalsTab reservations={reservations || []} apartments={apartments || []} isLoading={reservationsLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ArrivalsTab({ reservations, apartments, isLoading }: { reservations: Reservation[]; apartments: any[]; isLoading: boolean }) {
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
          valA = getApartmentName(a, apartments);
          valB = getApartmentName(b, apartments);
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
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-xl font-semibold" data-testid="text-arrivals-title">Przyjazdy</h3>
          <p className="text-sm text-muted-foreground">Rezerwacje ze statusem PRZYJĘTA, chronologicznie wg daty przyjazdu.</p>
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          onClick={() => setShowFilters(!showFilters)}
          data-testid="button-arrivals-toggle-filters"
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
                  data-testid="input-arrivals-filter-date-from"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu do</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  data-testid="input-arrivals-filter-date-to"
                />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }} data-testid="button-arrivals-clear-filters">
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
              <ArrivalsSortableHeader field="reservationNumber" label="Numer" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <ArrivalsSortableHeader field="addDate" label="Data dodania" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <ArrivalsSortableHeader field="apartmentName" label="Apartament" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <ArrivalsSortableHeader field="startDate" label="Przyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <ArrivalsSortableHeader field="endDate" label="Wyjazd" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <ArrivalsSortableHeader field="guestName" label="Imię i nazwisko" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <ArrivalsSortableHeader field="price" label="Kwota pobytu" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <ArrivalsSortableHeader field="prepayment" label="Zaliczka" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <ArrivalsSortableHeader field="paidAmount" label="Wpłacona" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <ArrivalsSortableHeader field="remaining" label="Pozostało" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrivals.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                  Brak przyjęych rezerwacji
                </TableCell>
              </TableRow>
            )}
            {arrivals.map(r => {
              const remaining = calcRemaining(r);
              return (
                <TableRow key={r.id} data-testid={`row-arrival-${r.id}`}>
                  <TableCell className="font-medium text-xs whitespace-nowrap">{r.reservationNumber}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{r.addDate || "—"}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">{getApartmentName(r, apartments)}</TableCell>
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
      <div className="text-sm text-muted-foreground" data-testid="text-arrivals-count">
        Wyświetlono {arrivals.length} przyjęych rezerwacji
      </div>
    </div>
  );
}

function ArrivalsSortableHeader({ field, label, sortField, sortDir, onSort }: {
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
        data-testid={`arrivals-sort-${field}`}
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
