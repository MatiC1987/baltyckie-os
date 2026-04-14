import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { recepcjaFetch } from "./RecepcjaApp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Loader2, ChevronLeft, ChevronRight,
  ClipboardList, CheckCircle2, CircleDot, Clock, AlertTriangle,
  Trash2, Edit, MessageSquare, Send, Building2, X, Calendar, List, Tags, Pencil, Check,
} from "lucide-react";
import type { Employee } from "@shared/schema";

type CategoryItem = { id: number; name: string; color: string };
type TaskItem = {
  id: number; title: string; description: string | null; date: string;
  startTime: string | null; endTime: string | null; status: string; priority: string;
  employeeId: number; apartmentId: number | null; categoryId: number | null;
  actualStartTime: string | null; actualEndTime: string | null;
  mileageKm: string | null; notes: string | null; assignedById: number | null;
  source?: string;
};
type CommentItem = { id: number; taskId: number; authorId: number; authorName: string; content: string; createdAt: string };
type ApartmentItem = { id: number; name: string; location: string | null; active: boolean };
type WorkScheduleItem = { id: number; employeeId: number; date: string; startTime: string; endTime: string; shiftName: string | null; shiftColor: string | null };
type DayData = {
  date: string;
  tasks: TaskItem[];
  schedules: WorkScheduleItem[];
  employees: Employee[];
  workload: Record<number, { taskCount: number; totalMinutes: number }>;
};
type CalendarColumnItem = { employee: Employee; isEtat: boolean };
type Workload = Record<number, { taskCount: number; totalMinutes: number }>;
type ScheduleMap = Record<number, WorkScheduleItem[]>;
type TaskPayload = {
  title?: string; description?: string | null; employeeId?: number; date?: string;
  startTime?: string | null; endTime?: string | null; priority?: string; status?: string;
  apartmentId?: number | null; categoryId?: number | null; source?: string;
};
type UpdateTaskPayload = TaskPayload & { id: number };

