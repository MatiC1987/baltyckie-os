import { useQuery } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { Card } from "@/components/ui/card";
import { History, Loader2 } from "lucide-react";

const FIELD_LABELS: Record<string, string> = {
  rentAmount: "Czynsz", startDate: "Data rozpoczęcia", endDate: "Data zakończenia",
  firstName: "Imię", lastName: "Nazwisko", companyName: "Firma", phone: "Telefon",
  email: "Email", depositAmount: "Kaucja", notes: "Uwagi", mediaByMeters: "Rozliczenie mediów",
};

export default function RecepcjaHistoriaUmow() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/sublease-history"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/sublease-history"); return r.json(); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-historia-title">Historia zmian umów</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : history.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Brak zmian do wyświetlenia</Card>
      ) : (
        <div className="space-y-2">
          {history.map((h: any) => (
            <Card key={h.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium">
                    Umowa #{h.subleaseId} — {FIELD_LABELS[h.fieldName] || h.fieldName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    <span className="line-through">{h.oldValue || '(brak)'}</span>
                    {' → '}
                    <span className="font-medium text-foreground">{h.newValue || '(brak)'}</span>
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                  <div>{h.changedBy || 'System'}</div>
                  <div>{h.createdAt ? new Date(h.createdAt).toLocaleString('pl-PL') : ''}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}