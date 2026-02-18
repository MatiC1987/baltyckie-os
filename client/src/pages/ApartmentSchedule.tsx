import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Lease, Apartment, Owner } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Search, ArrowUpDown, Home, Building2 } from "lucide-react";

type SortField = "apartment" | "location" | "owner" | "tenant" | "rent" | "community" | "total" | "start" | "end" | "status";
type SortDir = "asc" | "desc";

interface ScheduleRow {
  id: string;
  apartmentId: number;
  apartmentName: string;
  location: string;
  address: string | null;
  photoUrl: string | null;
  ownerName: string;
  tenantName: string;
  rentAmount: number;
  communityFee: number;
  totalMonthly: number;
  startDate: string | null;
  endDate: string | null;
  status: "active" | "ended" | "future" | "no-dates";
  statusLabel: string;
  source: "lease" | "owner";
  description: string | null;
}

function getStatus(startDate: string | null, endDate: string | null): { status: ScheduleRow["status"]; label: string } {
  if (!startDate) return { status: "no-dates", label: "Brak dat" };
  const today = new Date().toISOString().split("T")[0];
  if (endDate && endDate < today) return { status: "ended", label: "Zakończona" };
  if (startDate <= today) return { status: "active", label: "Aktywna" };
  return { status: "future", label: "Przyszła" };
}

function statusBadgeVariant(status: ScheduleRow["status"]): "default" | "secondary" | "outline" {
  if (status === "active") return "default";
  if (status === "ended") return "secondary";
  return "outline";
}

