import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Check, X, Loader2, RefreshCw, Zap, Calculator, Settings, TrendingUp, TrendingDown } from "lucide-react";

interface Recommendation {
  id: number;
  apartmentId: number;
  apartmentName?: string;
  date: string;
  currentPrice: string;
  recommendedPrice: string;
  confidence: string;
  reasoning: string;
  factors: string;
  status: string;
  createdAt: string;
}

export default function AiPricing() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [aptFilter, setAptFilter] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [configDialog, setConfigDialog] = useState(false);
  const [configAptId, setConfigAptId] = useState<number | null>(null);
  const [configForm, setConfigForm] = useState({ autoMode: false, maxChangePercent: "10", minPrice: "", maxPrice: "", daysAhead: "90" });
  const [whatIfDialog, setWhatIfDialog] = useState(false);
  const [whatIfForm, setWhatIfForm] = useState({ apartmentId: "", newPrice: "", dateFrom: "", dateTo: "" });
  const [whatIfResult, setWhatIfResult] = useState<any>(null);

  const { data: recommendations = [], isLoading } = useQuery<Recommendation[]>({
    queryKey: ["/api/ai-recommendations", statusFilter, aptFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (aptFilter) params.set("apartmentId", aptFilter);
      const res = await fetch(`/api/ai-recommendations?${params}`);
      return res.json();
    },
  });

  const { data: apartments = [] } = useQuery<any[]>({ queryKey: ["/api/apartments"] });
  const { data: configs = [] } = useQuery<any[]>({ queryKey: ["/api/ai-pricing-config"] });

  const generateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai-recommendations/generate", {}),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: "Wygenerowano rekomendacje", description: `Utworzono ${data.count} rekomendacji AI` });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations"] });
    },
    onError: () => toast({ title: "Błąd generowania", variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/ai-recommendations/${id}/accept`, {}),
    onSuccess: () => {
      toast({ title: "Zaakceptowano rekomendację" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/ai-recommendations/${id}/reject`, {}),
    onSuccess: () => {
      toast({ title: "Odrzucono rekomendację" });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations"] });
    },
  });

  const bulkAcceptMutation = useMutation({
    mutationFn: (ids: number[]) => apiRequest("POST", "/api/ai-recommendations/bulk-accept", { ids }),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Zaakceptowano ${data.applied} rekomendacji` });
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations"] });
    },
  });

  const saveConfigMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/ai-pricing-config/${data.apartmentId}`, data),
    onSuccess: () => {
      toast({ title: "Zapisano konfigurację AI" });
      setConfigDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ai-pricing-config"] });
    },
  });

  const whatIfMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/ai-pricing/what-if", data),
    onSuccess: async (res) => {
      const data = await res.json();
      setWhatIfResult(data);
    },
  });

  const openConfig = (aptId: number) => {
    const existing = configs.find((c: any) => c.apartmentId === aptId);
    setConfigAptId(aptId);
    setConfigForm({
      autoMode: existing?.autoMode || false,
      maxChangePercent: existing?.maxChangePercent || "10",
      minPrice: existing?.minPrice || "",
      maxPrice: existing?.maxPrice || "",
      daysAhead: existing?.daysAhead?.toString() || "90",
    });
    setConfigDialog(true);
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    const pendingIds = recommendations.filter(r => r.status === "pending").map(r => r.id);
    setSelected(prev => prev.length === pendingIds.length ? [] : pendingIds);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" data-testid="badge-status-pending">Oczekuje</Badge>;
      case "accepted": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-status-accepted">Zaakceptowana</Badge>;
      case "rejected": return <Badge variant="destructive" data-testid="badge-status-rejected">Odrzucona</Badge>;
      case "auto_applied": return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" data-testid="badge-status-auto">Auto</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-ai-pricing">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            AI Cennik
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Inteligentne rekomendacje cenowe oparte na AI</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setWhatIfDialog(true)} data-testid="button-what-if">
            <Calculator className="h-4 w-4 mr-2" /> Symulator
          </Button>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} data-testid="button-generate-ai">
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generuj rekomendacje
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Oczekujące</div>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-count">
              {recommendations.filter(r => r.status === "pending").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Zaakceptowane</div>
            <div className="text-2xl font-bold text-green-600" data-testid="text-accepted-count">
              {recommendations.filter(r => r.status === "accepted").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Średnia pewność</div>
            <div className="text-2xl font-bold" data-testid="text-avg-confidence">
              {recommendations.length > 0 ? (recommendations.reduce((s, r) => s + Number(r.confidence || 0), 0) / recommendations.length * 100).toFixed(0) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            <SelectItem value="pending">Oczekujące</SelectItem>
            <SelectItem value="accepted">Zaakceptowane</SelectItem>
            <SelectItem value="rejected">Odrzucone</SelectItem>
          </SelectContent>
        </Select>
        <Select value={aptFilter} onValueChange={setAptFilter}>
          <SelectTrigger className="w-48" data-testid="select-apt-filter">
            <SelectValue placeholder="Wszystkie apartamenty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            {apartments.map((a: any) => (
              <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selected.length > 0 && (
          <Button onClick={() => bulkAcceptMutation.mutate(selected)} disabled={bulkAcceptMutation.isPending} size="sm" data-testid="button-bulk-accept">
            <Check className="h-4 w-4 mr-1" /> Zaakceptuj zaznaczone ({selected.length})
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : recommendations.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Brak rekomendacji. Kliknij „Generuj rekomendacje" aby rozpocząć.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left w-8">
                      <Checkbox checked={selected.length === recommendations.filter(r => r.status === "pending").length && selected.length > 0} onCheckedChange={selectAll} data-testid="checkbox-select-all" />
                    </th>
                    <th className="p-3 text-left">Apartament</th>
                    <th className="p-3 text-left">Data</th>
                    <th className="p-3 text-right">Aktualna</th>
                    <th className="p-3 text-right">Rekomendowana</th>
                    <th className="p-3 text-right">Zmiana</th>
                    <th className="p-3 text-center">Pewność</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-left">Uzasadnienie</th>
                    <th className="p-3 text-center">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {recommendations.map(rec => {
                    const diff = Number(rec.recommendedPrice) - Number(rec.currentPrice);
                    const diffPct = Number(rec.currentPrice) > 0 ? (diff / Number(rec.currentPrice) * 100) : 0;
                    return (
                      <tr key={rec.id} className="border-b hover:bg-muted/30" data-testid={`row-recommendation-${rec.id}`}>
                        <td className="p-3">
                          {rec.status === "pending" && (
                            <Checkbox checked={selected.includes(rec.id)} onCheckedChange={() => toggleSelect(rec.id)} data-testid={`checkbox-rec-${rec.id}`} />
                          )}
                        </td>
                        <td className="p-3 font-medium">{rec.apartmentName}</td>
                        <td className="p-3">{rec.date}</td>
                        <td className="p-3 text-right">{Number(rec.currentPrice).toFixed(0)} zł</td>
                        <td className="p-3 text-right font-semibold">{Number(rec.recommendedPrice).toFixed(0)} zł</td>
                        <td className="p-3 text-right">
                          <span className={`flex items-center justify-end gap-1 ${diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : ""}`}>
                            {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                            {diffPct > 0 ? "+" : ""}{diffPct.toFixed(1)}%
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-xs">{(Number(rec.confidence || 0) * 100).toFixed(0)}%</Badge>
                        </td>
                        <td className="p-3">{statusBadge(rec.status)}</td>
                        <td className="p-3 text-xs max-w-[200px] truncate" title={rec.reasoning}>{rec.reasoning}</td>
                        <td className="p-3">
                          {rec.status === "pending" && (
                            <div className="flex gap-1 justify-center">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => acceptMutation.mutate(rec.id)} data-testid={`button-accept-${rec.id}`}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => rejectMutation.mutate(rec.id)} data-testid={`button-reject-${rec.id}`}>
                                <X className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openConfig(rec.apartmentId)} data-testid={`button-config-${rec.id}`}>
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={configDialog} onOpenChange={setConfigDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfiguracja AI — {apartments.find((a: any) => a.id === configAptId)?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Tryb automatyczny</Label>
              <Switch checked={configForm.autoMode} onCheckedChange={v => setConfigForm(f => ({ ...f, autoMode: v }))} data-testid="switch-auto-mode" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max zmiana (%)</Label>
                <Input type="number" value={configForm.maxChangePercent} onChange={e => setConfigForm(f => ({ ...f, maxChangePercent: e.target.value }))} data-testid="input-max-change" />
              </div>
              <div>
                <Label>Dni wyprzedzenia</Label>
                <Input type="number" value={configForm.daysAhead} onChange={e => setConfigForm(f => ({ ...f, daysAhead: e.target.value }))} data-testid="input-days-ahead" />
              </div>
              <div>
                <Label>Min cena (PLN)</Label>
                <Input type="number" value={configForm.minPrice} onChange={e => setConfigForm(f => ({ ...f, minPrice: e.target.value }))} data-testid="input-ai-min-price" />
              </div>
              <div>
                <Label>Max cena (PLN)</Label>
                <Input type="number" value={configForm.maxPrice} onChange={e => setConfigForm(f => ({ ...f, maxPrice: e.target.value }))} data-testid="input-ai-max-price" />
              </div>
            </div>
            <Button className="w-full" onClick={() => saveConfigMutation.mutate({ apartmentId: configAptId, ...configForm, maxChangePercent: Number(configForm.maxChangePercent), daysAhead: Number(configForm.daysAhead), minPrice: configForm.minPrice ? Number(configForm.minPrice) : null, maxPrice: configForm.maxPrice ? Number(configForm.maxPrice) : null })} disabled={saveConfigMutation.isPending} data-testid="button-save-config">
              Zapisz konfigurację
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={whatIfDialog} onOpenChange={(v) => { setWhatIfDialog(v); if (!v) setWhatIfResult(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Symulator „Co jeśli"</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Apartament</Label>
              <Select value={whatIfForm.apartmentId} onValueChange={v => setWhatIfForm(f => ({ ...f, apartmentId: v }))}>
                <SelectTrigger data-testid="select-whatif-apt">
                  <SelectValue placeholder="Wybierz apartament" />
                </SelectTrigger>
                <SelectContent>
                  {apartments.map((a: any) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nowa cena (PLN)</Label>
              <Input type="number" value={whatIfForm.newPrice} onChange={e => setWhatIfForm(f => ({ ...f, newPrice: e.target.value }))} placeholder="np. 350" data-testid="input-whatif-price" />
            </div>
            <Button className="w-full" onClick={() => whatIfMutation.mutate({ apartmentId: Number(whatIfForm.apartmentId), newPrice: Number(whatIfForm.newPrice), dateFrom: whatIfForm.dateFrom || undefined, dateTo: whatIfForm.dateTo || undefined })} disabled={!whatIfForm.apartmentId || !whatIfForm.newPrice || whatIfMutation.isPending} data-testid="button-simulate">
              <Calculator className="h-4 w-4 mr-2" /> Symuluj
            </Button>
            {whatIfResult && (
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Obecna śr. cena:</div><div className="font-medium">{whatIfResult.currentAvgPrice} zł</div>
                    <div>Nowa cena:</div><div className="font-medium">{whatIfResult.newPrice} zł</div>
                    <div>Zmiana ceny:</div>
                    <div className={`font-medium ${whatIfResult.priceChangePct > 0 ? "text-green-600" : "text-red-600"}`}>
                      {whatIfResult.priceChangePct > 0 ? "+" : ""}{whatIfResult.priceChangePct}%
                    </div>
                    <div>Obecne obłożenie:</div><div className="font-medium">{whatIfResult.currentOccupancy}%</div>
                    <div>Prognozowane obłożenie:</div>
                    <div className={`font-medium ${whatIfResult.projectedOccupancy > whatIfResult.currentOccupancy ? "text-green-600" : "text-red-600"}`}>
                      {whatIfResult.projectedOccupancy}%
                    </div>
                    <div>Prognozowany przychód:</div><div className="font-bold">{whatIfResult.projectedRevenue?.toLocaleString()} zł</div>
                    <div>Różnica przychodu:</div>
                    <div className={`font-bold ${whatIfResult.revenueDiff > 0 ? "text-green-600" : "text-red-600"}`}>
                      {whatIfResult.revenueDiff > 0 ? "+" : ""}{whatIfResult.revenueDiff?.toLocaleString()} zł
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
