import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Location } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calculator, ChevronDown, ChevronLeft, ChevronRight, Plus, Trash2, Loader2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CopyForecastDialog } from "@/components/v2/CopyForecastDialog";
import { CostsExpensesContent } from "@/pages/CostsExpenses";
import { CostsApartmentsContent } from "@/pages/CostsApartments";

const MONTHS = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

type CostsSummaryResponse = {
  year: number;
  locations: Location[];
  apartments: { id: number; name: string; locationId: number | null }[];
  apartmentCosts: Record<number, Record<number, number>>;
  operationalCosts: Record<string, Record<number, number>>;
  archivedOperationalCosts: Record<string, Record<number, number>>;
  variableCosts: Record<string, Record<number, { forecast: number; actual: number }>>;
  actualExpensesByMonth: Record<number, number>;
};

function formatNum(v: number): string {
  if (v === 0) return "—";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function VariableCostsTab({ data, year, currentMonth }: { data: CostsSummaryResponse; year: number; currentMonth: number }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newMonth, setNewMonth] = useState("0");

  const addMutation = useMutation({
    mutationFn: (body: any) => apiRequest("PUT", "/api/variable-cost-forecasts", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/v2/costs-summary") || String(q.queryKey[0]).startsWith("/api/variable-cost-forecasts") });
      setAddOpen(false);
      setNewName("");
      setNewAmount("");
      toast({ title: "Dodano koszt zmienny" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/variable-cost-forecasts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/v2/costs-summary") || String(q.queryKey[0]).startsWith("/api/variable-cost-forecasts") });
      toast({ title: "Usunięto koszt zmienny" });
    },
  });

  const { data: allVarCosts } = useQuery<any[]>({
    queryKey: [`/api/variable-cost-forecasts?year=${year}`],
  });

  const items = allVarCosts || [];
  const nameGroups = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of items) {
      if (!map.has(item.name)) map.set(item.name, []);
      map.get(item.name)!.push(item);
    }
    return map;
  }, [items]);

  const grandTotal = items.reduce((s, v) => s + Number(v.forecast || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-variable-cost">
          <Plus className="h-4 w-4 mr-1" /> Dodaj koszt zmienny
        </Button>
      </div>

      <Card data-testid="variable-costs-table">
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/30 sticky top-0 z-10">
                <th className="text-left p-2 min-w-[160px] font-medium">Pozycja</th>
                {MONTHS.map((m, i) => (
                  <th key={i} className={`text-right p-2 min-w-[75px] font-medium ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                    {m}
                  </th>
                ))}
                <th className="text-right p-2 min-w-[90px] font-bold">Razem</th>
                <th className="p-2 w-[50px]"></th>
              </tr>
            </thead>
            <tbody>
              {Array.from(nameGroups.entries()).map(([name, costItems]) => {
                const monthlyValues: Record<number, number> = {};
                for (const item of costItems) {
                  monthlyValues[item.month] = (monthlyValues[item.month] || 0) + Number(item.forecast || 0);
                }
                const total = Object.values(monthlyValues).reduce((s, v) => s + v, 0);
                return (
                  <tr key={name} className="border-b" data-testid={`var-cost-row-${name}`}>
                    <td className="p-2 font-medium">{name}</td>
                    {MONTHS.map((_, i) => (
                      <td key={i} className={`p-2 text-right tabular-nums ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                        {formatNum(monthlyValues[i] || 0)}
                      </td>
                    ))}
                    <td className="p-2 text-right font-bold tabular-nums">{formatNum(total)}</td>
                    <td className="p-2 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          for (const item of costItems) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        data-testid={`delete-var-cost-${name}`}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {nameGroups.size === 0 && (
                <tr>
                  <td colSpan={15} className="p-8 text-center text-muted-foreground">
                    Brak kosztów zmiennych. Dodaj pierwszy koszt zmienny.
                  </td>
                </tr>
              )}
              {nameGroups.size > 0 && (
                <tr className="border-t-2 font-bold bg-muted/20">
                  <td className="p-2">Razem</td>
                  {MONTHS.map((_, i) => {
                    const mTotal = items.filter(v => v.month === i).reduce((s, v) => s + Number(v.forecast || 0), 0);
                    return (
                      <td key={i} className={`p-2 text-right tabular-nums ${i === currentMonth ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""}`}>
                        {formatNum(mTotal)}
                      </td>
                    );
                  })}
                  <td className="p-2 text-right tabular-nums">{formatNum(grandTotal)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent data-testid="add-variable-cost-dialog">
          <DialogHeader>
            <DialogTitle>Dodaj koszt zmienny</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nazwa pozycji</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="np. Naprawy, Materiały"
                data-testid="input-variable-cost-name"
              />
            </div>
            <div>
              <Label>Miesiąc</Label>
              <Select value={newMonth} onValueChange={setNewMonth}>
                <SelectTrigger data-testid="select-variable-cost-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Szacunkowa kwota (PLN)</Label>
              <Input
                type="number"
                value={newAmount}
                onChange={e => setNewAmount(e.target.value)}
                placeholder="0"
                data-testid="input-variable-cost-amount"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Anuluj</Button>
            <Button
              onClick={() => {
                if (!newName.trim()) return;
                addMutation.mutate({
                  year,
                  month: Number(newMonth),
                  name: newName.trim(),
                  forecast: newAmount || "0",
                  actual: "0",
                });
              }}
              disabled={addMutation.isPending}
              data-testid="button-submit-variable-cost"
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Dodaj
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function V2Koszty() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState("apartamentowe");
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const { data, isLoading } = useQuery<CostsSummaryResponse>({
    queryKey: [`/api/v2/costs-summary?year=${year}`],
  });

  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear - 4; y <= currentYear + 5; y++) arr.push(y);
    return arr;
  }, [currentYear]);

  const totalAptCosts = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.apartmentCosts).reduce((s, months) =>
      s + Object.values(months).reduce((ms, v) => ms + v, 0), 0);
  }, [data]);

  const totalOpCosts = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.operationalCosts).reduce((s, months) =>
      s + Object.values(months).reduce((ms, v) => ms + v, 0), 0);
  }, [data]);

  const totalVarCosts = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.variableCosts).reduce((s, months) =>
      s + Object.values(months).reduce((ms, v) => ms + v.forecast, 0), 0);
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Koszty" icon={Calculator} description="Koszty — apartamentowe, operacyjne, zmienne" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="v2-koszty-page">
      <PageHeader
        title="Koszty"
        icon={Calculator}
        description="Koszty — apartamentowe, operacyjne, zmienne"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" disabled={year <= years[0]} onClick={() => setYear(y => y - 1)} data-testid="button-prev-year">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
              <SelectTrigger className="w-[100px]" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" className="h-9 w-9" disabled={year >= years[years.length - 1]} onClick={() => setYear(y => y + 1)} data-testid="button-next-year">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCopyDialog(true)} data-testid="button-copy-costs">
              <Copy className="h-4 w-4 mr-1" /> Kopiuj
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-gradient from-blue-500/10" data-testid="kpi-apt-costs">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Koszty apartamentowe</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{formatNum(totalAptCosts)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-purple-500/10" data-testid="kpi-op-costs">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Koszty operacyjne</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{formatNum(totalOpCosts)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-amber-500/10" data-testid="kpi-var-costs">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Koszty zmienne</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{formatNum(totalVarCosts)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-red-500/10" data-testid="kpi-total-costs">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Razem koszty</p>
            <p className="text-xl font-bold mt-1 tabular-nums text-red-600 dark:text-red-400">{formatNum(totalAptCosts + totalOpCosts + totalVarCosts)} PLN</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="costs-tabs">
          <TabsTrigger value="apartamentowe" data-testid="tab-apt-costs">Apartamenty</TabsTrigger>
          <TabsTrigger value="operacyjne" data-testid="tab-op-costs">Operacyjne</TabsTrigger>
          <TabsTrigger value="zmienne" data-testid="tab-var-costs">Zmienne</TabsTrigger>
        </TabsList>
        <TabsContent value="apartamentowe">
          <CostsApartmentsContent embedded externalYear={year} />
        </TabsContent>
        <TabsContent value="operacyjne">
          <CostsExpensesContent embedded externalYear={year} />
        </TabsContent>
        <TabsContent value="zmienne">
          {data && <VariableCostsTab data={data} year={year} currentMonth={year === currentYear ? currentMonth : -1} />}
        </TabsContent>
      </Tabs>

      <CopyForecastDialog open={showCopyDialog} onOpenChange={setShowCopyDialog} currentYear={year} defaultTypes={["cost", "operational", "variable"]} />
    </div>
  );
}
