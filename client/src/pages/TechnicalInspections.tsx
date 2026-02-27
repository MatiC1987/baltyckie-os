import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TechnicalInspection, Apartment } from "@shared/schema";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/DataTable";
import {
  Plus, Pencil, Trash2, Search, AlertTriangle, CheckCircle2,
  Clock, ChevronLeft, ChevronRight, CalendarDays, List, Phone
} from "lucide-react";

const INSPECTION_TYPES = [
  { value: "GAZOWY", label: "Przegląd gazowy" },
  { value: "ELEKTRYCZNY", label: "Przegląd elektryczny" },
  { value: "KOMINIARSKI", label: "Przegląd kominiarski" },
  { value: "WENTYLACYJNY", label: "Przegląd wentylacyjny" },
  { value: "BUDOWLANY", label: "Przegląd budowlany" },
  { value: "PPOZ", label: "Przegląd p.poż." },
  { value: "INNE", label: "Inny" },
];

const STATUS_OPTIONS = [
  { value: "ZAPLANOWANY", label: "Zaplanowany" },
  { value: "WYKONANY", label: "Wykonany" },
  { value: "PRZETERMINOWANY", label: "Przeterminowany" },
];

function getTypeLabel(type: string) {
  return INSPECTION_TYPES.find(t => t.value === type)?.label || type;
}

