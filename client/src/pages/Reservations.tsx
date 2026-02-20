import { useState, useMemo } from "react";
import { useReservations, useCreateReservation, useUpdateReservation } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, ArrowUpDown, ArrowUp, ArrowDown, Filter, Eye, Calendar, User, Home, CreditCard, X, Pencil, Clock, Download, FileText, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TablePageSkeleton } from "@/components/PageSkeleton";
import { FullscreenWrapper, useFullscreen, FullscreenToggleButton } from "@/components/FullscreenWrapper";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReservationSchema, type InsertReservation, type Reservation } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type SortField = "reservationNumber" | "addDate" | "apartmentName" | "startDate" | "endDate" | "guestName" | "price" | "prepayment" | "paidAmount" | "remaining" | "status";
type SortDir = "asc" | "desc";

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

function isGroupReservation(reservation: Reservation): boolean {
  return !!(reservation.apartmentIds && reservation.apartmentIds.length > 1);
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

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "PRZYJETA":
      return <Badge className="text-xs whitespace-nowrap bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">{statusLabel(status)}</Badge>;
    case "ANULOWANA":
      return <Badge variant="destructive" className="text-xs whitespace-nowrap">{statusLabel(status)}</Badge>;
    case "DO_OPLACENIA":
      return <Badge className="text-xs whitespace-nowrap bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800">{statusLabel(status)}</Badge>;
    default:
      return <Badge variant="outline" className="text-xs whitespace-nowrap">{statusLabel(status)}</Badge>;
  }
}

