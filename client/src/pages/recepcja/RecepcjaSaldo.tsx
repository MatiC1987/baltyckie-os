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
import { Wallet, Plus, Trash2, Edit, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { pl } from "date-fns/locale";

export default function RecepcjaSaldo() {
  const [showAdd, setShowAdd] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const { toast } = useToast();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/saldo"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/saldo"); return r.json(); },
  });

  const { data: initialBalance } = useQuery({
    queryKey: ["/api/recepcja/saldo/initial-balance"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/saldo/initial-balance"); return r.json(); },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["/api/recepcja/saldo/categories"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/saldo/categories"); return r.json(); },
  });

  const currentBalance = (Number(initialBalance?.initialBalance || 0) +
    entries.reduce((sum: number, e: any) => sum + Number(e.cashAmount || 0), 0)).toFixed(2);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await recepcjaFetch("POST", "/api/recepcja/saldo", data);
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo"] });
      setShowAdd(false);
      toast({ title: "Dodano wpis" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/saldo/${id}`, data);
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo"] });
      setEditEntry(null);
      toast({ title: "Zaktualizowano wpis" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await recepcjaFetch("DELETE", `/api/recepcja/saldo/${id}`);
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/saldo"] });
      toast({ title: "Usunięto wpis" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-recepcja-saldo-title">Saldo</h1>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-saldo-add">
          <Plus className="h-4 w-4 mr-1" /> Dodaj wpis
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Saldo początkowe</div>
          <div className="text-xl font-bold">{Number(initialBalance?.initialBalance || 0).toFixed(2)} PLN</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Saldo bieżące</div>
          <div className={`text-xl font-bold ${Number(currentBalance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {currentBalance} PLN
          </div>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Operacja</th>
                <th className="p-2 text-left">Kategoria</th>
                <th className="p-2 text-right">Gotówka</th>
                <th className="p-2 text-right">Karta</th>
                <th className="p-2 text-center w-20">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e: any) => (
                <tr key={e.id} className="border-b hover:bg-muted/30">
                  <td className="p-2 whitespace-nowrap">{e.date}</td>
                  <td className="p-2">{e.operationName}</td>
                  <td className="p-2">{e.category || '-'}</td>
                  <td className={`p-2 text-right ${Number(e.cashAmount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Number(e.cashAmount || 0).toFixed(2)}
                  </td>
                  <td className="p-2 text-right text-muted-foreground">{Number(e.cardAmount || 0).toFixed(2)}</td>
                  <td className="p-2 text-center">
                    <div className="flex gap-1 justify-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditEntry(e)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(e.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Brak wpisów</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <SaldoEntryDialog
        open={showAdd || !!editEntry}
        onClose={() => { setShowAdd(false); setEditEntry(null); }}
        onSubmit={(data) => editEntry ? updateMutation.mutate({ id: editEntry.id, ...data }) : createMutation.mutate(data)}
        entry={editEntry}
        categories={categories}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}

function SaldoEntryDialog({ open, onClose, onSubmit, entry, categories, isPending }: any) {
  const [date, setDate] = useState(entry?.date || new Date().toISOString().slice(0, 10));
  const [operationName, setOperationName] = useState(entry?.operationName || "");
  const [entryKind, setEntryKind] = useState(entry?.entryKind || "PRZYCHOD");
  const [cashAmount, setCashAmount] = useState(entry?.cashAmount || "0");
  const [cardAmount, setCardAmount] = useState(entry?.cardAmount || "0");
  const [category, setCategory] = useState(entry?.category || "");

  const handleSubmit = () => {
    const cash = entryKind === 'KOSZT' ? -Math.abs(Number(cashAmount)) : Math.abs(Number(cashAmount));
    const card = entryKind === 'KOSZT' ? -Math.abs(Number(cardAmount)) : Math.abs(Number(cardAmount));
    onSubmit({ date, operationName, entryKind, cashAmount: String(cash), cardAmount: String(card), category });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Edytuj wpis" : "Nowy wpis"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Data</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-saldo-date" /></div>
          <div className="space-y-1"><Label>Operacja</Label><Input value={operationName} onChange={e => setOperationName(e.target.value)} data-testid="input-saldo-operation" /></div>
          <div className="space-y-1">
            <Label>Typ</Label>
            <Select value={entryKind} onValueChange={setEntryKind}>
              <SelectTrigger data-testid="select-saldo-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PRZYCHOD">Przychód</SelectItem>
                <SelectItem value="KOSZT">Koszt</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Gotówka</Label><Input type="number" step="0.01" value={cashAmount} onChange={e => setCashAmount(e.target.value)} data-testid="input-saldo-cash" /></div>
            <div className="space-y-1"><Label>Karta</Label><Input type="number" step="0.01" value={cardAmount} onChange={e => setCardAmount(e.target.value)} data-testid="input-saldo-card" /></div>
          </div>
          <div className="space-y-1"><Label>Kategoria</Label><Input value={category} onChange={e => setCategory(e.target.value)} list="saldo-cats" data-testid="input-saldo-category" />
            <datalist id="saldo-cats">{categories.map((c: any) => <option key={c.id} value={c.name} />)}</datalist>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSubmit} disabled={isPending || !operationName} data-testid="button-saldo-save">
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}