function getStatusBadge(status: string, nextDate: string) {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = nextDate < today && status !== 'WYKONANY';

  if (isOverdue || status === 'PRZETERMINOWANY') {
    return <Badge variant="destructive" data-testid="badge-status-overdue"><AlertTriangle className="h-3 w-3 mr-1" />Przeterminowany</Badge>;
  }
  if (status === 'WYKONANY') {
    return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" data-testid="badge-status-done"><CheckCircle2 className="h-3 w-3 mr-1" />Wykonany</Badge>;
  }
  const daysLeft = Math.ceil((new Date(nextDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  if (daysLeft <= 30) {
    return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400" data-testid="badge-status-soon"><Clock className="h-3 w-3 mr-1" />Za {daysLeft} dni</Badge>;
  }
  return <Badge variant="outline" data-testid="badge-status-planned"><Clock className="h-3 w-3 mr-1" />Zaplanowany</Badge>;
}

const TYPE_COLORS: Record<string, string> = {
  GAZOWY: "bg-orange-500",
  ELEKTRYCZNY: "bg-yellow-500",
  KOMINIARSKI: "bg-gray-500",
  WENTYLACYJNY: "bg-blue-400",
  BUDOWLANY: "bg-emerald-500",
  PPOZ: "bg-red-500",
  INNE: "bg-purple-500",
};

const RECURRENCE_OPTIONS = [
  { value: 6, label: "Co 6 miesięcy" },
  { value: 12, label: "Co 12 miesięcy (rocznie)" },
  { value: 24, label: "Co 24 miesiące" },
  { value: 36, label: "Co 36 miesięcy" },
  { value: 60, label: "Co 60 miesięcy" },
];

const emptyForm = {
  apartmentId: null as number | null,
  inspectionType: "GAZOWY",
  lastDate: "",
  nextDate: "",
  status: "ZAPLANOWANY",
  notes: "",
  cost: "",
  contractor: "",
  contractorPhone: "",
  recurrenceMonths: null as number | null,
};

export default function TechnicalInspections() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterApartment, setFilterApartment] = useState("all");
  const [activeTab, setActiveTab] = useState("lista");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: inspections = [], isLoading } = useQuery<TechnicalInspection[]>({
    queryKey: ['/api/technical-inspections'],
  });

  const { data: apartments = [] } = useQuery<Apartment[]>({
    queryKey: ['/api/apartments'],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/technical-inspections', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/technical-inspections'] });
      toast({ title: "Przegląd został dodany" });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/technical-inspections/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/technical-inspections'] });
      toast({ title: "Przegląd został zaktualizowany" });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/technical-inspections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/technical-inspections'] });
      toast({ title: "Przegląd został usunięty" });
      setDeleteId(null);
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const closeDialog = () => {
    setShowDialog(false);
    setEditId(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditId(null);
    setShowDialog(true);
  };

  const openEdit = (insp: TechnicalInspection) => {
    setForm({
      apartmentId: insp.apartmentId,
      inspectionType: insp.inspectionType,
      lastDate: insp.lastDate || "",
      nextDate: insp.nextDate,
      status: insp.status,
      notes: insp.notes || "",
      cost: insp.cost || "",
      contractor: insp.contractor || "",
      contractorPhone: insp.contractorPhone || "",
      recurrenceMonths: (insp as any).recurrenceMonths || null,
    });
    setEditId(insp.id);
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.nextDate) {
      toast({ title: "Wymagane pole", description: "Podaj datę następnego przeglądu", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      apartmentId: form.apartmentId || null,
      cost: form.cost || null,
      lastDate: form.lastDate || null,
      notes: form.notes || null,
      contractor: form.contractor || null,
      contractorPhone: form.contractorPhone || null,
      recurrenceMonths: form.recurrenceMonths || null,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const filteredInspections = useMemo(() => {
    return inspections.filter(insp => {
      if (filterType !== "all" && insp.inspectionType !== filterType) return false;
      if (filterStatus !== "all") {
        if (filterStatus === "PRZETERMINOWANY") {
          const today = new Date().toISOString().split('T')[0];
          if (!(insp.nextDate < today && insp.status !== 'WYKONANY')) return false;
        } else if (insp.status !== filterStatus) return false;
      }
      if (filterApartment !== "all" && String(insp.apartmentId) !== filterApartment) return false;
      return true;
    });
  }, [inspections, filterType, filterStatus, filterApartment]);

  const getApartmentName = (id: number | null) => {
    if (!id) return "—";
    return apartments.find(a => a.id === id)?.name || `#${id}`;
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const paddingBefore = startDay === 0 ? 6 : startDay - 1;
    return { days, paddingBefore };
  }, [calendarMonth]);

  const inspectionsByDate = useMemo(() => {
    const map: Record<string, TechnicalInspection[]> = {};
    inspections.forEach(insp => {
      if (insp.nextDate) {
        const key = insp.nextDate;
        if (!map[key]) map[key] = [];
        map[key].push(insp);
      }
    });
    return map;
  }, [inspections]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const overdue = inspections.filter(i => i.nextDate < today && i.status !== 'WYKONANY').length;
    const upcoming30 = inspections.filter(i => {
      if (i.status === 'WYKONANY') return false;
      const d = new Date(i.nextDate);
      const diff = Math.ceil((d.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 30;
    }).length;
    const done = inspections.filter(i => i.status === 'WYKONANY').length;
    return { overdue, upcoming30, done, total: inspections.length };
  }, [inspections]);

  return (
    <div className="p-4 md:p-6 space-y-4" data-testid="page-technical-inspections">
      <PageHeader title="Przeglądy techniczne" description="Kalendarz i zarządzanie przeglądami technicznymi mieszkań" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card data-testid="stat-overdue">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <div>
              <div className="text-2xl font-bold" data-testid="text-overdue-count">{stats.overdue}</div>
              <div className="text-xs text-muted-foreground">Przeterminowane</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-upcoming">
          <CardContent className="p-3 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <div>
              <div className="text-2xl font-bold" data-testid="text-upcoming-count">{stats.upcoming30}</div>
              <div className="text-xs text-muted-foreground">W ciągu 30 dni</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-done">
          <CardContent className="p-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <div className="text-2xl font-bold" data-testid="text-done-count">{stats.done}</div>
              <div className="text-xs text-muted-foreground">Wykonane</div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-total">
          <CardContent className="p-3 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-500" />
            <div>
              <div className="text-2xl font-bold" data-testid="text-total-count">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Wszystkie</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <TabsList>
            <TabsTrigger value="lista" className="gap-1" data-testid="tab-lista"><List className="h-4 w-4" />Lista</TabsTrigger>
            <TabsTrigger value="kalendarz" className="gap-1" data-testid="tab-kalendarz"><CalendarDays className="h-4 w-4" />Kalendarz</TabsTrigger>
          </TabsList>
          <Button onClick={openCreate} data-testid="button-add-inspection"><Plus className="h-4 w-4 mr-1" />Dodaj przegląd</Button>
        </div>

        <TabsContent value="lista" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-type">
                <SelectValue placeholder="Typ przeglądu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie typy</SelectItem>
                {INSPECTION_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie statusy</SelectItem>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterApartment} onValueChange={setFilterApartment}>
              <SelectTrigger className="w-[200px]" data-testid="select-filter-apartment">
                <SelectValue placeholder="Mieszkanie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie mieszkania</SelectItem>
                {apartments.map(a => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable<TechnicalInspection>
            data={filteredInspections}
            columns={[
              { header: "Typ", accessorKey: "inspectionType", cell: (insp) => (
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${TYPE_COLORS[insp.inspectionType] || 'bg-gray-400'}`} />
                  <span className="font-medium">{getTypeLabel(insp.inspectionType)}</span>
                </div>
              ) },
              { header: "Apartament", cell: (insp) => <span data-testid={`text-apartment-${insp.id}`}>{getApartmentName(insp.apartmentId)}</span>, sortable: false },
              { header: "Status", cell: (insp) => getStatusBadge(insp.status, insp.nextDate), sortable: false },
              { header: "Data planowana", accessorKey: "nextDate", cell: (insp) => <span data-testid={`text-next-date-${insp.id}`}>{insp.nextDate ? format(parseISO(insp.nextDate), "dd.MM.yyyy") : "—"}</span> },
              { header: "Data wykonania", accessorKey: "lastDate", cell: (insp) => insp.lastDate ? format(parseISO(insp.lastDate), "dd.MM.yyyy") : "—" },
              { header: "Koszt", cell: (insp) => insp.cost ? `${Number(insp.cost).toFixed(2)} PLN` : "—", sortable: false },
              { header: "Uwagi", cell: (insp) => (
                <>
                  {insp.contractor && (
                    <div className="flex items-center gap-1">
                      <span>{insp.contractor}</span>
                      {insp.contractorPhone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />{insp.contractorPhone}
                        </span>
                      )}
                    </div>
                  )}
                  {!insp.contractor && "—"}
                </>
              ), sortable: false },
              { header: "Akcje", sortable: false, className: "text-right", cell: (insp) => (
                <div className="flex items-center gap-1 justify-end">
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(insp); }} data-testid={`button-edit-${insp.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDeleteId(insp.id); }} data-testid={`button-delete-${insp.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) },
            ]}
            searchable={true}
            searchKeys={["inspectionType", "contractor", "notes"]}
            exportable={true}
            exportFileName="przeglady"
            pageSize={25}
            emptyMessage="Brak przeglądów"
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="kalendarz" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <Button size="icon" variant="ghost" onClick={() => setCalendarMonth(prev => subMonths(prev, 1))} data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg" data-testid="text-calendar-month">
                {format(calendarMonth, "LLLL yyyy", { locale: pl })}
              </CardTitle>
              <Button size="icon" variant="ghost" onClick={() => setCalendarMonth(prev => addMonths(prev, 1))} data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-px">
                {["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"].map(day => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>
                ))}
                {Array.from({ length: calendarDays.paddingBefore }).map((_, i) => (
                  <div key={`pad-${i}`} className="min-h-[80px]" />
                ))}
                {calendarDays.days.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const dayInspections = inspectionsByDate[dateStr] || [];
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div
                      key={dateStr}
                      className={`min-h-[80px] border rounded-md p-1 ${isToday ? 'border-primary bg-primary/5' : 'border-border'}`}
                      data-testid={`calendar-day-${dateStr}`}
                    >
                      <div className={`text-xs font-medium mb-1 ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                        {format(day, "d")}
                      </div>
                      <div className="space-y-0.5">
                        {dayInspections.map(insp => {
                          const today = new Date().toISOString().split('T')[0];
                          const isOverdue = insp.nextDate < today && insp.status !== 'WYKONANY';
                          return (
                            <div
                              key={insp.id}
                              className={`text-[10px] leading-tight rounded px-1 py-0.5 truncate cursor-pointer ${
                                isOverdue ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                insp.status === 'WYKONANY' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              }`}
                              onClick={() => openEdit(insp)}
                              data-testid={`calendar-inspection-${insp.id}`}
                            >
                              {getTypeLabel(insp.inspectionType)} — {getApartmentName(insp.apartmentId)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t">
                {INSPECTION_TYPES.map(t => (
                  <div key={t.value} className="flex items-center gap-1 text-xs">
                    <div className={`w-2 h-2 rounded-full ${TYPE_COLORS[t.value]}`} />
                    <span>{t.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showDialog} onOpenChange={v => !v && closeDialog()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-inspection-form">
          <DialogHeader>
            <DialogTitle>{editId ? "Edytuj przegląd" : "Nowy przegląd techniczny"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Typ przeglądu *</Label>
              <Select value={form.inspectionType} onValueChange={v => setForm(f => ({ ...f, inspectionType: v }))}>
                <SelectTrigger data-testid="select-inspection-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSPECTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mieszkanie</Label>
              <Select value={form.apartmentId ? String(form.apartmentId) : "none"} onValueChange={v => setForm(f => ({ ...f, apartmentId: v === "none" ? null : Number(v) }))}>
                <SelectTrigger data-testid="select-apartment">
                  <SelectValue placeholder="Wybierz mieszkanie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Brak —</SelectItem>
                  {apartments.map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data następnego przeglądu *</Label>
                <Input
                  type="date"
                  value={form.nextDate}
                  onChange={e => setForm(f => ({ ...f, nextDate: e.target.value }))}
                  data-testid="input-next-date"
                />
              </div>
              <div>
                <Label>Data ostatniego przeglądu</Label>
                <Input
                  type="date"
                  value={form.lastDate}
                  onChange={e => setForm(f => ({ ...f, lastDate: e.target.value }))}
                  data-testid="input-last-date"
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Wykonawca</Label>
                <Input
                  value={form.contractor}
                  onChange={e => setForm(f => ({ ...f, contractor: e.target.value }))}
                  placeholder="Nazwa firmy / osoba"
                  data-testid="input-contractor"
                />
              </div>
              <div>
                <Label>Telefon wykonawcy</Label>
                <Input
                  value={form.contractorPhone}
                  onChange={e => setForm(f => ({ ...f, contractorPhone: e.target.value }))}
                  placeholder="Nr telefonu"
                  data-testid="input-contractor-phone"
                />
              </div>
            </div>
            <div>
              <Label>Koszt (PLN)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.cost}
                onChange={e => setForm(f => ({ ...f, cost: e.target.value }))}
                placeholder="0.00"
                data-testid="input-cost"
              />
            </div>
            <div>
              <Label>Cykliczność przeglądu</Label>
              <Select
                value={form.recurrenceMonths ? String(form.recurrenceMonths) : "none"}
                onValueChange={v => setForm(f => ({ ...f, recurrenceMonths: v === "none" ? null : parseInt(v) }))}
              >
                <SelectTrigger data-testid="select-recurrence">
                  <SelectValue placeholder="Brak cykliczności" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak cykliczności</SelectItem>
                  {RECURRENCE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Uwagi</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Dodatkowe informacje..."
                data-testid="input-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">Anuluj</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-inspection"
            >
              {(createMutation.isPending || updateMutation.isPending) ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent data-testid="dialog-confirm-delete">
          <DialogHeader>
            <DialogTitle>Potwierdź usunięcie</DialogTitle>
          </DialogHeader>
          <p>Czy na pewno chcesz usunąć ten przegląd techniczny?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} data-testid="button-cancel-delete">Anuluj</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Usuń
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
