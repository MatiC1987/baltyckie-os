import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Upload, Download, Loader2, FileText, CheckCircle, XCircle, Filter } from "lucide-react";

export default function RecepcjaDokumenty() {
  const [tab, setTab] = useState<"invoices" | "notes" | "media">("invoices");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-dokumenty-title">Dokumenty</h1>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant={tab === "invoices" ? "default" : "outline"} size="sm" onClick={() => setTab("invoices")} data-testid="tab-invoices">Faktury kosztowe</Button>
        <Button variant={tab === "notes" ? "default" : "outline"} size="sm" onClick={() => setTab("notes")} data-testid="tab-notes">Noty księgowe</Button>
        <Button variant={tab === "media" ? "default" : "outline"} size="sm" onClick={() => setTab("media")} data-testid="tab-media">Rozliczenia mediów</Button>
      </div>
      {tab === "invoices" ? <CostInvoicesTab /> : tab === "notes" ? <AccountingNotesTab /> : <MediaSettlementsTab />}
    </div>
  );
}

function CostInvoicesTab() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/cost-invoices"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/cost-invoices"); return r.json(); },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const token = localStorage.getItem('recepcja_token');
      const r = await fetch('/api/recepcja/cost-invoices/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/cost-invoices"] });
      toast({ title: "Przesłano fakturę" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const handleFiles = (files: FileList) => {
    for (const file of Array.from(files)) {
      uploadMutation.mutate(file);
    }
  };

  return (
    <>
      <div
        className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files); }}
        data-testid="dropzone-cost-invoices"
      >
        <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Przeciągnij pliki lub kliknij aby wybrać</p>
        <p className="text-xs text-muted-foreground mt-1">PDF, PNG, JPG (max 20MB)</p>
        <input ref={fileRef} type="file" className="hidden" multiple accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={e => e.target.files && handleFiles(e.target.files)} />
      </div>

      {uploadMutation.isPending && <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Przesyłanie...</div>}

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="p-2 text-left">Plik</th>
            <th className="p-2 text-left">Data faktury</th>
            <th className="p-2 text-center">Status</th>
            <th className="p-2 text-left">Przesłał</th>
          </tr></thead>
          <tbody>
            {invoices.map((inv: any) => (
              <tr key={inv.id} className="border-b hover:bg-muted/30">
                <td className="p-2 flex items-center gap-1"><FileText className="h-3 w-3" />{inv.originalFileName || inv.fileName}</td>
                <td className="p-2">{inv.invoiceDate}</td>
                <td className="p-2 text-center"><Badge variant="secondary">{inv.status}</Badge></td>
                <td className="p-2 text-muted-foreground">{inv.uploadedBy || '-'}</td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Brak faktur</td></tr>}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function AccountingNotesTab() {
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/accounting-notes"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/accounting-notes"); return r.json(); },
  });

  const download = async (id: number, fileName: string) => {
    const token = localStorage.getItem('recepcja_token');
    const r = await fetch(`/api/recepcja/accounting-notes/${id}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b bg-muted/50">
          <th className="p-2 text-left">Nr noty</th>
          <th className="p-2 text-left">Plik</th>
          <th className="p-2 text-left">Data</th>
          <th className="p-2 text-center">Pobierz</th>
        </tr></thead>
        <tbody>
          {notes.map((n: any) => (
            <tr key={n.id} className="border-b hover:bg-muted/30">
              <td className="p-2">{n.noteNumber || '-'}</td>
              <td className="p-2">{n.fileName}</td>
              <td className="p-2">{n.generatedAt ? new Date(n.generatedAt).toLocaleDateString('pl-PL') : '-'}</td>
              <td className="p-2 text-center">
                <Button variant="ghost" size="sm" onClick={() => download(n.id, n.fileName)} data-testid={`button-download-note-${n.id}`}>
                  <Download className="h-4 w-4" />
                </Button>
              </td>
            </tr>
          ))}
          {notes.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Brak not</td></tr>}
        </tbody>
      </table>
    </Card>
  );
}

function MediaSettlementsTab() {
  const { toast } = useToast();
  const [onlyUnpaid, setOnlyUnpaid] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState("przelew");

  const { data: settlements = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/media-settlements"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/media-settlements"); return r.json(); },
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, paymentStatus, paidDate, paymentMethod }: { id: number; paymentStatus: string; paidDate?: string; paymentMethod?: string }) => {
      const r = await recepcjaFetch("PUT", `/api/recepcja/media-settlements/${id}/payment`, { paymentStatus, paidDate, paymentMethod });
      if (!r.ok) throw new Error((await r.json()).message);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/media-settlements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/dashboard"] });
      setPayingId(null);
      toast({ title: "Zaktualizowano status płatności" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const filtered = onlyUnpaid
    ? settlements.filter((s: any) => s.paymentStatus === "NIEOPLACONE")
    : [...settlements].sort((a: any, b: any) => {
        if (a.paymentStatus === "NIEOPLACONE" && b.paymentStatus !== "NIEOPLACONE") return -1;
        if (a.paymentStatus !== "NIEOPLACONE" && b.paymentStatus === "NIEOPLACONE") return 1;
        return 0;
      });

  const formatAmount = (v: string | number | null) => {
    if (v == null) return "—";
    return `${parseFloat(String(v)).toFixed(2)} zł`;
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      const parsed = d.length === 10 ? new Date(d + "T12:00:00") : new Date(d);
      if (isNaN(parsed.getTime())) return String(d);
      return parsed.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return String(d); }
  };

  const handleMarkPaid = (id: number) => {
    payMutation.mutate({ id, paymentStatus: "OPLACONE", paidDate: payDate, paymentMethod: payMethod });
  };

  const handleUnmark = (id: number) => {
    payMutation.mutate({ id, paymentStatus: "NIEOPLACONE" });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Button
          variant={onlyUnpaid ? "default" : "outline"}
          size="sm"
          onClick={() => setOnlyUnpaid(!onlyUnpaid)}
          data-testid="toggle-only-unpaid"
        >
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          {onlyUnpaid ? "Tylko nieopłacone" : "Wszystkie"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {settlements.filter((s: any) => s.paymentStatus === "NIEOPLACONE").length} nieopłaconych z {settlements.length}
        </span>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-muted/50">
            <th className="p-2 text-left">Najemca</th>
            <th className="p-2 text-left">Mieszkanie</th>
            <th className="p-2 text-left">Nr noty</th>
            <th className="p-2 text-left">Okres</th>
            <th className="p-2 text-right">Kwota</th>
            <th className="p-2 text-center">Status</th>
            <th className="p-2 text-left">Data wpłaty</th>
            <th className="p-2 text-left">Forma</th>
            <th className="p-2 text-center">Akcja</th>
          </tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Ładowanie...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">
                {onlyUnpaid ? "Brak nieopłaconych rozliczeń" : "Brak rozliczeń"}
              </td></tr>
            ) : filtered.map((s: any) => (
              <tr key={s.id} className="border-b hover:bg-muted/30" data-testid={`row-settlement-${s.id}`}>
                <td className="p-2 font-medium">{s.tenantName}</td>
                <td className="p-2">{s.apartmentName}</td>
                <td className="p-2 text-muted-foreground">{s.noteNumber || "—"}</td>
                <td className="p-2 text-muted-foreground text-xs">{formatDate(s.periodFrom)} – {formatDate(s.periodTo)}</td>
                <td className="p-2 text-right font-semibold">{formatAmount(s.totalCost)}</td>
                <td className="p-2 text-center">
                  <Badge
                    variant={s.paymentStatus === "OPLACONE" ? "default" : "destructive"}
                    className="text-xs no-default-hover-elevate no-default-active-elevate"
                    data-testid={`badge-status-${s.id}`}
                  >
                    {s.paymentStatus === "OPLACONE" ? "OPŁACONE" : "NIEOPŁACONE"}
                  </Badge>
                </td>
                <td className="p-2 text-xs">{s.paidDate ? formatDate(s.paidDate) : "—"}</td>
                <td className="p-2 text-xs">{s.paymentMethod || "—"}</td>
                <td className="p-2 text-center">
                  {s.paymentStatus === "NIEOPLACONE" ? (
                    payingId === s.id ? (
                      <div className="flex flex-col gap-1.5 min-w-[180px]">
                        <input
                          type="date"
                          value={payDate}
                          onChange={e => setPayDate(e.target.value)}
                          className="border rounded px-2 py-1 text-xs bg-background"
                          data-testid={`input-pay-date-${s.id}`}
                        />
                        <select
                          value={payMethod}
                          onChange={e => setPayMethod(e.target.value)}
                          className="border rounded px-2 py-1 text-xs bg-background"
                          data-testid={`select-pay-method-${s.id}`}
                        >
                          <option value="przelew">Przelew</option>
                          <option value="gotówka">Gotówka</option>
                          <option value="karta">Karta</option>
                        </select>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="text-xs h-7 flex-1"
                            onClick={() => handleMarkPaid(s.id)}
                            disabled={payMutation.isPending}
                            data-testid={`button-confirm-pay-${s.id}`}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Zapisz
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => setPayingId(null)}
                            data-testid={`button-cancel-pay-${s.id}`}
                          >
                            Anuluj
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={() => { setPayingId(s.id); setPayDate(new Date().toISOString().slice(0, 10)); setPayMethod("przelew"); }}
                        data-testid={`button-mark-paid-${s.id}`}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Oznacz jako opłacone
                      </Button>
                    )
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 text-destructive"
                      onClick={() => handleUnmark(s.id)}
                      disabled={payMutation.isPending}
                      data-testid={`button-unmark-paid-${s.id}`}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Cofnij
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
