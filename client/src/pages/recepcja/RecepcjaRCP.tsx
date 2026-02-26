import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Clock, Users, Calendar, FileText, MapPin, Key, Loader2, Check, X, ChevronLeft, ChevronRight } from "lucide-react";

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
  const { data: employees = [] } = useQuery({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/rcp/employees"); return r.json(); },
  });
  const { data: entries = [] } = useQuery({
    queryKey: [`/api/recepcja/rcp/time-entries?date=${date}`],
    queryFn: async () => { const r = await recepcjaFetch("GET", `/api/recepcja/rcp/time-entries?date=${date}`); return r.json(); },
  });

  const changeDate = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" />
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => changeDate(1)}><ChevronRight className="h-4 w-4" /></Button>
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
                <tr key={e.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : `#${e.employeeId}`}</td>
                  <td className="p-2">{e.clockIn ? new Date(e.clockIn).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="p-2">{e.clockOut ? new Date(e.clockOut).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="p-2">{e.totalBreakMinutes ? `${e.totalBreakMinutes} min` : '-'}</td>
                  <td className="p-2 text-center">{e.isOutsideZone ? <Badge variant="destructive">Tak</Badge> : '-'}</td>
                  <td className="p-2 text-center">
                    <Badge variant={e.status === 'ZAAKCEPTOWANY' ? 'default' : e.status === 'ODRZUCONY' ? 'destructive' : 'secondary'}>
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
    </div>
  );
}

function RCPGrafik() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: schedules = [] } = useQuery({
    queryKey: [`/api/recepcja/rcp/work-schedules?month=${month}&year=${year}`],
    queryFn: async () => { const r = await recepcjaFetch("GET", `/api/recepcja/rcp/work-schedules?month=${month}&year=${year}`); return r.json(); },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/rcp/employees"); return r.json(); },
  });

  const daysInMonth = new Date(year, month, 0).getDate();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <SelectItem key={m} value={String(m)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2025,2026,2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <Card className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-1 text-left sticky left-0 bg-muted/50 min-w-[120px]">Pracownik</th>
              {Array.from({ length: daysInMonth }, (_, i) => (
                <th key={i} className="p-1 text-center min-w-[28px]">{i + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp: any) => (
              <tr key={emp.id} className="border-b">
                <td className="p-1 font-medium sticky left-0 bg-card">{emp.firstName} {emp.lastName?.charAt(0)}.</td>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const d = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                  const sched = schedules.find((s: any) => s.employeeId === emp.id && s.date === d);
                  const label = sched?.shiftType?.charAt(0) || '';
                  const colors: Record<string, string> = { R: 'bg-yellow-200 dark:bg-yellow-900', D: 'bg-blue-200 dark:bg-blue-900', P: 'bg-purple-200 dark:bg-purple-900', N: 'bg-gray-300 dark:bg-gray-700' };
                  return (
                    <td key={i} className={`p-1 text-center ${colors[label] || ''}`}>
                      {label}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
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
  return <Card className="p-8 text-center text-muted-foreground">Raporty RCP - dostępne wkrótce</Card>;
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