import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Gauge, Plus, Loader2 } from "lucide-react";

const METER_TYPES: Record<string, string> = {
  PRAD: "Prąd (kWh)", WODA_ZIMNA: "Woda zimna (m³)", WODA_CIEPLA: "Woda ciepła (m³)",
};

export default function RecepcjaLiczniki() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedSublease, setSelectedSublease] = useState<any>(null);

  const { data: subleases = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/meter-subleases"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/meter-subleases"); return r.json(); },
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await recepcjaFetch("POST", "/api/recepcja/meter-readings", data);
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/meter-subleases"] });
      setShowAdd(false);
      toast({ title: "Dodano odczyt" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-liczniki-title">Liczniki</h1>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-reading">
          <Plus className="h-4 w-4 mr-1" /> Nowy odczyt
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : subleases.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Brak podnajmów z rozliczeniem liczników</Card>
      ) : (
        <div className="grid gap-4">
          {subleases.map((s: any) => (
            <SubleaseMeters key={s.id} sublease={s} />
          ))}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nowy odczyt licznika</DialogTitle></DialogHeader>
          <MeterReadingForm subleases={subleases} onSubmit={(data) => addMutation.mutate(data)} isPending={addMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SubleaseMeters({ sublease }: { sublease: any }) {
  const { data, isLoading } = useQuery({
    queryKey: [`/api/recepcja/meter-readings/${sublease.id}`],
    queryFn: async () => { const r = await recepcjaFetch("GET", `/api/recepcja/meter-readings/${sublease.id}`); return r.json(); },
  });

  const tenantName = sublease.tenantType === 'company' ? sublease.companyName : `${sublease.firstName || ''} ${sublease.lastName || ''}`.trim();

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2">{sublease.apartmentName} — {tenantName || 'Najemca'}</h3>
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/50">
              <th className="p-2 text-left">Typ</th>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-right">Odczyt</th>
            </tr></thead>
            <tbody>
              {data?.readings?.slice(0, 10).map((r: any) => (
                <tr key={r.id} className="border-b">
                  <td className="p-2">{METER_TYPES[r.meterType] || r.meterType}</td>
                  <td className="p-2">{r.readingDate}</td>
                  <td className="p-2 text-right font-mono">{r.reading}</td>
                </tr>
              ))}
              {(!data?.readings || data.readings.length === 0) && (
                <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">Brak odczytów</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function MeterReadingForm({ subleases, onSubmit, isPending }: any) {
  const [subleaseId, setSubleaseId] = useState("");
  const [meterType, setMeterType] = useState("PRAD");
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10));
  const [readingValue, setReadingValue] = useState("");

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Apartament</Label>
        <Select value={subleaseId} onValueChange={setSubleaseId}>
          <SelectTrigger data-testid="select-meter-sublease"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
          <SelectContent>
            {subleases.map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.apartmentName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label>Typ licznika</Label>
        <Select value={meterType} onValueChange={setMeterType}>
          <SelectTrigger data-testid="select-meter-type"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(METER_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><Label>Data odczytu</Label><Input type="date" value={readingDate} onChange={e => setReadingDate(e.target.value)} data-testid="input-meter-date" /></div>
      <div className="space-y-1"><Label>Wartość</Label><Input type="number" step="0.001" value={readingValue} onChange={e => setReadingValue(e.target.value)} placeholder="0.000" data-testid="input-meter-value" /></div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ subleaseId: Number(subleaseId), meterType, readingDate, readingValue })} disabled={isPending || !subleaseId || !readingValue} data-testid="button-save-reading">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Zapisz odczyt
        </Button>
      </DialogFooter>
    </div>
  );
}