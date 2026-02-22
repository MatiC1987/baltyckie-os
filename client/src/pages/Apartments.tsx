import { useState, useMemo, useRef, useEffect } from "react";
import { useApartments, useCreateApartment, useUpdateApartment, useDeleteApartment } from "@/hooks/use-apartments";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Home, Building2, Pencil, Trash2, Paperclip, FileText, Upload, X, Camera, ImageIcon, Wallet, CalendarDays, CheckSquare, FolderInput, ChevronDown, ChevronRight, ChevronLeft, Loader2, BarChart3, TrendingUp, TrendingDown, DollarSign, Percent, BedDouble, AlertCircle, Clock, Eye, Copy, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { TablePageSkeleton } from "@/components/PageSkeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertApartmentSchema, insertOwnerPaymentSchema, type InsertApartment, type InsertOwnerPayment, type Apartment, type Attachment, type Owner, type OwnerPayment, type OwnerContract, type RevenueForecast } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import { useOwners } from "@/hooks/use-owners";
import { apiRequest } from "@/lib/queryClient";

const LOCATIONS = [
  "BULWAR PORTOWY",
  "NA WYDMIE",
  "WCZASOWA",
  "GRAND BALTIC",
  "PRZEWŁOKA",
  "INNE",
] as const;

const OTHER_LABEL = "INNE";

function normalizeKey(loc: string): string {
  return loc.trim().toUpperCase();
}

