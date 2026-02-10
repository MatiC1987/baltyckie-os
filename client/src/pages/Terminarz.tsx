import { useState, useMemo, useRef, useEffect } from "react";
import { useReservations, useCreateReservation } from "@/hooks/use-reservations";
import { useApartments } from "@/hooks/use-apartments";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertReservationSchema, type InsertReservation, type Reservation, type Apartment } from "@shared/schema";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Lock, ChevronLeft, ChevronRight, X, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type { Location } from "@shared/schema";

const MONTH_NAMES_PL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const DAY_NAMES_PL = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

interface TerminarzColors {
  DO_OPLACENIA: string;
  PRZYJETA: string;
  ANULOWANA: string;
  BLOKADA: string;
}

const DEFAULT_COLORS: TerminarzColors = {
  DO_OPLACENIA: "#f59e0b",
  PRZYJETA: "#22c55e",
  ANULOWANA: "#ef4444",
  BLOKADA: "#9ca3af",
};

const COLORS_STORAGE_KEY = "terminarz-colors-v1";

function loadColors(): TerminarzColors {
  try {
    const stored = localStorage.getItem(COLORS_STORAGE_KEY);
    if (stored) return { ...DEFAULT_COLORS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_COLORS;
}

function saveColors(colors: TerminarzColors) {
  try { localStorage.setItem(COLORS_STORAGE_KEY, JSON.stringify(colors)); } catch {}
}

function getColorForStatus(status: string, colors: TerminarzColors): string {
  switch (status) {
    case "DO_OPLACENIA": return colors.DO_OPLACENIA;
    case "PRZYJETA": return colors.PRZYJETA;
    case "ANULOWANA": return colors.ANULOWANA;
    default: return colors.PRZYJETA;
  }
}

function useLocations() {
  return useQuery<Location[]>({ queryKey: ["/api/locations"] });
}

function useBlockades() {
  return useQuery<any[]>({
    queryKey: ["/api/blockades"],
    queryFn: async () => {
      const res = await fetch("/api/blockades", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch blockades");
      return res.json();
    },
  });
}

function useCreateBlockade() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { apartmentId: number; startDate: string; endDate: string; reason?: string }) => {
      const res = await fetch("/api/blockades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create blockade");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blockades"] });
      toast({ title: "Sukces", description: "Blokada została dodana" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się dodać blokady", variant: "destructive" });
    },
  });
}

function useDeleteBlockade() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/blockades/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete blockade");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/blockades"] });
      toast({ title: "Sukces", description: "Blokada została usunięta" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się usunąć blokady", variant: "destructive" });
    },
  });
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getDaysArray(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const NORMAL = { dayWidth: 36, aptColWidth: 140, rowHeight: 36, headerHeight: 52, monthLabelHeight: 20, dayHeaderHeight: 32, barTop: 4, barHeight: 28, aptFontSize: "11px", dayNameSize: "9px", dayNumSize: "10px", barFontSize: "10px", monthLabelSize: "10px" };
const COMPACT = { dayWidth: 22, aptColWidth: 100, rowHeight: 22, headerHeight: 36, monthLabelHeight: 14, dayHeaderHeight: 22, barTop: 2, barHeight: 18, aptFontSize: "9px", dayNameSize: "7px", dayNumSize: "8px", barFontSize: "8px", monthLabelSize: "8px" };

export default function Terminarz() {
  const { data: reservations, isLoading: loadingRes } = useReservations();
  const { data: apartments, isLoading: loadingApts } = useApartments();
  const { data: blockades, isLoading: loadingBlk } = useBlockades();
  const { data: dbLocations } = useLocations();

  const [monthsToShow, setMonthsToShow] = useState(2);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return formatDate(d);
  });
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [showNewBlockade, setShowNewBlockade] = useState(false);
  const [hoveredRes, setHoveredRes] = useState<Reservation | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [hoveredBlockade, setHoveredBlockade] = useState<any>(null);
  const [compact, setCompact] = useState(false);
  const [colors, setColors] = useState<TerminarzColors>(loadColors);
  const [showSettings, setShowSettings] = useState(false);
  const [previewRes, setPreviewRes] = useState<Reservation | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sz = compact ? COMPACT : NORMAL;

  const locationNames = useMemo(() => {
    if (!dbLocations || dbLocations.length === 0) return ["GRAND BALTIC", "BULWAR PORTOWY", "WCZASOWA", "PRZEWŁOKA", "NA WYDMIE", "INNE"];
    return [...dbLocations.map(l => l.name), "INNE"];
  }, [dbLocations]);

  const rangeStart = useMemo(() => new Date(startDate), [startDate]);
  const rangeEnd = useMemo(() => {
    const end = addMonths(rangeStart, monthsToShow);
    end.setDate(end.getDate() - 1);
    return end;
  }, [rangeStart, monthsToShow]);

  const days = useMemo(() => getDaysArray(rangeStart, rangeEnd), [rangeStart, rangeEnd]);

  const filteredApartments = useMemo(() => {
    if (!apartments) return [];
    let apts = [...apartments].filter(a => a.active !== false);
    if (locationFilter !== "ALL") {
      apts = apts.filter(a => (a.location || "INNE") === locationFilter);
    }
    apts.sort((a, b) => {
      const locA = a.location || "INNE";
      const locB = b.location || "INNE";
      const idxA = locationNames.indexOf(locA);
      const idxB = locationNames.indexOf(locB);
      if (idxA !== idxB) return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      return a.name.localeCompare(b.name, "pl");
    });
    return apts;
  }, [apartments, locationFilter, locationNames]);

  const apartmentsByLocation = useMemo(() => {
    const groups: { location: string; apartments: typeof filteredApartments }[] = [];
    const seen = new Set<string>();
    for (const apt of filteredApartments) {
      const loc = apt.location || "INNE";
      if (!seen.has(loc)) {
        seen.add(loc);
        groups.push({ location: loc, apartments: [] });
      }
      groups.find(g => g.location === loc)!.apartments.push(apt);
    }
    return groups;
  }, [filteredApartments]);

  const monthGroups = useMemo(() => {
    const groups: { label: string; days: Date[] }[] = [];
    let currentMonth = -1;
    let currentYear = -1;
    for (const day of days) {
      if (day.getMonth() !== currentMonth || day.getFullYear() !== currentYear) {
        currentMonth = day.getMonth();
        currentYear = day.getFullYear();
        groups.push({ label: `${MONTH_NAMES_PL[currentMonth]} ${currentYear}`, days: [] });
      }
      groups[groups.length - 1].days.push(day);
    }
    return groups;
  }, [days]);

  const navigateMonths = (offset: number) => {
    const d = new Date(startDate);
    d.setMonth(d.getMonth() + offset);
    d.setDate(1);
    setStartDate(formatDate(d));
  };

  const goToToday = () => {
    const d = new Date();
    d.setDate(1);
    setStartDate(formatDate(d));
  };

  const isLoading = loadingRes || loadingApts || loadingBlk;

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-10 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 w-full bg-muted animate-pulse rounded-lg" />)}
        </div>
      </div>
    );
  }

  const totalWidth = days.length * sz.dayWidth;
  const todayIndex = days.findIndex(d => isSameDay(d, new Date()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight" data-testid="text-terminarz-title">Terminarz</h2>
          <p className="text-muted-foreground text-sm">Graficzny terminarz rezerwacji apartamentów.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setShowNewReservation(true)} data-testid="button-add-reservation-cal">
            <Plus className="mr-2 h-4 w-4" /> Nowa
          </Button>
          <Button variant="outline" onClick={() => setShowNewBlockade(true)} data-testid="button-add-blockade">
            <Lock className="mr-2 h-4 w-4" /> Dodaj blokadę
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => navigateMonths(-1)} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-40"
            data-testid="input-start-date"
          />
          <Button size="icon" variant="ghost" onClick={() => navigateMonths(1)} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} data-testid="button-today">
            Dziś
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Okres:</Label>
          <Select value={String(monthsToShow)} onValueChange={v => setMonthsToShow(Number(v))}>
            <SelectTrigger className="w-[120px]" data-testid="select-months">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6].map(n => (
                <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "miesiąc" : n < 5 ? "miesiące" : "miesięcy"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Lokalizacja:</Label>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-location-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Wszystkie</SelectItem>
              {locationNames.map(loc => (
                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button size="icon" variant="ghost" onClick={() => setShowSettings(true)} data-testid="button-terminarz-settings">
          <Settings2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-auto relative" ref={scrollContainerRef} style={{ maxHeight: "calc(100vh - 220px)" }}>
        <div style={{ width: sz.aptColWidth + totalWidth, minWidth: sz.aptColWidth + totalWidth }}>
          <div className="flex sticky top-0 z-20 bg-card">
            <div className="shrink-0 border-r border-b border-border bg-muted/50 flex items-end px-2 pb-1 sticky left-0 z-30" style={{ width: sz.aptColWidth, minWidth: sz.aptColWidth, height: sz.headerHeight }}>
              <span className="font-semibold text-muted-foreground uppercase" style={{ fontSize: sz.monthLabelSize }}>Apartament</span>
            </div>
            <div className="flex border-b border-border" style={{ height: sz.headerHeight }}>
              {monthGroups.map((group, gi) => (
                <div key={gi}>
                  <div
                    className="font-bold text-center border-b border-border bg-muted/30 text-muted-foreground uppercase tracking-wide flex items-center justify-center"
                    style={{ width: group.days.length * sz.dayWidth, height: sz.monthLabelHeight, fontSize: sz.monthLabelSize }}
                  >
                    {group.label}
                  </div>
                  <div className="flex" style={{ height: sz.dayHeaderHeight }}>
                    {group.days.map((day, di) => {
                      const dow = day.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div
                          key={di}
                          className={`flex flex-col items-center justify-center border-r border-border ${isWeekend ? "bg-muted/50" : ""} ${isToday ? "bg-primary/10" : ""}`}
                          style={{ width: sz.dayWidth, minWidth: sz.dayWidth }}
                        >
                          <span className={`leading-tight ${isWeekend ? "font-bold text-muted-foreground" : "text-muted-foreground"}`} style={{ fontSize: sz.dayNameSize }}>
                            {DAY_NAMES_PL[dow]}
                          </span>
                          <span className={`leading-tight ${isToday ? "font-bold text-primary" : ""}`} style={{ fontSize: sz.dayNumSize }}>
                            {day.getDate().toString().padStart(2, "0")}{compact ? "" : `.${(day.getMonth() + 1).toString().padStart(2, "0")}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {apartmentsByLocation.map((group) => (
            <div key={group.location}>
              <div className="flex sticky left-0 z-10">
                <div
                  className="flex items-center px-2 gap-2 border-b border-border bg-muted/70 font-bold text-muted-foreground uppercase tracking-wide"
                  style={{ height: sz.rowHeight, width: sz.aptColWidth + totalWidth, minWidth: sz.aptColWidth + totalWidth, fontSize: sz.aptFontSize }}
                  data-testid={`terminarz-location-${group.location.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <span>{group.location}</span>
                  <Badge variant="secondary" className="text-xs">{group.apartments.length}</Badge>
                </div>
              </div>
              {group.apartments.map((apt) => {
                const aptReservations = (reservations || []).filter(r => r.status !== "ANULOWANA" && (r.apartmentId === apt.id || (r.apartmentIds && r.apartmentIds.includes(apt.id))));
                const aptBlockades = (blockades || []).filter((b: any) => b.apartmentId === apt.id);

                return (
                  <div key={apt.id} className="flex" data-testid={`apt-row-${apt.id}`}>
                    <div
                      className="shrink-0 border-r border-b border-border bg-card flex items-center px-2 sticky left-0 z-10"
                      style={{ width: sz.aptColWidth, minWidth: sz.aptColWidth, height: sz.rowHeight }}
                      data-testid={`apt-row-label-${apt.id}`}
                    >
                      <span className="font-semibold truncate" style={{ fontSize: sz.aptFontSize }} title={apt.name}>{apt.name}</span>
                    </div>
                    <div className="relative border-b border-border flex-1" style={{ height: sz.rowHeight, width: totalWidth, minWidth: totalWidth }}>
                      {days.map((day, di) => {
                        const dow = day.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isToday = isSameDay(day, new Date());
                        return (
                          <div
                            key={di}
                            className={`absolute top-0 bottom-0 border-r border-border/30 ${isWeekend ? "bg-muted/30" : ""} ${isToday ? "bg-primary/5" : ""}`}
                            style={{ left: di * sz.dayWidth, width: sz.dayWidth }}
                          />
                        );
                      })}

                      {aptBlockades.map((blk: any) => {
                        const blkStart = new Date(blk.startDate);
                        const blkEnd = new Date(blk.endDate);
                        const startIdx = days.findIndex(d => isSameDay(d, blkStart));
                        const endIdx = days.findIndex(d => isSameDay(d, blkEnd));

                        const effectiveStart = startIdx >= 0 ? startIdx : (blkStart < rangeStart ? 0 : -1);
                        const effectiveEnd = endIdx >= 0 ? endIdx : (blkEnd > rangeEnd ? days.length - 1 : -1);

                        if (effectiveStart < 0 || effectiveEnd < 0 || effectiveStart > effectiveEnd) return null;

                        const left = effectiveStart * sz.dayWidth;
                        const width = (effectiveEnd - effectiveStart + 1) * sz.dayWidth;

                        return (
                          <div
                            key={`blk-${blk.id}`}
                            className="absolute rounded-md z-[2] flex items-center justify-center cursor-pointer border border-black/10"
                            style={{ left, width, top: sz.barTop, height: sz.barHeight, backgroundColor: colors.BLOKADA, opacity: 0.7 }}
                            onMouseEnter={(e) => {
                              setHoveredBlockade(blk);
                              setTooltipPos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseLeave={() => setHoveredBlockade(null)}
                            data-testid={`blockade-${blk.id}`}
                          >
                            {width > (compact ? 40 : 60) && (
                              <span className="text-gray-700 dark:text-gray-300 font-medium truncate px-1" style={{ fontSize: sz.barFontSize }}>
                                {blk.reason || "Blokada"}
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {aptReservations.map((res) => {
                        const resStart = new Date(res.startDate);
                        const resEnd = new Date(res.endDate);
                        const startIdx = days.findIndex(d => isSameDay(d, resStart));
                        const endIdx = days.findIndex(d => isSameDay(d, resEnd));

                        const effectiveStart = startIdx >= 0 ? startIdx : (resStart < rangeStart ? 0 : -1);
                        const effectiveEnd = endIdx >= 0 ? endIdx : (resEnd > rangeEnd ? days.length - 1 : -1);

                        if (effectiveStart < 0 || effectiveEnd < 0 || effectiveStart > effectiveEnd) return null;

                        const left = effectiveStart * sz.dayWidth;
                        const width = (effectiveEnd - effectiveStart + 1) * sz.dayWidth;
                        const barColor = getColorForStatus(res.status || "PRZYJETA", colors);

                        return (
                          <div
                            key={`res-${res.id}`}
                            className="absolute rounded-md z-[3] flex items-center cursor-pointer shadow-sm border border-black/10"
                            style={{ left, width, top: sz.barTop, height: sz.barHeight, backgroundColor: barColor }}
                            onClick={() => setPreviewRes(res)}
                            onMouseEnter={(e) => {
                              setHoveredRes(res);
                              setTooltipPos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseMove={(e) => {
                              setTooltipPos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseLeave={() => setHoveredRes(null)}
                            data-testid={`cal-res-${res.id}`}
                          >
                            {res.apartmentIds && res.apartmentIds.length > 1 && (
                              <span className="bg-white/30 text-white font-bold rounded-sm px-0.5 ml-0.5 flex-shrink-0" style={{ fontSize: compact ? "7px" : "8px", lineHeight: "1.2" }}>
                                {res.apartmentIds.length}
                              </span>
                            )}
                            <span className="text-white font-semibold truncate px-1 drop-shadow-sm" style={{ fontSize: sz.barFontSize }}>
                              {res.guestName}
                            </span>
                          </div>
                        );
                      })}

                      {todayIndex >= 0 && (
                        <div
                          className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-[4]"
                          style={{ left: todayIndex * sz.dayWidth + sz.dayWidth / 2 }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span>Wyświetlono {filteredApartments.length} apartamentów</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-md" style={{ backgroundColor: colors.DO_OPLACENIA }} />
            <span>Do opłacenia</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-md" style={{ backgroundColor: colors.PRZYJETA }} />
            <span>Przyjęta</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-md" style={{ backgroundColor: colors.ANULOWANA }} />
            <span>Anulowana</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-md" style={{ backgroundColor: colors.BLOKADA, opacity: 0.7 }} />
            <span>Blokada</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-[2px] h-3 bg-red-500" />
            <span>Dzisiaj</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="compact-view"
            checked={compact}
            onCheckedChange={(checked) => setCompact(checked === true)}
            data-testid="checkbox-compact-view"
          />
          <label htmlFor="compact-view" className="cursor-pointer select-none">
            Widok kompaktowy
          </label>
        </div>
      </div>

      {hoveredRes && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}
        >
          <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm max-w-xs">
            <p className="font-bold text-foreground">{hoveredRes.guestName}</p>
            <p className="text-muted-foreground text-xs mt-1">
              {hoveredRes.startDate} - {hoveredRes.endDate}
            </p>
            <p className="text-xs mt-0.5">
              Nr: {hoveredRes.reservationNumber}
            </p>
            <p className="text-xs mt-0.5 font-semibold">
              {Number(hoveredRes.price).toFixed(2)} zł
            </p>
            {hoveredRes.apartmentIds && hoveredRes.apartmentIds.length > 1 && (
              <p className="text-xs mt-1 text-muted-foreground">
                Rezerwacja grupowa ({hoveredRes.apartmentIds.length} apt.): {hoveredRes.apartmentIds.map(id => {
                  const a = apartments?.find(a => a.id === id);
                  return a?.name || `#${id}`;
                }).join(", ")}
              </p>
            )}
          </div>
        </div>
      )}

      {hoveredBlockade && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 10 }}
        >
          <div className="bg-popover border border-border rounded-lg shadow-lg p-3 text-sm max-w-xs">
            <p className="font-bold text-foreground">Blokada</p>
            <p className="text-muted-foreground text-xs mt-1">
              {hoveredBlockade.startDate} - {hoveredBlockade.endDate}
            </p>
            {hoveredBlockade.reason && (
              <p className="text-xs mt-0.5">{hoveredBlockade.reason}</p>
            )}
          </div>
        </div>
      )}

      <NewReservationDialog
        open={showNewReservation}
        onClose={() => setShowNewReservation(false)}
        apartments={filteredApartments}
      />
      <NewBlockadeDialog
        open={showNewBlockade}
        onClose={() => setShowNewBlockade(false)}
        apartments={filteredApartments}
      />

      <ColorSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        colors={colors}
        onChange={(newColors) => {
          setColors(newColors);
          saveColors(newColors);
        }}
      />

      {previewRes && (
        <Dialog open={!!previewRes} onOpenChange={(o) => { if (!o) setPreviewRes(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Podgląd rezerwacji</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="text-muted-foreground">Numer:</div>
                <div className="font-medium" data-testid="preview-res-number">{previewRes.reservationNumber}</div>
                <div className="text-muted-foreground">Gość:</div>
                <div className="font-medium" data-testid="preview-res-guest">{previewRes.guestName}</div>
                <div className="text-muted-foreground">Przyjazd:</div>
                <div>{previewRes.startDate}</div>
                <div className="text-muted-foreground">Wyjazd:</div>
                <div>{previewRes.endDate}</div>
                <div className="text-muted-foreground">Kwota pobytu:</div>
                <div className="font-semibold">{Number(previewRes.price || 0).toFixed(2)} PLN</div>
                <div className="text-muted-foreground">Zaliczka:</div>
                <div>{Number(previewRes.prepayment || 0).toFixed(2)} PLN</div>
                <div className="text-muted-foreground">Wpłacona kwota:</div>
                <div>{Number(previewRes.paidAmount || 0).toFixed(2)} PLN</div>
                <div className="text-muted-foreground">Status:</div>
                <div>
                  <span
                    className="inline-block px-2 py-0.5 rounded-md text-white text-xs font-semibold"
                    style={{ backgroundColor: getColorForStatus(previewRes.status || "PRZYJETA", colors) }}
                  >
                    {previewRes.status}
                  </span>
                </div>
                {previewRes.apartmentIds && previewRes.apartmentIds.length > 1 && (
                  <>
                    <div className="text-muted-foreground">Apartamenty:</div>
                    <div className="font-medium" data-testid="preview-res-apartments">
                      {previewRes.apartmentIds.map(id => {
                        const a = apartments?.find(a => a.id === id);
                        return a?.name || `#${id}`;
                      }).join(", ")}
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end pt-2">
                <Button variant="ghost" onClick={() => setPreviewRes(null)}>Zamknij</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function NewReservationDialog({ open, onClose, apartments }: { open: boolean; onClose: () => void; apartments: Apartment[] }) {
  const createReservation = useCreateReservation();

  const form = useForm<InsertReservation>({
    resolver: zodResolver(insertReservationSchema),
    defaultValues: {
      reservationNumber: `RES-${Date.now().toString().slice(-6)}`,
      status: "DO_OPLACENIA",
      prepayment: "0",
      paidAmount: "0",
      surcharge: "0",
    },
  });

  const onSubmit = (data: InsertReservation) => {
    createReservation.mutate(data, {
      onSuccess: () => {
        onClose();
        form.reset({
          reservationNumber: `RES-${Date.now().toString().slice(-6)}`,
          status: "DO_OPLACENIA",
          prepayment: "0",
          paidAmount: "0",
          surcharge: "0",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nowa rezerwacja</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Apartament</Label>
            <Controller
              control={form.control}
              name="apartmentId"
              render={({ field }) => (
                <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                  <SelectTrigger data-testid="cal-select-apartment">
                    <SelectValue placeholder="Wybierz apartament" />
                  </SelectTrigger>
                  <SelectContent>
                    {apartments.map((apt) => (
                      <SelectItem key={apt.id} value={apt.id.toString()}>{apt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Numer rezerwacji</Label>
              <Input {...form.register("reservationNumber")} data-testid="cal-input-res-number" />
            </div>
            <div className="space-y-2">
              <Label>Gość</Label>
              <Input {...form.register("guestName")} placeholder="Imię i nazwisko" data-testid="cal-input-guest" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Przyjazd</Label>
              <Input type="date" {...form.register("startDate")} data-testid="cal-input-start" />
            </div>
            <div className="space-y-2">
              <Label>Wyjazd</Label>
              <Input type="date" {...form.register("endDate")} data-testid="cal-input-end" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Kwota (PLN)</Label>
              <Input type="number" step="0.01" {...form.register("price")} data-testid="cal-input-price" />
            </div>
            <div className="space-y-2">
              <Label>Zaliczka (PLN)</Label>
              <Input type="number" step="0.01" {...form.register("prepayment")} data-testid="cal-input-prepayment" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={createReservation.isPending} data-testid="cal-button-submit-res">
              {createReservation.isPending ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewBlockadeDialog({ open, onClose, apartments }: { open: boolean; onClose: () => void; apartments: Apartment[] }) {
  const createBlockade = useCreateBlockade();
  const [apartmentId, setApartmentId] = useState("");
  const [blkStartDate, setBlkStartDate] = useState("");
  const [blkEndDate, setBlkEndDate] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apartmentId || !blkStartDate || !blkEndDate) return;
    createBlockade.mutate(
      { apartmentId: Number(apartmentId), startDate: blkStartDate, endDate: blkEndDate, reason: reason || undefined },
      {
        onSuccess: () => {
          onClose();
          setApartmentId("");
          setBlkStartDate("");
          setBlkEndDate("");
          setReason("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj blokadę</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Apartament</Label>
            <Select value={apartmentId} onValueChange={setApartmentId}>
              <SelectTrigger data-testid="blk-select-apartment">
                <SelectValue placeholder="Wybierz apartament" />
              </SelectTrigger>
              <SelectContent>
                {apartments.map((apt) => (
                  <SelectItem key={apt.id} value={apt.id.toString()}>{apt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data od</Label>
              <Input type="date" value={blkStartDate} onChange={e => setBlkStartDate(e.target.value)} data-testid="blk-input-start" />
            </div>
            <div className="space-y-2">
              <Label>Data do</Label>
              <Input type="date" value={blkEndDate} onChange={e => setBlkEndDate(e.target.value)} data-testid="blk-input-end" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Powód (opcjonalnie)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="np. Remont, Przerwa" data-testid="blk-input-reason" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" type="button" onClick={onClose}>Anuluj</Button>
            <Button type="submit" disabled={createBlockade.isPending} data-testid="blk-button-submit">
              {createBlockade.isPending ? "Zapisywanie..." : "Dodaj blokadę"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ColorSettingsDialog({ open, onClose, colors, onChange }: {
  open: boolean;
  onClose: () => void;
  colors: TerminarzColors;
  onChange: (colors: TerminarzColors) => void;
}) {
  const [local, setLocal] = useState<TerminarzColors>(colors);

  const handleSave = () => {
    onChange(local);
    onClose();
  };

  const handleReset = () => {
    setLocal(DEFAULT_COLORS);
  };

  const colorFields: { key: keyof TerminarzColors; label: string }[] = [
    { key: "DO_OPLACENIA", label: "Do opłacenia" },
    { key: "PRZYJETA", label: "Przyjęta" },
    { key: "ANULOWANA", label: "Anulowana" },
    { key: "BLOKADA", label: "Blokada" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ustawienia kolorów</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {colorFields.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <Label className="text-sm">{label}</Label>
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-md border border-border cursor-pointer"
                  style={{ backgroundColor: local[key] }}
                />
                <Input
                  type="color"
                  value={local[key]}
                  onChange={e => setLocal({ ...local, [key]: e.target.value })}
                  className="w-12 h-8 p-0 border-0 cursor-pointer"
                  data-testid={`color-${key}`}
                />
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-2">
            <Button variant="ghost" size="sm" onClick={handleReset}>Resetuj kolory</Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>Anuluj</Button>
              <Button onClick={handleSave} data-testid="button-save-colors">Zapisz</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
