import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCreateReservation, useUpdateReservation, useDeleteReservation } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Plus, ArrowUpDown, ArrowUp, ArrowDown, Filter, Eye, Calendar, User, Home,
  CreditCard, X, Pencil, Clock, Download, FileText, ClipboardList, Search,
  ChevronLeft, ChevronRight, Globe, Trash2, Save
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TablePageSkeleton } from "@/components/PageSkeleton";
import { FullscreenWrapper, useFullscreen, FullscreenToggleButton } from "@/components/FullscreenWrapper";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReservationSchema, type InsertReservation, type Reservation } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type SortField = "reservationNumber" | "addDate" | "startDate" | "endDate" | "guestName" | "price" | "prepayment" | "paidAmount" | "status" | "source";
type SortDir = "asc" | "desc";

const ITEMS_PER_PAGE = 40;

const SOURCE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  "Booking.com": { label: "Booking", color: "text-blue-700 dark:text-blue-300", bg: "bg-blue-100 dark:bg-blue-950 border-blue-200 dark:border-blue-800", icon: "B" },
  "Airbnb": { label: "Airbnb", color: "text-rose-700 dark:text-rose-300", bg: "bg-rose-100 dark:bg-rose-950 border-rose-200 dark:border-rose-800", icon: "A" },
  "Recepcja": { label: "Recepcja", color: "text-emerald-700 dark:text-emerald-300", bg: "bg-emerald-100 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800", icon: "R" },
  "HotRes": { label: "HotRes", color: "text-purple-700 dark:text-purple-300", bg: "bg-purple-100 dark:bg-purple-950 border-purple-200 dark:border-purple-800", icon: "H" },
  "Inne": { label: "Inne", color: "text-gray-700 dark:text-gray-300", bg: "bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700", icon: "?" },
};

function getSourceConfig(source: string | null | undefined) {
  if (!source) return null;
  return SOURCE_CONFIG[source] || SOURCE_CONFIG["Inne"];
}

