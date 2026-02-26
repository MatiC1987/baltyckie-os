import { useQuery } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Loader2 } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  GAZOWY: "Gazowy", ELEKTRYCZNY: "Elektryczny", KOMINIARSKI: "Kominiarski",
  WENTYLACYJNY: "Wentylacyjny", BUDOWLANY: "Budowlany", PPOZ: "P.poż.", INNE: "Inne",
};

export default function RecepcjaPrzeglady() {
  const { data: inspections = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/technical-inspections"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/technical-inspections"); return r.json(); },
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ["/api/recepcja/apartments"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/apartments"); return r.json(); },
  });

  const today = new Date().toISOString().slice(0, 10);
  const getAptName = (id: number) => apartments.find((a: any) => a.id === id)?.name || '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-przeglady-title">Przeglądy</h1>
        <Badge variant="secondary">Tylko podgląd</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">Apartament</th>
                <th className="p-2 text-left">Typ</th>
                <th className="p-2 text-left">Ostatni</th>
                <th className="p-2 text-left">Następny</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-left">Wykonawca</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((i: any) => {
                const overdue = i.nextDate && i.nextDate < today;
                return (
                  <tr key={i.id} className={`border-b hover:bg-muted/30 ${overdue ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                    <td className="p-2">{getAptName(i.apartmentId)}</td>
                    <td className="p-2">{TYPE_LABELS[i.inspectionType] || i.inspectionType}</td>
                    <td className="p-2">{i.lastDate || '-'}</td>
                    <td className="p-2">{i.nextDate || '-'}</td>
                    <td className="p-2 text-center">
                      <Badge variant={overdue ? 'destructive' : i.status === 'WYKONANY' ? 'default' : 'secondary'}>
                        {overdue ? 'Przeterminowany' : i.status === 'WYKONANY' ? 'Wykonany' : 'Zaplanowany'}
                      </Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">{i.contractor || '-'}</td>
                  </tr>
                );
              })}
              {inspections.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Brak przeglądów</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}