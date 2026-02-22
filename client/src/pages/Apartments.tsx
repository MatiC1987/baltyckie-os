import { useState, useMemo, useRef } from "react";
import { useApartments, useCreateApartment, useUpdateApartment, useDeleteApartment } from "@/hooks/use-apartments";
import { DataTable } from "@/components/DataTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Home, Building2, Pencil, Trash2, Paperclip, FileText, Upload, X, Camera, ImageIcon, Wallet, CalendarDays, CheckSquare, FolderInput, ChevronDown, ChevronRight, Loader2, FileCheck, ArrowDown, Check, Files } from "lucide-react";
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
import { insertApartmentSchema, insertOwnerPaymentSchema, type InsertApartment, type InsertOwnerPayment, type Apartment, type Attachment, type Owner, type OwnerPayment, type OwnerContract } from "@shared/schema";
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edytuj apartament — {editingApartment?.name}</DialogTitle>
          </DialogHeader>
          {editingApartment && (
            <Tabs defaultValue="details">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1" data-testid="tab-edit-details">Dane</TabsTrigger>
                <TabsTrigger value="payments" className="flex-1" data-testid="tab-edit-payments">
                  <Wallet className="h-4 w-4 mr-1" /> Raty
                </TabsTrigger>
                <TabsTrigger value="photo" className="flex-1" data-testid="tab-edit-photo">
                  <Camera className="h-4 w-4 mr-1" /> Zdjęcie
                </TabsTrigger>
                <TabsTrigger value="attachments" className="flex-1" data-testid="tab-edit-attachments">
                  <Paperclip className="h-4 w-4 mr-1" /> Załączniki
                </TabsTrigger>
                <TabsTrigger value="contracts" className="flex-1" data-testid="tab-edit-contracts">
                  <FileText className="h-4 w-4 mr-1" /> Umowy
                </TabsTrigger>
              </TabsList>
              <TabsContent value="details">
                <EditApartmentForm
                  apartment={editingApartment}
                  onSuccess={() => setEditingApartment(null)}
                />
              </TabsContent>
              <TabsContent value="payments">
                <PaymentsSection apartmentId={editingApartment.id} />
              </TabsContent>
              <TabsContent value="photo">
                <PhotoSection apartment={editingApartment} />
              </TabsContent>
              <TabsContent value="attachments">
                <AttachmentsSection apartmentId={editingApartment.id} />
              </TabsContent>
              <TabsContent value="contracts">
                <ContractsSection apartment={editingApartment} />
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

function EditApartmentForm({ apartment, onSuccess }: { apartment: Apartment; onSuccess: () => void }) {
  const { data: ownersList } = useOwners();
  const updateApartment = useUpdateApartment();
  const deleteApartment = useDeleteApartment();
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

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
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

function PaymentsSection({ apartmentId }: { apartmentId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

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
    createPayment.mutate(data);
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
              <div className="space-y-2">
                <Label htmlFor="payment-title">Tytuł</Label>
                <Input
                  id="payment-title"
                  {...form.register("title", { required: true })}
                  placeholder="np. Rata za styczeń 2025"
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
              <div className="space-y-2">
                <Label htmlFor="payment-date">Data płatności</Label>
                <Input
                  id="payment-date"
                  type="date"
                  {...form.register("paymentDate", { required: true })}
                  data-testid="input-payment-date"
                />
              </div>
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Anuluj
                </Button>
                <Button type="submit" size="sm" disabled={createPayment.isPending} data-testid="button-submit-payment">
                  {createPayment.isPending ? "Dodawanie..." : "Dodaj"}
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

function PhotoSection({ apartment }: { apartment: Apartment }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateApartment = useUpdateApartment();

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

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-col items-center gap-4">
        {apartment.photoUrl ? (
          <div className="relative">
            <img
              src={apartment.photoUrl}
              alt={apartment.name}
              className="w-48 h-48 rounded-lg object-cover border"
              data-testid="img-apartment-photo-preview"
            />
            <Button
              size="icon"
              variant="destructive"
              className="absolute -top-2 -right-2"
              onClick={handleRemovePhoto}
              disabled={updateApartment.isPending}
              data-testid="button-remove-photo"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="w-48 h-48 rounded-lg bg-muted flex flex-col items-center justify-center gap-2 border border-dashed" data-testid="placeholder-no-photo">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Brak zdjęcia</span>
          </div>
        )}

        <Label htmlFor="photo-upload" className="cursor-pointer">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-md border text-sm font-medium hover-elevate">
            <Camera className="h-4 w-4" />
            {isUploading ? "Przesyłanie..." : apartment.photoUrl ? "Zmień zdjęcie" : "Dodaj zdjęcie"}
          </div>
          <input
            id="photo-upload"
            type="file"
            className="hidden"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoSelect}
            disabled={isUploading}
            data-testid="input-apartment-photo"
          />
        </Label>
        <p className="text-xs text-muted-foreground text-center">
          Obsługiwane formaty: JPG, PNG, WebP
        </p>
      </div>
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

function ContractsSection({ apartment }: { apartment: Apartment }) {
  const { data: allContracts = [] } = useQuery<OwnerContract[]>({ queryKey: ["/api/owner-contracts"] });
  const { data: owners = [] } = useQuery<Owner[]>({ queryKey: ["/api/owners"] });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const [contractFormOpen, setContractFormOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<OwnerContract | null>(null);
  const [pdfParsedData, setPdfParsedData] = useState<any>(null);

  const [formOwnerId, setFormOwnerId] = useState("");
  const [formContractType, setFormContractType] = useState("UMOWA");
  const [formStatus, setFormStatus] = useState("AKTYWNA");
  const [formParentContractId, setFormParentContractId] = useState("");

  const [batchPreviewOpen, setBatchPreviewOpen] = useState(false);
  const [batchContracts, setBatchContracts] = useState<any[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchParsing, setBatchParsing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const contracts = useMemo(() => allContracts.filter(c => c.apartmentId === apartment.id), [allContracts, apartment.id]);

  function openContractForm(contract: OwnerContract | null, parsed: any) {
    setEditingContract(contract);
    setPdfParsedData(parsed);
    setFormOwnerId(String(contract?.ownerId || parsed?.ownerId || apartment.ownerId || ""));
    setFormContractType(contract?.contractType || parsed?.contractType || "UMOWA");
    setFormStatus(contract?.status || "AKTYWNA");
    setFormParentContractId(String(contract?.parentContractId || parsed?.parentContractId || ""));
    setContractFormOpen(true);
  }

  const contractMutation = useMutation({
    mutationFn: (d: { method: string; url: string; body?: any }) => apiRequest(d.method, d.url, d.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-contracts"] });
      setContractFormOpen(false);
      setEditingContract(null);
      setPdfParsedData(null);
      toast({ title: "Zapisano" });
    },
    onError: (e: Error) => toast({ title: "Blad", description: e.message, variant: "destructive" }),
  });

  const deleteContractMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/owner-contracts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/owner-contracts"] });
      toast({ title: "Usunieto" });
    },
  });

  function handleContractSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: any = {
      ownerId: formOwnerId ? Number(formOwnerId) : null,
      apartmentId: apartment.id,
      monthlyRent: fd.get("monthlyRent") || null,
      additionalFees: fd.get("additionalFees") || null,
      startDate: fd.get("startDate") || null,
      endDate: fd.get("endDate") || null,
      contractType: formContractType,
      parentContractId: formParentContractId ? Number(formParentContractId) : null,
      notes: fd.get("notes") || null,
      status: formStatus,
    };
    if (editingContract) {
      contractMutation.mutate({ method: "PUT", url: `/api/owner-contracts/${editingContract.id}`, body });
    } else {
      contractMutation.mutate({ method: "POST", url: "/api/owner-contracts", body });
    }
  }

  function matchOwner(ownerName: string | null): number | null {
    if (!ownerName) return null;
    const matched = owners.find(o => o.name.toLowerCase().includes(ownerName.toLowerCase()) || ownerName.toLowerCase().includes(o.name.toLowerCase()));
    return matched?.id || null;
  }

  async function handleBatchUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const fd = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      fd.append("files", fileList[i]);
    }
    setBatchParsing(true);
    try {
      toast({ title: `Analizuje ${fileList.length} dokumentow...`, description: "AI odczytuje dane i wykrywa lancuch umow" });
      const res = await fetch("/api/parse-owner-contracts-batch", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) throw new Error("Blad parsowania dokumentow");
      const data = await res.json();

      const enriched = (data.contracts || []).map((c: any) => {
        const ownerId = matchOwner(c.ownerName) || (apartment.ownerId || null);
        return {
          ...c,
          ownerId,
          apartmentId: apartment.id,
          selected: true,
          editedMonthlyRent: c.monthlyRent,
          editedAdditionalFees: c.additionalFees,
          editedStartDate: c.startDate,
          editedEndDate: c.endDate,
          editedNotes: c.notes,
          editedStatus: "AKTYWNA",
        };
      });

      setBatchContracts(enriched);
      setBatchPreviewOpen(true);

      const umowy = enriched.filter((c: any) => c.contractType === "UMOWA").length;
      const aneksy = enriched.filter((c: any) => c.contractType === "ANEKS").length;
      toast({ title: `Rozpoznano ${enriched.length} dokumentow`, description: `${umowy} umow, ${aneksy} aneksow` });
    } catch (err: any) {
      toast({ title: "Blad", description: err.message, variant: "destructive" });
    } finally {
      setBatchParsing(false);
      if (batchFileInputRef.current) batchFileInputRef.current.value = "";
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleBatchUpload(e.dataTransfer.files);
  }

  async function handleBatchSave() {
    const toSave = batchContracts.filter(c => c.selected);
    if (toSave.length === 0) return;
    setBatchSaving(true);
    try {
      const savedIds = new Map<number, number>();

      const sorted = [...toSave].sort((a, b) => (a.chainOrder || 0) - (b.chainOrder || 0));
      const roots = sorted.filter(c => c.contractType === "UMOWA");
      const annexes = sorted.filter(c => c.contractType === "ANEKS");

      for (const c of roots) {
        const body = {
          ownerId: c.ownerId,
          apartmentId: apartment.id,
          monthlyRent: c.editedMonthlyRent || null,
          additionalFees: c.editedAdditionalFees || null,
          startDate: c.editedStartDate || null,
          endDate: c.editedEndDate || null,
          contractType: "UMOWA",
          parentContractId: c.suggestedParentContractId || null,
          notes: c.editedNotes || null,
          status: c.editedStatus || "AKTYWNA",
        };
        const res = await apiRequest("POST", "/api/owner-contracts", body);
        const saved = await res.json();
        savedIds.set(c.documentIndex, saved.id);
      }

      for (const c of annexes) {
        let parentId = c.suggestedParentContractId || null;
        if (c.parentDocumentIndex !== null && c.parentDocumentIndex !== undefined && savedIds.has(c.parentDocumentIndex)) {
          parentId = savedIds.get(c.parentDocumentIndex)!;
        }
        const body = {
          ownerId: c.ownerId,
          apartmentId: apartment.id,
          monthlyRent: c.editedMonthlyRent || null,
          additionalFees: c.editedAdditionalFees || null,
          startDate: c.editedStartDate || null,
          endDate: c.editedEndDate || null,
          contractType: "ANEKS",
          parentContractId: parentId,
          notes: c.editedNotes || null,
          status: c.editedStatus || "AKTYWNA",
        };
        const res = await apiRequest("POST", "/api/owner-contracts", body);
        const saved = await res.json();
        savedIds.set(c.documentIndex, saved.id);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/owner-contracts"] });
      setBatchPreviewOpen(false);
      setBatchContracts([]);
      toast({ title: `Zapisano ${toSave.length} umow/aneksow` });
    } catch (err: any) {
      toast({ title: "Blad zapisu", description: err.message, variant: "destructive" });
    } finally {
      setBatchSaving(false);
    }
  }

  function toggleBatchItem(idx: number) {
    setBatchContracts(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c));
  }

  function updateBatchItem(idx: number, field: string, value: any) {
    setBatchContracts(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }

  const rootContracts = contracts.filter(c => !c.parentContractId);
  const annexesMap = new Map<number, OwnerContract[]>();
  contracts.forEach(c => {
    if (c.parentContractId) {
      const existing = annexesMap.get(c.parentContractId) || [];
      existing.push(c);
      annexesMap.set(c.parentContractId, existing);
    }
  });
  const standalone = contracts.filter(c => c.parentContractId && !rootContracts.some(r => r.id === c.parentContractId));

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => openContractForm(null, null)} data-testid="btn-add-contract-apt">
          <Plus className="h-4 w-4 mr-1" /> Dodaj umowe
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="btn-import-pdf-apt">
          <Upload className="h-4 w-4 mr-1" /> Import PDF (AI)
        </Button>
        <Button variant="outline" size="sm" onClick={() => batchFileInputRef.current?.click()} disabled={batchParsing} data-testid="btn-batch-import-apt">
          {batchParsing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Files className="h-4 w-4 mr-1" />}
          Wiele plikow
        </Button>
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" className="hidden" onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.append("files", file);
          toast({ title: "Analizuje dokument...", description: "AI odczytuje dane z pliku" });
          fetch("/api/parse-owner-contract-pdf", { method: "POST", body: fd, credentials: "include" })
            .then(res => { if (!res.ok) throw new Error("Blad"); return res.json(); })
            .then(data => {
              data.apartmentId = apartment.id;
              if (data.ownerName) { const m = matchOwner(data.ownerName); if (m) data.ownerId = m; }
              if (!data.ownerId && apartment.ownerId) data.ownerId = apartment.ownerId;
              if (data.suggestedParentContractId) data.parentContractId = data.suggestedParentContractId;
              openContractForm(null, data);
              toast({ title: `Rozpoznano ${data.contractType === "ANEKS" ? "aneks" : "umowe"}`, description: "Sprawdz dane i zapisz" });
            })
            .catch((err: any) => toast({ title: "Blad", description: err.message, variant: "destructive" }));
          if (fileInputRef.current) fileInputRef.current.value = "";
        }} />
        <input ref={batchFileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.heic" multiple className="hidden" onChange={(e) => handleBatchUpload(e.target.files)} />
      </div>

      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${dragOver ? "border-[#5ADBFA] bg-[#5ADBFA]/10" : "border-border hover:border-muted-foreground/50"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => batchFileInputRef.current?.click()}
        data-testid="drop-zone-batch"
      >
        {batchParsing ? (
          <div className="flex items-center justify-center gap-2 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-[#5ADBFA]" />
            <span className="text-sm text-muted-foreground">AI analizuje dokumenty i wykrywa lancuch umow...</span>
          </div>
        ) : (
          <div className="space-y-1 py-1">
            <Files className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Przeciagnij pliki tutaj lub kliknij aby wybrac</p>
            <p className="text-[10px] text-muted-foreground">Wiele plikow naraz - AI wykryje lancuch umow i aneksow</p>
          </div>
        )}
      </div>

      {contracts.length === 0 && !batchParsing && (
        <p className="text-sm text-muted-foreground text-center py-2">Brak umow dla tego apartamentu</p>
      )}

      <div className="space-y-2">
        {[...rootContracts, ...standalone].map(c => {
          const ownerName = owners.find(o => o.id === c.ownerId)?.name || "\u2014";
          const annexes = (annexesMap.get(c.id) || []).sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
          return (
            <div key={c.id} className="space-y-0">
              <Card data-testid={`card-apt-contract-${c.id}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{ownerName}</p>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                        <span>Czynsz: {c.monthlyRent ? `${Number(c.monthlyRent).toLocaleString("pl-PL")} zl` : "\u2014"}</span>
                        {c.additionalFees && Number(c.additionalFees) > 0 && <span>+ {Number(c.additionalFees).toLocaleString("pl-PL")} zl</span>}
                        <span>{c.startDate || "\u2014"} &rarr; {c.endDate || "bezterminowo"}</span>
                        <Badge variant={c.status === "AKTYWNA" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
                        <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950">{c.contractType}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => openContractForm(c, null)} data-testid={`btn-edit-apt-contract-${c.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Usunac umowe?")) deleteContractMutation.mutate(c.id); }} data-testid={`btn-delete-apt-contract-${c.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {annexes.length > 0 && (
                <div className="border rounded-lg mt-1 bg-muted/30 dark:bg-muted/10">
                  <div className="px-4 py-1.5">
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Aneksy ({annexes.length})</span>
                  </div>
                  {annexes.map((ax, idx) => (
                    <div key={ax.id} className={`px-4 py-2 flex items-center justify-between gap-2 ${idx < annexes.length - 1 ? "border-b border-border/50" : ""}`} data-testid={`card-apt-annex-${ax.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-4 flex flex-col items-center shrink-0">
                          <div className="w-px h-2 bg-border" />
                          <div className="w-2 h-2 rounded-full bg-[#5ADBFA] border-2 border-background" />
                          {idx < annexes.length - 1 && <div className="w-px h-2 bg-border" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[9px] bg-amber-50 dark:bg-amber-950">ANEKS</Badge>
                            <span className="text-xs">{ax.startDate} &rarr; {ax.endDate || "bezterminowo"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            {ax.monthlyRent && <span>Czynsz: {Number(ax.monthlyRent).toLocaleString("pl-PL")} zl</span>}
                            {ax.notes && <span className="truncate max-w-[200px]">{ax.notes}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" onClick={() => openContractForm(ax, null)} data-testid={`btn-edit-apt-annex-${ax.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Usunac aneks?")) deleteContractMutation.mutate(ax.id); }} data-testid={`btn-delete-apt-annex-${ax.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={contractFormOpen} onOpenChange={v => { setContractFormOpen(v); if (!v) { setEditingContract(null); setPdfParsedData(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContract ? "Edytuj umowe" : pdfParsedData ? `Import ${pdfParsedData.contractType === "ANEKS" ? "aneksu" : "umowy"} (AI)` : "Dodaj umowe"}</DialogTitle>
          </DialogHeader>
          {pdfParsedData && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs space-y-1">
              <p className="font-medium text-blue-700 dark:text-blue-300">Dane odczytane z dokumentu:</p>
              {pdfParsedData.ownerName && <p>Wlasciciel: <strong>{pdfParsedData.ownerName}</strong></p>}
              {pdfParsedData.apartmentName && <p>Apartament: <strong>{pdfParsedData.apartmentName}</strong></p>}
              {pdfParsedData.contractType === "ANEKS" && pdfParsedData.parentContractRef && (
                <p className="text-amber-700 dark:text-amber-300">Aneks do: <strong>{pdfParsedData.parentContractRef}</strong></p>
              )}
              {pdfParsedData.changedFields && pdfParsedData.changedFields.length > 0 && (
                <p>Zmienione pola: {pdfParsedData.changedFields.join(", ")}</p>
              )}
            </div>
          )}
          <form onSubmit={handleContractSubmit} className="space-y-3">
            <div>
              <Label>Wlasciciel</Label>
              <Select value={formOwnerId} onValueChange={setFormOwnerId}>
                <SelectTrigger data-testid="select-apt-contract-owner"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  {owners.map(o => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Czynsz miesiecznie</Label>
                <Input name="monthlyRent" type="number" step="0.01" defaultValue={editingContract?.monthlyRent || pdfParsedData?.monthlyRent || ""} data-testid="input-apt-contract-rent" />
              </div>
              <div>
                <Label>Oplaty dodatkowe</Label>
                <Input name="additionalFees" type="number" step="0.01" defaultValue={editingContract?.additionalFees || pdfParsedData?.additionalFees || ""} data-testid="input-apt-contract-fees" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data od</Label>
                <Input name="startDate" type="date" defaultValue={editingContract?.startDate || pdfParsedData?.startDate || ""} data-testid="input-apt-contract-start" />
              </div>
              <div>
                <Label>Data do</Label>
                <Input name="endDate" type="date" defaultValue={editingContract?.endDate || pdfParsedData?.endDate || ""} data-testid="input-apt-contract-end" />
              </div>
            </div>
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
                    <SelectItem value="ZAKONCZONA">ZAKONCZONA</SelectItem>
                    <SelectItem value="ROZWIAZANA">ROZWIAZANA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {contracts.length > 0 && (
              <div>
                <Label>Umowa nadrzedna (opcjonalnie)</Label>
                <Select value={formParentContractId} onValueChange={setFormParentContractId}>
                  <SelectTrigger data-testid="select-apt-contract-parent"><SelectValue placeholder="Brak" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Brak</SelectItem>
                    {contracts.filter(c => c.id !== editingContract?.id && c.contractType === "UMOWA").map(c => {
                      const ownerName = owners.find(o => o.id === c.ownerId)?.name || "?";
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
              <Textarea name="notes" defaultValue={editingContract?.notes || pdfParsedData?.notes || ""} rows={2} data-testid="input-apt-contract-notes" />
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

      <Dialog open={batchPreviewOpen} onOpenChange={v => { setBatchPreviewOpen(v); if (!v) setBatchContracts([]); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import wielu umow - podglad ({batchContracts.filter(c => c.selected).length}/{batchContracts.length})</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">AI rozpoznal lancuch umow. Sprawdz dane i odznacz te, ktorych nie chcesz importowac.</p>

          <div className="space-y-3 mt-2">
            {batchContracts.map((c, idx) => {
              const ownerName = owners.find(o => o.id === c.ownerId)?.name || c.ownerName || "\u2014";
              const isAnnex = c.contractType === "ANEKS";
              const parentDoc = isAnnex && c.parentDocumentIndex !== null && c.parentDocumentIndex !== undefined
                ? batchContracts[c.parentDocumentIndex]
                : null;
              return (
                <div key={idx} className={`border rounded-lg transition-opacity ${c.selected ? "opacity-100" : "opacity-50"}`} data-testid={`batch-item-${idx}`}>
                  <div className="flex items-start gap-3 p-3">
                    <button
                      type="button"
                      className={`mt-0.5 shrink-0 rounded border p-0.5 transition-colors ${c.selected ? "bg-[#5ADBFA] border-[#5ADBFA] text-white" : "border-border"}`}
                      onClick={() => toggleBatchItem(idx)}
                      data-testid={`batch-toggle-${idx}`}
                    >
                      {c.selected ? <Check className="h-3 w-3" /> : <div className="h-3 w-3" />}
                    </button>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={isAnnex ? "outline" : "default"} className={`text-[10px] ${isAnnex ? "bg-amber-50 dark:bg-amber-950" : ""}`}>
                          {c.contractType} {c.annexNumber ? `#${c.annexNumber}` : ""}
                        </Badge>
                        <span className="text-xs font-medium">{ownerName}</span>
                        <span className="text-[10px] text-muted-foreground">{c.fileName}</span>
                        {isAnnex && parentDoc && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            aneks do: {parentDoc.fileName}
                          </span>
                        )}
                        {isAnnex && c.parentContractRef && !parentDoc && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            ref: {c.parentContractRef}
                          </span>
                        )}
                      </div>
                      {c.selected && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">Czynsz</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={c.editedMonthlyRent || ""}
                              onChange={e => updateBatchItem(idx, "editedMonthlyRent", e.target.value)}
                              className="h-8 text-xs"
                              data-testid={`batch-rent-${idx}`}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Oplaty dod.</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={c.editedAdditionalFees || ""}
                              onChange={e => updateBatchItem(idx, "editedAdditionalFees", e.target.value)}
                              className="h-8 text-xs"
                              data-testid={`batch-fees-${idx}`}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Data od</Label>
                            <Input
                              type="date"
                              value={c.editedStartDate || ""}
                              onChange={e => updateBatchItem(idx, "editedStartDate", e.target.value)}
                              className="h-8 text-xs"
                              data-testid={`batch-start-${idx}`}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Data do</Label>
                            <Input
                              type="date"
                              value={c.editedEndDate || ""}
                              onChange={e => updateBatchItem(idx, "editedEndDate", e.target.value)}
                              className="h-8 text-xs"
                              data-testid={`batch-end-${idx}`}
                            />
                          </div>
                        </div>
                      )}
                      {c.selected && c.changedFields && c.changedFields.length > 0 && (
                        <p className="text-[10px] text-muted-foreground">Zmienia: {c.changedFields.join(", ")}</p>
                      )}
                    </div>
                  </div>
                  {idx < batchContracts.length - 1 && isAnnex === false && batchContracts[idx + 1]?.contractType === "ANEKS" && batchContracts[idx + 1]?.parentDocumentIndex === idx && (
                    <div className="flex justify-center -mb-1 pb-1">
                      <div className="flex flex-col items-center">
                        <div className="w-px h-2 bg-[#5ADBFA]" />
                        <ArrowDown className="h-3 w-3 text-[#5ADBFA]" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => { setBatchPreviewOpen(false); setBatchContracts([]); }}>Anuluj</Button>
            <Button onClick={handleBatchSave} disabled={batchSaving || batchContracts.filter(c => c.selected).length === 0} data-testid="btn-batch-save">
              {batchSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileCheck className="h-4 w-4 mr-1" />}
              Zapisz {batchContracts.filter(c => c.selected).length} umow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
