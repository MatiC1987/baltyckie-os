import { useState, useMemo, useEffect } from "react";
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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Thermometer } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsSkeleton } from "@/components/PageSkeleton";

type MonthData = {
  month: number;
  monthName: string;
  avgNightlyRate: number;
  reservationCount: number;
  avgOccupancy: number;
};

type ApartmentMonthlyRate = {
  month: number;
  avgRate: number;
  count: number;
};

type ApartmentData = {
  apartmentId: number;
  apartmentName: string;
  monthlyRates: ApartmentMonthlyRate[];
};

type SeasonalityResponse = {
  data: MonthData[];
  byApartment: ApartmentData[];
};

const MONTH_NAMES = [
  "Styczeń",
  "Luty",
  "Marzec",
  "Kwiecień",
  "Maj",
  "Czerwiec",
  "Lipiec",
  "Sierpień",
  "Wrzesień",
  "Październik",
  "Listopad",
  "Grudzień",
];

const MONTH_SHORT = ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"];

function formatPrice(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(1);
}

function getHeatmapColor(rate: number, min: number, max: number): string {
  if (max === min) return "hsl(var(--chart-1))";
  const normalized = (rate - min) / (max - min);
  const h = 120 - normalized * 80;
  const s = 70 + normalized * 30;
  const l = 70 - normalized * 40;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

export default function PriceSeasonality() {
  const [selectedApartmentId, setSelectedApartmentId] = useState<string>("");

  const { data, isLoading } = useQuery<SeasonalityResponse>({
    queryKey: ["/api/price-seasonality"],
  });

  const chartData = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((d) => ({
      name: d.monthName,
      short: MONTH_SHORT[d.month - 1],
      avgNightlyRate: Math.round(d.avgNightlyRate),
      reservationCount: d.reservationCount,
      avgOccupancy: (d.avgOccupancy * 100).toFixed(0),
    }));
  }, [data?.data]);

  const apartments = useMemo(() => {
    if (!data?.byApartment) return [];
    return data.byApartment.sort((a, b) => a.apartmentName.localeCompare(b.apartmentName, "pl"));
  }, [data?.byApartment]);

  useEffect(() => {
    if (!selectedApartmentId && apartments.length > 0) {
      setSelectedApartmentId(String(apartments[0].apartmentId));
    }
  }, [apartments, selectedApartmentId]);

  const selectedApartment = useMemo(() => {
    return apartments.find((a) => String(a.apartmentId) === selectedApartmentId) ?? apartments[0] ?? null;
  }, [selectedApartmentId, apartments]);

  const heatmapMinMax = useMemo(() => {
    if (!apartments.length) return { min: 0, max: 0 };
    let min = Infinity;
    let max = -Infinity;
    for (const apt of apartments) {
      for (const rate of apt.monthlyRates) {
        min = Math.min(min, rate.avgRate);
        max = Math.max(max, rate.avgRate);
      }
    }
    return { min: min === Infinity ? 0 : min, max: max === -Infinity ? 0 : max };
  }, [apartments]);

  if (isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Brak danych do wyświetlenia
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sezonowość cen"
        description="Analiza zmian cen rezerwacji w poszczególnych miesiącach."
        icon={Thermometer}
      />

      <Card data-testid="card-monthly-chart">
        <CardHeader>
          <CardTitle className="text-base">Średnia cena nightly rate i liczba rezerwacji</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="short" className="text-xs" />
              <YAxis yAxisId="left" className="text-xs" />
              <YAxis yAxisId="right" orientation="right" className="text-xs" />
              <Tooltip
                contentStyle={{ borderRadius: "0.5rem", border: "1px solid hsl(var(--border))" }}
                formatter={(value: any, name: string) => {
                  if (name === "avgNightlyRate") return [`${formatPrice(value)} zł`, "Śr. cena za noc"];
                  if (name === "reservationCount") return [value, "Liczba rezerwacji"];
                  return [value, name];
                }}
              />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="avgNightlyRate"
                stroke="#00CCFF"
                strokeWidth={2}
                dot={false}
                name="Śr. cena za noc"
                isAnimationActive={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="reservationCount"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                name="Liczba rezerwacji"
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card data-testid="card-monthly-table">
        <CardHeader>
          <CardTitle className="text-base">Dane sezonowości (najem)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Miesiąc</TableHead>
                <TableHead className="text-right">Śr. cena za noc</TableHead>
                <TableHead className="text-right">Liczba rezerwacji</TableHead>
                <TableHead className="text-right">Śr. obłożenie (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((monthData, idx) => (
                <TableRow key={monthData.month} data-testid={`row-month-${monthData.month}`}>
                  <TableCell className="text-sm font-medium">{MONTH_NAMES[idx]}</TableCell>
                  <TableCell className="text-right text-sm">{formatPrice(monthData.avgNightlyRate)} zł</TableCell>
                  <TableCell className="text-right text-sm">{monthData.reservationCount}</TableCell>
                  <TableCell className="text-right text-sm">{formatPercent(monthData.avgOccupancy)}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card data-testid="card-per-apartment">
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Ceny najem - widok na apartamenty</CardTitle>
          <div>
            <label className="text-sm font-medium">Wybierz apartament:</label>
            <Select value={selectedApartmentId} onValueChange={setSelectedApartmentId}>
              <SelectTrigger className="w-full max-w-xs" data-testid="select-apartment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {apartments.map((apt) => (
                  <SelectItem key={apt.apartmentId} value={String(apt.apartmentId)}>
                    {apt.apartmentName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-sm font-medium">Apartament</TableHead>
                {MONTH_SHORT.map((month, idx) => (
                  <TableHead key={idx} className="text-center text-xs">
                    {month}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {apartments.map((apt) => {
                const rates = apt.monthlyRates;
                return (
                  <TableRow key={apt.apartmentId} data-testid={`row-apartment-${apt.apartmentId}`}>
                    <TableCell className="font-medium text-sm min-w-32">{apt.apartmentName}</TableCell>
                    {MONTH_SHORT.map((_, monthIdx) => {
                      const rate = rates.find((r) => r.month === monthIdx);
                      const bgColor = rate
                        ? getHeatmapColor(rate.avgRate, heatmapMinMax.min, heatmapMinMax.max)
                        : "hsl(var(--muted))";
                      return (
                        <TableCell
                          key={monthIdx}
                          className="text-center text-xs p-2 h-10"
                          style={{ backgroundColor: bgColor }}
                          data-testid={`cell-heatmap-${apt.apartmentId}-${monthIdx}`}
                        >
                          {rate ? formatPrice(rate.avgRate) : "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
