import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Clock, ChevronDown, ChevronUp, Navigation } from "lucide-react";
import type { Employee } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

interface GpsLocation {
  id: number;
  name: string;
  latitude: string | null;
  longitude: string | null;
  gpsRadius: number | null;
}

interface PerEmployeeData {
  employeeId: number;
  firstName: string;
  lastName: string;
  logCount: number;
  lastLat: string;
  lastLng: string;
  lastTimestamp: string;
  isOutsideZone: boolean;
}

function getInitials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default function GpsTrackingTab() {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [showLogs, setShowLogs] = useState(false);
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);

  const { data: allEmployeesRaw = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });
  const employees = allEmployeesRaw.filter((e: any) => !e.hideFromRcp);

  const { data: locations = [] } = useQuery<GpsLocation[]>({
    queryKey: ["/api/locations"],
  });

  const { data: perEmployee = [], isLoading: isLoadingPerEmployee } = useQuery<PerEmployeeData[]>({
    queryKey: ["/api/location-logs/per-employee", date],
    enabled: !!date,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/location-logs/per-employee?date=${date}`);
      return res.json();
    },
  });

  const { data: logs = [], isLoading: isLoadingLogs } = useQuery<LocationLog[]>({
    queryKey: ["/api/location-logs", selectedEmployeeId, date],
    enabled: !!selectedEmployeeId && !!date && showLogs,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/location-logs?employeeId=${selectedEmployeeId}&date=${date}`);
      return res.json();
    },
  });

  const { data: mapLogs = [], isLoading: isLoadingMapLogs } = useQuery<LocationLog[]>({
    queryKey: ["/api/location-logs/map", selectedEmployeeId, date],
    enabled: !!selectedEmployeeId && !!date,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/location-logs?employeeId=${selectedEmployeeId}&date=${date}`);
      return res.json();
    },
  });

  const selectedPerEmployee = perEmployee.find(p => p.employeeId === selectedEmployeeId) ?? null;

  const filteredMapLogs = useMemo(() => {
    if (!timeFrom && !timeTo) return mapLogs;
    return mapLogs.filter(log => {
      const t = new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":").slice(0, 5);
      if (timeFrom && t < timeFrom) return false;
      if (timeTo && t > timeTo) return false;
      return true;
    });
  }, [mapLogs, timeFrom, timeTo]);

  const filteredLogs = useMemo(() => {
    if (!timeFrom && !timeTo) return logs;
    return logs.filter(log => {
      const t = new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", hour12: false }).replace(".", ":").slice(0, 5);
      if (timeFrom && t < timeFrom) return false;
      if (timeTo && t > timeTo) return false;
      return true;
    });
  }, [logs, timeFrom, timeTo]);

  useEffect(() => {
    setShowLogs(false);
    setTimeFrom("");
    setTimeTo("");
  }, [selectedEmployeeId, date]);

  useEffect(() => {
    if (!selectedEmployeeId || !mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [54.35, 18.65],
      zoom: 13,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
    }).addTo(map);
    mapRef.current = map;

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }
      circlesRef.current.forEach(c => c.remove());
      circlesRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
    circlesRef.current.forEach(c => c.remove());
    circlesRef.current = [];

    locations.forEach(loc => {
      if (loc.latitude && loc.longitude && loc.gpsRadius) {
        const circle = L.circle(
          [parseFloat(loc.latitude), parseFloat(loc.longitude)],
          {
            radius: loc.gpsRadius,
            color: "#3b82f6",
            fillColor: "#3b82f680",
            fillOpacity: 0.15,
            weight: 2,
            dashArray: "5,5",
          }
        ).addTo(mapRef.current);
        circle.bindTooltip(loc.name, { permanent: false });
        circlesRef.current.push(circle);
      }
    });

    if (filteredMapLogs.length === 0) return;

    const points: [number, number][] = filteredMapLogs.map(l => [parseFloat(l.latitude), parseFloat(l.longitude)]);

    filteredMapLogs.forEach((log, idx) => {
      const lat = parseFloat(log.latitude);
      const lng = parseFloat(log.longitude);
      const dist = log.distanceFromZone ? parseFloat(log.distanceFromZone) : null;
      const isInZone = dist !== null && dist <= 0;
      const time = new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
      const isLast = idx === filteredMapLogs.length - 1;

      const iconHtml = `<div style="
        width: ${isLast ? 18 : 14}px; height: ${isLast ? 18 : 14}px; border-radius: 50%;
        background: ${isInZone ? '#22c55e' : '#ef4444'};
        border: ${isLast ? 3 : 2}px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      "></div>`;

      const icon = L.divIcon({
        html: iconHtml,
        className: "",
        iconSize: [isLast ? 18 : 14, isLast ? 18 : 14],
        iconAnchor: [isLast ? 9 : 7, isLast ? 9 : 7],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(mapRef.current);
      marker.bindPopup(`
        <div style="font-size: 13px;">
          <b>${time}</b><br/>
          Dokładność: ${parseFloat(log.accuracy).toFixed(1)}m<br/>
          ${dist !== null ? `Odległość od strefy: ${dist <= 0 ? '<span style="color:green">W strefie</span>' : `<span style="color:red">${dist.toFixed(0)}m</span>`}` : 'Brak strefy'}
          ${log.locationName ? `<br/>Lokalizacja: ${log.locationName}` : ''}
        </div>
      `);
      markersRef.current.push(marker);
    });

    if (points.length > 1) {
      polylineRef.current = L.polyline(points, {
        color: "#6366f1",
        weight: 2,
        opacity: 0.6,
        dashArray: "6,4",
      }).addTo(mapRef.current);
    }

    mapRef.current.fitBounds(L.latLngBounds(points).pad(0.2));
  }, [filteredMapLogs, locations]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const perEmployeeMap = new Map(perEmployee.map(p => [p.employeeId, p]));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-muted-foreground">Data:</label>
        <Input
          type="date"
          value={date}
          onChange={e => {
            setDate(e.target.value);
            setSelectedEmployeeId(null);
          }}
          className="w-auto"
          data-testid="input-gps-date"
        />
        {isLoadingPerEmployee && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {employees.map(emp => {
          const data = perEmployeeMap.get(emp.id);
          const hasLogs = !!data;
          const isSelected = selectedEmployeeId === emp.id;
          const isOutside = data?.isOutsideZone ?? false;

          return (
            <Card
              key={emp.id}
              data-testid={`card-employee-gps-${emp.id}`}
              onClick={() => hasLogs && setSelectedEmployeeId(isSelected ? null : emp.id)}
              className={[
                "p-3 transition-all",
                hasLogs ? "cursor-pointer hover:shadow-md" : "opacity-50 cursor-not-allowed",
                isSelected ? "ring-2 ring-primary shadow-md" : "",
              ].join(" ")}
            >
              <div className="flex items-start gap-2">
                <div className={[
                  "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white",
                  !hasLogs ? "bg-gray-400" : isOutside ? "bg-red-500" : "bg-green-500",
                ].join(" ")}>
                  {getInitials(emp.firstName, emp.lastName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">{emp.firstName} {emp.lastName}</div>
                  <div className="mt-1">
                    {!hasLogs ? (
                      <Badge variant="secondary" className="text-xs">Brak logów</Badge>
                    ) : isOutside ? (
                      <Badge variant="destructive" className="text-xs">Poza strefą</Badge>
                    ) : (
                      <Badge className="text-xs bg-green-600 hover:bg-green-700">W strefie</Badge>
                    )}
                  </div>
                  {data && (
                    <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                      <div className="flex items-center gap-1">
                        <Navigation className="h-3 w-3" />
                        {data.logCount} logów
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(data.lastTimestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {selectedEmployeeId && selectedPerEmployee && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">
              Trasa: {selectedPerEmployee.firstName} {selectedPerEmployee.lastName} — {new Date(date).toLocaleDateString("pl-PL")}
            </h3>
            {isLoadingMapLogs && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <Card className="overflow-hidden">
            <div
              ref={mapContainerRef}
              className="h-[420px] w-full"
              data-testid="map-gps-tracking"
              style={{ zIndex: 1 }}
            />
          </Card>

          {selectedPerEmployee.logCount > 0 && (
            <Card className="p-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span data-testid="text-log-count">
                    {(timeFrom || timeTo) ? `${filteredMapLogs.length} / ${selectedPerEmployee.logCount}` : selectedPerEmployee.logCount} wpisów GPS
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>Od:</span>
                    <Input type="time" value={timeFrom} onChange={e => setTimeFrom(e.target.value)} className="h-7 w-24 text-xs px-2" data-testid="input-time-from" />
                    <span>Do:</span>
                    <Input type="time" value={timeTo} onChange={e => setTimeTo(e.target.value)} className="h-7 w-24 text-xs px-2" data-testid="input-time-to" />
                    {(timeFrom || timeTo) && (
                      <button onClick={() => { setTimeFrom(""); setTimeTo(""); }} className="text-muted-foreground hover:text-foreground" data-testid="button-clear-time-filter">✕</button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLogs(v => !v)}
                    data-testid="button-toggle-logs"
                  >
                    {showLogs ? (
                      <><ChevronUp className="h-4 w-4 mr-1" />Ukryj</>
                    ) : (
                      <><ChevronDown className="h-4 w-4 mr-1" />Pokaż</>
                    )}
                  </Button>
                </div>
              </div>

              {showLogs && (
                <div className="mt-3">
                  {isLoadingLogs ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="p-2 text-left">Czas</th>
                            <th className="p-2 text-left">Współrzędne</th>
                            <th className="p-2 text-right">Dokładność</th>
                            <th className="p-2 text-center">Status strefy</th>
                            <th className="p-2 text-right">Odległość</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLogs.map(log => {
                            const dist = log.distanceFromZone ? parseFloat(log.distanceFromZone) : null;
                            const isIn = dist !== null && dist <= 0;
                            return (
                              <tr key={log.id} className="border-b hover:bg-muted/30" data-testid={`row-gps-log-${log.id}`}>
                                <td className="p-2">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    {new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                  </div>
                                </td>
                                <td className="p-2 font-mono text-xs">
                                  {parseFloat(log.latitude).toFixed(5)}, {parseFloat(log.longitude).toFixed(5)}
                                </td>
                                <td className="p-2 text-right">{parseFloat(log.accuracy).toFixed(1)}m</td>
                                <td className="p-2 text-center">
                                  {dist !== null ? (
                                    <Badge variant={isIn ? "default" : "destructive"} className={isIn ? "bg-green-600" : ""}>
                                      {isIn ? "W strefie" : "Poza strefą"}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </td>
                                <td className="p-2 text-right">
                                  {dist !== null ? (dist <= 0 ? "0m" : `${dist.toFixed(0)}m`) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {!selectedEmployeeId && !isLoadingPerEmployee && employees.length > 0 && (
        <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-select-employee-hint">
          Kliknij kafelek pracownika, aby zobaczyć jego trasę GPS
        </p>
      )}
    </div>
  );
}