const STATUS_MAP: Record<string, { label: string; color: string; bar: string }> = {
  ZAPLANOWANE: { label: "Zaplanowane", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", bar: "bg-slate-400" },
  W_TRAKCIE: { label: "W trakcie", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300", bar: "bg-blue-500" },
  ZAKONCZONE: { label: "Zakończone", color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300", bar: "bg-green-500" },
  ANULOWANE: { label: "Anulowane", color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300", bar: "bg-red-400" },
};
const PRIORITY_MAP: Record<string, { label: string; bg: string; text: string; border: string }> = {
  NISKI: { label: "Niski", bg: "bg-green-500", text: "text-green-700", border: "border-green-400" },
  NORMALNY: { label: "Normalny", bg: "bg-blue-500", text: "text-blue-700", border: "border-blue-400" },
  WYSOKI: { label: "Wysoki", bg: "bg-orange-500", text: "text-orange-700", border: "border-orange-400" },
  PILNY: { label: "Pilny", bg: "bg-red-500", text: "text-red-700", border: "border-red-400" },
};
const PRIORITY_TILE: Record<string, string> = {
  NISKI: "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800",
  NORMALNY: "bg-blue-50 border-blue-300 dark:bg-blue-950/30 dark:border-blue-800",
  WYSOKI: "bg-orange-50 border-orange-300 dark:bg-orange-950/30 dark:border-orange-800",
  PILNY: "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800",
};

const CALENDAR_START = 6;
const CALENDAR_END = 22;
const HOUR_HEIGHT = 60;
const TOTAL_HOURS = CALENDAR_END - CALENDAR_START;

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function timeToPixels(t: string): number {
  const mins = timeToMinutes(t) - CALENDAR_START * 60;
  return (mins / 60) * HOUR_HEIGHT;
}
function pixelsToTime(px: number): string {
  const totalMins = Math.round((px / HOUR_HEIGHT) * 60 + CALENDAR_START * 60);
  const snapped = Math.round(totalMins / 15) * 15;
  return minutesToTime(Math.max(CALENDAR_START * 60, Math.min(CALENDAR_END * 60, snapped)));
}
function initials(first: string, last: string): string {
  return `${first?.charAt(0) || ""}${last?.charAt(0) || ""}`.toUpperCase();
}
function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const days = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];
  const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}
function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

function Avatar({ firstName, lastName, color, size = "sm", ring }: { firstName: string; lastName: string; color: string; size?: "sm" | "md" | "lg"; ring?: string }) {
  const sizeClass = size === "lg" ? "w-10 h-10 text-sm" : size === "md" ? "w-8 h-8 text-xs" : "w-7 h-7 text-xs";
  return (
    <div className={`${sizeClass} rounded-full flex items-center justify-center text-white font-bold shrink-0 ${color} ${ring || ""}`}>
      {initials(firstName, lastName)}
    </div>
  );
}

export default function RecepcjaZadania() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [viewMode, setViewMode] = useState<"lista" | "kalendarz">(() => {
    return (localStorage.getItem("zadania_view") as "lista" | "kalendarz") || "lista";
  });
  const [showSheet, setShowSheet] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [popoverTask, setPopoverTask] = useState<TaskItem | null>(null);
  const [popoverRef, setPopoverRef] = useState<{ top: number; left: number } | null>(null);
  const [newComment, setNewComment] = useState("");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const { toast } = useToast();

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formEmployee, setFormEmployee] = useState("");
  const [formDate, setFormDate] = useState(date);
  const [formStart, setFormStart] = useState("");
  const [formEnd, setFormEnd] = useState("");
  const [formPriority, setFormPriority] = useState("NORMALNY");
  const [formApartment, setFormApartment] = useState("");
  const [formCategoryId, setFormCategoryId] = useState<string>("");
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const calendarRef = useRef<HTMLDivElement>(null);
  const [nowPx, setNowPx] = useState(0);
  const [dragging, setDragging] = useState<{ task: TaskItem; colEmployeeId: number; offsetY: number } | null>(null);
  const [resizing, setResizing] = useState<{ task: TaskItem; startY: number; origEnd: string } | null>(null);
  const [dragOver, setDragOver] = useState<{ employeeId: number; time: string } | null>(null);
  const [mobileColumnIndex, setMobileColumnIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    localStorage.setItem("zadania_view", viewMode);
  }, [viewMode]);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const px = ((mins - CALENDAR_START * 60) / 60) * HOUR_HEIGHT;
      setNowPx(px);
    };
    update();
    const iv = setInterval(update, 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (viewMode === "kalendarz" && calendarRef.current) {
      const scroll = nowPx - 200;
      calendarRef.current.scrollTop = Math.max(0, scroll);
    }
  }, [viewMode, nowPx]);

  const employeesQuery = useQuery<Employee[]>({
    queryKey: ["/api/recepcja/rcp/employees"],
    queryFn: async () => (await recepcjaFetch("GET", "/api/recepcja/rcp/employees")).json(),
  });
  const apartmentsQuery = useQuery<ApartmentItem[]>({
    queryKey: ["/api/recepcja/apartments"],
    queryFn: async () => (await recepcjaFetch("GET", "/api/recepcja/apartments")).json(),
  });
  const tasksQuery = useQuery<TaskItem[]>({
    queryKey: ["/api/recepcja/tasks", date],
    queryFn: async () => (await recepcjaFetch("GET", `/api/recepcja/tasks?date=${date}`)).json(),
  });
  const dayQuery = useQuery<DayData>({
    queryKey: ["/api/recepcja/tasks/day", date],
    queryFn: async () => (await recepcjaFetch("GET", `/api/recepcja/tasks/day?date=${date}`)).json(),
  });
  const commentsQuery = useQuery<CommentItem[]>({
    queryKey: ["/api/recepcja/tasks", popoverTask?.id, "comments"],
    enabled: !!popoverTask,
    queryFn: async () => (await recepcjaFetch("GET", `/api/recepcja/tasks/${popoverTask!.id}/comments`)).json(),
  });
  const taskCategoriesQuery = useQuery<CategoryItem[]>({
    queryKey: ["/api/recepcja/task-categories"],
    queryFn: async () => (await recepcjaFetch("GET", "/api/recepcja/task-categories")).json(),
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskPayload) => {
      const res = await recepcjaFetch("POST", "/api/recepcja/tasks", data);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks/day"] });
      closeSheet();
      toast({ title: "Zadanie utworzone" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...data }: UpdateTaskPayload) => {
      const res = await recepcjaFetch("PUT", `/api/recepcja/tasks/${id}`, data);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks/day"] });
      closeSheet();
      toast({ title: "Zaktualizowano" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });
  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await recepcjaFetch("DELETE", `/api/recepcja/tasks/${id}`);
      if (!res.ok) throw new Error("Błąd usuwania");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks/day"] });
      setPopoverTask(null);
      toast({ title: "Usunięto zadanie" });
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });
  const addCommentMutation = useMutation({
    mutationFn: async ({ taskId, content }: { taskId: number; content: string }) => {
      const res = await recepcjaFetch("POST", `/api/recepcja/tasks/${taskId}/comments`, { content });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks", popoverTask?.id, "comments"] });
      setNewComment("");
    },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await recepcjaFetch("POST", "/api/recepcja/task-categories", data);
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/recepcja/task-categories"] }); toast({ title: "Dodano kategorię" }); },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, name, color }: { id: number; name: string; color: string }) => {
      const res = await recepcjaFetch("PUT", `/api/recepcja/task-categories/${id}`, { name, color });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/recepcja/task-categories"] }); queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] }); toast({ title: "Zaktualizowano kategorię" }); },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await recepcjaFetch("DELETE", `/api/recepcja/task-categories/${id}`);
      if (!res.ok) throw new Error("Błąd usuwania kategorii");
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/recepcja/task-categories"] }); queryClient.invalidateQueries({ queryKey: ["/api/recepcja/tasks"] }); toast({ title: "Usunięto kategorię" }); },
    onError: (err: Error) => toast({ title: "Błąd", description: err.message, variant: "destructive" }),
  });

  const closeSheet = () => {
    setShowSheet(false); setEditingTask(null);
    setFormTitle(""); setFormDesc(""); setFormEmployee(""); setFormStart(""); setFormEnd(""); setFormPriority("NORMALNY"); setFormApartment(""); setFormCategoryId("");
  };
  const openCreateForm = (prefillEmployee?: string, prefillDate?: string, prefillStart?: string) => {
    setEditingTask(null);
    setFormDate(prefillDate || date);
    setFormTitle(""); setFormDesc(""); setFormEmployee(prefillEmployee || ""); setFormStart(prefillStart || ""); setFormEnd(""); setFormPriority("NORMALNY"); setFormApartment(""); setFormCategoryId("");
    setShowSheet(true);
  };
  const openEditForm = (task: TaskItem) => {
    setEditingTask(task);
    setFormTitle(task.title); setFormDesc(task.description || ""); setFormEmployee(String(task.employeeId));
    setFormDate(task.date); setFormStart(task.startTime || ""); setFormEnd(task.endTime || ""); setFormPriority(task.priority);
    setFormApartment(task.apartmentId ? String(task.apartmentId) : "");
    setFormCategoryId(task.categoryId ? String(task.categoryId) : "");
    setShowSheet(true);
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formEmployee || !formDate) return;
    const payload = {
      title: formTitle, description: formDesc || null, employeeId: Number(formEmployee), date: formDate,
      startTime: formStart || null, endTime: formEnd || null, priority: formPriority,
      status: editingTask?.status || "ZAPLANOWANE",
      apartmentId: formApartment && formApartment !== "none" ? Number(formApartment) : null,
      categoryId: formCategoryId && formCategoryId !== "none" ? Number(formCategoryId) : null,
      source: "RECEPCJA",
    };
    if (editingTask) updateTaskMutation.mutate({ id: editingTask.id, ...payload });
    else createTaskMutation.mutate(payload);
  };

  const changeDate = (delta: number) => {
    const d = new Date(date + "T12:00:00");
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().slice(0, 10));
    setPopoverTask(null);
  };

  const today = new Date().toISOString().slice(0, 10);
  const activeEmployees = useMemo(() => (employeesQuery.data || []).filter(e => e.status === "AKTYWNY"), [employeesQuery.data]);
  const activeApartments = useMemo(() => (apartmentsQuery.data || []).filter(a => a.active).sort((a, b) => a.name.localeCompare(b.name)), [apartmentsQuery.data]);
  const etatEmployees = activeEmployees.filter(e => e.cooperationType === "ETAT");
  const hourlyEmployees = activeEmployees.filter(e => e.cooperationType === "PRACA_NA_H");

  const dayData = dayQuery.data;
  const schedulesByEmployee = useMemo(() => {
    const map: Record<number, WorkScheduleItem[]> = {};
    (dayData?.schedules || []).forEach(s => {
      if (!map[s.employeeId]) map[s.employeeId] = [];
      map[s.employeeId].push(s);
    });
    return map;
  }, [dayData]);

  const etatWithSchedule = useMemo(() =>
    etatEmployees.filter(e => !!schedulesByEmployee[e.id]?.length),
    [etatEmployees, schedulesByEmployee]);

  const tasks = useMemo(() => tasksQuery.data || [], [tasksQuery.data]);
  const tasksByEmployee = useMemo(() => {
    const map: Record<number, TaskItem[]> = {};
    tasks.forEach(t => {
      if (!map[t.employeeId]) map[t.employeeId] = [];
      map[t.employeeId].push(t);
    });
    return map;
  }, [tasks]);

  const getEmployeeName = (empId: number) => {
    const emp = activeEmployees.find(e => e.id === empId);
    return emp ? `${emp.firstName} ${emp.lastName}` : `#${empId}`;
  };
  const getApartmentName = (aptId: number | null) => {
    if (!aptId) return null;
    return activeApartments.find(a => a.id === aptId)?.name || null;
  };
  const getEmployee = (empId: number) => activeEmployees.find(e => e.id === empId);

  const filteredTasks = useMemo(() => {
    let ts = tasks;
    if (filterEmployee !== "all") ts = ts.filter(t => t.employeeId === Number(filterEmployee));
    if (filterStatus !== "all") ts = ts.filter(t => t.status === filterStatus);
    return ts;
  }, [tasks, filterEmployee, filterStatus]);

  const groupedByEmployee = useMemo(() => {
    const groups: Record<number, TaskItem[]> = {};
    filteredTasks.forEach(t => {
      (groups[t.employeeId] = groups[t.employeeId] || []).push(t);
    });
    return groups;
  }, [filteredTasks]);

  const statusCounts = useMemo(() => ({
    total: tasks.length,
    planned: tasks.filter(t => t.status === "ZAPLANOWANE").length,
    inProgress: tasks.filter(t => t.status === "W_TRAKCIE").length,
    done: tasks.filter(t => t.status === "ZAKONCZONE").length,
  }), [tasks]);

  const calendarColumns = useMemo(() => {
    if (isMobile) {
      const allCols = [
        ...etatWithSchedule.map(e => ({ employee: e, isEtat: true })),
        ...hourlyEmployees.map(e => ({ employee: e, isEtat: false })),
      ];
      return allCols;
    }
    return [
      ...etatWithSchedule.map(e => ({ employee: e, isEtat: true })),
      ...hourlyEmployees.map(e => ({ employee: e, isEtat: false })),
    ];
  }, [etatWithSchedule, hourlyEmployees, isMobile]);

  const visibleColumns = useMemo(() => {
    if (!isMobile) return calendarColumns;
    if (calendarColumns.length === 0) return [];
    return [calendarColumns[mobileColumnIndex % calendarColumns.length]];
  }, [isMobile, calendarColumns, mobileColumnIndex]);

  const handleDragStart = useCallback((e: React.DragEvent, task: TaskItem, colEmployeeId: number) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    setDragging({ task, colEmployeeId, offsetY });
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleColDragOver = useCallback((e: React.DragEvent, employeeId: number) => {
    e.preventDefault();
    if (!calendarRef.current) return;
    const colRect = calendarRef.current.getBoundingClientRect();
    const scrollTop = calendarRef.current.scrollTop;
    const relY = e.clientY - colRect.top + scrollTop - 48;
    const time = pixelsToTime(relY - (dragging?.offsetY || 0));
    setDragOver({ employeeId, time });
  }, [dragging]);

  const handleDrop = useCallback(async (e: React.DragEvent, employeeId: number) => {
    e.preventDefault();
    if (!dragging || !dragOver) return;
    const { task } = dragging;
    const newStart = dragOver.time;
    let newEnd = task.endTime;
    if (task.startTime && task.endTime && newStart) {
      const dur = timeToMinutes(task.endTime) - timeToMinutes(task.startTime);
      newEnd = minutesToTime(timeToMinutes(newStart) + Math.max(dur, 30));
    }
    updateTaskMutation.mutate({ id: task.id, employeeId, startTime: newStart, endTime: newEnd });
    setDragging(null);
    setDragOver(null);
  }, [dragging, dragOver, updateTaskMutation]);

  const handleResizeStart = useCallback((e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    e.preventDefault();
    setResizing({ task, startY: e.clientY, origEnd: task.endTime || "00:00" });
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const { task, startY, origEnd } = resizing;
    const startMins = task.startTime ? timeToMinutes(task.startTime) : CALENDAR_START * 60;
    const MIN_DURATION = 15;
    const calcNewEnd = (clientY: number): string => {
      const deltaY = clientY - startY;
      const deltaMins = Math.round((deltaY / HOUR_HEIGHT) * 60 / 15) * 15;
      const rawMins = timeToMinutes(origEnd) + deltaMins;
      const clampedMins = Math.min(CALENDAR_END * 60, Math.max(startMins + MIN_DURATION, rawMins));
      return minutesToTime(clampedMins);
    };
    const onMove = (e: MouseEvent) => {
      const newEnd = calcNewEnd(e.clientY);
      if (popoverTask?.id === task.id) setPopoverTask(prev => prev ? { ...prev, endTime: newEnd } : prev);
    };
    const onUp = (e: MouseEvent) => {
      const newEnd = calcNewEnd(e.clientY);
      updateTaskMutation.mutate({ id: task.id, endTime: newEnd });
      setResizing(null);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  }, [resizing, updateTaskMutation]);

  const handleClickTask = (e: React.MouseEvent, task: TaskItem) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopoverRef({ top: rect.top, left: rect.right + 8 });
    setPopoverTask(task);
    setNewComment("");
  };

  const handleClickEmptySlot = (e: React.MouseEvent, employeeId: number, colEl: HTMLElement) => {
    if ((e.target as HTMLElement).closest('[data-task]')) return;
    const rect = colEl.getBoundingClientRect();
    const scrollTop = calendarRef.current?.scrollTop || 0;
    const relY = e.clientY - rect.top + scrollTop - 48;
    const time = pixelsToTime(relY);
    openCreateForm(String(employeeId), date, time);
  };

  const applyPreset = (apt: ApartmentItem) => {
    setFormTitle(`Sprzątanie ${apt.name}`);
    setFormApartment(String(apt.id));
    setFormPriority("NORMALNY");
  };

  return (
    <div className="flex flex-col min-h-0 relative">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold" data-testid="text-zadania-title">Zadania pracowników</h1>
            <p className="text-sm text-muted-foreground">Planowanie i śledzenie zadań</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowCategoryManager(true)} data-testid="button-manage-categories">
              <Tags className="h-4 w-4 mr-1" /> Kategorie
            </Button>
            <Button className="rounded-xl" onClick={() => openCreateForm()} data-testid="button-create-task">
              <Plus className="h-4 w-4 mr-1" /> Nowe zadanie
            </Button>
          </div>
        </div>

        {/* Segmented Control */}
        <div className="flex items-center gap-3">
          <div className="bg-muted p-1 rounded-full flex items-center" data-testid="segmented-control-view">
            <button
              onClick={() => setViewMode("lista")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${viewMode === "lista" ? "bg-white dark:bg-neutral-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="button-view-lista"
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => setViewMode("kalendarz")}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${viewMode === "kalendarz" ? "bg-white dark:bg-neutral-800 shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              data-testid="button-view-kalendarz"
            >
              <Calendar className="h-3.5 w-3.5" /> Kalendarz
            </button>
          </div>
        </div>
      </div>

      {/* Date Nav */}
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => changeDate(-1)} data-testid="button-prev-day">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <div className="flex items-center gap-2">
            <p className="font-bold text-base" data-testid="text-task-date">{date === today ? "Dziś" : formatDateFull(date).split(",")[0].trim()}</p>
            {date !== today && (
              <button onClick={() => setDate(today)} className="text-xs text-primary underline" data-testid="button-today">Dziś</button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{formatDateFull(date)}</p>
        </div>
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => changeDate(1)} data-testid="button-next-day">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Availability Bar */}
      <AvailabilityBar
        etatEmployees={etatEmployees}
        hourlyEmployees={hourlyEmployees}
        schedulesByEmployee={schedulesByEmployee}
        workload={dayData?.workload || {}}
      />

      {/* Stats (subtle) */}
      <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
        <span data-testid="stat-total"><span className="font-semibold text-foreground">{statusCounts.total}</span> łącznie</span>
        <span>·</span>
        <span><span className="font-semibold text-slate-500">{statusCounts.planned}</span> zapl.</span>
        <span>·</span>
        <span><span className="font-semibold text-blue-500">{statusCounts.inProgress}</span> w trakcie</span>
        <span>·</span>
        <span><span className="font-semibold text-green-500">{statusCounts.done}</span> gotowe</span>
      </div>

      {/* Content */}
      {viewMode === "lista" ? (
        <ListView
          tasksQuery={tasksQuery}
          filteredTasks={filteredTasks}
          groupedByEmployee={groupedByEmployee}
          activeEmployees={activeEmployees}
          etatEmployees={etatEmployees}
          hourlyEmployees={hourlyEmployees}
          filterEmployee={filterEmployee}
          setFilterEmployee={setFilterEmployee}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          getEmployeeName={getEmployeeName}
          getApartmentName={getApartmentName}
          getEmployee={getEmployee}
          onClickTask={(task: TaskItem, el: HTMLElement) => {
            const rect = el.getBoundingClientRect();
            setPopoverRef({ top: rect.top, left: Math.min(rect.right + 8, window.innerWidth - 360) });
            setPopoverTask(task);
            setNewComment("");
          }}
          onCreateTask={() => openCreateForm()}
          categories={taskCategoriesQuery.data || []}
        />
      ) : (
        <DayCalendar
          calendarRef={calendarRef}
          calendarColumns={calendarColumns}
          visibleColumns={visibleColumns}
          isMobile={isMobile}
          mobileColumnIndex={mobileColumnIndex}
          setMobileColumnIndex={setMobileColumnIndex}
          tasksByEmployee={tasksByEmployee}
          schedulesByEmployee={schedulesByEmployee}
          workload={dayData?.workload || {}}
          nowPx={nowPx}
          date={date}
          today={today}
          dragging={dragging}
          dragOver={dragOver}
          onDragStart={handleDragStart}
          onColDragOver={handleColDragOver}
          onDrop={handleDrop}
          onDragEnd={() => { setDragging(null); setDragOver(null); }}
          onResizeStart={handleResizeStart}
          onClickTask={handleClickTask}
          onClickEmptySlot={handleClickEmptySlot}
          onCreateTask={() => openCreateForm()}
          getApartmentName={getApartmentName}
        />
      )}

      {/* Task Popover */}
      {popoverTask && (
        <TaskPopover
          task={popoverTask}
          employee={getEmployee(popoverTask.employeeId)}
          apartmentName={getApartmentName(popoverTask.apartmentId)}
          comments={commentsQuery.data || []}
          commentsLoading={commentsQuery.isLoading}
          newComment={newComment}
          setNewComment={setNewComment}
          position={popoverRef}
          onClose={() => setPopoverTask(null)}
          onEdit={() => { openEditForm(popoverTask); setPopoverTask(null); }}
          onDelete={() => { if (window.confirm("Usunąć zadanie?")) deleteTaskMutation.mutate(popoverTask.id); }}
          onStatusChange={(s: string) => {
            updateTaskMutation.mutate({ id: popoverTask.id, status: s });
            setPopoverTask(prev => prev ? { ...prev, status: s } : prev);
          }}
          onAddComment={() => {
            if (newComment.trim()) addCommentMutation.mutate({ taskId: popoverTask.id, content: newComment.trim() });
          }}
          deleteLoading={deleteTaskMutation.isPending}
          updateLoading={updateTaskMutation.isPending}
        />
      )}

      {/* Category Manager Dialog */}
      <CategoryManagerDialog
        open={showCategoryManager}
        onClose={() => setShowCategoryManager(false)}
        categories={taskCategoriesQuery.data || []}
        onAdd={(name, color) => createCategoryMutation.mutate({ name, color })}
        onUpdate={(id, name, color) => updateCategoryMutation.mutate({ id, name, color })}
        onDelete={(id) => deleteCategoryMutation.mutate(id)}
        addPending={createCategoryMutation.isPending}
        deletePending={deleteCategoryMutation.isPending}
      />

      {/* Edit Sheet */}
      {showSheet && (
        <TaskSheet
          editingTask={editingTask}
          formTitle={formTitle} setFormTitle={setFormTitle}
          formDesc={formDesc} setFormDesc={setFormDesc}
          formEmployee={formEmployee} setFormEmployee={setFormEmployee}
          formDate={formDate} setFormDate={setFormDate}
          formStart={formStart} setFormStart={setFormStart}
          formEnd={formEnd} setFormEnd={setFormEnd}
          formPriority={formPriority} setFormPriority={setFormPriority}
          formApartment={formApartment} setFormApartment={setFormApartment}
          formCategoryId={formCategoryId} setFormCategoryId={setFormCategoryId}
          categories={taskCategoriesQuery.data || []}
          etatEmployees={etatEmployees}
          hourlyEmployees={hourlyEmployees}
          activeApartments={activeApartments}
          schedulesByEmployee={schedulesByEmployee}
          workload={dayData?.workload || {}}
          date={date}
          onClose={closeSheet}
          onSubmit={handleSubmitForm}
          onPreset={applyPreset}
          isLoading={createTaskMutation.isPending || updateTaskMutation.isPending}
        />
      )}
    </div>
  );
}

