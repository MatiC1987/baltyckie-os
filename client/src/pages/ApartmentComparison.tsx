import { useState, useMemo } from "react";
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowUpDown, GitCompareArrows, Building2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsSkeleton } from "@/components/PageSkeleton";

type ApartmentComparisonData = {
  apartmentId: number;
  apartmentName: string;
  revenue: number;
  expenses: number;
  reservationCount: number;
  occupancyRate: number;
  netProfit: number;
};

type SortField = "apartmentName" | "revenue" | "expenses" | "netProfit" | "reservationCount" | "occupancyRate";
type SortDirection = "asc" | "desc";

function formatPLN(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ApartmentComparison() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [sortField, setSortField] = useState<SortField>("revenue");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { data, isLoading } = useQuery<ApartmentComparisonData[]>({
    queryKey: [`/api/apartment-comparison?year=${year}`],
  });

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const sortedData = useMemo(() => {
    if (!data) return [];
    const sorted = [...data];
    sorted.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, sortField, sortDirection]);

  const chartData = useMemo(() => {
    if (!sortedData) return [];
    return sortedData.map(apt => ({
      name: apt.apartmentName,
      przychód: apt.revenue,
      koszty: apt.expenses,
    }));
  }, [sortedData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortableHeader = ({ field, label }: { field: SortField; label: string }) => (
    <TableHead
      className="cursor-pointer hover-elevate select-none text-right"
      onClick={() => handleSort(field)}
      data-testid={`header-${field}`}
    >
      <div className="flex items-center justify-end gap-1">
        <span>{label}</span>
        <ArrowUpDown className={`h-4 w-4 ${sortField === field ? "text-primary" : "text-muted-foreground"}`} />
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Porównanie apartamentów"
        description="Porównanie wyników finansowych między apartamentami."
        icon={GitCompareArrows}
        actions={
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28" data-testid="select-comparison-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />

      {isLoading && <AnalyticsSkeleton />}

      {!isLoading && data && data.length > 0 && (
        <>
          <Card data-testid="card-comparison-chart">
            <CardHeader>
              <CardTitle className="text-base">Przychód vs Koszty</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} barGap={8}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
                  <Tooltip
                    formatter={(value: number) => [`${formatPLN(value)} zł`, "Wartość"]}
                    contentStyle={{
                      borderRadius: "0.5rem",
                      border: "1px solid hsl(var(--border))",
                      backgroundColor: "hsl(var(--card))",
                      color: "hsl(var(--card-foreground))",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="przychód"
                    fill="#00CCFF"
                    radius={[2, 2, 0, 0]}
                  />
                  <Bar
                    dataKey="koszty"
                    fill="hsl(222, 47%, 11%)"
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-left">Apartament</TableHead>
                    <SortableHeader field="revenue" label="Przychód" />
                    <SortableHeader field="expenses" label="Koszty" />
                    <SortableHeader field="netProfit" label="Zysk netto" />
                    <SortableHeader field="reservationCount" label="Liczba rezerwacji" />
                    <SortableHeader field="occupancyRate" label="Obłożenie (%)" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedData.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Brak danych za wybrany rok
                      </TableCell>
                    </TableRow>
                  )}
                  {sortedData.map((apt) => (
                    <TableRow key={apt.apartmentId} data-testid={`row-comparison-${apt.apartmentId}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span>{apt.apartmentName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPLN(apt.revenue)} zł
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatPLN(apt.expenses)} zł
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${
                          apt.netProfit >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatPLN(apt.netProfit)} zł
                      </TableCell>
                      <TableCell className="text-right">
                        {apt.reservationCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {apt.occupancyRate.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {!isLoading && (!data || data.length === 0) && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Brak danych do wyświetlenia
          </CardContent>
        </Card>
      )}
    </div>
  );
}
