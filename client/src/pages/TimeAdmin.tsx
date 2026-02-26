import { useState, useEffect, useMemo } from "react";
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
  KeyRound, CalendarRange, Palmtree, FileBarChart,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import GrafikTab from "@/pages/rcp/GrafikTab";
import UrlopyTab from "@/pages/rcp/UrlopyTab";
import RaportyTab from "@/pages/rcp/RaportyTab";
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
  });

  const rejectMut = useMutation({
    mutationFn: async ({ id, adminNote }: { id: number; adminNote?: string }) => {
      await apiRequest("PUT", `/api/time-entries/${id}/reject`, { adminNote });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rcp/dashboard"] });
      toast({ title: "Wpis odrzucony" });
    },
  });

  const [noteValues, setNoteValues] = useState<Record<number, string>>({});

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const { working = 0, onBreak = 0, pendingCount = 0, pendingEntries = [], employeeStatuses = [] } = data || {};

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
              <Card key={emp.id} data-testid={`card-employee-${emp.id}`}>
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
      await apiRequest("PUT", `/api/time-entries/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/day"] });
      toast({ title: "Wpis zaktualizowany" });
      setEditMode(false);
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
      .filter(e => e.status === "AKTYWNY")
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
                            max={500}
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

  const activeEmployees = (employees || []).filter(e => e.status === "AKTYWNY");

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
          <TabsTrigger value="piny" data-testid="tab-piny">PINy</TabsTrigger>
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
        <TabsContent value="piny" className="mt-4">
          <PINyTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}