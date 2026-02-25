import { useState, useMemo, useCallback } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { CopyForecastDialog } from "@/components/v2/CopyForecastDialog";
import { CostsExpensesContent } from "@/pages/CostsExpenses";
import { CostsApartmentsContent } from "@/pages/CostsApartments";

function formatNum(v: number): string {
  if (v === 0) return "—";
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function V2Koszty() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [tab, setTab] = useState("apartamentowe");
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const [aptPrognoza, setAptPrognoza] = useState(0);
  const [aptRealized, setAptRealized] = useState(0);
  const [opPrognoza, setOpPrognoza] = useState(0);
  const [opRealized, setOpRealized] = useState(0);

  const handleAptTotals = useCallback((prognoza: number, realized: number) => {
    setAptPrognoza(prognoza);
    setAptRealized(realized);
  }, []);

  const handleOpTotals = useCallback((prognoza: number, realized: number) => {
    setOpPrognoza(prognoza);
    setOpRealized(realized);
  }, []);

  const years = useMemo(() => {
    const arr = [];
    for (let y = currentYear - 4; y <= currentYear + 5; y++) arr.push(y);
    return arr;
  }, [currentYear]);

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

      <div className="grid grid-cols-3 gap-3" data-testid="v2-koszty-tiles">
        <Card data-testid="tile-apt-costs">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Koszty (apartamenty)</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{formatNum(aptPrognoza)} zł</p>
            <p className="text-xs text-muted-foreground mt-0.5">Zrealizowane: {formatNum(aptRealized)} zł</p>
          </CardContent>
        </Card>
        <Card data-testid="tile-op-costs">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Koszty operacyjne</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{formatNum(opPrognoza)} zł</p>
            <p className="text-xs text-muted-foreground mt-0.5">Zrealizowane: {formatNum(opRealized)} zł</p>
          </CardContent>
        </Card>
        <Card data-testid="tile-total-costs">
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-muted-foreground">Razem koszty</p>
            <p className="text-xl font-bold mt-1 tabular-nums">{formatNum(aptPrognoza + opPrognoza)} zł</p>
            <p className="text-xs text-muted-foreground mt-0.5">Zrealizowane: {formatNum(aptRealized + opRealized)} zł</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList data-testid="costs-tabs">
          <TabsTrigger value="apartamentowe" data-testid="tab-apt-costs">Apartamenty</TabsTrigger>
          <TabsTrigger value="operacyjne" data-testid="tab-op-costs">Operacyjne</TabsTrigger>
        </TabsList>
        <TabsContent value="apartamentowe" forceMount className="data-[state=inactive]:hidden">
          <CostsApartmentsContent embedded externalYear={year} onTotalsChange={handleAptTotals} />
        </TabsContent>
        <TabsContent value="operacyjne" forceMount className="data-[state=inactive]:hidden">
          <CostsExpensesContent embedded externalYear={year} onTotalsChange={handleOpTotals} />
        </TabsContent>
      </Tabs>

      <CopyForecastDialog open={showCopyDialog} onOpenChange={setShowCopyDialog} currentYear={year} defaultTypes={["cost", "operational"]} />
    </div>
  );
}
