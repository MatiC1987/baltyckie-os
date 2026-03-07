import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import GrafikEnhanced from "@/components/GrafikEnhanced";
import { useToast } from "@/hooks/use-toast";
import { Clock, Users, Calendar, FileText, MapPin, Key, Loader2, Check, X, ChevronLeft, ChevronRight, Trash2, Edit, Download, AlertCircle, Timer, TrendingUp } from "lucide-react";

type RCPTab = "dashboard" | "obecnosci" | "grafik" | "urlopy" | "raporty" | "lokalizacje" | "piny";

const TAB_ITEMS: { key: RCPTab; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: Clock },
  { key: "obecnosci", label: "Obecności", icon: Users },
  { key: "grafik", label: "Grafik", icon: Calendar },
  { key: "urlopy", label: "Urlopy", icon: FileText },
  { key: "raporty", label: "Raporty", icon: FileText },
  { key: "lokalizacje", label: "Lokalizacje", icon: MapPin },
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

function RCPLokalizacje() {
  const { data: locations = [] } = useQuery({
    queryKey: ["/api/recepcja/rcp/locations"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/rcp/locations"); return r.json(); },
  });

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/50">
          <th className="p-2 text-left">Nazwa</th>
          <th className="p-2 text-left">Szerokość</th>
          <th className="p-2 text-left">Długość</th>
          <th className="p-2 text-right">Promień (m)</th>
        </tr></thead>
        <tbody>
          {locations.map((l: any) => (
            <tr key={l.id} className="border-b">
              <td className="p-2 font-medium">{l.name}</td>
              <td className="p-2">{l.latitude || '-'}</td>
              <td className="p-2">{l.longitude || '-'}</td>
              <td className="p-2 text-right">{l.gpsRadius || 200}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function RCPPiny() {
  const { toast } = useToast();
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
    },
  });

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
              <td className="p-2 text-center font-mono">{e.pin || '-'}</td>
              <td className="p-2 text-center">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setPinMutation.mutate({ id: e.id, pin: generatePin() })}>
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