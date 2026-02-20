import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { HandoverProtocol, HandoverProtocolRoom, HandoverProtocolItem, HandoverProtocolMeter, Apartment, Sublease } from "@shared/schema";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Plus, Trash2, FileDown, ClipboardCheck, Pencil, X, ChevronDown, ChevronUp,
  Home, Package, Gauge, Save, Loader2, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";

const CONDITION_OPTIONS = [
  { value: "DOBRY", label: "Dobry" },
  { value: "USZKODZONY", label: "Uszkodzony" },
  { value: "DO_NAPRAWY", label: "Do naprawy" },
];

const ITEM_CONDITION_OPTIONS = [
  { value: "NOWY", label: "Nowy" },
  { value: "DOBRY", label: "Dobry" },
  { value: "ZUZYTY", label: "Zużyty" },
  { value: "USZKODZONY", label: "Uszkodzony" },
];

const METER_TYPES = [
  { value: "PRAD", label: "Prąd", unit: "kWh" },
  { value: "WODA_ZIMNA", label: "Woda zimna", unit: "m³" },
  { value: "WODA_CIEPLA", label: "Woda ciepła", unit: "m³" },
  { value: "GAZ", label: "Gaz", unit: "m³" },
  { value: "OGRZEWANIE", label: "Ogrzewanie", unit: "GJ" },
];

const DEFAULT_ROOMS = [
  "Salon", "Sypialnia", "Kuchnia", "Łazienka", "Przedpokój", "Balkon/Taras"
];

interface RoomForm {
  roomName: string;
  wallsCondition: string;
  floorCondition: string;
  windowsCondition: string;
  doorsCondition: string;
  comments: string;
  sortOrder: number;
}

interface ItemForm {
  itemName: string;
  quantity: number;
  condition: string;
  comments: string;
  sortOrder: number;
}

interface MeterForm {
  meterType: string;
  meterNumber: string;
  reading: string;
  unit: string;
}

interface ProtocolFormData {
  protocolType: string;
  protocolDate: string;
  protocolTime: string;
  tenantName: string;
  tenantPesel: string;
  tenantIdNumber: string;
  apartmentName: string;
  apartmentAddress: string;
  notes: string;
  status: string;
  rooms: RoomForm[];
  items: ItemForm[];
  meters: MeterForm[];
}

function emptyForm(sublease?: Sublease, apartments?: Apartment[]): ProtocolFormData {
  const tenantName = sublease
    ? sublease.tenantType === "firma"
      ? sublease.companyName || ""
      : `${sublease.firstName || ""} ${sublease.lastName || ""}`.trim()
    : "";

  const aptId = sublease?.apartmentId;
  const apt = apartments?.find(a => a.id === aptId);

  return {
    protocolType: "WYDANIE",
    protocolDate: format(new Date(), "yyyy-MM-dd"),
    protocolTime: format(new Date(), "HH:mm"),
    tenantName,
    tenantPesel: sublease?.peselOrPassport || "",
    tenantIdNumber: sublease?.idNumber || "",
    apartmentName: apt?.name || "",
    apartmentAddress: apt?.location || "",
    notes: "",
    status: "SZKIC",
    rooms: DEFAULT_ROOMS.map((name, i) => ({
      roomName: name,
      wallsCondition: "DOBRY",
      floorCondition: "DOBRY",
      windowsCondition: "DOBRY",
      doorsCondition: "DOBRY",
      comments: "",
      sortOrder: i,
    })),
    items: [],
    meters: METER_TYPES.map(mt => ({
      meterType: mt.value,
      meterNumber: "",
      reading: "",
      unit: mt.unit,
    })),
  };
}

