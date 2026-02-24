import { useState, useMemo } from "react";
import { useLeases, useCreateLease } from "@/hooks/use-leases";
import { useApartments } from "@/hooks/use-apartments";
import { useOwners } from "@/hooks/use-owners";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Home, Users, Search, FileSignature, AlertTriangle, Eraser } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { TablePageSkeleton } from "@/components/PageSkeleton";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeaseSchema, type InsertLease, type Apartment, type Owner } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const LOCATIONS = ["BULWAR PORTOWY", "NA WYDMIE", "WCZASOWA", "GRAND BALTIC", "PRZEWŁOKA", "INNE"];

export default function Leases() {
  const { data: leases, isLoading: leasesLoading } = useLeases();
  const { data: apartments, isLoading: aptsLoading } = useApartments();
  const { data: owners } = useOwners();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ownerFilter, setOwnerFilter] = useState("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("owner-contracts");

  const ownersMap = useMemo(() => {
    const map = new Map<number, Owner>();
    owners?.forEach(o => map.set(o.id, o));
    return map;
  }, [owners]);

  const apartmentsMap = useMemo(() => {
    const map = new Map<number, Apartment>();
    apartments?.forEach(a => map.set(a.id, a));
    return map;
  }, [apartments]);

  const ownerContracts = useMemo(() => {
    if (!apartments || !owners) return [];
    return apartments
      .filter(apt => apt.ownerId)
      .map(apt => {
        const owner = apt.ownerId ? ownersMap.get(apt.ownerId) : null;
        return {
          apartmentId: apt.id,
          apartmentName: apt.name,
          location: apt.location || "INNE",
          address: apt.address,
          photoUrl: apt.photoUrl,
          ownerId: apt.ownerId!,
          ownerName: owner?.name || apt.ownerName || "Nieznany",
          ownerPhone: owner?.phone || null,
          ownerEmail: owner?.email || null,
          leaseStartDate: apt.leaseStartDate,
          leaseEndDate: apt.leaseEndDate,
          active: apt.active,
        };
      });
  }, [apartments, owners, ownersMap]);

  const filteredOwnerContracts = useMemo(() => {
    let result = ownerContracts;
    if (ownerFilter !== "ALL") {
      result = result.filter(c => c.ownerId === Number(ownerFilter));
    }
    if (locationFilter !== "ALL") {
      result = result.filter(c => c.location === locationFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.apartmentName.toLowerCase().includes(q) ||
        c.ownerName.toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [ownerContracts, ownerFilter, locationFilter, searchQuery]);

  const uniqueOwners = useMemo(() => {
    const ids = new Set(ownerContracts.map(c => c.ownerId));
    return owners?.filter(o => ids.has(o.id)) || [];
  }, [ownerContracts, owners]);

  const isLoading = leasesLoading || aptsLoading;

  function getContractStatus(startDate: string | null, endDate: string | null): { label: string; variant: "default" | "secondary" | "outline" } {
    if (!startDate) return { label: "Brak dat", variant: "outline" };
    const today = new Date().toISOString().split("T")[0];
    if (endDate && endDate < today) return { label: "Zakończona", variant: "secondary" };
    if (startDate <= today) return { label: "Aktywna", variant: "default" };
    return { label: "Przyszła", variant: "outline" };
  }

  if (isLoading) return <TablePageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Umowy najmu"
        description="Zarządzanie umowami najmu i kontraktami właścicieli."
        icon={FileSignature}
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-lease">
                <Plus className="mr-2 h-4 w-4" /> Dodaj umowę najmu
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nowa umowa najmu</DialogTitle>
              </DialogHeader>
              <LeaseForm onSuccess={() => setIsDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-owner-contracts">{ownerContracts.length}</div>
            <div className="text-xs text-muted-foreground">Umów właścicieli</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-active-owner-contracts">
              {ownerContracts.filter(c => getContractStatus(c.leaseStartDate, c.leaseEndDate).label === "Aktywna").length}
            </div>
            <div className="text-xs text-muted-foreground">Aktywnych umów</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-tenant-leases">{leases?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Umów najmu</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-unique-owners">{uniqueOwners.length}</div>
            <div className="text-xs text-muted-foreground">Właścicieli</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="owner-contracts" data-testid="tab-owner-contracts">
            <Users className="mr-2 h-4 w-4" /> Umowy właścicieli ({ownerContracts.length})
          </TabsTrigger>
          <TabsTrigger value="tenant-leases" data-testid="tab-tenant-leases">
            <FileText className="mr-2 h-4 w-4" /> Umowy najmu ({leases?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="diagnostics" data-testid="tab-cost-diagnostics">
            <AlertTriangle className="mr-2 h-4 w-4" /> Diagnostyka kosztów
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owner-contracts" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Szukaj po nazwie apartamentu, właścicielu..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                data-testid="input-search-owner-contracts"
              />
            </div>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[200px]" data-testid="select-filter-owner">
                <SelectValue placeholder="Właściciel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Wszyscy właściciele</SelectItem>
                {uniqueOwners.map(o => (
                  <SelectItem key={o.id} value={o.id.toString()}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-location">
                <SelectValue placeholder="Lokalizacja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Wszystkie lokalizacje</SelectItem>
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredOwnerContracts.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <Users className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">Brak umów właścicieli pasujących do filtrów.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold">Apartament</TableHead>
                    <TableHead className="text-xs font-semibold">Lokalizacja</TableHead>
                    <TableHead className="text-xs font-semibold">Właściciel</TableHead>
                    <TableHead className="text-xs font-semibold">Kontakt</TableHead>
                    <TableHead className="text-xs font-semibold">Początek umowy</TableHead>
                    <TableHead className="text-xs font-semibold">Koniec umowy</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOwnerContracts.map(contract => {
                    const status = getContractStatus(contract.leaseStartDate, contract.leaseEndDate);
                    return (
                      <TableRow key={contract.apartmentId} data-testid={`row-owner-contract-${contract.apartmentId}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {contract.photoUrl ? (
                              <img src={contract.photoUrl} alt="" className="h-9 w-9 rounded-md object-cover border border-border" />
                            ) : (
                              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                                <Home className="h-4 w-4 text-primary" />
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-sm">{contract.apartmentName}</span>
                              {contract.address && (
                                <p className="text-xs text-muted-foreground">{contract.address}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">{contract.location}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm whitespace-nowrap">{contract.ownerName}</TableCell>
                        <TableCell className="text-xs">
                          <div className="flex flex-col gap-0.5">
                            {contract.ownerPhone && <span>{contract.ownerPhone}</span>}
                            {contract.ownerEmail && <span className="text-muted-foreground">{contract.ownerEmail}</span>}
                            {!contract.ownerPhone && !contract.ownerEmail && <span className="text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {contract.leaseStartDate || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {contract.leaseEndDate || <span className="text-muted-foreground">Bezterminowa</span>}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant} data-testid={`badge-contract-status-${contract.apartmentId}`}>
                            {status.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="text-sm text-muted-foreground" data-testid="text-owner-contracts-count">
            Wyświetlono {filteredOwnerContracts.length} z {ownerContracts.length} umów właścicieli
          </div>
        </TabsContent>

        <TabsContent value="tenant-leases" className="mt-4 space-y-4">
          {(!leases || leases.length === 0) ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <FileText className="h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">Brak umów najmu. Kliknij "Dodaj umowę najmu" aby dodać pierwszą.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs font-semibold">Apartament</TableHead>
                    <TableHead className="text-xs font-semibold">Najemca</TableHead>
                    <TableHead className="text-xs font-semibold">Czynsz</TableHead>
                    <TableHead className="text-xs font-semibold">Czynsz do wspólnoty</TableHead>
                    <TableHead className="text-xs font-semibold">Okres</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leases.map(lease => {
                    const apt = lease.apartmentId ? apartmentsMap.get(lease.apartmentId) : null;
                    const today = new Date().toISOString().split("T")[0];
                    const isActive = lease.startDate <= today && (!lease.endDate || lease.endDate >= today);
                    return (
                      <TableRow key={lease.id} data-testid={`row-lease-${lease.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {apt?.photoUrl ? (
                              <img src={apt.photoUrl} alt="" className="h-9 w-9 rounded-md object-cover border border-border" />
                            ) : (
                              <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                                <Home className="h-4 w-4 text-primary" />
                              </div>
                            )}
                            <span className="font-medium text-sm">{apt?.name || `#${lease.apartmentId}`}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{lease.tenantName || "—"}</TableCell>
                        <TableCell className="font-semibold text-sm whitespace-nowrap">{Number(lease.rentAmount).toFixed(2)} PLN</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{lease.communityFee ? `${Number(lease.communityFee).toFixed(2)} PLN` : "—"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">
                          {lease.startDate} — {lease.endDate || "bezterminowa"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={isActive ? "default" : "secondary"}>
                            {isActive ? "Aktywna" : "Zakończona"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="text-sm text-muted-foreground" data-testid="text-tenant-leases-count">
            Łącznie {leases?.length || 0} umów najmu
          </div>
        </TabsContent>

        <TabsContent value="diagnostics" className="mt-4">
          <CostDiagnosticsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type DiagnosticsEntry = {
  contractId: number;
  contractExists: boolean;
  apartmentId: number;
  apartmentName: string;
  year: number;
  totalForecast: number;
};

function CostDiagnosticsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const { data: entries = [], isLoading } = useQuery<DiagnosticsEntry[]>({
    queryKey: ['/api/cost-forecasts/diagnostics'],
    queryFn: async () => {
      const r = await fetch('/api/cost-forecasts/diagnostics', { credentials: 'include' });
      if (!r.ok) throw new Error('Error');
      return r.json();
    },
  });

  const clearMut = useMutation({
    mutationFn: async ({ contractId, year }: { contractId: number; year: number }) => {
      const r = await fetch(`/api/owner-contracts/${contractId}/cost-forecasts?year=${year}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!r.ok) throw new Error('Error');
      return r.json();
    },
    onSuccess: (data: { deleted: number }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/cost-forecasts/diagnostics'] });
      toast({ title: "Wyczyszczono", description: `Usunięto ${data.deleted} wpisów kosztów` });
    },
    onError: () => toast({ title: "Błąd", description: "Nie udało się usunąć wpisów", variant: "destructive" }),
  });

  const orphaned = entries.filter(e => !e.contractExists);
  const currentYearEntries = entries.filter(e => e.year === currentYear);
  const totalCurrentYear = currentYearEntries.reduce((s, e) => s + e.totalForecast, 0);
  const uniqueApts = new Set(currentYearEntries.map(e => e.apartmentId)).size;

  if (isLoading) return <div className="text-sm text-muted-foreground py-8 text-center">Ładowanie...</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xl font-bold">{totalCurrentYear.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł</div>
            <div className="text-xs text-muted-foreground">Auto-koszty umowne {currentYear}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xl font-bold">{uniqueApts}</div>
            <div className="text-xs text-muted-foreground">Apartamentów z auto-kosztami</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className={`text-xl font-bold ${orphaned.length > 0 ? 'text-red-600' : 'text-green-600'}`}>{orphaned.length}</div>
            <div className="text-xs text-muted-foreground">Osieroconych wpisów (bez umowy)</div>
          </CardContent>
        </Card>
      </div>

      {orphaned.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>Znaleziono <strong>{orphaned.length}</strong> wpisów kosztów powiązanych z usuniętymi umowami właścicielskimi. Usuń je, aby wyczyścić dane.</span>
        </div>
      )}

      {entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">Brak automatycznie wygenerowanych kosztów umownych.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">Apartament</TableHead>
                <TableHead className="text-xs font-semibold">Rok</TableHead>
                <TableHead className="text-xs font-semibold text-right">Suma kosztów auto.</TableHead>
                <TableHead className="text-xs font-semibold">Status umowy</TableHead>
                <TableHead className="text-xs font-semibold w-[100px]">Akcja</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e, i) => (
                <TableRow
                  key={i}
                  className={!e.contractExists ? 'bg-red-50 dark:bg-red-950/40' : ''}
                  data-testid={`row-diagnostics-${e.contractId}-${e.apartmentId}-${e.year}`}
                >
                  <TableCell className="font-medium text-sm">{e.apartmentName}</TableCell>
                  <TableCell className="text-sm">{e.year}</TableCell>
                  <TableCell className="text-right font-semibold text-sm">
                    {e.totalForecast.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                  </TableCell>
                  <TableCell>
                    {e.contractExists ? (
                      <Badge variant="outline" className="text-[10px] bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border-green-200">Aktywna umowa</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200">Umowa usunięta</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      disabled={clearMut.isPending}
                      onClick={() => {
                        if (confirm(`Usunąć wygenerowane wpisy kosztów dla umowy #${e.contractId} za rok ${e.year}?`)) {
                          clearMut.mutate({ contractId: e.contractId, year: e.year });
                        }
                      }}
                      data-testid={`btn-clear-diagnostics-${e.contractId}-${e.year}`}
                    >
                      <Eraser className="h-3 w-3 mr-1" /> Wyczyść
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function LeaseForm({ onSuccess }: { onSuccess: () => void }) {
  const createLease = useCreateLease();
  const { data: apartments } = useApartments();

  const form = useForm<InsertLease>({
    resolver: zodResolver(insertLeaseSchema),
    defaultValues: {
      rentAmount: "0",
      communityFee: "0",
      tenantName: "",
      description: "",
    }
  });

  const onSubmit = (data: InsertLease) => {
    createLease.mutate(data, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label>Apartament</Label>
          <Controller
            control={form.control}
            name="apartmentId"
            render={({ field }) => (
              <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                <SelectTrigger data-testid="select-lease-apartment">
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
          <Label>Najemca</Label>
          <Input {...form.register("tenantName")} placeholder="Imię i nazwisko" data-testid="input-lease-tenant" />
        </div>
        <div className="space-y-2">
          <Label>Czynsz (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("rentAmount")} data-testid="input-lease-rent" />
        </div>

        <div className="space-y-2">
          <Label>Data początku</Label>
          <Input type="date" {...form.register("startDate")} data-testid="input-lease-start" />
        </div>
        <div className="space-y-2">
          <Label>Data końca (opcjonalnie)</Label>
          <Input type="date" {...form.register("endDate")} data-testid="input-lease-end" />
        </div>

        <div className="space-y-2">
          <Label>Czynsz do wspólnoty (PLN)</Label>
          <Input type="number" step="0.01" {...form.register("communityFee")} data-testid="input-lease-community" />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={createLease.isPending} data-testid="button-submit-lease">
          {createLease.isPending ? "Zapisywanie..." : "Zapisz umowę"}
        </Button>
      </DialogFooter>
    </form>
  );
}
