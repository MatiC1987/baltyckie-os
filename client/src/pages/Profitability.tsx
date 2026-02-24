import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PieChart, Building2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsSkeleton } from "@/components/PageSkeleton";

type ApartmentProfitability = {
  apartmentId: number | string;
  apartmentName: string;
  reservationRevenue: number;
  subleaseRevenue: number;
  totalRevenue: number;
  cost: number;
  rentownosc: number;
  reservationCount: number;
};

type ProfitabilityData = {
  apartments: ApartmentProfitability[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
};

function fmt(v: number): string {
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtInt(v: number): string {
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function profitColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "";
}

export default function Profitability() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  const { data, isLoading } = useQuery<ProfitabilityData>({
    queryKey: [`/api/profitability?year=${year}`],
  });

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rentowność apartamentów"
        description="Przychody, koszty i rentowność w podziale na apartamenty."
        icon={PieChart}
        actions={
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28" data-testid="select-profitability-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {isLoading && <AnalyticsSkeleton />}

      {data && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Łączny przychód</p>
                <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400" data-testid="text-total-revenue">{fmtInt(data.totalRevenue)} zł</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Łączny koszt</p>
                <p className="text-xl font-bold mt-1 text-red-600 dark:text-red-400" data-testid="text-total-cost">{fmtInt(data.totalCost)} zł</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Łączna rentowność</p>
                <p className={`text-xl font-bold mt-1 ${profitColor(data.totalProfit)}`} data-testid="text-total-profit">{fmtInt(data.totalProfit)} zł</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Pozycje</p>
                <p className="text-xl font-bold mt-1" data-testid="text-apartments-count">{data.apartments.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Apartament</TableHead>
                      <TableHead className="text-right">Rezerwacje</TableHead>
                      <TableHead className="text-right">Przychód rezerwacje</TableHead>
                      <TableHead className="text-right">Przychód podnajem</TableHead>
                      <TableHead className="text-right">Przychód łączny</TableHead>
                      <TableHead className="text-right">Koszt</TableHead>
                      <TableHead className="text-right">Rentowność</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.apartments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          Brak danych za wybrany rok
                        </TableCell>
                      </TableRow>
                    )}
                    {data.apartments.map((apt, idx) => (
                      <TableRow key={apt.apartmentId} data-testid={`row-profitability-${apt.apartmentId}`}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium">{apt.apartmentName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="secondary">{apt.reservationCount}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
                          {fmt(apt.reservationRevenue)} zł
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums whitespace-nowrap">
                          {fmt(apt.subleaseRevenue)} zł
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium tabular-nums whitespace-nowrap">
                          {fmt(apt.totalRevenue)} zł
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums whitespace-nowrap text-red-600 dark:text-red-400">
                          {fmt(apt.cost)} zł
                        </TableCell>
                        <TableCell className={`text-right text-sm font-bold tabular-nums whitespace-nowrap ${profitColor(apt.rentownosc)}`}>
                          {fmt(apt.rentownosc)} zł
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
