import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CashFlowMonth = {
  year: number;
  month: number;
  monthName: string;
  expectedIncome: number;
  expectedSubleaseIncome: number;
  expectedExpenses: number;
  expectedInstallments: number;
  netCashFlow: number;
};

type CashFlowResponse = {
  months: CashFlowMonth[];
};

function formatNum(v: number): string {
  return v.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function netCashFlowColor(v: number): string {
  if (v > 0) return "text-emerald-600 dark:text-emerald-400";
  if (v < 0) return "text-red-600 dark:text-red-400";
  return "";
}

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[300px] w-full" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  );
}

export default function CashFlowForecast() {
  const { data: response, isLoading } = useQuery<CashFlowResponse>({
    queryKey: ["/api/cash-flow-forecast"],
  });

  const months = response?.months || [];

  const chartData = useMemo(() => {
    return months.map((m) => ({
      month: m.monthName.substring(0, 3),
      "Przychody rezerwacje": m.expectedIncome,
      "Przychody podnajmy": m.expectedSubleaseIncome,
      "Koszty stałe": m.expectedExpenses,
      Raty: m.expectedInstallments,
      "Przepływ netto": m.netCashFlow,
    }));
  }, [months]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-cashflow-title">
            Prognoza przepływów pieniężnych
          </h1>
          <p className="text-muted-foreground text-sm">
            Prognoza wpływów i wydatków na najbliższe 6 miesięcy.
          </p>
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-cashflow-title">
          Prognoza przepływów pieniężnych
        </h1>
        <p className="text-muted-foreground text-sm">
          Prognoza wpływów i wydatków na najbliższe 6 miesięcy.
        </p>
      </div>

      <Card data-testid="card-cashflow-chart">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 flex-wrap text-lg">
            <TrendingUp className="h-5 w-5" />
            Wykres przepływów pieniężnych
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Stacked bar chart pokazujący przychody i wydatki z linią przepływu netto
          </p>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-[350px]" data-testid="chart-cashflow">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="month"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    formatter={(value: number) => [
                      `${formatNum(value)} PLN`,
                      "",
                    ]}
                  />
                  <Legend
                    wrapperStyle={{ paddingTop: "20px" }}
                    fontSize={12}
                  />
                  <Bar
                    dataKey="Przychody rezerwacje"
                    stackId="income"
                    fill="hsl(var(--chart-1))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Przychody podnajmy"
                    stackId="income"
                    fill="hsl(var(--chart-2))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Koszty stałe"
                    stackId="expenses"
                    fill="hsl(var(--chart-3))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Raty"
                    stackId="expenses"
                    fill="hsl(var(--chart-4))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="Przepływ netto"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    yAxisId="right"
                    isAnimationActive={false}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-muted-foreground">
              Brak danych do wyświetlenia
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-cashflow-table">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Podsumowanie miesięczne
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Szczegółowe zestawienie przychodów, wydatków i przepływu netto
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead
                    className="text-left px-3 py-2 min-w-[120px]"
                    data-testid="th-cashflow-month"
                  >
                    Miesiąc
                  </TableHead>
                  <TableHead
                    className="text-right px-3 py-2 min-w-[140px]"
                    data-testid="th-cashflow-income"
                  >
                    Przychody rezerwacje
                  </TableHead>
                  <TableHead
                    className="text-right px-3 py-2 min-w-[140px]"
                    data-testid="th-cashflow-sublease"
                  >
                    Przychody podnajmy
                  </TableHead>
                  <TableHead
                    className="text-right px-3 py-2 min-w-[100px]"
                    data-testid="th-cashflow-costs"
                  >
                    Koszty
                  </TableHead>
                  <TableHead
                    className="text-right px-3 py-2 min-w-[100px]"
                    data-testid="th-cashflow-installments"
                  >
                    Raty
                  </TableHead>
                  <TableHead
                    className="text-right px-3 py-2 min-w-[120px]"
                    data-testid="th-cashflow-net"
                  >
                    Przepływ netto
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((month, idx) => {
                  const totalIncome =
                    month.expectedIncome + month.expectedSubleaseIncome;
                  const totalExpenses =
                    month.expectedExpenses + month.expectedInstallments;
                  return (
                    <TableRow
                      key={idx}
                      data-testid={`row-cashflow-${idx}`}
                    >
                      <TableCell
                        className="px-3 py-2 font-medium"
                        data-testid={`cell-month-${idx}`}
                      >
                        {month.monthName}
                      </TableCell>
                      <TableCell
                        className="text-right px-3 py-2 tabular-nums"
                        data-testid={`cell-income-${idx}`}
                      >
                        {formatNum(month.expectedIncome)} PLN
                      </TableCell>
                      <TableCell
                        className="text-right px-3 py-2 tabular-nums"
                        data-testid={`cell-sublease-${idx}`}
                      >
                        {formatNum(month.expectedSubleaseIncome)} PLN
                      </TableCell>
                      <TableCell
                        className="text-right px-3 py-2 tabular-nums text-red-600 dark:text-red-400"
                        data-testid={`cell-costs-${idx}`}
                      >
                        {formatNum(month.expectedExpenses)} PLN
                      </TableCell>
                      <TableCell
                        className="text-right px-3 py-2 tabular-nums text-red-600 dark:text-red-400"
                        data-testid={`cell-installments-${idx}`}
                      >
                        {formatNum(month.expectedInstallments)} PLN
                      </TableCell>
                      <TableCell
                        className={`text-right px-3 py-2 tabular-nums font-bold ${netCashFlowColor(month.netCashFlow)}`}
                        data-testid={`cell-net-${idx}`}
                      >
                        {formatNum(month.netCashFlow)} PLN
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
