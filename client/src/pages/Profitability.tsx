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

type ProfitabilityData = {
  apartments: {
    apartmentId: number;
    apartmentName: string;
    revenue: number;
    reservationCount: number;
  }[];
  totalRevenue: number;
};

export default function Profitability() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  const { data, isLoading } = useQuery<ProfitabilityData>({
    queryKey: [`/api/profitability?year=${year}`],
  });

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const maxRevenue = data ? Math.max(...data.apartments.map(a => a.revenue), 1) : 1;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rentowność apartamentów"
        description="Przychody z rezerwacji w podziale na apartamenty."
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
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Łączny przychód</p>
                <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{data.totalRevenue.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Rezerwacje</p>
                <p className="text-xl font-bold mt-1">{data.apartments.reduce((s, a) => s + a.reservationCount, 0)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Apartamenty</p>
                <p className="text-xl font-bold mt-1">{data.apartments.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Apartament</TableHead>
                    <TableHead className="text-right">Rezerwacje</TableHead>
                    <TableHead className="text-right">Przychód</TableHead>
                    <TableHead className="w-48">Udział</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.apartments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Brak danych za wybrany rok
                      </TableCell>
                    </TableRow>
                  )}
                  {data.apartments.map((apt, idx) => {
                    const pct = data.totalRevenue > 0 ? (apt.revenue / data.totalRevenue * 100) : 0;
                    const barWidth = maxRevenue > 0 ? (apt.revenue / maxRevenue * 100) : 0;
                    return (
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
                        <TableCell className="text-right text-sm font-medium whitespace-nowrap">
                          {apt.revenue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