export default function Apartments() {
  const { data: apartments, isLoading } = useApartments();
  const { data: ownersList } = useOwners();
  const { data: allAttachments = [] } = useQuery<Attachment[]>({
    queryKey: ['/api/attachments/all'],
  });
  const updateApartmentMutation = useUpdateApartment();
  const deleteApartmentMutation = useDeleteApartment();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingApartment, setEditingApartment] = useState<Apartment | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const { toast } = useToast();

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleGroupSelect = (groupApartments: Apartment[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = groupApartments.every(a => next.has(a.id));
      if (allSelected) {
        groupApartments.forEach(a => next.delete(a.id));
      } else {
        groupApartments.forEach(a => next.add(a.id));
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!apartments) return;
    setSelectedIds(prev => {
      const allSelected = apartments.every(a => prev.has(a.id));
      return allSelected ? new Set() : new Set(apartments.map(a => a.id));
    });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć ${selectedIds.size} apartament(ów)? Wszystkie powiązane rezerwacje, umowy, koszty i blokady zostaną również usunięte.`)) return;
    setIsDeletingBulk(true);
    try {
      for (const id of selectedIds) {
        await new Promise<void>((resolve, reject) => {
          deleteApartmentMutation.mutate(id, { onSuccess: () => resolve(), onError: (err) => reject(err) });
        });
      }
      setSelectedIds(new Set());
      toast({ title: "Sukces", description: `Usunięto ${selectedIds.size} apartament(ów).` });
    } catch {
      toast({ title: "Błąd", description: "Nie udało się usunąć niektórych apartamentów.", variant: "destructive" });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const [isMoving, setIsMoving] = useState(false);
  const [moveSelectKey, setMoveSelectKey] = useState(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("apartments-collapsed-groups");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const toggleCollapse = (label: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      localStorage.setItem("apartments-collapsed-groups", JSON.stringify([...next]));
      return next;
    });
  };
  const handleBulkMove = async (targetLocation: string) => {
    if (selectedIds.size === 0) return;
    setIsMoving(true);
    try {
      for (const id of selectedIds) {
        await new Promise<void>((resolve, reject) => {
          updateApartmentMutation.mutate(
            { id, location: targetLocation },
            { onSuccess: () => resolve(), onError: (err) => reject(err) }
          );
        });
      }
      const count = selectedIds.size;
      setSelectedIds(new Set());
      setMoveSelectKey(k => k + 1);
      toast({ title: "Sukces", description: `Przeniesiono ${count} apartament(ów) do ${targetLocation}.` });
    } catch {
      toast({ title: "Błąd", description: "Nie udało się przenieść niektórych apartamentów.", variant: "destructive" });
    } finally {
      setIsMoving(false);
    }
  };

  const ownersMap = useMemo(() => {
    const map = new Map<number, Owner>();
    if (ownersList) for (const o of ownersList) map.set(o.id, o);
    return map;
  }, [ownersList]);

  const groupedApartments = useMemo(() => {
    const groups: { label: string; apartments: Apartment[] }[] = LOCATIONS.map(loc => ({
      label: loc,
      apartments: [],
    }));

    if (apartments) {
      for (const apt of apartments) {
        const loc = apt.location?.trim() || "";
        const key = normalizeKey(loc);
        const group = groups.find(g => normalizeKey(g.label) === key);
        if (group) {
          group.apartments.push(apt);
        } else {
          const otherGroup = groups.find(g => g.label === OTHER_LABEL);
          if (otherGroup) otherGroup.apartments.push(apt);
        }
      }
    }

    return groups;
  }, [apartments]);

  const expiringContracts = useMemo(() => {
    if (!apartments || !ownersList) return [];
    const ownersMap = new Map(ownersList.map(o => [o.id, o.name]));
    return apartments
      .filter(apt => apt.leaseEndDate)
      .map(apt => ({
        id: apt.id,
        name: apt.name,
        ownerName: apt.ownerId ? (ownersMap.get(apt.ownerId) || "—") : "—",
        leaseEndDate: apt.leaseEndDate!,
      }))
      .sort((a, b) => a.leaseEndDate.localeCompare(b.leaseEndDate));
  }, [apartments, ownersList]);

  const columns = [
    {
      header: "",
      className: "w-10",
      cell: (apt: any) => (
        <input
          type="checkbox"
          checked={selectedIds.has(apt.id)}
          onChange={() => toggleSelect(apt.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          data-testid={`checkbox-select-apartment-${apt.id}`}
        />
      )
    },
    {
      header: "Nazwa",
      cell: (apt: any) => (
        <div className="flex items-center gap-3">
          {apt.photoUrl ? (
            <img
              src={apt.photoUrl}
              alt={apt.name}
              className="h-10 w-10 rounded-lg object-cover"
              data-testid={`img-apartment-photo-${apt.id}`}
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Home className="h-5 w-5" />
            </div>
          )}
          <div>
            <div className="font-semibold" data-testid={`text-apartment-name-${apt.id}`}>{apt.name}</div>
            <div className="text-xs text-muted-foreground">{apt.address || `ID: #${apt.id}`}</div>
          </div>
        </div>
      )
    },
    {
      header: "Właściciel",
      cell: (apt: any) => {
        const owner = apt.ownerId ? ownersMap.get(apt.ownerId) : null;
        return owner ? (
          <span data-testid={`text-apartment-owner-${apt.id}`}>{owner.name}</span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      }
    },
    {
      header: "Początek najmu",
      cell: (apt: any) => (
        <span className="text-sm" data-testid={`text-lease-start-${apt.id}`}>
          {apt.leaseStartDate || <span className="text-muted-foreground text-xs">—</span>}
        </span>
      )
    },
    {
      header: "Koniec najmu",
      cell: (apt: any) => (
        <span className="text-sm" data-testid={`text-lease-end-${apt.id}`}>
          {apt.leaseEndDate || <span className="text-muted-foreground text-xs">—</span>}
        </span>
      )
    },
    {
      header: "Status",
      cell: (apt: any) => (
        <Badge variant={apt.active ? "default" : "secondary"}>
          {apt.active ? "Aktywny" : "Nieaktywny"}
        </Badge>
      )
    },
    {
      header: "Załączniki",
      cell: (apt: any) => {
        const atts = allAttachments.filter(a => a.apartmentId === apt.id);
        if (atts.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(atts.length, 4)}, auto)` }}>
            {atts.map(att => (
              <a
                key={att.id}
                href={att.objectPath}
                target="_blank"
                rel="noopener noreferrer"
                title={att.fileName}
                data-testid={`link-apt-attachment-${att.id}`}
              >
                <Badge variant="outline" className="text-xs gap-1 cursor-pointer whitespace-nowrap">
                  <FileText className="h-3 w-3" />
                  {att.category === 'UMOWA' ? 'Umowa' : att.category === 'ANEKS' ? 'Aneks' : att.category === 'FAKTURA' ? 'Faktura' : 'Inny'}
                </Badge>
              </a>
            ))}
          </div>
        );
      }
    },
    {
      header: "",
      cell: (apt: any) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditingApartment(apt)}
            data-testid={`button-edit-apartment-${apt.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  if (isLoading && !apartments) return <TablePageSkeleton />;

  if (apartments && apartments.length === 0) return (
    <div className="space-y-6">
      <PageHeader title="Apartamenty" description="Zarządzanie apartamentami i lokalizacjami." icon={Building2} actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-apartment">
              <Plus className="mr-2 h-4 w-4" /> Dodaj apartament
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dodaj nowy apartament</DialogTitle>
            </DialogHeader>
            <ApartmentForm onSuccess={() => setIsDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      } />
      <EmptyState icon={Building2} title="Brak apartamentów" description="Dodaj pierwszy apartament." actionLabel="Dodaj apartament" onAction={() => setIsDialogOpen(true)} />
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Apartamenty"
        description="Zarządzanie apartamentami i lokalizacjami."
        icon={Building2}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={selectAll} data-testid="button-select-all">
              <CheckSquare className="mr-2 h-4 w-4" />
              {apartments && apartments.every(a => selectedIds.has(a.id)) && selectedIds.size > 0 ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
            </Button>
            {selectedIds.size > 0 && (
              <>
                <Select
                  key={moveSelectKey}
                  onValueChange={handleBulkMove}
                  disabled={isMoving}
                >
                  <SelectTrigger className="w-auto min-w-[200px]" data-testid="select-move-to-location">
                    <FolderInput className="mr-2 h-4 w-4" />
                    <SelectValue placeholder={isMoving ? "Przenoszenie..." : `Przenieś do... (${selectedIds.size})`} />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATIONS.map(loc => (
                      <SelectItem key={loc} value={loc} data-testid={`option-move-${loc.toLowerCase().replace(/\s+/g, '-')}`}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="destructive"
                  onClick={handleBulkDelete}
                  disabled={isDeletingBulk}
                  data-testid="button-delete-selected"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isDeletingBulk ? "Usuwanie..." : `Usuń wybrane (${selectedIds.size})`}
                </Button>
              </>
            )}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-apartment">
                  <Plus className="mr-2 h-4 w-4" /> Dodaj apartament
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dodaj nowy apartament</DialogTitle>
                </DialogHeader>
                <ApartmentForm onSuccess={() => setIsDialogOpen(false)} />
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-total">{apartments?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Wszystkie</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-active">{apartments?.filter(a => a.active).length || 0}</div>
            <div className="text-xs text-muted-foreground">Aktywne</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-2xl font-bold" data-testid="text-stat-locations">{groupedApartments.filter(g => g.apartments.length > 0).length}</div>
            <div className="text-xs text-muted-foreground">Lokalizacje</div>
          </CardContent>
        </Card>
      </div>

      {groupedApartments.map((group) => {
        const isCollapsed = collapsedGroups.has(group.label);
        return (
          <div key={group.label} className="space-y-3" data-testid={`group-location-${group.label.toLowerCase().replace(/\s+/g, '-').replace(/ł/g, 'l')}`}>
            <div
              className="flex items-center gap-3 cursor-pointer select-none"
              onClick={() => toggleCollapse(group.label)}
              data-testid={`button-toggle-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {group.apartments.length > 0 && (
                <input
                  type="checkbox"
                  checked={group.apartments.length > 0 && group.apartments.every(a => selectedIds.has(a.id))}
                  onChange={() => toggleGroupSelect(group.apartments)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                  data-testid={`checkbox-select-group-${group.label.toLowerCase().replace(/\s+/g, '-')}`}
                />
              )}
              {isCollapsed ? (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">{group.label}</h3>
                <Badge variant="secondary" className="text-xs">{group.apartments.length}</Badge>
              </div>
            </div>
            {!isCollapsed && (
              group.apartments.length > 0 ? (
                <DataTable
                  data={group.apartments}
                  columns={columns}
                  emptyMessage="Brak apartamentów w tej lokalizacji."
                />
              ) : (
                <div className="text-sm text-muted-foreground pl-11">
                  Brak apartamentów w tej lokalizacji.
                </div>
              )
            )}
          </div>
        );
      })}

      {expiringContracts.length > 0 && (() => {
        const today = new Date().toISOString().split('T')[0];
        const withDays = expiringContracts.map(c => {
          const daysLeft = Math.ceil((new Date(c.leaseEndDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24));
          return { ...c, daysLeft };
        });
        const sections = [
          { title: "Do 30 dni", suffix: "!!!", items: withDays.filter(c => c.daysLeft <= 30), variant: "destructive" as const },
          { title: "Do 3 miesięcy", suffix: "!!", items: withDays.filter(c => c.daysLeft > 30 && c.daysLeft <= 90), variant: "secondary" as const },
          { title: "Do 6 miesięcy", suffix: "!", items: withDays.filter(c => c.daysLeft > 90 && c.daysLeft <= 180), variant: "secondary" as const },
          { title: "Powyżej 6 miesięcy", suffix: "", items: withDays.filter(c => c.daysLeft > 180), variant: "secondary" as const },
        ].filter(s => s.items.length > 0);

        const renderTable = (items: typeof withDays) => (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-fixed">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[25%]" />
                  <col className="w-[25%]" />
                  <col className="w-[20%]" />
                </colgroup>
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 px-3 font-medium">Nazwa apartamentu</th>
                    <th className="py-2 px-3 font-medium">Właściciel</th>
                    <th className="py-2 px-3 font-medium">Data końca umowy</th>
                    <th className="py-2 px-3 font-medium">Pozostało</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-b last:border-b-0" data-testid={`row-expiring-${c.id}`}>
                      <td className="py-2 px-3 font-medium">{c.name}</td>
                      <td className="py-2 px-3 text-muted-foreground">{c.ownerName}</td>
                      <td className="py-2 px-3">{c.leaseEndDate}</td>
                      <td className="py-2 px-3">
                        {c.daysLeft < 0 ? (
                          <Badge variant="destructive">Wygasła ({Math.abs(c.daysLeft)} dni temu)</Badge>
                        ) : c.daysLeft === 0 ? (
                          <Badge variant="destructive">Dziś</Badge>
                        ) : (
                          <span className={c.daysLeft <= 30 ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {c.daysLeft} dni
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );

        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold" data-testid="text-expiring-contracts-title">Kończące się umowy</h3>
            {sections.map((section) => (
              <div key={section.title} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-muted-foreground">
                    {section.title}
                    {section.suffix && <span className="text-destructive ml-1">{section.suffix}</span>}
                  </h4>
                  <Badge variant={section.variant}>{section.items.length}</Badge>
                </div>
                {renderTable(section.items)}
              </div>
            ))}
          </div>
        );
      })()}

      <Dialog open={!!editingApartment} onOpenChange={(open) => { if (!open) setEditingApartment(null); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Apartament — {editingApartment?.name}</DialogTitle>
          </DialogHeader>
          {editingApartment && (
            <Tabs defaultValue="dashboard">
              <TabsList className="w-full flex-wrap">
                <TabsTrigger value="dashboard" className="flex-1" data-testid="tab-edit-dashboard">
                  <BarChart3 className="h-4 w-4 mr-1" /> Dashboard
                </TabsTrigger>
                <TabsTrigger value="details" className="flex-1" data-testid="tab-edit-details">Dane</TabsTrigger>
                <TabsTrigger value="costs" className="flex-1" data-testid="tab-edit-costs">
                  <Wallet className="h-4 w-4 mr-1" /> Koszty
                </TabsTrigger>
                <TabsTrigger value="forecast" className="flex-1" data-testid="tab-edit-forecast">
                  <TrendingUp className="h-4 w-4 mr-1" /> Prognoza
                </TabsTrigger>
                <TabsTrigger value="contracts" className="flex-1" data-testid="tab-edit-contracts">
                  <FileText className="h-4 w-4 mr-1" /> Umowy
                </TabsTrigger>
              </TabsList>
              <TabsContent value="dashboard">
                <ApartmentDashboard apartment={editingApartment} />
              </TabsContent>
              <TabsContent value="details">
                <EditApartmentForm
                  apartment={editingApartment}
                  onSuccess={() => setEditingApartment(null)}
                />
              </TabsContent>
              <TabsContent value="costs">
                <PaymentsSection apartmentId={editingApartment.id} />
              </TabsContent>
              <TabsContent value="forecast">
                <RevenueForecastSection apartment={editingApartment} />
              </TabsContent>
              <TabsContent value="contracts">
                <AttachmentsSection apartmentId={editingApartment.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApartmentForm({ onSuccess }: { onSuccess: () => void }) {
  const createApartment = useCreateApartment();
  const { data: ownersList } = useOwners();
  const form = useForm<InsertApartment>({
    resolver: zodResolver(insertApartmentSchema),
    defaultValues: {
      name: "",
      location: "",
      address: "",
      ownerId: null,
      active: true,
    }
  });

  const onSubmit = (data: InsertApartment) => {
    createApartment.mutate(data, {
      onSuccess: () => onSuccess()
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nazwa apartamentu</Label>
        <Input id="name" {...form.register("name")} placeholder="np. Apartament Widokowy" data-testid="input-apartment-name" />
        {form.formState.errors.name && <span className="text-sm text-destructive">{form.formState.errors.name.message}</span>}
      </div>
      <div className="space-y-2">
        <Label>Lokalizacja</Label>
        <Controller
          control={form.control}
          name="location"
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ""}>
              <SelectTrigger data-testid="select-apartment-location">
                <SelectValue placeholder="Wybierz lokalizację" />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Adres</Label>
        <Input id="address" {...form.register("address")} placeholder="ul. Długa 1/2" data-testid="input-apartment-address" />
      </div>
      <div className="space-y-2">
        <Label>Właściciel</Label>
        <Controller
          control={form.control}
          name="ownerId"
          render={({ field }) => (
            <Select
              onValueChange={(val) => field.onChange(val === "__none__" ? null : Number(val))}
              value={field.value ? String(field.value) : "__none__"}
            >
              <SelectTrigger data-testid="select-apartment-owner">
                <SelectValue placeholder="Wybierz właściciela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Brak właściciela</SelectItem>
                {ownersList?.map(owner => (
                  <SelectItem key={owner.id} value={String(owner.id)}>{owner.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={createApartment.isPending} data-testid="button-submit-apartment">
          {createApartment.isPending ? "Dodawanie..." : "Dodaj apartament"}
        </Button>
      </DialogFooter>
    </form>
  );
}

const MONTH_NAMES_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function ApartmentDashboard({ apartment }: { apartment: Apartment }) {
  const { data: stats, isLoading } = useQuery<{
    revenueCurrentYear: number;
    revenuePrevYear: number;
    forecastRevenue: number;
    actualRevenue: number;
    forecastRealization: number;
    costsCurrent: number;
    costsPrev: number;
    profitCurrent: number;
    profitPrev: number;
    profitMargin: number;
    occupancyRate: number;
    monthlyData: { month: number; revenue: number; costs: number }[];
    activeContract: { monthlyRent: string; startDate: string; endDate: string | null; status: string } | null;
    unpaidCount: number;
    unpaidAmount: number;
    currentYear: number;
    rentHistory: { date: string; rent: number; type: string; id: number }[];
  }>({
    queryKey: [`/api/apartments/${apartment.id}/dashboard-stats`],
  });

  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stats) return null;

  const fmtPLN = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + " zł";
  const yrChange = (curr: number, prev: number) => {
    if (prev === 0) return null;
    const pct = Math.round(((curr - prev) / prev) * 100);
    return pct;
  };

  const revChange = yrChange(stats.revenueCurrentYear, stats.revenuePrevYear);
  const costChange = yrChange(stats.costsCurrent, stats.costsPrev);
  const profitChange = yrChange(stats.profitCurrent, stats.profitPrev);

  const chartData = stats.monthlyData.map((d) => ({
    name: MONTH_NAMES_SHORT[d.month - 1],
    Przychody: d.revenue,
    Koszty: d.costs,
  }));

  return (
    <div className="space-y-4 py-4" data-testid="apartment-dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card data-testid="kpi-card-revenue">
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5 text-green-500" /> Przychody {stats.currentYear}
            </div>
            <p className="text-lg font-bold" data-testid="stat-revenue">{fmtPLN(stats.revenueCurrentYear)}</p>
            {revChange !== null && (
              <div className={`flex items-center gap-1 text-[10px] ${revChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {revChange >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {revChange > 0 ? '+' : ''}{revChange}% r/r
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="kpi-card-forecast">
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Percent className="h-3.5 w-3.5 text-blue-500" /> Realizacja prognozy
            </div>
            <p className="text-lg font-bold" data-testid="stat-forecast">{stats.forecastRealization}%</p>
            <Progress value={Math.min(stats.forecastRealization, 100)} className="h-1.5 mt-1" />
          </CardContent>
        </Card>

        <Card data-testid="kpi-card-costs">
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-orange-500" /> Koszty {stats.currentYear}
            </div>
            <p className="text-lg font-bold" data-testid="stat-costs">{fmtPLN(stats.costsCurrent)}</p>
            {costChange !== null && (
              <div className={`flex items-center gap-1 text-[10px] ${costChange <= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {costChange <= 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                {costChange > 0 ? '+' : ''}{costChange}% r/r
              </div>
            )}
          </CardContent>
        </Card>

        <Card data-testid="kpi-card-profit">
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <BarChart3 className="h-3.5 w-3.5 text-purple-500" /> Rentowność
            </div>
            <p className="text-lg font-bold" data-testid="stat-profit">{fmtPLN(stats.profitCurrent)}</p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Marża: {stats.profitMargin}%</span>
              {profitChange !== null && (
                <span className={profitChange >= 0 ? 'text-green-600' : 'text-red-500'}>
                  {profitChange > 0 ? '+' : ''}{profitChange}% r/r
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-card-occupancy">
          <CardContent className="pt-3 pb-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <BedDouble className="h-3.5 w-3.5 text-cyan-500" /> Obłożenie
            </div>
            <p className="text-lg font-bold" data-testid="stat-occupancy">{stats.occupancyRate}%</p>
            <Progress value={stats.occupancyRate} className="h-1.5 mt-1" />
          </CardContent>
        </Card>

        {stats.activeContract && (
          <Card data-testid="kpi-card-contract">
            <CardContent className="pt-3 pb-3 px-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <FileText className="h-3.5 w-3.5" /> Umowa
              </div>
              <p className="text-sm font-semibold">{fmtPLN(Number(stats.activeContract.monthlyRent || 0))}/mies</p>
              <p className="text-[10px] text-muted-foreground">
                {stats.activeContract.startDate?.split('-').reverse().join('.')} → {stats.activeContract.endDate?.split('-').reverse().join('.') || "bezterminowo"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {stats.unpaidCount > 0 && (
        <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/30">
          <CardContent className="py-2 px-4">
            <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400">
              <AlertCircle className="h-4 w-4" />
              <span>{stats.unpaidCount} nieopłaconych rezerwacji</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-medium">Przychody vs Koszty — {stats.currentYear}</CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-3">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
              <Tooltip formatter={(v: number) => fmtPLN(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Przychody" fill="#22c55e" radius={[2, 2, 0, 0]} />
              <Bar dataKey="Koszty" fill="#f97316" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {stats.rentHistory && stats.rentHistory.length > 1 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">Historia zmian czynszu</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-1" data-testid="rent-history-timeline">
              {stats.rentHistory.map((entry, idx) => {
                const prevRent = idx > 0 ? stats.rentHistory[idx - 1].rent : null;
                const change = prevRent !== null ? entry.rent - prevRent : null;
                const changePct = prevRent && prevRent > 0 ? Math.round(((entry.rent - prevRent) / prevRent) * 100) : null;
                return (
                  <div key={entry.id} className="flex items-center gap-3 py-1.5">
                    <div className="flex flex-col items-center shrink-0 w-4">
                      <div className={`w-2.5 h-2.5 rounded-full border-2 ${entry.type === 'ANEKS' ? 'bg-amber-400 border-amber-500' : 'bg-indigo-500 border-indigo-600'}`} />
                      {idx < stats.rentHistory.length - 1 && <div className="w-px h-5 bg-border" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium">{fmtPLN(entry.rent)}</span>
                        <Badge variant="outline" className={`text-[9px] ${entry.type === 'ANEKS' ? 'bg-amber-50 dark:bg-amber-950' : ''}`}>
                          {entry.type}
                        </Badge>
                        {change !== null && (
                          <span className={`text-[10px] ${change >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {change >= 0 ? '+' : ''}{fmtPLN(change)} ({changePct !== null ? `${changePct > 0 ? '+' : ''}${changePct}%` : ''})
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground" data-testid={`rent-history-date-${entry.id}`}>od {entry.date?.split('-').reverse().join('.')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function EditApartmentForm({ apartment, onSuccess }: { apartment: Apartment; onSuccess: () => void }) {
  const { data: ownersList } = useOwners();
  const { data: allContracts = [] } = useQuery<OwnerContract[]>({ queryKey: ["/api/owner-contracts"] });
  const { data: allApartments = [] } = useQuery<Apartment[]>({ queryKey: ['/api/apartments'] });
  const updateApartment = useUpdateApartment();
  const deleteApartment = useDeleteApartment();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<InsertApartment>({
    resolver: zodResolver(insertApartmentSchema),
    defaultValues: {
      name: apartment.name,
      hotresName: apartment.hotresName || "",
      location: apartment.location || "",
      address: apartment.address || "",
      ownerId: apartment.ownerId || null,
      active: apartment.active,
      leaseStartDate: apartment.leaseStartDate || "",
      leaseEndDate: apartment.leaseEndDate || "",
    }
  });

  const watchedOwnerId = form.watch("ownerId");
  const selectedOwner = ownersList?.find(o => o.id === watchedOwnerId) || null;

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      updateApartment.mutate(
        { id: apartment.id, photoUrl: response.objectPath },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/apartments'] });
            toast({ title: "Sukces", description: "Zdjęcie zostało zaktualizowane" });
          },
        }
      );
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się przesłać zdjęcia", variant: "destructive" });
    },
  });

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    updateApartment.mutate(
      { id: apartment.id, photoUrl: null },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['/api/apartments'] });
          toast({ title: "Sukces", description: "Zdjęcie zostało usunięte" });
        },
      }
    );
  };

  const contracts = useMemo(() => allContracts.filter(c => c.apartmentId === apartment.id), [allContracts, apartment.id]);
  const activeContracts = contracts.filter(c => c.status === "AKTYWNA");
  const archivedContracts = contracts.filter(c => c.status === "ZAKONCZONA" || c.status === "ROZWIAZANA");

  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<OwnerContract | null>(null);
  const [formOwnerId, setFormOwnerId] = useState("");
  const [formContractType, setFormContractType] = useState("UMOWA");
  const [formStatus, setFormStatus] = useState("AKTYWNA");
  const [formParentContractId, setFormParentContractId] = useState("");
  const [formApartmentIds, setFormApartmentIds] = useState<number[]>([apartment.id]);
  const [allocations, setAllocations] = useState<{apartmentId: number; rentAmount: string}[]>([]);
  const [formPaymentFrequency, setFormPaymentFrequency] = useState("MIESIECZNIE");
  const [formPaymentDay, setFormPaymentDay] = useState("10");
  const [showCostsDialog, setShowCostsDialog] = useState(false);
  const [showRevenueDialog, setShowRevenueDialog] = useState(false);
  const [savedContractData, setSavedContractData] = useState<any>(null);

  function openContractForm(contract: OwnerContract | null) {
    setEditingContract(contract);
    setFormOwnerId(String(contract?.ownerId || apartment.ownerId || ""));
    setFormContractType(contract?.contractType || "UMOWA");
    setFormStatus(contract?.status || "AKTYWNA");
    setFormParentContractId(String(contract?.parentContractId || ""));
    if (contract && (contract as any).allocations?.length > 0) {
      const allocs = (contract as any).allocations;
      setFormApartmentIds(allocs.map((a: any) => a.apartmentId));
      setAllocations(allocs.map((a: any) => ({ apartmentId: a.apartmentId, rentAmount: String(a.rentAmount || '') })));
    } else {
      setFormApartmentIds([apartment.id]);
      setAllocations([]);
    }
    setFormPaymentFrequency(contract?.paymentFrequency || "MIESIECZNIE");
    setFormPaymentDay(String(contract?.paymentDay || "10"));
    setContractFormOpen(true);
  }

  const contractMutation = useMutation({
    mutationFn: async (d: { method: string; url: string; body?: any; isNew?: boolean }) => {
      const res = await apiRequest(d.method, d.url, d.body);
      const data = await res.json();
      return { data, isNew: d.isNew };
    },
    onSuccess: (result: { data: any; isNew?: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-contracts"] });
      setContractFormOpen(false);
      toast({ title: "Zapisano" });
      if (result.data?.overlapWarning) {
        toast({ title: "Uwaga", description: result.data.overlapWarning, variant: "destructive" });
      }
      if (result.isNew && result.data?.id) {
        setSavedContractData(result.data);
        setShowCostsDialog(true);
      } else {
        setEditingContract(null);
      }
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const deleteContractMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/owner-contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-contracts"] });
      toast({ title: "Usunięto" });
    },
  });

  function handleContractSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = {
      ownerId: formOwnerId ? Number(formOwnerId) : null,
      apartmentId: formApartmentIds[0] || apartment.id,
      monthlyRent: fd.get("monthlyRent") || null,
      additionalFees: fd.get("additionalFees") || null,
      startDate: fd.get("startDate") || null,
      endDate: fd.get("endDate") || null,
      contractType: formContractType,
      parentContractId: formParentContractId ? Number(formParentContractId) : null,
      notes: fd.get("notes") || null,
      status: formStatus,
      paymentFrequency: formPaymentFrequency,
      paymentDay: formPaymentDay ? Number(formPaymentDay) : 10,
    };
    if (formApartmentIds.length > 1) {
      const totalRent = parseFloat(String(body.monthlyRent) || '0');
      const totalFees = parseFloat(String(body.additionalFees) || '0');
      const equalRent = Math.round((totalRent / formApartmentIds.length) * 100) / 100;
      const equalFees = Math.round((totalFees / formApartmentIds.length) * 100) / 100;
      body.allocations = formApartmentIds.map(aptId => {
        const alloc = allocations.find(a => a.apartmentId === aptId);
        return {
          apartmentId: aptId,
          rentAmount: alloc?.rentAmount || String(equalRent),
          additionalFeesAmount: String(equalFees),
        };
      });
    } else {
      body.allocations = [{
        apartmentId: formApartmentIds[0] || apartment.id,
        rentAmount: body.monthlyRent,
        additionalFeesAmount: body.additionalFees || '0',
      }];
    }
    if (editingContract) {
      contractMutation.mutate({ method: "PUT", url: `/api/owner-contracts/${editingContract.id}`, body, isNew: false });
    } else {
      contractMutation.mutate({ method: "POST", url: "/api/owner-contracts", body, isNew: true });
    }
  }

  const onSubmit = (data: InsertApartment) => {
    const payload = {
      ...data,
      hotresName: data.hotresName?.trim() || null,
      leaseStartDate: data.leaseStartDate || null,
      leaseEndDate: data.leaseEndDate || null,
    };
    updateApartment.mutate({ id: apartment.id, ...payload }, {
      onSuccess: () => onSuccess()
    });
  };

  const handleDelete = () => {
    if (window.confirm("Czy na pewno chcesz usunąć ten apartament? Wszystkie powiązane rezerwacje, umowy najmu, koszty i blokady zostaną również usunięte.")) {
      deleteApartment.mutate(apartment.id, {
        onSuccess: () => onSuccess()
      });
    }
  };

  const MONTH_NAMES = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

  const DEFAULT_COST_CATEGORIES = [
    { key: "media", label: "Media", amount: "" },
    { key: "ubezpieczenie", label: "Ubezpieczenie", amount: "" },
    { key: "podatek_nieruchomosci", label: "Podatek od nieruchomości", amount: "" },
    { key: "sprzatanie", label: "Sprzątanie", amount: "" },
    { key: "administracja", label: "Administracja", amount: "" },
    { key: "inne", label: "Inne", amount: "" },
  ];

  function RecurringCostsDialog() {
    const [costCategories, setCostCategories] = useState(DEFAULT_COST_CATEGORIES.map(c => ({ ...c })));
    const [customCategoryName, setCustomCategoryName] = useState("");
    const [saving, setSaving] = useState(false);

    const updateAmount = (idx: number, val: string) => {
      setCostCategories(prev => prev.map((c, i) => i === idx ? { ...c, amount: val } : c));
    };

    const addCategory = () => {
      if (!customCategoryName.trim()) return;
      const key = customCategoryName.trim().toLowerCase().replace(/\s+/g, '_');
      setCostCategories(prev => [...prev, { key, label: customCategoryName.trim(), amount: "" }]);
      setCustomCategoryName("");
    };

    const removeCategory = (idx: number) => {
      setCostCategories(prev => prev.filter((_, i) => i !== idx));
    };

    function getMonthsForMode(mode: "year" | "contract"): { year: number; month: number }[] {
      const months: { year: number; month: number }[] = [];
      if (mode === "year") {
        const currentYear = new Date().getFullYear();
        for (let m = 1; m <= 12; m++) months.push({ year: currentYear, month: m });
      } else if (mode === "contract" && savedContractData) {
        const start = savedContractData.startDate ? new Date(savedContractData.startDate) : new Date();
        const end = savedContractData.endDate ? new Date(savedContractData.endDate) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
        const current = new Date(start.getFullYear(), start.getMonth(), 1);
        while (current <= end) {
          months.push({ year: current.getFullYear(), month: current.getMonth() + 1 });
          current.setMonth(current.getMonth() + 1);
        }
      }
      return months;
    }

    const handleSave = async (mode: "year" | "contract") => {
      const months = getMonthsForMode(mode);
      const filledCategories = costCategories.filter(c => c.amount && Number(c.amount) > 0);
      if (filledCategories.length === 0 || months.length === 0) {
        setShowCostsDialog(false);
        setShowRevenueDialog(true);
        return;
      }
      setSaving(true);
      try {
        const data: any[] = [];
        for (const { year, month } of months) {
          for (const cat of filledCategories) {
            data.push({
              year,
              month,
              apartmentId: savedContractData?.apartmentId || apartment.id,
              category: cat.key,
              forecast: cat.amount,
              sourceType: "contract",
              sourceContractId: savedContractData?.id,
            });
          }
        }
        await apiRequest("POST", "/api/cost-forecasts/bulk", { data });
        toast({ title: "Sukces", description: `Zapisano ${data.length} prognoz kosztów` });
      } catch {
        toast({ title: "Błąd", description: "Nie udało się zapisać kosztów", variant: "destructive" });
      } finally {
        setSaving(false);
        setShowCostsDialog(false);
        setShowRevenueDialog(true);
      }
    };

    return (
      <Dialog open={showCostsDialog} onOpenChange={(v) => { if (!v) { setShowCostsDialog(false); setShowRevenueDialog(true); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-costs-dialog-title">Dodatkowe koszty cykliczne</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Zdefiniuj miesięczne koszty stałe dla tego apartamentu. Wartości zostaną skopiowane na wybrany okres.
            </p>
            <div className="space-y-3">
              {costCategories.map((cat, idx) => (
                <div key={cat.key + idx} className="flex items-center gap-3">
                  <Label className="w-48 text-sm shrink-0">{cat.label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={cat.amount}
                    onChange={(e) => updateAmount(idx, e.target.value)}
                    data-testid={`input-cost-${cat.key}`}
                  />
                  {idx >= DEFAULT_COST_CATEGORIES.length && (
                    <Button size="icon" variant="ghost" onClick={() => removeCategory(idx)} data-testid={`btn-remove-cost-${idx}`}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nazwa kategorii"
                value={customCategoryName}
                onChange={(e) => setCustomCategoryName(e.target.value)}
                className="w-48"
                data-testid="input-custom-cost-category"
              />
              <Button variant="outline" size="sm" onClick={addCategory} data-testid="btn-add-cost-category">
                <Plus className="h-4 w-4 mr-1" /> Dodaj kategorię
              </Button>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave("year")}
                disabled={saving}
                data-testid="btn-costs-copy-year"
              >
                Kopiuj na cały rok
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSave("contract")}
                disabled={saving}
                data-testid="btn-costs-copy-contract"
              >
                Kopiuj na okres umowy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowCostsDialog(false); setShowRevenueDialog(true); }}
                data-testid="btn-costs-skip"
              >
                Pomiń
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  function RevenueForecastDialog() {
    const [forecasts, setForecasts] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const currentYear = new Date().getFullYear();

    const updateForecast = (key: string, val: string) => {
      setForecasts(prev => ({ ...prev, [key]: val }));
    };

    const copyToYear = () => {
      const firstVal = Object.values(forecasts).find(v => v && Number(v) > 0);
      if (!firstVal) return;
      const updated: Record<string, string> = {};
      for (let m = 1; m <= 12; m++) {
        updated[`${currentYear}-${String(m).padStart(2, '0')}`] = firstVal;
      }
      setForecasts(updated);
    };

    const copyToContract = () => {
      const firstVal = Object.values(forecasts).find(v => v && Number(v) > 0);
      if (!firstVal || !savedContractData) return;
      const start = savedContractData.startDate ? new Date(savedContractData.startDate) : new Date();
      const end = savedContractData.endDate ? new Date(savedContractData.endDate) : new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
      const updated: Record<string, string> = {};
      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      while (current <= end) {
        const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
        updated[key] = firstVal;
        current.setMonth(current.getMonth() + 1);
      }
      setForecasts(updated);
    };

    const closeAll = () => {
      setShowRevenueDialog(false);
      setShowCostsDialog(false);
      setSavedContractData(null);
      setEditingContract(null);
    };

    const handleSave = async () => {
      const entries = Object.entries(forecasts).filter(([_, v]) => v && Number(v) > 0);
      if (entries.length === 0) { closeAll(); return; }
      setSaving(true);
      try {
        for (const [key, amount] of entries) {
          const [yearStr, monthStr] = key.split('-');
          await apiRequest("PUT", "/api/revenue-forecasts", {
            year: Number(yearStr),
            month: Number(monthStr),
            apartmentId: savedContractData?.apartmentId || apartment.id,
            locationName: apartment.location || "",
            forecast: amount,
          });
        }
        toast({ title: "Sukces", description: `Zapisano ${entries.length} prognoz przychodów` });
      } catch {
        toast({ title: "Błąd", description: "Nie udało się zapisać prognoz", variant: "destructive" });
      } finally {
        setSaving(false);
        closeAll();
      }
    };

    return (
      <Dialog open={showRevenueDialog} onOpenChange={(v) => { if (!v) closeAll(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-revenue-dialog-title">Prognoza przychodów</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Wprowadź prognozowane przychody miesięczne dla tego apartamentu.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {MONTH_NAMES.map((name, idx) => {
                const key = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
                return (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{name}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={forecasts[key] || ""}
                      onChange={(e) => updateForecast(key, e.target.value)}
                      data-testid={`input-revenue-${idx + 1}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={copyToYear} data-testid="btn-revenue-copy-year">
                Kopiuj na cały rok
              </Button>
              <Button variant="outline" size="sm" onClick={copyToContract} data-testid="btn-revenue-copy-contract">
                Kopiuj na okres umowy
              </Button>
              <Button variant="ghost" size="sm" onClick={closeAll} data-testid="btn-revenue-skip">
                Pomiń
              </Button>
            </div>
            <Button onClick={handleSave} disabled={saving} data-testid="btn-revenue-save">
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="space-y-6 py-4">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-name">Nazwa apartamentu</Label>
          <Input id="edit-name" {...form.register("name")} data-testid="input-edit-apartment-name" />
          {form.formState.errors.name && <span className="text-sm text-destructive">{form.formState.errors.name.message}</span>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-hotresName">Nazwa w HotRes</Label>
          <Input id="edit-hotresName" {...form.register("hotresName")} placeholder="Nazwa apartamentu w systemie HotRes" data-testid="input-edit-apartment-hotres-name" />
          <p className="text-xs text-muted-foreground">Używana do automatycznego parowania rezerwacji importowanych z HotRes.</p>
        </div>
        <div className="space-y-2">
          <Label>Lokalizacja</Label>
          <Controller
            control={form.control}
            name="location"
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger data-testid="select-edit-apartment-location">
                  <SelectValue placeholder="Wybierz lokalizację" />
                </SelectTrigger>
                <SelectContent>
                  {LOCATIONS.map(loc => (
                    <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-address">Adres</Label>
          <Input id="edit-address" {...form.register("address")} data-testid="input-edit-apartment-address" />
        </div>
        <div className="space-y-2">
          <Label>Właściciel</Label>
          <Controller
            control={form.control}
            name="ownerId"
            render={({ field }) => (
              <Select
                onValueChange={(val) => field.onChange(val === "__none__" ? null : Number(val))}
                value={field.value ? String(field.value) : "__none__"}
              >
                <SelectTrigger data-testid="select-edit-apartment-owner">
                  <SelectValue placeholder="Wybierz właściciela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Brak właściciela</SelectItem>
                  {ownersList?.map(owner => (
                    <SelectItem key={owner.id} value={String(owner.id)}>{owner.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        {selectedOwner && (
          <Card data-testid="card-owner-info">
            <CardContent className="pt-3 pb-3 px-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">Dane kontaktowe właściciela</div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {selectedOwner.phone && (
                  <div data-testid="text-owner-phone">
                    <span className="text-muted-foreground text-xs">Telefon:</span>
                    <div>{selectedOwner.phone}</div>
                  </div>
                )}
                {selectedOwner.email && (
                  <div data-testid="text-owner-email">
                    <span className="text-muted-foreground text-xs">Email:</span>
                    <div>{selectedOwner.email}</div>
                  </div>
                )}
                {selectedOwner.nip && (
                  <div data-testid="text-owner-nip">
                    <span className="text-muted-foreground text-xs">NIP:</span>
                    <div>{selectedOwner.nip}</div>
                  </div>
                )}
                {selectedOwner.ownerType && (
                  <div data-testid="text-owner-type">
                    <span className="text-muted-foreground text-xs">Typ:</span>
                    <div>{selectedOwner.ownerType === "osoba_fizyczna" ? "Osoba fizyczna" : "Firma"}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="edit-leaseStartDate">Początek najmu</Label>
            <Input
              id="edit-leaseStartDate"
              type="date"
              {...form.register("leaseStartDate")}
              data-testid="input-edit-lease-start"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-leaseEndDate">Koniec najmu</Label>
            <Input
              id="edit-leaseEndDate"
              type="date"
              {...form.register("leaseEndDate")}
              data-testid="input-edit-lease-end"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Controller
            control={form.control}
            name="active"
            render={({ field }) => (
              <Switch
                checked={field.value ?? true}
                onCheckedChange={field.onChange}
                data-testid="switch-edit-apartment-active"
              />
            )}
          />
          <Label>Aktywny</Label>
        </div>

        <div className="space-y-2">
          <Label>Zdjęcie apartamentu</Label>
          <div className="flex items-center gap-4">
            {apartment.photoUrl ? (
              <div className="relative">
                <img
                  src={apartment.photoUrl}
                  alt={apartment.name}
                  className="w-20 h-20 rounded-lg object-cover border"
                  data-testid="img-apartment-photo-preview"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="absolute -top-2 -right-2"
                  onClick={handleRemovePhoto}
                  disabled={updateApartment.isPending}
                  data-testid="button-remove-photo"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center border border-dashed" data-testid="placeholder-no-photo">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <Label htmlFor="photo-upload-dane" className="cursor-pointer">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover-elevate">
                <Camera className="h-4 w-4" />
                {isUploading ? "Przesyłanie..." : apartment.photoUrl ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
              </div>
              <input
                id="photo-upload-dane"
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                disabled={isUploading}
                data-testid="input-apartment-photo"
              />
            </Label>
          </div>
        </div>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteApartment.isPending}
            data-testid="button-delete-apartment"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleteApartment.isPending ? "Usuwanie..." : "Usuń"}
          </Button>
          <Button type="submit" disabled={updateApartment.isPending} data-testid="button-save-apartment">
            {updateApartment.isPending ? "Zapisywanie..." : "Zapisz zmiany"}
          </Button>
        </DialogFooter>
      </form>

      <div className="border-t pt-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold" data-testid="text-current-contracts-title">Aktualna umowa</h3>
          <Button size="sm" onClick={() => openContractForm(null)} data-testid="btn-add-contract-apt">
            <Plus className="h-4 w-4 mr-1" /> Dodaj nową umowę
          </Button>
        </div>

        {activeContracts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">Brak aktywnych umów dla tego apartamentu.</p>
        ) : (
          <div className="space-y-2">
            {activeContracts.map(c => {
              const ownerName = ownersList?.find(o => o.id === c.ownerId)?.name || "—";
              return (
                <Card key={c.id} data-testid={`card-apt-contract-${c.id}`}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="space-y-1">
                        <p className="font-semibold text-sm">{ownerName}</p>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                          <span>Czynsz: {c.monthlyRent ? `${Number(c.monthlyRent).toLocaleString("pl-PL")} zł` : "—"}</span>
                          {c.additionalFees && Number(c.additionalFees) > 0 && <span>+ {Number(c.additionalFees).toLocaleString("pl-PL")} zł</span>}
                          <span>{c.startDate || "—"} &rarr; {c.endDate || "bezterminowo"}</span>
                          <Badge variant="default" className="text-[10px]">{c.status}</Badge>
                          <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950">{c.contractType}</Badge>
                          {c.paymentFrequency && (
                            <Badge variant="outline" className="text-[10px]">{
                              c.paymentFrequency === 'MIESIECZNIE' ? 'Miesięcznie' :
                              c.paymentFrequency === 'KWARTALNIE' ? 'Kwartalnie' :
                              c.paymentFrequency === 'POLROCZNIE' ? 'Półrocznie' :
                              c.paymentFrequency === 'ROCZNIE' ? 'Rocznie' :
                              c.paymentFrequency === 'NIEREGULARNE' ? 'Nieregularne' : c.paymentFrequency
                            }</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => openContractForm(c)} data-testid={`btn-edit-apt-contract-${c.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Usunąć umowę?")) deleteContractMutation.mutate(c.id); }} data-testid={`btn-delete-apt-contract-${c.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {archivedContracts.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground" data-testid="text-archived-contracts-title">Historia umów</h3>
            {archivedContracts.map(c => {
              const ownerName = ownersList?.find(o => o.id === c.ownerId)?.name || "—";
              return (
                <Card key={c.id} className="opacity-70" data-testid={`card-apt-contract-archived-${c.id}`}>
                  <CardContent className="py-2 px-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{ownerName}</span>
                        <span>{c.monthlyRent ? `${Number(c.monthlyRent).toLocaleString("pl-PL")} zł` : "—"}</span>
                        <span>{c.startDate || "—"} &rarr; {c.endDate || "—"}</span>
                        <Badge variant="secondary" className="text-[10px]">{c.status}</Badge>
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => openContractForm(c)} data-testid={`btn-edit-apt-contract-${c.id}`}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={contractFormOpen} onOpenChange={v => { setContractFormOpen(v); if (!v) { setEditingContract(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContract ? "Edytuj umowę" : "Dodaj umowę"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleContractSubmit} className="space-y-3">
            <div>
              <Label>Właściciel</Label>
              <Select value={formOwnerId} onValueChange={setFormOwnerId}>
                <SelectTrigger data-testid="select-apt-contract-owner"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  {ownersList?.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Apartamenty objęte umową</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {formApartmentIds.map(aptId => {
                  const apt = allApartments.find(a => a.id === aptId);
                  return apt ? (
                    <Badge key={aptId} variant="secondary" className="gap-1">
                      {apt.name}
                      {formApartmentIds.length > 1 && (
                        <button type="button" onClick={() => {
                          setFormApartmentIds(prev => prev.filter(id => id !== aptId));
                          setAllocations(prev => prev.filter(a => a.apartmentId !== aptId));
                        }} className="ml-1 text-muted-foreground hover:text-foreground">×</button>
                      )}
                    </Badge>
                  ) : null;
                })}
              </div>
              <Select onValueChange={v => {
                const id = Number(v);
                if (!formApartmentIds.includes(id)) setFormApartmentIds(prev => [...prev, id]);
              }}>
                <SelectTrigger className="mt-1" data-testid="select-add-apartment"><SelectValue placeholder="Dodaj apartament..." /></SelectTrigger>
                <SelectContent>
                  {allApartments.filter(a => !formApartmentIds.includes(a.id)).map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Czynsz miesięcznie</Label>
                <Input name="monthlyRent" type="number" step="0.01" defaultValue={editingContract?.monthlyRent || ""} data-testid="input-apt-contract-rent" />
              </div>
              <div>
                <Label>Opłaty dodatkowe</Label>
                <Input name="additionalFees" type="number" step="0.01" defaultValue={editingContract?.additionalFees || ""} data-testid="input-apt-contract-fees" />
              </div>
            </div>
            {formApartmentIds.length > 1 && (
              <div className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-xs font-medium">Podział czynszu na apartamenty</Label>
                  <Button type="button" variant="ghost" size="sm" className="text-xs" onClick={() => {
                    const rent = parseFloat((document.querySelector('[name="monthlyRent"]') as HTMLInputElement)?.value || '0');
                    const perApt = Math.round((rent / formApartmentIds.length) * 100) / 100;
                    setAllocations(formApartmentIds.map(id => ({ apartmentId: id, rentAmount: String(perApt) })));
                  }} data-testid="btn-equal-split">
                    Podziel równo
                  </Button>
                </div>
                {formApartmentIds.map(aptId => {
                  const apt = allApartments.find(a => a.id === aptId);
                  const alloc = allocations.find(a => a.apartmentId === aptId);
                  return (
                    <div key={aptId} className="flex items-center gap-2">
                      <span className="text-xs flex-1 truncate">{apt?.name}</span>
                      <Input
                        type="number" step="0.01" className="w-28 text-xs"
                        value={alloc?.rentAmount || ''}
                        onChange={e => {
                          setAllocations(prev => {
                            const exists = prev.find(a => a.apartmentId === aptId);
                            if (exists) return prev.map(a => a.apartmentId === aptId ? { ...a, rentAmount: e.target.value } : a);
                            return [...prev, { apartmentId: aptId, rentAmount: e.target.value }];
                          });
                        }}
                        data-testid={`input-alloc-rent-${aptId}`}
                      />
                      <span className="text-xs text-muted-foreground">zł</span>
                    </div>
                  );
                })}
                <div className="text-[10px] text-muted-foreground text-right">
                  Suma: {allocations.reduce((s, a) => s + parseFloat(a.rentAmount || '0'), 0).toLocaleString('pl-PL')} zł
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data od</Label>
                <Input name="startDate" type="date" defaultValue={editingContract?.startDate || ""} data-testid="input-apt-contract-start" />
              </div>
              <div>
                <Label>Data do</Label>
                <Input name="endDate" type="date" defaultValue={editingContract?.endDate || ""} data-testid="input-apt-contract-end" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Częstotliwość płatności</Label>
                <Select value={formPaymentFrequency} onValueChange={setFormPaymentFrequency}>
                  <SelectTrigger data-testid="select-apt-contract-frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MIESIECZNIE">Miesięcznie</SelectItem>
                    <SelectItem value="KWARTALNIE">Kwartalnie</SelectItem>
                    <SelectItem value="POLROCZNIE">Półrocznie</SelectItem>
                    <SelectItem value="ROCZNIE">Rocznie</SelectItem>
                    <SelectItem value="NIEREGULARNE">Nieregularne</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dzień płatności</Label>
                <Input type="number" min="1" max="28" value={formPaymentDay} onChange={e => setFormPaymentDay(e.target.value)} data-testid="input-apt-contract-pay-day" />
              </div>
            </div>
            {formPaymentFrequency === 'NIEREGULARNE' && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2 text-xs text-amber-700 dark:text-amber-300">
                Płatności nieregularne - raty nie zostaną wygenerowane automatycznie. Dodaj je ręcznie w zakładce Koszty.
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Typ</Label>
                <Select value={formContractType} onValueChange={setFormContractType}>
                  <SelectTrigger data-testid="select-apt-contract-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UMOWA">UMOWA</SelectItem>
                    <SelectItem value="ANEKS">ANEKS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger data-testid="select-apt-contract-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AKTYWNA">AKTYWNA</SelectItem>
                    <SelectItem value="ZAKONCZONA">ZAKOŃCZONA</SelectItem>
                    <SelectItem value="ROZWIAZANA">ROZWIĄZANA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {contracts.length > 0 && (
              <div>
                <Label>Umowa nadrzędna (opcjonalnie)</Label>
                <Select value={formParentContractId} onValueChange={setFormParentContractId}>
                  <SelectTrigger data-testid="select-apt-contract-parent"><SelectValue placeholder="Brak" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Brak</SelectItem>
                    {contracts.filter(c => c.id !== editingContract?.id && c.contractType === "UMOWA").map(c => {
                      const ownerName = ownersList?.find(o => o.id === c.ownerId)?.name || "?";
                      return (
                        <SelectItem key={c.id} value={String(c.id)}>
                          #{c.id} - {ownerName} ({c.startDate})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Notatki</Label>
              <Textarea name="notes" defaultValue={editingContract?.notes || ""} rows={2} data-testid="input-apt-contract-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setContractFormOpen(false)}>Anuluj</Button>
              <Button type="submit" disabled={contractMutation.isPending} data-testid="btn-save-apt-contract">
                {contractMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Zapisz
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <RecurringCostsDialog />
      <RevenueForecastDialog />
    </div>
  );
}

const PAYMENT_CATEGORIES = [
  "Raty dla właścicieli",
  "Czynsz do wspólnoty",
  "Energia elektryczna",
  "Woda",
  "Wywóz śmieci",
  "Gaz",
  "Inne opłaty",
];

const FREQUENCY_OPTIONS = [
  { value: "MIESIECZNIE", label: "Miesięcznie" },
  { value: "KWARTALNIE", label: "Kwartalnie" },
  { value: "POLROCZNIE", label: "Półrocznie" },
  { value: "ROCZNIE", label: "Rocznie" },
  { value: "NIEREGULARNE", label: "Nieregularnie" },
];

function PaymentsSection({ apartmentId }: { apartmentId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurFrequency, setRecurFrequency] = useState("MIESIECZNIE");
  const [recurStartDate, setRecurStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [recurEndDate, setRecurEndDate] = useState("");
  const [recurPaymentDay, setRecurPaymentDay] = useState("10");

  const { data: payments, isLoading } = useQuery<OwnerPayment[]>({
    queryKey: ['/api/apartments', apartmentId, 'payments'],
    queryFn: async () => {
      const res = await fetch(`/api/apartments/${apartmentId}/payments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payments");
      return res.json();
    },
  });

  const createPayment = useMutation({
    mutationFn: async (data: Omit<InsertOwnerPayment, 'apartmentId'>) => {
      const res = await fetch(`/api/apartments/${apartmentId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create payment");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/apartments', apartmentId, 'payments'] });
      toast({ title: "Sukces", description: "Opłata została dodana" });
      setShowForm(false);
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać opłaty", variant: "destructive" });
    },
  });

  const createRecurringPayment = useMutation({
    mutationFn: async (data: { title: string; category: string; amount: string; frequency: string; startDate: string; endDate: string; paymentDay: number }) => {
      const res = await fetch(`/api/apartments/${apartmentId}/payments/recurring`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Błąd serwera" }));
        throw new Error(err.message || "Nie udało się wygenerować opłat");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/apartments', apartmentId, 'payments'] });
      toast({ title: "Sukces", description: `Wygenerowano ${data.count} opłat cyklicznych` });
      setShowForm(false);
      setIsRecurring(false);
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const deletePayment = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/owner-payments/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete payment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/apartments', apartmentId, 'payments'] });
      toast({ title: "Sukces", description: "Opłata została usunięta" });
    },
  });

  const form = useForm<Omit<InsertOwnerPayment, 'apartmentId'>>({
    defaultValues: {
      title: "",
      category: "",
      amount: "0",
      paymentDate: new Date().toISOString().split('T')[0],
    }
  });

  const onSubmit = (data: Omit<InsertOwnerPayment, 'apartmentId'>) => {
    if (isRecurring) {
      createRecurringPayment.mutate({
        title: data.title,
        category: data.category,
        amount: data.amount,
        frequency: recurFrequency,
        startDate: recurStartDate,
        endDate: recurEndDate,
        paymentDay: Number(recurPaymentDay),
      });
    } else {
      createPayment.mutate(data);
    }
  };

  const groupedPayments = payments?.reduce<Record<string, OwnerPayment[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {}) || {};

  const totalAmount = payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-sm font-medium">Razem: {totalAmount.toFixed(2)} PLN</div>
          <div className="text-xs text-muted-foreground">{payments?.length || 0} pozycji</div>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm(!showForm)}
          data-testid="button-add-payment"
        >
          <Plus className="h-4 w-4 mr-1" /> Dodaj opłatę
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="flex items-center gap-3 pb-1">
                <Switch
                  checked={isRecurring}
                  onCheckedChange={setIsRecurring}
                  data-testid="switch-recurring-payment"
                />
                <Label className="flex items-center gap-1.5 cursor-pointer text-sm" onClick={() => setIsRecurring(!isRecurring)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Opłata cykliczna
                </Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment-title">Tytuł</Label>
                <Input
                  id="payment-title"
                  {...form.register("title", { required: true })}
                  placeholder={isRecurring ? "np. Czynsz do wspólnoty" : "np. Rata za styczeń 2025"}
                  data-testid="input-payment-title"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Kategoria</Label>
                  <Controller
                    control={form.control}
                    name="category"
                    rules={{ required: true }}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <SelectTrigger data-testid="select-payment-category">
                          <SelectValue placeholder="Wybierz kategorię" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payment-amount">Kwota (PLN)</Label>
                  <Input
                    id="payment-amount"
                    type="number"
                    step="0.01"
                    {...form.register("amount", { required: true })}
                    data-testid="input-payment-amount"
                  />
                </div>
              </div>

              {isRecurring ? (
                <>
                  <div className="space-y-2">
                    <Label>Częstotliwość</Label>
                    <Select value={recurFrequency} onValueChange={setRecurFrequency}>
                      <SelectTrigger data-testid="select-recurring-frequency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FREQUENCY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Data rozpoczęcia</Label>
                      <Input
                        type="date"
                        value={recurStartDate}
                        onChange={e => setRecurStartDate(e.target.value)}
                        data-testid="input-recurring-start-date"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data zakończenia</Label>
                      <Input
                        type="date"
                        value={recurEndDate}
                        onChange={e => setRecurEndDate(e.target.value)}
                        placeholder="opcjonalna"
                        data-testid="input-recurring-end-date"
                      />
                      <p className="text-[10px] text-muted-foreground">puste = 1 rok</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Dzień płatności</Label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={recurPaymentDay}
                        onChange={e => setRecurPaymentDay(e.target.value)}
                        data-testid="input-recurring-payment-day"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="payment-date">Data płatności</Label>
                  <Input
                    id="payment-date"
                    type="date"
                    {...form.register("paymentDate", { required: !isRecurring })}
                    data-testid="input-payment-date"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => { setShowForm(false); setIsRecurring(false); }}>
                  Anuluj
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createPayment.isPending || createRecurringPayment.isPending}
                  data-testid="button-submit-payment"
                >
                  {(createPayment.isPending || createRecurringPayment.isPending) ? "Dodawanie..." : isRecurring ? "Generuj opłaty" : "Dodaj"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : payments && payments.length > 0 ? (
        <div className="space-y-4">
          {Object.entries(groupedPayments).map(([category, items]) => {
            const categoryTotal = items.reduce((s, p) => s + Number(p.amount), 0);
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                  <div className="text-sm font-medium">{category}</div>
                  <span className="text-xs text-muted-foreground">{categoryTotal.toFixed(2)} PLN</span>
                </div>
                <div className="space-y-1">
                  {items.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-muted/50 flex-wrap gap-2"
                      data-testid={`row-payment-${payment.id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm truncate">{payment.title}</div>
                          <div className="text-xs text-muted-foreground">{payment.paymentDate}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{Number(payment.amount).toFixed(2)} PLN</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deletePayment.mutate(payment.id)}
                          data-testid={`button-delete-payment-${payment.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground">
          Brak opłat. Kliknij "Dodaj opłatę" aby dodać pierwszą.
        </div>
      )}
    </div>
  );
}

function RevenueForecastSection({ apartment }: { apartment: Apartment }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const MONTH_NAMES = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

  const { data: allForecasts = [], isLoading } = useQuery<RevenueForecast[]>({
    queryKey: [`/api/revenue-forecasts?year=${year}`],
  });

  const aptForecasts = useMemo(() => allForecasts.filter(f => f.apartmentId === apartment.id), [allForecasts, apartment.id]);

  const [values, setValues] = useState<Record<number, string>>({});

  const aptForecastsKey = useMemo(() =>
    aptForecasts.map(f => `${f.month}:${f.forecast}`).sort().join(','),
    [aptForecasts]
  );

  useEffect(() => {
    const mapped: Record<number, string> = {};
    for (const f of aptForecasts) {
      if (f.forecast && Number(f.forecast) > 0) {
        mapped[f.month] = String(f.forecast);
      }
    }
    setValues(mapped);
  }, [aptForecastsKey]);

  const mutation = useMutation({
    mutationFn: (d: { year: number; month: number; apartmentId: number; locationName: string; forecast: string }) =>
      apiRequest("PUT", "/api/revenue-forecasts", d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/revenue-forecasts?year=${year}`] });
    },
  });

  const handleBlur = (month: number) => {
    const val = values[month];
    const existing = aptForecasts.find(f => f.month === month);
    const existingVal = existing?.forecast ? String(existing.forecast) : "";
    if (val !== existingVal) {
      mutation.mutate({
        year,
        month,
        apartmentId: apartment.id,
        locationName: apartment.location || "",
        forecast: val || "0",
      });
    }
  };

  const copyToAll = () => {
    const firstVal = Object.values(values).find(v => v && Number(v) > 0);
    if (!firstVal) {
      toast({ title: "Brak wartości", description: "Wprowadź wartość w co najmniej jednym miesiącu", variant: "destructive" });
      return;
    }
    const updated: Record<number, string> = {};
    for (let m = 1; m <= 12; m++) {
      updated[m] = firstVal;
    }
    setValues(updated);
    for (let m = 1; m <= 12; m++) {
      mutation.mutate({
        year,
        month: m,
        apartmentId: apartment.id,
        locationName: apartment.location || "",
        forecast: firstVal,
      });
    }
    toast({ title: "Skopiowano", description: `Wartość ${firstVal} zł skopiowana na wszystkie miesiące` });
  };

  const total = Object.values(values).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4 py-4" data-testid="section-revenue-forecast">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-semibold" data-testid="text-forecast-title">Prognoza przychodów — {apartment.name}</h3>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setYear(y => y - 1)}
            data-testid="btn-forecast-prev-year"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[4rem] text-center" data-testid="text-forecast-year">{year}</span>
          <Button
            size="icon"
            variant="outline"
            onClick={() => setYear(y => y + 1)}
            data-testid="btn-forecast-next-year"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {MONTH_NAMES.map((name, idx) => {
          const month = idx + 1;
          return (
            <div key={month} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{name}</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={values[month] || ""}
                onChange={(e) => setValues(prev => ({ ...prev, [month]: e.target.value }))}
                onBlur={() => handleBlur(month)}
                data-testid={`input-forecast-month-${month}`}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap border-t pt-3">
        <div className="text-sm">
          <span className="text-muted-foreground">Suma roczna: </span>
          <span className="font-semibold" data-testid="text-forecast-total">{total.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł</span>
        </div>
        <Button variant="outline" size="sm" onClick={copyToAll} data-testid="btn-forecast-copy-all">
          <Copy className="h-4 w-4 mr-1" /> Kopiuj wartość na wszystkie miesiące
        </Button>
      </div>

      {mutation.isPending && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Zapisywanie...
        </div>
      )}
    </div>
  );
}

function AttachmentsSection({ apartmentId }: { apartmentId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('UMOWA');
  const { uploadFile, isUploading } = useUpload({});

  const { data: attachmentsList } = useQuery<Attachment[]>({
    queryKey: ['/api/apartments', apartmentId, 'attachments'],
    queryFn: async () => {
      const res = await fetch(`/api/apartments/${apartmentId}/attachments`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch attachments');
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/attachments/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/apartments', apartmentId, 'attachments'] });
      toast({ title: "Sukces", description: "Załącznik usunięty" });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const response = await uploadFile(file);
    if (response) {
      const saveRes = await fetch(`/api/apartments/${apartmentId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fileName: file.name,
          objectPath: response.objectPath,
          fileType: file.type,
          category: selectedCategory,
        }),
      });
      if (saveRes.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/apartments', apartmentId, 'attachments'] });
        queryClient.invalidateQueries({ queryKey: ['/api/attachments/all'] });
        toast({ title: "Sukces", description: "Załącznik został dodany" });
      } else {
        toast({ title: "Błąd", description: "Nie udało się zapisać załącznika", variant: "destructive" });
      }
    } else {
      toast({ title: "Błąd", description: "Nie udało się przesłać pliku", variant: "destructive" });
    }
    e.target.value = '';
  };

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-40" data-testid="select-attachment-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UMOWA">Umowa</SelectItem>
            <SelectItem value="ANEKS">Aneks</SelectItem>
            <SelectItem value="INNY">Inny</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="file-attach" className="cursor-pointer">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover-elevate">
            <Upload className="h-4 w-4" />
            {isUploading ? "Przesyłanie..." : "Dodaj plik"}
          </div>
          <input
            id="file-attach"
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handleFileSelect}
            disabled={isUploading}
            data-testid="input-attachment-file"
          />
        </Label>
      </div>

      <div className="space-y-2">
        {attachmentsList && attachmentsList.length > 0 ? (
          attachmentsList.map((att) => (
            <div key={att.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-muted/50" data-testid={`row-attachment-${att.id}`}>
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <a
                    href={att.objectPath}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium hover:underline truncate block"
                    data-testid={`link-attachment-${att.id}`}
                  >
                    {att.fileName}
                  </a>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">{att.category}</Badge>
                    {att.uploadedAt && <span>{new Date(att.uploadedAt).toLocaleDateString('pl-PL')}</span>}
                  </div>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteMutation.mutate(att.id)}
                disabled={deleteMutation.isPending}
                data-testid={`button-delete-attachment-${att.id}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))
        ) : (
          <div className="text-sm text-muted-foreground text-center py-6">
            Brak załączników. Dodaj skan umowy lub aneks.
          </div>
        )}
      </div>
    </div>
  );
}


