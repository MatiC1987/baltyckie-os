import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileBarChart, Loader2, Plane, PlaneLanding, CreditCard, Gauge, CheckSquare, Clock } from "lucide-react";

export default function RecepcjaRaportDzienny() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading } = useQuery({
    queryKey: [`/api/recepcja/daily-report?date=${date}`],
    queryFn: async () => { const r = await recepcjaFetch("GET", `/api/recepcja/daily-report?date=${date}`); return r.json(); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileBarChart className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-raport-title">Raport dzienny</h1>
        </div>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-auto" data-testid="input-report-date" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !data ? (
        <Card className="p-8 text-center text-muted-foreground">Brak danych</Card>
      ) : (
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="font-semibold mb-2 flex items-center gap-2"><Plane className="h-4 w-4 text-green-600" /> Przyjazdy ({data.arrivals?.length || 0})</h2>
            {data.arrivals?.length > 0 ? (
              <div className="space-y-1">{data.arrivals.map((r: any) => (
                <div key={r.id} className="text-sm flex justify-between border-b py-1">
                  <span>{r.guestName}</span><span className="text-muted-foreground">Apt #{r.apartmentId}</span>
                </div>
              ))}</div>
            ) : <p className="text-sm text-muted-foreground">Brak przyjazdów</p>}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold mb-2 flex items-center gap-2"><PlaneLanding className="h-4 w-4 text-blue-600" /> Wyjazdy ({data.departures?.length || 0})</h2>
            {data.departures?.length > 0 ? (
              <div className="space-y-1">{data.departures.map((r: any) => (
                <div key={r.id} className="text-sm flex justify-between border-b py-1">
                  <span>{r.guestName}</span><span className="text-muted-foreground">Apt #{r.apartmentId}</span>
                </div>
              ))}</div>
            ) : <p className="text-sm text-muted-foreground">Brak wyjazdów</p>}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold mb-2 flex items-center gap-2"><CreditCard className="h-4 w-4 text-green-600" /> Płatności ({data.paidToday?.length || 0})</h2>
            {data.paidToday?.length > 0 ? (
              <div className="space-y-1">{data.paidToday.map((p: any) => (
                <div key={p.id} className="text-sm flex justify-between border-b py-1">
                  <span>Podnajem #{p.subleaseId}</span><span className="font-medium">{Number(p.amount).toFixed(2)} PLN</span>
                </div>
              ))}</div>
            ) : <p className="text-sm text-muted-foreground">Brak płatności</p>}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold mb-2 flex items-center gap-2"><Gauge className="h-4 w-4 text-orange-600" /> Odczyty liczników ({data.meterReadings?.length || 0})</h2>
            {data.meterReadings?.length > 0 ? (
              <div className="space-y-1">{data.meterReadings.map((m: any) => (
                <div key={m.id} className="text-sm flex justify-between border-b py-1">
                  <span>{m.meterType}</span><span className="font-mono">{m.readingValue}</span>
                </div>
              ))}</div>
            ) : <p className="text-sm text-muted-foreground">Brak odczytów</p>}
          </Card>

          <Card className="p-4">
            <h2 className="font-semibold mb-2 flex items-center gap-2"><Clock className="h-4 w-4 text-purple-600" /> Wpisy RCP ({data.timeEntries?.length || 0})</h2>
            {data.timeEntries?.length > 0 ? (
              <div className="space-y-1">{data.timeEntries.map((e: any) => (
                <div key={e.id} className="text-sm flex justify-between border-b py-1">
                  <span>Pracownik #{e.employeeId}</span>
                  <span className="text-muted-foreground">{e.clockIn ? new Date(e.clockIn).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                </div>
              ))}</div>
            ) : <p className="text-sm text-muted-foreground">Brak wpisów</p>}
          </Card>
        </div>
      )}
    </div>
  );
}