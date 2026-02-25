import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Location } from "@shared/schema";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calculator, ChevronLeft, ChevronRight, Copy } from "lucide-react";
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

export default function V2Koszty() {
  const currentYear = new Date().getFullYear();
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

  const totalAptRealized = useMemo(() => {
    try {
      const raw = localStorage.getItem(`costs-apartments-data-${year}`);
      if (!raw) return 0;
      const d = JSON.parse(raw) as Record<string, Record<number, { p: number; r: number }>>;
      return Object.values(d).reduce((s, months) =>
        s + Object.values(months).reduce((ms, v) => ms + (v.r || 0), 0), 0);
    } catch { return 0; }
  }, [year]);

  const totalOpCosts = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.operationalCosts).reduce((s, months) =>
      s + Object.values(months).reduce((ms, v) => ms + v, 0), 0);
  }, [data]);

  const totalOpRealized = useMemo(() => {
    if (!data) return 0;
    return Object.values(data.actualExpensesByMonth).reduce((s, v) => s + v, 0);
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Koszty" icon={Calculator} description="Koszty apartamentowe i operacyjne" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="v2-koszty-page">
      <PageHeader
        title="Koszty"
        icon={Calculator}
        description="Koszty apartamentowe i operacyjne"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="card-gradient from-blue-500/10" data-testid="kpi-apt-costs">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Koszty (apartamenty)</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{formatNum(totalAptCosts)} PLN</p>
            <p className="text-xs text-muted-foreground mt-0.5">Zrealizowane: {formatNum(totalAptRealized)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-purple-500/10" data-testid="kpi-op-costs">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Koszty operacyjne</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{formatNum(totalOpCosts)} PLN</p>
            <p className="text-xs text-muted-foreground mt-0.5">Zrealizowane: {formatNum(totalOpRealized)} PLN</p>
          </CardContent>
        </Card>
        <Card className="card-gradient from-red-500/10" data-testid="kpi-total-costs">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground font-medium">Razem koszty</p>
            <p className="text-xl font-bold mt-1 tabular-nums text-red-600 dark:text-red-400">{formatNum(totalAptCosts + totalOpCosts)} PLN</p>
            <p className="text-xs text-muted-foreground mt-0.5">Zrealizowane: {formatNum(totalAptRealized + totalOpRealized)} PLN</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="costs-tabs">
          <TabsTrigger value="apartamentowe" data-testid="tab-apt-costs">Apartamenty</TabsTrigger>
          <TabsTrigger value="operacyjne" data-testid="tab-op-costs">Operacyjne</TabsTrigger>
        </TabsList>
        <TabsContent value="apartamentowe">
          <CostsApartmentsContent embedded externalYear={year} />
        </TabsContent>
        <TabsContent value="operacyjne">
          <CostsExpensesContent embedded externalYear={year} />
        </TabsContent>
      </Tabs>

      <CopyForecastDialog open={showCopyDialog} onOpenChange={setShowCopyDialog} currentYear={year} defaultTypes={["cost", "operational"]} />
    </div>
  );
}
