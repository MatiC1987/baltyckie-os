import { format, parseISO, isToday, isThisWeek, isBefore, isTomorrow, isYesterday, startOfWeek, addDays, addWeeks, addMonths, startOfMonth, endOfMonth, getDay, getDate } from "date-fns";
import { pl } from "date-fns/locale";
import type { Task, TaskProject } from "@shared/schema";
import {
  Inbox, Star, CalendarDays, Layers, Sparkles, BookOpen, FolderOpen,
  Sun, AlertCircle, Users, CalendarRange,
} from "lucide-react";

export type ViewType = "inbox" | "today" | "tomorrow" | "upcoming" | "anytime" | "someday" | "priority" | "shared" | "logbook" | "calendar" | { projectId: number } | { area: string };

export type SettingsPage = "main" | "appearance" | "general" | "counter" | "today_settings" | "week_settings" | "plus_settings" | "font_size";

export const PRIORITY_FLAG_COLORS: Record<string, string> = {
  PILNY: "text-red-500",
  WYSOKI: "text-orange-500",
  ŚREDNI: "text-yellow-500",
  NISKI: "text-blue-400",
  BRAK: "text-muted-foreground/30",
};

export const PRIORITY_BORDER_COLORS: Record<string, string> = {
  PILNY: "#ef4444",
  WYSOKI: "#f97316",
  ŚREDNI: "#eab308",
  NISKI: "#60a5fa",
  BRAK: "#9ca3af",
};

export const PRIORITY_LABELS: Record<string, string> = {
  PILNY: "Pilny",
  WYSOKI: "Wysoki",
  ŚREDNI: "Średni",
  NISKI: "Niski",
  BRAK: "Brak",
};

export const PRIORITY_ORDER: Record<string, number> = {
  PILNY: 0, WYSOKI: 1, ŚREDNI: 2, NISKI: 3, BRAK: 4,
};

