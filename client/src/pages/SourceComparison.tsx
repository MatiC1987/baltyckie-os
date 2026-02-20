import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { DollarSign, CalendarDays, TrendingUp, Award } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { AnalyticsSkeleton } from "@/components/PageSkeleton";
import type { Reservation, Apartment, Location } from "@shared/schema";

const SOURCE_COLORS: Record<string, string> = {
  Booking: "#003580", Airbnb: "#FF5A5F", Recepcja: "#5ADBFA",
  HotRes: "#FF9800", Inne: "#9C27B0", Nieznane: "#9E9E9E",
};
const SOURCES = Object.keys(SOURCE_COLORS);

const MONTHS = [
  { value: "1", label: "Styczeń" }, { value: "2", label: "Luty" },
  { value: "3", label: "Marzec" }, { value: "4", label: "Kwiecień" },
  { value: "5", label: "Maj" }, { value: "6", label: "Czerwiec" },
  { value: "7", label: "Lipiec" }, { value: "8", label: "Sierpień" },
  { value: "9", label: "Wrzesień" }, { value: "10", label: "Październik" },
  { value: "11", label: "Listopad" }, { value: "12", label: "Grudzień" },
];

function formatPLN(v: number) {
  return v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

export default function SourceComparison() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [monthFrom, setMonthFrom] = useState("1");
  const [monthTo, setMonthTo] = useState("12");
  const [apartmentId, setApartmentId] = useState("all");
  const [locationId, setLocationId] = useState("all");

  const { data: reservations = [], isLoading: loadingRes } = useQuery<Reservation[]>({ queryKey: ["/api/reservations"] });
  const { data: apartments = [], isLoading: loadingApt } = useQuery<Apartment[]>({ queryKey: ["/api/apartments"] });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"] });

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  const filteredApartments = useMemo(() => {
    if (locationId === "all") return apartments;
    const loc = locations.find(l => l.id === Number(locationId));
    return loc ? apartments.filter(a => a.location === loc.name) : apartments;
  }, [apartments, locations, locationId]);

  const filtered = useMemo(() => {
    const mFrom = Number(monthFrom);
    const mTo = Number(monthTo);
    const aptIds = apartmentId === "all"
      ? new Set(filteredApartments.map(a => a.id))
      : new Set([Number(apartmentId)]);
    return reservations.filter(r => {
      const d = parseISO(r.startDate);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      return y === Number(year) && m >= mFrom && m <= mTo && aptIds.has(r.apartmentId!);
    });
  }, [reservations, year, monthFrom, monthTo, apartmentId, filteredApartments]);

  const sourceData = useMemo(() => {
    const map: Record<string, { count: number; revenue: number; totalNights: number; totalStay: number }> = {};
    SOURCES.forEach(s => { map[s] = { count: 0, revenue: 0, totalNights: 0, totalStay: 0 }; });
    filtered.forEach(r => {
      const src = r.source && SOURCES.includes(r.source) ? r.source : (r.source ? "Inne" : "Nieznane");
      const price = Number(r.price) || 0;
      const nights = Math.max(differenceInDays(parseISO(r.endDate), parseISO(r.startDate)), 1);
      map[src].count += 1;
      map[src].revenue += price;
      map[src].totalNights += nights;
      map[src].totalStay += nights;
    });
    return map;
  }, [filtered]);

  const totalRevenue = Object.values(sourceData).reduce((s, d) => s + d.revenue, 0);
  const totalCount = Object.values(sourceData).reduce((s, d) => s + d.count, 0);
  const totalNights = Object.values(sourceData).reduce((s, d) => s + d.totalNights, 0);
  const avgPricePerNight = totalNights > 0 ? totalRevenue / totalNights : 0;
  const topSource = Object.entries(sourceData).sort((a, b) => b[1].revenue - a[1].revenue)[0]?.[0] || "-";

  const pieData = SOURCES.filter(s => sourceData[s].revenue > 0).map(s => ({
    name: s, value: sourceData[s].revenue,
  }));
  const barData = SOURCES.filter(s => sourceData[s].count > 0).map(s => ({
    name: s, count: sourceData[s].count,
  }));

  const lineData = useMemo(() => {
    const mFrom = Number(monthFrom);
    const mTo = Number(monthTo);
    const months: { month: string; [key: string]: number | string }[] = [];
    for (let m = mFrom; m <= mTo; m++) {
      const entry: Record<string, number | string> = { month: MONTHS[m - 1].label };
      SOURCES.forEach(s => { entry[s] = 0; });
      filtered.forEach(r => {
        const rm = parseISO(r.startDate).getMonth() + 1;
        if (rm === m) {
          const src = r.source && SOURCES.includes(r.source) ? r.source : (r.source ? "Inne" : "Nieznane");
          (entry[src] as number) += Number(r.price) || 0;
        }
      });
      months.push(entry);
    }
    return months;
  }, [filtered, monthFrom, monthTo]);

  const tableData = SOURCES.map(s => {
    const d = sourceData[s];
    const avgNight = d.totalNights > 0 ? d.revenue / d.totalNights : 0;
    const avgStay = d.count > 0 ? d.totalStay / d.count : 0;
    const share = totalRevenue > 0 ? (d.revenue / totalRevenue) * 100 : 0;
    return { source: s, count: d.count, revenue: d.revenue, avgNight, avgStay, share };
  }).filter(d => d.count > 0).sort((a, b) => b.revenue - a.revenue);

  if (loadingRes || loadingApt) return <div className="p-4 lg:p-6"><AnalyticsSkeleton /></div>;

  return (
    <div className="space-y-4 p-4 lg:p-6" data-testid="page-source-comparison">
      <h1 className="text-2xl font-bold" data-testid="text-page-title">Porównanie źródeł rezerwacji</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Rok</label>
          <Select value={year} onValueChange={setYear} data-testid="select-year">
            <SelectTrigger className="w-[100px]" data-testid="select-year-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Od miesiąca</label>
          <Select value={monthFrom} onValueChange={setMonthFrom} data-testid="select-month-from">
            <SelectTrigger className="w-[140px]" data-testid="select-month-from-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Do miesiąca</label>
          <Select value={monthTo} onValueChange={setMonthTo} data-testid="select-month-to">
            <SelectTrigger className="w-[140px]" data-testid="select-month-to-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Lokalizacja</label>
          <Select value={locationId} onValueChange={v => { setLocationId(v); setApartmentId("all"); }} data-testid="select-location">
            <SelectTrigger className="w-[160px]" data-testid="select-location-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              {locations.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Apartament</label>
          <Select value={apartmentId} onValueChange={setApartmentId} data-testid="select-apartment">
            <SelectTrigger className="w-[180px]" data-testid="select-apartment-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Wszystkie</SelectItem>
              {filteredApartments.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Łączny przychód</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold" data-testid="text-total-revenue">{formatPLN(totalRevenue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Liczba rezerwacji</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold" data-testid="text-total-count">{totalCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Śr. cena/noc</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-xl font-bold" data-testid="text-avg-price">{formatPLN(avgPricePerNight)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top źródło</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold" data-testid="text-top-source">
              <Badge style={{ backgroundColor: SOURCE_COLORS[topSource] || "#9E9E9E", color: "#fff" }}>{topSource}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Udział przychodów wg źródła</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((e) => <Cell key={e.name} fill={SOURCE_COLORS[e.name]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatPLN(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Liczba rezerwacji wg źródła</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Rezerwacje">
                  {barData.map((e) => <Cell key={e.name} fill={SOURCE_COLORS[e.name]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Trend miesięczny wg źródła</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => formatPLN(v)} />
              <Legend />
              {SOURCES.map(s => <Line key={s} type="monotone" dataKey={s} stroke={SOURCE_COLORS[s]} strokeWidth={2} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Podsumowanie źródeł</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Źródło</TableHead>
                <TableHead className="text-right">Rezerwacje</TableHead>
                <TableHead className="text-right">Przychód</TableHead>
                <TableHead className="text-right">Śr. cena/noc</TableHead>
                <TableHead className="text-right">Śr. długość pobytu</TableHead>
                <TableHead className="text-right">Udział %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map(row => (
                <TableRow key={row.source} data-testid={`row-source-${row.source}`}>
                  <TableCell>
                    <Badge style={{ backgroundColor: SOURCE_COLORS[row.source], color: "#fff" }}>{row.source}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right">{formatPLN(row.revenue)}</TableCell>
                  <TableCell className="text-right">{formatPLN(row.avgNight)}</TableCell>
                  <TableCell className="text-right">{row.avgStay.toFixed(1)} nocy</TableCell>
                  <TableCell className="text-right">{row.share.toFixed(1)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