export default function ApartmentSchedule() {
  const { data: leases = [], isLoading: leasesLoading } = useQuery<Lease[]>({ queryKey: ["/api/leases"] });
  const { data: apartments = [], isLoading: aptsLoading } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: owners = [] } = useQuery<Owner[]>({ queryKey: ["/api/owners"] });

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [sortField, setSortField] = useState<SortField>("apartment");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const aptsMap = useMemo(() => {
    const m = new Map<number, Apartment>();
    apartments.forEach(a => m.set(a.id, a));
    return m;
  }, [apartments]);

  const ownersMap = useMemo(() => {
    const m = new Map<number, Owner>();
    owners.forEach(o => m.set(o.id, o));
    return m;
  }, [owners]);

  const rows: ScheduleRow[] = useMemo(() => {
    const result: ScheduleRow[] = [];
    const leasedApartmentIds = new Set<number>();

    for (const lease of leases) {
      if (!lease.apartmentId) continue;
      const apt = aptsMap.get(lease.apartmentId);
      const owner = apt?.ownerId ? ownersMap.get(apt.ownerId) : null;
      const rent = parseFloat(lease.rentAmount || "0");
      const community = parseFloat(lease.communityFee || "0");
      const { status, label } = getStatus(lease.startDate, lease.endDate);

      leasedApartmentIds.add(lease.apartmentId);

      result.push({
        id: `lease-${lease.id}`,
        apartmentId: lease.apartmentId,
        apartmentName: apt?.name || `Apartament #${lease.apartmentId}`,
        location: apt?.location || "INNE",
        address: apt?.address || null,
        photoUrl: apt?.photoUrl || null,
        ownerName: owner?.name || apt?.ownerName || "—",
        tenantName: lease.tenantName || "—",
        rentAmount: rent,
        communityFee: community,
        totalMonthly: rent + community,
        startDate: lease.startDate,
        endDate: lease.endDate || null,
        status,
        statusLabel: label,
        source: "lease",
        description: lease.description,
      });
    }

    for (const apt of apartments) {
      if (leasedApartmentIds.has(apt.id)) continue;
      if (!apt.leaseStartDate && !apt.leaseEndDate && !apt.ownerId) continue;
      const owner = apt.ownerId ? ownersMap.get(apt.ownerId) : null;
      const { status, label } = getStatus(apt.leaseStartDate, apt.leaseEndDate);

      result.push({
        id: `owner-${apt.id}`,
        apartmentId: apt.id,
        apartmentName: apt.name,
        location: apt.location || "INNE",
        address: apt.address || null,
        photoUrl: apt.photoUrl || null,
        ownerName: owner?.name || apt.ownerName || "—",
        tenantName: "—",
        rentAmount: 0,
        communityFee: 0,
        totalMonthly: 0,
        startDate: apt.leaseStartDate || null,
        endDate: apt.leaseEndDate || null,
        status,
        statusLabel: label,
        source: "owner",
        description: null,
      });
    }

    return result;
  }, [leases, apartments, aptsMap, ownersMap]);

  const locations = useMemo(() => {
    const locs = new Set(rows.map(r => r.location));
    return Array.from(locs).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (statusFilter !== "ALL") {
      result = result.filter(r => r.status === statusFilter);
    }
    if (locationFilter !== "ALL") {
      result = result.filter(r => r.location === locationFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.apartmentName.toLowerCase().includes(q) ||
        r.ownerName.toLowerCase().includes(q) ||
        r.tenantName.toLowerCase().includes(q) ||
        (r.address || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [rows, statusFilter, locationFilter, searchQuery]);

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const dir = sortDir === "asc" ? 1 : -1;

    copy.sort((a, b) => {
      switch (sortField) {
        case "apartment": return dir * a.apartmentName.localeCompare(b.apartmentName, "pl");
        case "location": return dir * a.location.localeCompare(b.location, "pl");
        case "owner": return dir * a.ownerName.localeCompare(b.ownerName, "pl");
        case "tenant": return dir * a.tenantName.localeCompare(b.tenantName, "pl");
        case "rent": return dir * (a.rentAmount - b.rentAmount);
        case "community": return dir * (a.communityFee - b.communityFee);
        case "total": return dir * (a.totalMonthly - b.totalMonthly);
        case "start": return dir * (a.startDate || "").localeCompare(b.startDate || "");
        case "end": return dir * (a.endDate || "9999").localeCompare(b.endDate || "9999");
        case "status": {
          const order = { active: 0, future: 1, "no-dates": 2, ended: 3 };
          return dir * (order[a.status] - order[b.status]);
        }
        default: return 0;
      }
    });
    return copy;
  }, [filteredRows, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const totals = useMemo(() => {
    const active = filteredRows.filter(r => r.status === "active");
    return {
      count: filteredRows.length,
      activeCount: active.length,
      totalRent: active.reduce((s, r) => s + r.rentAmount, 0),
      totalCommunity: active.reduce((s, r) => s + r.communityFee, 0),
      totalMonthly: active.reduce((s, r) => s + r.totalMonthly, 0),
    };
  }, [filteredRows]);

  const isLoading = leasesLoading || aptsLoading;

  const fmt = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const SortableHead = ({ field, children, className }: { field: SortField; children: string; className?: string }) => (
    <TableHead
      className={`text-xs font-semibold cursor-pointer select-none hover:bg-muted/80 transition-colors whitespace-nowrap ${className || ""}`}
      onClick={() => handleSort(field)}
      data-testid={`sort-${field}`}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-[#5ADBFA]" : "text-muted-foreground/50"}`} />
      </span>
    </TableHead>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h2 className="text-3xl font-bold tracking-tight">Apartamenty - Harmonogram</h2>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight" data-testid="text-apartment-schedule-title">Apartamenty - Harmonogram</h2>
        <p className="text-muted-foreground">Zestawienie opłat z tytułu umów najmu apartamentów</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-total">{totals.count}</div>
            <div className="text-xs text-muted-foreground">Łącznie umów</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-active">{totals.activeCount}</div>
            <div className="text-xs text-muted-foreground">Aktywnych</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-rent">{fmt(totals.totalRent)}</div>
            <div className="text-xs text-muted-foreground">Czynsz /mies.</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-community">{fmt(totals.totalCommunity)}</div>
            <div className="text-xs text-muted-foreground">Wspólnota /mies.</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold text-[#5ADBFA]" data-testid="text-stat-monthly">{fmt(totals.totalMonthly)}</div>
            <div className="text-xs text-muted-foreground">Razem /mies.</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Szukaj po nazwie apartamentu, właścicielu, najemcy..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            data-testid="input-search-schedule"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie statusy</SelectItem>
            <SelectItem value="active">Aktywna</SelectItem>
            <SelectItem value="future">Przyszła</SelectItem>
            <SelectItem value="ended">Zakończona</SelectItem>
            <SelectItem value="no-dates">Brak dat</SelectItem>
          </SelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-location">
            <SelectValue placeholder="Lokalizacja" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Wszystkie lokalizacje</SelectItem>
            {locations.map(loc => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sortedRows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Building2 className="h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Brak umów pasujących do filtrów.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <SortableHead field="apartment">Apartament</SortableHead>
                <SortableHead field="location">Lokalizacja</SortableHead>
                <SortableHead field="owner">Właściciel</SortableHead>
                <SortableHead field="tenant">Najemca</SortableHead>
                <SortableHead field="rent" className="text-right">Czynsz (PLN)</SortableHead>
                <SortableHead field="community" className="text-right">Wspólnota (PLN)</SortableHead>
                <SortableHead field="total" className="text-right">Razem (PLN)</SortableHead>
                <SortableHead field="start">Początek</SortableHead>
                <SortableHead field="end">Koniec</SortableHead>
                <SortableHead field="status">Status</SortableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map(row => (
                <TableRow key={row.id} data-testid={`row-schedule-${row.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {row.photoUrl ? (
                        <img src={row.photoUrl} alt="" className="h-9 w-9 rounded-md object-cover border border-border" />
                      ) : (
                        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                          <Home className="h-4 w-4 text-primary" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium text-sm">{row.apartmentName}</span>
                        {row.address && (
                          <p className="text-xs text-muted-foreground">{row.address}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs whitespace-nowrap">{row.location}</Badge>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{row.ownerName}</TableCell>
                  <TableCell className="text-sm whitespace-nowrap">{row.tenantName}</TableCell>
                  <TableCell className="text-sm text-right tabular-nums whitespace-nowrap font-medium">
                    {row.rentAmount > 0 ? fmt(row.rentAmount) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums whitespace-nowrap">
                    {row.communityFee > 0 ? fmt(row.communityFee) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-right tabular-nums whitespace-nowrap font-semibold">
                    {row.totalMonthly > 0 ? fmt(row.totalMonthly) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {row.startDate || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap">
                    {row.endDate || <span className="text-muted-foreground">Bezterminowa</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadgeVariant(row.status)} data-testid={`badge-status-${row.id}`}>
                      {row.statusLabel}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="text-sm text-muted-foreground" data-testid="text-schedule-count">
        Wyświetlono {sortedRows.length} z {rows.length} pozycji
      </div>
    </div>
  );
}
