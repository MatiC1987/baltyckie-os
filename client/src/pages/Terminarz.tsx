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
import { Plus, Lock, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const LOCATIONS = ["BULWAR PORTOWY", "NA WYDMIE", "WCZASOWA", "GRAND BALTIC", "PRZEWŁOKA", "INNE"];
const MONTH_NAMES_PL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const DAY_NAMES_PL = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

const RESERVATION_COLORS = [
  "bg-violet-400 dark:bg-violet-600",
  "bg-green-400 dark:bg-green-600",
  "bg-blue-400 dark:bg-blue-600",
  "bg-amber-400 dark:bg-amber-600",
  "bg-pink-400 dark:bg-pink-600",
  "bg-cyan-400 dark:bg-cyan-600",
  "bg-orange-400 dark:bg-orange-600",
  "bg-teal-400 dark:bg-teal-600",
  "bg-rose-400 dark:bg-rose-600",
  "bg-indigo-400 dark:bg-indigo-600",
];

function getColorForReservation(id: number): string {
  return RESERVATION_COLORS[id % RESERVATION_COLORS.length];
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

const DAY_WIDTH = 36;
const APT_COL_WIDTH = 140;

export default function Terminarz() {
  const { data: reservations, isLoading: loadingRes } = useReservations();
  const { data: apartments, isLoading: loadingApts } = useApartments();
  const { data: blockades, isLoading: loadingBlk } = useBlockades();

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

  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      apts = apts.filter(a => a.location === locationFilter);
    }
    apts.sort((a, b) => {
      const locA = a.location || "INNE";
      const locB = b.location || "INNE";
      if (locA !== locB) return LOCATIONS.indexOf(locA) - LOCATIONS.indexOf(locB);
      return a.name.localeCompare(b.name, "pl");
    });
    return apts;
  }, [apartments, locationFilter]);

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

  const totalWidth = days.length * DAY_WIDTH;
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
              {LOCATIONS.map(loc => (
                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden relative">
        <div className="flex">
          <div className="shrink-0 border-r border-border bg-muted/50 z-10" style={{ width: APT_COL_WIDTH }}>
            <div className="h-[52px] border-b border-border flex items-end px-2 pb-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Apartament</span>
            </div>
            {filteredApartments.map((apt) => (
              <div
                key={apt.id}
                className="h-[36px] flex items-center px-2 border-b border-border"
                data-testid={`apt-row-label-${apt.id}`}
              >
                <span className="text-[11px] font-semibold truncate" title={apt.name}>{apt.name}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-x-auto" ref={scrollContainerRef}>
            <div style={{ width: totalWidth, minWidth: "100%" }}>
              <div className="h-[52px] flex border-b border-border sticky top-0 bg-card z-[5]">
                {monthGroups.map((group, gi) => (
                  <div key={gi}>
                    <div
                      className="text-[10px] font-bold text-center border-b border-border bg-muted/30 text-muted-foreground uppercase tracking-wide"
                      style={{ width: group.days.length * DAY_WIDTH, height: 20 }}
                    >
                      {group.label}
                    </div>
                    <div className="flex" style={{ height: 32 }}>
                      {group.days.map((day, di) => {
                        const dow = day.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isToday = isSameDay(day, new Date());
                        return (
                          <div
                            key={di}
                            className={`flex flex-col items-center justify-center border-r border-border ${isWeekend ? "bg-muted/50" : ""} ${isToday ? "bg-primary/10" : ""}`}
                            style={{ width: DAY_WIDTH, minWidth: DAY_WIDTH }}
                          >
                            <span className={`text-[9px] leading-tight ${isWeekend ? "font-bold text-muted-foreground" : "text-muted-foreground"}`}>
                              {DAY_NAMES_PL[dow]}
                            </span>
                            <span className={`text-[10px] leading-tight ${isToday ? "font-bold text-primary" : ""}`}>
                              {day.getDate().toString().padStart(2, "0")}.{(day.getMonth() + 1).toString().padStart(2, "0")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {filteredApartments.map((apt) => {
                const aptReservations = (reservations || []).filter(r => r.apartmentId === apt.id && r.status !== "ANULOWANA");
                const aptBlockades = (blockades || []).filter((b: any) => b.apartmentId === apt.id);

                return (
                  <div key={apt.id} className="relative h-[36px] border-b border-border" data-testid={`apt-row-${apt.id}`}>
                    {days.map((day, di) => {
                      const dow = day.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div
                          key={di}
                          className={`absolute top-0 bottom-0 border-r border-border/30 ${isWeekend ? "bg-muted/30" : ""} ${isToday ? "bg-primary/5" : ""}`}
                          style={{ left: di * DAY_WIDTH, width: DAY_WIDTH }}
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

                      const left = effectiveStart * DAY_WIDTH;
                      const width = (effectiveEnd - effectiveStart + 1) * DAY_WIDTH;

                      return (
                        <div
                          key={`blk-${blk.id}`}
                          className="absolute top-[4px] h-[28px] bg-gray-400/50 dark:bg-gray-600/50 rounded-sm z-[2] flex items-center justify-center cursor-pointer border border-gray-500/30"
                          style={{ left, width }}
                          onMouseEnter={(e) => {
                            setHoveredBlockade(blk);
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => setHoveredBlockade(null)}
                          data-testid={`blockade-${blk.id}`}
                        >
                          {width > 60 && (
                            <span className="text-[10px] text-gray-700 dark:text-gray-300 font-medium truncate px-1">
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

                      const left = effectiveStart * DAY_WIDTH;
                      const width = (effectiveEnd - effectiveStart + 1) * DAY_WIDTH;
                      const colorClass = getColorForReservation(res.id);

                      return (
                        <div
                          key={`res-${res.id}`}
                          className={`absolute top-[4px] h-[28px] ${colorClass} rounded-sm z-[3] flex items-center cursor-pointer shadow-sm border border-black/10`}
                          style={{ left, width }}
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
                          <span className="text-[10px] text-white font-semibold truncate px-1.5 drop-shadow-sm">
                            {res.guestName}
                          </span>
                        </div>
                      );
                    })}

                    {todayIndex >= 0 && (
                      <div
                        className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-[4]"
                        style={{ left: todayIndex * DAY_WIDTH + DAY_WIDTH / 2 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        <span>Wyświetlono {filteredApartments.length} apartamentów</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-violet-400 dark:bg-violet-600" />
          <span>Rezerwacja</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm bg-gray-400/50 dark:bg-gray-600/50 border border-gray-500/30" />
          <span>Blokada</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-[2px] h-3 bg-red-500" />
          <span>Dzisiaj</span>
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
