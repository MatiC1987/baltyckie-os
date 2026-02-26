import { useQuery } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";

export default function RecepcjaUmowy() {
  const { data: subleases = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/subleases"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/subleases"); return r.json(); },
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ["/api/recepcja/apartments"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/apartments"); return r.json(); },
  });

  const getAptName = (id: number) => apartments.find((a: any) => a.id === id)?.name || '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-umowy-title">Umowy podnajmu</h1>
        <Badge variant="secondary">{subleases.length}</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">Najemca</th>
                <th className="p-2 text-left">Apartament</th>
                <th className="p-2 text-left">Od</th>
                <th className="p-2 text-left">Do</th>
                <th className="p-2 text-right">Czynsz</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {subleases.map((s: any) => {
                const name = s.tenantType === 'company' ? s.companyName : `${s.firstName || ''} ${s.lastName || ''}`.trim();
                const isActive = s.startDate <= new Date().toISOString().slice(0, 10) && s.endDate >= new Date().toISOString().slice(0, 10);
                return (
                  <tr key={s.id} className="border-b hover:bg-muted/30">
                    <td className="p-2 font-medium">{name || '-'}</td>
                    <td className="p-2">{getAptName(s.apartmentId)}</td>
                    <td className="p-2">{s.startDate}</td>
                    <td className="p-2">{s.endDate}</td>
                    <td className="p-2 text-right">{Number(s.rentAmount || 0).toFixed(2)} PLN</td>
                    <td className="p-2 text-center">
                      <Badge variant={isActive ? "default" : "secondary"}>
                        {isActive ? "Aktywna" : "Nieaktywna"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {subleases.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Brak umów</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}