// ===== AVAILABILITY BAR =====
function AvailabilityBar({
  etatEmployees, hourlyEmployees, schedulesByEmployee, workload
}: {
  etatEmployees: Employee[]; hourlyEmployees: Employee[];
  schedulesByEmployee: Record<number, WorkScheduleItem[]>;
  workload: Record<number, { taskCount: number; totalMinutes: number }>;
}) {
  const etatWithShift = etatEmployees.filter(e => !!schedulesByEmployee[e.id]?.length);
  const total = etatWithShift.length + hourlyEmployees.length;
  if (total === 0) return null;

  return (
    <div className="bg-muted/30 rounded-xl p-3 mb-3 border border-border/40">
      <div className="flex items-center gap-2 flex-wrap">
        {etatWithShift.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {etatWithShift.map(emp => {
              const shifts = schedulesByEmployee[emp.id] || [];
              const shift = shifts[0];
              const tooltip = shift ? `${shift.startTime}–${shift.endTime}` : "";
              return (
                <div key={emp.id} className="relative group flex flex-col items-center" data-testid={`avatar-etat-${emp.id}`}>
                  <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-green-400 ring-offset-1">
                    {initials(emp.firstName, emp.lastName)}
                  </div>
                  <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none border border-border">
                    <p className="font-semibold">{emp.firstName} {emp.lastName}</p>
                    {tooltip && <p>{tooltip}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hourlyEmployees.length > 0 && (
          <>
            {etatWithShift.length > 0 && <div className="w-px h-8 bg-border mx-1" />}
            <div className="flex items-center gap-0.5 mr-1">
              <span className="text-[10px] text-muted-foreground font-medium">Na godzinę</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {hourlyEmployees.map(emp => {
                const w = workload[emp.id];
                const label = w?.taskCount ? `${w.taskCount} zad · ${formatMinutes(w.totalMinutes)}` : "wolny";
                const busy = !!w?.taskCount;
                return (
                  <div key={emp.id} className="relative group flex flex-col items-center" data-testid={`avatar-hourly-${emp.id}`}>
                    <div className={`w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold ring-2 ring-offset-1 ${busy ? "ring-orange-400" : "ring-orange-200"}`}>
                      {initials(emp.firstName, emp.lastName)}
                    </div>
                    <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-[10px] px-2 py-1 rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none border border-border">
                      <p className="font-semibold">{emp.firstName} {emp.lastName}</p>
                      <p className={busy ? "text-orange-500" : "text-green-500"}>{label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ===== LIST VIEW =====
interface ListViewProps {
  tasksQuery: { isLoading: boolean };
  filteredTasks: TaskItem[];
  groupedByEmployee: Record<string, TaskItem[]>;
  activeEmployees: Employee[];
  etatEmployees: Employee[];
  hourlyEmployees: Employee[];
  filterEmployee: string;
  setFilterEmployee: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  getEmployeeName: (id: number) => string;
  getApartmentName: (id: number | null) => string | null;
  getEmployee: (id: number) => Employee | undefined;
  onClickTask: (task: TaskItem, el: HTMLElement) => void;
  onCreateTask: () => void;
  categories?: CategoryItem[];
}
function ListView({
  tasksQuery, filteredTasks, groupedByEmployee, activeEmployees, etatEmployees, hourlyEmployees,
  filterEmployee, setFilterEmployee, filterStatus, setFilterStatus,
  getEmployeeName, getApartmentName, getEmployee, onClickTask, onCreateTask, categories = []
}: ListViewProps) {
  return (
    <div>
      <div className="flex gap-2 mb-3 flex-wrap">
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-40 rounded-xl text-xs h-8" data-testid="select-filter-employee">
            <SelectValue placeholder="Pracownik" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy</SelectItem>
            {etatEmployees.map((e: Employee) => (
              <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>
            ))}
            {hourlyEmployees.map((e: Employee) => (
              <SelectItem key={e.id} value={String(e.id)}>{e.firstName} {e.lastName}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 rounded-xl text-xs h-8" data-testid="select-filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie</SelectItem>
            <SelectItem value="ZAPLANOWANE">Zaplanowane</SelectItem>
            <SelectItem value="W_TRAKCIE">W trakcie</SelectItem>
            <SelectItem value="ZAKONCZONE">Zakończone</SelectItem>
            <SelectItem value="ANULOWANE">Anulowane</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {tasksQuery.isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12">
          <ClipboardList className="h-12 w-12 text-muted-foreground/30" />
          <p className="text-muted-foreground text-sm" data-testid="text-no-tasks">Brak zadań na ten dzień</p>
          <Button variant="outline" className="rounded-xl" onClick={onCreateTask}>
            <Plus className="h-4 w-4 mr-1" /> Dodaj zadanie
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(groupedByEmployee).map(([empId, tasks]) => {
            const emp = getEmployee(Number(empId));
            const isEtat = emp?.cooperationType === "ETAT";
            return (
              <div key={empId}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${isEtat ? "bg-blue-500" : "bg-orange-500"}`}>
                    {initials(emp?.firstName || "", emp?.lastName || "")}
                  </div>
                  <span className="font-semibold text-sm">{getEmployeeName(Number(empId))}</span>
                  <Badge variant="outline" className={`text-[10px] rounded-full ${isEtat ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"}`}>
                    {isEtat ? "Etat" : "Godziny"}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{tasks.length} zadań</span>
                </div>
                <div className="flex flex-col gap-2 pl-9">
                  {tasks.map((task: TaskItem) => {
                    const st = STATUS_MAP[task.status] || STATUS_MAP.ZAPLANOWANE;
                    const pr = PRIORITY_MAP[task.priority] || PRIORITY_MAP.NORMALNY;
                    const aptName = getApartmentName(task.apartmentId);
                    return (
                      <div
                        key={task.id}
                        className="flex rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow cursor-pointer overflow-hidden"
                        onClick={(e) => onClickTask(task, e.currentTarget)}
                        data-testid={`card-task-${task.id}`}
                      >
                        <div className={`w-1 shrink-0 ${st.bar}`} />
                        <div className="flex items-start justify-between gap-2 p-3 w-full">
                          <div className="flex items-start gap-2 min-w-0">
                            {task.status === "ZAKONCZONE" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            ) : task.status === "W_TRAKCIE" ? (
                              <CircleDot className="h-4 w-4 text-blue-500 mt-0.5 shrink-0 animate-pulse" />
                            ) : (
                              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{task.title}</p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                {task.categoryId && (() => {
                                  const cat = categories.find(c => c.id === task.categoryId);
                                  return cat ? (
                                    <span className="flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: cat.color }} data-testid={`badge-cat-${task.id}`}>{cat.name}</span>
                                  ) : null;
                                })()}
                                {aptName && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <Building2 className="h-3 w-3" />{aptName}
                                  </span>
                                )}
                                {task.startTime && (
                                  <span className="text-[10px] text-muted-foreground">{task.startTime}{task.endTime ? ` – ${task.endTime}` : ""}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {task.source === "PRACOWNIK" && (
                              <Badge variant="outline" className="text-[10px] rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" data-testid={`badge-source-worker-${task.id}`}>Zgłoszone</Badge>
                            )}
                            {task.priority === "PILNY" && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== DAY CALENDAR =====
interface DayCalendarProps {
  calendarRef: React.RefObject<HTMLDivElement>;
  calendarColumns: CalendarColumnItem[];
  visibleColumns: CalendarColumnItem[];
  isMobile: boolean;
  mobileColumnIndex: number;
  setMobileColumnIndex: (i: number) => void;
  tasksByEmployee: Record<number, TaskItem[]>;
  schedulesByEmployee: ScheduleMap;
  workload: Workload;
  nowPx: number;
  date: string;
  today: string;
  dragging: { task: TaskItem; colEmployeeId: number; offsetY: number } | null;
  dragOver: { employeeId: number; time: string } | null;
  onDragStart: (e: React.DragEvent, task: TaskItem, colEmployeeId: number) => void;
  onColDragOver: (e: React.DragEvent, employeeId: number) => void;
  onDrop: (e: React.DragEvent, employeeId: number) => void;
  onDragEnd: () => void;
  onResizeStart: (e: React.MouseEvent, task: TaskItem) => void;
  onClickTask: (e: React.MouseEvent, task: TaskItem) => void;
  onClickEmptySlot: (e: React.MouseEvent, employeeId: number, colEl: HTMLElement) => void;
  onCreateTask: () => void;
  getApartmentName: (id: number | null) => string | null;
}
function DayCalendar({
  calendarRef, calendarColumns, visibleColumns, isMobile, mobileColumnIndex, setMobileColumnIndex,
  tasksByEmployee, schedulesByEmployee, workload, nowPx, date, today,
  dragging, dragOver, onDragStart, onColDragOver, onDrop, onDragEnd, onResizeStart, onClickTask, onClickEmptySlot, onCreateTask,
  getApartmentName
}: DayCalendarProps) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => CALENDAR_START + i);
  const halfHours = Array.from({ length: TOTAL_HOURS * 2 }, (_, i) => CALENDAR_START + i / 2);
  const isToday = date === today;

  if (calendarColumns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <Calendar className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground text-sm">Brak pracowników z zaplanowaną zmianą</p>
        <Button variant="outline" className="rounded-xl" onClick={onCreateTask}><Plus className="h-4 w-4 mr-1" />Dodaj zadanie</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Mobile column switcher */}
      {isMobile && calendarColumns.length > 1 && (
        <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
          {calendarColumns.map((col, i) => (
            <button
              key={col.employee.id}
              onClick={() => setMobileColumnIndex(i)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border shrink-0 transition-colors ${i === mobileColumnIndex % calendarColumns.length ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
            >
              <span className={`w-4 h-4 rounded-full ${col.isEtat ? "bg-blue-500" : "bg-orange-500"} text-white text-[9px] font-bold flex items-center justify-center`}>
                {initials(col.employee.firstName, col.employee.lastName)}
              </span>
              {col.employee.firstName}
            </button>
          ))}
        </div>
      )}

      {/* Calendar grid */}
      <div
        ref={calendarRef}
        className="relative overflow-auto border border-border rounded-xl bg-white dark:bg-neutral-900"
        style={{ maxHeight: "calc(100vh - 320px)", minHeight: 400 }}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-20 flex bg-white dark:bg-neutral-900 border-b border-border">
          {/* Time gutter header */}
          <div className="w-14 shrink-0" />
          {/* Etat columns header */}
          {visibleColumns.filter(c => c.isEtat).map(col => (
            <ColumnHeader key={col.employee.id} col={col} schedulesByEmployee={schedulesByEmployee} workload={workload} />
          ))}
          {/* Separator */}
          {visibleColumns.some(c => c.isEtat) && visibleColumns.some(c => !c.isEtat) && (
            <div className="w-px bg-border/60 self-stretch" />
          )}
          {/* Hourly columns header */}
          {visibleColumns.filter(c => !c.isEtat).map(col => (
            <ColumnHeader key={col.employee.id} col={col} schedulesByEmployee={schedulesByEmployee} workload={workload} />
          ))}
        </div>

        {/* Grid body */}
        <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {/* Time gutter */}
          <div className="w-14 shrink-0 relative">
            {hours.map((h) => (
              <div key={h} className="absolute right-2 text-[10px] text-muted-foreground leading-none" style={{ top: (h - CALENDAR_START) * HOUR_HEIGHT - 6 }}>
                {h < CALENDAR_END ? `${String(h).padStart(2, "0")}:00` : ""}
              </div>
            ))}
            {/* Half-hour ticks */}
            {halfHours.filter(h => h % 1 !== 0).map((h, i) => (
              <div key={i} className="absolute right-2 text-[9px] text-muted-foreground/50 leading-none" style={{ top: (h - CALENDAR_START) * HOUR_HEIGHT - 4 }} />
            ))}
          </div>

          {/* Background grid lines */}
          <div className="absolute inset-0 left-14 pointer-events-none">
            {hours.slice(0, -1).map((h) => (
              <div key={h} className="absolute w-full border-t border-border/40" style={{ top: (h - CALENDAR_START) * HOUR_HEIGHT }} />
            ))}
            {halfHours.filter(h => h % 1 !== 0).map((h, i) => (
              <div key={i} className="absolute w-full border-t border-border/20" style={{ top: (h - CALENDAR_START) * HOUR_HEIGHT }} />
            ))}
          </div>

          {/* Columns */}
          {visibleColumns.filter(c => c.isEtat).map((col, ci) => (
            <CalendarColumn
              key={col.employee.id}
              col={col}
              tasks={tasksByEmployee[col.employee.id] || []}
              schedulesByEmployee={schedulesByEmployee}
              workload={workload}
              dragOver={dragOver}
              onDragStart={onDragStart}
              onColDragOver={onColDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onResizeStart={onResizeStart}
              onClickTask={onClickTask}
              onClickEmptySlot={onClickEmptySlot}
              getApartmentName={getApartmentName}
              isLast={ci === visibleColumns.filter(c => c.isEtat).length - 1}
            />
          ))}

          {/* Separator between etat and hourly */}
          {visibleColumns.some(c => c.isEtat) && visibleColumns.some(c => !c.isEtat) && (
            <div className="w-px bg-border/60 shrink-0 z-10" />
          )}

          {visibleColumns.filter(c => !c.isEtat).map((col, ci) => (
            <CalendarColumn
              key={col.employee.id}
              col={col}
              tasks={tasksByEmployee[col.employee.id] || []}
              schedulesByEmployee={schedulesByEmployee}
              workload={workload}
              dragOver={dragOver}
              onDragStart={onDragStart}
              onColDragOver={onColDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onResizeStart={onResizeStart}
              onClickTask={onClickTask}
              onClickEmptySlot={onClickEmptySlot}
              getApartmentName={getApartmentName}
              isLast={false}
            />
          ))}
        </div>

        {/* Now line */}
        {isToday && nowPx >= 0 && nowPx <= TOTAL_HOURS * HOUR_HEIGHT && (
          <div
            className="absolute left-14 right-0 z-30 pointer-events-none"
            style={{ top: nowPx + 48 }}
          >
            <div className="flex items-center">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 -ml-1.5" />
              <div className="flex-1 h-px bg-red-500" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ColumnHeaderProps {
  col: CalendarColumnItem;
  schedulesByEmployee: ScheduleMap;
  workload: Workload;
}
function ColumnHeader({ col, schedulesByEmployee, workload }: ColumnHeaderProps) {
  const { employee, isEtat } = col;
  const schedule = schedulesByEmployee[employee.id]?.[0];
  const w = workload[employee.id];
  const isBusy = !isEtat && !!w?.taskCount;
  const label = isEtat
    ? (schedule ? `${schedule.startTime}–${schedule.endTime}` : "Brak zmiany")
    : (w?.taskCount ? `${w.taskCount} zad · ${formatMinutes(w.totalMinutes)}` : "wolny");

  return (
    <div className="flex-1 min-w-0 px-2 py-2 flex items-center gap-2 border-r border-border/30 last:border-r-0">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${isEtat ? "bg-blue-500" : "bg-orange-500"}`}>
        {initials(employee.firstName, employee.lastName)}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold truncate">{employee.firstName}</p>
        <p className={`text-[9px] truncate ${isBusy ? "text-orange-500" : "text-muted-foreground"}`}>
          {isBusy && <span>⚠️ </span>}{label}
        </p>
      </div>
    </div>
  );
}

interface CalendarColumnProps {
  col: CalendarColumnItem;
  tasks: TaskItem[];
  schedulesByEmployee: ScheduleMap;
  workload: Workload;
  dragOver: { employeeId: number; time: string } | null;
  onDragStart: (e: React.DragEvent, task: TaskItem, colEmployeeId: number) => void;
  onColDragOver: (e: React.DragEvent, employeeId: number) => void;
  onDrop: (e: React.DragEvent, employeeId: number) => void;
  onDragEnd: () => void;
  onResizeStart: (e: React.MouseEvent, task: TaskItem) => void;
  onClickTask: (e: React.MouseEvent, task: TaskItem) => void;
  onClickEmptySlot: (e: React.MouseEvent, employeeId: number, colEl: HTMLElement) => void;
  getApartmentName: (id: number | null) => string | null;
  isLast: boolean;
}
function CalendarColumn({
  col, tasks, schedulesByEmployee, workload, dragOver,
  onDragStart, onColDragOver, onDrop, onDragEnd, onResizeStart, onClickTask, onClickEmptySlot, getApartmentName,
  isLast
}: CalendarColumnProps) {
  const colRef = useRef<HTMLDivElement>(null);
  const { employee, isEtat } = col;
  const schedule = schedulesByEmployee[employee.id]?.[0];
  const isDragTarget = dragOver?.employeeId === employee.id;

  const shadeTop = schedule ? Math.max(0, timeToPixels(schedule.startTime)) : 0;
  const shadeBottom = schedule ? Math.max(0, TOTAL_HOURS * HOUR_HEIGHT - timeToPixels(schedule.endTime)) : 0;

  return (
    <div
      ref={colRef}
      className={`flex-1 min-w-0 relative border-r border-border/30 last:border-r-0 cursor-pointer ${isDragTarget ? "bg-blue-50/50 dark:bg-blue-950/10" : ""}`}
      onDragOver={(e) => onColDragOver(e, employee.id)}
      onDrop={(e) => onDrop(e, employee.id)}
      onDragEnd={onDragEnd}
      onClick={(e) => colRef.current && onClickEmptySlot(e, employee.id, colRef.current)}
    >
      {/* Out-of-shift shading for etat employees */}
      {isEtat && schedule && shadeTop > 0 && (
        <div className="absolute left-0 right-0 bg-muted/40 dark:bg-neutral-800/40 pointer-events-none" style={{ top: 0, height: shadeTop }} />
      )}
      {isEtat && schedule && shadeBottom > 0 && (
        <div className="absolute left-0 right-0 bg-muted/40 dark:bg-neutral-800/40 pointer-events-none" style={{ bottom: 0, height: shadeBottom }} />
      )}

      {/* Tasks */}
      {tasks.map((task: TaskItem) => {
        if (!task.startTime) return null;
        const top = timeToPixels(task.startTime);
        const bottom = task.endTime ? timeToPixels(task.endTime) : top + HOUR_HEIGHT;
        const height = Math.max(bottom - top, 30);
        const aptName = getApartmentName(task.apartmentId);
        const tileClass = PRIORITY_TILE[task.priority] || PRIORITY_TILE.NORMALNY;
        const prColor = PRIORITY_MAP[task.priority]?.bg || "bg-blue-500";
        return (
          <div
            key={task.id}
            data-task="true"
            draggable
            onDragStart={(e) => onDragStart(e, task, employee.id)}
            onClick={(e) => onClickTask(e, task)}
            className={`absolute left-1 right-1 rounded-lg border shadow-sm cursor-pointer select-none overflow-hidden ${tileClass} hover:brightness-95 transition-all`}
            style={{ top, height: Math.max(height, 28), zIndex: 10 }}
            data-testid={`tile-task-${task.id}`}
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${prColor} rounded-l-lg`} />
            <div className="pl-2 pr-1 py-0.5 h-full flex flex-col justify-start">
              <p className="text-[10px] font-semibold leading-tight truncate">{task.title}</p>
              {height > 40 && aptName && (
                <p className="text-[9px] text-muted-foreground truncate">{aptName}</p>
              )}
              {height > 28 && task.startTime && (
                <p className="text-[9px] text-muted-foreground">{task.startTime}{task.endTime ? `–${task.endTime}` : ""}</p>
              )}
            </div>
            {/* Resize handle */}
            <div
              className="absolute bottom-0 left-0 right-0 h-2 cursor-s-resize bg-transparent hover:bg-black/10 flex items-center justify-center"
              onMouseDown={(e) => onResizeStart(e, task)}
              data-testid={`resize-task-${task.id}`}
            >
              <div className="w-6 h-0.5 bg-current opacity-30 rounded" />
            </div>
          </div>
        );
      })}

      {/* Drag indicator */}
      {isDragTarget && dragOver && (
        <div
          className="absolute left-1 right-1 h-1 bg-blue-500 rounded pointer-events-none z-20"
          style={{ top: timeToPixels(dragOver.time) }}
        />
      )}
    </div>
  );
}

// ===== TASK POPOVER =====
interface TaskPopoverProps {
  task: TaskItem;
  employee: Employee | undefined;
  apartmentName: string | null;
  comments: CommentItem[] | undefined;
  commentsLoading: boolean;
  newComment: string;
  setNewComment: (v: string) => void;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
  onAddComment: () => void;
  deleteLoading: boolean;
  updateLoading: boolean;
}
function TaskPopover({
  task, employee, apartmentName, comments, commentsLoading, newComment, setNewComment,
  position, onClose, onEdit, onDelete, onStatusChange, onAddComment, deleteLoading, updateLoading
}: TaskPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const dateObj = new Date(task.date + "T12:00:00");
  const days = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
  const months = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
  const dateLabel = `${days[dateObj.getDay()]}, ${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
  const pr = PRIORITY_MAP[task.priority] || PRIORITY_MAP.NORMALNY;

  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const click = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("keydown", down);
    document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", down); document.removeEventListener("mousedown", click); };
  }, [onClose]);

  const left = position ? Math.min(position.left, window.innerWidth - 360) : 100;
  const top = position ? Math.max(8, Math.min(position.top, window.innerHeight - 520)) : 100;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-80 bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden"
      style={{ left, top }}
      data-testid="popover-task"
    >
      {/* Priority bar */}
      <div className={`h-1 w-full ${pr.bg}`} />
      <div className="p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-base leading-tight flex-1">{task.title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0" data-testid="button-close-popover">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Time */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            {task.startTime ? `${task.startTime}${task.endTime ? ` – ${task.endTime}` : ""}` : "Brak godziny"}
            {", "}
            {dateLabel}
          </span>
        </div>

        {/* Apartment */}
        {apartmentName && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>{apartmentName}</span>
          </div>
        )}

        {/* Employee */}
        {employee && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold ${employee.cooperationType === "ETAT" ? "bg-blue-500" : "bg-orange-500"}`}>
              {initials(employee.firstName, employee.lastName)}
            </div>
            <span>{employee.firstName} {employee.lastName}</span>
          </div>
        )}

        {/* Status pills */}
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(STATUS_MAP).map(([key, val]) => (
            <button
              key={key}
              onClick={() => onStatusChange(key)}
              className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${task.status === key ? `${val.color} border-current font-semibold` : "border-border text-muted-foreground hover:border-foreground"}`}
              data-testid={`pill-status-${key.toLowerCase()}`}
            >
              {val.label}
            </button>
          ))}
        </div>

        {/* Comments */}
        <div className="border-t pt-3">
          <h4 className="text-xs font-semibold flex items-center gap-1 mb-2"><MessageSquare className="h-3.5 w-3.5" /> Komentarze</h4>
          {commentsLoading ? (
            <div className="flex justify-center py-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /></div>
          ) : !comments?.length ? (
            <p className="text-[11px] text-muted-foreground">Brak komentarzy</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-28 overflow-y-auto">
              {comments.map((c: CommentItem) => (
                <div key={c.id} className="bg-muted/50 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium">{c.authorName}</span>
                    <span className="text-[9px] text-muted-foreground">{new Date(c.createdAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-[10px] mt-0.5">{c.content}</p>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Dodaj komentarz..."
              className="text-xs rounded-xl h-8"
              onKeyDown={(e) => { if (e.key === "Enter" && newComment.trim()) onAddComment(); }}
              data-testid="input-comment"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl shrink-0" onClick={onAddComment} disabled={!newComment.trim()} data-testid="button-send-comment">
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 border-t pt-3">
          <Button size="sm" variant="outline" className="rounded-xl flex-1 h-8 text-xs" onClick={onEdit} data-testid="button-edit-task">
            <Edit className="h-3.5 w-3.5 mr-1" /> Edytuj
          </Button>
          <Button size="icon" variant="destructive" className="h-8 w-8 rounded-xl shrink-0" onClick={onDelete} disabled={deleteLoading} data-testid="button-delete-task">
            {deleteLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ===== CATEGORY MANAGER DIALOG =====
const PRESET_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#64748b"];

function CategoryManagerDialog({
  open, onClose, categories, onAdd, onUpdate, onDelete, addPending, deletePending
}: {
  open: boolean; onClose: () => void;
  categories: CategoryItem[];
  onAdd: (name: string, color: string) => void;
  onUpdate: (id: number, name: string, color: string) => void;
  onDelete: (id: number) => void;
  addPending: boolean; deletePending: boolean;
}) {
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const { toast } = useToast();

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Kategoria już istnieje", variant: "destructive" }); return;
    }
    onAdd(trimmed, newColor);
    setNewName("");
  };

  const startEdit = (cat: CategoryItem) => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color); };
  const saveEdit = () => { if (editName.trim() && editingId != null) { onUpdate(editingId, editName.trim(), editColor); setEditingId(null); } };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Tags className="h-4 w-4" /> Kategorie zadań</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nazwa kategorii..." className="flex-1" onKeyDown={e => { if (e.key === "Enter") handleAdd(); }} data-testid="input-new-cat-name" />
            <Button size="sm" onClick={handleAdd} disabled={!newName.trim() || addPending} data-testid="button-add-category">
              {addPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_COLORS.map(c => (
              <button key={c} className={`w-6 h-6 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setNewColor(c)} data-testid={`color-preset-${c.replace('#', '')}`} />
            ))}
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Brak kategorii. Dodaj pierwszą.</p>
            ) : categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-card">
                {editingId === cat.id ? (
                  <>
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map(c => (
                        <button key={c} className={`w-5 h-5 rounded-full border-2 ${editColor === c ? "border-foreground" : "border-transparent"}`} style={{ backgroundColor: c }} onClick={() => setEditColor(c)} />
                      ))}
                    </div>
                    <Input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 h-8" onKeyDown={e => { if (e.key === "Enter") saveEdit(); }} data-testid={`input-edit-cat-${cat.id}`} />
                    <Button size="sm" variant="ghost" onClick={saveEdit} disabled={!editName.trim()} data-testid={`button-save-cat-${cat.id}`}><Check className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} data-testid={`button-cancel-cat-${cat.id}`}><X className="h-4 w-4" /></Button>
                  </>
                ) : (
                  <>
                    <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="flex-1 text-sm font-medium" data-testid={`text-cat-${cat.id}`}>{cat.name}</span>
                    <Button size="sm" variant="ghost" onClick={() => startEdit(cat)} data-testid={`button-edit-cat-${cat.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (window.confirm(`Usunąć kategorię "${cat.name}"?`)) onDelete(cat.id); }} disabled={deletePending} data-testid={`button-delete-cat-${cat.id}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===== TASK SHEET =====
interface TaskSheetProps {
  editingTask: TaskItem | null;
  formTitle: string; setFormTitle: (v: string) => void;
  formDesc: string; setFormDesc: (v: string) => void;
  formEmployee: string; setFormEmployee: (v: string) => void;
  formDate: string; setFormDate: (v: string) => void;
  formStart: string; setFormStart: (v: string) => void;
  formEnd: string; setFormEnd: (v: string) => void;
  formPriority: string; setFormPriority: (v: string) => void;
  formApartment: string; setFormApartment: (v: string) => void;
  formCategoryId: string; setFormCategoryId: (v: string) => void;
  categories: CategoryItem[];
  etatEmployees: Employee[];
  hourlyEmployees: Employee[];
  activeApartments: ApartmentItem[];
  schedulesByEmployee: ScheduleMap;
  workload: Workload;
  date: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onPreset: (apt: ApartmentItem) => void;
  isLoading: boolean;
}
function TaskSheet({
  editingTask, formTitle, setFormTitle, formDesc, setFormDesc, formEmployee, setFormEmployee,
  formDate, setFormDate, formStart, setFormStart, formEnd, setFormEnd, formPriority, setFormPriority,
  formApartment, setFormApartment, formCategoryId, setFormCategoryId, categories,
  etatEmployees, hourlyEmployees, activeApartments,
  schedulesByEmployee, workload, date, onClose, onSubmit, onPreset, isLoading
}: TaskSheetProps) {
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-background shadow-2xl flex flex-col" data-testid="sheet-task">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-bold text-lg">{editingTask ? "Edytuj zadanie" : "Nowe zadanie"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="button-close-sheet">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Apartment presets */}
          {!editingTask && activeApartments.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2">Szybkie presety sprzątania:</p>
              <div className="flex flex-wrap gap-1.5">
                {activeApartments.slice(0, 12).map((apt: ApartmentItem) => (
                  <button
                    key={apt.id}
                    type="button"
                    className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${formApartment === String(apt.id) && formTitle.startsWith("Sprzątanie") ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 hover:bg-muted border-border"}`}
                    onClick={() => onPreset(apt)}
                    data-testid={`button-preset-${apt.id}`}
                  >
                    {apt.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div><Label>Tytuł</Label><Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="np. Sprzątanie 204" data-testid="input-task-title" /></div>
            <div><Label>Opis (opcjonalnie)</Label><Textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="resize-none" rows={2} data-testid="input-task-desc" /></div>

            <div>
              <Label>Apartament (opcjonalnie)</Label>
              <Select value={formApartment} onValueChange={setFormApartment}>
                <SelectTrigger data-testid="select-task-apartment"><SelectValue placeholder="Wybierz apartament..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Brak —</SelectItem>
                  {activeApartments.map((a: ApartmentItem) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Smart Employee Picker */}
            <SmartEmployeePicker
              value={formEmployee}
              onChange={setFormEmployee}
              etatEmployees={etatEmployees}
              hourlyEmployees={hourlyEmployees}
              schedulesByEmployee={schedulesByEmployee}
              workload={workload}
              date={formDate || date}
            />

            <div><Label>Data</Label><Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} data-testid="input-task-date" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Od</Label><Input type="time" value={formStart} onChange={(e) => setFormStart(e.target.value)} data-testid="input-task-start" /></div>
              <div><Label>Do</Label><Input type="time" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} data-testid="input-task-end" /></div>
            </div>
            <div>
              <Label>Priorytet</Label>
              <Select value={formPriority} onValueChange={setFormPriority}>
                <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NISKI">Niski</SelectItem>
                  <SelectItem value="NORMALNY">Normalny</SelectItem>
                  <SelectItem value="WYSOKI">Wysoki</SelectItem>
                  <SelectItem value="PILNY">Pilny</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {categories.length > 0 && (
              <div>
                <Label>Kategoria (opcjonalnie)</Label>
                <Select value={formCategoryId || "none"} onValueChange={v => setFormCategoryId(v === "none" ? "" : v)}>
                  <SelectTrigger data-testid="select-task-category"><SelectValue placeholder="— Brak kategorii —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Brak kategorii —</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={String(cat.id)}>
                        <span className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                          {cat.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button type="submit" className="w-full mt-2" disabled={!formTitle || !formEmployee || isLoading} data-testid="button-submit-task">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTask ? "Zapisz zmiany" : "Utwórz zadanie"}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

// ===== SMART EMPLOYEE PICKER =====
function SmartEmployeePicker({
  value, onChange, etatEmployees, hourlyEmployees, schedulesByEmployee, workload, date
}: {
  value: string; onChange: (v: string) => void;
  etatEmployees: Employee[]; hourlyEmployees: Employee[];
  schedulesByEmployee: Record<number, WorkScheduleItem[]>;
  workload: Record<number, { taskCount: number; totalMinutes: number }>;
  date: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const etatWithShift = etatEmployees.filter(e => !!schedulesByEmployee[e.id]?.length);
  const etatWithout = etatEmployees.filter(e => !schedulesByEmployee[e.id]?.length);
  const sortedHourly = [...hourlyEmployees].sort((a, b) => {
    const wa = workload[a.id]?.taskCount || 0;
    const wb = workload[b.id]?.taskCount || 0;
    return wa - wb;
  });

  const selectedEmployee = [...etatEmployees, ...hourlyEmployees].find(e => String(e.id) === value);

  return (
    <div className="relative" ref={ref}>
      <Label>Pracownik</Label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 border border-input rounded-md px-3 h-10 text-sm bg-background hover:bg-muted/50 text-left mt-1"
        data-testid="select-task-employee"
      >
        {selectedEmployee ? (
          <>
            <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${selectedEmployee.cooperationType === "ETAT" ? "bg-blue-500" : "bg-orange-500"}`}>
              {initials(selectedEmployee.firstName, selectedEmployee.lastName)}
            </div>
            <span>{selectedEmployee.firstName} {selectedEmployee.lastName}</span>
          </>
        ) : (
          <span className="text-muted-foreground">Wybierz pracownika...</span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto">
          {etatWithShift.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold text-green-600 uppercase bg-green-50/50 dark:bg-green-950/20">Etatowi w pracy dziś</div>
              {etatWithShift.map(emp => {
                const shift = schedulesByEmployee[emp.id]?.[0];
                const w = workload[emp.id];
                return (
                  <EmployeePickerRow
                    key={emp.id}
                    emp={emp}
                    label={shift ? `${shift.startTime}–${shift.endTime}` : ""}
                    workloadLabel={w?.taskCount ? `${w.taskCount} zad` : ""}
                    dotColor="bg-green-500"
                    isEtat
                    isSelected={String(emp.id) === value}
                    onSelect={() => { onChange(String(emp.id)); setOpen(false); }}
                  />
                );
              })}
            </div>
          )}

          {etatWithout.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase bg-muted/30">Etatowi poza grafikiem</div>
              {etatWithout.map(emp => (
                <EmployeePickerRow
                  key={emp.id}
                  emp={emp}
                  label="Brak zmiany"
                  workloadLabel=""
                  dotColor="bg-slate-300"
                  isEtat
                  isSelected={String(emp.id) === value}
                  onSelect={() => { onChange(String(emp.id)); setOpen(false); }}
                  muted
                  warning="Brak zmiany w grafiku tego dnia"
                />
              ))}
            </div>
          )}

          {sortedHourly.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-bold text-orange-600 uppercase bg-orange-50/50 dark:bg-orange-950/20">Na godzinę</div>
              {sortedHourly.map(emp => {
                const w = workload[emp.id];
                const label = w?.taskCount ? `${w.taskCount} zad · ${formatMinutes(w.totalMinutes)}` : "wolny";
                const isBusy = !!w?.taskCount;
                return (
                  <EmployeePickerRow
                    key={emp.id}
                    emp={emp}
                    label={label}
                    workloadLabel=""
                    dotColor={isBusy ? "bg-orange-400" : "bg-green-500"}
                    isEtat={false}
                    isSelected={String(emp.id) === value}
                    onSelect={() => { onChange(String(emp.id)); setOpen(false); }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface EmployeePickerRowProps {
  emp: Employee;
  label: string;
  workloadLabel: string;
  dotColor: string;
  isEtat: boolean;
  isSelected: boolean;
  onSelect: () => void;
  muted?: boolean;
  warning?: string;
}
function EmployeePickerRow({ emp, label, workloadLabel, dotColor, isEtat, isSelected, onSelect, muted, warning }: EmployeePickerRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 transition-colors text-left ${isSelected ? "bg-muted" : ""} ${muted ? "opacity-60" : ""}`}
      data-testid={`option-employee-${emp.id}`}
    >
      <div className={`w-4 h-4 rounded-full shrink-0 ${dotColor}`} />
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold shrink-0 ${isEtat ? "bg-blue-500" : "bg-orange-500"}`}>
        {initials(emp.firstName, emp.lastName)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{emp.firstName} {emp.lastName}</p>
        {(label || workloadLabel) && (
          <p className="text-[10px] text-muted-foreground">{label}{workloadLabel ? ` · ${workloadLabel}` : ""}</p>
        )}
        {warning && <p className="text-[10px] text-amber-500">{warning}</p>}
      </div>
      {isSelected && <div className="w-2 h-2 rounded-full bg-primary shrink-0" />}
    </button>
  );
}
