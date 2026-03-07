import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useOrientationLock } from "@/hooks/use-orientation-lock";
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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Lock, ChevronLeft, ChevronRight, X, Settings2, Calendar, MapPin, User, CreditCard, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Location, Sublease, SubleaseApartmentChange } from "@shared/schema";

const MONTH_NAMES_PL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const DAY_NAMES_PL = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

interface TerminarzColors {
  DO_OPLACENIA: string;
  PRZYJETA: string;
  ANULOWANA: string;
  BLOKADA: string;
  PODNAJEM: string;
}

const DEFAULT_COLORS: TerminarzColors = {
  DO_OPLACENIA: "#f59e0b",
  PRZYJETA: "#22c55e",
  ANULOWANA: "#ef4444",
  BLOKADA: "#9ca3af",
  PODNAJEM: "#8b5cf6",
};

async function dbSaveTerminarzColors(colors: TerminarzColors) {
  await fetch('/api/terminarz-colors', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
    body: JSON.stringify(colors),
  });
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
const MOBILE = { dayWidth: 18, aptColWidth: 90, rowHeight: 28, headerHeight: 40, monthLabelHeight: 16, dayHeaderHeight: 24, barTop: 2, barHeight: 24, aptFontSize: "9px", dayNameSize: "7px", dayNumSize: "8px", barFontSize: "8px", monthLabelSize: "8px" };

