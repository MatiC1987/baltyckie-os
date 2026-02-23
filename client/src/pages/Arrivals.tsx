import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpdateReservation } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowUpDown, ArrowUp, ArrowDown, Filter, Plane, Eye, Calendar, User,
  Home, CreditCard, Pencil, Search, ChevronLeft, ChevronRight, FileText, X
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TablePageSkeleton } from "@/components/PageSkeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReservationSchema, type InsertReservation, type Reservation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type SortField = "reservationNumber" | "addDate" | "startDate" | "endDate" | "guestName" | "price" | "prepayment" | "paidAmount" | "source";
type SortDir = "asc" | "desc";

const ITEMS_PER_PAGE = 40;

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  "Booking.com": { label: "Booking", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-950 border-blue-200 dark:border-blue-800", icon: "B" },
  "Airbnb": { label: "Airbnb", color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-100 dark:bg-rose-950 border-rose-200 dark:border-rose-800", icon: "A" },
  "Recepcja": { label: "Recepcja", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800", icon: "R" },
  "HotRes": { label: "HotRes", color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-950 border-purple-200 dark:border-purple-800", icon: "H" },
  "Inne": { label: "Inne", color: "text-gray-700 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700", icon: "?" },
};

function SourceBadge({ source }: { source: string | null | undefined }) {
  if (!source) return <span className="text-xs text-muted-foreground">—</span>;
  const config = SOURCE_CONFIG[source] || SOURCE_CONFIG["Inne"];
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 font-semibold gap-1 ${config.bg} ${config.color} border`}>
      <span className="w-4 h-4 rounded-full bg-current/10 flex items-center justify-center text-[9px] font-bold shrink-0">{config.icon}</span>
      {config.label}
    </Badge>
  );
}

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

function StatusBadge({ status }: { status: string }) {
  return <Badge className="text-[10px] whitespace-nowrap bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 border font-semibold">PRZYJĘTA</Badge>;
}

function PaymentProgressBar({ reservation }: { reservation: Reservation }) {
  const price = Number(reservation.price) || 0;
  if (price <= 0) return null;
  const prepayment = Number(reservation.prepayment) || 0;
  const paid = Number(reservation.paidAmount) || 0;
  const totalPaid = prepayment + paid;
  const pct = Math.min(100, (totalPaid / price) * 100);
  const prepPct = Math.min(100, (prepayment / price) * 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full flex" style={{ width: `${pct}%` }}>
        <div className="h-full bg-emerald-500" style={{ width: prepPct > 0 ? `${(prepPct / pct) * 100}%` : '0%' }} />
        <div className="h-full bg-cyan-500" style={{ width: prepPct > 0 ? `${100 - (prepPct / pct) * 100}%` : '100%' }} />
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

interface PaginatedResult {
  data: Reservation[];
  total: number;
  page: number;
  totalPages: number;
}

export default function Arrivals() {
  const { data: apartments } = useApartments();
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  const debouncedSearch = useDebounce(searchText, 400);
  const debouncedDateFrom = useDebounce(filterDateFrom, 400);
  const debouncedDateTo = useDebounce(filterDateTo, 400);

  useEffect(() => { setPage(1); }, [debouncedSearch, debouncedDateFrom, debouncedDateTo, sortField, sortDir]);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(ITEMS_PER_PAGE),
    sortField,
    sortDir,
    status: "PRZYJETA",
    ...(debouncedDateFrom && { dateFrom: debouncedDateFrom }),
    ...(debouncedDateTo && { dateTo: debouncedDateTo }),
    ...(debouncedSearch && { search: debouncedSearch }),
  });

  const { data: result, isLoading } = useQuery<PaginatedResult>({
    queryKey: ["/api/reservations-paginated", "arrivals", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/reservations-paginated?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const arrivals = result?.data || [];
  const total = result?.total || 0;
  const totalPages = result?.totalPages || 0;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const hasActiveFilters = filterDateFrom || filterDateTo || searchText;

  if (isLoading && !result) return <TablePageSkeleton />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Przyjazdy"
        description="Rezerwacje ze statusem PRZYJĘTA."
        icon={Plane}
        actions={
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            data-testid="button-arrivals-page-toggle-filters"
          >
            <Filter className="mr-2 h-4 w-4" /> Filtry
            {hasActiveFilters && <Badge variant="secondary" className="ml-2 no-default-hover-elevate no-default-active-elevate">!</Badge>}
          </Button>
        }
      />

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj gościa lub nr rezerwacji..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-search-arrivals"
          />
        </div>
        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>

      {showFilters && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu od</Label>
                <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-9" data-testid="input-arrivals-filter-date-from" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu do</Label>
                <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-9" data-testid="input-arrivals-filter-date-to" />
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setSearchText(""); }} data-testid="button-arrivals-clear-filters">
                  <X className="h-4 w-4 mr-1" /> Wyczyść
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <SortableHeader field="reservationNumber" label="Numer" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <TableHead className="text-xs font-semibold w-24">Źródło</TableHead>
              <SortableHeader field="startDate" label="od - do" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="addDate" label="Dodane" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="price" label="Wartość" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <SortableHeader field="guestName" label="Gość" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {arrivals.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  {isLoading ? "Ładowanie..." : "Brak przyjętych rezerwacji"}
                </TableCell>
              </TableRow>
            )}
            {arrivals.map(r => {
              const remaining = calcRemaining(r);
              const price = Number(r.price) || 0;
              return (
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedReservation(r)}
                  data-testid={`row-arrival-${r.id}`}
                >
                  <TableCell className="py-3">
                    <span className="text-sm font-bold text-primary">{r.reservationNumber}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <SourceBadge source={r.source} />
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs whitespace-nowrap">{r.startDate} › {r.endDate}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs text-muted-foreground">{r.addDate || "—"}</span>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="space-y-1 min-w-[100px]">
                      <div className={`text-sm font-bold ${remaining === 0 ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                        {price.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-normal text-muted-foreground">PLN</span>
                      </div>
                      {remaining > 0 && (
                        <div className="text-[10px] text-orange-600 dark:text-orange-400">
                          {remaining.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN
                        </div>
                      )}
                      <PaymentProgressBar reservation={r} />
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{r.guestName}</span>
                      {r.notes && <FileText className="h-3 w-3 text-muted-foreground shrink-0" />}
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedReservation(r); }}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground" data-testid="text-arrivals-count">
          Wyświetlono {arrivals.length} z {total} przyjętych rezerwacji
        </div>
        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        )}
      </div>

      {selectedReservation && (
        <Sheet open={!!selectedReservation} onOpenChange={(open) => { if (!open) setSelectedReservation(null); }}>
          <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0">
            <SheetHeader className="px-6 pt-6 pb-0">
              <SheetTitle className="flex items-center gap-3 flex-wrap">
                <span className="text-lg">Rezerwacja nr {selectedReservation.reservationNumber}</span>
                <StatusBadge status={selectedReservation.status} />
              </SheetTitle>
            </SheetHeader>
            <ArrivalDetailContent
              reservation={selectedReservation}
              apartments={apartments || []}
              onClose={() => setSelectedReservation(null)}
            />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}

function ArrivalDetailContent({ reservation: r, apartments, onClose }: {
  reservation: Reservation;
  apartments: any[];
  onClose: () => void;
}) {
  const aptName = getApartmentName(r, apartments);
  const nights = (() => {
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  })();
  const price = Number(r.price) || 0;
  const pricePerNight = nights > 0 ? price / nights : 0;
  const prepayment = Number(r.prepayment) || 0;
  const paid = Number(r.paidAmount) || 0;
  const remaining = calcRemaining(r);
  const totalPaid = prepayment + paid;
  const pct = price > 0 ? Math.min(100, (totalPaid / price) * 100) : 0;
  const prepPct = price > 0 ? Math.min(100, (prepayment / price) * 100) : 0;

  return (
    <div className="px-6 py-4 space-y-6">
      <div className="flex gap-6">
        <div className="flex-1 space-y-1">
          <div className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Przyjazd
          </div>
          <div className="text-2xl font-bold">
            {new Date(r.startDate).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="text-muted-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Wyjazd
          </div>
          <div className="text-2xl font-bold">
            {new Date(r.endDate).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-muted-foreground text-xs uppercase tracking-wider">Noclegów</div>
          <div className="text-2xl font-bold text-primary">{nights}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Źródło</div>
          <SourceBadge source={r.source} />
        </div>
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Apartament</div>
          <div className="text-sm font-bold">{aptName}</div>
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          <User className="h-3.5 w-3.5" /> Gość
        </div>
        <div className="text-lg font-bold">{r.guestName}</div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Wartość rezerwacji</div>
          <div>
            <span className="text-2xl font-bold">{price.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</span>
            <span className="text-sm text-muted-foreground ml-1">PLN</span>
          </div>
        </div>
        {pricePerNight > 0 && (
          <div className="text-xs text-muted-foreground">{pricePerNight.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN / noc</div>
        )}
        <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full flex transition-all" style={{ width: `${pct}%` }}>
            <div className="h-full bg-emerald-500" style={{ width: prepPct > 0 ? `${(prepPct / pct) * 100}%` : '0%' }} />
            <div className="h-full bg-cyan-500" style={{ width: prepPct > 0 ? `${100 - (prepPct / pct) * 100}%` : '100%' }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Przedpłata</div>
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{prepayment.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Zapłacono</div>
            <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{paid.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</div>
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Do zapłaty</div>
            <div className={`text-sm font-bold ${remaining > 0 ? "text-orange-600 dark:text-orange-400" : "text-emerald-600 dark:text-emerald-400"}`}>
              {remaining.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
            </div>
          </div>
        </div>
      </div>

      {r.notes && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" /> Notatki
          </div>
          <p className="text-sm whitespace-pre-wrap">{r.notes}</p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={onClose}>Zamknij</Button>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  const pages: (number | string)[] = [];
  const maxVisible = 10;
  if (totalPages <= maxVisible) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    let start = Math.max(2, page - 3);
    let end = Math.min(totalPages - 1, page + 3);
    if (start > 2) pages.push("...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);
  }
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) =>
        typeof p === "string" ? (
          <span key={`dots-${i}`} className="text-xs text-muted-foreground px-1">…</span>
        ) : (
          <Button key={p} variant={p === page ? "default" : "ghost"} size="sm" className={`h-8 w-8 text-xs ${p === page ? "" : "text-muted-foreground"}`} onClick={() => onPageChange(p)}>
            {p}
          </Button>
        )
      )}
      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
        <ChevronRight className="h-4 w-4" />
      </Button>
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
        className="flex items-center text-xs font-semibold whitespace-nowrap hover:text-foreground transition-colors px-1 py-1 rounded"
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
