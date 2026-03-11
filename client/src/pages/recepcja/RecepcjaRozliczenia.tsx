import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { HandCoins, Loader2, Check, X } from "lucide-react";

export default function RecepcjaRozliczenia() {
  const { toast } = useToast();

  const { data: subleases = [] } = useQuery({
    queryKey: ["/api/recepcja/subleases"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/subleases"); return r.json(); },
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ["/api/recepcja/apartments"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/apartments"); return r.json(); },
  });

  const activeSubleases = subleases.filter((s: any) => {
    const today = new Date().toISOString().slice(0, 10);
    return s.startDate <= today && s.endDate >= today;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <HandCoins className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-rozliczenia-title">Rozliczenia podnajmu</h1>
      </div>

      {activeSubleases.map((s: any) => (
        <SubleasePayments
          key={s.id}
          sublease={s}
          apartmentName={apartments.find((a: any) => a.id === s.apartmentId)?.name || '-'}
        />
      ))}

      {activeSubleases.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">Brak aktywnych podnajmów</Card>
      )}
    </div>
  );
}

function SubleasePayments({ sublease, apartmentName }: { sublease: any; apartmentName: string }) {
  const { toast } = useToast();
  const tenantName = sublease.tenantType === 'firma' ? (sublease.companyName || '-') : `${sublease.firstName || ''} ${sublease.lastName || ''}`.trim();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: [`/api/recepcja/subleases/${sublease.id}/payments`],
    queryFn: async () => { const r = await recepcjaFetch("GET", `/api/recepcja/subleases/${sublease.id}/payments`); return r.json(); },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/sublease-payments/${id}/status`, { status });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/recepcja/subleases/${sublease.id}/payments`] });
      toast({ title: "Zaktualizowano status płatności" });
    },
  });

  return (
    <Card className="p-4">
      <h2 className="font-semibold mb-2">{tenantName} — {apartmentName}</h2>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">Termin</th>
                <th className="p-2 text-left">Typ</th>
                <th className="p-2 text-right">Kwota</th>
                <th className="p-2 text-center">Status</th>
                <th className="p-2 text-center">Akcja</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="p-2">{p.dueDate}</td>
                  <td className="p-2">{p.type === 'kaucja' ? 'Kaucja' : 'Czynsz'}</td>
                  <td className="p-2 text-right">{Number(p.amount).toFixed(2)} PLN</td>
                  <td className="p-2 text-center">
                    <Badge variant={p.status === 'oplacona' ? 'default' : 'destructive'}>
                      {p.status === 'oplacona' ? 'Opłacona' : 'Do opłacenia'}
                    </Badge>
                  </td>
                  <td className="p-2 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleMutation.mutate({
                        id: p.id,
                        status: p.status === 'oplacona' ? 'do_oplacenia' : 'oplacona',
                      })}
                      disabled={toggleMutation.isPending}
                      className="h-7 text-xs"
                      data-testid={`button-toggle-payment-${p.id}`}
                    >
                      {p.status === 'oplacona' ? <X className="h-3 w-3 mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                      {p.status === 'oplacona' ? 'Cofnij' : 'Opłacone'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}