import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowUpDown } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsSkeleton } from "@/components/PageSkeleton";

type YearComparisonData = {
  years: number[];
  data: Record<number, number[]>;
};

const MONTH_NAMES = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];
const MONTH_FULL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const YEAR_COLORS = ["#6366f1", "#00CCFF80", "#00CCFF"];

function fmt(v: number) {
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function YearComparison() {
  const { data, isLoading } = useQuery<YearComparisonData>({
    queryKey: ["/api/year-comparison"],
  });

  if (isLoading) return <AnalyticsSkeleton />;

  if (!data || !data.years || data.years.length === 0) return (
    <div className="text-center text-muted-foreground py-8">Brak danych do wyświetlenia</div>
  );

  const chartData = MONTH_NAMES.map((name, idx) => {
    const entry: Record<string, any> = { name };
    for (const year of data.years) {
      entry[String(year)] = data.data[year]?.[idx] || 0;
    }
    return entry;
  });

  const yearTotals = data.years.map(year =>
    (data.data[year] || []).reduce((s, v) => s + v, 0)
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Porównanie rok do roku"
        description="Analiza zmian przychodów w porównaniu z poprzednim rokiem."
        icon={ArrowUpDown}
      />

      <div className="grid gap-3 md:grid-cols-3">
        {data.years.map((year, idx) => (
          <Card key={year} data-testid={`card-year-total-${year}`}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{year}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-bold">{fmt(yearTotals[idx])} zł</p>
              {idx > 0 && yearTotals[idx - 1] > 0 && (
                <p className={`text-xs mt-1 ${yearTotals[idx] >= yearTotals[idx - 1] ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {yearTotals[idx] >= yearTotals[idx - 1] ? "+" : ""}
                  {((yearTotals[idx] - yearTotals[idx - 1]) / yearTotals[idx - 1] * 100).toFixed(1)}% vs {data.years[idx - 1]}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card data-testid="card-chart">
        <CardContent className="pt-4">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip
                formatter={(value: number, name: string) => [`${fmt(value)} zł`, name]}
                contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))" }}
              />
              <Legend />
              {data.years.map((year, idx) => (
                <Bar key={year} dataKey={String(year)} fill={YEAR_COLORS[idx]} radius={[2, 2, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Miesiąc</TableHead>
                {data.years.map(year => (
                  <TableHead key={year} className="text-right">{year}</TableHead>
                ))}
                <TableHead className="text-right">Zmiana r/r</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MONTH_FULL.map((monthName, idx) => {
                const vals = data.years.map(y => data.data[y]?.[idx] || 0);
                const lastTwo = vals.slice(-2);
                const change = lastTwo[0] > 0 ? ((lastTwo[1] - lastTwo[0]) / lastTwo[0] * 100) : 0;
                return (
                  <TableRow key={idx} data-testid={`row-month-${idx}`}>
                    <TableCell className="text-sm font-medium">{monthName}</TableCell>
                    {vals.map((v, i) => (
                      <TableCell key={i} className="text-right text-sm whitespace-nowrap">
                        {fmt(v)} zł
                      </TableCell>
                    ))}
                    <TableCell className="text-right text-sm whitespace-nowrap">
                      {lastTwo[0] > 0 ? (
                        <span className={change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {change >= 0 ? "+" : ""}{change.toFixed(1)}%
                        </span>
                      ) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-bold bg-muted/30">
                <TableCell>Razem</TableCell>
                {yearTotals.map((v, i) => (
                  <TableCell key={i} className="text-right whitespace-nowrap">{fmt(v)} zł</TableCell>
                ))}
                <TableCell className="text-right whitespace-nowrap">
                  {yearTotals[yearTotals.length - 2] > 0 ? (
                    <span className={yearTotals[yearTotals.length - 1] >= yearTotals[yearTotals.length - 2] ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                      {yearTotals[yearTotals.length - 1] >= yearTotals[yearTotals.length - 2] ? "+" : ""}
                      {((yearTotals[yearTotals.length - 1] - yearTotals[yearTotals.length - 2]) / yearTotals[yearTotals.length - 2] * 100).toFixed(1)}%
                    </span>
                  ) : "—"}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
