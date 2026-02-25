import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target } from "lucide-react";

export type ForecastMonth = {
  year: number;
  month: number;
  actual: number;
  forecast: number;
  reservationRevenue: number;
  subleaseRevenue: number;
  daysInMonth: number;
  dayOfMonth: number;
  daysRemaining: number;
};

export const MONTH_NAMES = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

export default function RevenueForecastSection({ forecastData }: { forecastData: ForecastMonth[] }) {
  const cards = useMemo(() => {
    return forecastData.map(m => {
      const forecast = m.forecast || 0;
      const pct = forecast > 0 ? m.actual / forecast : 0;
      const remaining = Math.max(0, forecast - m.actual);
      const dailyNeeded = m.daysRemaining > 0 ? remaining / m.daysRemaining : 0;
      return {
        ...m,
        forecast,
        pct,
        remaining,
        dailyNeeded,
        monthName: MONTH_NAMES[m.month],
      };
    });
  }, [forecastData]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold" data-testid="text-forecast-title">Realizacja prognozy przychodów</h3>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {cards.map((c) => {
          const now = new Date();
          const isCurrentMonth = c.year === now.getFullYear() && c.month === now.getMonth();
          const isPastMonth = c.year < now.getFullYear() || (c.year === now.getFullYear() && c.month < now.getMonth());
          return (
            <Card key={`${c.year}-${c.month}`} className={isCurrentMonth ? "border-primary/30" : isPastMonth ? "opacity-75" : ""} data-testid={`card-forecast-${c.year}-${c.month}`}>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
                  <span>{c.monthName}</span>
                  {isCurrentMonth && <Badge variant="outline" className="text-[10px]">Bieżący</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pb-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Prognoza</span>
                  <span className="font-medium" data-testid={`text-forecast-value-${c.year}-${c.month}`}>
                    {c.forecast > 0 ? c.forecast.toLocaleString("pl-PL", { minimumFractionDigits: 2 }) + " zł" : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Rzeczywiste</span>
                  <span className="font-bold" data-testid={`text-actual-value-${c.year}-${c.month}`}>
                    {c.actual.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                  </span>
                </div>
                {(c.reservationRevenue > 0 || c.subleaseRevenue > 0) && (
                  <div className="pl-2 border-l-2 border-muted space-y-0.5">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Rezerwacje</span>
                      <span data-testid={`text-reservation-revenue-${c.year}-${c.month}`}>
                        {c.reservationRevenue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-muted-foreground">Podnajem</span>
                      <span data-testid={`text-sublease-revenue-${c.year}-${c.month}`}>
                        {c.subleaseRevenue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Realizacja</span>
                  <span className={`font-bold ${c.forecast > 0 ? (c.pct >= 1 ? "text-emerald-600 dark:text-emerald-400" : c.pct >= 0.7 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400") : "text-muted-foreground"}`}
                    data-testid={`text-pct-value-${c.year}-${c.month}`}
                  >
                    {c.forecast > 0 ? (c.pct * 100).toFixed(0) + "%" : "—"}
                  </span>
                </div>
                {c.forecast > 0 && (
                  <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                    <div
                      className={`h-1.5 rounded-full transition-all ${c.pct >= 1 ? "bg-emerald-500" : c.pct >= 0.7 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${Math.min(100, c.pct * 100)}%` }}
                    />
                  </div>
                )}
                {c.daysRemaining > 0 && c.forecast > 0 && c.remaining > 0 && (
                  <div className="pt-1 border-t border-border mt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Brakuje / dzień</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400" data-testid={`text-daily-needed-${c.year}-${c.month}`}>
                        {c.dailyNeeded.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Pozostało {c.daysRemaining} dni · brakuje {c.remaining.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                    </div>
                  </div>
                )}
                {c.forecast > 0 && c.pct >= 1 && (
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-1">
                    <TrendingUp className="h-3 w-3" />
                    Plan zrealizowany
                  </div>
                )}
                {c.forecast === 0 && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    Uzupełnij prognozę w zakładce Prognoza P/R/S
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
