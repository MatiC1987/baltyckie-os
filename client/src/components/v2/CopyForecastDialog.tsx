import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type CopyForecastDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentYear: number;
  defaultTypes?: string[];
};

export function CopyForecastDialog({ open, onOpenChange, currentYear, defaultTypes }: CopyForecastDialogProps) {
  const { toast } = useToast();
  const [sourceYear, setSourceYear] = useState(String(currentYear - 1));
  const [targetYear, setTargetYear] = useState(String(currentYear + 1));
  const [adjustmentPct, setAdjustmentPct] = useState("0");
  const [types, setTypes] = useState<Record<string, boolean>>({
    revenue: defaultTypes?.includes("revenue") ?? true,
    cost: defaultTypes?.includes("cost") ?? true,
    operational: defaultTypes?.includes("operational") ?? true,
    variable: defaultTypes?.includes("variable") ?? true,
  });

  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear - 4; y <= currentYear + 5; y++) arr.push(y);
    return arr;
  }, [currentYear]);

  const mutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/v2/copy-forecasts", body),
    onSuccess: async (response) => {
      const data = await response.json();
      const total = (data.copied?.revenue || 0) + (data.copied?.cost || 0) + (data.copied?.operational || 0) + (data.copied?.variable || 0);
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).includes("/api/v2/") || String(q.queryKey[0]).includes("/api/variable-cost-forecasts") });
      toast({ title: `Skopiowano ${total} prognoz do roku ${targetYear}` });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Błąd kopiowania prognoz", variant: "destructive" });
    },
  });

  const selectedTypes = Object.entries(types).filter(([, v]) => v).map(([k]) => k);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="copy-forecast-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" /> Kopiuj prognozy między latami
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rok źródłowy</Label>
              <Select value={sourceYear} onValueChange={setSourceYear}>
                <SelectTrigger data-testid="select-source-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rok docelowy</Label>
              <Select value={targetYear} onValueChange={setTargetYear}>
                <SelectTrigger data-testid="select-target-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Korekta procentowa (%)</Label>
            <div className="flex items-center gap-2 mt-1">
              {[-10, -5, 0, 5, 10].map(v => (
                <Button
                  key={v}
                  variant={adjustmentPct === String(v) ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAdjustmentPct(String(v))}
                  data-testid={`adjustment-btn-${v}`}
                >
                  {v > 0 ? `+${v}%` : `${v}%`}
                </Button>
              ))}
              <Input
                type="number"
                value={adjustmentPct}
                onChange={e => setAdjustmentPct(e.target.value)}
                className="w-20"
                data-testid="input-adjustment-pct"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Number(adjustmentPct) > 0 ? `Wartości zostaną zwiększone o ${adjustmentPct}%` :
               Number(adjustmentPct) < 0 ? `Wartości zostaną zmniejszone o ${Math.abs(Number(adjustmentPct))}%` :
               "Wartości zostaną skopiowane bez zmian"}
            </p>
          </div>

          <div>
            <Label>Rodzaje prognoz do skopiowania</Label>
            <div className="space-y-2 mt-2">
              {[
                { key: "revenue", label: "Przychody (prognozy przychodów)" },
                { key: "cost", label: "Koszty apartamentowe (ręczne)" },
                { key: "operational", label: "Koszty operacyjne" },
                { key: "variable", label: "Koszty zmienne" },
              ].map(t => (
                <div key={t.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`type-${t.key}`}
                    checked={types[t.key]}
                    onCheckedChange={v => setTypes(prev => ({ ...prev, [t.key]: !!v }))}
                    data-testid={`checkbox-type-${t.key}`}
                  />
                  <label htmlFor={`type-${t.key}`} className="text-sm">{t.label}</label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-copy">Anuluj</Button>
          <Button
            onClick={() => mutation.mutate({
              sourceYear: Number(sourceYear),
              targetYear: Number(targetYear),
              adjustmentPct: Number(adjustmentPct),
              types: selectedTypes,
            })}
            disabled={mutation.isPending || selectedTypes.length === 0 || sourceYear === targetYear}
            data-testid="button-confirm-copy"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Kopiuj prognozy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
