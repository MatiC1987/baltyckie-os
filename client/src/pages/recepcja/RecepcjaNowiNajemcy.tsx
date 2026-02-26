import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Plus, Upload, Download, Loader2 } from "lucide-react";
import { useRef } from "react";

const STATUS_LABELS: Record<string, string> = {
  NOWE: "Nowe", UMOWA_WYGENEROWANA: "Umowa wygenerowana", DO_PODPISANIA: "Do podpisania",
  PODPISANA_SKAN: "Skan podpisanej", ZATWIERDZONA: "Zatwierdzona",
};
const STATUS_COLORS: Record<string, string> = {
  NOWE: "secondary", UMOWA_WYGENEROWANA: "secondary", DO_PODPISANIA: "default",
  PODPISANA_SKAN: "default", ZATWIERDZONA: "default",
};

export default function RecepcjaNowiNajemcy() {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/tenant-submissions"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/tenant-submissions"); return r.json(); },
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ["/api/recepcja/apartments"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/apartments"); return r.json(); },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await recepcjaFetch("POST", "/api/recepcja/tenant-submissions", data);
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tenant-submissions"] });
      setShowAdd(false);
      toast({ title: "Przesłano dane najemcy" });
    },
  });

  const uploadSignedMutation = useMutation({
    mutationFn: async ({ id, file }: { id: number; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('recepcja_token');
      const r = await fetch(`/api/recepcja/tenant-submissions/${id}/upload-signed`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData,
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tenant-submissions"] });
      toast({ title: "Przesłano podpisaną umowę" });
    },
  });

  const downloadContract = async (id: number) => {
    const token = localStorage.getItem('recepcja_token');
    const r = await fetch(`/api/recepcja/tenant-submissions/${id}/contract-pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { toast({ title: "Umowa nie jest jeszcze dostępna", variant: "destructive" }); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `umowa_${id}.pdf`; a.click();
    URL.revokeObjectURL(url);
  };

  const getAptName = (id: number) => apartments.find((a: any) => a.id === id)?.name || '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-nowi-najemcy-title">Nowi najemcy</h1>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} data-testid="button-add-tenant">
          <Plus className="h-4 w-4 mr-1" /> Nowy najemca
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {submissions.map((s: any) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="font-semibold">{s.tenantName}</div>
                  <div className="text-sm text-muted-foreground">{getAptName(s.apartmentId)} | Od: {s.moveInDate || '-'}</div>
                  <div className="text-sm text-muted-foreground">{s.tenantPhone} | {s.tenantEmail}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={STATUS_COLORS[s.status] as any}>{STATUS_LABELS[s.status] || s.status}</Badge>
                </div>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                {['DO_PODPISANIA', 'UMOWA_WYGENEROWANA', 'PODPISANA_SKAN', 'ZATWIERDZONA'].includes(s.status) && (
                  <Button variant="outline" size="sm" onClick={() => downloadContract(s.id)} data-testid={`button-download-contract-${s.id}`}>
                    <Download className="h-3 w-3 mr-1" /> Pobierz umowę
                  </Button>
                )}
                {s.status === 'DO_PODPISANIA' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = '.pdf';
                        input.onchange = (e: any) => {
                          if (e.target.files?.[0]) uploadSignedMutation.mutate({ id: s.id, file: e.target.files[0] });
                        };
                        input.click();
                      }}
                      disabled={uploadSignedMutation.isPending}
                      data-testid={`button-upload-signed-${s.id}`}
                    >
                      <Upload className="h-3 w-3 mr-1" /> Prześlij podpisaną
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
          {submissions.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">Brak zgłoszeń najemców</Card>
          )}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Dane nowego najemcy</DialogTitle></DialogHeader>
          <TenantForm apartments={apartments} onSubmit={(data) => createMutation.mutate(data)} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TenantForm({ apartments, onSubmit, isPending }: any) {
  const [form, setForm] = useState({
    tenantName: "", tenantPesel: "", tenantNip: "", tenantEmail: "", tenantPhone: "",
    tenantAddress: "", apartmentId: "", moveInDate: "", rentAmount: "", depositAmount: "", notes: "",
  });
  const update = (key: string, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="space-y-3">
      <div className="space-y-1"><Label>Imię i nazwisko *</Label><Input value={form.tenantName} onChange={e => update('tenantName', e.target.value)} data-testid="input-tenant-name" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>PESEL</Label><Input value={form.tenantPesel} onChange={e => update('tenantPesel', e.target.value)} data-testid="input-tenant-pesel" /></div>
        <div className="space-y-1"><Label>NIP</Label><Input value={form.tenantNip} onChange={e => update('tenantNip', e.target.value)} data-testid="input-tenant-nip" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Email</Label><Input type="email" value={form.tenantEmail} onChange={e => update('tenantEmail', e.target.value)} data-testid="input-tenant-email" /></div>
        <div className="space-y-1"><Label>Telefon</Label><Input value={form.tenantPhone} onChange={e => update('tenantPhone', e.target.value)} data-testid="input-tenant-phone" /></div>
      </div>
      <div className="space-y-1"><Label>Adres</Label><Input value={form.tenantAddress} onChange={e => update('tenantAddress', e.target.value)} data-testid="input-tenant-address" /></div>
      <div className="space-y-1">
        <Label>Apartament</Label>
        <Select value={form.apartmentId} onValueChange={v => update('apartmentId', v)}>
          <SelectTrigger data-testid="select-tenant-apartment"><SelectValue placeholder="Wybierz..." /></SelectTrigger>
          <SelectContent>{apartments.map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1"><Label>Data wejścia</Label><Input type="date" value={form.moveInDate} onChange={e => update('moveInDate', e.target.value)} data-testid="input-tenant-movein" /></div>
        <div className="space-y-1"><Label>Czynsz</Label><Input type="number" step="0.01" value={form.rentAmount} onChange={e => update('rentAmount', e.target.value)} data-testid="input-tenant-rent" /></div>
        <div className="space-y-1"><Label>Kaucja</Label><Input type="number" step="0.01" value={form.depositAmount} onChange={e => update('depositAmount', e.target.value)} data-testid="input-tenant-deposit" /></div>
      </div>
      <div className="space-y-1"><Label>Uwagi</Label><Textarea value={form.notes} onChange={e => update('notes', e.target.value)} rows={3} data-testid="input-tenant-notes" /></div>
      <DialogFooter>
        <Button onClick={() => onSubmit({ ...form, apartmentId: form.apartmentId ? Number(form.apartmentId) : null })} disabled={isPending || !form.tenantName} data-testid="button-save-tenant">
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
          Prześlij dane
        </Button>
      </DialogFooter>
    </div>
  );
}