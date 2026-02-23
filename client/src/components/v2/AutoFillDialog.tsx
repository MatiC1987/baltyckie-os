import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const MONTHS_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

type Proposal = {
  apartmentId: number;
  apartmentName: string;
  month: number;
  proposed: number;
  currentForecast: number;
  basedOn: string;
};

function formatNum(v: number): string {
  if (v === 0) return "—";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function AutoFillDialog({ open, onOpenChange, currentYear }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentYear: number;
}) {
  const { toast } = useToast();
  const [targetYear, setTargetYear] = useState(String(currentYear));
  const [lookbackYears, setLookbackYears] = useState("2");
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async (body: any) => {
      const resp = await apiRequest("POST", "/api/v2/auto-fill-forecasts", body);
      return resp.json();
    },
    onSuccess: (data) => {
      setProposals(data.proposals || []);
      const allKeys = new Set<string>();
      for (const p of data.proposals || []) {
        if (p.proposed !== p.currentForecast) {
          allKeys.add(`${p.apartmentId}-${p.month}`);
        }
      }
      setSelected(allKeys);
    },
    onError: () => {
      toast({ title: "Błąd generowania propozycji", variant: "destructive" });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/v2/apply-auto-fill", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("/api/v2/") });
      toast({ title: "Zastosowano prognozy automatyczne" });
      onOpenChange(false);
      setProposals(null);
    },
    onError: () => {
      toast({ title: "Błąd zapisywania prognoz", variant: "destructive" });
    },
  });

  const toggleItem = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (!proposals) return;
    const changed = proposals.filter(p => p.proposed !== p.currentForecast);
    if (selected.size === changed.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(changed.map(p => `${p.apartmentId}-${p.month}`)));
    }
  };

  const aptGroups = proposals ? Array.from(
    proposals.reduce((map, p) => {
      if (!map.has(p.apartmentName)) map.set(p.apartmentName, []);
      map.get(p.apartmentName)!.push(p);
      return map;
    }, new Map<string, Proposal[]>())
  ) : [];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setProposals(null); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="auto-fill-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Auto-uzupełnianie prognoz
          </DialogTitle>
        </DialogHeader>

        {!proposals ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Automatycznie wygeneruj prognozy przychodów na podstawie średnich wartości z poprzednich lat.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Rok docelowy</Label>
                <Select value={targetYear} onValueChange={setTargetYear}>
                  <SelectTrigger data-testid="select-autofill-target-year">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Średnia z ilu lat</Label>
                <Select value={lookbackYears} onValueChange={setLookbackYears}>
                  <SelectTrigger data-testid="select-lookback-years">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 rok</SelectItem>
                    <SelectItem value="2">2 lata</SelectItem>
                    <SelectItem value="3">3 lata</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-autofill">Anuluj</Button>
              <Button
                onClick={() => generateMutation.mutate({ targetYear: Number(targetYear), lookbackYears: Number(lookbackYears) })}
                disabled={generateMutation.isPending}
                data-testid="button-generate-proposals"
              >
                {generateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Wygeneruj propozycje
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Znaleziono <Badge variant="secondary">{proposals.length}</Badge> propozycji
              </p>
              <Button variant="outline" size="sm" onClick={toggleAll} data-testid="button-toggle-all">
                {selected.size === proposals.filter(p => p.proposed !== p.currentForecast).length ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
              </Button>
            </div>

            <div className="max-h-[400px] overflow-y-auto space-y-3">
              {aptGroups.map(([aptName, items]) => (
                <div key={aptName} className="border rounded-lg p-3">
                  <h4 className="text-sm font-semibold mb-2">{aptName}</h4>
                  <div className="grid grid-cols-1 gap-1">
                    {items.filter(p => p.proposed !== p.currentForecast).map(p => {
                      const key = `${p.apartmentId}-${p.month}`;
                      return (
                        <div key={key} className="flex items-center gap-2 text-xs py-1">
                          <Checkbox
                            checked={selected.has(key)}
                            onCheckedChange={() => toggleItem(key)}
                            data-testid={`checkbox-proposal-${key}`}
                          />
                          <span className="w-10 text-muted-foreground">{MONTHS_SHORT[p.month]}</span>
                          <span className="tabular-nums text-muted-foreground">{formatNum(p.currentForecast)}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatNum(p.proposed)}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{p.basedOn}</span>
                        </div>
                      );
                    })}
                    {items.filter(p => p.proposed !== p.currentForecast).length === 0 && (
                      <p className="text-xs text-muted-foreground">Brak zmian do zastosowania</p>
                    )}
                  </div>
                </div>
              ))}
              {aptGroups.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Brak danych historycznych do wygenerowania propozycji</p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setProposals(null)} data-testid="button-back-autofill">Wstecz</Button>
              <Button
                onClick={() => {
                  const items = proposals
                    .filter(p => selected.has(`${p.apartmentId}-${p.month}`))
                    .map(p => ({ apartmentId: p.apartmentId, month: p.month, forecast: p.proposed }));
                  applyMutation.mutate({ targetYear: Number(targetYear), items });
                }}
                disabled={applyMutation.isPending || selected.size === 0}
                data-testid="button-apply-autofill"
              >
                {applyMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Zastosuj {selected.size} zmian
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