function calcNights(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function InfoRow({ label, value, highlight }: { label: string; value: string | null | undefined; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-border last:border-b-0">
      <span className="text-xs text-muted-foreground w-44 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm ${highlight ? "font-bold" : "font-medium"}`}>{value || "—"}</span>
    </div>
  );
}

function formatImportDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Reservations() {
  const { data: reservations, isLoading } = useReservations();
  const { data: apartments } = useApartments();

  const { data: lastCsvImport } = useQuery<{ importedAt: string; recordsImported: number; recordsUpdated: number; recordsSkipped: number } | null>({ queryKey: ["/api/import-metadata/last/hotres_csv"] });
  const { data: lastApiImport } = useQuery<{ importedAt: string; recordsImported: number; recordsUpdated: number; recordsSkipped: number } | null>({ queryKey: ["/api/import-metadata/last/hotres_api"] });
  const fullscreen = useFullscreen();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortField, setSortField] = useState<SortField>("reservationNumber");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [previewReservation, setPreviewReservation] = useState<Reservation | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    if (!reservations) return [];
    let data = [...reservations];

    if (filterStatus !== "ALL") {
      data = data.filter(r => r.status === filterStatus);
    }
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
        case "status": valA = a.status; valB = b.status; break;
        default: valA = a.startDate; valB = b.startDate;
      }
      if (typeof valA === "string") {
        const cmp = valA.localeCompare(valB, "pl");
        return sortDir === "asc" ? cmp : -cmp;
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return data;
  }, [reservations, apartments, sortField, sortDir, filterStatus, filterDateFrom, filterDateTo]);

  const clearFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterStatus("ALL");
  };

  const hasActiveFilters = filterDateFrom || filterDateTo || filterStatus !== "ALL";

  const handleExportCSV = () => {
    const header = "Nr rezerwacji;Data dodania;Apartament;Od;Do;Gość;Cena;Zaliczka;Zapłacono;Pozostało;Status";
    const rows = filteredAndSorted.map(r => {
      const aptName = getApartmentName(r, apartments || []);
      return `${r.reservationNumber || ""};${r.addDate || ""};${aptName};${r.startDate || ""};${r.endDate || ""};${r.guestName || ""};${Number(r.price || 0).toFixed(2).replace(".", ",")};${Number(r.prepayment || 0).toFixed(2).replace(".", ",")};${Number(r.paidAmount || 0).toFixed(2).replace(".", ",")};${calcRemaining(r).toFixed(2).replace(".", ",")};${r.status || ""}`;
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

  if (isLoading && !reservations) return <TablePageSkeleton />;

  if (reservations && reservations.length === 0) return (
    <div className="space-y-6">
      <PageHeader title="Rezerwacje" description="Zarządzanie rezerwacjami krótkoterminowymi." icon={ClipboardList} />
      <EmptyState icon={ClipboardList} title="Brak rezerwacji" description="Dodaj pierwszą rezerwację lub zaimportuj dane." actionLabel="Dodaj rezerwację" onAction={() => setIsDialogOpen(true)} />
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nowa rezerwacja</DialogTitle>
          </DialogHeader>
          <ReservationForm onSuccess={() => setIsDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rezerwacje"
        description="Zarządzanie rezerwacjami krótkoterminowymi."
        icon={ClipboardList}
        actions={
          <>
            <Button variant="outline" onClick={handleExportCSV} disabled={filteredAndSorted.length === 0} data-testid="button-export-csv">
              <Download className="mr-2 h-4 w-4" /> Eksport CSV
            </Button>
            <Button
              variant={showFilters ? "default" : "outline"}
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="mr-2 h-4 w-4" /> Filtry
              {hasActiveFilters && <Badge variant="secondary" className="ml-2 no-default-hover-elevate no-default-active-elevate">aktywne</Badge>}
            </Button>
            <FullscreenToggleButton isFullscreen={fullscreen.isFullscreen} onToggle={fullscreen.toggle} />
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-reservation">
                  <Plus className="mr-2 h-4 w-4" /> Dodaj rezerwację
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
              Ostatni import CSV: <span className="font-medium text-foreground" data-testid="text-last-csv-import-date">{formatImportDate(lastCsvImport.importedAt)}</span>
              {lastCsvImport.recordsImported > 0 && <span> ({lastCsvImport.recordsImported} nowych</span>}
              {lastCsvImport.recordsUpdated > 0 && <span>, {lastCsvImport.recordsUpdated} zaktual.</span>}
              {(lastCsvImport.recordsImported > 0 || lastCsvImport.recordsUpdated > 0) && <span>)</span>}
            </span>
          )}
          {lastApiImport && (
            <span className="text-xs text-muted-foreground" data-testid="text-last-api-import">
              Ostatni sync API: <span className="font-medium text-foreground" data-testid="text-last-api-import-date">{formatImportDate(lastApiImport.importedAt)}</span>
              {lastApiImport.recordsImported > 0 && <span> ({lastApiImport.recordsImported} nowych</span>}
              {lastApiImport.recordsUpdated > 0 && <span>, {lastApiImport.recordsUpdated} zaktual.</span>}
              {(lastApiImport.recordsImported > 0 || lastApiImport.recordsUpdated > 0) && <span>)</span>}
            </span>
          )}
        </div>
      )}

      {showFilters && (
        <Card data-testid="card-filters">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu od</Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  data-testid="input-filter-date-from"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Data przyjazdu do</Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  data-testid="input-filter-date-to"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger data-testid="select-filter-status" className="w-[180px]">
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
              {hasActiveFilters && (
                <Button variant="ghost" onClick={clearFilters} data-testid="button-clear-filters">
                  Wyczyść filtry
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
              <TableRow className="bg-muted/50">
                <TableHead className="w-10"></TableHead>
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
                <SortableHeader field="status" label="Status" sortField={sortField} sortDir={sortDir} onSort={toggleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSorted.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    Brak rezerwacji
                  </TableCell>
                </TableRow>
              )}
              {filteredAndSorted.map(r => (
                <ReservationRow key={r.id} reservation={r} apartments={apartments || []} onPreview={setPreviewReservation} onEdit={setEditingReservation} />
              ))}
            </TableBody>
          </Table>
        </div>
      </FullscreenWrapper>
      <div className="text-sm text-muted-foreground" data-testid="text-reservations-count">
        Wyświetlono {filteredAndSorted.length} z {reservations?.length || 0} rezerwacji
      </div>

      <ReservationPreviewDialog
        reservation={previewReservation}
        apartments={apartments || []}
        onClose={() => setPreviewReservation(null)}
      />

      <EditReservationDialog
        reservation={editingReservation}
        onClose={() => setEditingReservation(null)}
      />
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

function ReservationRow({ reservation: r, apartments, onPreview, onEdit }: { reservation: Reservation; apartments: any[]; onPreview: (r: Reservation) => void; onEdit: (r: Reservation) => void }) {
  const updateReservation = useUpdateReservation();
  const { toast } = useToast();
  const [editingPaid, setEditingPaid] = useState(false);
  const [paidValue, setPaidValue] = useState(r.paidAmount || "0");
  const [editingStatus, setEditingStatus] = useState(false);

  const isCancelled = r.status === "ANULOWANA";
  const remaining = calcRemaining(r);
  const aptName = getApartmentName(r, apartments);

  const savePaidAmount = () => {
    const numVal = Number(paidValue);
    if (isNaN(numVal) || numVal < 0) {
      toast({ title: "Błąd", description: "Podaj prawidłową kwotę", variant: "destructive" });
      return;
    }
    updateReservation.mutate({ id: r.id, data: { paidAmount: String(numVal) } });
    setEditingPaid(false);
  };

  const changeStatus = (newStatus: string) => {
    updateReservation.mutate({ id: r.id, data: { status: newStatus } });
    setEditingStatus(false);
  };

  return (
    <TableRow
      className={isCancelled ? "bg-red-50 dark:bg-red-950/30" : ""}
      data-testid={`row-reservation-${r.id}`}
    >
      <TableCell>
        <div className="flex items-center gap-0.5">
          <Button size="icon" variant="ghost" onClick={() => onPreview(r)} data-testid={`button-preview-res-${r.id}`}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onEdit(r)} data-testid={`button-edit-res-${r.id}`}>
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
      <TableCell className="font-medium text-xs whitespace-nowrap" data-testid={`text-res-number-${r.id}`}>
        {r.reservationNumber}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`text-res-adddate-${r.id}`}>
        {r.addDate || "—"}
      </TableCell>
      <TableCell className="text-xs font-bold" data-testid={`text-res-apartment-${r.id}`}>
        {aptName.includes(",") ? (
          <div className="flex flex-col gap-0.5">
            {aptName.split(",").map((name, i) => (
              <span key={i} className="whitespace-nowrap">{name.trim()}</span>
            ))}
          </div>
        ) : (
          <span className="whitespace-nowrap">{aptName}</span>
        )}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`text-res-start-${r.id}`}>
        {r.startDate}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`text-res-end-${r.id}`}>
        {r.endDate}
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`text-res-guest-${r.id}`}>
        <span className="flex items-center gap-1">
          {r.guestName}
          {r.notes && (
            <span title={r.notes} className="text-muted-foreground cursor-help">
              <FileText className="h-3 w-3" />
            </span>
          )}
        </span>
      </TableCell>
      <TableCell className="text-xs font-bold whitespace-nowrap" data-testid={`text-res-price-${r.id}`}>
        {Number(r.price).toFixed(2)} zł
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`text-res-prepayment-${r.id}`}>
        {Number(r.prepayment).toFixed(2)} zł
      </TableCell>
      <TableCell className="text-xs whitespace-nowrap" data-testid={`cell-res-paid-${r.id}`}>
        {editingPaid ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              step="0.01"
              value={paidValue}
              onChange={e => setPaidValue(e.target.value)}
              className="w-24 h-7 text-xs"
              onKeyDown={e => { if (e.key === "Enter") savePaidAmount(); if (e.key === "Escape") setEditingPaid(false); }}
              autoFocus
              data-testid={`input-res-paid-${r.id}`}
            />
            <Button size="sm" variant="ghost" onClick={savePaidAmount} className="h-7 px-2 text-xs" data-testid={`button-save-paid-${r.id}`}>OK</Button>
          </div>
        ) : (
          <button
            onClick={() => { setPaidValue(r.paidAmount || "0"); setEditingPaid(true); }}
            className="hover-elevate px-2 py-1 rounded text-left min-w-[60px]"
            data-testid={`button-edit-paid-${r.id}`}
          >
            {Number(r.paidAmount).toFixed(2)} zł
          </button>
        )}
      </TableCell>
      <TableCell className={`text-xs font-semibold whitespace-nowrap ${remaining > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`} data-testid={`text-res-remaining-${r.id}`}>
        {remaining.toFixed(2)} zł
      </TableCell>
      <TableCell data-testid={`cell-res-status-${r.id}`}>
        {editingStatus ? (
          <Select value={r.status} onValueChange={changeStatus}>
            <SelectTrigger className="w-[150px] h-7 text-xs" data-testid={`select-res-status-${r.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DO_OPLACENIA">DO OPŁACENIA</SelectItem>
              <SelectItem value="PRZYJETA">PRZYJĘTA</SelectItem>
              <SelectItem value="ANULOWANA">ANULOWANA</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <button onClick={() => setEditingStatus(true)} data-testid={`button-edit-status-${r.id}`}>
            <StatusBadge status={r.status} />
          </button>
        )}
      </TableCell>
    </TableRow>
  );
}

function ReservationPreviewDialog({ reservation, apartments, onClose }: {
  reservation: Reservation | null;
  apartments: any[];
  onClose: () => void;
}) {
  if (!reservation) return null;

  const r = reservation;
  const aptName = getApartmentName(r, apartments);
  const remaining = calcRemaining(r);
  const nights = calcNights(r.startDate, r.endDate);
  const pricePerNight = nights > 0 ? Number(r.price) / nights : 0;

  return (
    <Dialog open={!!reservation} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap" data-testid="text-preview-title">
            <span>Rezerwacja #{r.reservationNumber}</span>
            <StatusBadge status={r.status} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          <div className="rounded-lg border border-border p-4 space-y-0">
            <div className="flex items-center gap-2 mb-3">
              <Home className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Apartament</span>
            </div>
            {aptName.includes(",") ? (
              <div className="flex flex-col gap-1 pl-6">
                {aptName.split(",").map((name, i) => (
                  <span key={i} className="text-sm font-bold">{name.trim()}</span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-bold pl-6">{aptName}</p>
            )}
          </div>

          <div className="rounded-lg border border-border p-4 space-y-0">
            <div className="flex items-center gap-2 mb-3">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Gość</span>
            </div>
            <InfoRow label="Imię i nazwisko" value={r.guestName} highlight />
          </div>

          <div className="rounded-lg border border-border p-4 space-y-0">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Termin pobytu</span>
            </div>
            <InfoRow label="Data dodania" value={r.addDate} />
            <InfoRow label="Przyjazd" value={r.startDate} highlight />
            <InfoRow label="Wyjazd" value={r.endDate} highlight />
            <InfoRow label="Liczba noclegów" value={`${nights}`} />
          </div>

          <div className="rounded-lg border border-border p-4 space-y-0">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">Rozliczenie</span>
            </div>
            <InfoRow label="Kwota pobytu" value={`${Number(r.price).toFixed(2)} zł`} highlight />
            <InfoRow label="Cena za noc" value={`${pricePerNight.toFixed(2)} zł`} />
            <InfoRow label="Zaliczka" value={`${Number(r.prepayment).toFixed(2)} zł`} />
            <InfoRow label="Wpłacona kwota" value={`${Number(r.paidAmount).toFixed(2)} zł`} />
            <div className="flex items-start gap-2 py-2.5 border-b border-border last:border-b-0">
              <span className="text-xs text-muted-foreground w-44 shrink-0 pt-0.5">Pozostało do zapłaty</span>
              <span className={`text-sm font-bold ${remaining > 0 ? "text-orange-600 dark:text-orange-400" : "text-green-600 dark:text-green-400"}`}>
                {remaining.toFixed(2)} zł
              </span>
            </div>
            {Number(r.surcharge) > 0 && (
              <InfoRow label="Dopłata" value={`${Number(r.surcharge).toFixed(2)} zł`} />
            )}
          </div>

          {r.notes && (
            <div className="rounded-lg border border-border p-4 space-y-0">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-primary">Notatki</span>
              </div>
              <p className="text-sm whitespace-pre-wrap" data-testid={`text-res-notes-${r.id}`}>{r.notes}</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={onClose} data-testid="button-close-preview">
              Zamknij
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EditReservationDialog({ reservation, onClose }: {
  reservation: Reservation | null;
  onClose: () => void;
}) {
  if (!reservation) return null;
  return (
    <Dialog open={!!reservation} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-edit-reservation-title">
            Edytuj rezerwację #{reservation.reservationNumber}
          </DialogTitle>
        </DialogHeader>
        <EditReservationForm reservation={reservation} onSuccess={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function EditReservationForm({ reservation, onSuccess }: { reservation: Reservation; onSuccess: () => void }) {
  const updateReservation = useUpdateReservation();
  const { data: apartments } = useApartments();
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
    }
  });

  const onSubmit = (data: InsertReservation) => {
    updateReservation.mutate({ id: reservation.id, data }, {
      onSuccess: () => {
        toast({ title: "Sukces", description: "Rezerwacja zaktualizowana" });
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
              <SelectTrigger data-testid="edit-select-reservation-apartment">
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
        <Input {...form.register("reservationNumber")} data-testid="edit-input-reservation-number" />
      </div>
      <div className="space-y-2">
        <Label>Gość</Label>
        <Input {...form.register("guestName")} placeholder="Imię i nazwisko" data-testid="edit-input-reservation-guest" />
      </div>

      <div className="space-y-2">
        <Label>Data dodania</Label>
        <Input type="date" {...form.register("addDate")} data-testid="edit-input-reservation-adddate" />
      </div>

      <div className="space-y-2">
        <Label>Data przyjazdu</Label>
        <Input type="date" {...form.register("startDate")} data-testid="edit-input-reservation-start" />
      </div>
      <div className="space-y-2">
        <Label>Data wyjazdu</Label>
        <Input type="date" {...form.register("endDate")} data-testid="edit-input-reservation-end" />
      </div>

      <div className="space-y-2">
        <Label>Kwota pobytu (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("price")} data-testid="edit-input-reservation-price" />
      </div>
      <div className="space-y-2">
        <Label>Zaliczka (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("prepayment")} data-testid="edit-input-reservation-prepayment" />
      </div>
      <div className="space-y-2">
        <Label>Wpłacona kwota (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("paidAmount")} data-testid="edit-input-reservation-paidamount" />
      </div>
      <div className="space-y-2">
        <Label>Dopłata (PLN)</Label>
        <Input type="number" step="0.01" {...form.register("surcharge")} data-testid="edit-input-reservation-surcharge" />
      </div>

      <div className="space-y-2">
        <Label>Status</Label>
        <Controller
          control={form.control}
          name="status"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value}>
              <SelectTrigger data-testid="edit-select-reservation-status">
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

      <div className="space-y-2 col-span-2">
        <Label>Notatki</Label>
        <textarea
          {...form.register("notes")}
          placeholder="Dodaj notatki do rezerwacji..."
          className="w-full min-h-[60px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          data-testid="edit-input-reservation-notes"
        />
      </div>

      <div className="col-span-2 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onSuccess} data-testid="button-cancel-edit-reservation">
          Anuluj
        </Button>
        <Button type="submit" disabled={updateReservation.isPending} data-testid="button-submit-edit-reservation">
          {updateReservation.isPending ? "Zapisywanie..." : "Zapisz zmiany"}
        </Button>
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
    }
  });

  const onSubmit = (data: InsertReservation) => {
    createReservation.mutate(data, {
      onSuccess: () => onSuccess()
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
