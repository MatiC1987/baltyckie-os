import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, Upload, Download, Loader2, FileText } from "lucide-react";

export default function RecepcjaDokumenty() {
  const [tab, setTab] = useState<"invoices" | "notes">("invoices");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FolderOpen className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-dokumenty-title">Dokumenty</h1>
      </div>
      <div className="flex gap-2">
        <Button variant={tab === "invoices" ? "default" : "outline"} size="sm" onClick={() => setTab("invoices")}>Faktury kosztowe</Button>
        <Button variant={tab === "notes" ? "default" : "outline"} size="sm" onClick={() => setTab("notes")}>Noty księgowe</Button>
      </div>
      {tab === "invoices" ? <CostInvoicesTab /> : <AccountingNotesTab />}
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
                <td className="p-2 flex items-center gap-1"><FileText className="h-3 w-3" />{inv.originalFilename}</td>
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