export default function Terminarz() {
  useOrientationLock("landscape");
  const { data: reservations, isLoading: loadingRes } = useReservations();
  const { data: apartments, isLoading: loadingApts } = useApartments();
  const { data: blockades, isLoading: loadingBlk } = useBlockades();
  const { data: dbLocations } = useLocations();
  const { data: subleases = [] } = useQuery<Sublease[]>({ queryKey: ['/api/subleases'] });
  const { data: allAptChanges = [] } = useQuery<SubleaseApartmentChange[]>({ queryKey: ['/api/sublease-apartment-changes/all'] });

  const isMobile = useIsMobile();
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
  const [mobileInitDone, setMobileInitDone] = useState(false);
  const { data: dbColors } = useQuery<TerminarzColors>({
    queryKey: ['/api/terminarz-colors'],
    staleTime: 60000,
    refetchInterval: 60000,
  });
  const [colors, setColors] = useState<TerminarzColors>(DEFAULT_COLORS);

  useEffect(() => {
    if (!dbColors || Object.keys(dbColors).length === 0) {
      // Auto-migrate from localStorage on first load
      const flag = localStorage.getItem('migrated-terminarz-colors-to-db-v1');
      if (!flag) {
        try {
          const stored = localStorage.getItem('terminarz-colors-v1');
          if (stored) {
            const parsed = { ...DEFAULT_COLORS, ...JSON.parse(stored) };
            setColors(parsed);
            dbSaveTerminarzColors(parsed).then(() => {
              localStorage.setItem('migrated-terminarz-colors-to-db-v1', '1');
            });
          } else {
            localStorage.setItem('migrated-terminarz-colors-to-db-v1', '1');
          }
        } catch {}
      }
    } else {
      setColors({ ...DEFAULT_COLORS, ...dbColors });
    }
  }, [dbColors]);
  const [showSettings, setShowSettings] = useState(false);
  const [previewRes, setPreviewRes] = useState<Reservation | null>(null);
  const [dragSelection, setDragSelection] = useState<{ aptId: number; startIdx: number; endIdx: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showSelectionMenu, setShowSelectionMenu] = useState<{ aptId: number; startDate: string; endDate: string } | null>(null);
  const [resPrefill, setResPrefill] = useState<{ aptId?: number; startDate?: string; endDate?: string } | undefined>(undefined);
  const [blkPrefill, setBlkPrefill] = useState<{ aptId?: number; startDate?: string; endDate?: string } | undefined>(undefined);

  useEffect(() => {
    if (isMobile && !mobileInitDone) {
      setMonthsToShow(1);
      setMobileInitDone(true);
    }
  }, [isMobile, mobileInitDone]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sz = isMobile ? MOBILE : compact ? COMPACT : NORMAL;

  const dragDataRef = useRef<{
    reservationId: number;
    originalStartDate: string;
    originalEndDate: string;
    originalApartmentId: number;
    dayOffset: number;
  } | null>(null);
  const [dragOverAptId, setDragOverAptId] = useState<number | null>(null);
  const [isDraggingRes, setIsDraggingRes] = useState(false);

  const { toast } = useToast();

  const moveReservationMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/reservations/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      toast({ title: "Rezerwacja przeniesiona", description: "Daty rezerwacji zostały zaktualizowane." });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się przenieść rezerwacji.", variant: "destructive" });
    },
  });

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isDragging]);

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

  const handleDragStart = useCallback((e: React.DragEvent, res: Reservation, aptId: number) => {
    const rowRect = e.currentTarget.parentElement?.getBoundingClientRect();
    const clickXInRow = rowRect ? e.clientX - rowRect.left : 0;
    const clickDayIdx = Math.floor(clickXInRow / sz.dayWidth);

    const resStart = new Date(res.startDate);
    const resStartIdx = days.findIndex(d => isSameDay(d, resStart));
    const startDayInView = resStartIdx >= 0 ? resStartIdx : 0;

    const dayOffset = clickDayIdx - startDayInView;

    dragDataRef.current = {
      reservationId: res.id,
      originalStartDate: res.startDate,
      originalEndDate: res.endDate,
      originalApartmentId: aptId,
      dayOffset: Math.max(0, dayOffset),
    };
    setIsDraggingRes(true);

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(res.id));
  }, [sz.dayWidth, days]);

  const handleDragOver = useCallback((e: React.DragEvent, aptId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverAptId(aptId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverAptId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetAptId: number) => {
    e.preventDefault();
    setDragOverAptId(null);
    setIsDraggingRes(false);

    const dragData = dragDataRef.current;
    if (!dragData) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const dropDayIdx = Math.floor(x / sz.dayWidth);

    const newStartIdx = dropDayIdx - dragData.dayOffset;
    if (newStartIdx < 0 || newStartIdx >= days.length) {
      dragDataRef.current = null;
      return;
    }

    const origStart = new Date(dragData.originalStartDate);
    const origEnd = new Date(dragData.originalEndDate);
    const durationMs = origEnd.getTime() - origStart.getTime();

    const newStartDate = days[newStartIdx];
    const newEndDate = new Date(newStartDate.getTime() + durationMs);

    const newStartStr = formatDate(newStartDate);
    const newEndStr = formatDate(newEndDate);

    const hasChanged = newStartStr !== dragData.originalStartDate ||
      newEndStr !== dragData.originalEndDate ||
      targetAptId !== dragData.originalApartmentId;

    if (hasChanged) {
      const updateData: any = {
        startDate: newStartStr,
        endDate: newEndStr,
      };
      if (targetAptId !== dragData.originalApartmentId) {
        updateData.apartmentId = targetAptId;
      }
      moveReservationMutation.mutate({ id: dragData.reservationId, data: updateData });
    }

    dragDataRef.current = null;
  }, [sz.dayWidth, days, moveReservationMutation]);

  const handleDragEnd = useCallback(() => {
    setIsDraggingRes(false);
    setDragOverAptId(null);
    dragDataRef.current = null;
  }, []);

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
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-terminarz-title">Terminarz</h2>
          <p className="text-muted-foreground text-sm">Graficzny terminarz rezerwacji apartamentów.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={() => setShowNewReservation(true)} data-testid="button-add-reservation-cal">
            <Plus className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Nowa</span>
          </Button>
          <Button variant="outline" onClick={() => setShowNewBlockade(true)} data-testid="button-add-blockade">
            <Lock className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">Dodaj blokadę</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => navigateMonths(-1)} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full sm:w-40"
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
          <Label className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Okres:</Label>
          <Select value={String(monthsToShow)} onValueChange={v => setMonthsToShow(Number(v))}>
            <SelectTrigger className="w-[100px] sm:w-[120px]" data-testid="select-months">
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
          <Label className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Lokalizacja:</Label>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-location-filter">
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

      {isMobile ? (
        <MobileAgendaView
          days={days}
          reservations={reservations || []}
          blockades={blockades || []}
          subleases={subleases}
          allAptChanges={allAptChanges}
          filteredApartments={filteredApartments}
          colors={colors}
          onAddReservation={() => setShowNewReservation(true)}
          onAddBlockade={() => setShowNewBlockade(true)}
        />
      ) : (
      <>
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
                    <div
                      className={`relative border-b border-border flex-1 select-none ${dragOverAptId === apt.id ? "bg-primary/10" : ""}`}
                      style={{ height: sz.rowHeight, width: totalWidth, minWidth: totalWidth }}
                      data-testid={`apt-drop-zone-${apt.id}`}
                      onDragOver={(e) => handleDragOver(e, apt.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, apt.id)}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const dayIdx = Math.floor(x / sz.dayWidth);
                        if (dayIdx >= 0 && dayIdx < days.length) {
                          setIsDragging(true);
                          setDragSelection({ aptId: apt.id, startIdx: dayIdx, endIdx: dayIdx });
                          setShowSelectionMenu(null);
                        }
                      }}
                      onMouseMove={(e) => {
                        if (!isDragging || !dragSelection || dragSelection.aptId !== apt.id) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const dayIdx = Math.max(0, Math.min(days.length - 1, Math.floor(x / sz.dayWidth)));
                        setDragSelection(prev => prev ? { ...prev, endIdx: dayIdx } : null);
                      }}
                      onMouseUp={() => {
                        if (!isDragging || !dragSelection || dragSelection.aptId !== apt.id) return;
                        setIsDragging(false);
                        const selStart = Math.min(dragSelection.startIdx, dragSelection.endIdx);
                        const selEnd = Math.max(dragSelection.startIdx, dragSelection.endIdx);
                        if (selStart >= 0 && selEnd < days.length) {
                          setShowSelectionMenu({
                            aptId: apt.id,
                            startDate: formatDate(days[selStart]),
                            endDate: formatDate(days[selEnd]),
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        if (isDragging) {
                          setIsDragging(false);
                          if (dragSelection && dragSelection.aptId === apt.id) {
                            const selStart = Math.min(dragSelection.startIdx, dragSelection.endIdx);
                            const selEnd = Math.max(dragSelection.startIdx, dragSelection.endIdx);
                            if (selStart >= 0 && selEnd < days.length) {
                              setShowSelectionMenu({
                                aptId: apt.id,
                                startDate: formatDate(days[selStart]),
                                endDate: formatDate(days[selEnd]),
                              });
                            }
                          }
                        }
                      }}
                    >
                      {days.map((day, di) => {
                        const dow = day.getDay();
                        const isWeekend = dow === 0 || dow === 6;
                        const isToday = isSameDay(day, new Date());
                        const isSelected = dragSelection && dragSelection.aptId === apt.id && di >= Math.min(dragSelection.startIdx, dragSelection.endIdx) && di <= Math.max(dragSelection.startIdx, dragSelection.endIdx);
                        return (
                          <div
                            key={di}
                            className={`absolute top-0 bottom-0 border-r border-border/30 ${isWeekend ? "bg-muted/30" : ""} ${isToday ? "bg-primary/5" : ""} ${isSelected ? "bg-primary/20" : ""}`}
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

                        const halfDay = sz.dayWidth / 2;
                        const startsInRange = startIdx >= 0;
                        const endsInRange = endIdx >= 0;
                        const left = effectiveStart * sz.dayWidth + (startsInRange ? halfDay : 0);
                        const rightEdge = effectiveEnd * sz.dayWidth + (endsInRange ? halfDay : sz.dayWidth);
                        const width = Math.max(rightEdge - left, halfDay);

                        return (
                          <div
                            key={`blk-${blk.id}`}
                            className="absolute rounded-md z-[2] flex items-center justify-center cursor-pointer border border-black/10"
                            style={{ left, width, top: sz.barTop, height: sz.barHeight, backgroundColor: colors.BLOKADA, opacity: 0.7 }}
                            onMouseDown={(e) => e.stopPropagation()}
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

                      {(() => {
                        const subleaseSegments: { sub: Sublease; segStart: string; segEnd: string; segKey: string }[] = [];
                        for (const sub of subleases) {
                          const baseIds = sub.apartmentIds || (sub.apartmentId ? [sub.apartmentId] : []);
                          const changes = allAptChanges.filter(ch => ch.subleaseId === sub.id);
                          if (changes.length === 0) {
                            if (baseIds.includes(apt.id)) {
                              subleaseSegments.push({ sub, segStart: sub.startDate, segEnd: sub.endDate, segKey: `sub-${sub.id}` });
                            }
                            continue;
                          }
                          const sortedChanges = [...changes].sort((a, b) => {
                            const diff = new Date(a.changeDate).getTime() - new Date(b.changeDate).getTime();
                            return diff !== 0 ? diff : a.id - b.id;
                          });
                          const changeDates = [...new Set(sortedChanges.map(c => c.changeDate))].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                          const timelinePoints = [sub.startDate, ...changeDates.filter(d => d > sub.startDate && d < sub.endDate), sub.endDate];
                          const subtractDay = (dateStr: string) => {
                            const d = new Date(dateStr);
                            d.setDate(d.getDate() - 1);
                            return d.toISOString().slice(0, 10);
                          };
                          for (let i = 0; i < timelinePoints.length - 1; i++) {
                            const segStart = timelinePoints[i];
                            const isLastSegment = i === timelinePoints.length - 2;
                            const segEnd = isLastSegment ? timelinePoints[i + 1] : subtractDay(timelinePoints[i + 1]);
                            if (new Date(segStart).getTime() > new Date(segEnd).getTime()) continue;
                            const activeApts = new Set(baseIds);
                            for (const ch of sortedChanges) {
                              if (new Date(ch.changeDate).getTime() <= new Date(segStart).getTime()) {
                                activeApts.delete(ch.oldApartmentId);
                                activeApts.add(ch.newApartmentId);
                              }
                            }
                            if (activeApts.has(apt.id)) {
                              subleaseSegments.push({ sub, segStart, segEnd, segKey: `sub-${sub.id}-seg-${i}` });
                            }
                          }
                        }
                        return subleaseSegments.map(({ sub, segStart, segEnd, segKey }) => {
                          const subStart = new Date(segStart);
                          const subEnd = new Date(segEnd);
                          const startIdx = days.findIndex(d => isSameDay(d, subStart));
                          const endIdx = days.findIndex(d => isSameDay(d, subEnd));
                          const effectiveStart = startIdx >= 0 ? startIdx : (subStart < rangeStart ? 0 : -1);
                          const effectiveEnd = endIdx >= 0 ? endIdx : (subEnd > rangeEnd ? days.length - 1 : -1);
                          if (effectiveStart < 0 || effectiveEnd < 0 || effectiveStart > effectiveEnd) return null;
                          const halfDay = sz.dayWidth / 2;
                          const startsInRange = startIdx >= 0;
                          const endsInRange = endIdx >= 0;
                          const left = effectiveStart * sz.dayWidth + (startsInRange ? halfDay : 0);
                          const rightEdge = effectiveEnd * sz.dayWidth + (endsInRange ? halfDay : sz.dayWidth);
                          const width = Math.max(rightEdge - left, halfDay);
                          const tenantName = sub.tenantType === 'firma' ? (sub.companyName || 'Podnajem') : [sub.firstName, sub.lastName].filter(Boolean).join(' ') || 'Podnajem';
                          return (
                            <div
                              key={segKey}
                              className="absolute rounded-md z-[2] flex items-center justify-center cursor-pointer border border-black/10"
                              style={{ left, width, top: sz.barTop, height: sz.barHeight, backgroundColor: colors.PODNAJEM, opacity: 0.85 }}
                              onMouseDown={(e) => e.stopPropagation()}
                              title={`Podnajem: ${tenantName} (${segStart} - ${segEnd})`}
                              data-testid={`sublease-bar-${sub.id}`}
                            >
                              {width > (compact ? 40 : 60) && (
                                <span className="text-white font-medium truncate px-1" style={{ fontSize: sz.barFontSize }}>
                                  {tenantName}
                                </span>
                              )}
                            </div>
                          );
                        });
                      })()}

                      {aptReservations.map((res) => {
                        const resStart = new Date(res.startDate);
                        const resEnd = new Date(res.endDate);
                        const startIdx = days.findIndex(d => isSameDay(d, resStart));
                        const endIdx = days.findIndex(d => isSameDay(d, resEnd));

                        const effectiveStart = startIdx >= 0 ? startIdx : (resStart < rangeStart ? 0 : -1);
                        const effectiveEnd = endIdx >= 0 ? endIdx : (resEnd > rangeEnd ? days.length - 1 : -1);

                        if (effectiveStart < 0 || effectiveEnd < 0 || effectiveStart > effectiveEnd) return null;

                        const halfDay = sz.dayWidth / 2;
                        const startsInRange = startIdx >= 0;
                        const endsInRange = endIdx >= 0;
                        const left = effectiveStart * sz.dayWidth + (startsInRange ? halfDay : 0);
                        const rightEdge = effectiveEnd * sz.dayWidth + (endsInRange ? halfDay : sz.dayWidth);
                        const width = Math.max(rightEdge - left, halfDay);
                        const barColor = getColorForStatus(res.status || "PRZYJETA", colors);
                        const isGroupRes = res.apartmentIds && res.apartmentIds.length > 1;

                        return (
                          <div
                            key={`res-${res.id}`}
                            className="absolute rounded-md z-[3] flex items-center shadow-sm border border-black/10"
                            style={{
                              left, width, top: sz.barTop, height: sz.barHeight, backgroundColor: barColor,
                              cursor: isGroupRes ? "pointer" : "grab",
                              opacity: isDraggingRes && dragDataRef.current?.reservationId === res.id ? 0.4 : 1,
                            }}
                            draggable={!isGroupRes}
                            onDragStart={(e) => {
                              if (isGroupRes) { e.preventDefault(); return; }
                              handleDragStart(e, res, apt.id);
                            }}
                            onDragEnd={handleDragEnd}
                            onMouseDown={(e) => e.stopPropagation()}
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
                            {isGroupRes && (
                              <span className="bg-white/30 text-white font-bold rounded-sm px-0.5 ml-0.5 flex-shrink-0" style={{ fontSize: compact ? "7px" : "8px", lineHeight: "1.2" }}>
                                {res.apartmentIds!.length}
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
                          className="absolute top-0 bottom-0 z-[4] border-l-2 border-dashed border-black/20 dark:border-white/20"
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
            <div className="w-3 h-3 rounded-md" style={{ backgroundColor: colors.PODNAJEM, opacity: 0.85 }} />
            <span>Podnajem</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-[2px] h-3 border-l-2 border-dashed border-black/20 dark:border-white/20" />
            <span>Dzisiaj</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground/70" data-testid="text-drag-hint">
            <span>Przeciągnij rezerwację aby zmienić termin lub apartament</span>
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
      </>
      )}

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
        onClose={() => { setShowNewReservation(false); setResPrefill(undefined); }}
        apartments={filteredApartments}
        prefill={resPrefill}
      />
      <NewBlockadeDialog
        open={showNewBlockade}
        onClose={() => { setShowNewBlockade(false); setBlkPrefill(undefined); }}
        apartments={filteredApartments}
        prefill={blkPrefill}
      />

      <ColorSettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        colors={colors}
        onChange={(newColors) => {
          setColors(newColors);
          dbSaveTerminarzColors(newColors);
        }}
      />

      {showSelectionMenu && (
        <Dialog open={!!showSelectionMenu} onOpenChange={(o) => { if (!o) { setShowSelectionMenu(null); setDragSelection(null); } }}>
          <DialogContent className="max-w-xs">
            <DialogHeader>
              <DialogTitle>Zaznaczony zakres dat</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="text-sm text-muted-foreground">
                <p><span className="font-medium text-foreground">Apartament:</span> {apartments?.find(a => a.id === showSelectionMenu.aptId)?.name || `#${showSelectionMenu.aptId}`}</p>
                <p><span className="font-medium text-foreground">Od:</span> {showSelectionMenu.startDate}</p>
                <p><span className="font-medium text-foreground">Do:</span> {showSelectionMenu.endDate}</p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    const sel = showSelectionMenu;
                    setResPrefill({ aptId: sel.aptId, startDate: sel.startDate, endDate: sel.endDate });
                    setShowSelectionMenu(null);
                    setDragSelection(null);
                    setShowNewReservation(true);
                  }}
                  data-testid="button-selection-add-reservation"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Dodaj rezerwację
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const sel = showSelectionMenu;
                    setBlkPrefill({ aptId: sel.aptId, startDate: sel.startDate, endDate: sel.endDate });
                    setShowSelectionMenu(null);
                    setDragSelection(null);
                    setShowNewBlockade(true);
                  }}
                  data-testid="button-selection-add-blockade"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Dodaj blokadę
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setShowSelectionMenu(null); setDragSelection(null); }}
                  data-testid="button-selection-cancel"
                >
                  Anuluj
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

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

interface AgendaItem {
  type: "reservation" | "blockade" | "sublease";
  id: number;
  aptName: string;
  aptId: number;
  startDate: string;
  endDate: string;
  label: string;
  color: string;
  status?: string;
  reservation?: Reservation;
  blockade?: any;
  sublease?: Sublease;
}

function MobileAgendaView({
  days,
  reservations,
  blockades,
  subleases,
  allAptChanges,
  filteredApartments,
  colors,
  onAddReservation,
  onAddBlockade,
}: {
  days: Date[];
  reservations: Reservation[];
  blockades: any[];
  subleases: Sublease[];
  allAptChanges: SubleaseApartmentChange[];
  filteredApartments: Apartment[];
  colors: TerminarzColors;
  onAddReservation: () => void;
  onAddBlockade: () => void;
}) {
  const [selectedItem, setSelectedItem] = useState<AgendaItem | null>(null);

  const agendaByDay = useMemo(() => {
    const aptMap = new Map(filteredApartments.map(a => [a.id, a]));
    const aptIds = new Set(filteredApartments.map(a => a.id));
    const result: { date: Date; dateStr: string; items: AgendaItem[] }[] = [];

    for (const day of days) {
      const dateStr = formatDate(day);
      const items: AgendaItem[] = [];

      for (const res of reservations) {
        if (res.status === "ANULOWANA") continue;
        const resAptIds = res.apartmentIds && res.apartmentIds.length > 0
          ? res.apartmentIds
          : res.apartmentId ? [res.apartmentId] : [];
        const matchingApts = resAptIds.filter(id => aptIds.has(id));
        if (matchingApts.length === 0) continue;

        if (dateStr >= res.startDate && dateStr <= res.endDate) {
          const aptName = matchingApts.map(id => aptMap.get(id)?.name || `#${id}`).join(", ");
          if (!items.find(i => i.type === "reservation" && i.id === res.id)) {
            items.push({
              type: "reservation",
              id: res.id,
              aptName,
              aptId: matchingApts[0],
              startDate: res.startDate,
              endDate: res.endDate,
              label: res.guestName || "Rezerwacja",
              color: getColorForStatus(res.status || "PRZYJETA", colors),
              status: res.status || undefined,
              reservation: res,
            });
          }
        }
      }

      for (const blk of blockades) {
        if (!aptIds.has(blk.apartmentId)) continue;
        if (dateStr >= blk.startDate && dateStr <= blk.endDate) {
          items.push({
            type: "blockade",
            id: blk.id,
            aptName: aptMap.get(blk.apartmentId)?.name || `#${blk.apartmentId}`,
            aptId: blk.apartmentId,
            startDate: blk.startDate,
            endDate: blk.endDate,
            label: blk.reason || "Blokada",
            color: colors.BLOKADA,
            blockade: blk,
          });
        }
      }

      for (const sub of subleases) {
        const baseIds = sub.apartmentIds || (sub.apartmentId ? [sub.apartmentId] : []);
        const changes = allAptChanges.filter(ch => ch.subleaseId === sub.id);
        let activeApts = new Set(baseIds);

        if (changes.length > 0) {
          const sortedChanges = [...changes].sort((a, b) => new Date(a.changeDate).getTime() - new Date(b.changeDate).getTime());
          for (const ch of sortedChanges) {
            if (new Date(ch.changeDate).getTime() <= new Date(dateStr).getTime()) {
              activeApts.delete(ch.oldApartmentId);
              activeApts.add(ch.newApartmentId);
            }
          }
        }

        const matchingApts = [...activeApts].filter(id => aptIds.has(id));
        if (matchingApts.length === 0) continue;

        if (dateStr >= sub.startDate && dateStr <= sub.endDate) {
          const tenantName = sub.tenantType === 'firma'
            ? (sub.companyName || 'Podnajem')
            : [sub.firstName, sub.lastName].filter(Boolean).join(' ') || 'Podnajem';
          const aptName = matchingApts.map(id => aptMap.get(id)?.name || `#${id}`).join(", ");
          if (!items.find(i => i.type === "sublease" && i.id === sub.id)) {
            items.push({
              type: "sublease",
              id: sub.id,
              aptName,
              aptId: matchingApts[0],
              startDate: sub.startDate,
              endDate: sub.endDate,
              label: tenantName,
              color: colors.PODNAJEM,
              sublease: sub,
            });
          }
        }
      }

      if (items.length > 0) {
        result.push({ date: day, dateStr, items });
      }
    }

    return result;
  }, [days, reservations, blockades, subleases, allAptChanges, filteredApartments, colors]);

  const today = formatDate(new Date());

  return (
    <>
      <div className="space-y-3" data-testid="mobile-agenda-view">
        {agendaByDay.length === 0 && (
          <div className="text-center py-12 text-muted-foreground" data-testid="agenda-empty">
            Brak wydarzeń w wybranym okresie
          </div>
        )}
        {agendaByDay.map(({ date, dateStr, items }) => {
          const isToday = dateStr === today;
          const dow = date.getDay();
          return (
            <div key={dateStr} data-testid={`agenda-day-${dateStr}`}>
              <div className={`flex items-center gap-2 px-1 py-1.5 sticky top-0 z-10 bg-background ${isToday ? "border-b-2 border-primary" : "border-b border-border"}`}>
                <div className={`flex items-center justify-center rounded-md w-10 h-10 text-sm font-bold ${isToday ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {date.getDate()}
                </div>
                <div>
                  <div className={`text-sm font-semibold ${isToday ? "text-primary" : ""}`}>
                    {DAY_NAMES_PL[dow]}
                    {isToday && <span className="ml-1.5 text-xs font-normal text-primary">dzisiaj</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {MONTH_NAMES_PL[date.getMonth()]} {date.getFullYear()}
                  </div>
                </div>
                <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
              </div>
              <div className="space-y-1.5 pt-1.5">
                {items.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center gap-3 rounded-md p-3 bg-card border border-border hover-elevate cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                    data-testid={`agenda-item-${item.type}-${item.id}`}
                  >
                    <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm truncate">{item.label}</span>
                        <Badge
                          variant="secondary"
                          className="text-xs text-white flex-shrink-0"
                          style={{ backgroundColor: item.color }}
                        >
                          {item.type === "reservation" ? (item.status || "PRZYJETA") : item.type === "blockade" ? "BLOKADA" : "PODNAJEM"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{item.aptName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>{item.startDate} — {item.endDate}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={!!selectedItem} onOpenChange={(o) => { if (!o) setSelectedItem(null); }}>
        <SheetContent side="bottom" className="h-[85vh] overflow-auto rounded-t-lg">
          {selectedItem && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedItem.color }} />
                  {selectedItem.type === "reservation" ? "Rezerwacja" : selectedItem.type === "blockade" ? "Blokada" : "Podnajem"}
                </SheetTitle>
              </SheetHeader>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">
                        {selectedItem.type === "reservation" ? "Gość" : selectedItem.type === "sublease" ? "Najemca" : "Opis"}
                      </div>
                      <div className="font-semibold">{selectedItem.label}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Apartament</div>
                      <div className="font-semibold">{selectedItem.aptName}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <div className="text-xs text-muted-foreground">Okres</div>
                      <div className="font-semibold">{selectedItem.startDate} — {selectedItem.endDate}</div>
                      <div className="text-xs text-muted-foreground">
                        {Math.ceil((new Date(selectedItem.endDate).getTime() - new Date(selectedItem.startDate).getTime()) / (1000 * 60 * 60 * 24))} dni
                      </div>
                    </div>
                  </div>
                </div>

                {selectedItem.reservation && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="flex items-center gap-3">
                      <CreditCard className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div className="text-xs text-muted-foreground">Numer rezerwacji</div>
                        <div className="font-semibold">{selectedItem.reservation.reservationNumber}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Kwota</div>
                        <div className="font-semibold">{Number(selectedItem.reservation.price || 0).toFixed(2)} PLN</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Zaliczka</div>
                        <div className="font-semibold">{Number(selectedItem.reservation.prepayment || 0).toFixed(2)} PLN</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Wpłacono</div>
                        <div className="font-semibold">{Number(selectedItem.reservation.paidAmount || 0).toFixed(2)} PLN</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Status</div>
                        <Badge
                          className="text-white mt-0.5"
                          style={{ backgroundColor: selectedItem.color }}
                        >
                          {selectedItem.reservation.status}
                        </Badge>
                      </div>
                    </div>
                    {selectedItem.reservation.source && (
                      <div>
                        <div className="text-xs text-muted-foreground">Źródło</div>
                        <div className="font-semibold">{selectedItem.reservation.source}</div>
                      </div>
                    )}
                    {selectedItem.reservation.notes && (
                      <div>
                        <div className="text-xs text-muted-foreground">Uwagi</div>
                        <div className="text-sm">{selectedItem.reservation.notes}</div>
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.blockade && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    {selectedItem.blockade.reason && (
                      <div>
                        <div className="text-xs text-muted-foreground">Powód</div>
                        <div className="font-semibold">{selectedItem.blockade.reason}</div>
                      </div>
                    )}
                  </div>
                )}

                {selectedItem.sublease && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-muted-foreground">Czynsz</div>
                        <div className="font-semibold">{Number(selectedItem.sublease.rentAmount || 0).toFixed(2)} PLN</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Typ najemcy</div>
                        <div className="font-semibold">{selectedItem.sublease.tenantType === 'firma' ? 'Firma' : 'Osoba'}</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button variant="ghost" className="flex-1" onClick={() => setSelectedItem(null)} data-testid="button-close-agenda-detail">
                    Zamknij
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function NewReservationDialog({ open, onClose, apartments, prefill }: { open: boolean; onClose: () => void; apartments: Apartment[]; prefill?: { aptId?: number; startDate?: string; endDate?: string } }) {
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

  useEffect(() => {
    if (open && prefill) {
      if (prefill.aptId) form.setValue("apartmentId", prefill.aptId);
      if (prefill.startDate) form.setValue("startDate", prefill.startDate);
      if (prefill.endDate) form.setValue("endDate", prefill.endDate);
    }
  }, [open, prefill]);

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

function NewBlockadeDialog({ open, onClose, apartments, prefill }: { open: boolean; onClose: () => void; apartments: Apartment[]; prefill?: { aptId?: number; startDate?: string; endDate?: string } }) {
  const createBlockade = useCreateBlockade();
  const [apartmentId, setApartmentId] = useState("");
  const [blkStartDate, setBlkStartDate] = useState("");
  const [blkEndDate, setBlkEndDate] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open && prefill) {
      if (prefill.aptId) setApartmentId(prefill.aptId.toString());
      if (prefill.startDate) setBlkStartDate(prefill.startDate);
      if (prefill.endDate) setBlkEndDate(prefill.endDate);
    }
  }, [open, prefill]);

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
    { key: "PODNAJEM", label: "Podnajem" },
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
