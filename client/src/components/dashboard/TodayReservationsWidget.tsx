import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus } from "lucide-react";
import type { Reservation } from "@shared/schema";
import type { ForecastMonth } from "@/components/RevenueForecastSection";
import { MONTH_NAMES } from "@/components/RevenueForecastSection";

type Props = {
  reservations: Reservation[];
  forecastData: ForecastMonth[];
};

export function TodayReservationsWidget({ reservations, forecastData }: Props) {
  const todayStr = new Date().toISOString().split("T")[0];

  const months = useMemo(() => {
    const now = new Date();
    const result = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return result;
  }, []);

  const cards = useMemo(() => {
    return months.map(({ year, month }, idx) => {
      const todayReservations = reservations.filter(r => {
        if (!r.createdAt || !r.startDate) return false;
        const createdDate = new Date(r.createdAt).toISOString().split("T")[0];
        if (createdDate !== todayStr) return false;
        const start = new Date(r.startDate);
        return start.getFullYear() === year && start.getMonth() === month;
      });

      const totalToday = todayReservations.reduce((sum, r) => {
        return sum + (Number(r.price) || 0);
      }, 0);

      const forecast = forecastData.find(f => f.year === year && f.month === month);
      let dailyNeeded: number | null = null;
      if (forecast && forecast.daysRemaining > 0 && forecast.forecast > 0) {
        const remaining = Math.max(0, forecast.forecast - forecast.actual);
        dailyNeeded = remaining / forecast.daysRemaining;
      }

      const isCurrentMonth = idx === 0;

      return { year, month, totalToday, dailyNeeded, isCurrentMonth };
    });
  }, [months, reservations, forecastData, todayStr]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarPlus className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold" data-testid="text-today-reservations-title">Rezerwacje dzisiaj</h3>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(c => (
          <Card
            key={`${c.year}-${c.month}`}
            className={c.isCurrentMonth
              ? "border-primary/30 bg-cyan-50/40 dark:bg-cyan-950/20 ring-1 ring-cyan-300/30 dark:ring-cyan-600/20"
              : ""}
            data-testid={`card-today-res-${c.year}-${c.month}`}
          >
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                <span>{MONTH_NAMES[c.month]}</span>
                {c.isCurrentMonth && (
                  <Badge variant="outline" className="text-[10px]">Bieżący</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pb-3">
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Złożone dziś</div>
                <div
                  className={`text-sm font-bold ${c.totalToday > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                  data-testid={`text-today-total-${c.year}-${c.month}`}
                >
                  {c.totalToday.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                </div>
              </div>
              <div className="pt-1 border-t border-border">
                <div className="text-[10px] text-muted-foreground mb-0.5">Brakuje / dzień</div>
                <div
                  className={`text-xs font-semibold ${c.dailyNeeded !== null ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}
                  data-testid={`text-today-daily-${c.year}-${c.month}`}
                >
                  {c.dailyNeeded !== null
                    ? c.dailyNeeded.toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł"
                    : "—"}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
