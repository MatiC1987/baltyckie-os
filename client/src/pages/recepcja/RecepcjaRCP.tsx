import { useState, useMemo, useEffect, useRef, type ReactNode } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import GrafikEnhanced from "@/components/GrafikEnhanced";
import { useToast } from "@/hooks/use-toast";
import { Clock, Users, Calendar, FileText, MapPin, Key, Loader2, Check, X, ChevronLeft, ChevronRight, Trash2, Edit, Download, AlertCircle, Timer, TrendingUp, Pencil, Navigation, CheckCircle, AlertTriangle, Eye, EyeOff, BarChart3, ArrowUpDown, Search, Award } from "lucide-react";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

type RCPTab = "dashboard" | "obecnosci" | "grafik" | "urlopy" | "raporty" | "lokalizacje" | "gps" | "piny" | "statystyki";

const TAB_ITEMS: { key: RCPTab; label: string; icon: any }[] = [
  { key: "dashboard", label: "Dashboard", icon: Clock },
  { key: "obecnosci", label: "Obecności", icon: Users },
  { key: "grafik", label: "Grafik", icon: Calendar },
  { key: "urlopy", label: "Urlopy", icon: FileText },
  { key: "raporty", label: "Raporty", icon: FileText },
  { key: "lokalizacje", label: "Lokalizacje", icon: MapPin },
  { key: "gps", label: "Śledzenie GPS", icon: Navigation },
  { key: "piny", label: "PINy", icon: Key },
  { key: "statystyki", label: "Statystyki", icon: BarChart3 },
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
      {tab === "statystyki" && <RCPStatystyki />}
    </div>
  );
}

function RCPDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [noteValues, setNoteValues] = useState<Record<number, string>>({});
  const { toast } = useToast();

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/rcp/employees"); return r.json(); },
  });
  const { data: entries = [] } = useQuery<any[]>({
    queryKey: [`/api/recepcja/rcp/time-entries?date=${today}`],
    queryFn: async () => { const r = await recepcjaFetch("GET", `/api/recepcja/rcp/time-entries?date=${today}`); return r.json(); },
  });
  const { data: perEmployee = [] } = useQuery<PerEmployeeGpsData[]>({
    queryKey: ["/api/recepcja/rcp/location-logs/per-employee", today],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", `/api/recepcja/rcp/location-logs/per-employee?date=${today}`);
      return r.json();
    },
  });
  const { data: dashData } = useQuery<any>({
    queryKey: ["/api/recepcja/rcp/dashboard"],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", "/api/recepcja/rcp/dashboard");
      return r.json();
    },
  });

  const approveMut = useMutation({
    mutationFn: async ({ id, adminNote }: { id: number; adminNote?: string }) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/rcp/time-entries/${id}/approve`, { adminNote });
      if (!r.ok) throw new Error((await r.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/rcp/dashboard"] });
      toast({ title: "Wpis zaakceptowany" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd akceptacji", description: err.message, variant: "destructive" });
    },
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, adminNote }: { id: number; adminNote?: string }) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/rcp/time-entries/${id}/reject`, { adminNote });
      if (!r.ok) throw new Error((await r.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/rcp/dashboard"] });
      toast({ title: "Wpis odrzucony" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd odrzucenia", description: err.message, variant: "destructive" });
    },
  });

  const working = entries.filter((e: any) => e.clockIn && !e.clockOut);
  const onBreak = entries.filter((e: any) => e.breakStart && !e.breakEnd);
  const gpsDataMap = new Map(perEmployee.map(d => [d.employeeId, d]));
  const selectedEntry = selectedEmployee ? entries.find((e: any) => e.employeeId === selectedEmployee.id) : null;

  const {
    pendingLeavesCount = 0, missingSchedules = [], lateToday = [], overtimeYesterday = [],
    pendingEntries = [],
  } = dashData || {};

  const alertCount = pendingLeavesCount + missingSchedules.length + lateToday.length + overtimeYesterday.length;

  const getStatus = (emp: any) => {
    const entry = entries.find((e: any) => e.employeeId === emp.id);
    if (!entry || !entry.clockIn) return { label: "Nieobecny", variant: "secondary" as const, green: false };
    if (entry.clockOut) return { label: "Zakończył", variant: "secondary" as const, green: false };
    if (entry.breakStart && !entry.breakEnd) return { label: "Przerwa", variant: "outline" as const, green: false };
    return { label: "Pracuje", variant: "default" as const, green: true };
  };

  const fmt = (ts: string | null) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  };

  const calcDuration = (entry: any) => {
    if (!entry?.clockIn) return "—";
    const start = new Date(entry.clockIn).getTime();
    const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
    const breakMs = (entry.breakStart && entry.breakEnd)
      ? new Date(entry.breakEnd).getTime() - new Date(entry.breakStart).getTime()
      : 0;
    const diffMs = Math.max(0, end - start - breakMs);
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    return `${h}h ${m}min`;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4"><div className="text-2xl font-bold text-green-600">{working.length}</div><div className="text-sm text-muted-foreground">Pracujących</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold text-orange-600">{onBreak.length}</div><div className="text-sm text-muted-foreground">Na przerwie</div></Card>
        <Card className="p-4"><div className="text-2xl font-bold">{employees.length}</div><div className="text-sm text-muted-foreground">Pracowników</div></Card>
      </div>

      {alertCount > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Powiadomienia ({alertCount})
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pendingLeavesCount > 0 && (
              <Card className="border-amber-200 dark:border-amber-800" data-testid="alert-pending-leaves">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Urlopy</Badge>
                    <span className="font-medium text-sm">Nierozpatrzone wnioski urlopowe</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{pendingLeavesCount} {pendingLeavesCount === 1 ? "wniosek oczekuje" : "wniosków oczekuje"} na rozpatrzenie</p>
                </CardContent>
              </Card>
            )}
            {lateToday.length > 0 && (
              <Card className="border-red-200 dark:border-red-800" data-testid="alert-late-today">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive">Spóźnienia</Badge>
                    <span className="font-medium text-sm">Spóźnienia dzisiaj</span>
                  </div>
                  <div className="space-y-1">
                    {lateToday.map((lt: any, i: number) => (
                      <p key={i} className="text-sm text-muted-foreground">
                        {lt.employee.firstName} {lt.employee.lastName}: planowane {lt.scheduledStart}, {lt.actualStart ? `przyszedł ${lt.actualStart}` : "brak wejścia"} ({lt.lateMinutes} min)
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {overtimeYesterday.length > 0 && (
              <Card className="border-blue-200 dark:border-blue-800" data-testid="alert-overtime-yesterday">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Nadgodziny</Badge>
                    <span className="font-medium text-sm">Nadgodziny wczoraj</span>
                  </div>
                  <div className="space-y-1">
                    {overtimeYesterday.map((ot: any, i: number) => (
                      <p key={i} className="text-sm text-muted-foreground">
                        {ot.employee.firstName} {ot.employee.lastName}: {Math.floor(ot.workMinutes / 60)}h {ot.workMinutes % 60}m ({ot.overtimeMinutes} min nadgodzin)
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {missingSchedules.length > 0 && (
              <Card className="border-orange-200 dark:border-orange-800" data-testid="alert-missing-schedules">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Grafik</Badge>
                    <span className="font-medium text-sm">Brak grafiku na dzisiaj</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {missingSchedules.map((e: any) => `${e.firstName} ${e.lastName}`).join(", ")}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {pendingEntries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-base font-semibold">Wpisy warunkowe do akceptacji</h3>
          {pendingEntries.map((entry: any) => (
            <Card key={entry.id} data-testid={`card-pending-${entry.id}`}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium">{entry.employee?.firstName} {entry.employee?.lastName}</span>
                  <Badge variant="destructive">Warunkowa</Badge>
                  <span className="text-sm text-muted-foreground">{entry.date} | {fmt(entry.clockIn)} - {entry.clockOut ? fmt(entry.clockOut) : "..."}</span>
                </div>
                {entry.note && <p className="text-sm text-muted-foreground">Notatka: {entry.note}</p>}
                <div className="flex items-center gap-2 flex-wrap">
                  <Input
                    placeholder="Notatka admina (opcjonalna)"
                    className="max-w-xs"
                    value={noteValues[entry.id] || ""}
                    onChange={(e) => setNoteValues(prev => ({ ...prev, [entry.id]: e.target.value }))}
                    data-testid={`input-admin-note-${entry.id}`}
                  />
                  <Button
                    size="sm"
                    onClick={() => approveMut.mutate({ id: entry.id, adminNote: noteValues[entry.id] })}
                    disabled={approveMut.isPending}
                    data-testid={`button-approve-${entry.id}`}
                  >
                    <Check className="h-4 w-4 mr-1" /> Akceptuj
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => rejectMut.mutate({ id: entry.id, adminNote: noteValues[entry.id] })}
                    disabled={rejectMut.isPending}
                    data-testid={`button-reject-${entry.id}`}
                  >
                    <X className="h-4 w-4 mr-1" /> Odrzuć
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {employees.map((emp: any) => {
          const status = getStatus(emp);
          const gps = gpsDataMap.get(emp.id);
          return (
            <Card
              key={emp.id}
              className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedEmployee(emp)}
              data-testid={`card-employee-${emp.id}`}
            >
              <div className="flex items-start gap-2">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
                  {emp.firstName?.[0]}{emp.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{emp.firstName} {emp.lastName}</div>
                  <div className="text-xs text-muted-foreground truncate">{emp.position}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    <Badge variant={status.variant} className={`text-xs ${status.green ? "bg-green-600" : ""}`}>
                      {status.label}
                    </Badge>
                    {gps ? (
                      <Badge
                        variant={gps.isOutsideZone ? "destructive" : "outline"}
                        className={`text-xs ${!gps.isOutsideZone ? "border-green-600 text-green-600" : ""}`}
                      >
                        {gps.isOutsideZone ? "Poza strefą" : "W strefie"}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Brak GPS</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {employees.length === 0 && (
          <div className="col-span-2 sm:col-span-3 p-8 text-center text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Brak pracowników</p>
          </div>
        )}
      </div>

      <Sheet open={!!selectedEmployee} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="sheet-employee-detail">
          <SheetHeader>
            <SheetTitle>
              {selectedEmployee?.firstName} {selectedEmployee?.lastName}
              <span className="text-muted-foreground font-normal text-sm ml-2">
                — {new Date(today).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </SheetTitle>
          </SheetHeader>

          <div className="mt-5 space-y-6">
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Wpis dnia
              </h4>
              {selectedEntry ? (
                <div className="space-y-0 text-sm border rounded-md divide-y">
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">Wejście</span>
                    <span className="font-medium">{fmt(selectedEntry.clockIn)}</span>
                  </div>
                  {selectedEntry.breakStart && (
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Przerwa</span>
                      <span className="font-medium">
                        {fmt(selectedEntry.breakStart)} – {selectedEntry.breakEnd ? fmt(selectedEntry.breakEnd) : "w trakcie"}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">Wyjście</span>
                    <span className="font-medium">{fmt(selectedEntry.clockOut)}</span>
                  </div>
                  <div className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">Czas pracy</span>
                    <span className="font-medium">{calcDuration(selectedEntry)}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={selectedEntry.clockOut ? "secondary" : (selectedEntry.breakStart && !selectedEntry.breakEnd) ? "outline" : "default"}
                      className={!selectedEntry.clockOut && !(selectedEntry.breakStart && !selectedEntry.breakEnd) ? "bg-green-600" : ""}
                    >
                      {selectedEntry.clockOut ? "Zakończone" : (selectedEntry.breakStart && !selectedEntry.breakEnd) ? "Na przerwie" : "Pracuje"}
                    </Badge>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Brak wpisu na dziś</p>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Mapa GPS
              </h4>
              {selectedEmployee && (
                <div className="rounded-md overflow-hidden border">
                  <EmployeeMapPanel key={selectedEmployee.id} employeeId={selectedEmployee.id} date={today} />
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function calcTotalMinutes(entry: any): number {
  if (!entry?.clockIn) return 0;
  const start = new Date(entry.clockIn).getTime();
  const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 60000));
}

function calcWorkMinutes(entry: any): number {
  const total = calcTotalMinutes(entry);
  return Math.max(0, total - (entry.breakMinutes || entry.totalBreakMinutes || 0));
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
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
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.message || "Błąd zapisu");
      }
      return r.json();
    },
    onSuccess: (updated: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/recepcja/rcp/time-entries?date=${date}`] });
      toast({ title: "Wpis zaktualizowany" });
      setEditMode(false);
      if (updated) setSelectedEntry(updated);
    },
    onError: (err: Error) => {
      toast({ title: "Błąd zapisu", description: err.message, variant: "destructive" });
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
    setEditClockIn(entry.clockIn ? new Date(entry.clockIn).toTimeString().slice(0, 5) : "");
    setEditClockOut(entry.clockOut ? new Date(entry.clockOut).toTimeString().slice(0, 5) : "");
    setSheetOpen(true);
  };

  const saveEdit = () => {
    if (!selectedEntry) return;
    const entryDate = selectedEntry.date || date;
    const clockIn = editClockIn ? new Date(`${entryDate}T${editClockIn}:00`) : undefined;
    const clockOut = editClockOut ? new Date(`${entryDate}T${editClockOut}:00`) : undefined;
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
            <th className="p-2 text-right">Razem</th>
            <th className="p-2 text-right">Praca</th>
            <th className="p-2 text-center">Poza strefą</th>
            <th className="p-2 text-center">Status</th>
          </tr></thead>
          <tbody>
            {entries.map((e: any) => {
              const emp = employees.find((em: any) => em.id === e.employeeId);
              const total = e.clockIn ? calcTotalMinutes(e) : null;
              const work = e.clockIn ? calcWorkMinutes(e) : null;
              return (
                <tr key={e.id} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => openDetail(e)} data-testid={`row-entry-${e.id}`}>
                  <td className="p-2 font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : `#${e.employeeId}`}</td>
                  <td className="p-2">{e.clockIn ? new Date(e.clockIn).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="p-2">{e.clockOut ? new Date(e.clockOut).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="p-2">{e.totalBreakMinutes ? `${e.totalBreakMinutes} min` : '-'}</td>
                  <td className="p-2 text-right">{total !== null ? formatDuration(total) : '—'}</td>
                  <td className="p-2 text-right">{work !== null ? formatDuration(work) : '—'}</td>
                  <td className="p-2 text-center">{e.isOutsideZone ? <Badge variant="destructive">Tak</Badge> : '-'}</td>
                  <td className="p-2 text-center">
                    <Badge variant={e.status === 'ZAAKCEPTOWANA' || e.status === 'ZAKONCZONA' ? 'default' : e.status === 'ODRZUCONA' ? 'destructive' : 'secondary'}>
                      {e.status || (e.clockOut ? 'Zakończone' : 'W trakcie')}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {entries.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Brak wpisów</td></tr>}
          </tbody>
        </table>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Szczegóły wpisu</SheetTitle>
          </SheetHeader>
          {selectedEntry && (() => {
            const emp = employees.find((em: any) => em.id === selectedEntry.employeeId);
            const total = calcTotalMinutes(selectedEntry);
            const work = calcWorkMinutes(selectedEntry);
            return (
              <div className="mt-4 space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold" data-testid="text-detail-total">{formatDuration(total)}</p>
                  <p className="text-sm text-muted-foreground">Razem</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-semibold">{formatDuration(work)}</p>
                      <p className="text-xs text-muted-foreground">Praca</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-semibold">{formatDuration(selectedEntry.totalBreakMinutes || selectedEntry.breakMinutes || 0)}</p>
                      <p className="text-xs text-muted-foreground">Przerwa</p>
                    </CardContent>
                  </Card>
                </div>
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

                <div className="border-t pt-3">
                  <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" /> Mapa GPS
                  </h4>
                  <div className="rounded-md overflow-hidden border">
                    <EmployeeMapPanel key={selectedEntry.id} employeeId={selectedEntry.employeeId} date={selectedEntry.date || date} />
                  </div>
                </div>
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

interface PerEmployeeGpsData {
  employeeId: number;
  firstName: string;
  lastName: string;
  logCount: number;
  lastLat: string | null;
  lastLng: string | null;
  lastTimestamp: string | null;
  isOutsideZone: boolean;
}

function EmployeeMapPanel({ employeeId, date }: { employeeId: number; date: string }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);

  const { data: rcpLocations = [] } = useQuery<any[]>({
    queryKey: ["/api/recepcja/rcp/locations"],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", "/api/recepcja/rcp/locations");
      return r.json();
    },
  });

  const { data: logs = [], isLoading } = useQuery<LocationLog[]>({
    queryKey: ["/api/recepcja/rcp/location-logs", employeeId, date],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", `/api/recepcja/rcp/location-logs?employeeId=${employeeId}&date=${date}`);
      return r.json();
    },
  });

  useEffect(() => {
    if (!mapDivRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    const map = L.map(mapDivRef.current, { center: [54.35, 18.65], zoom: 13 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
    mapRef.current = map;
    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 350);
    return () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove()); markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.remove(); polylineRef.current = null; }
    circlesRef.current.forEach(c => c.remove()); circlesRef.current = [];

    rcpLocations.forEach((loc: any) => {
      if (loc.latitude && loc.longitude && loc.gpsRadius) {
        const circle = L.circle([parseFloat(loc.latitude), parseFloat(loc.longitude)], {
          radius: loc.gpsRadius, color: "#3b82f6", fillColor: "#3b82f680", fillOpacity: 0.15, weight: 2, dashArray: "5,5",
        }).addTo(mapRef.current);
        circle.bindTooltip(loc.name);
        circlesRef.current.push(circle);
      }
    });

    if (logs.length === 0) {
      mapRef.current.setView([54.35, 18.65], 13);
      return;
    }

    const points: [number, number][] = logs.map(l => [parseFloat(l.latitude), parseFloat(l.longitude)]);
    logs.forEach((log, idx) => {
      const lat = parseFloat(log.latitude);
      const lng = parseFloat(log.longitude);
      const dist = log.distanceFromZone ? parseFloat(log.distanceFromZone) : null;
      const isInZone = dist !== null && dist <= 0;
      const time = new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      const isLast = idx === logs.length - 1;
      const iconHtml = `<div style="width:${isLast ? 18 : 12}px;height:${isLast ? 18 : 12}px;border-radius:50%;background:${isInZone ? '#22c55e' : '#ef4444'};border:${isLast ? 3 : 2}px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`;
      const icon = L.divIcon({ html: iconHtml, className: "", iconSize: [isLast ? 18 : 12, isLast ? 18 : 12], iconAnchor: [isLast ? 9 : 6, isLast ? 9 : 6] });
      const marker = L.marker([lat, lng], { icon }).addTo(mapRef.current);
      const acc = log.accuracy ? parseFloat(log.accuracy) : null;
      const accStr = acc !== null && isFinite(acc) ? `${acc.toFixed(1)}m` : '—';
      marker.bindPopup(`<div style="font-size:12px"><b>${time}</b><br/>Dokładność: ${accStr}<br/>${dist !== null ? (dist <= 0 ? '<span style="color:green">W strefie</span>' : `<span style="color:red">${dist.toFixed(0)}m poza strefą</span>`) : "Brak strefy"}${log.locationName ? `<br/>${log.locationName}` : ""}</div>`);
      markersRef.current.push(marker);
    });
    if (points.length > 1) {
      polylineRef.current = L.polyline(points, { color: "#6366f1", weight: 2, opacity: 0.6, dashArray: "6,4" }).addTo(mapRef.current);
    }
    mapRef.current.fitBounds(L.latLngBounds(points).pad(0.2));
  }, [logs, rcpLocations]);

  return (
    <div>
      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapDivRef} className="h-[300px] w-full" data-testid={`map-employee-${employeeId}`} style={{ zIndex: 1 }} />
      {!isLoading && logs.length === 0 && (
        <div className="flex flex-col items-center py-6 text-muted-foreground">
          <MapPin className="h-6 w-6 mb-2 opacity-50" />
          <p className="text-sm">Brak danych GPS na dziś</p>
        </div>
      )}
    </div>
  );
}

function RCPGpsTracking() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", "/api/recepcja/rcp/employees");
      return r.json();
    },
  });

  const { data: perEmployee = [] } = useQuery<PerEmployeeGpsData[]>({
    queryKey: ["/api/recepcja/rcp/location-logs/per-employee", date],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", `/api/recepcja/rcp/location-logs/per-employee?date=${date}`);
      return r.json();
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<LocationLog[]>({
    queryKey: ["/api/recepcja/rcp/location-logs", selectedEmployeeId, date],
    enabled: !!selectedEmployeeId,
    queryFn: async () => {
      const r = await recepcjaFetch("GET", `/api/recepcja/rcp/location-logs?employeeId=${selectedEmployeeId}&date=${date}`);
      if (!r.ok) throw new Error((await r.json()).message || "Błąd pobierania logów GPS");
      return r.json();
    },
  });

  const filteredLogs = useMemo(() => {
    if (!timeFrom && !timeTo) return logs;
    return logs.filter(log => {
      const t = new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":").slice(0, 5);
      if (timeFrom && t < timeFrom) return false;
      if (timeTo && t > timeTo) return false;
      return true;
    });
  }, [logs, timeFrom, timeTo]);

  useEffect(() => { setShowLogs(false); setTimeFrom(""); setTimeTo(""); }, [selectedEmployeeId, date]);

  const gpsDataMap = new Map(perEmployee.map(d => [d.employeeId, d]));

  const formatLastTime = (ts: string | null) => {
    if (!ts) return null;
    return new Date(ts).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium whitespace-nowrap">Data:</label>
        <Input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); setSelectedEmployeeId(null); }}
          className="w-auto"
          data-testid="input-recepcja-gps-date"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {employees.map((emp: any) => {
          const gps = gpsDataMap.get(emp.id);
          const isSelected = selectedEmployeeId === emp.id;
          const hasGps = !!gps;
          return (
            <Card
              key={emp.id}
              className={`p-3 transition-colors ${hasGps ? "cursor-pointer hover:bg-muted/50" : "opacity-50"} ${isSelected ? "ring-2 ring-primary" : ""}`}
              onClick={() => hasGps && setSelectedEmployeeId(isSelected ? null : emp.id)}
              data-testid={`card-gps-employee-${emp.id}`}
            >
              <div className="flex items-start gap-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${hasGps ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {emp.firstName?.[0]}{emp.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{emp.firstName} {emp.lastName}</div>
                  {hasGps ? (
                    <>
                      <Badge
                        variant={gps.isOutsideZone ? "destructive" : "outline"}
                        className={`text-xs mt-1 ${!gps.isOutsideZone ? "border-green-600 text-green-600" : ""}`}
                      >
                        {gps.isOutsideZone ? "Poza strefą" : "W strefie"}
                      </Badge>
                      <div className="text-xs text-muted-foreground mt-1">
                        {gps.logCount} logów · {formatLastTime(gps.lastTimestamp)}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-1">Brak logów GPS</div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
        {employees.length === 0 && (
          <div className="col-span-2 sm:col-span-3 p-8 text-center text-muted-foreground">Brak pracowników</div>
        )}
      </div>

      {selectedEmployeeId ? (
        <Card className="overflow-hidden">
          <EmployeeMapPanel key={`${selectedEmployeeId}-${date}`} employeeId={selectedEmployeeId} date={date} />
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <Navigation className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm">Wybierz pracownika z GPS, aby zobaczyć jego trasę</p>
        </Card>
      )}

      {selectedEmployeeId && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Navigation className="h-4 w-4 text-primary" />
              Logi GPS
              {logs.length > 0 && (
                <Badge variant="outline" className="text-xs" data-testid="badge-gps-log-count">
                  {(timeFrom || timeTo) ? `${filteredLogs.length} / ${logs.length}` : logs.length}
                </Badge>
              )}
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              {logs.length > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>Od:</span>
                  <Input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className="h-7 w-24 text-xs px-2" data-testid="input-gps-time-from" />
                  <span>Do:</span>
                  <Input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className="h-7 w-24 text-xs px-2" data-testid="input-gps-time-to" />
                  {(timeFrom || timeTo) && (
                    <button onClick={() => { setTimeFrom(""); setTimeTo(""); }} className="text-muted-foreground hover:text-foreground" data-testid="button-clear-gps-time-filter">✕</button>
                  )}
                </div>
              )}
              {!showLogs && logs.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setShowLogs(true)} data-testid="button-show-gps-logs">
                  Pokaż
                </Button>
              )}
              {showLogs && (
                <Button variant="ghost" size="sm" onClick={() => setShowLogs(false)}>
                  Ukryj
                </Button>
              )}
            </div>
          </div>

          {logsLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!logsLoading && logs.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="text-recepcja-no-gps-logs">
              Brak logów GPS dla wybranego pracownika w tym dniu
            </p>
          )}

          {showLogs && !logsLoading && logs.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="p-2 text-left">Czas</th>
                  <th className="p-2 text-left">Współrzędne</th>
                  <th className="p-2 text-right">Dokładność</th>
                  <th className="p-2 text-center">Status</th>
                  <th className="p-2 text-right">Odległość</th>
                </tr></thead>
                <tbody>
                  {filteredLogs.map((log) => {
                    const dist = log.distanceFromZone ? parseFloat(log.distanceFromZone) : null;
                    const isIn = dist !== null && dist <= 0;
                    return (
                      <tr key={log.id} className="border-b hover:bg-muted/30" data-testid={`row-recepcja-gps-log-${log.id}`}>
                        <td className="p-2 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
                  {filteredLogs.length === 0 && (timeFrom || timeTo) && (
                    <tr><td colSpan={5} className="p-4 text-center text-muted-foreground text-sm">Brak logów w wybranym przedziale czasu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

interface EmployeeStat {
  employeeId: number;
  employeeName: string;
  position: string;
  totalDays: number;
  totalHours: number;
  avgHoursPerDay: number;
  overtimeHours: number;
  lateCount: number;
  earlyLeaveCount: number;
  punctualityRate: number;
  outsideZoneCount: number;
}

type StatSortField = "employeeName" | "totalDays" | "totalHours" | "overtimeHours" | "punctualityRate" | "lateCount";
type StatSortDir = "asc" | "desc";

function formatStatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function RCPStatystyki() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(formatStatDate(firstDay));
  const [toDate, setToDate] = useState(formatStatDate(lastDay));
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<StatSortField>("employeeName");
  const [sortDir, setSortDir] = useState<StatSortDir>("asc");

  const { data: stats = [], isLoading, isError } = useQuery<EmployeeStat[]>({
    queryKey: ["/api/recepcja/rcp/employee-stats", fromDate, toDate],
    queryFn: async () => {
      const r = await recepcjaFetch("GET", `/api/recepcja/rcp/employee-stats?from=${fromDate}&to=${toDate}`);
      if (!r.ok) throw new Error("Błąd pobierania danych");
      return r.json();
    },
  });

  const toggleSort = (field: StatSortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let result = [...stats];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.employeeName.toLowerCase().includes(q) ||
        (s.position || "").toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      const nA = valA as number;
      const nB = valB as number;
      return sortDir === "asc" ? nA - nB : nB - nA;
    });
    return result;
  }, [stats, search, sortField, sortDir]);

  const totalEmployees = stats.length;
  const avgHours = totalEmployees > 0
    ? Math.round((stats.reduce((s, e) => s + e.totalHours, 0) / totalEmployees) * 100) / 100
    : 0;
  const bestPunctuality = totalEmployees > 0
    ? Math.max(...stats.map(s => s.punctualityRate))
    : 0;

  const chartData = filtered.map(s => ({
    name: s.employeeName.length > 15 ? s.employeeName.slice(0, 15) + "..." : s.employeeName,
    godziny: s.totalHours,
    nadgodziny: s.overtimeHours,
  }));

  const StatSortButton = ({ field, children }: { field: StatSortField; children: ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1 -ml-3 no-default-hover-elevate no-default-active-elevate"
      onClick={() => toggleSort(field)}
      data-testid={`button-sort-${field}`}
    >
      {children}
      <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          data-testid="input-stat-date-from"
        />
        <span className="text-muted-foreground">—</span>
        <Input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          data-testid="input-stat-date-to"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pracownicy</p>
              <p className="text-2xl font-bold" data-testid="text-stat-total-employees">
                {isLoading ? <Skeleton className="h-7 w-10" /> : totalEmployees}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Śr. godzin</p>
              <p className="text-2xl font-bold" data-testid="text-stat-avg-hours">
                {isLoading ? <Skeleton className="h-7 w-10" /> : `${avgHours}h`}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Najlepsza punktualność</p>
              <p className="text-2xl font-bold" data-testid="text-stat-best-punctuality">
                {isLoading ? <Skeleton className="h-7 w-10" /> : `${bestPunctuality}%`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {filtered.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="font-semibold mb-4">Godziny pracy wg pracownika</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip />
                  <Bar dataKey="godziny" fill="hsl(var(--primary))" name="Godziny" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="nadgodziny" fill="hsl(var(--destructive))" name="Nadgodziny" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Szukaj pracownika..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs"
              data-testid="input-stat-search"
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="text-center py-8 text-destructive" data-testid="text-stat-error">
              Błąd pobierania danych. Sprawdź zakres dat i spróbuj ponownie.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <StatSortButton field="employeeName">Pracownik</StatSortButton>
                    </TableHead>
                    <TableHead>Stanowisko</TableHead>
                    <TableHead className="text-right">
                      <StatSortButton field="totalDays">Dni</StatSortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <StatSortButton field="totalHours">Godziny</StatSortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <StatSortButton field="overtimeHours">Nadgodziny</StatSortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <StatSortButton field="punctualityRate">Punktualność</StatSortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <StatSortButton field="lateCount">Spóźnienia</StatSortButton>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Brak danych dla wybranego okresu
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(s => (
                      <TableRow key={s.employeeId} data-testid={`row-stat-employee-${s.employeeId}`}>
                        <TableCell className="font-medium" data-testid={`text-stat-name-${s.employeeId}`}>
                          {s.employeeName}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{s.position || "—"}</TableCell>
                        <TableCell className="text-right">{s.totalDays}</TableCell>
                        <TableCell className="text-right">{s.totalHours}h</TableCell>
                        <TableCell className="text-right">{s.overtimeHours}h</TableCell>
                        <TableCell className="text-right">{s.punctualityRate}%</TableCell>
                        <TableCell className="text-right">{s.lateCount}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const POSITIONS_HOURLY = [
  { value: "PRACOWNIK_RECEPCJI", label: "Pracownik recepcji" },
  { value: "KONSERWATOR", label: "Konserwator" },
  { value: "OSOBA_SPRZATAJACA", label: "Osoba sprzątająca" },
  { value: "FINANCIAL_MANAGER", label: "Menedżer finansowy" },
];

function AddHourlyEmployeeDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", position: "", phone: "", hourlyRate: "" });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const r = await recepcjaFetch("POST", "/api/recepcja/rcp/employees", {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        position: data.position,
        phone: data.phone.trim() || null,
        hourlyRate: data.hourlyRate ? data.hourlyRate : null,
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Pracownik dodany" });
      setOpen(false);
      setForm({ firstName: "", lastName: "", position: "", phone: "", hourlyRate: "" });
      onSuccess();
    },
    onError: (err: any) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.position) {
      toast({ title: "Uzupełnij wymagane pola", variant: "destructive" });
      return;
    }
    createMutation.mutate(form);
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} data-testid="button-add-hourly-employee">
        <Users className="h-4 w-4 mr-1" />
        Dodaj pracownika na godziny
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Nowy pracownik na godziny</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Imię *</label>
                  <Input value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="Imię" data-testid="input-employee-firstname" />
                </div>
                <div>
                  <label className="text-sm font-medium">Nazwisko *</label>
                  <Input value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="Nazwisko" data-testid="input-employee-lastname" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Stanowisko *</label>
                <Select value={form.position} onValueChange={v => setForm(f => ({ ...f, position: v }))}>
                  <SelectTrigger data-testid="select-employee-position"><SelectValue placeholder="Wybierz stanowisko" /></SelectTrigger>
                  <SelectContent>
                    {POSITIONS_HOURLY.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Telefon</label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+48 000 000 000" data-testid="input-employee-phone" />
              </div>
              <div>
                <label className="text-sm font-medium">Stawka godzinowa (zł/h)</label>
                <Input type="number" step="0.01" min="0" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} placeholder="np. 25.00" data-testid="input-employee-hourly-rate" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Anuluj</Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-add-employee">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Dodaj"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function RCPPiny() {
  const { toast } = useToast();
  const [visiblePinId, setVisiblePinId] = useState<number | null>(null);
  const [revealedPin, setRevealedPin] = useState<string | null>(null);
  const { data: employees = [], isLoading, refetch } = useQuery({
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
    <div className="space-y-3">
      <div className="flex justify-end">
        <AddHourlyEmployeeDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/recepcja/rcp/employees-pins"] })} />
      </div>
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
    </div>
  );
}