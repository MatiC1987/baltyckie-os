import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { recepcjaFetch } from "./RecepcjaApp";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Plus, Download, Loader2 } from "lucide-react";

export default function RecepcjaProtokoly() {
  const { toast } = useToast();

  const { data: protocols = [], isLoading } = useQuery({
    queryKey: ["/api/recepcja/handover-protocols"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/handover-protocols"); return r.json(); },
  });

  const { data: subleases = [] } = useQuery({
    queryKey: ["/api/recepcja/subleases"],
    queryFn: async () => { const r = await recepcjaFetch("GET", "/api/recepcja/subleases"); return r.json(); },
  });

  const downloadPdf = async (id: number) => {
    const token = localStorage.getItem('recepcja_token');
    const r = await fetch(`/api/recepcja/handover-protocols/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) { toast({ title: "Błąd pobierania", variant: "destructive" }); return; }
    toast({ title: "Protokół pobrany" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-protokoly-title">Protokoły zdawczo-odbiorcze</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Typ</th>
                <th className="p-2 text-left">Podnajem</th>
                <th className="p-2 text-center">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {protocols.map((p: any) => {
                const sub = subleases.find((s: any) => s.id === p.subleaseId);
                const name = sub ? (sub.tenantType === 'firma' ? (sub.companyName || '-') : `${sub.firstName || ''} ${sub.lastName || ''}`.trim()) : '-';
                return (
                  <tr key={p.id} className="border-b hover:bg-muted/30">
                    <td className="p-2">{p.protocolDate || p.createdAt?.slice(0, 10)}</td>
                    <td className="p-2">
                      <Badge variant={p.type === 'WYDANIE' ? 'default' : 'secondary'}>
                        {p.type === 'WYDANIE' ? 'Wydanie' : 'Zwrot'}
                      </Badge>
                    </td>
                    <td className="p-2">{name}</td>
                    <td className="p-2 text-center">
                      <Button variant="ghost" size="sm" onClick={() => downloadPdf(p.id)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {protocols.length === 0 && (
                <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Brak protokołów</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}