function ConditionSelect({ value, onChange, testId }: { value: string; onChange: (v: string) => void; testId?: string }) {
  return (
    <Select value={value || "DOBRY"} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs" data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CONDITION_OPTIONS.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function HandoverProtocolsTab({ subleaseId, sublease, apartments }: {
  subleaseId: number;
  sublease?: Sublease;
  apartments: Apartment[];
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProtocolFormData>(emptyForm(sublease, apartments));
  const [activeSection, setActiveSection] = useState<string>("rooms");

  const { data: protocols = [], isLoading } = useQuery<(HandoverProtocol & { rooms?: HandoverProtocolRoom[], items?: HandoverProtocolItem[], meters?: HandoverProtocolMeter[] })[]>({
    queryKey: ['/api/handover-protocols', { subleaseId }],
    queryFn: async () => {
      const res = await fetch(`/api/handover-protocols?subleaseId=${subleaseId}`, { credentials: 'include' });
      return res.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/handover-protocols', { ...data, subleaseId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/handover-protocols', { subleaseId }] });
      toast({ title: "Sukces", description: "Protokół został utworzony" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest('PATCH', `/api/handover-protocols/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/handover-protocols', { subleaseId }] });
      toast({ title: "Sukces", description: "Protokół został zaktualizowany" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/handover-protocols/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/handover-protocols', { subleaseId }] });
      toast({ title: "Usunięto", description: "Protokół został usunięty" });
    },
  });

  const openNew = (type: string) => {
    setEditId(null);
    setForm({ ...emptyForm(sublease, apartments), protocolType: type });
    setActiveSection("rooms");
    setDialogOpen(true);
  };

  const openEdit = async (id: number) => {
    try {
      const res = await fetch(`/api/handover-protocols/${id}`, { credentials: 'include' });
      const data = await res.json();
      setEditId(id);
      setForm({
        protocolType: data.protocolType,
        protocolDate: data.protocolDate,
        protocolTime: data.protocolTime || "",
        tenantName: data.tenantName,
        tenantPesel: data.tenantPesel || "",
        tenantIdNumber: data.tenantIdNumber || "",
        apartmentName: data.apartmentName,
        apartmentAddress: data.apartmentAddress || "",
        notes: data.notes || "",
        status: data.status || "SZKIC",
        rooms: (data.rooms || []).map((r: any) => ({
          roomName: r.roomName,
          wallsCondition: r.wallsCondition || "DOBRY",
          floorCondition: r.floorCondition || "DOBRY",
          windowsCondition: r.windowsCondition || "DOBRY",
          doorsCondition: r.doorsCondition || "DOBRY",
          comments: r.comments || "",
          sortOrder: r.sortOrder || 0,
        })),
        items: (data.items || []).map((i: any) => ({
          itemName: i.itemName,
          quantity: i.quantity || 1,
          condition: i.condition || "DOBRY",
          comments: i.comments || "",
          sortOrder: i.sortOrder || 0,
        })),
        meters: (data.meters || []).map((m: any) => ({
          meterType: m.meterType,
          meterNumber: m.meterNumber || "",
          reading: m.reading || "",
          unit: m.unit || "",
        })),
      });
      setActiveSection("rooms");
      setDialogOpen(true);
    } catch (err: any) {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    }
  };

  const handleSave = () => {
    const payload = {
      protocolType: form.protocolType,
      protocolDate: form.protocolDate,
      protocolTime: form.protocolTime || null,
      tenantName: form.tenantName,
      tenantPesel: form.tenantPesel || null,
      tenantIdNumber: form.tenantIdNumber || null,
      apartmentName: form.apartmentName,
      apartmentAddress: form.apartmentAddress || null,
      notes: form.notes || null,
      status: form.status,
      rooms: form.rooms,
      items: form.items,
      meters: form.meters.filter(m => m.reading),
    };

    if (editId) {
      updateMut.mutate({ id: editId, data: payload });
    } else {
      createMut.mutate(payload);
    }
  };

  const addRoom = () => {
    setForm(f => ({
      ...f,
      rooms: [...f.rooms, {
        roomName: "",
        wallsCondition: "DOBRY",
        floorCondition: "DOBRY",
        windowsCondition: "DOBRY",
        doorsCondition: "DOBRY",
        comments: "",
        sortOrder: f.rooms.length,
      }],
    }));
  };

  const removeRoom = (idx: number) => {
    setForm(f => ({ ...f, rooms: f.rooms.filter((_, i) => i !== idx) }));
  };

  const updateRoom = (idx: number, field: keyof RoomForm, value: any) => {
    setForm(f => ({
      ...f,
      rooms: f.rooms.map((r, i) => i === idx ? { ...r, [field]: value } : r),
    }));
  };

  const addItem = () => {
    setForm(f => ({
      ...f,
      items: [...f.items, {
        itemName: "",
        quantity: 1,
        condition: "DOBRY",
        comments: "",
        sortOrder: f.items.length,
      }],
    }));
  };

  const removeItem = (idx: number) => {
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: keyof ItemForm, value: any) => {
    setForm(f => ({
      ...f,
      items: f.items.map((it, i) => i === idx ? { ...it, [field]: value } : it),
    }));
  };

  const updateMeter = (idx: number, field: keyof MeterForm, value: string) => {
    setForm(f => ({
      ...f,
      meters: f.meters.map((m, i) => i === idx ? { ...m, [field]: value } : m),
    }));
  };

  const downloadPdf = (id: number) => {
    window.open(`/api/handover-protocols/${id}/pdf`, '_blank');
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-4 p-1">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Protokoły zdawczo-odbiorcze</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => openNew("WYDANIE")} data-testid="button-new-protocol-wydanie">
            <Plus className="h-3.5 w-3.5 mr-1" /> Wydanie
          </Button>
          <Button size="sm" variant="outline" onClick={() => openNew("ZWROT")} data-testid="button-new-protocol-zwrot">
            <Plus className="h-3.5 w-3.5 mr-1" /> Zwrot
          </Button>
        </div>
      </div>

      {isLoading && <div className="text-center py-4 text-muted-foreground text-sm">Ładowanie...</div>}

      {!isLoading && protocols.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Brak protokołów. Utwórz protokół wydania lub zwrotu.
        </div>
      )}

      {protocols.map(protocol => (
        <Card key={protocol.id} data-testid={`card-protocol-${protocol.id}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant={protocol.protocolType === "WYDANIE" ? "default" : "secondary"}>
                  {protocol.protocolType === "WYDANIE" ? "Wydanie" : "Zwrot"}
                </Badge>
                <span className="text-sm font-medium">{protocol.apartmentName}</span>
                <span className="text-xs text-muted-foreground">{protocol.protocolDate}</span>
                <Badge variant={protocol.status === "ZATWIERDZONY" ? "default" : "outline"} className="text-xs">
                  {protocol.status === "ZATWIERDZONY" ? "Zatwierdzony" : "Szkic"}
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => downloadPdf(protocol.id)} data-testid={`button-pdf-${protocol.id}`}>
                  <FileDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => openEdit(protocol.id)} data-testid={`button-edit-protocol-${protocol.id}`}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" data-testid={`button-delete-protocol-${protocol.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Usunąć protokół?</AlertDialogTitle>
                      <AlertDialogDescription>Ta operacja jest nieodwracalna.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Anuluj</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteMut.mutate(protocol.id)}>Usuń</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Najemca: {protocol.tenantName}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {editId ? "Edytuj protokół" : "Nowy protokół"} {form.protocolType === "WYDANIE" ? "wydania" : "zwrotu"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Typ</Label>
                <Select value={form.protocolType} onValueChange={v => setForm(f => ({ ...f, protocolType: v }))}>
                  <SelectTrigger data-testid="select-protocol-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WYDANIE">Wydanie</SelectItem>
                    <SelectItem value="ZWROT">Zwrot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={form.protocolDate} onChange={e => setForm(f => ({ ...f, protocolDate: e.target.value }))} data-testid="input-protocol-date" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Godzina</Label>
                <Input type="time" value={form.protocolTime} onChange={e => setForm(f => ({ ...f, protocolTime: e.target.value }))} data-testid="input-protocol-time" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-protocol-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SZKIC">Szkic</SelectItem>
                    <SelectItem value="ZATWIERDZONY">Zatwierdzony</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Najemca</Label>
                <Input value={form.tenantName} onChange={e => setForm(f => ({ ...f, tenantName: e.target.value }))} data-testid="input-tenant-name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Lokal</Label>
                <Input value={form.apartmentName} onChange={e => setForm(f => ({ ...f, apartmentName: e.target.value }))} data-testid="input-apartment-name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">PESEL / Paszport</Label>
                <Input value={form.tenantPesel} onChange={e => setForm(f => ({ ...f, tenantPesel: e.target.value }))} data-testid="input-tenant-pesel" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nr dowodu</Label>
                <Input value={form.tenantIdNumber} onChange={e => setForm(f => ({ ...f, tenantIdNumber: e.target.value }))} data-testid="input-tenant-id" />
              </div>
              <div className="col-span-full space-y-1">
                <Label className="text-xs">Adres lokalu</Label>
                <Input value={form.apartmentAddress} onChange={e => setForm(f => ({ ...f, apartmentAddress: e.target.value }))} data-testid="input-apartment-address" />
              </div>
            </div>

            {/* Meters Section */}
            <div className="border rounded-md">
              <button
                className="w-full flex items-center justify-between p-3 text-sm font-medium"
                onClick={() => setActiveSection(s => s === "meters" ? "" : "meters")}
                data-testid="toggle-section-meters"
              >
                <span className="flex items-center gap-2"><Gauge className="h-4 w-4" /> Stany liczników ({form.meters.filter(m => m.reading).length})</span>
                {activeSection === "meters" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {activeSection === "meters" && (
                <div className="px-3 pb-3 space-y-2">
                  {form.meters.map((meter, idx) => {
                    const mt = METER_TYPES.find(t => t.value === meter.meterType);
                    return (
                      <div key={idx} className="grid grid-cols-4 gap-2 items-end">
                        <div>
                          <Label className="text-xs">{mt?.label || meter.meterType}</Label>
                        </div>
                        <div>
                          <Input
                            placeholder="Nr licznika"
                            value={meter.meterNumber}
                            onChange={e => updateMeter(idx, "meterNumber", e.target.value)}
                            className="h-8 text-xs"
                            data-testid={`input-meter-number-${idx}`}
                          />
                        </div>
                        <div>
                          <Input
                            placeholder="Odczyt"
                            type="number"
                            step="0.001"
                            value={meter.reading}
                            onChange={e => updateMeter(idx, "reading", e.target.value)}
                            className="h-8 text-xs"
                            data-testid={`input-meter-reading-${idx}`}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground self-center">{meter.unit}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rooms Section */}
            <div className="border rounded-md">
              <button
                className="w-full flex items-center justify-between p-3 text-sm font-medium"
                onClick={() => setActiveSection(s => s === "rooms" ? "" : "rooms")}
                data-testid="toggle-section-rooms"
              >
                <span className="flex items-center gap-2"><Home className="h-4 w-4" /> Pomieszczenia ({form.rooms.length})</span>
                {activeSection === "rooms" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {activeSection === "rooms" && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-32">Pomieszczenie</TableHead>
                          <TableHead className="text-xs">Ściany</TableHead>
                          <TableHead className="text-xs">Podłoga</TableHead>
                          <TableHead className="text-xs">Okna</TableHead>
                          <TableHead className="text-xs">Drzwi</TableHead>
                          <TableHead className="text-xs w-32">Uwagi</TableHead>
                          <TableHead className="text-xs w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {form.rooms.map((room, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Input value={room.roomName} onChange={e => updateRoom(idx, "roomName", e.target.value)} className="h-8 text-xs" data-testid={`input-room-name-${idx}`} />
                            </TableCell>
                            <TableCell>
                              <ConditionSelect value={room.wallsCondition} onChange={v => updateRoom(idx, "wallsCondition", v)} />
                            </TableCell>
                            <TableCell>
                              <ConditionSelect value={room.floorCondition} onChange={v => updateRoom(idx, "floorCondition", v)} />
                            </TableCell>
                            <TableCell>
                              <ConditionSelect value={room.windowsCondition} onChange={v => updateRoom(idx, "windowsCondition", v)} />
                            </TableCell>
                            <TableCell>
                              <ConditionSelect value={room.doorsCondition} onChange={v => updateRoom(idx, "doorsCondition", v)} />
                            </TableCell>
                            <TableCell>
                              <Input value={room.comments} onChange={e => updateRoom(idx, "comments", e.target.value)} className="h-8 text-xs" placeholder="Uwagi" data-testid={`input-room-comments-${idx}`} />
                            </TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => removeRoom(idx)} data-testid={`button-remove-room-${idx}`}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button size="sm" variant="outline" onClick={addRoom} data-testid="button-add-room">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj pomieszczenie
                  </Button>
                </div>
              )}
            </div>

            {/* Items Section */}
            <div className="border rounded-md">
              <button
                className="w-full flex items-center justify-between p-3 text-sm font-medium"
                onClick={() => setActiveSection(s => s === "items" ? "" : "items")}
                data-testid="toggle-section-items"
              >
                <span className="flex items-center gap-2"><Package className="h-4 w-4" /> Wyposażenie ({form.items.length})</span>
                {activeSection === "items" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {activeSection === "items" && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs w-48">Nazwa</TableHead>
                          <TableHead className="text-xs w-20">Ilość</TableHead>
                          <TableHead className="text-xs w-32">Stan</TableHead>
                          <TableHead className="text-xs">Uwagi</TableHead>
                          <TableHead className="text-xs w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {form.items.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              <Input value={item.itemName} onChange={e => updateItem(idx, "itemName", e.target.value)} className="h-8 text-xs" placeholder="np. Lodówka" data-testid={`input-item-name-${idx}`} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} className="h-8 text-xs" data-testid={`input-item-qty-${idx}`} />
                            </TableCell>
                            <TableCell>
                              <Select value={item.condition || "DOBRY"} onValueChange={v => updateItem(idx, "condition", v)}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {ITEM_CONDITION_OPTIONS.map(o => (
                                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input value={item.comments} onChange={e => updateItem(idx, "comments", e.target.value)} className="h-8 text-xs" placeholder="Uwagi" data-testid={`input-item-comments-${idx}`} />
                            </TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => removeItem(idx)} data-testid={`button-remove-item-${idx}`}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button size="sm" variant="outline" onClick={addItem} data-testid="button-add-item">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Dodaj element
                  </Button>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">Uwagi ogólne</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                className="text-sm"
                data-testid="textarea-protocol-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Anuluj</Button>
            <Button onClick={handleSave} disabled={isSaving || !form.tenantName || !form.apartmentName} data-testid="button-save-protocol">
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              {editId ? "Zapisz zmiany" : "Utwórz protokół"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
