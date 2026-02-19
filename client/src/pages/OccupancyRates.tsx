import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Building2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { AnalyticsSkeleton } from "@/components/PageSkeleton";

type OccupancyData = {
  apartments: {
    apartmentId: number;
    apartmentName: string;
    occupiedDays: number;
    totalDays: number;
    rate: number;
  }[];
  overall: {
    rate: number;
    occupiedDays: number;
    totalDays: number;
  };
};

const MONTH_OPTIONS = [
  { value: "all", label: "Cały rok" },
  { value: "1", label: "Styczeń" },
  { value: "2", label: "Luty" },
  { value: "3", label: "Marzec" },
  { value: "4", label: "Kwiecień" },
  { value: "5", label: "Maj" },
  { value: "6", label: "Czerwiec" },
  { value: "7", label: "Lipiec" },
  { value: "8", label: "Sierpień" },
  { value: "9", label: "Wrzesień" },
  { value: "10", label: "Październik" },
  { value: "11", label: "Listopad" },
  { value: "12", label: "Grudzień" },
];

export default function OccupancyRates() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState("all");

  const queryUrl = month === "all" ? `/api/occupancy-rates?year=${year}` : `/api/occupancy-rates?year=${year}&month=${month}`;
  const { data, isLoading } = useQuery<OccupancyData>({
    queryKey: [queryUrl],
  });

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

  function getRateColor(rate: number) {
    if (rate >= 70) return "text-green-600 dark:text-green-400";
    if (rate >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }

  function getProgressColor(rate: number) {
    if (rate >= 70) return "[&>div]:bg-green-500";
    if (rate >= 40) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-red-500";
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Obłożenie apartamentów"
        description="Wskaźnik zajętości apartamentów na podstawie rezerwacji."
        icon={BarChart3}
        actions={
          <div className="flex items-center gap-2">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-28" data-testid="select-year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-36" data-testid="select-month">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {isLoading && <AnalyticsSkeleton />}

      {data && (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Apartamenty</p>
                <p className="text-xl font-bold mt-1">{data.apartments.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Średnie obłożenie</p>
                <p className={`text-xl font-bold mt-1 ${getRateColor(data.overall.rate)}`}>{data.overall.rate}%</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <p className="text-xs text-muted-foreground font-medium">Dni zajęte</p>
                <p className="text-xl font-bold mt-1">{data.overall.occupiedDays} / {data.overall.totalDays}</p>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-overall-occupancy">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-base">Ogólne obłożenie</CardTitle>
              <span className={`text-2xl font-bold ${getRateColor(data.overall.rate)}`} data-testid="text-overall-rate">
                {data.overall.rate}%
              </span>
            </CardHeader>
            <CardContent>
              <Progress value={data.overall.rate} className={`h-3 ${getProgressColor(data.overall.rate)}`} />
              <p className="text-xs text-muted-foreground mt-2">
                {data.overall.occupiedDays} zajętych dni / {data.overall.totalDays} łącznych dni
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.apartments
              .filter(a => a.rate > 0 || data.apartments.length <= 20)
              .sort((a, b) => b.rate - a.rate)
              .map(apt => (
                <Card key={apt.apartmentId} data-testid={`card-occupancy-${apt.apartmentId}`}>
                  <CardContent className="pt-4 pb-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{apt.apartmentName}</span>
                      </div>
                      <span className={`text-sm font-bold shrink-0 ${getRateColor(apt.rate)}`}>
                        {apt.rate}%
                      </span>
                    </div>
                    <Progress value={apt.rate} className={`h-2 ${getProgressColor(apt.rate)}`} />
                    <p className="text-xs text-muted-foreground">
                      {apt.occupiedDays} / {apt.totalDays} dni
                    </p>
                  </CardContent>
                </Card>
              ))}
          </div>

          {data.apartments.filter(a => a.rate === 0).length > 0 && data.apartments.length > 20 && (
            <p className="text-sm text-muted-foreground">
              + {data.apartments.filter(a => a.rate === 0).length} apartamentów bez rezerwacji w tym okresie
            </p>
          )}
        </>
      )}
    </div>
  );
}
