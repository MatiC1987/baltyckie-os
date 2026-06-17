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

function getDateStr(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split("T")[0];
}

function buildCards(
  reservations: Reservation[],
  forecastData: ForecastMonth[],
  dateStr: string,
  months: { year: number; month: number }[]
) {
  return months.map(({ year, month }, idx) => {
    const matched = reservations.filter(r => {
      if (!r.createdAt || !r.startDate) return false;
      const createdDate = new Date(r.createdAt).toISOString().split("T")[0];
      if (createdDate !== dateStr) return false;
      const start = new Date(r.startDate);
      return start.getFullYear() === year && start.getMonth() === month;
    });

    const total = matched.reduce((sum, r) => sum + (Number(r.price) || 0), 0);

    const forecast = forecastData.find(f => f.year === year && f.month === month);
    let dailyNeeded: number | null = null;
    if (forecast && forecast.daysRemaining > 0 && forecast.forecast > 0) {
      const remaining = Math.max(0, forecast.forecast - forecast.actual);
      dailyNeeded = remaining / forecast.daysRemaining;
    }

    return { year, month, total, dailyNeeded, isCurrentMonth: idx === 0 };
  });
}

function ReservationDaySection({
  label,
  dayLabel,
  cards,
  testPrefix,
}: {
  label: string;
  dayLabel: string;
  cards: ReturnType<typeof buildCards>;
  testPrefix: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarPlus className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-lg font-semibold" data-testid={`text-${testPrefix}-title`}>{label}</h3>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(c => (
          <Card
            key={`${c.year}-${c.month}`}
            className={c.isCurrentMonth
              ? "border-primary/30 bg-cyan-50/40 dark:bg-cyan-950/20 ring-1 ring-cyan-300/30 dark:ring-cyan-600/20"
              : ""}
            data-testid={`card-${testPrefix}-${c.year}-${c.month}`}
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
                <div className="text-[10px] text-muted-foreground mb-0.5">{dayLabel}</div>
                <div
                  className={`text-sm font-bold ${c.total > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
                  data-testid={`text-${testPrefix}-total-${c.year}-${c.month}`}
                >
                  {c.total.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} zł
                </div>
              </div>
              <div className="pt-1 border-t border-border">
                <div className="text-[10px] text-muted-foreground mb-0.5">Brakuje / dzień</div>
                <div
                  className={`text-xs font-semibold ${c.dailyNeeded !== null ? "text-orange-600 dark:text-orange-400" : "text-muted-foreground"}`}
                  data-testid={`text-${testPrefix}-daily-${c.year}-${c.month}`}
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

export function TodayReservationsWidget({ reservations, forecastData }: Props) {
  const todayStr = getDateStr(0);
  const yesterdayStr = getDateStr(-1);
  const dayBeforeStr = getDateStr(-2);

  const months = useMemo(() => {
    const now = new Date();
    const result = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      result.push({ year: d.getFullYear(), month: d.getMonth() });
    }
    return result;
  }, []);

  const todayCards = useMemo(
    () => buildCards(reservations, forecastData, todayStr, months),
    [months, reservations, forecastData, todayStr]
  );
  const yesterdayCards = useMemo(
    () => buildCards(reservations, forecastData, yesterdayStr, months),
    [months, reservations, forecastData, yesterdayStr]
  );
  const dayBeforeCards = useMemo(
    () => buildCards(reservations, forecastData, dayBeforeStr, months),
    [months, reservations, forecastData, dayBeforeStr]
  );

  return (
    <div className="space-y-6">
      <ReservationDaySection
        label="Rezerwacje dzisiaj"
        dayLabel="Złożone dziś"
        cards={todayCards}
        testPrefix="today-res"
      />
      <ReservationDaySection
        label="Rezerwacje wczoraj"
        dayLabel="Złożone wczoraj"
        cards={yesterdayCards}
        testPrefix="yesterday-res"
      />
      <ReservationDaySection
        label="Rezerwacje przedwczoraj"
        dayLabel="Złożone przedwczoraj"
        cards={dayBeforeCards}
        testPrefix="daybefore-res"
      />
    </div>
  );
}
