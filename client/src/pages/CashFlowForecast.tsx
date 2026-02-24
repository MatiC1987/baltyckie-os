import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart as LineChartIcon, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsSkeleton } from "@/components/PageSkeleton";
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

function readLocalAptCosts(years: number[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const year of years) {
    try {
      const raw = localStorage.getItem(`costs-apartments-data-${year}`);
      if (!raw) continue;
      const stored = JSON.parse(raw) as Record<string, Record<string, { p: number; r: number }>>;
      for (const monthData of Object.values(stored)) {
        for (const [monthStr, cellData] of Object.entries(monthData)) {
          const ym = `${year}-${parseInt(monthStr)}`;
          result[ym] = (result[ym] || 0) + (Number(cellData.p) || 0);
        }
      }
    } catch {}
  }
  return result;
}

export default function CashFlowForecast() {
  const { data: response, isLoading } = useQuery<CashFlowResponse>({
    queryKey: ["/api/cash-flow-forecast"],
  });

  const rawMonths = response?.months || [];

  const months = useMemo(() => {
    if (rawMonths.length === 0) return rawMonths;
    const uniqueYears = [...new Set(rawMonths.map(m => m.year))];
    const aptCosts = readLocalAptCosts(uniqueYears);
    return rawMonths.map(m => {
      const ym = `${m.year}-${m.month - 1}`;
      const localAptCost = aptCosts[ym] || 0;
      const totalExpenses = m.expectedExpenses + localAptCost;
      return {
        ...m,
        expectedExpenses: Math.round(totalExpenses * 100) / 100,
        netCashFlow: Math.round((m.expectedIncome + m.expectedSubleaseIncome - totalExpenses) * 100) / 100,
      };
    });
  }, [rawMonths]);

  const chartData = useMemo(() => {
    return months.map((m) => ({
      month: m.monthName.substring(0, 3),
      "Przychody rezerwacje": m.expectedIncome,
      "Przychody podnajmy": m.expectedSubleaseIncome,
      "Koszty": m.expectedExpenses,
      "Przepływ netto": m.netCashFlow,
    }));
  }, [months]);

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Przepływy pieniężne"
        description="6-miesięczna prognoza przepływów pieniężnych."
        icon={LineChartIcon}
      />

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
                    fill="#00CCFF"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Przychody podnajmy"
                    stackId="income"
                    fill="hsl(222, 47%, 11%)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Koszty"
                    stackId="expenses"
                    fill="hsl(142, 71%, 45%)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Line
                    type="monotone"
                    dataKey="Przepływ netto"
                    stroke="#00CCFF"
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
                    className="text-right px-3 py-2 min-w-[120px]"
                    data-testid="th-cashflow-net"
                  >
                    Przepływ netto
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((month, idx) => {
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
