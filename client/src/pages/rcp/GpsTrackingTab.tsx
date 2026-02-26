import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin, Navigation, Clock, AlertTriangle, CheckCircle } from "lucide-react";
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

export default function GpsTrackingTab() {
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const circlesRef = useRef<any[]>([]);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const { data: locations = [] } = useQuery<GpsLocation[]>({
    queryKey: ["/api/locations"],
  });

  const { data: logs = [], isLoading } = useQuery<LocationLog[]>({
    queryKey: ["/api/location-logs", selectedEmployee, date],
    enabled: !!selectedEmployee && !!date,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/location-logs?employeeId=${selectedEmployee}&date=${date}`);
      return res.json();
    },
  });

  const { data: summary } = useQuery<{ totalEmployees: number; totalLogs: number; outsideZone: number }>({
    queryKey: ["/api/location-logs/summary", date],
    enabled: !!date,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/location-logs/summary?date=${date}`);
      return res.json();
    },
  });

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const initMap = () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }

      const map = L.map(mapContainerRef.current!, {
        center: [54.35, 18.65],
        zoom: 13,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      mapRef.current = map;
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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

    if (logs.length === 0) return;

    const points: [number, number][] = logs.map(l => [parseFloat(l.latitude), parseFloat(l.longitude)]);

    logs.forEach((log, idx) => {
      const lat = parseFloat(log.latitude);
      const lng = parseFloat(log.longitude);
      const dist = log.distanceFromZone ? parseFloat(log.distanceFromZone) : null;
      const isInZone = dist !== null && dist <= 0;
      const time = new Date(log.timestamp).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });

      const iconHtml = `<div style="
        width: 14px; height: 14px; border-radius: 50%;
        background: ${isInZone ? '#22c55e' : '#ef4444'};
        border: 2px solid white;
        box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        ${idx === logs.length - 1 ? 'width: 18px; height: 18px; border: 3px solid white;' : ''}
      "></div>`;

      const icon = L.divIcon({
        html: iconHtml,
        className: "",
        iconSize: [idx === logs.length - 1 ? 18 : 14, idx === logs.length - 1 ? 18 : 14],
        iconAnchor: [idx === logs.length - 1 ? 9 : 7, idx === logs.length - 1 ? 9 : 7],
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
  }, [logs, locations]);

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
          <div className="text-2xl font-bold" data-testid="text-total-logs">{summary?.totalLogs ?? 0}</div>
          <div className="text-xs text-muted-foreground">{summary?.totalEmployees ?? 0} pracowników</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-1">
            <CheckCircle className="h-4 w-4" />
            W strefie
          </div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-in-zone">{inZoneCount}</div>
          <div className="text-xs text-muted-foreground">z {logs.length} logów wybranego pracownika</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-1">
            <AlertTriangle className="h-4 w-4" />
            Poza strefą
          </div>
          <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-out-zone">{outZoneCount}</div>
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
              <SelectTrigger data-testid="select-employee-gps">
                <SelectValue placeholder="Wybierz pracownika" />
              </SelectTrigger>
              <SelectContent>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={String(emp.id)}>
                    {emp.firstName} {emp.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data</label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-auto"
              data-testid="input-gps-date"
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div
          ref={mapContainerRef}
          className="h-[400px] w-full"
          data-testid="map-gps-tracking"
          style={{ zIndex: 1 }}
        />
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && logs.length > 0 && (
        <Card className="overflow-x-auto">
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
              {logs.map((log) => {
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
        </Card>
      )}

      {!isLoading && selectedEmployee && logs.length === 0 && (
        <Card className="p-8 text-center">
          <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground" data-testid="text-no-gps-logs">Brak logów GPS dla wybranego pracownika w tym dniu</p>
        </Card>
      )}
    </div>
  );
}