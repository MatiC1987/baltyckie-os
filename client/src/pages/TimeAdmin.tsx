import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Location, TimeEntry } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock, Users, Coffee, AlertTriangle, ChevronLeft, ChevronRight,
  Check, X, Eye, EyeOff, RefreshCw, MapPin, Pencil, Trash2, Plus,
  KeyRound, CalendarRange, Palmtree, FileBarChart, Navigation,
  Search, Award, BarChart3, ArrowUpDown, Car,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import GrafikTab from "@/pages/rcp/GrafikTab";
import UrlopyTab from "@/pages/rcp/UrlopyTab";
import RaportyTab from "@/pages/rcp/RaportyTab";
import GpsTrackingTab from "@/pages/rcp/GpsTrackingTab";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

function formatTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function calcWorkMinutes(entry: any): number {
  if (!entry.clockIn) return 0;
  const start = new Date(entry.clockIn).getTime();
  const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
  const totalMs = end - start;
  const totalMin = Math.round(totalMs / 60000);
  return Math.max(0, totalMin - (entry.breakMinutes || 0));
}

function calcTotalMinutes(entry: any): number {
  if (!entry.clockIn) return 0;
  const start = new Date(entry.clockIn).getTime();
  const end = entry.clockOut ? new Date(entry.clockOut).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 60000));
}

function getStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    AKTYWNA: { label: "W pracy", variant: "default" },
    PRZERWA: { label: "Przerwa", variant: "secondary" },
    ZAKONCZONA: { label: "Zakończona", variant: "outline" },
    WARUNKOWA: { label: "Warunkowa", variant: "destructive" },
    ZAAKCEPTOWANA: { label: "Zaakceptowana", variant: "default" },
    ODRZUCONA: { label: "Odrzucona", variant: "destructive" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant} data-testid={`badge-status-${status}`}>{info.label}</Badge>;
}

function getInitials(emp: Employee): string {
  return `${(emp.firstName?.[0] || "").toUpperCase()}${(emp.lastName?.[0] || "").toUpperCase()}`;
}

function EmployeeAvatar({ emp }: { emp: Employee }) {
  return (
    <Avatar className="h-8 w-8">
      <AvatarFallback className="text-xs">{getInitials(emp)}</AvatarFallback>
    </Avatar>
  );
}

function EmployeeGpsPanel({ employeeId, date }: { employeeId: number; date: string }) {
  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);

  const { data: locations = [] } = useQuery<any[]>({ queryKey: ["/api/locations"] });

  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/location-logs", employeeId, date],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/location-logs?employeeId=${employeeId}&date=${date}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (!mapDivRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    const map = L.map(mapDivRef.current, { center: [54.35, 18.65], zoom: 13 });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
    mapRef.current = map;
    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 350);
    return () => {
      markersRef.current.forEach(m => m.remove()); markersRef.current = [];
      if (polylineRef.current) { polylineRef.current.remove(); polylineRef.current = null; }
      circlesRef.current.forEach(c => c.remove()); circlesRef.current = [];
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove()); markersRef.current = [];
    if (polylineRef.current) { polylineRef.current.remove(); polylineRef.current = null; }
    circlesRef.current.forEach(c => c.remove()); circlesRef.current = [];

    locations.forEach((loc: any) => {
      if (loc.latitude && loc.longitude && loc.gpsRadius) {
        const circle = L.circle(
          [parseFloat(loc.latitude), parseFloat(loc.longitude)],
          { radius: loc.gpsRadius, color: "#3b82f6", fillColor: "#3b82f680", fillOpacity: 0.15, weight: 2, dashArray: "5,5" }
        ).addTo(mapRef.current);
        circle.bindTooltip(loc.name);
        circlesRef.current.push(circle);
      }
    });

    if (logs.length === 0) {
      mapRef.current.setView([54.35, 18.65], 13);
      return;
    }

    const points: [number, number][] = logs.map((l: any) => [parseFloat(l.latitude), parseFloat(l.longitude)]);
    logs.forEach((log: any, idx: number) => {
      const lat = parseFloat(log.latitude);
      const lng = parseFloat(log.longitude);
      const dist = log.distanceFromZone ? parseFloat(log.distanceFromZone) : null;
      const isInZone = dist !== null && dist <= 0;
      const time = new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      const isLast = idx === logs.length - 1;
      const iconHtml = `<div style="width:${isLast ? 18 : 12}px;height:${isLast ? 18 : 12}px;border-radius:50%;background:${isInZone ? '#22c55e' : '#ef4444'};border:${isLast ? 3 : 2}px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`;
      const icon = L.divIcon({ html: iconHtml, className: "", iconSize: [isLast ? 18 : 12, isLast ? 18 : 12], iconAnchor: [isLast ? 9 : 6, isLast ? 9 : 6] });
      const marker = L.marker([lat, lng], { icon }).addTo(mapRef.current);
      marker.bindPopup(`<div style="font-size:12px"><b>${time}</b><br/>${dist !== null ? (dist <= 0 ? '<span style="color:green">W strefie</span>' : `<span style="color:red">${dist.toFixed(0)}m poza strefą</span>`) : "Brak strefy"}${log.locationName ? `<br/>${log.locationName}` : ""}</div>`);
      markersRef.current.push(marker);
    });
    if (points.length > 1) {
      polylineRef.current = L.polyline(points, { color: "#6366f1", weight: 2, opacity: 0.6, dashArray: "6,4" }).addTo(mapRef.current);
    }
    mapRef.current.fitBounds(L.latLngBounds(points).pad(0.2));
  }, [logs, locations]);

  return (
    <div>
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      )}
      <div ref={mapDivRef} className="h-[280px] w-full" data-testid={`map-employee-detail-${employeeId}`} style={{ zIndex: 1 }} />
      {!isLoading && logs.length === 0 && (
        <div className="flex flex-col items-center py-5 text-muted-foreground">
          <MapPin className="h-6 w-6 mb-2 opacity-50" />
          <p className="text-sm">Brak danych GPS na dziś</p>
        </div>
      )}
    </div>
  );
}