function SourceBadge({ source }: { source: string | null | undefined }) {
  const config = getSourceConfig(source);
  if (!config) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0.5 font-semibold gap-1 ${config.bg} ${config.color} border`} data-testid="badge-source">
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
  const remaining = Math.round((price - prepayment - paid) * 100) / 100;
  return Math.max(0, remaining);
}

function calcPaidTotal(r: Reservation): number {
  return (Number(r.prepayment) || 0) + (Number(r.paidAmount) || 0);
}

function statusLabel(status: string): string {
  switch (status) {
    case "DO_OPLACENIA": return "DO OPŁACENIA";
    case "PRZYJETA": return "PRZYJĘTA";
    case "ANULOWANA": return "ANULOWANA";
    default: return status;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PRZYJETA":
      return <Badge className="text-[10px] whitespace-nowrap bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 border font-semibold">{statusLabel(status)}</Badge>;
    case "ANULOWANA":
      return <Badge variant="destructive" className="text-[10px] whitespace-nowrap font-semibold">{statusLabel(status)}</Badge>;
    case "DO_OPLACENIA":
      return <Badge className="text-[10px] whitespace-nowrap bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 border font-semibold">{statusLabel(status)}</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px] whitespace-nowrap font-semibold">{statusLabel(status)}</Badge>;
  }
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
    <div className="w-full" data-testid="payment-progress">
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full flex" style={{ width: `${pct}%` }}>
          <div className="h-full bg-emerald-500" style={{ width: prepPct > 0 ? `${(prepPct / pct) * 100}%` : '0%' }} />
          <div className="h-full bg-cyan-500" style={{ width: prepPct > 0 ? `${100 - (prepPct / pct) * 100}%` : '100%' }} />
        </div>
      </div>
    </div>
  );
}

function PaymentProgressBarLarge({ reservation }: { reservation: Reservation }) {
  const price = Number(reservation.price) || 0;
  if (price <= 0) return null;
  const prepayment = Number(reservation.prepayment) || 0;
  const paid = Number(reservation.paidAmount) || 0;
  const totalPaid = prepayment + paid;
  const remaining = Math.max(0, price - totalPaid);
  const pct = Math.min(100, (totalPaid / price) * 100);
  const prepPct = Math.min(100, (prepayment / price) * 100);

  return (
    <div className="space-y-3" data-testid="payment-progress-large">
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
  );
}

function calcNights(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatImportDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
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

export default function Reservations() {
  const { data: apartments } = useApartments();
  const { data: lastCsvImport } = useQuery<{ importedAt: string; recordsImported: number; recordsUpdated: number; recordsSkipped: number } | null>({ queryKey: ["/api/import-metadata/last/hotres_csv"] });
  const { data: lastApiImport } = useQuery<{ importedAt: string; recordsImported: number; recordsUpdated: number; recordsSkipped: number } | null>({ queryKey: ["/api/import-metadata/last/hotres_api"] });
  const fullscreen = useFullscreen();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("reservationNumber");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSource, setFilterSource] = useState("ALL");
  const [searchText, setSearchText] = useState("");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState("preview");

  const debouncedSearch = useDebounce(searchText, 400);
  const debouncedDateFrom = useDebounce(filterDateFrom, 400);
  const debouncedDateTo = useDebounce(filterDateTo, 400);

  useEffect(() => { setPage(1); }, [debouncedSearch, debouncedDateFrom, debouncedDateTo, filterStatus, filterSource, sortField, sortDir]);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(ITEMS_PER_PAGE),
    sortField,
    sortDir,
    ...(filterStatus !== "ALL" && { status: filterStatus }),
    ...(debouncedDateFrom && { dateFrom: debouncedDateFrom }),
    ...(debouncedDateTo && { dateTo: debouncedDateTo }),
    ...(debouncedSearch && { search: debouncedSearch }),
    ...(filterSource !== "ALL" && { source: filterSource }),
  });

  const { data: result, isLoading } = useQuery<PaginatedResult>({
    queryKey: ["/api/reservations-paginated", queryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/reservations-paginated?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const reservations = result?.data || [];
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

  const clearFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterStatus("ALL");
    setFilterSource("ALL");
    setSearchText("");
  };

  const hasActiveFilters = filterDateFrom || filterDateTo || filterStatus !== "ALL" || filterSource !== "ALL" || searchText;

  const handleExportCSV = () => {
    const header = "Nr rezerwacji;Źródło;Data dodania;Apartament;Od;Do;Gość;Cena;Zaliczka;Zapłacono;Pozostało;Status";
    const rows = reservations.map(r => {
      const aptName = getApartmentName(r, apartments || []);
      return `${r.reservationNumber || ""};${r.source || ""};${r.addDate || ""};${aptName};${r.startDate || ""};${r.endDate || ""};${r.guestName || ""};${Number(r.price || 0).toFixed(2).replace(".", ",")};${Number(r.prepayment || 0).toFixed(2).replace(".", ",")};${Number(r.paidAmount || 0).toFixed(2).replace(".", ",")};${calcRemaining(r).toFixed(2).replace(".", ",")};${r.status || ""}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rezerwacje-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openDetail = (r: Reservation, tab: string = "preview") => { setDetailInitialTab(tab); setSelectedReservation(r); };

  if (isLoading && !result) return <TablePageSkeleton />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Lista rezerwacji"
        description="Zarządzanie rezerwacjami krótkoterminowymi."
        icon={ClipboardList}
        actions={
          <>
            <Button variant="outline" onClick={handleExportCSV} disabled={reservations.length === 0} data-testid="button-export-csv">
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="mr-2 h-4 w-4" /> Filtry
              {hasActiveFilters && <Badge variant="secondary" className="ml-2 no-default-hover-elevate no-default-active-elevate">!</Badge>}
            </Button>
            <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-reservation">
                  <Plus className="mr-2 h-4 w-4" /> Dodaj
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Nowa rezerwacja</DialogTitle>
                </DialogHeader>
                <ReservationForm onSuccess={() => setIsDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {(lastCsvImport || lastApiImport) && (
        <div className="flex items-center gap-3 flex-wrap" data-testid="text-last-import-info">
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {lastCsvImport && (
            <span className="text-xs text-muted-foreground" data-testid="text-last-csv-import">
              CSV: <span className="font-medium text-foreground">{formatImportDate(lastCsvImport.importedAt)}</span>
              {lastCsvImport.recordsImported > 0 && <span> ({lastCsvImport.recordsImported} nowych</span>}
              {lastCsvImport.recordsUpdated > 0 && <span>, {lastCsvImport.recordsUpdated} zaktual.</span>}
              {(lastCsvImport.recordsImported > 0 || lastCsvImport.recordsUpdated > 0) && <span>)</span>}
            </span>
          )}
          {lastApiImport && (
            <span className="text-xs text-muted-foreground" data-testid="text-last-api-import">
              API: <span className="font-medium text-foreground">{formatImportDate(lastApiImport.importedAt)}</span>
              {lastApiImport.recordsImported > 0 && <span> ({lastApiImport.recordsImported} nowych</span>}
              {lastApiImport.recordsUpdated > 0 && <span>, {lastApiImport.recordsUpdated} zaktual.</span>}
              {(lastApiImport.recordsImported > 0 || lastApiImport.recordsUpdated > 0) && <span>)</span>}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj gościa lub nr rezerwacji..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-search-reservations"
          />
        </div>

        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        )}
      </div>

      {showFilters && (
        <Card data-testid="card-filters">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu od</Label>
                <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="h-9" data-testid="input-filter-date-from" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu do</Label>
                <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="h-9" data-testid="input-filter-date-to" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger data-testid="select-filter-status" className="w-[160px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Wszystkie</SelectItem>
                    <SelectItem value="DO_OPLACENIA">DO OPŁACENIA</SelectItem>
                    <SelectItem value="PRZYJETA">PRZYJĘTA</SelectItem>
                    <SelectItem value="ANULOWANA">ANULOWANA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Źródło</Label>
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger data-testid="select-filter-source" className="w-[160px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Wszystkie</SelectItem>
                    <SelectItem value="Booking.com">Booking.com</SelectItem>
                    <SelectItem value="Airbnb">Airbnb</SelectItem>
                    <SelectItem value="Recepcja">Recepcja</SelectItem>
                    <SelectItem value="HotRes">HotRes</SelectItem>
                    <SelectItem value="Inne">Inne</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" /> Wyczyść
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <FullscreenWrapper title="Rezerwacje" isFullscreen={fullscreen.isFullscreen} onExit={fullscreen.exit}>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <SortableHeader field="reservationNumber" label="Numer" sortField={sortField} sortDir={sortDir} onSort={toggleSort} className="w-20" />
                <TableHead className="text-xs font-semibold w-24">Źródło</TableHead>
                <SortableHeader field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableHeader field="startDate" label="od - do" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableHeader field="addDate" label="Dodane" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableHeader field="price" label="Wartość" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <SortableHeader field="guestName" label="Gość" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    {isLoading ? "Ładowanie..." : "Brak rezerwacji"}
                  </TableCell>
                </TableRow>
              )}
              {reservations.map(r => (
                <ReservationRow
                  key={r.id}
                  reservation={r}
                  apartments={apartments || []}
                  onOpen={openDetail}
                  onEdit={(res) => openDetail(res, "edit")}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </FullscreenWrapper>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground" data-testid="text-reservations-count">
          Wyświetlono {reservations.length} z {total} rezerwacji
        </div>
        {totalPages > 1 && (
          <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        )}
      </div>

      <ReservationDetailSheet
        reservation={selectedReservation}
        apartments={apartments || []}
        onClose={() => setSelectedReservation(null)}
        onUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/reservations-paginated"] });
        }}
        initialTab={detailInitialTab}
      />
    </div>
  );
}

function Pagination({ page, totalPages, total, onPageChange }: { page: number; totalPages: number; total: number; onPageChange: (p: number) => void }) {
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
    <div className="flex items-center gap-1" data-testid="pagination">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        data-testid="button-prev-page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) =>
        typeof p === "string" ? (
          <span key={`dots-${i}`} className="text-xs text-muted-foreground px-1">…</span>
        ) : (
          <Button
            key={p}
            variant={p === page ? "default" : "ghost"}
            size="sm"
            className={`h-8 w-8 text-xs ${p === page ? "" : "text-muted-foreground"}`}
            onClick={() => onPageChange(p)}
            data-testid={`button-page-${p}`}
          >
            {p}
          </Button>
        )
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        data-testid="button-next-page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SortableHeader({ field, label, sortField, sortDir, onSort, className }: {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = sortField === field;
  return (
    <TableHead className={className}>
      <button
        onClick={() => onSort(field)}
        className="flex items-center text-xs font-semibold whitespace-nowrap hover:text-foreground transition-colors px-1 py-1 rounded"
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

function ReservationRow({ reservation: r, apartments, onOpen, onEdit }: { reservation: Reservation; apartments: any[]; onOpen: (r: Reservation) => void; onEdit: (r: Reservation) => void }) {
  const isCancelled = r.status === "ANULOWANA";
  const remaining = calcRemaining(r);
  const price = Number(r.price) || 0;

  return (
    <TableRow
      className={`cursor-pointer transition-colors ${isCancelled ? "bg-red-50/50 dark:bg-red-950/20 opacity-60" : "hover:bg-muted/30"}`}
      onClick={() => onOpen(r)}
      data-testid={`row-reservation-${r.id}`}
    >
      <TableCell className="py-3">
        <span className="text-sm font-bold text-primary" data-testid={`text-res-number-${r.id}`}>
          {r.reservationNumber}
        </span>
      </TableCell>
      <TableCell className="py-3">
        <SourceBadge source={r.source} />
      </TableCell>
      <TableCell className="py-3" data-testid={`cell-res-status-${r.id}`}>
        <StatusBadge status={r.status} />
      </TableCell>
      <TableCell className="py-3">
        <span className="text-xs whitespace-nowrap" data-testid={`text-res-dates-${r.id}`}>
          {r.startDate} › {r.endDate}
        </span>
      </TableCell>
      <TableCell className="py-3">
        <span className="text-xs text-muted-foreground whitespace-nowrap" data-testid={`text-res-adddate-${r.id}`}>
          {r.addDate || "—"}
        </span>
      </TableCell>
      <TableCell className="py-3">
        <div className="space-y-1 min-w-[100px]">
          <div className="flex items-baseline gap-1.5">
            <span className={`text-sm font-bold ${isCancelled ? 'line-through' : remaining === 0 && !isCancelled ? 'text-emerald-600 dark:text-emerald-400' : ''}`} data-testid={`text-res-price-${r.id}`}>
              {price.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-normal text-muted-foreground">PLN</span>
            </span>
          </div>
          {remaining > 0 && !isCancelled && (
            <div className="text-[10px] text-orange-600 dark:text-orange-400" data-testid={`text-res-remaining-${r.id}`}>
              {remaining.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} <span className="text-muted-foreground">PLN</span>
            </div>
          )}
          {!isCancelled && <PaymentProgressBar reservation={r} />}
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" data-testid={`text-res-guest-${r.id}`}>{r.guestName}</span>
          {r.notes && <FileText className="h-3 w-3 text-muted-foreground shrink-0" />}
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onOpen(r); }} data-testid={`button-preview-res-${r.id}`}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(r); }} data-testid={`button-edit-res-${r.id}`}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ReservationDetailSheet({ reservation, apartments, onClose, onUpdated, initialTab = "preview" }: {
  reservation: Reservation | null;
  apartments: any[];
  onClose: () => void;
  onUpdated: () => void;
  initialTab?: string;
}) {
  if (!reservation) return null;

  return (
    <Sheet open={!!reservation} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0" data-testid="sheet-reservation-detail">
        <SheetHeader className="px-6 pt-6 pb-0">
          <SheetTitle className="flex items-center gap-3 flex-wrap" data-testid="text-detail-title">
            <span className="text-lg">Rezerwacja nr {reservation.reservationNumber}</span>
            <StatusBadge status={reservation.status} />
          </SheetTitle>
        </SheetHeader>
        <Tabs defaultValue={initialTab} key={`${reservation.id}-${initialTab}`} className="mt-2">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-6 h-auto gap-0">
            <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm" data-testid="tab-preview">
              PODGLĄD
            </TabsTrigger>
            <TabsTrigger value="payments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm" data-testid="tab-payments">
              PŁATNOŚCI
            </TabsTrigger>
            <TabsTrigger value="edit" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2.5 text-sm" data-testid="tab-edit">
              EDYCJA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="px-6 py-4 mt-0">
            <PreviewTab reservation={reservation} apartments={apartments} />
          </TabsContent>
          <TabsContent value="payments" className="px-6 py-4 mt-0">
            <PaymentsTab reservation={reservation} onUpdated={onUpdated} />
          </TabsContent>
          <TabsContent value="edit" className="px-6 py-4 mt-0">
            <EditTab reservation={reservation} apartments={apartments} onClose={onClose} onUpdated={onUpdated} />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function PreviewTab({ reservation: r, apartments }: { reservation: Reservation; apartments: any[] }) {
  const aptName = getApartmentName(r, apartments);
  const nights = calcNights(r.startDate, r.endDate);
  const pricePerNight = nights > 0 ? (Number(r.price) || 0) / nights : 0;
  const price = Number(r.price) || 0;

  return (
    <div className="space-y-6">
      <div className="flex gap-6">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
            <Calendar className="h-3.5 w-3.5" /> Przyjazd
          </div>
          <div className="text-2xl font-bold" data-testid="text-preview-start">
            {new Date(r.startDate).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
            <Calendar className="h-3.5 w-3.5" /> Wyjazd
          </div>
          <div className="text-2xl font-bold" data-testid="text-preview-end">
            {new Date(r.endDate).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
        <div className="space-y-1 text-right">
          <div className="text-muted-foreground text-xs uppercase tracking-wider">Noclegów</div>
          <div className="text-2xl font-bold text-primary" data-testid="text-preview-nights">{nights}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Status</div>
          <StatusBadge status={r.status} />
        </div>
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Źródło</div>
          <SourceBadge source={r.source} />
        </div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          <User className="h-3.5 w-3.5" /> Dane gościa
        </div>
        <div className="text-lg font-bold" data-testid="text-preview-guest">{r.guestName}</div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          <Home className="h-3.5 w-3.5" /> Apartament
        </div>
        <div className="text-sm font-bold" data-testid="text-preview-apartment">{aptName}</div>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Wartość rezerwacji</div>
          <div className="text-right">
            <span className="text-2xl font-bold" data-testid="text-preview-price">
              {price.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-sm text-muted-foreground ml-1">PLN</span>
          </div>
        </div>
        {pricePerNight > 0 && (
          <div className="text-xs text-muted-foreground">
            {pricePerNight.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN / noc
          </div>
        )}
        <PaymentProgressBarLarge reservation={r} />
      </div>

      {r.notes && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" /> Notatki
          </div>
          <p className="text-sm whitespace-pre-wrap" data-testid="text-preview-notes">{r.notes}</p>
        </div>
      )}

      {r.addDate && (
        <div className="text-xs text-muted-foreground">
          Data dodania: {r.addDate}
        </div>
      )}
    </div>
  );
}

function PaymentsTab({ reservation: r, onUpdated }: { reservation: Reservation; onUpdated: () => void }) {
  const updateReservation = useUpdateReservation();
  const { toast } = useToast();
  const [editField, setEditField] = useState<"prepayment" | "paidAmount" | null>(null);
  const [editValue, setEditValue] = useState("");
  const price = Number(r.price) || 0;

  const savePayment = () => {
    if (!editField) return;
    const numVal = Number(editValue);
    if (isNaN(numVal) || numVal < 0) {
      toast({ title: "Błąd", description: "Podaj prawidłową kwotę", variant: "destructive" });
      return;
    }
    updateReservation.mutate({ id: r.id, data: { [editField]: String(numVal) } }, {
      onSuccess: () => {
        onUpdated();
        setEditField(null);
        toast({ title: "Zapisano", description: "Płatność zaktualizowana" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wider">Wartość rezerwacji</div>
          <div>
            <span className="text-2xl font-bold">{price.toLocaleString("pl-PL", { minimumFractionDigits: 2 })}</span>
            <span className="text-sm text-muted-foreground ml-1">PLN</span>
          </div>
        </div>
        <PaymentProgressBarLarge reservation={r} />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <span className="text-sm font-semibold">Płatności</span>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Typ</TableHead>
              <TableHead className="text-xs">Kwota</TableHead>
              <TableHead className="text-xs w-20">Opcje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow data-testid="row-prepayment">
              <TableCell className="text-sm">Przedpłata / Zaliczka</TableCell>
              <TableCell className="text-sm font-bold">
                {editField === "prepayment" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-28 h-8"
                      autoFocus
                      onKeyDown={e => { if (e.key === "Enter") savePayment(); if (e.key === "Escape") setEditField(null); }}
                      data-testid="input-edit-prepayment"
                    />
                    <Button size="sm" onClick={savePayment} disabled={updateReservation.isPending} className="h-8" data-testid="button-save-prepayment">
                      <Save className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400">{Number(r.prepayment).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN</span>
                )}
              </TableCell>
              <TableCell>
                {editField !== "prepayment" && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditField("prepayment"); setEditValue(r.prepayment || "0"); }} data-testid="button-edit-prepayment">
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
            <TableRow data-testid="row-paid">
              <TableCell className="text-sm">Wpłata</TableCell>
              <TableCell className="text-sm font-bold">
                {editField === "paidAmount" ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="w-28 h-8"
                      autoFocus
                      onKeyDown={e => { if (e.key === "Enter") savePayment(); if (e.key === "Escape") setEditField(null); }}
                      data-testid="input-edit-paid"
                    />
                    <Button size="sm" onClick={savePayment} disabled={updateReservation.isPending} className="h-8" data-testid="button-save-paid">
                      <Save className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-cyan-600 dark:text-cyan-400">{Number(r.paidAmount).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN</span>
                )}
              </TableCell>
              <TableCell>
                {editField !== "paidAmount" && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditField("paidAmount"); setEditValue(r.paidAmount || "0"); }} data-testid="button-edit-paid">
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
            {Number(r.surcharge) > 0 && (
              <TableRow data-testid="row-surcharge">
                <TableCell className="text-sm">Dopłata</TableCell>
                <TableCell className="text-sm font-bold text-amber-600 dark:text-amber-400">{Number(r.surcharge).toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN</TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function EditTab({ reservation, apartments, onClose, onUpdated }: {
  reservation: Reservation;
  apartments: any[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const updateReservation = useUpdateReservation();
  const deleteReservation = useDeleteReservation();
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
      notes: reservation.notes ?? "",
      source: reservation.source ?? "",
    }
  });

  const onSubmit = (data: InsertReservation) => {
    updateReservation.mutate({ id: reservation.id, data }, {
      onSuccess: () => {
        toast({ title: "Zapisano", description: "Rezerwacja zaktualizowana" });
        onUpdated();
        onClose();
      }
    });
  };

  const handleDelete = () => {
    if (!window.confirm("Czy na pewno chcesz usunąć tę rezerwację?")) return;
    deleteReservation.mutate(reservation.id, {
      onSuccess: () => {
        onUpdated();
        onClose();
      }
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label className="text-xs">Apartament</Label>
          <Controller
            control={form.control}
            name="apartmentId"
            render={({ field }) => (
              <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                <SelectTrigger data-testid="edit-select-apartment" className="h-9">
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
          <Label className="text-xs">Numer rezerwacji</Label>
          <Input {...form.register("reservationNumber")} className="h-9" data-testid="edit-input-number" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Gość</Label>
          <Input {...form.register("guestName")} className="h-9" data-testid="edit-input-guest" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Data przyjazdu</Label>
          <Input type="date" {...form.register("startDate")} className="h-9" data-testid="edit-input-start" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Data wyjazdu</Label>
          <Input type="date" {...form.register("endDate")} className="h-9" data-testid="edit-input-end" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Kwota pobytu (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("price")} className="h-9" data-testid="edit-input-price" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Zaliczka (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("prepayment")} className="h-9" data-testid="edit-input-prepayment" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Wpłacona kwota (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("paidAmount")} className="h-9" data-testid="edit-input-paid" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Dopłata (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("surcharge")} className="h-9" data-testid="edit-input-surcharge" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Status</Label>
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger data-testid="edit-select-status" className="h-9">
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
        <div className="space-y-2">
          <Label className="text-xs">Źródło</Label>
          <Controller
            control={form.control}
            name="source"
            render={({ field }) => (
              <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                <SelectTrigger data-testid="edit-select-source" className="h-9">
                  <SelectValue placeholder="Wybierz źródło" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak</SelectItem>
                  <SelectItem value="Booking.com">Booking.com</SelectItem>
                  <SelectItem value="Airbnb">Airbnb</SelectItem>
                  <SelectItem value="Recepcja">Recepcja</SelectItem>
                  <SelectItem value="HotRes">HotRes</SelectItem>
                  <SelectItem value="Inne">Inne</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Data dodania</Label>
          <Input type="date" {...form.register("addDate")} className="h-9" data-testid="edit-input-adddate" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Notatki</Label>
        <textarea
          {...form.register("notes")}
          placeholder="Dodaj notatki..."
          className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-testid="edit-input-notes"
        />
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={deleteReservation.isPending} data-testid="button-delete-reservation">
          <Trash2 className="h-4 w-4 mr-1" /> Usuń
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose} data-testid="button-cancel-edit">
            Anuluj
          </Button>
          <Button type="submit" disabled={updateReservation.isPending} data-testid="button-submit-edit">
            {updateReservation.isPending ? "Zapisywanie..." : "Zapisz zmiany"}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function ReservationForm({ onSuccess }: { onSuccess: () => void }) {
  const createReservation = useCreateReservation();
  const { data: apartments } = useApartments();

  const form = useForm<InsertReservation>({
    resolver: zodResolver(insertReservationSchema),
    defaultValues: {
      reservationNumber: `RES-${Date.now().toString().slice(-6)}`,
      status: "DO_OPLACENIA",
      prepayment: "0",
      paidAmount: "0",
      surcharge: "0",
      source: "",
    }
  });

  const onSubmit = (data: InsertReservation) => {
    createReservation.mutate(data, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/reservations-paginated"] });
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
              <SelectTrigger data-testid="select-reservation-apartment">
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
        <Input {...form.register("reservationNumber")} data-testid="input-reservation-number" />
      </div>
      <div className="space-y-2">
        <Label>Gość</Label>
        <Input {...form.register("guestName")} placeholder="Imię i nazwisko" data-testid="input-reservation-guest" />
      </div>

      <div className="space-y-2">
        <Label>Data przyjazdu</Label>
        <Input type="date" {...form.register("startDate")} data-testid="input-reservation-start" />
      </div>
      <div className="space-y-2">
        <Label>Data wyjazdu</Label>
        <Input type="date" {...form.register("endDate")} data-testid="input-reservation-end" />
      </div>

      <div className="space-y-2">
        <Label>Kwota pobytu (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("price")} data-testid="input-reservation-price" />
      </div>
      <div className="space-y-2">
        <Label>Zaliczka (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("prepayment")} data-testid="input-reservation-prepayment" />
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger data-testid="select-reservation-status">
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

      <div className="space-y-2">
        <Label>Źródło</Label>
        <Controller
          control={form.control}
          name="source"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ""}>
              <SelectTrigger data-testid="select-reservation-source">
                <SelectValue placeholder="Wybierz źródło" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Brak</SelectItem>
                <SelectItem value="Booking.com">Booking.com</SelectItem>
                <SelectItem value="Airbnb">Airbnb</SelectItem>
                <SelectItem value="Recepcja">Recepcja</SelectItem>
                <SelectItem value="HotRes">HotRes</SelectItem>
                <SelectItem value="Inne">Inne</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-2 col-span-2">
        <Label>Notatki</Label>
        <textarea
          {...form.register("notes")}
          placeholder="Dodaj notatki do rezerwacji..."
          className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-testid="input-reservation-notes"
        />
      </div>

      <div className="col-span-2 flex justify-end">
        <Button type="submit" disabled={createReservation.isPending} data-testid="button-submit-reservation">
          {createReservation.isPending ? "Zapisywanie..." : "Zapisz rezerwację"}
        </Button>
      </div>
    </form>
  );
}
