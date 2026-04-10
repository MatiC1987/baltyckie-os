import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import GrafikEnhanced from "@/components/GrafikEnhanced";
import { useToast } from "@/hooks/use-toast";
import { Clock, Users, Calendar, FileText, MapPin, Key, Loader2, Check, X, ChevronLeft, ChevronRight, Trash2, Edit, Download, AlertCircle, Timer, TrendingUp, Pencil, Navigation, CheckCircle, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type RCPTab = "dashboard" | "obecnosci" | "grafik" | "urlopy" | "raporty" | "lokalizacje" | "gps" | "piny";

const TAB_ITEMS: { key: RCPTab; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: Clock },
  { key: "obecnosci", label: "Obecności", icon: Users },
  { key: "grafik", label: "Grafik", icon: Calendar },
  { key: "urlopy", label: "Urlopy", icon: FileText },
  { key: "raporty", label: "Raporty", icon: FileText },
  { key: "lokalizacje", label: "Lokalizacje", icon: MapPin },
  { key: "gps", label: "Śledzenie GPS", icon: Navigation },
  { key: "piny", label: "PINy", icon: Key },
];

export default function RecepcjaRCP() {
  const [tab, setTab] = useState<RCPTab>("dashboard");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-rcp-title">RCP - Rejestrator Czasu Pracy</h1>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {TAB_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <Button
              key={item.key}
              variant={tab === item.key ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(item.key)}
              className="whitespace-nowrap"
              data-testid={`tab-rcp-${item.key}`}
            >
              <Icon className="h-3.5 w-3.5 mr-1" /> {item.label}
            </Button>
          );
        })}
      </div>

      {tab === "dashboard" && <RCPDashboard />}
      {tab === "obecnosci" && <RCPObecnosci />}
      {tab === "grafik" && <RCPGrafik />}
      {tab === "urlopy" && <RCPUrlopy />}
      {tab === "raporty" && <RCPRaporty />}
      {tab === "lokalizacje" && <RCPLokalizacje />}
      {tab === "gps" && <RCPGpsTracking />}
      {tab === "piny" && <RCPPiny />}
    </div>
  );
}

function RCPDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: employees = [] } = useQuery({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/rcp/employees"); return r.json(); },
  });
  const { data: entries = [] } = useQuery({
    queryKey: [`/api/recepcja/rcp/time-entries?date=${today}`],
    queryFn: async () => { const r = await recepcjaFetch("GET", `/api/recepcja/rcp/time-entries?date=${today}`); return r.json(); },
  });

  const working = entries.filter((e: any) => e.clockIn && !e.clockOut);
  const onBreak = entries.filter((e: any) => e.breakStart && !e.breakEnd);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-2xl font-bold text-green-600">{working.length}</div><div className="text-sm text-muted-foreground">Pracujących</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold text-orange-600">{onBreak.length}</div><div className="text-sm text-muted-foreground">Na przerwie</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold">{employees.length}</div><div className="text-sm text-muted-foreground">Pracowników</div></Card>
      </div>
      <Card className="p-4">
        <h3 className="font-semibold mb-2">Dzisiejsze wpisy</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="p-2 text-left">Pracownik</th>
              <th className="p-2 text-left">Wejście</th>
              <th className="p-2 text-left">Wyjście</th>
              <th className="p-2 text-center">Status</th>
            </tr></thead>
            <tbody>
              {entries.map((e: any) => {
                const emp = employees.find((em: any) => em.id === e.employeeId);
                return (
                  <tr key={e.id} className="border-b">
                    <td className="p-2">{emp ? `${emp.firstName} ${emp.lastName}` : `#${e.employeeId}`}</td>
                    <td className="p-2">{e.clockIn ? new Date(e.clockIn).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="p-2">{e.clockOut ? new Date(e.clockOut).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                    <td className="p-2 text-center">
                      <Badge variant={e.clockOut ? 'secondary' : e.breakStart && !e.breakEnd ? 'outline' : 'default'}>
                        {e.clockOut ? 'Zakończone' : e.breakStart && !e.breakEnd ? 'Przerwa' : 'Pracuje'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {entries.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Brak wpisów</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function RCPObecnosci() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editClockIn, setEditClockIn] = useState("");
  const [editClockOut, setEditClockOut] = useState("");
  const { toast } = useToast();

  const { data: employees = [] } = useQuery({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/rcp/employees"); return r.json(); },
  });
  const { data: entries = [] } = useQuery({
    queryKey: [`/api/recepcja/rcp/time-entries?date=${date}`],
    queryFn: async () => { const r = await recepcjaFetch("GET", `/api/recepcja/rcp/time-entries?date=${date}`); return r.json(); },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      const r = await recepcjaFetch("DELETE", `/api/recepcja/rcp/time-entries/${id}`);
      if (!r.ok) throw new Error("Błąd usuwania");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/recepcja/rcp/time-entries?date=${date}`] });
      toast({ title: "Wpis usunięty" });
      setSheetOpen(false);
      setSelectedEntry(null);
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/rcp/time-entries/${id}`, data);
      if (!r.ok) throw new Error("Błąd zapisu");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/recepcja/rcp/time-entries?date=${date}`] });
      toast({ title: "Wpis zaktualizowany" });
      setEditMode(false);
    },
  });

  const changeDate = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().slice(0, 10));
  };

  const openDetail = (entry: any) => {
    setSelectedEntry(entry);
    setEditMode(false);
    if (entry.clockIn) setEditClockIn(new Date(entry.clockIn).toTimeString().slice(0, 5));
    if (entry.clockOut) setEditClockOut(new Date(entry.clockOut).toTimeString().slice(0, 5));
    setSheetOpen(true);
  };

  const saveEdit = () => {
    if (!selectedEntry) return;
    const clockIn = editClockIn ? new Date(`${date}T${editClockIn}:00`) : undefined;
    const clockOut = editClockOut ? new Date(`${date}T${editClockOut}:00`) : undefined;
    updateMut.mutate({ id: selectedEntry.id, data: { clockIn, clockOut } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDate(-1)} data-testid="button-prev-day"><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" data-testid="input-date" />
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDate(1)} data-testid="button-next-day"><ChevronRight className="h-4 w-4" /></Button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="p-2 text-left">Pracownik</th>
            <th className="p-2 text-left">Wejście</th>
            <th className="p-2 text-left">Wyjście</th>
            <th className="p-2 text-left">Przerwa</th>
            <th className="p-2 text-center">Poza strefą</th>
            <th className="p-2 text-center">Status</th>
          </tr></thead>
          <tbody>
            {entries.map((e: any) => {
              const emp = employees.find((em: any) => em.id === e.employeeId);
              return (
                <tr key={e.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => openDetail(e)} data-testid={`row-entry-${e.id}`}>
                  <td className="p-2 font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : `#${e.employeeId}`}</td>
                  <td className="p-2">{e.clockIn ? new Date(e.clockIn).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="p-2">{e.clockOut ? new Date(e.clockOut).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="p-2">{e.totalBreakMinutes ? `${e.totalBreakMinutes} min` : '-'}</td>
                  <td className="p-2 text-center">{e.isOutsideZone ? <Badge variant="destructive">Tak</Badge> : '-'}</td>
                  <td className="p-2 text-center">
                    <Badge variant={e.status === 'ZAAKCEPTOWANA' || e.status === 'ZAKONCZONA' ? 'default' : e.status === 'ODRZUCONA' ? 'destructive' : 'secondary'}>
                      {e.status || (e.clockOut ? 'Zakończone' : 'W trakcie')}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Brak wpisów</td></tr>}
          </tbody>
        </table>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[450px]">
          <SheetHeader>
            <SheetTitle>Szczegóły wpisu</SheetTitle>
          </SheetHeader>
          {selectedEntry && (() => {
            const emp = employees.find((em: any) => em.id === selectedEntry.employeeId);
            return (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pracownik</span>
                    <span className="font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : `#${selectedEntry.employeeId}`}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Data</span>
                    <span>{selectedEntry.date}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant="secondary">{selectedEntry.status || 'Brak'}</Badge>
                  </div>
                  {selectedEntry.isOutsideZone && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Poza strefą</span>
                      <Badge variant="destructive">Tak</Badge>
                    </div>
                  )}
                </div>

                {editMode ? (
                  <div className="space-y-3 border-t pt-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Wejście</label>
                      <Input type="time" value={editClockIn} onChange={e => setEditClockIn(e.target.value)} data-testid="input-edit-clock-in" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Wyjście</label>
                      <Input type="time" value={editClockOut} onChange={e => setEditClockOut(e.target.value)} data-testid="input-edit-clock-out" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={updateMut.isPending} data-testid="button-save-edit">
                        <Check className="h-4 w-4 mr-1" /> Zapisz
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditMode(false)} data-testid="button-cancel-edit">
                        Anuluj
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 border-t pt-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Wejście</span>
                      <span>{selectedEntry.clockIn ? new Date(selectedEntry.clockIn).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Wyjście</span>
                      <span>{selectedEntry.clockOut ? new Date(selectedEntry.clockOut).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 border-t pt-3">
                  {!editMode && (
                    <Button size="sm" variant="outline" onClick={() => setEditMode(true)} data-testid="button-edit-entry">
                      <Edit className="h-4 w-4 mr-1" /> Edytuj godziny
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate(selectedEntry.id)} disabled={deleteMut.isPending} data-testid="button-delete-entry">
                    <Trash2 className="h-4 w-4 mr-1" /> Usuń
                  </Button>
                </div>

                {selectedEntry.note && (
                  <div className="border-t pt-3">
                    <span className="text-xs text-muted-foreground">Notatka pracownika</span>
                    <p className="text-sm mt-1">{selectedEntry.note}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RCPGrafik() {
  return <GrafikEnhanced apiPrefix="/api/recepcja/rcp" fetchFn={recepcjaFetch} />;
}

function RCPUrlopy() {
  const { toast } = useToast();
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/rcp/leave-requests"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/rcp/leave-requests"); return r.json(); },
  });
  const { data: employees = [] } = useQuery({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/rcp/employees"); return r.json(); },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/rcp/leave-requests/${id}/approve`);
      if (!r.ok) throw new Error((await r.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/rcp/leave-requests"] });
      toast({ title: "Zaakceptowano" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/rcp/leave-requests/${id}/reject`);
      if (!r.ok) throw new Error((await r.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/rcp/leave-requests"] });
      toast({ title: "Odrzucono" });
    },
  });

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/50">
          <th className="p-2 text-left">Pracownik</th>
          <th className="p-2 text-left">Typ</th>
          <th className="p-2 text-left">Od</th>
          <th className="p-2 text-left">Do</th>
          <th className="p-2 text-center">Dni</th>
          <th className="p-2 text-center">Status</th>
          <th className="p-2 text-center">Akcje</th>
        </tr></thead>
        <tbody>
          {requests.map((r: any) => {
            const emp = employees.find((e: any) => e.id === r.employeeId);
            return (
              <tr key={r.id} className="border-b">
                <td className="p-2">{emp ? `${emp.firstName} ${emp.lastName}` : `#${r.employeeId}`}</td>
                <td className="p-2">{r.type}</td>
                <td className="p-2">{r.startDate}</td>
                <td className="p-2">{r.endDate}</td>
                <td className="p-2 text-center">{r.days}</td>
                <td className="p-2 text-center">
                  <Badge variant={r.status === 'ZAAKCEPTOWANY' ? 'default' : r.status === 'ODRZUCONY' ? 'destructive' : 'secondary'}>
                    {r.status}
                  </Badge>
                </td>
                <td className="p-2 text-center">
                  {r.status === 'OCZEKUJACY' && (
                    <div className="flex gap-1 justify-center">
                      <Button variant="outline" size="icon" className="h-7 w-7 text-green-600" onClick={() => approveMutation.mutate(r.id)}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="icon" className="h-7 w-7 text-red-600" onClick={() => rejectMutation.mutate(r.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {requests.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-muted-foreground">Brak wniosków</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function RCPRaporty() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: report = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/recepcja/rcp/monthly-report", month, year],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", `/api/recepcja/rcp/monthly-report?month=${month}&year=${year}`);
      if (!r.ok) return [];
      return r.json();
    },
  });

  const totals = useMemo(() => {
    const t = { totalHours: 0, lateCount: 0, overtimeHours: 0, daysWorked: 0 };
    report.forEach((r: any) => {
      t.totalHours += r.totalHours || 0;
      t.lateCount += r.lateCount || 0;
      t.overtimeHours += r.overtimeHours || 0;
      t.daysWorked += r.daysWorked || 0;
    });
    return t;
  }, [report]);

  const changeMonth = (offset: number) => {
    let m = month + offset;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  };

  const monthNames = [
    "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
    "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
  ];

  const exportCSV = () => {
    const header = "Pracownik;Dni pracy;Godziny;Spóźnienia;Nadgodziny;Zaplanowane dni\n";
    const rows = report.map((r: any) =>
      `${r.employeeName};${r.daysWorked};${r.totalHours};${r.lateCount};${r.overtimeHours};${r.scheduledDays}`
    ).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `raport-rcp-${year}-${String(month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => changeMonth(-1)} data-testid="button-report-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm min-w-[140px] text-center" data-testid="text-report-month">
            {monthNames[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={() => changeMonth(1)} data-testid="button-report-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} data-testid="button-export-csv">
          <Download className="h-4 w-4 mr-1" /> Eksport CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Timer className="h-3.5 w-3.5" /> Łączne godziny
          </div>
          <div className="text-xl font-bold" data-testid="text-report-total-hours">{totals.totalHours.toFixed(1)}h</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Calendar className="h-3.5 w-3.5" /> Dni pracy
          </div>
          <div className="text-xl font-bold" data-testid="text-report-total-days">{totals.daysWorked}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <AlertCircle className="h-3.5 w-3.5 text-red-500" /> Spóźnienia
          </div>
          <div className="text-xl font-bold text-red-600" data-testid="text-report-total-lates">{totals.lateCount}</div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <TrendingUp className="h-3.5 w-3.5 text-orange-500" /> Nadgodziny
          </div>
          <div className="text-xl font-bold text-orange-600" data-testid="text-report-total-overtime">{totals.overtimeHours.toFixed(1)}h</div>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Ładowanie raportu...
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">Pracownik</th>
                <th className="p-2 text-center">Dni pracy</th>
                <th className="p-2 text-center">Zaplanowane</th>
                <th className="p-2 text-center">Godziny</th>
                <th className="p-2 text-center">Spóźnienia</th>
                <th className="p-2 text-center">Nadgodziny</th>
              </tr>
            </thead>
            <tbody>
              {report.map((r: any) => (
                <tr key={r.employeeId} className="border-b" data-testid={`row-report-${r.employeeId}`}>
                  <td className="p-2 font-medium">{r.employeeName}</td>
                  <td className="p-2 text-center">{r.daysWorked}</td>
                  <td className="p-2 text-center">{r.scheduledDays}</td>
                  <td className="p-2 text-center">{r.totalHours.toFixed(1)}h</td>
                  <td className="p-2 text-center">
                    {r.lateCount > 0 ? (
                      <Badge variant="destructive" className="text-xs no-default-hover-elevate no-default-active-elevate">{r.lateCount}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="p-2 text-center">
                    {r.overtimeHours > 0 ? (
                      <Badge variant="outline" className="text-xs no-default-hover-elevate no-default-active-elevate">{r.overtimeHours.toFixed(1)}h</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                </tr>
              ))}
              {report.length === 0 && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">Brak danych dla wybranego miesiąca</td></tr>
              )}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function RcpMapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function RcpMapFlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 14);
  }, [center[0], center[1]]);
  return null;
}

function RCPLokalizacje() {
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/rcp/locations"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/rcp/locations"); return r.json(); },
  });
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editRadius, setEditRadius] = useState(200);
  const [mapCenter, setMapCenter] = useState<[number, number]>([54.44, 17.03]);

  const updateGpsMut = useMutation({
    mutationFn: async ({ id, latitude, longitude, gpsRadius }: { id: number; latitude: string; longitude: string; gpsRadius: number }) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/rcp/locations/${id}/gps`, { latitude, longitude, gpsRadius });
      if (!r.ok) {
        const data = await r.json();
        throw new Error(data.message || "Błąd zapisu GPS");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/rcp/locations"] });
      toast({ title: "Lokalizacja GPS zaktualizowana" });
      setEditingId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Błąd zapisu GPS",
        description: error.message || "Nie udało się zapisać lokalizacji GPS",
        variant: "destructive",
      });
    },
  });

  const locsWithGps = useMemo(() => {
    return locations.filter((l: any) => l.latitude && l.longitude);
  }, [locations]);

  useEffect(() => {
    if (locsWithGps.length > 0) {
      setMapCenter([Number(locsWithGps[0].latitude), Number(locsWithGps[0].longitude)]);
    }
  }, [locsWithGps.length]);

  const handleMapClick = (lat: number, lng: number) => {
    if (editingId !== null) {
      setEditLat(lat.toFixed(7));
      setEditLng(lng.toFixed(7));
    }
  };

  const startEdit = (loc: any) => {
    setEditingId(loc.id);
    setEditLat(loc.latitude || "");
    setEditLng(loc.longitude || "");
    setEditRadius(loc.gpsRadius || 200);
    if (loc.latitude && loc.longitude) {
      setMapCenter([Number(loc.latitude), Number(loc.longitude)]);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md overflow-hidden border" style={{ height: 400 }}>
        <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <RcpMapFlyTo center={mapCenter} />
          <RcpMapClickHandler onClick={handleMapClick} />
          {locsWithGps.map((loc: any) => (
            <Marker key={loc.id} position={[Number(loc.latitude), Number(loc.longitude)]}>
            </Marker>
          ))}
          {locsWithGps.map((loc: any) => (
            <Circle
              key={`circle-${loc.id}`}
              center={[Number(loc.latitude), Number(loc.longitude)]}
              radius={loc.gpsRadius || 200}
              pathOptions={{ color: "#3b82f6", fillOpacity: 0.15 }}
            />
          ))}
          {editingId !== null && editLat && editLng && (
            <>
              <Marker position={[Number(editLat), Number(editLng)]} />
              <Circle
                center={[Number(editLat), Number(editLng)]}
                radius={editRadius}
                pathOptions={{ color: "#ef4444", fillOpacity: 0.2 }}
              />
            </>
          )}
        </MapContainer>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nazwa</TableHead>
                <TableHead>Adres</TableHead>
                <TableHead>Szerokość</TableHead>
                <TableHead>Długość</TableHead>
                <TableHead>Promień (m)</TableHead>
                <TableHead>Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((loc: any) => (
                <TableRow key={loc.id} data-testid={`row-recepcja-location-${loc.id}`}>
                  <TableCell className="font-medium text-sm">{loc.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{loc.address || "—"}</TableCell>
                  {editingId === loc.id ? (
                    <>
                      <TableCell>
                        <Input
                          value={editLat}
                          onChange={(e) => setEditLat(e.target.value)}
                          className="w-28"
                          placeholder="54.4400000"
                          data-testid="input-recepcja-edit-lat"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editLng}
                          onChange={(e) => setEditLng(e.target.value)}
                          className="w-28"
                          placeholder="17.0300000"
                          data-testid="input-recepcja-edit-lng"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Slider
                            value={[editRadius]}
                            onValueChange={([v]) => setEditRadius(v)}
                            min={50}
                            max={2000}
                            step={10}
                            className="w-24"
                            data-testid="slider-recepcja-radius"
                          />
                          <span className="text-sm w-12 text-right">{editRadius}m</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => updateGpsMut.mutate({ id: loc.id, latitude: editLat, longitude: editLng, gpsRadius: editRadius })}
                            disabled={updateGpsMut.isPending || !editLat || !editLng}
                            data-testid={`button-recepcja-save-gps-${loc.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" onClick={() => setEditingId(null)} data-testid={`button-recepcja-cancel-gps-${loc.id}`}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-sm">{loc.latitude || "—"}</TableCell>
                      <TableCell className="text-sm">{loc.longitude || "—"}</TableCell>
                      <TableCell className="text-sm">{loc.gpsRadius || 200}m</TableCell>
                      <TableCell>
                        <Button size="icon" variant="outline" onClick={() => startEdit(loc)} data-testid={`button-recepcja-edit-gps-${loc.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

interface LocationLog {
  id: number;
  employeeId: number;
  latitude: string;
  longitude: string;
  accuracy: string;
  timestamp: string;
  distanceFromZone: string | null;
  locationName?: string;
}

function RCPGpsTracking() {
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", "/api/recepcja/rcp/employees");
      return r.json();
    },
  });

  const { data: rcpLocations = [] } = useQuery<any[]>({
    queryKey: ["/api/recepcja/rcp/locations"],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", "/api/recepcja/rcp/locations");
      return r.json();
    },
  });

  const { data: logs = [], isLoading } = useQuery<LocationLog[]>({
    queryKey: ["/api/recepcja/rcp/location-logs", selectedEmployee, date],
    enabled: !!selectedEmployee && !!date,
    queryFn: async () => {
      const r = await recepcjaFetch("GET", `/api/recepcja/rcp/location-logs?employeeId=${selectedEmployee}&date=${date}`);
      if (!r.ok) throw new Error((await r.json()).message || "Błąd pobierania logów GPS");
      return r.json();
    },
  });

  const { data: summary } = useQuery<{ totalEmployees: number; totalLogs: number; outsideZone: number }>({
    queryKey: ["/api/recepcja/rcp/location-logs/summary", date],
    enabled: !!date,
    queryFn: async () => {
      const r = await recepcjaFetch("GET", `/api/recepcja/rcp/location-logs/summary?date=${date}`);
      if (!r.ok) throw new Error((await r.json()).message || "Błąd pobierania podsumowania GPS");
      return r.json();
    },
  });

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) mapRef.current.remove();

    const map = L.map(mapContainerRef.current!, { center: [54.35, 18.65], zoom: 13 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
    mapRef.current = map;

    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.remove(); polylineRef.current = null; }
    circlesRef.current.forEach(c => c.remove());
    circlesRef.current = [];

    rcpLocations.forEach((loc: any) => {
      if (loc.latitude && loc.longitude && loc.gpsRadius) {
        const circle = L.circle([parseFloat(loc.latitude), parseFloat(loc.longitude)], {
          radius: loc.gpsRadius, color: "#3b82f6", fillColor: "#3b82f680", fillOpacity: 0.15, weight: 2, dashArray: "5,5",
        }).addTo(mapRef.current);
        circle.bindTooltip(loc.name, { permanent: false });
        circlesRef.current.push(circle);
      }
    });

    if (logs.length === 0) return;

    const points: [number, number][] = logs.map(l => [parseFloat(l.latitude), parseFloat(l.longitude)]);

    logs.forEach((log, idx) => {
      const lat = parseFloat(log.latitude);
      const lng = parseFloat(log.longitude);
      const dist = log.distanceFromZone ? parseFloat(log.distanceFromZone) : null;
      const isInZone = dist !== null && dist <= 0;
      const time = new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      const isLast = idx === logs.length - 1;

      const iconHtml = `<div style="width:${isLast ? 18 : 14}px;height:${isLast ? 18 : 14}px;border-radius:50%;background:${isInZone ? '#22c55e' : '#ef4444'};border:${isLast ? 3 : 2}px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`;
      const icon = L.divIcon({ html: iconHtml, className: "", iconSize: [isLast ? 18 : 14, isLast ? 18 : 14], iconAnchor: [isLast ? 9 : 7, isLast ? 9 : 7] });

      const marker = L.marker([lat, lng], { icon }).addTo(mapRef.current);
      const acc = log.accuracy ? parseFloat(log.accuracy) : null;
      const accStr = acc !== null && isFinite(acc) ? `${acc.toFixed(1)}m` : '—';
      marker.bindPopup(`<div style="font-size:13px"><b>${time}</b><br/>Dokładność: ${accStr}<br/>${dist !== null ? `Odległość od strefy: ${dist <= 0 ? '<span style="color:green">W strefie</span>' : `<span style="color:red">${dist.toFixed(0)}m</span>`}` : 'Brak strefy'}${log.locationName ? `<br/>Lokalizacja: ${log.locationName}` : ''}</div>`);
      markersRef.current.push(marker);
    });

    if (points.length > 1) {
      polylineRef.current = L.polyline(points, { color: "#6366f1", weight: 2, opacity: 0.6, dashArray: "6,4" }).addTo(mapRef.current);
    }

    mapRef.current.fitBounds(L.latLngBounds(points).pad(0.2));
  }, [logs, rcpLocations]);

  const inZoneCount = logs.filter(l => l.distanceFromZone && parseFloat(l.distanceFromZone) <= 0).length;
  const outZoneCount = logs.filter(l => l.distanceFromZone && parseFloat(l.distanceFromZone) > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Navigation className="h-4 w-4" />
            Logów GPS dziś
          </div>
          <div className="text-2xl font-bold" data-testid="text-recepcja-total-logs">{summary?.totalLogs ?? 0}</div>
          <div className="text-xs text-muted-foreground">{summary?.totalEmployees ?? 0} pracowników</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-1">
            <CheckCircle className="h-4 w-4" />
            W strefie
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-recepcja-in-zone">{inZoneCount}</div>
          <div className="text-xs text-muted-foreground">z {logs.length} logów wybranego pracownika</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-1">
            <AlertTriangle className="h-4 w-4" />
            Poza strefą
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-recepcja-out-zone">{outZoneCount}</div>
          {summary && summary.outsideZone > 0 && (
            <div className="text-xs text-red-500">{summary.outsideZone} logów poza strefą ogółem</div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground mb-1 block">Pracownik</label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger data-testid="select-recepcja-employee-gps">
                <SelectValue placeholder="Wybierz pracownika" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp: any) => (
                  <SelectItem key={emp.id} value={String(emp.id)}>
                    {emp.firstName} {emp.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" data-testid="input-recepcja-gps-date" />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div ref={mapContainerRef} className="h-[400px] w-full" data-testid="map-recepcja-gps-tracking" style={{ zIndex: 1 }} />
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && logs.length > 0 && (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="p-2 text-left">Czas</th>
              <th className="p-2 text-left">Współrzędne</th>
              <th className="p-2 text-right">Dokładność</th>
              <th className="p-2 text-center">Status strefy</th>
              <th className="p-2 text-right">Odległość</th>
            </tr></thead>
            <tbody>
              {logs.map((log) => {
                const dist = log.distanceFromZone ? parseFloat(log.distanceFromZone) : null;
                const isIn = dist !== null && dist <= 0;
                return (
                  <tr key={log.id} className="border-b hover:bg-muted/30" data-testid={`row-recepcja-gps-log-${log.id}`}>
                    <td className="p-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </div>
                    </td>
                    <td className="p-2 font-mono text-xs">
                      {parseFloat(log.latitude).toFixed(5)}, {parseFloat(log.longitude).toFixed(5)}
                    </td>
                    <td className="p-2 text-right">{log.accuracy && isFinite(parseFloat(log.accuracy)) ? `${parseFloat(log.accuracy).toFixed(1)}m` : '—'}</td>
                    <td className="p-2 text-center">
                      {dist !== null ? (
                        <Badge variant={isIn ? "default" : "destructive"} className={isIn ? "bg-green-600" : ""}>
                          {isIn ? "W strefie" : "Poza strefą"}
                        </Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-2 text-right">{dist !== null ? (dist <= 0 ? "0m" : `${dist.toFixed(0)}m`) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {!isLoading && selectedEmployee && logs.length === 0 && (
        <Card className="p-8 text-center">
          <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground" data-testid="text-recepcja-no-gps-logs">Brak logów GPS dla wybranego pracownika w tym dniu</p>
        </Card>
      )}
    </div>
  );
}

function RCPPiny() {
  const { toast } = useToast();
  const [visiblePinId, setVisiblePinId] = useState<number | null>(null);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/rcp/employees-pins"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/rcp/employees-pins"); return r.json(); },
  });

  const setPinMutation = useMutation({
    mutationFn: async ({ id, pin }: { id: number; pin: string }) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/rcp/employees/${id}/pin`, { pin });
      if (!r.ok) throw new Error((await r.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/rcp/employees-pins"] });
      toast({ title: "PIN ustawiony" });
      setVisiblePinId(null);
      setRevealedPin(null);
    },
  });

  const togglePinVisibility = async (empId: number) => {
    if (visiblePinId === empId) {
      setVisiblePinId(null);
      setRevealedPin(null);
      return;
    }
    try {
      const r = await recepcjaFetch("GET", `/api/recepcja/rcp/employees/${empId}/pin`);
      const data = await r.json();
      setVisiblePinId(empId);
      setRevealedPin(data.pin);
    } catch {
      toast({ title: "Błąd pobierania PINu", variant: "destructive" });
    }
  };

  const generatePin = () => String(Math.floor(100000 + Math.random() * 900000));

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/50">
          <th className="p-2 text-left">Pracownik</th>
          <th className="p-2 text-center">PIN</th>
          <th className="p-2 text-center">Akcje</th>
        </tr></thead>
        <tbody>
          {employees.map((e: any) => (
            <tr key={e.id} className="border-b">
              <td className="p-2 font-medium">{e.firstName} {e.lastName}</td>
              <td className="p-2 text-center font-mono">
                <div className="flex items-center justify-center gap-1">
                  <span data-testid={`text-pin-${e.id}`}>{visiblePinId === e.id ? (revealedPin || '-') : (e.pin || '-')}</span>
                  {e.pin && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => togglePinVisibility(e.id)} data-testid={`button-toggle-pin-${e.id}`}>
                      {visiblePinId === e.id ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                </div>
              </td>
              <td className="p-2 text-center">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setPinMutation.mutate({ id: e.id, pin: generatePin() })} data-testid={`button-generate-pin-${e.id}`}>
                  Generuj PIN
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}