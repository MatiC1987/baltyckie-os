import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth-token";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TrendingUp, TrendingDown, Minus, DollarSign, Building2, BarChart3,
  AlertTriangle, Download, PieChart, Users, ArrowUpRight, ArrowDownRight,
  Wallet, Target, Loader2, AlertCircle
} from "lucide-react";
import {
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ComposedChart, Line, Area
} from "recharts";

interface CostAnalyticsTabProps {
  year: number;
}

const COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#14b8a6", "#6366f1",
  "#84cc16", "#e11d48", "#0ea5e9", "#d946ef", "#a3e635"
];

function formatPLN(val: number) {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(val);
}

function renderChange(val: number | null) {
  if (val === null || val === undefined) return null;
  const isUp = val > 0;
  const isZero = Math.abs(val) < 0.5;
  return (
    <div className={`flex items-center gap-1 text-xs ${isZero ? "text-muted-foreground" : isUp ? "text-red-500" : "text-green-500"}`}>
      {isZero ? <Minus className="h-3 w-3" /> : isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(val).toFixed(1)}% r/r
    </div>
  );
}

export default function CostAnalyticsTab({ year }: CostAnalyticsTabProps) {
  const [subTab, setSubTab] = useState("overview");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/v2/cost-analytics", year],
    queryFn: async () => {
      const res = await fetch(`/api/v2/cost-analytics?year=${year}`, { credentials: "include", headers: { ...getAuthHeaders() } });
      if (!res.ok) throw new Error("Błąd pobierania analityki");
      return res.json();
    },
  });

  const csvExport = useMemo(() => {
    if (!data) return "";
    const rows = [["Kategoria", "Realizacja", "Prognoza", "Zmiana r/r %", "Wykorzystanie budżetu %"]];
    for (const c of data.categoryBreakdown || []) {
      rows.push([c.name, c.realized, c.forecast, c.rrChange ?? "", c.budgetUsage ?? ""]);
    }
    return "data:text/csv;charset=utf-8," + encodeURIComponent(rows.map(r => r.join(";")).join("\n"));
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-muted-foreground">Brak danych analitycznych</div>
    );
  }

  const { kpi, monthlyTrends, categoryBreakdown, topVendors, apartmentProfitability, locationMargins, budgetAlerts } = data;

  const pieData = (categoryBreakdown || [])
    .filter((c: any) => c.realized > 0)
    .slice(0, 10)
    .map((c: any, i: number) => ({ name: c.name, value: c.realized, color: COLORS[i % COLORS.length] }));

  const restTotal = (categoryBreakdown || []).slice(10).reduce((s: number, c: any) => s + (c.realized || 0), 0);
  if (restTotal > 0) {
    pieData.push({ name: "Pozostałe", value: restTotal, color: "#94a3b8" });
  }

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-lg font-semibold" data-testid="cost-analytics-title">Analityka kosztów — {year}</h3>
          <p className="text-sm text-muted-foreground">Pełna analiza kosztów ponoszonych w firmie</p>
        </div>
        <a href={csvExport} download={`koszty-analityka-${year}.csv`}>
          <Button variant="outline" size="sm" data-testid="button-export-csv">
            <Download className="h-4 w-4 mr-2" /> Eksport CSV
          </Button>
        </a>
      </div>

      {budgetAlerts && budgetAlerts.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="font-semibold text-sm">Alerty budżetowe ({budgetAlerts.length})</span>
            </div>
            <div className="grid gap-2">
              {budgetAlerts.slice(0, 5).map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm" data-testid={`alert-budget-${i}`}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className={`h-4 w-4 ${a.severity === "critical" ? "text-red-500" : a.severity === "warning" ? "text-orange-500" : "text-blue-500"}`} />
                    <span>{a.category}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={a.severity === "critical" ? "destructive" : "outline"} className="text-xs">
                      {a.budgetUsage.toFixed(0)}% budżetu
                    </Badge>
                    {a.overspend > 0 && (
                      <span className="text-red-500 text-xs font-medium">+{formatPLN(a.overspend)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card data-testid="kpi-total-costs">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" /> Koszty łącznie
            </div>
            <div className="text-xl font-bold">{formatPLN(kpi.totalRealized)}</div>
            {renderChange(kpi.rrChange)}
          </CardContent>
        </Card>

        <Card data-testid="kpi-budget-deviation">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4" /> Odch. budżetu
            </div>
            <div className={`text-xl font-bold ${kpi.budgetDeviation > 0 ? "text-red-500" : "text-green-500"}`}>
              {kpi.budgetDeviation > 0 ? "+" : ""}{kpi.budgetDeviation.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Plan: {formatPLN(kpi.totalForecast)}</div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-cost-per-apartment">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" /> Koszt / apartament
            </div>
            <div className="text-xl font-bold">{formatPLN(kpi.costPerApartment)}</div>
            <div className="text-xs text-muted-foreground">{kpi.apartmentCount} apartamentów</div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-apt-costs">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Building2 className="h-4 w-4" /> Apartamentowe
            </div>
            <div className="text-xl font-bold">{formatPLN(kpi.aptCostsTotal)}</div>
            <div className="text-xs text-muted-foreground">
              {kpi.totalRealized > 0 ? ((kpi.aptCostsTotal / kpi.totalRealized) * 100).toFixed(0) : 0}% całości
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-op-costs">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Wallet className="h-4 w-4" /> Operacyjne
            </div>
            <div className="text-xl font-bold">{formatPLN(kpi.opCostsTotal)}</div>
            <div className="text-xs text-muted-foreground">
              {kpi.totalRealized > 0 ? ((kpi.opCostsTotal / kpi.totalRealized) * 100).toFixed(0) : 0}% całości
            </div>
          </CardContent>
        </Card>

        <Card data-testid="kpi-operating-margin">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" /> Marża operac.
            </div>
            <div className={`text-xl font-bold ${kpi.operatingMargin >= 0 ? "text-green-500" : "text-red-500"}`}>
              {kpi.operatingMargin.toFixed(1)}%
            </div>
            <div className="text-xs text-muted-foreground">Przychody: {formatPLN(kpi.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList data-testid="tabs-cost-analytics">
          <TabsTrigger value="overview" data-testid="tab-overview">Przegląd</TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">Kategorie</TabsTrigger>
          <TabsTrigger value="profitability" data-testid="tab-profitability">Rentowność</TabsTrigger>
          <TabsTrigger value="vendors" data-testid="tab-vendors">Dostawcy</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Koszty miesięczne — realizacja vs prognoza</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="monthName" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      formatter={(v: number, name: string) => [formatPLN(v), name]}
                      labelFormatter={(l: string) => `Miesiąc: ${l}`}
                    />
                    <Legend />
                    <Bar dataKey="forecast" name="Prognoza" fill="#94a3b8" opacity={0.4} radius={[2,2,0,0]} />
                    <Bar dataKey="realized" name="Realizacja" fill="#3b82f6" radius={[2,2,0,0]} />
                    <Line dataKey="prevYearRealized" name={`${year-1}`} stroke="#f59e0b" strokeDasharray="5 5" dot={false} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Struktura kosztów</CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={{ strokeWidth: 1 }}
                      >
                        {pieData.map((entry: any, i: number) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatPLN(v)} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">Brak danych</div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Koszty apartamentowe vs operacyjne — trend miesięczny</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="monthName" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number, name: string) => [formatPLN(v), name]} />
                  <Legend />
                  <Area dataKey="aptRealized" name="Apartamentowe" fill="#3b82f6" fillOpacity={0.2} stroke="#3b82f6" strokeWidth={2} />
                  <Area dataKey="opRealized" name="Operacyjne" fill="#ef4444" fillOpacity={0.2} stroke="#ef4444" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="categories" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Analiza per kategoria</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Kategoria</th>
                    <th className="p-3 text-left">Typ</th>
                    <th className="p-3 text-right">Realizacja</th>
                    <th className="p-3 text-right">Prognoza</th>
                    <th className="p-3 text-right">Budżet %</th>
                    <th className="p-3 text-right">Zmiana r/r</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(categoryBreakdown || []).map((c: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-muted/30" data-testid={`row-category-${i}`}>
                      <td className="p-3 font-medium">{c.name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">
                          {c.type === "apartment" ? "Apartamentowe" : "Operacyjne"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-mono">{formatPLN(c.realized)}</td>
                      <td className="p-3 text-right font-mono text-muted-foreground">{formatPLN(c.forecast)}</td>
                      <td className="p-3 text-right">
                        {c.budgetUsage !== null ? (
                          <span className={`font-medium ${c.budgetUsage > 110 ? "text-red-500" : c.budgetUsage > 90 ? "text-orange-500" : "text-green-500"}`}>
                            {c.budgetUsage.toFixed(0)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-right">
                        {c.rrChange !== null ? (
                          <span className={`text-xs ${c.rrChange > 0 ? "text-red-500" : "text-green-500"}`}>
                            {c.rrChange > 0 ? "+" : ""}{c.rrChange.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="p-3 text-center">
                        {c.budgetUsage !== null && c.budgetUsage > 100 ? (
                          <Badge variant="destructive" className="text-xs">Przekroczony</Badge>
                        ) : c.budgetUsage !== null && c.budgetUsage > 90 ? (
                          <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-xs">Zbliża się</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">OK</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top 10 kategorii — realizacja vs prognoza</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={(categoryBreakdown || []).slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatPLN(v)} />
                  <Legend />
                  <Bar dataKey="realized" name="Realizacja" fill="#3b82f6" radius={[0,4,4,0]} />
                  <Bar dataKey="forecast" name="Prognoza" fill="#94a3b8" opacity={0.5} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profitability" className="space-y-6 mt-4">
          {locationMargins && locationMargins.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Marża operacyjna per lokalizacja</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={locationMargins}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number, name: string) => [name === "Marża %" ? `${v}%` : formatPLN(v), name]} />
                    <Legend />
                    <Bar dataKey="revenue" name="Przychody" fill="#22c55e" radius={[4,4,0,0]} />
                    <Bar dataKey="costs" name="Koszty" fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rentowność per apartament</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Apartament</th>
                    <th className="p-3 text-left">Lokalizacja</th>
                    <th className="p-3 text-right">Przychody</th>
                    <th className="p-3 text-right">Koszty</th>
                    <th className="p-3 text-right">Zysk</th>
                    <th className="p-3 text-right">Marża</th>
                  </tr>
                </thead>
                <tbody>
                  {(apartmentProfitability || []).map((a: any) => (
                    <tr key={a.id} className="border-b hover:bg-muted/30" data-testid={`row-profit-${a.id}`}>
                      <td className="p-3 font-medium">{a.name}</td>
                      <td className="p-3 text-muted-foreground text-xs">{a.location}</td>
                      <td className="p-3 text-right font-mono text-green-600">{formatPLN(a.revenue)}</td>
                      <td className="p-3 text-right font-mono text-red-500">{formatPLN(a.costs)}</td>
                      <td className={`p-3 text-right font-mono font-medium ${a.profit >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {formatPLN(a.profit)}
                      </td>
                      <td className="p-3 text-right">
                        <Badge variant={a.margin >= 30 ? "default" : a.margin >= 0 ? "outline" : "destructive"} className="text-xs">
                          {a.margin.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {(!apartmentProfitability || apartmentProfitability.length === 0) && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Brak danych o rentowności</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Top dostawcy wg wydatków</CardTitle>
            </CardHeader>
            <CardContent>
              {topVendors && topVendors.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(250, topVendors.length * 35)}>
                  <BarChart data={topVendors} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatPLN(v)} />
                    <Bar dataKey="total" name="Wydatki" fill="#8b5cf6" radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Brak danych o dostawcach. Dodaj dostawców do wydatków, aby zobaczyć analizę.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Szczegóły dostawców</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Dostawca</th>
                    <th className="p-3 text-right">Łączna kwota</th>
                    <th className="p-3 text-right">Liczba faktur</th>
                    <th className="p-3 text-left">Kategorie</th>
                  </tr>
                </thead>
                <tbody>
                  {(topVendors || []).map((v: any, i: number) => (
                    <tr key={i} className="border-b hover:bg-muted/30" data-testid={`row-vendor-${i}`}>
                      <td className="p-3 text-muted-foreground">{i + 1}</td>
                      <td className="p-3 font-medium">{v.name}</td>
                      <td className="p-3 text-right font-mono">{formatPLN(v.total)}</td>
                      <td className="p-3 text-right">{v.count}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {v.categories.slice(0, 3).map((c: string, j: number) => (
                            <Badge key={j} variant="outline" className="text-xs">{c}</Badge>
                          ))}
                          {v.categories.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{v.categories.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {(!topVendors || topVendors.length === 0) && (
                    <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Brak danych o dostawcach</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
