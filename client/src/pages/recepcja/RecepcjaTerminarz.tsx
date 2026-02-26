import { useQuery } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Loader2 } from "lucide-react";

export default function RecepcjaTerminarz() {
  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/reservations"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/reservations"); return r.json(); },
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ["/api/recepcja/apartments"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/apartments"); return r.json(); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = reservations
    .filter((r: any) => r.startDate >= today && r.status !== 'ANULOWANA')
    .sort((a: any, b: any) => a.startDate.localeCompare(b.startDate))
    .slice(0, 50);

  const getAptName = (id: number) => apartments.find((a: any) => a.id === id)?.name || '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-terminarz-title">Terminarz</h1>
        <Badge variant="secondary">Tylko podgląd</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">Przyjazd</th>
                <th className="p-2 text-left">Wyjazd</th>
                <th className="p-2 text-left">Gość</th>
                <th className="p-2 text-left">Apartament</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-left">Źródło</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="p-2">{r.startDate}</td>
                  <td className="p-2">{r.endDate}</td>
                  <td className="p-2 font-medium">{r.guestName}</td>
                  <td className="p-2">{getAptName(r.apartmentId)}</td>
                  <td className="p-2 text-center">
                    <Badge variant={r.status === 'PRZYJETA' ? 'default' : r.status === 'ANULOWANA' ? 'destructive' : 'secondary'}>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="p-2 text-muted-foreground">{r.source || '-'}</td>
                </tr>
              ))}
              {upcoming.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Brak nadchodzących rezerwacji</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}