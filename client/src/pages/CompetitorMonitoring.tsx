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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Upload, Trash2, Edit, TrendingUp, TrendingDown, AlertTriangle, BarChart3, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Competitor {
  id: number;
  name: string;
  url: string | null;
  location: string | null;
  category: string;
  notes: string | null;
  active: boolean;
}

interface CompRate {
  id: number;
  competitorId: number;
  date: string;
  price: string;
  roomType: string | null;
  source: string;
}

export default function CompetitorMonitoring() {
  const { toast } = useToast();
  const [tab, setTab] = useState("competitors");
  const [compDialog, setCompDialog] = useState(false);
  const [editingComp, setEditingComp] = useState<Competitor | null>(null);
  const [compForm, setCompForm] = useState({ name: "", url: "", location: "", category: "standard", notes: "" });
  const [rateDialog, setRateDialog] = useState(false);
  const [rateForm, setRateForm] = useState({ competitorId: "", date: "", price: "", roomType: "" });
  const [csvDialog, setCsvDialog] = useState(false);
  const [csvCompetitorId, setCsvCompetitorId] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const { data: competitors = [], isLoading: loadingComp } = useQuery<Competitor[]>({ queryKey: ["/api/competitors"] });
  const { data: comparison, isLoading: loadingComparison } = useQuery<any>({ queryKey: ["/api/competitor-comparison"] });
  const { data: alerts = [] } = useQuery<any[]>({ queryKey: ["/api/competitor-alerts"] });

  const saveMutation = useMutation({
    mutationFn: (data: any) => editingComp
      ? apiRequest("PUT", `/api/competitors/${editingComp.id}`, data)
      : apiRequest("POST", "/api/competitors", data),
    onSuccess: () => {
      toast({ title: editingComp ? "Zaktualizowano konkurenta" : "Dodano konkurenta" });
      setCompDialog(false); setEditingComp(null);
      queryClient.invalidateQueries({ queryKey: ["/api/competitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitor-comparison"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/competitors/${id}`),
    onSuccess: () => {
      toast({ title: "Usunięto konkurenta" });
      queryClient.invalidateQueries({ queryKey: ["/api/competitors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/competitor-comparison"] });
    },
  });

  const addRateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/competitor-rates", data),
    onSuccess: () => {
      toast({ title: "Dodano cenę" });
      setRateDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/competitor-comparison"] });
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: async () => {
      if (!csvFile || !csvCompetitorId) return;
      const formData = new FormData();
      formData.append("file", csvFile);
      formData.append("competitorId", csvCompetitorId);
      const res = await fetch("/api/competitor-rates/import-csv", { method: "POST", body: formData });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `Zaimportowano ${data?.imported || 0} cen` });
      setCsvDialog(false); setCsvFile(null);
      queryClient.invalidateQueries({ queryKey: ["/api/competitor-comparison"] });
    },
  });

  const openEditComp = (comp: Competitor) => {
    setEditingComp(comp);
    setCompForm({ name: comp.name, url: comp.url || "", location: comp.location || "", category: comp.category, notes: comp.notes || "" });
    setCompDialog(true);
  };

  const openAddComp = () => {
    setEditingComp(null);
    setCompForm({ name: "", url: "", location: "", category: "standard", notes: "" });
    setCompDialog(true);
  };

  const categoryBadge = (cat: string) => {
    switch (cat) {
      case "premium": return <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Premium</Badge>;
      case "budget": return <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">Budget</Badge>;
      default: return <Badge variant="outline">Standard</Badge>;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="heading-competitors">
            <Users className="h-6 w-6 text-blue-500" />
            Monitoring Konkurencji
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Śledź ceny konkurencji i porównuj z własnymi</p>
        </div>
      </div>

      {alerts.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="font-medium text-sm">Alerty cenowe konkurencji</span>
            </div>
            <div className="space-y-1">
              {alerts.map((a: any, i: number) => (
                <div key={i} className="text-sm flex items-center gap-2" data-testid={`alert-competitor-${i}`}>
                  {a.type === "price_increase" ? <TrendingUp className="h-3 w-3 text-red-500" /> : <TrendingDown className="h-3 w-3 text-green-500" />}
                  <span>{a.competitorName}: {a.type === "price_increase" ? "wzrost" : "spadek"} cen o {Math.abs(a.changePct)}% (śr. {a.recentAvg} → {a.previousAvg} zł)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {comparison?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card><CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Moja śr. cena</div>
            <div className="text-2xl font-bold" data-testid="text-my-avg-price">{comparison.summary.myAvgPrice} zł</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Śr. konkurencji</div>
            <div className="text-2xl font-bold" data-testid="text-comp-avg-price">{comparison.summary.competitorAvgPrice} zł</div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Różnica</div>
            <div className={`text-2xl font-bold ${comparison.summary.priceDiff > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-price-diff">
              {comparison.summary.priceDiff > 0 ? "+" : ""}{comparison.summary.priceDiff} zł
            </div>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Percentyl cenowy</div>
            <div className="text-2xl font-bold" data-testid="text-percentile">{comparison.summary.percentile}%</div>
          </CardContent></Card>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="competitors" data-testid="tab-competitors">Konkurenci</TabsTrigger>
          <TabsTrigger value="comparison" data-testid="tab-comparison">Porównanie cen</TabsTrigger>
          <TabsTrigger value="trends" data-testid="tab-trends">Trendy</TabsTrigger>
        </TabsList>

        <TabsContent value="competitors" className="mt-4">
          <div className="flex gap-2 mb-4">
            <Button onClick={openAddComp} data-testid="button-add-competitor"><Plus className="h-4 w-4 mr-2" /> Dodaj konkurenta</Button>
            <Button variant="outline" onClick={() => setRateDialog(true)} data-testid="button-add-rate"><Plus className="h-4 w-4 mr-2" /> Dodaj cenę</Button>
            <Button variant="outline" onClick={() => setCsvDialog(true)} data-testid="button-import-csv"><Upload className="h-4 w-4 mr-2" /> Import CSV</Button>
          </div>
          {loadingComp ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : competitors.length === 0 ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Brak konkurentów. Dodaj pierwszego konkurenta aby rozpocząć monitoring.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {competitors.map(comp => (
                <Card key={comp.id} data-testid={`card-competitor-${comp.id}`}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{comp.name}</span>
                        {categoryBadge(comp.category)}
                        {!comp.active && <Badge variant="outline" className="text-muted-foreground">Nieaktywny</Badge>}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {comp.location && <span>{comp.location} • </span>}
                        {comp.url && <a href={comp.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">{comp.url}</a>}
                      </div>
                      {comp.notes && <div className="text-xs text-muted-foreground mt-1">{comp.notes}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEditComp(comp)} data-testid={`button-edit-${comp.id}`}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-red-600" onClick={() => { if (confirm("Usunąć konkurenta i jego ceny?")) deleteMutation.mutate(comp.id); }} data-testid={`button-delete-${comp.id}`}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="comparison" className="mt-4">
          {loadingComparison ? (
            <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : !comparison?.comparison?.length ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>Brak danych do porównania. Dodaj ceny konkurentów.</p>
            </CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-left">Data</th>
                      <th className="p-3 text-right">Moja cena</th>
                      <th className="p-3 text-right">Śr. konkurencji</th>
                      <th className="p-3 text-right">Różnica</th>
                      <th className="p-3 text-center">Pozycja</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.comparison.slice(0, 60).map((row: any) => (
                      <tr key={row.date} className="border-b hover:bg-muted/30" data-testid={`row-comparison-${row.date}`}>
                        <td className="p-3">{row.date}</td>
                        <td className="p-3 text-right">{row.myPrice !== null ? `${row.myPrice} zł` : "—"}</td>
                        <td className="p-3 text-right">{row.competitorAvg !== null ? `${row.competitorAvg} zł` : "—"}</td>
                        <td className="p-3 text-right">
                          {row.diff !== null && (
                            <span className={row.diff > 0 ? "text-red-600" : row.diff < 0 ? "text-green-600" : ""}>
                              {row.diff > 0 ? "+" : ""}{row.diff} zł
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {row.diff !== null && (
                            row.diff > 0 ? <Badge variant="outline" className="text-red-600">Drożej</Badge> :
                            row.diff < 0 ? <Badge variant="outline" className="text-green-600">Taniej</Badge> :
                            <Badge variant="outline">Równo</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          {!comparison?.comparison?.length ? (
            <Card><CardContent className="p-12 text-center text-muted-foreground">Brak danych do wykresu</CardContent></Card>
          ) : (
            <Card>
              <CardHeader><CardTitle className="text-base">Trend cen — moje vs konkurencja</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={comparison.comparison.filter((r: any) => r.myPrice || r.competitorAvg)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="myPrice" name="Moja cena" stroke="#3b82f6" fill="#3b82f680" />
                    <Area type="monotone" dataKey="competitorAvg" name="Śr. konkurencji" stroke="#ef4444" fill="#ef444480" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={compDialog} onOpenChange={setCompDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingComp ? "Edytuj konkurenta" : "Dodaj konkurenta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nazwa obiektu</Label><Input value={compForm.name} onChange={e => setCompForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Hotel Rybak" data-testid="input-comp-name" /></div>
            <div><Label>URL</Label><Input value={compForm.url} onChange={e => setCompForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." data-testid="input-comp-url" /></div>
            <div><Label>Lokalizacja</Label><Input value={compForm.location} onChange={e => setCompForm(f => ({ ...f, location: e.target.value }))} placeholder="np. Ustka" data-testid="input-comp-location" /></div>
            <div>
              <Label>Kategoria</Label>
              <Select value={compForm.category} onValueChange={v => setCompForm(f => ({ ...f, category: v }))}>
                <SelectTrigger data-testid="select-comp-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="premium">Premium</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="budget">Budget</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notatki</Label><Input value={compForm.notes} onChange={e => setCompForm(f => ({ ...f, notes: e.target.value }))} data-testid="input-comp-notes" /></div>
            <Button className="w-full" onClick={() => saveMutation.mutate(compForm)} disabled={!compForm.name || saveMutation.isPending} data-testid="button-save-competitor">
              {editingComp ? "Zapisz zmiany" : "Dodaj"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rateDialog} onOpenChange={setRateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dodaj cenę konkurenta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Konkurent</Label>
              <Select value={rateForm.competitorId} onValueChange={v => setRateForm(f => ({ ...f, competitorId: v }))}>
                <SelectTrigger data-testid="select-rate-competitor"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  {competitors.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Data</Label><Input type="date" value={rateForm.date} onChange={e => setRateForm(f => ({ ...f, date: e.target.value }))} data-testid="input-rate-date" /></div>
            <div><Label>Cena (PLN)</Label><Input type="number" value={rateForm.price} onChange={e => setRateForm(f => ({ ...f, price: e.target.value }))} data-testid="input-rate-price" /></div>
            <div><Label>Typ pokoju (opcjonalnie)</Label><Input value={rateForm.roomType} onChange={e => setRateForm(f => ({ ...f, roomType: e.target.value }))} data-testid="input-rate-room-type" /></div>
            <Button className="w-full" onClick={() => addRateMutation.mutate({ competitorId: Number(rateForm.competitorId), date: rateForm.date, price: rateForm.price, roomType: rateForm.roomType || null })} disabled={!rateForm.competitorId || !rateForm.date || !rateForm.price || addRateMutation.isPending} data-testid="button-save-rate">
              Dodaj cenę
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={csvDialog} onOpenChange={setCsvDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import cen z CSV</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Format CSV: data,cena,typ_pokoju (nagłówek w pierwszej linii)</p>
            <div>
              <Label>Konkurent</Label>
              <Select value={csvCompetitorId} onValueChange={setCsvCompetitorId}>
                <SelectTrigger data-testid="select-csv-competitor"><SelectValue placeholder="Wybierz" /></SelectTrigger>
                <SelectContent>
                  {competitors.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Plik CSV</Label>
              <Input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files?.[0] || null)} data-testid="input-csv-file" />
            </div>
            <Button className="w-full" onClick={() => importCsvMutation.mutate()} disabled={!csvFile || !csvCompetitorId || importCsvMutation.isPending} data-testid="button-import-csv-submit">
              <Upload className="h-4 w-4 mr-2" /> Importuj
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
