import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Location, WorkSchedule } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2 } from "lucide-react";

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];

const DAY_NAMES_SHORT = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];

const SHIFT_PRESETS = [
  { label: "Ranna", start: "06:00", end: "14:00", color: "#22c55e" },
  { label: "Dzienna", start: "08:00", end: "16:00", color: "#3b82f6" },
  { label: "Popołudniowa", start: "14:00", end: "22:00", color: "#f59e0b" },
  { label: "Nocna", start: "22:00", end: "06:00", color: "#8b5cf6" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, "0");
  const m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

function calcShiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return Math.round(diff / 6) / 10;
}

export default function GrafikTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [locationFilter, setLocationFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [formEmpId, setFormEmpId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formLocId, setFormLocId] = useState("");
  const [formStart, setFormStart] = useState("08:00");
  const [formEnd, setFormEnd] = useState("16:00");
  const [formShiftName, setFormShiftName] = useState("");
  const [formColor, setFormColor] = useState("#3b82f6");
  const { toast } = useToast();

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });
  const { data: locations = [] } = useQuery<Location[]>({ queryKey: ["/api/locations"] });
  const qk = `/api/work-schedules?from=${firstDay}&to=${lastDayStr}`;
  const { data: schedules = [], isLoading } = useQuery<WorkSchedule[]>({ queryKey: [qk] });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/work-schedules", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [qk] });
      toast({ title: "Zmiana dodana" });
      setDialogOpen(false);
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      await apiRequest("PUT", `/api/work-schedules/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [qk] });
      toast({ title: "Zmiana zaktualizowana" });
      setDialogOpen(false);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/work-schedules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [qk] });
      toast({ title: "Zmiana usunięta" });
    },
  });

  const activeEmployees = useMemo(() => {
    return employees.filter((e: any) => e.pin);
  }, [employees]);

  const filteredSchedules = useMemo(() => {
    if (locationFilter === "all") return schedules;
    return schedules.filter(s => String(s.locationId) === locationFilter);
  }, [schedules, locationFilter]);

  const scheduleMap = useMemo(() => {
    const map: Record<string, WorkSchedule[]> = {};
    for (const s of filteredSchedules) {
      const key = `${s.employeeId}-${s.date}`;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return map;
  }, [filteredSchedules]);

  const empHours = useMemo(() => {
    const map: Record<number, number> = {};
    for (const s of filteredSchedules) {
      const h = calcShiftHours(s.startTime, s.endTime);
      map[s.employeeId] = (map[s.employeeId] || 0) + h;
    }
    return map;
  }, [filteredSchedules]);

  const daysInMonth = Array.from({ length: lastDay }, (_, i) => {
    const d = i + 1;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayObj = new Date(dateStr + "T12:00:00");
    const dow = dayObj.getDay();
    return { day: d, dateStr, dow, isWeekend: dow === 0 || dow === 6 };
  });

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function openAdd(empId: number, dateStr: string) {
    setEditingSchedule(null);
    setFormEmpId(String(empId));
    setFormDate(dateStr);
    setFormLocId("");
    setFormStart("08:00");
    setFormEnd("16:00");
    setFormShiftName("");
    setFormColor("#3b82f6");
    setDialogOpen(true);
  }

  function openEdit(schedule: WorkSchedule) {
    setEditingSchedule(schedule);
    setFormEmpId(String(schedule.employeeId));
    setFormDate(schedule.date);
    setFormLocId(schedule.locationId ? String(schedule.locationId) : "");
    setFormStart(schedule.startTime);
    setFormEnd(schedule.endTime);
    setFormShiftName(schedule.shiftName || "");
    setFormColor(schedule.shiftColor || "#3b82f6");
    setDialogOpen(true);
  }

  function handleSave() {
    const data = {
      employeeId: Number(formEmpId),
      date: formDate,
      locationId: formLocId ? Number(formLocId) : null,
      startTime: formStart,
      endTime: formEnd,
      shiftName: formShiftName || null,
      shiftColor: formColor,
    };
    if (editingSchedule) {
      updateMut.mutate({ id: editingSchedule.id, data });
    } else {
      createMut.mutate(data);
    }
  }

  function applyPreset(preset: typeof SHIFT_PRESETS[0]) {
    setFormStart(preset.start);
    setFormEnd(preset.end);
    setFormShiftName(preset.label);
    setFormColor(preset.color);
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth} data-testid="button-prev-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[180px] text-center" data-testid="text-current-month">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth} data-testid="button-next-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-location-filter">
            <SelectValue placeholder="Wszystkie lokalizacje" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie lokalizacje</SelectItem>
            {locations.map((loc: Location) => (
              <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-2 py-2 text-left font-medium min-w-[140px]">Pracownik</th>
              {daysInMonth.map(d => (
                <th
                  key={d.day}
                  className={`px-1 py-2 text-center font-medium min-w-[52px] ${d.isWeekend ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                >
                  <div>{d.day}</div>
                  <div className="text-[10px] text-muted-foreground">{DAY_NAMES_SHORT[d.dow]}</div>
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium min-w-[60px]">Σ godz.</th>
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map((emp: Employee) => (
              <tr key={emp.id} className="border-t hover:bg-muted/30">
                <td className="sticky left-0 z-10 bg-background px-2 py-1 font-medium whitespace-nowrap">
                  {emp.firstName} {emp.lastName}
                </td>
                {daysInMonth.map(d => {
                  const key = `${emp.id}-${d.dateStr}`;
                  const cellSchedules = scheduleMap[key] || [];
                  return (
                    <td
                      key={d.day}
                      className={`px-0.5 py-0.5 text-center cursor-pointer ${d.isWeekend ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}
                      onClick={() => cellSchedules.length === 0 && openAdd(emp.id, d.dateStr)}
                      data-testid={`cell-schedule-${emp.id}-${d.day}`}
                    >
                      {cellSchedules.map(s => (
                        <TooltipProvider key={s.id}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="block w-full rounded px-0.5 py-0.5 text-white text-[10px] leading-tight mb-0.5 truncate"
                                style={{ backgroundColor: s.shiftColor || "#3b82f6" }}
                                onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                                data-testid={`shift-${s.id}`}
                              >
                                {s.startTime}-{s.endTime}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{s.shiftName || "Zmiana"}: {s.startTime}–{s.endTime}</p>
                              <p>{calcShiftHours(s.startTime, s.endTime)}h</p>
                              {s.locationId && <p>{locations.find((l: Location) => l.id === s.locationId)?.name}</p>}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ))}
                      {cellSchedules.length === 0 && (
                        <span className="text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">+</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1 text-center font-medium">
                  {(empHours[emp.id] || 0).toFixed(1)}
                </td>
              </tr>
            ))}
            {activeEmployees.length === 0 && (
              <tr>
                <td colSpan={lastDay + 2} className="text-center py-8 text-muted-foreground">
                  Brak pracowników z przypisanym PIN-em
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle data-testid="dialog-title-schedule">
              {editingSchedule ? "Edytuj zmianę" : "Dodaj zmianę"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {SHIFT_PRESETS.map(p => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  onClick={() => applyPreset(p)}
                  className="text-xs"
                  data-testid={`preset-${p.label.toLowerCase()}`}
                >
                  <span className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ backgroundColor: p.color }} />
                  {p.label} ({p.start}-{p.end})
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Godzina rozpoczęcia</Label>
                <Select value={formStart} onValueChange={setFormStart}>
                  <SelectTrigger data-testid="select-start-time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Godzina zakończenia</Label>
                <Select value={formEnd} onValueChange={setFormEnd}>
                  <SelectTrigger data-testid="select-end-time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Lokalizacja</Label>
              <Select value={formLocId} onValueChange={setFormLocId}>
                <SelectTrigger data-testid="select-shift-location">
                  <SelectValue placeholder="Brak" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak</SelectItem>
                  {locations.map((loc: Location) => (
                    <SelectItem key={loc.id} value={String(loc.id)}>{loc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nazwa zmiany</Label>
                <Input
                  value={formShiftName}
                  onChange={e => setFormShiftName(e.target.value)}
                  placeholder="np. Ranna"
                  data-testid="input-shift-name"
                />
              </div>
              <div>
                <Label>Kolor</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={formColor}
                    onChange={e => setFormColor(e.target.value)}
                    className="h-9 w-12 rounded border cursor-pointer"
                    data-testid="input-shift-color"
                  />
                  <span className="text-sm text-muted-foreground">{formColor}</span>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              Czas trwania: <strong>{calcShiftHours(formStart, formEnd)}h</strong>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingSchedule && (
              <Button
                variant="destructive"
                onClick={() => {
                  deleteMut.mutate(editingSchedule.id);
                  setDialogOpen(false);
                }}
                disabled={deleteMut.isPending}
                data-testid="button-delete-shift"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Usuń
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-shift">
              Anuluj
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMut.isPending || updateMut.isPending || !formEmpId}
              data-testid="button-save-shift"
            >
              {editingSchedule ? "Zapisz" : "Dodaj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
