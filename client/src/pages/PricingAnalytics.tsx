import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import { pl } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart, TrendingUp, TrendingDown, Hotel, DollarSign, Calendar, Users,
  AlertTriangle, Download, Filter, BarChart3, ArrowUpRight, ArrowDownRight, Minus
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend
} from "recharts";
import { cn } from "@/lib/utils";

interface KPI {
  occupancy: number;
  lastYearOccupancy: number;
  adr: number;
  lastYearAdr: number;
  revpar: number;
  avgStay: number;
  pickup7d: number;
  conversionRate: number;
  totalRevenue: number;
  lastYearRevenue: number;
  totalReservations: number;
  lastYearReservations: number;
}

interface AptAnalytics {
  id: number;
  name: string;
  location: string;
  currentPrice: number | null;
  occupancy: number;
  lastYearOccupancy: number;
  adr: number;
  lastYearAdr: number;
  revenue: number;
  lastYearRevenue: number;
  reservations: number;
  lastYearReservations: number;
}

interface PriceHistoryEntry {
  date: string;
  apartmentId: number;
  oldPrice: number;
  newPrice: number;
  source: string;
  reason: string | null;
}

interface Alert {
  type: string;
  severity: string;
  message: string;
  apartmentId?: number;
  apartmentName?: string;
  value?: number;
}

