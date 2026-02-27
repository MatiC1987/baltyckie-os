import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Employee, Location, WorkSchedule } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  FileDown,
  Copy,
  CalendarDays,
  CalendarRange,
  Users,
  AlertTriangle,
  LayoutTemplate,
  GripHorizontal,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const MONTH_NAMES = [
  "Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec",
  "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień",
];
const DAY_NAMES_SHORT = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "So"];
const DAY_NAMES_FULL = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];

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

const MONTHLY_NORM_HOURS = 168;

function calcShiftHours(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) diff += 24 * 60;
  return Math.round(diff / 6) / 10;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function removeDiacritics(str: string): string {
  const map: Record<string, string> = {
    ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z",
    Ą: "A", Ć: "C", Ę: "E", Ł: "L", Ń: "N", Ó: "O", Ś: "S", Ź: "Z", Ż: "Z",
  };
  return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, ch => map[ch] || ch);
}

interface GrafikEnhancedProps {
  apiPrefix: string;
  fetchFn?: (method: string, url: string, body?: any) => Promise<Response>;
}

type ViewMode = "month" | "week";

interface WeeklyTemplate {
  name: string;
  days: Record<number, { start: string; end: string; shiftName: string; color: string } | null>;
}

export default function GrafikEnhanced({ apiPrefix, fetchFn }: GrafikEnhancedProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [locationFilter, setLocationFilter] = useState("all");
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [formEmpId, setFormEmpId] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formLocId, setFormLocId] = useState("");
  const [formStart, setFormStart] = useState("08:00");
  const [formEnd, setFormEnd] = useState("16:00");
  const [formShiftName, setFormShiftName] = useState("");
  const [formColor, setFormColor] = useState("#3b82f6");

  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [conflictWarnings, setConflictWarnings] = useState<string[]>([]);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const pendingSaveRef = useRef<(() => void) | null>(null);

  const [templateEmpId, setTemplateEmpId] = useState("");
  const [templateDays, setTemplateDays] = useState<Record<number, { start: string; end: string; name: string; color: string } | null>>({});

  const [bulkSelectedEmps, setBulkSelectedEmps] = useState<Set<number>>(new Set());
  const [bulkSelectedDays, setBulkSelectedDays] = useState<Set<string>>(new Set());
  const [bulkShiftStart, setBulkShiftStart] = useState("08:00");
  const [bulkShiftEnd, setBulkShiftEnd] = useState("16:00");
  const [bulkShiftName, setBulkShiftName] = useState("");
  const [bulkShiftColor, setBulkShiftColor] = useState("#3b82f6");

  const [dragData, setDragData] = useState<{ schedule: WorkSchedule } | null>(null);

  const { toast } = useToast();

  const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const scheduleQueryKey = [`${apiPrefix}/work-schedules`, year, month];

  const doFetch = useCallback(async (method: string, url: string, body?: any) => {
    if (fetchFn) return fetchFn(method, url, body);
    if (body && method !== "GET" && method !== "DELETE") {
      return apiRequest(method as any, url, body).then(r => r);
    }
    if (method === "DELETE") {
      return apiRequest("DELETE", url);
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    return res;
  }, [fetchFn]);

  const employeesUrl = fetchFn ? `${apiPrefix}/employees` : "/api/employees";
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: [employeesUrl],
    queryFn: async () => {
      const r = fetchFn
        ? await fetchFn("GET", employeesUrl)
        : await fetch(employeesUrl);
      return r.json();
    },
  });

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: [`${apiPrefix}/locations`],
    queryFn: async () => {
      const url = fetchFn ? `${apiPrefix}/locations` : "/api/locations";
      const r = fetchFn ? await fetchFn("GET", url) : await fetch(url);
      return r.json();
    },
  });

  const { data: schedules = [], isLoading } = useQuery<WorkSchedule[]>({
    queryKey: scheduleQueryKey,
    queryFn: async () => {
      const url = `${apiPrefix}/work-schedules?from=${firstDay}&to=${lastDayStr}`;
      const r = fetchFn ? await fetchFn("GET", url) : await fetch(url);
      return r.json();
    },
  });

  const createMut = useMutation({
    mutationFn: async (data: any) => {
      if (fetchFn) { await fetchFn("POST", `${apiPrefix}/work-schedules`, data); }
      else { await apiRequest("POST", `${apiPrefix}/work-schedules`, data); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
      toast({ title: "Zmiana dodana" });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      if (fetchFn) { await fetchFn("PUT", `${apiPrefix}/work-schedules/${id}`, data); }
      else { await apiRequest("PUT", `${apiPrefix}/work-schedules/${id}`, data); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
      toast({ title: "Zmiana zaktualizowana" });
      setDialogOpen(false);
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      if (fetchFn) { await fetchFn("DELETE", `${apiPrefix}/work-schedules/${id}`); }
      else { await apiRequest("DELETE", `${apiPrefix}/work-schedules/${id}`); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
      toast({ title: "Zmiana usunięta" });
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const bulkMut = useMutation({
    mutationFn: async (payload: any) => {
      if (fetchFn) { await fetchFn("POST", `${apiPrefix}/work-schedules/bulk`, payload); }
      else { await apiRequest("POST", `${apiPrefix}/work-schedules/bulk`, payload); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scheduleQueryKey });
    },
    onError: (e: Error) => toast({ title: "Błąd", description: e.message, variant: "destructive" }),
  });

  const activeEmployees = useMemo(() => employees.filter((e: any) => e.pin), [employees]);

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

  const daysInMonth = useMemo(() =>
    Array.from({ length: lastDay }, (_, i) => {
      const d = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dayObj = new Date(dateStr + "T12:00:00");
      const dow = dayObj.getDay();
      return { day: d, dateStr, dow, isWeekend: dow === 0 || dow === 6 };
    }), [year, month, lastDay]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dow = d.getDay();
      return { day: d.getDate(), dateStr, dow, isWeekend: dow === 0 || dow === 6, date: d };
    });
  }, [weekStart]);

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }
  function prevWeek() {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() - 7); return d; });
  }
  function nextWeek() {
    setWeekStart(prev => { const d = new Date(prev); d.setDate(d.getDate() + 7); return d; });
  }

  function validateConflicts(empId: number, date: string, start: string, end: string, excludeId?: number): string[] {
    const warnings: string[] = [];
    const key = `${empId}-${date}`;
    const existing = (scheduleMap[key] || []).filter(s => excludeId ? s.id !== excludeId : true);

    const newStart = timeToMinutes(start);
    let newEnd = timeToMinutes(end);
    const isNewOvernight = newEnd <= newStart;
    if (isNewOvernight) newEnd += 24 * 60;

    for (const s of existing) {
      const sStart = timeToMinutes(s.startTime);
      let sEnd = timeToMinutes(s.endTime);
      if (sEnd <= sStart) sEnd += 24 * 60;
      if (newStart < sEnd && newEnd > sStart) {
        warnings.push(`Nakładanie zmian: ${s.startTime}-${s.endTime} z ${start}-${end}`);
      }
    }

    const dateObj = new Date(date + "T12:00:00");
    const prevDateObj = new Date(dateObj);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, "0")}-${String(prevDateObj.getDate()).padStart(2, "0")}`;
    const prevKey = `${empId}-${prevDateStr}`;
    const prevShifts = scheduleMap[prevKey] || [];

    for (const ps of prevShifts) {
      const psStart = timeToMinutes(ps.startTime);
      let psEnd = timeToMinutes(ps.endTime);
      const isPrevOvernight = psEnd <= psStart;
      if (isPrevOvernight) psEnd += 24 * 60;
      const restMinutes = isPrevOvernight
        ? newStart + (24 * 60 - psEnd)
        : (24 * 60 - psEnd) + newStart;
      const restHours = restMinutes / 60;
      if (restHours < 11) {
        warnings.push(`Brak 11h odpoczynku po zmianie ${ps.startTime}-${ps.endTime} z dnia poprzedniego (${Math.round(restHours * 10) / 10}h)`);
      }
    }

    return warnings;
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

    const warnings = validateConflicts(data.employeeId, data.date, data.startTime, data.endTime, editingSchedule?.id);

    const doSave = () => {
      if (editingSchedule) {
        updateMut.mutate({ id: editingSchedule.id, data });
      } else {
        createMut.mutate(data);
      }
    };

    if (warnings.length > 0) {
      setConflictWarnings(warnings);
      pendingSaveRef.current = doSave;
      setConflictDialogOpen(true);
    } else {
      doSave();
    }
  }

  function applyPreset(preset: typeof SHIFT_PRESETS[0]) {
    setFormStart(preset.start);
    setFormEnd(preset.end);
    setFormShiftName(preset.label);
    setFormColor(preset.color);
  }

  function handleDragStart(e: React.DragEvent, schedule: WorkSchedule) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(schedule.id));
    setDragData({ schedule });
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function handleDrop(e: React.DragEvent, empId: number, dateStr: string) {
    e.preventDefault();
    if (!dragData) return;
    const { schedule } = dragData;
    if (schedule.employeeId === empId && schedule.date === dateStr) {
      setDragData(null);
      return;
    }
    const data = {
      employeeId: empId,
      date: dateStr,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      locationId: schedule.locationId,
      shiftName: schedule.shiftName,
      shiftColor: schedule.shiftColor,
    };

    const warnings = validateConflicts(empId, dateStr, schedule.startTime, schedule.endTime, schedule.id);
    const doMove = () => { updateMut.mutate({ id: schedule.id, data }); };

    if (warnings.length > 0) {
      setConflictWarnings(warnings);
      pendingSaveRef.current = doMove;
      setConflictDialogOpen(true);
    } else {
      doMove();
    }
    setDragData(null);
  }

  function handleCopyFromPrev() {
    const prevM = month === 1 ? 12 : month - 1;
    const prevY = month === 1 ? year - 1 : year;
    const prevFirst = `${prevY}-${String(prevM).padStart(2, "0")}-01`;
    const prevLast = new Date(prevY, prevM, 0).getDate();
    const prevLastStr = `${prevY}-${String(prevM).padStart(2, "0")}-${String(prevLast).padStart(2, "0")}`;

    const fetchPrevSchedules = async () => {
      const url = `${apiPrefix}/work-schedules?from=${prevFirst}&to=${prevLastStr}`;
      const r = fetchFn ? await fetchFn("GET", url) : await fetch(url);
      return r.json() as Promise<WorkSchedule[]>;
    };

    fetchPrevSchedules().then(prevSchedules => {
      if (prevSchedules.length === 0) {
        toast({ title: "Brak zmian w poprzednim miesiącu", variant: "destructive" });
        setCopyDialogOpen(false);
        return;
      }
      const newSchedules = prevSchedules.map(s => {
        const oldDate = new Date(s.date + "T12:00:00");
        const newDate = new Date(year, month - 1, oldDate.getDate());
        if (newDate.getMonth() !== month - 1) return null;
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
        return {
          employeeId: s.employeeId,
          date: dateStr,
          startTime: s.startTime,
          endTime: s.endTime,
          locationId: s.locationId,
          shiftName: s.shiftName,
          shiftColor: s.shiftColor,
        };
      }).filter(Boolean);

      bulkMut.mutate({
        schedules: newSchedules,
        deleteFrom: firstDay,
        deleteTo: lastDayStr,
      }, {
        onSuccess: () => {
          toast({ title: "Grafik skopiowany z poprzedniego miesiąca" });
          setCopyDialogOpen(false);
        },
      });
    }).catch(err => {
      toast({ title: "Błąd", description: err.message, variant: "destructive" });
      setCopyDialogOpen(false);
    });
  }

  function applyWeeklyTemplate() {
    if (!templateEmpId) {
      toast({ title: "Wybierz pracownika", variant: "destructive" });
      return;
    }
    const empId = Number(templateEmpId);
    const newSchedules: any[] = [];

    for (const d of daysInMonth) {
      const tmpl = templateDays[d.dow];
      if (tmpl) {
        newSchedules.push({
          employeeId: empId,
          date: d.dateStr,
          startTime: tmpl.start,
          endTime: tmpl.end,
          shiftName: tmpl.name,
          shiftColor: tmpl.color,
          locationId: null,
        });
      }
    }

    if (newSchedules.length === 0) {
      toast({ title: "Nie wybrano żadnych zmian w szablonie", variant: "destructive" });
      return;
    }

    bulkMut.mutate({
      schedules: newSchedules,
      deleteFrom: firstDay,
      deleteTo: lastDayStr,
      deleteEmployeeId: empId,
    }, {
      onSuccess: () => {
        toast({ title: `Szablon zastosowany (${newSchedules.length} zmian)` });
        setTemplateDialogOpen(false);
        setTemplateDays({});
      },
    });
  }

  function handleBulkAssign() {
    if (bulkSelectedEmps.size === 0 || bulkSelectedDays.size === 0) {
      toast({ title: "Zaznacz pracowników i dni", variant: "destructive" });
      return;
    }

    const newSchedules: any[] = [];
    for (const empId of bulkSelectedEmps) {
      for (const dateStr of bulkSelectedDays) {
        newSchedules.push({
          employeeId: empId,
          date: dateStr,
          startTime: bulkShiftStart,
          endTime: bulkShiftEnd,
          shiftName: bulkShiftName || null,
          shiftColor: bulkShiftColor,
          locationId: null,
        });
      }
    }

    bulkMut.mutate({ schedules: newSchedules }, {
      onSuccess: () => {
        toast({ title: `Przypisano ${newSchedules.length} zmian` });
        setBulkDialogOpen(false);
        setBulkSelectedEmps(new Set());
        setBulkSelectedDays(new Set());
      },
    });
  }

  function exportGrafikPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setFontSize(14);
    doc.text(removeDiacritics(`Grafik pracy — ${MONTH_NAMES[month - 1]} ${year}`), 14, 15);

    const dayHeaders = daysInMonth.map(d => `${d.day}\n${DAY_NAMES_SHORT[d.dow]}`);
    const headers = [removeDiacritics("Pracownik"), ...dayHeaders, removeDiacritics("Σ godz.")];

    const rows = activeEmployees.map((emp: Employee) => {
      const cells = daysInMonth.map(d => {
        const key = `${emp.id}-${d.dateStr}`;
        const shifts = scheduleMap[key] || [];
        return shifts.map(s => `${s.startTime}-${s.endTime}`).join("\n") || "";
      });
      const hours = empHours[emp.id] || 0;
      return [removeDiacritics(`${emp.firstName} ${emp.lastName}`), ...cells, `${hours}h`];
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 22,
      styles: { fontSize: 6, cellPadding: 1, overflow: "linebreak" },
      headStyles: { fillColor: [59, 130, 246], fontSize: 6, halign: "center" },
      columnStyles: {
        0: { cellWidth: 28, halign: "left" },
        [headers.length - 1]: { cellWidth: 14, halign: "center", fontStyle: "bold" },
      },
      didParseCell(data: any) {
        if (data.section === "body" && data.column.index > 0 && data.column.index < headers.length - 1) {
          const d = daysInMonth[data.column.index - 1];
          if (d?.isWeekend) data.cell.styles.fillColor = [254, 226, 226];
        }
      },
    });

    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString("pl-PL")}`, 14, pageHeight - 8);
    doc.save(`grafik_${year}_${String(month).padStart(2, "0")}.pdf`);
  }

  function getHoursColor(hours: number): string {
    const ratio = hours / MONTHLY_NORM_HOURS;
    if (ratio >= 0.95 && ratio <= 1.05) return "text-green-600 dark:text-green-400";
    if (ratio < 0.8) return "text-yellow-600 dark:text-yellow-400";
    if (ratio > 1.1) return "text-red-600 dark:text-red-400";
    return "text-muted-foreground";
  }

  const renderDays = viewMode === "month" ? daysInMonth : weekDays;

  const renderShiftCell = (emp: Employee, d: typeof daysInMonth[0], isWeekView: boolean) => {
    const key = `${emp.id}-${d.dateStr}`;
    const cellSchedules = scheduleMap[key] || [];
    const cellClass = isWeekView
      ? `px-1 py-1 text-center min-w-[100px] ${d.isWeekend ? "bg-red-50/50 dark:bg-red-950/10" : ""}`
      : `px-0.5 py-0.5 text-center cursor-pointer ${d.isWeekend ? "bg-red-50/50 dark:bg-red-950/10" : ""}`;

    return (
      <td
        key={d.dateStr}
        className={cellClass}
        onClick={() => cellSchedules.length === 0 && openAdd(emp.id, d.dateStr)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, emp.id, d.dateStr)}
        data-testid={`cell-schedule-${emp.id}-${d.day}`}
      >
        {cellSchedules.map(s => (
          <TooltipProvider key={s.id}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  draggable
                  onDragStart={(e) => handleDragStart(e, s)}
                  className={`block w-full rounded px-0.5 py-0.5 text-white leading-tight mb-0.5 truncate cursor-grab active:cursor-grabbing ${isWeekView ? "text-xs py-1" : "text-[10px]"}`}
                  style={{ backgroundColor: s.shiftColor || "#3b82f6" }}
                  onClick={(e) => { e.stopPropagation(); openEdit(s); }}
                  data-testid={`shift-${s.id}`}
                >
                  <GripHorizontal className="h-2.5 w-2.5 inline mr-0.5 opacity-50" />
                  {s.startTime}-{s.endTime}
                  {isWeekView && s.shiftName && <span className="ml-1 opacity-75">({s.shiftName})</span>}
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
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={viewMode === "month" ? prevMonth : prevWeek} data-testid="button-prev">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[200px] text-center" data-testid="text-current-period">
            {viewMode === "month"
              ? `${MONTH_NAMES[month - 1]} ${year}`
              : `${weekDays[0].day}.${String(weekDays[0].date.getMonth() + 1).padStart(2, "0")} — ${weekDays[6].day}.${String(weekDays[6].date.getMonth() + 1).padStart(2, "0")}.${weekDays[6].date.getFullYear()}`
            }
          </span>
          <Button variant="outline" size="icon" onClick={viewMode === "month" ? nextMonth : nextWeek} data-testid="button-next">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="rounded-none"
              data-testid="button-view-month"
            >
              <CalendarDays className="h-4 w-4 mr-1" /> Miesiąc
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="rounded-none"
              data-testid="button-view-week"
            >
              <CalendarRange className="h-4 w-4 mr-1" /> Tydzień
            </Button>
          </div>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-location-filter">
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
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => setTemplateDialogOpen(true)} data-testid="button-template">
          <LayoutTemplate className="h-4 w-4 mr-1" /> Szablon tygodniowy
        </Button>
        <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)} data-testid="button-bulk-assign">
          <Users className="h-4 w-4 mr-1" /> Masowe przypisanie
        </Button>
        <Button variant="outline" size="sm" onClick={() => setCopyDialogOpen(true)} data-testid="button-copy-schedule">
          <Copy className="h-4 w-4 mr-1" /> Kopiuj z poprzedniego miesiąca
        </Button>
        <Button variant="outline" size="sm" onClick={exportGrafikPdf} data-testid="button-export-grafik-pdf">
          <FileDown className="h-4 w-4 mr-1" /> Eksportuj PDF
        </Button>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="sticky left-0 z-10 bg-muted/50 px-2 py-2 text-left font-medium min-w-[140px]">Pracownik</th>
              {renderDays.map(d => (
                <th
                  key={d.dateStr}
                  className={`px-1 py-2 text-center font-medium ${viewMode === "week" ? "min-w-[100px]" : "min-w-[52px]"} ${d.isWeekend ? "bg-red-50 dark:bg-red-950/20" : ""}`}
                >
                  <div>{viewMode === "week" ? DAY_NAMES_FULL[d.dow] : d.day}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {viewMode === "week" ? `${d.day}.${String(d.date ? d.date.getMonth() + 1 : month).padStart(2, "0")}` : DAY_NAMES_SHORT[d.dow]}
                  </div>
                </th>
              ))}
              <th className="px-2 py-2 text-center font-medium min-w-[80px]">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>Σ godz.</TooltipTrigger>
                    <TooltipContent>Norma: {MONTHLY_NORM_HOURS}h/mies.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </th>
            </tr>
          </thead>
          <tbody>
            {activeEmployees.map((emp: Employee) => {
              const hours = empHours[emp.id] || 0;
              return (
                <tr key={emp.id} className="border-t hover:bg-muted/30">
                  <td className="sticky left-0 z-10 bg-background px-2 py-1 font-medium whitespace-nowrap">
                    {emp.firstName} {emp.lastName}
                  </td>
                  {renderDays.map(d => renderShiftCell(emp, d, viewMode === "week"))}
                  <td className="px-2 py-1 text-center font-medium">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className={getHoursColor(hours)}>{hours.toFixed(1)}h</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{hours.toFixed(1)}h / {MONTHLY_NORM_HOURS}h norma</p>
                          <p>{hours >= MONTHLY_NORM_HOURS ? "+" : ""}{(hours - MONTHLY_NORM_HOURS).toFixed(1)}h {hours >= MONTHLY_NORM_HOURS ? "nadgodziny" : "do normy"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                </tr>
              );
            })}
            {activeEmployees.length === 0 && (
              <tr>
                <td colSpan={renderDays.length + 2} className="text-center py-8 text-muted-foreground">
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
                  <SelectTrigger data-testid="select-start-time"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Godzina zakończenia</Label>
                <Select value={formEnd} onValueChange={setFormEnd}>
                  <SelectTrigger data-testid="select-end-time"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Lokalizacja</Label>
              <Select value={formLocId} onValueChange={setFormLocId}>
                <SelectTrigger data-testid="select-shift-location"><SelectValue placeholder="Brak" /></SelectTrigger>
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
                <Input value={formShiftName} onChange={e => setFormShiftName(e.target.value)} placeholder="np. Ranna" data-testid="input-shift-name" />
              </div>
              <div>
                <Label>Kolor</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={formColor} onChange={e => setFormColor(e.target.value)} className="h-9 w-12 rounded border cursor-pointer" data-testid="input-shift-color" />
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
                onClick={() => { deleteMut.mutate(editingSchedule.id); setDialogOpen(false); }}
                disabled={deleteMut.isPending}
                data-testid="button-delete-shift"
              >
                <Trash2 className="h-4 w-4 mr-1" /> Usuń
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-shift">Anuluj</Button>
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

      <AlertDialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" /> Wykryto konflikty
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>Wykryto następujące potencjalne problemy:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {conflictWarnings.map((w, i) => <li key={i} className="text-sm">{w}</li>)}
                </ul>
                <p>Czy mimo to chcesz zapisać zmianę?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-conflict">Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { pendingSaveRef.current?.(); setConflictDialogOpen(false); }}
              data-testid="button-confirm-conflict"
            >
              Zapisz mimo to
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kopiuj grafik z poprzedniego miesiąca</AlertDialogTitle>
            <AlertDialogDescription>
              Wszystkie istniejące zmiany w {MONTH_NAMES[month - 1]} {year} zostaną zastąpione zmianami z {MONTH_NAMES[month === 1 ? 11 : month - 2]} {month === 1 ? year - 1 : year}. Czy kontynuować?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-copy">Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={handleCopyFromPrev} disabled={bulkMut.isPending} data-testid="button-confirm-copy">
              {bulkMut.isPending ? "Kopiowanie..." : "Kopiuj"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Szablon tygodniowy</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Zdefiniuj zmiany na każdy dzień tygodnia. Szablon zostanie zastosowany na cały miesiąc dla wybranego pracownika.
          </p>
          <div className="space-y-4">
            <div>
              <Label>Pracownik</Label>
              <Select value={templateEmpId} onValueChange={setTemplateEmpId}>
                <SelectTrigger data-testid="select-template-employee"><SelectValue placeholder="Wybierz pracownika" /></SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((emp: Employee) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>{emp.firstName} {emp.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 0].map(dow => (
                <div key={dow} className="flex items-center gap-2">
                  <div className="w-24 text-sm font-medium">{DAY_NAMES_FULL[dow]}</div>
                  <div className="flex items-center gap-1 flex-1">
                    {templateDays[dow] ? (
                      <>
                        <Badge style={{ backgroundColor: templateDays[dow]!.color }} className="text-white text-xs">
                          {templateDays[dow]!.start}-{templateDays[dow]!.end}
                        </Badge>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                          const next = { ...templateDays };
                          delete next[dow];
                          setTemplateDays(next);
                        }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <div className="flex gap-1 flex-wrap">
                        {SHIFT_PRESETS.map(p => (
                          <Button
                            key={p.label}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setTemplateDays({ ...templateDays, [dow]: { start: p.start, end: p.end, name: p.label, color: p.color } })}
                          >
                            <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: p.color }} />
                            {p.label}
                          </Button>
                        ))}
                        <span className="text-xs text-muted-foreground self-center">Wolne</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Anuluj</Button>
            <Button onClick={applyWeeklyTemplate} disabled={bulkMut.isPending} data-testid="button-apply-template">
              {bulkMut.isPending ? "Stosowanie..." : "Zastosuj szablon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Masowe przypisanie zmian</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Zaznacz pracowników i dni, a następnie wybierz zmianę do przypisania.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pracownicy ({bulkSelectedEmps.size} wybranych)</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto p-2 space-y-1">
                {activeEmployees.map((emp: Employee) => (
                  <label key={emp.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={bulkSelectedEmps.has(emp.id)}
                      onCheckedChange={(checked) => {
                        const next = new Set(bulkSelectedEmps);
                        if (checked) next.add(emp.id); else next.delete(emp.id);
                        setBulkSelectedEmps(next);
                      }}
                      data-testid={`bulk-emp-${emp.id}`}
                    />
                    {emp.firstName} {emp.lastName}
                  </label>
                ))}
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setBulkSelectedEmps(new Set(activeEmployees.map((e: Employee) => e.id)))}>
                  Zaznacz wszystkich
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setBulkSelectedEmps(new Set())}>
                  Odznacz
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Dni ({bulkSelectedDays.size} wybranych)</Label>
              <div className="border rounded-md max-h-48 overflow-y-auto p-2">
                <div className="grid grid-cols-7 gap-1">
                  {daysInMonth.map(d => (
                    <button
                      key={d.day}
                      className={`text-xs rounded p-1 border transition-colors ${
                        bulkSelectedDays.has(d.dateStr)
                          ? "bg-primary text-primary-foreground"
                          : d.isWeekend ? "bg-red-50 dark:bg-red-950/20 hover:bg-red-100" : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        const next = new Set(bulkSelectedDays);
                        if (next.has(d.dateStr)) next.delete(d.dateStr); else next.add(d.dateStr);
                        setBulkSelectedDays(next);
                      }}
                      data-testid={`bulk-day-${d.day}`}
                    >
                      {d.day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setBulkSelectedDays(new Set(daysInMonth.filter(d => !d.isWeekend).map(d => d.dateStr)))}>
                  Dni robocze
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setBulkSelectedDays(new Set(daysInMonth.map(d => d.dateStr)))}>
                  Wszystkie
                </Button>
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setBulkSelectedDays(new Set())}>
                  Odznacz
                </Button>
              </div>
            </div>
          </div>
          <div className="space-y-3 pt-2">
            <Label>Zmiana do przypisania</Label>
            <div className="flex flex-wrap gap-2">
              {SHIFT_PRESETS.map(p => (
                <Button
                  key={p.label}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setBulkShiftStart(p.start);
                    setBulkShiftEnd(p.end);
                    setBulkShiftName(p.label);
                    setBulkShiftColor(p.color);
                  }}
                >
                  <span className="w-2.5 h-2.5 rounded-full mr-1" style={{ backgroundColor: p.color }} />
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Od</Label>
                <Select value={bulkShiftStart} onValueChange={setBulkShiftStart}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Do</Label>
                <Select value={bulkShiftEnd} onValueChange={setBulkShiftEnd}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Anuluj</Button>
            <Button onClick={handleBulkAssign} disabled={bulkMut.isPending} data-testid="button-confirm-bulk">
              {bulkMut.isPending ? "Przypisywanie..." : `Przypisz (${bulkSelectedEmps.size} × ${bulkSelectedDays.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