function DashboardTab() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/rcp/dashboard"] });
  const { toast } = useToast();

  const approveMut = useMutation({
    mutationFn: async ({ id, adminNote }: { id: number; adminNote?: string }) => {
      await apiRequest("PUT", `/api/time-entries/${id}/approve`, { adminNote });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rcp/dashboard"] });
      toast({ title: "Wpis zaakceptowany" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message || "Nie udało się zaakceptować wpisu", variant: "destructive" });
    },
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, adminNote }: { id: number; adminNote?: string }) => {
      await apiRequest("PUT", `/api/time-entries/${id}/reject`, { adminNote });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rcp/dashboard"] });
      toast({ title: "Wpis odrzucony" });
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message || "Nie udało się odrzucić wpisu", variant: "destructive" });
    },
  });

  const [noteValues, setNoteValues] = useState<Record<number, string>>({});
  const [selectedEmployeeStatus, setSelectedEmployeeStatus] = useState<any | null>(null);

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const {
    working = 0, onBreak = 0, pendingCount = 0, pendingEntries = [], employeeStatuses = [],
    pendingLeavesCount = 0, missingSchedules = [], lateToday = [], overtimeYesterday = [],
  } = data || {};

  const alertCount = pendingLeavesCount + missingSchedules.length + lateToday.length + overtimeYesterday.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-emerald-500/10">
              <Users className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Teraz w pracy</p>
              <p className="text-2xl font-bold" data-testid="text-working-count">{working}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-amber-500/10">
              <Coffee className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Na przerwie</p>
              <p className="text-2xl font-bold" data-testid="text-break-count">{onBreak}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex items-center gap-2">
              <div>
                <p className="text-sm text-muted-foreground">Oczekujące akceptacje</p>
                <p className="text-2xl font-bold" data-testid="text-pending-count">{pendingCount}</p>
              </div>
              {pendingCount > 0 && <Badge variant="destructive">{pendingCount}</Badge>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-3">Pracownicy</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {employeeStatuses.map((es: any, i: number) => {
            const emp = es.employee;
            if (!emp) return null;
            let statusText = "";
            let statusColor = "text-muted-foreground";
            if (es.status === "working") {
              statusText = `W pracy od ${formatTime(es.clockIn)}`;
              statusColor = "text-emerald-600 dark:text-emerald-400";
            } else if (es.status === "break") {
              statusText = `Na przerwie od ${formatTime(es.breakStart)}`;
              statusColor = "text-amber-600 dark:text-amber-400";
            } else if (es.status === "finished") {
              const ago = Math.round((Date.now() - new Date(es.clockOut).getTime()) / 3600000);
              statusText = `Zakończył(a) ${ago}h temu`;
            } else {
              statusText = "Nieobecny(a)";
            }
            return (
              <Card
                key={emp.id}
                data-testid={`card-employee-${emp.id}`}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedEmployeeStatus(es)}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <EmployeeAvatar emp={emp} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp.position || "—"}</p>
                    <p className={`text-xs mt-0.5 ${statusColor}`}>{statusText}</p>
                  </div>
                  {es.isOutsideZone && (
                    <Badge variant="destructive" className="shrink-0">Poza strefą</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {alertCount > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
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
        <div>
          <h3 className="text-lg font-semibold mb-3">Wpisy warunkowe do akceptacji</h3>
          <div className="space-y-3">
            {pendingEntries.map((entry: any) => (
              <Card key={entry.id} data-testid={`card-pending-${entry.id}`}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium">{entry.employee?.firstName} {entry.employee?.lastName}</span>
                    {getStatusBadge(entry.status)}
                    <span className="text-sm text-muted-foreground">{entry.date} | {formatTime(entry.clockIn)} - {entry.clockOut ? formatTime(entry.clockOut) : "..."}</span>
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
        </div>
      )}

      <Sheet open={!!selectedEmployeeStatus} onOpenChange={(open) => { if (!open) setSelectedEmployeeStatus(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="sheet-employee-detail-rcp">
          <SheetHeader>
            <SheetTitle>
              {selectedEmployeeStatus?.employee?.firstName} {selectedEmployeeStatus?.employee?.lastName}
              <span className="text-muted-foreground font-normal text-sm ml-2">
                — {new Date().toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </SheetTitle>
          </SheetHeader>
          <div className="mt-5 space-y-6">
            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Wpis dnia
              </h4>
              {selectedEmployeeStatus?.status === "absent" ? (
                <p className="text-sm text-muted-foreground">Brak wpisu na dziś — pracownik nieobecny.</p>
              ) : (
                <div className="border rounded-md divide-y text-sm">
                  <div className="flex justify-between items-center px-3 py-2">
                    <span className="text-muted-foreground">Status</span>
                    <span>
                      {selectedEmployeeStatus?.status === "working" && <Badge className="bg-green-600 hover:bg-green-700">W pracy</Badge>}
                      {selectedEmployeeStatus?.status === "break" && <Badge variant="secondary">Przerwa</Badge>}
                      {selectedEmployeeStatus?.status === "finished" && <Badge variant="outline">Zakończona</Badge>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2">
                    <span className="text-muted-foreground">Wejście</span>
                    <span className="font-medium">{formatTime(selectedEmployeeStatus?.clockIn)}</span>
                  </div>
                  {selectedEmployeeStatus?.breakStart && (
                    <div className="flex justify-between items-center px-3 py-2">
                      <span className="text-muted-foreground">Przerwa od</span>
                      <span className="font-medium">{formatTime(selectedEmployeeStatus?.breakStart)}</span>
                    </div>
                  )}
                  {selectedEmployeeStatus?.clockOut && (
                    <div className="flex justify-between items-center px-3 py-2">
                      <span className="text-muted-foreground">Wyjście</span>
                      <span className="font-medium">{formatTime(selectedEmployeeStatus?.clockOut)}</span>
                    </div>
                  )}
                  {selectedEmployeeStatus?.clockIn && (
                    <div className="flex justify-between items-center px-3 py-2">
                      <span className="text-muted-foreground">Czas pracy</span>
                      <span className="font-medium">{formatDuration(calcWorkMinutes(selectedEmployeeStatus))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Mapa GPS — trasa dnia
              </h4>
              {selectedEmployeeStatus?.employee && (
                <div className="rounded-md overflow-hidden border">
                  <EmployeeGpsPanel
                    key={selectedEmployeeStatus.employee.id}
                    employeeId={selectedEmployeeStatus.employee.id}
                    date={new Date().toISOString().slice(0, 10)}
                  />
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ObecnosciTab() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const { toast } = useToast();

  const { data: allEmployees } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const { data: dayEntries, isLoading } = useQuery<any[]>({ queryKey: ["/api/time-entries/day", `?date=${selectedDate}`] });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/time-entries/${id}`, data);
      return res.json();
    },
    onSuccess: (updatedEntry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/day", `?date=${selectedDate}`] });
      toast({ title: "Wpis zaktualizowany" });
      setEditMode(false);
      if (updatedEntry) {
        setSelectedEntry((prev: any) => prev ? { ...prev, entry: updatedEntry } : null);
      }
    },
    onError: (err: any) => {
      toast({ title: "Błąd zapisu", description: err.message, variant: "destructive" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/time-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/day"] });
      toast({ title: "Wpis usunięty" });
      setSheetOpen(false);
      setSelectedEntry(null);
    },
  });

  const changeDay = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const employeeRows = useMemo(() => {
    if (!allEmployees) return [];
    const entryMap = new Map<number, any>();
    if (dayEntries) {
      for (const e of dayEntries) {
        if (!entryMap.has(e.employeeId)) entryMap.set(e.employeeId, e);
      }
    }
    return allEmployees
      .filter(e => e.status === "AKTYWNY" && !e.hideFromRcp)
      .map(emp => ({
        employee: emp,
        entry: entryMap.get(emp.id) || null,
      }));
  }, [allEmployees, dayEntries]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + "T12:00:00");
    return d.toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  };

  const openDetail = (row: any) => {
    if (!row.entry) return;
    setSelectedEntry(row);
    setEditMode(false);
    setEditData({});
    setSheetOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="icon" variant="outline" onClick={() => changeDay(-1)} data-testid="button-prev-day">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])} data-testid="button-today">
          Dzisiaj
        </Button>
        <Button size="icon" variant="outline" onClick={() => changeDay(1)} data-testid="button-next-day">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium capitalize" data-testid="text-selected-date">{formatDate(selectedDate)}</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pracownik</TableHead>
                  <TableHead>Obecność</TableHead>
                  <TableHead>Razem</TableHead>
                  <TableHead>Praca</TableHead>
                  <TableHead>Przerwa</TableHead>
                  <TableHead>Wejście</TableHead>
                  <TableHead>Wyjście</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employeeRows.map((row) => {
                  const e = row.entry;
                  const total = e ? calcTotalMinutes(e) : 0;
                  const work = e ? calcWorkMinutes(e) : 0;
                  const breakMin = e?.breakMinutes || 0;
                  return (
                    <TableRow
                      key={row.employee.id}
                      className={e ? "cursor-pointer hover-elevate" : ""}
                      onClick={() => openDetail(row)}
                      data-testid={`row-attendance-${row.employee.id}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <EmployeeAvatar emp={row.employee} />
                          <div>
                            <p className="font-medium text-sm">{row.employee.firstName} {row.employee.lastName}</p>
                            <p className="text-xs text-muted-foreground">{row.employee.position}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{e ? getStatusBadge(e.status) : <Badge variant="outline">Nieobecny</Badge>}</TableCell>
                      <TableCell className="text-sm">{e ? formatDuration(total) : "—"}</TableCell>
                      <TableCell className="text-sm">{e ? formatDuration(work) : "—"}</TableCell>
                      <TableCell className="text-sm">{breakMin > 0 ? formatDuration(breakMin) : "—"}</TableCell>
                      <TableCell className="text-sm">{formatTime(e?.clockIn)}</TableCell>
                      <TableCell className="text-sm">{formatTime(e?.clockOut)}</TableCell>
                    </TableRow>
                  );
                })}
                {employeeRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Brak pracowników</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedEntry?.entry && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <EmployeeAvatar emp={selectedEntry.employee} />
                  <div>
                    <p>{selectedEntry.employee.firstName} {selectedEntry.employee.lastName}</p>
                    <p className="text-xs text-muted-foreground font-normal">{selectedEntry.employee.position}</p>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold" data-testid="text-detail-total">
                    {formatDuration(calcTotalMinutes(selectedEntry.entry))}
                  </p>
                  <p className="text-sm text-muted-foreground">Razem</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-semibold">{formatDuration(calcWorkMinutes(selectedEntry.entry))}</p>
                      <p className="text-xs text-muted-foreground">Praca</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-lg font-semibold">{formatDuration(selectedEntry.entry.breakMinutes || 0)}</p>
                      <p className="text-xs text-muted-foreground">Przerwa</p>
                    </CardContent>
                  </Card>
                </div>
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Wejście</span>
                      {editMode ? (
                        <Input
                          type="time"
                          className="w-32"
                          value={editData.clockInTime || ""}
                          onChange={(e) => setEditData((prev: any) => ({ ...prev, clockInTime: e.target.value }))}
                          data-testid="input-edit-clock-in"
                        />
                      ) : (
                        <span className="text-sm font-medium">{formatTime(selectedEntry.entry.clockIn)}</span>
                      )}
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Wyjście</span>
                      {editMode ? (
                        <Input
                          type="time"
                          className="w-32"
                          value={editData.clockOutTime || ""}
                          onChange={(e) => setEditData((prev: any) => ({ ...prev, clockOutTime: e.target.value }))}
                          data-testid="input-edit-clock-out"
                        />
                      ) : (
                        <span className="text-sm font-medium">{formatTime(selectedEntry.entry.clockOut)}</span>
                      )}
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {getStatusBadge(selectedEntry.entry.status)}
                    </div>
                    {selectedEntry.entry.note && (
                      <div className="flex justify-between gap-2">
                        <span className="text-sm text-muted-foreground">Notatka</span>
                        <span className="text-sm">{selectedEntry.entry.note}</span>
                      </div>
                    )}
                    {selectedEntry.entry.adminNote && (
                      <div className="flex justify-between gap-2">
                        <span className="text-sm text-muted-foreground">Notatka admina</span>
                        <span className="text-sm">{selectedEntry.entry.adminNote}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="flex gap-2 flex-wrap">
                  {editMode ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => {
                          const updates: any = {};
                          if (editData.clockInTime) {
                            const d = new Date(selectedEntry.entry.clockIn);
                            const [h, m] = editData.clockInTime.split(":").map(Number);
                            d.setHours(h, m, 0);
                            updates.clockIn = d.toISOString();
                          }
                          if (editData.clockOutTime) {
                            const d = selectedEntry.entry.clockOut ? new Date(selectedEntry.entry.clockOut) : new Date(selectedEntry.entry.clockIn);
                            const [h, m] = editData.clockOutTime.split(":").map(Number);
                            d.setHours(h, m, 0);
                            updates.clockOut = d.toISOString();
                          }
                          updateMut.mutate({ id: selectedEntry.entry.id, data: updates });
                        }}
                        disabled={updateMut.isPending}
                        data-testid="button-save-edit"
                      >
                        <Check className="h-4 w-4 mr-1" /> Zapisz
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditMode(false)} data-testid="button-cancel-edit">
                        Anuluj
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="outline" onClick={() => {
                        const ci = selectedEntry.entry.clockIn ? new Date(selectedEntry.entry.clockIn) : null;
                        const co = selectedEntry.entry.clockOut ? new Date(selectedEntry.entry.clockOut) : null;
                        setEditData({
                          clockInTime: ci ? `${String(ci.getHours()).padStart(2, "0")}:${String(ci.getMinutes()).padStart(2, "0")}` : "",
                          clockOutTime: co ? `${String(co.getHours()).padStart(2, "0")}:${String(co.getMinutes()).padStart(2, "0")}` : "",
                        });
                        setEditMode(true);
                      }} data-testid="button-edit-entry">
                        <Pencil className="h-4 w-4 mr-1" /> Edytuj godziny
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate(selectedEntry.entry.id)} disabled={deleteMut.isPending} data-testid="button-delete-entry">
                        <Trash2 className="h-4 w-4 mr-1" /> Usuń
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapFlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 14);
  }, [center[0], center[1]]);
  return null;
}

function LokalizacjeGPSTab() {
  const { data: locations, isLoading } = useQuery<Location[]>({ queryKey: ["/api/locations"] });
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [editRadius, setEditRadius] = useState(200);
  const [mapCenter, setMapCenter] = useState<[number, number]>([54.44, 17.03]);

  const updateGpsMut = useMutation({
    mutationFn: async ({ id, latitude, longitude, gpsRadius }: { id: number; latitude: string; longitude: string; gpsRadius: number }) => {
      await apiRequest("PUT", `/api/locations/${id}/gps`, { latitude, longitude, gpsRadius });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
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
    if (!locations) return [];
    return locations.filter(l => l.latitude && l.longitude);
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

  const startEdit = (loc: Location) => {
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
          <MapFlyTo center={mapCenter} />
          <MapClickHandler onClick={handleMapClick} />
          {locsWithGps.map(loc => (
            <Marker key={loc.id} position={[Number(loc.latitude), Number(loc.longitude)]}>
            </Marker>
          ))}
          {locsWithGps.map(loc => (
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
              {(locations || []).map(loc => (
                <TableRow key={loc.id} data-testid={`row-location-${loc.id}`}>
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
                          data-testid="input-edit-lat"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={editLng}
                          onChange={(e) => setEditLng(e.target.value)}
                          className="w-28"
                          placeholder="17.0300000"
                          data-testid="input-edit-lng"
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
                            data-testid="slider-radius"
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
                            data-testid={`button-save-gps-${loc.id}`}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="outline" onClick={() => setEditingId(null)} data-testid={`button-cancel-gps-${loc.id}`}>
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
                        <Button size="icon" variant="outline" onClick={() => startEdit(loc)} data-testid={`button-edit-gps-${loc.id}`}>
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

function PINyTab() {
  const { data: employees, isLoading } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const { toast } = useToast();
  const [visiblePins, setVisiblePins] = useState<Set<number>>(new Set());
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [pinValue, setPinValue] = useState("");

  const updatePinMut = useMutation({
    mutationFn: async ({ id, pin }: { id: number; pin: string | null }) => {
      await apiRequest("PUT", `/api/employees/${id}/pin`, { pin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: "PIN zaktualizowany" });
      setPinDialogOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
    },
  });

  const togglePinVisibility = (empId: number) => {
    setVisiblePins(prev => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const generatePin = () => {
    let pin = "";
    for (let i = 0; i < 6; i++) pin += Math.floor(Math.random() * 10).toString();
    setPinValue(pin);
  };

  const openSetPin = (emp: Employee) => {
    setSelectedEmp(emp);
    setPinValue(emp.pin || "");
    setPinDialogOpen(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const activeEmployees = (employees || []).filter(e => e.status === "AKTYWNY" && !e.hideFromRcp);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pracownik</TableHead>
                <TableHead>Stanowisko</TableHead>
                <TableHead>PIN</TableHead>
                <TableHead>Akcje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeEmployees.map(emp => (
                <TableRow key={emp.id} data-testid={`row-pin-${emp.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EmployeeAvatar emp={emp} />
                      <span className="font-medium text-sm">{emp.firstName} {emp.lastName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{emp.position || "—"}</TableCell>
                  <TableCell>
                    {emp.pin ? (
                      <div className="flex items-center gap-1">
                        <code className="text-sm font-mono" data-testid={`text-pin-${emp.id}`}>
                          {visiblePins.has(emp.id) ? emp.pin : "******"}
                        </code>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => togglePinVisibility(emp.id)}
                          data-testid={`button-toggle-pin-${emp.id}`}
                        >
                          {visiblePins.has(emp.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Brak</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => openSetPin(emp)} data-testid={`button-set-pin-${emp.id}`}>
                        <KeyRound className="h-4 w-4 mr-1" /> Ustaw PIN
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          let pin = "";
                          for (let i = 0; i < 6; i++) pin += Math.floor(Math.random() * 10).toString();
                          updatePinMut.mutate({ id: emp.id, pin });
                        }}
                        disabled={updatePinMut.isPending}
                        data-testid={`button-generate-pin-${emp.id}`}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" /> Generuj
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {activeEmployees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">Brak aktywnych pracowników</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ustaw PIN — {selectedEmp?.firstName} {selectedEmp?.lastName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="6-cyfrowy PIN"
                maxLength={6}
                inputMode="numeric"
                className="font-mono text-lg tracking-widest"
                data-testid="input-set-pin"
              />
              <Button variant="outline" onClick={generatePin} data-testid="button-dialog-generate-pin">
                <RefreshCw className="h-4 w-4 mr-1" /> Generuj
              </Button>
            </div>
            {pinValue && pinValue.length !== 6 && (
              <p className="text-sm text-destructive">PIN musi mieć dokładnie 6 cyfr</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinDialogOpen(false)} data-testid="button-cancel-pin">
              Anuluj
            </Button>
            {selectedEmp?.pin && (
              <Button
                variant="destructive"
                onClick={() => selectedEmp && updatePinMut.mutate({ id: selectedEmp.id, pin: null })}
                disabled={updatePinMut.isPending}
                data-testid="button-remove-pin"
              >
                Usuń PIN
              </Button>
            )}
            <Button
              onClick={() => selectedEmp && updatePinMut.mutate({ id: selectedEmp.id, pin: pinValue })}
              disabled={updatePinMut.isPending || pinValue.length !== 6}
              data-testid="button-save-pin"
            >
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

type SortField = "employeeName" | "totalDays" | "totalHours" | "overtimeHours" | "punctualityRate" | "lateCount";
type SortDir = "asc" | "desc";

const POSITION_LABELS: Record<string, string> = {
  KIEROWNIK_RECEPCJI: "Kierownik recepcji",
  PRACOWNIK_RECEPCJI: "Pracownik recepcji",
  KONSERWATOR: "Konserwator",
  OSOBA_SPRZATAJACA: "Osoba sprzątająca",
  FINANCIAL_MANAGER: "Manager finansowy",
};

function formatStatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function StatystykiTab() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [fromDate, setFromDate] = useState(formatStatDate(firstDay));
  const [toDate, setToDate] = useState(formatStatDate(lastDay));
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("employeeName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const { data: stats = [], isLoading, isError } = useQuery<EmployeeStat[]>({
    queryKey: ["/api/rcp/employee-stats", fromDate, toDate],
    queryFn: async () => {
      const res = await fetch(`/api/rcp/employee-stats?from=${fromDate}&to=${toDate}`);
      if (!res.ok) throw new Error("Błąd pobierania danych");
      return res.json();
    },
  });

  const toggleSort = (field: SortField) => {
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
      result = result.filter(
        s =>
          s.employeeName.toLowerCase().includes(q) ||
          (POSITION_LABELS[s.position] || s.position).toLowerCase().includes(q)
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

  const StatSortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
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
                        <TableCell className="text-muted-foreground">
                          {POSITION_LABELS[s.position] || s.position}
                        </TableCell>
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

function KilometrówkaTab() {
  const { toast } = useToast();
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";

  const [filterEmpId, setFilterEmpId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ employeeId: "", date: today, fromLocation: "", toLocation: "", distanceKm: "", purpose: "" });

  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const buildParams = () => {
    const p = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (filterEmpId !== "all") p.set("employeeId", filterEmpId);
    return p.toString();
  };

  const { data: entries = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/mileage-entries", filterEmpId, dateFrom, dateTo],
    queryFn: async () => { const r = await apiRequest("GET", `/api/mileage-entries?${buildParams()}`); return r.json(); },
  });

  const totalKm = entries.reduce((acc, e) => acc + parseFloat(e.distanceKm || "0"), 0);
  const empMap = new Map(employees.map(e => [e.id, e]));
  const perEmployee = (employees as Employee[])
    .map(emp => ({ emp, km: entries.filter(e => e.employeeId === emp.id).reduce((s, e) => s + parseFloat(e.distanceKm || "0"), 0) }))
    .filter(x => x.km > 0)
    .sort((a, b) => b.km - a.km);

  const setThisMonth = () => {
    const d = new Date();
    setDateFrom(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    setDateTo(today);
  };
  const setPrevMonth = () => {
    const d = new Date(); d.setDate(0);
    const last = d.toISOString().slice(0, 10);
    d.setDate(1);
    setDateFrom(d.toISOString().slice(0, 10));
    setDateTo(last);
  };
  const setThisYear = () => { setDateFrom(`${new Date().getFullYear()}-01-01`); setDateTo(today); };

  const openAdd = () => {
    setEditEntry(null);
    setForm({ employeeId: "", date: today, fromLocation: "", toLocation: "", distanceKm: "", purpose: "" });
    setDialogOpen(true);
  };
  const openEdit = (entry: any) => {
    setEditEntry(entry);
    setForm({ employeeId: String(entry.employeeId), date: entry.date, fromLocation: entry.fromLocation, toLocation: entry.toLocation, distanceKm: String(entry.distanceKm), purpose: entry.purpose || "" });
    setDialogOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const r = editEntry
        ? await apiRequest("PUT", `/api/mileage-entries/${editEntry.id}`, data)
        : await apiRequest("POST", "/api/mileage-entries", data);
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.message || "Błąd zapisu"); }
      return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mileage-entries"] }); setDialogOpen(false); toast({ title: editEntry ? "Wpis zaktualizowany" : "Wpis dodany" }); },
    onError: (err: any) => toast({ title: "Błąd zapisu", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/mileage-entries/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/mileage-entries"] }); setDeleteId(null); toast({ title: "Wpis usunięty" }); },
  });

  const handleSave = () => {
    if (!form.employeeId || !form.date || !form.fromLocation || !form.toLocation || !form.distanceKm) {
      toast({ title: "Uzupełnij wymagane pola", variant: "destructive" }); return;
    }
    saveMut.mutate({ employeeId: Number(form.employeeId), date: form.date, fromLocation: form.fromLocation, toLocation: form.toLocation, distanceKm: form.distanceKm, purpose: form.purpose || null });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={setThisMonth} data-testid="button-km-this-month">Ten miesiąc</Button>
          <Button size="sm" variant="outline" onClick={setPrevMonth} data-testid="button-km-prev-month">Poprzedni</Button>
          <Button size="sm" variant="outline" onClick={setThisYear} data-testid="button-km-this-year">Ten rok</Button>
        </div>
        <div className="flex gap-2 items-center">
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36 h-8 text-sm" data-testid="input-km-date-from" />
          <span className="text-muted-foreground text-sm">–</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36 h-8 text-sm" data-testid="input-km-date-to" />
        </div>
        <Select value={filterEmpId} onValueChange={setFilterEmpId}>
          <SelectTrigger className="w-48 h-8 text-sm" data-testid="select-km-employee">
            <SelectValue placeholder="Wszyscy pracownicy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy pracownicy</SelectItem>
            {(employees as Employee[]).filter(e => e.status === "AKTYWNY").map(e => (
              <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openAdd} data-testid="button-add-km">
          <Plus className="h-4 w-4 mr-1" /> Dodaj wpis
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-blue-500/10">
              <Car className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Łączne km</p>
              <p className="text-2xl font-bold" data-testid="text-km-total">{totalKm.toFixed(1)} km</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex items-center justify-center h-10 w-10 rounded-md bg-emerald-500/10">
              <Navigation className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Liczba przejazdów</p>
              <p className="text-2xl font-bold" data-testid="text-km-count">{entries.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-2">Podział per pracownik</p>
            {perEmployee.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak danych</p>
            ) : (
              <div className="space-y-1">
                {perEmployee.slice(0, 4).map(({ emp, km }) => (
                  <div key={emp.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground truncate">{emp.firstName} {emp.lastName}</span>
                    <span className="font-medium ml-2">{km.toFixed(1)} km</span>
                  </div>
                ))}
                {perEmployee.length > 4 && <p className="text-xs text-muted-foreground">+{perEmployee.length - 4} więcej</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Pracownik</TableHead>
                  <TableHead>Skąd</TableHead>
                  <TableHead>Dokąd</TableHead>
                  <TableHead className="text-right">km</TableHead>
                  <TableHead>Cel</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      <Car className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Brak wpisów kilometrówki w wybranym okresie
                    </TableCell>
                  </TableRow>
                ) : entries.map((entry: any) => {
                  const emp = empMap.get(entry.employeeId) as Employee | undefined;
                  return (
                    <TableRow key={entry.id} data-testid={`row-km-${entry.id}`}>
                      <TableCell className="text-sm">{entry.date}</TableCell>
                      <TableCell className="text-sm font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : `#${entry.employeeId}`}</TableCell>
                      <TableCell className="text-sm">{entry.fromLocation}</TableCell>
                      <TableCell className="text-sm">{entry.toLocation}</TableCell>
                      <TableCell className="text-sm text-right font-medium">{parseFloat(entry.distanceKm).toFixed(1)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{entry.purpose || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(entry)} data-testid={`button-edit-km-${entry.id}`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(entry.id)} data-testid={`button-delete-km-${entry.id}`}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editEntry ? "Edytuj wpis kilometrówki" : "Dodaj wpis kilometrówki"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Pracownik *</label>
              <Select value={form.employeeId} onValueChange={v => setForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger data-testid="select-km-form-employee"><SelectValue placeholder="Wybierz pracownika" /></SelectTrigger>
                <SelectContent>
                  {(employees as Employee[]).filter(e => e.status === "AKTYWNY").map(e => (
                    <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Data *</label>
              <Input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} data-testid="input-km-form-date" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Skąd *</label>
                <Input value={form.fromLocation} onChange={e => setForm(f => ({ ...f, fromLocation: e.target.value }))} placeholder="np. Gdańsk, biuro" data-testid="input-km-form-from" />
              </div>
              <div>
                <label className="text-sm font-medium">Dokąd *</label>
                <Input value={form.toLocation} onChange={e => setForm(f => ({ ...f, toLocation: e.target.value }))} placeholder="np. Gdynia" data-testid="input-km-form-to" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Odległość (km) *</label>
              <Input type="number" step="0.1" min="0" value={form.distanceKm} onChange={e => setForm(f => ({ ...f, distanceKm: e.target.value }))} placeholder="np. 25.5" data-testid="input-km-form-distance" />
            </div>
            <div>
              <label className="text-sm font-medium">Cel podróży</label>
              <Input value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="np. spotkanie z klientem" data-testid="input-km-form-purpose" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Anuluj</Button>
            <Button onClick={handleSave} disabled={saveMut.isPending} data-testid="button-save-km">
              {saveMut.isPending ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-1 inline-block" /> : null}
              Zapisz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteId} onOpenChange={open => { if (!open) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Usuń wpis</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Czy na pewno chcesz usunąć ten wpis kilometrówki? Operacja jest nieodwracalna.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Anuluj</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMut.mutate(deleteId)} disabled={deleteMut.isPending} data-testid="button-confirm-delete-km">
              Usuń
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TimeAdmin() {
  const [activeTab, setActiveTab] = useState("dashboard");

  return (
    <div className="space-y-6">
      <PageHeader
        title="RCP — Rejestrator Czasu Pracy"
        description="Panel administracyjny"
        icon={Clock}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto" data-testid="tabs-rcp-admin">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="obecnosci" data-testid="tab-obecnosci">Obecności</TabsTrigger>
          <TabsTrigger value="grafik" data-testid="tab-grafik">
            <CalendarRange className="h-4 w-4 mr-1 hidden sm:inline" />Grafik
          </TabsTrigger>
          <TabsTrigger value="urlopy" data-testid="tab-urlopy">
            <Palmtree className="h-4 w-4 mr-1 hidden sm:inline" />Urlopy
          </TabsTrigger>
          <TabsTrigger value="raporty" data-testid="tab-raporty">
            <FileBarChart className="h-4 w-4 mr-1 hidden sm:inline" />Raporty
          </TabsTrigger>
          <TabsTrigger value="lokalizacje" data-testid="tab-lokalizacje">Lokalizacje GPS</TabsTrigger>
          <TabsTrigger value="sledzenie" data-testid="tab-sledzenie">
            <Navigation className="h-4 w-4 mr-1 hidden sm:inline" />Śledzenie GPS
          </TabsTrigger>
          <TabsTrigger value="piny" data-testid="tab-piny">PINy</TabsTrigger>
          <TabsTrigger value="statystyki" data-testid="tab-statystyki">
            <BarChart3 className="h-4 w-4 mr-1 hidden sm:inline" />Statystyki
          </TabsTrigger>
          <TabsTrigger value="kilometrowka" data-testid="tab-kilometrowka">
            <Car className="h-4 w-4 mr-1 hidden sm:inline" />Kilometrówka
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-4">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="obecnosci" className="mt-4">
          <ObecnosciTab />
        </TabsContent>
        <TabsContent value="grafik" className="mt-4">
          <GrafikTab />
        </TabsContent>
        <TabsContent value="urlopy" className="mt-4">
          <UrlopyTab />
        </TabsContent>
        <TabsContent value="raporty" className="mt-4">
          <RaportyTab />
        </TabsContent>
        <TabsContent value="lokalizacje" className="mt-4">
          <LokalizacjeGPSTab />
        </TabsContent>
        <TabsContent value="sledzenie" className="mt-4">
          <GpsTrackingTab />
        </TabsContent>
        <TabsContent value="piny" className="mt-4">
          <PINyTab />
        </TabsContent>
        <TabsContent value="statystyki" className="mt-4">
          <StatystykiTab />
        </TabsContent>
        <TabsContent value="kilometrowka" className="mt-4">
          <KilometrówkaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}