export const TAG_COLORS: Record<string, string> = {
  pilne: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  praca: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  dom: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  finanse: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  osobiste: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  zdrowie: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  nauka: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  zakupy: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

export const DEFAULT_TAG_COLOR = "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300";

export function getStoredShowCounts(): boolean {
  try { return localStorage.getItem("tasksShowCounts") !== "false"; } catch { return true; }
}

export function getStoredShowOverdueInToday(): boolean {
  try { return localStorage.getItem("tasksShowOverdueToday") !== "false"; } catch { return true; }
}

export function getStoredWeekStart(): 0 | 1 {
  try { return localStorage.getItem("tasksWeekStart") === "0" ? 0 : 1; } catch { return 1; }
}

export function getStoredDefaultProject(): string {
  try { return localStorage.getItem("tasksDefaultProject") || ""; } catch { return ""; }
}

export type TaskFontSize = "12" | "14" | "16" | "18";

export const FONT_SIZE_OPTIONS: { value: TaskFontSize; label: string }[] = [
  { value: "12", label: "Mały (12px)" },
  { value: "14", label: "Normalny (14px)" },
  { value: "16", label: "Duży (16px)" },
  { value: "18", label: "Bardzo duży (18px)" },
];

export function getStoredFontSize(): TaskFontSize {
  return (localStorage.getItem("tasks-font-size") as TaskFontSize) || "14";
}

export function getStoredDefaultPriority(): string {
  try { return localStorage.getItem("tasksDefaultPriority") || "BRAK"; } catch { return "BRAK"; }
}

export function isOverdue(task: Task): boolean {
  if (task.completed || !task.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseISO(task.dueDate);
  return isBefore(due, today);
}

export function isDeadlineNear(task: Task): "passed" | "urgent" | "warning" | null {
  if (task.completed || !task.deadlineDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = parseISO(task.deadlineDate);
  if (isBefore(deadline, today)) return "passed";
  const diff = (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 1) return "urgent";
  if (diff <= 3) return "warning";
  return null;
}

export function getTagColor(tag: string): string {
  return TAG_COLORS[tag.toLowerCase()] || DEFAULT_TAG_COLOR;
}

export function filterTasks(tasks: Task[], view: ViewType, weekStart: 0 | 1, showOverdueInToday: boolean, currentUserId?: string): Task[] {
  if (view === "inbox") return tasks.filter((t) => !t.projectId && !t.completed && t.parentTaskId === null && !t.someday);
  if (view === "today") {
    return tasks.filter((t) => {
      if (t.completed) return false;
      if (t.parentTaskId !== null) return false;
      if (t.someday) return false;
      if (t.dueDate && isToday(parseISO(t.dueDate))) return true;
      if (t.deadlineDate && isToday(parseISO(t.deadlineDate))) return true;
      if (showOverdueInToday && isOverdue(t)) return true;
      return false;
    });
  }
  if (view === "tomorrow") {
    return tasks.filter((t) => {
      if (t.completed) return false;
      if (t.parentTaskId !== null) return false;
      if (t.someday) return false;
      if (!t.dueDate) return false;
      return isTomorrow(parseISO(t.dueDate));
    });
  }
  if (view === "upcoming") {
    return tasks.filter((t) => {
      if (t.completed) return false;
      if (t.parentTaskId !== null) return false;
      if (t.someday) return false;
      if (!t.dueDate) return false;
      const d = parseISO(t.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return !isBefore(d, today);
    });
  }
  if (view === "anytime") {
    return tasks.filter((t) => {
      if (t.completed) return false;
      if (t.parentTaskId !== null) return false;
      if (t.someday) return false;
      if (t.projectId) return true;
      return false;
    });
  }
  if (view === "someday") return tasks.filter((t) => t.someday && !t.completed && t.parentTaskId === null);
  if (view === "priority") return tasks.filter((t) => !t.completed && t.priority && t.priority !== "BRAK" && t.parentTaskId === null && !t.someday);
  if (view === "shared") {
    return tasks.filter((t) => !t.completed && t.parentTaskId === null && currentUserId && (t.sharedWith || []).includes(currentUserId) && t.userId !== currentUserId);
  }
  if (view === "calendar") return tasks.filter((t) => !t.completed && t.parentTaskId === null && t.dueDate);
  if (view === "logbook") return tasks.filter((t) => t.completed).sort((a, b) => {
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bTime - aTime;
  });
  if (typeof view === "object" && "area" in view) {
    const areaName = (view as { area: string }).area;
    return tasks.filter((t) => !t.completed && t.parentTaskId === null && t.area === areaName);
  }
  return tasks.filter((t) => t.projectId === (view as { projectId: number }).projectId && !t.completed && t.parentTaskId === null);
}

export function getProjectCompletedTasks(tasks: Task[], projectId: number): Task[] {
  return tasks
    .filter((t) => t.projectId === projectId && t.completed && t.parentTaskId === null)
    .sort((a, b) => {
      const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
      const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
      return bTime - aTime;
    });
}

export function getProjectLaterTasks(activeTasks: Task[]): Task[] {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return activeTasks.filter((t) => t.dueDate && parseISO(t.dueDate) > today);
}

export function getProjectHideLater(projectId: number): boolean {
  return localStorage.getItem(`tasks-project-${projectId}-hideLater`) === "true";
}

export function setProjectHideLater(projectId: number, value: boolean) {
  localStorage.setItem(`tasks-project-${projectId}-hideLater`, String(value));
}

export function getProjectShowLogged(projectId: number): boolean {
  return localStorage.getItem(`tasks-project-${projectId}-showLogged`) === "true";
}

export function setProjectShowLogged(projectId: number, value: boolean) {
  localStorage.setItem(`tasks-project-${projectId}-showLogged`, String(value));
}

export function sortTasks(tasks: Task[], sortBy: string): Task[] {
  if (sortBy === "manual") return [...tasks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (sortBy === "dueDate") return [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
  if (sortBy === "priority") return [...tasks].sort((a, b) => (PRIORITY_ORDER[a.priority || "BRAK"] ?? 4) - (PRIORITY_ORDER[b.priority || "BRAK"] ?? 4));
  if (sortBy === "createdAt") return [...tasks].sort((a, b) => {
    const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bT - aT;
  });
  if (sortBy === "alpha") return [...tasks].sort((a, b) => a.title.localeCompare(b.title, "pl"));
  return tasks;
}

export function viewLabel(view: ViewType, projects: TaskProject[]): string {
  if (view === "inbox") return "Inbox";
  if (view === "today") return "Today";
  if (view === "tomorrow") return "Jutro";
  if (view === "upcoming") return "Upcoming";
  if (view === "anytime") return "Anytime";
  if (view === "someday") return "Someday";
  if (view === "priority") return "Priorytetowe";
  if (view === "shared") return "Udostępnione mi";
  if (view === "logbook") return "Logbook";
  if (view === "calendar") return "Kalendarz";
  if (typeof view === "object" && "area" in view) return view.area;
  const p = projects.find((pr) => pr.id === (view as { projectId: number }).projectId);
  return p?.name || "Projekt";
}

export function viewIcon(view: ViewType) {
  if (view === "inbox") return Inbox;
  if (view === "today") return Star;
  if (view === "tomorrow") return Sun;
  if (view === "upcoming") return CalendarDays;
  if (view === "anytime") return Layers;
  if (view === "someday") return Sparkles;
  if (view === "priority") return AlertCircle;
  if (view === "shared") return Users;
  if (view === "logbook") return BookOpen;
  if (view === "calendar") return CalendarRange;
  if (typeof view === "object" && "area" in view) return Layers;
  return FolderOpen;
}

export interface SmartView {
  key: string;
  view: ViewType;
  icon: any;
  label: string;
  color: string;
  showCount?: boolean;
}

export const SMART_VIEWS: SmartView[] = [
  { key: "inbox", view: "inbox", icon: Inbox, label: "Inbox", color: "#5ADBFA", showCount: true },
  { key: "today", view: "today", icon: Star, label: "Today", color: "#FFD43B", showCount: true },
  { key: "upcoming", view: "upcoming", icon: CalendarDays, label: "Upcoming", color: "#51CF66" },
  { key: "anytime", view: "anytime", icon: Layers, label: "Anytime", color: "#4ECDC4" },
  { key: "someday", view: "someday", icon: Sparkles, label: "Someday", color: "#C4B5FD" },
  { key: "logbook", view: "logbook", icon: BookOpen, label: "Logbook", color: "#868E96" },
  { key: "calendar", view: "calendar", icon: CalendarRange, label: "Kalendarz", color: "#FF6B6B" },
];

export interface UpcomingGroup {
  key: string;
  label: string;
  date?: string;
  dayNumber?: number;
  dayName?: string;
  isRange?: boolean;
  tasks: Task[];
}

export function buildUpcomingGroups(tasks: Task[]): UpcomingGroup[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const groups: UpcomingGroup[] = [];

  for (let i = 0; i < 7; i++) {
    const d = addDays(today, i);
    const key = format(d, "yyyy-MM-dd");
    const dayTasks = tasks.filter(t => t.dueDate === key);
    let dayName: string;
    if (i === 0) dayName = "Today";
    else if (i === 1) dayName = "Tomorrow";
    else dayName = format(d, "EEEE", { locale: pl });
    groups.push({
      key,
      label: dayName,
      date: key,
      dayNumber: getDate(d),
      dayName,
      tasks: dayTasks,
    });
  }

  const endOfNext7 = addDays(today, 7);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const lastDayOfMonth = endOfMonth(today);

  if (lastDayOfMonth >= endOfNext7) {
    const rangeTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      const d = parseISO(t.dueDate);
      return d >= endOfNext7 && d <= lastDayOfMonth;
    });
    if (rangeTasks.length > 0) {
      const rangeLabel = `${format(today, "MMMM", { locale: pl })} ${format(endOfNext7, "d")}–${format(lastDayOfMonth, "d")}`;
      groups.push({
        key: "rest-of-month",
        label: rangeLabel,
        isRange: true,
        tasks: rangeTasks,
      });
    }
  }

  for (let m = 1; m <= 6; m++) {
    const monthDate = addMonths(today, m);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const monthTasks = tasks.filter(t => {
      if (!t.dueDate) return false;
      const d = parseISO(t.dueDate);
      return d >= monthStart && d <= monthEnd;
    });
    if (monthTasks.length > 0) {
      groups.push({
        key: `month-${m}`,
        label: format(monthDate, "LLLL", { locale: pl }),
        isRange: true,
        tasks: monthTasks,
      });
    }
  }

  const lastGroupEnd = addMonths(today, 7);
  const laterTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    const d = parseISO(t.dueDate);
    return d >= lastGroupEnd;
  });
  if (laterTasks.length > 0) {
    groups.push({
      key: "later",
      label: "Later",
      isRange: true,
      tasks: laterTasks,
    });
  }

  return groups;
}

export interface AnytimeGroup {
  projectId: number;
  projectName: string;
  projectColor: string;
  tasks: Task[];
}

export function buildAnytimeGroups(tasks: Task[], projects: TaskProject[]): AnytimeGroup[] {
  const projectMap = new Map<number, TaskProject>();
  projects.forEach(p => projectMap.set(p.id, p));

  const grouped = new Map<number, Task[]>();
  tasks.forEach(t => {
    if (!t.projectId) return;
    const arr = grouped.get(t.projectId) || [];
    arr.push(t);
    grouped.set(t.projectId, arr);
  });

  const result: AnytimeGroup[] = [];
  grouped.forEach((groupTasks, projectId) => {
    const project = projectMap.get(projectId);
    if (!project) return;
    result.push({
      projectId,
      projectName: project.name,
      projectColor: project.color || "#5ADBFA",
      tasks: groupTasks,
    });
  });

  return result.sort((a, b) => a.projectName.localeCompare(b.projectName, "pl"));
}

export function computeSidebarCounts(
  tasks: Task[],
  weekStart: 0 | 1,
  showOverdueInToday: boolean,
  currentUserId?: string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const sv of SMART_VIEWS) {
    if (sv.showCount) {
      counts[sv.key] = filterTasks(tasks, sv.view, weekStart, showOverdueInToday, currentUserId).length;
    }
  }
  return counts;
}