export default function PricingAnalytics() {
  const { toast } = useToast();
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(format(subMonths(now, 2), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(now, "yyyy-MM-dd"));
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortField, setSortField] = useState<string>("occupancy");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const analyticsUrl = useMemo(() => {
    const params = new URLSearchParams({ from: dateFrom, to: dateTo });
    if (locationFilter !== "all") params.set("locationId", locationFilter);
    return `/api/pricing-analytics?${params}`;
  }, [dateFrom, dateTo, locationFilter]);

  const { data: analytics, isLoading } = useQuery<{ kpi: KPI; apartments: AptAnalytics[]; priceHistory: PriceHistoryEntry[]; period: any }>({
    queryKey: [analyticsUrl],
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/pricing-analytics/alerts"],
  });

  const { data: allApartments = [] } = useQuery<any[]>({
    queryKey: ["/api/apartments"],
  });

  const locations = useMemo(() => {
    const locs = new Set(allApartments.map((a: any) => a.location).filter(Boolean));
    return Array.from(locs).sort();
  }, [allApartments]);

  const kpi = analytics?.kpi;
  const aptData = analytics?.apartments || [];

  const sortedApts = useMemo(() => {
    return [...aptData]
      .filter(a => locationFilter === "all" || a.location === locationFilter)
      .sort((a: any, b: any) => {
        const aVal = a[sortField] ?? 0;
        const bVal = b[sortField] ?? 0;
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      });
  }, [aptData, sortField, sortDir, locationFilter]);

  const chartData = useMemo(() => {
    if (!analytics?.priceHistory?.length) return [];
    const byDate = new Map<string, { date: string; avgOld: number; avgNew: number; count: number }>();
    for (const entry of analytics.priceHistory) {
      const existing = byDate.get(entry.date);
      if (existing) {
        existing.avgNew = (existing.avgNew * existing.count + entry.newPrice) / (existing.count + 1);
        existing.count++;
      } else {
        byDate.set(entry.date, { date: entry.date, avgOld: entry.oldPrice, avgNew: entry.newPrice, count: 1 });
      }
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [analytics?.priceHistory]);

  const handleExport = () => {
    window.open(`/api/pricing-analytics/export?from=${dateFrom}&to=${dateTo}`, "_blank");
    toast({ title: "Eksport CSV rozpoczęty" });
  };

  const renderChange = (current: number, previous: number, unit = "") => {
    if (!previous) return <span className="text-xs text-muted-foreground">—</span>;
    const diff = current - previous;
    const pct = previous > 0 ? ((diff / previous) * 100) : 0;
    const isUp = diff > 0;
    const isDown = diff < 0;
    return (
      <div className={cn("flex items-center gap-0.5 text-xs font-medium", isUp ? "text-green-600" : isDown ? "text-red-600" : "text-muted-foreground")}>
        {isUp ? <ArrowUpRight className="h-3 w-3" /> : isDown ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
        {Math.abs(Math.round(pct))}% r/r
      </div>
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Ładowanie analityki...</div>;
  }

  return (
    <div className="space-y-6" data-testid="pricing-analytics-page">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-yellow-500" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Analityka cenowa</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[140px]" data-testid="input-date-from" />
            <span className="text-muted-foreground">—</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[140px]" data-testid="input-date-to" />
          </div>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-location">
              <Filter className="h-4 w-4 mr-1" /><SelectValue placeholder="Lokalizacja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie lokalizacje</SelectItem>
              {locations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} data-testid="button-export">
            <Download className="h-4 w-4 mr-1" />Eksport CSV
          </Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2" data-testid="alerts-section">
          {alerts.slice(0, 5).map((alert, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border text-sm",
                alert.severity === "critical" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
              )}
              data-testid={`alert-${i}`}
            >
              <AlertTriangle className={cn("h-4 w-4 shrink-0", alert.severity === "critical" ? "text-red-500" : "text-yellow-500")} />
              <span className="flex-1">{alert.message}</span>
              {alert.apartmentName && <Badge variant="outline">{alert.apartmentName}</Badge>}
            </div>
          ))}
        </div>
      )}

      {kpi && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="kpi-cards">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Hotel className="h-4 w-4" />Obłożenie
              </div>
              <div className="text-2xl font-bold" data-testid="kpi-occupancy">{kpi.occupancy}%</div>
              {renderChange(kpi.occupancy, kpi.lastYearOccupancy)}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <DollarSign className="h-4 w-4" />ADR
              </div>
              <div className="text-2xl font-bold" data-testid="kpi-adr">{kpi.adr} zł</div>
              {renderChange(kpi.adr, kpi.lastYearAdr)}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />RevPAR
              </div>
              <div className="text-2xl font-bold" data-testid="kpi-revpar">{kpi.revpar} zł</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />Śr. pobyt
              </div>
              <div className="text-2xl font-bold" data-testid="kpi-avg-stay">{kpi.avgStay} nocy</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Users className="h-4 w-4" />Pickup 7d
              </div>
              <div className="text-2xl font-bold" data-testid="kpi-pickup">{kpi.pickup7d}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4" />Konwersja
              </div>
              <div className="text-2xl font-bold" data-testid="kpi-conversion">{kpi.conversionRate}%</div>
            </CardContent>
          </Card>
        </div>
      )}

      {kpi && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Przychód</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold" data-testid="text-total-revenue">{kpi.totalRevenue.toLocaleString("pl")} zł</span>
                {renderChange(kpi.totalRevenue, kpi.lastYearRevenue)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Rok temu: {kpi.lastYearRevenue.toLocaleString("pl")} zł</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Rezerwacje</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-bold" data-testid="text-total-reservations">{kpi.totalReservations}</span>
                {renderChange(kpi.totalReservations, kpi.lastYearReservations)}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Rok temu: {kpi.lastYearReservations}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Historia zmian cen (średnia)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]" data-testid="chart-price-history">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip formatter={(value: any) => [`${Math.round(value)} zł`, ""]} />
                  <Legend />
                  <Area type="monotone" dataKey="avgNew" name="Nowa cena" stroke="#8b5cf6" fill="#8b5cf680" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Porównanie apartamentów (r/r)</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={sortField} onValueChange={setSortField}>
                <SelectTrigger className="w-[140px] h-8 text-xs" data-testid="select-sort-field">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="occupancy">Obłożenie</SelectItem>
                  <SelectItem value="adr">ADR</SelectItem>
                  <SelectItem value="revenue">Przychód</SelectItem>
                  <SelectItem value="reservations">Rezerwacje</SelectItem>
                  <SelectItem value="name">Nazwa</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")} data-testid="button-sort-dir">
                {sortDir === "desc" ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-apt-comparison">
            <thead>
              <tr className="border-b text-left">
                <th className="px-4 py-2 font-medium">Apartament</th>
                <th className="px-3 py-2 font-medium text-center">Cena dziś</th>
                <th className="px-3 py-2 font-medium text-center">Obłożenie</th>
                <th className="px-3 py-2 font-medium text-center">Obł. r/r</th>
                <th className="px-3 py-2 font-medium text-center">ADR</th>
                <th className="px-3 py-2 font-medium text-center">ADR r/r</th>
                <th className="px-3 py-2 font-medium text-center">Przychód</th>
                <th className="px-3 py-2 font-medium text-center">Rez.</th>
              </tr>
            </thead>
            <tbody>
              {sortedApts.map(apt => (
                <tr key={apt.id} className="border-b hover:bg-muted/30" data-testid={`row-apt-${apt.id}`}>
                  <td className="px-4 py-2 font-medium">
                    <div>{apt.name}</div>
                    <div className="text-xs text-muted-foreground">{apt.location}</div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {apt.currentPrice ? `${apt.currentPrice} zł` : "—"}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn("font-medium", apt.occupancy > 70 ? "text-green-600" : apt.occupancy < 30 ? "text-red-600" : "")}>
                      {apt.occupancy}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {renderChange(apt.occupancy, apt.lastYearOccupancy)}
                  </td>
                  <td className="px-3 py-2 text-center">{apt.adr} zł</td>
                  <td className="px-3 py-2 text-center">
                    {renderChange(apt.adr, apt.lastYearAdr)}
                  </td>
                  <td className="px-3 py-2 text-center">{apt.revenue.toLocaleString("pl")} zł</td>
                  <td className="px-3 py-2 text-center">
                    {apt.reservations}
                    <span className="text-xs text-muted-foreground ml-1">({apt.lastYearReservations})</span>
                  </td>
                </tr>
              ))}
              {sortedApts.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Brak danych</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
