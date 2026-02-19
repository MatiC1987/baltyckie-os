import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { TrendingUp, Building2 } from "lucide-react";

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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" data-testid="text-profitability-title">
            <TrendingUp className="h-5 w-5" />
            Rentowność apartamentów
          </h2>
          <p className="text-sm text-muted-foreground">Przychody z rezerwacji w podziale na apartamenty.</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28" data-testid="select-profitability-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}
        </div>
      )}

      {data && (
        <>
          <Card data-testid="card-total-revenue">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-base">Łączny przychód z rezerwacji ({year})</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold" data-testid="text-total-revenue">
                {data.totalRevenue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {data.apartments.reduce((s, a) => s + a.reservationCount, 0)} rezerwacji łącznie
              </p>
            </CardContent>
          </Card>

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
