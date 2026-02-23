import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, isToday, isThisWeek, isBefore, isTomorrow, isYesterday, startOfWeek, addDays, getDay } from "date-fns";
import { pl } from "date-fns/locale";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { Task, TaskProject, TaskSection, TaskChecklistItem } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
  Inbox, CalendarDays, Star, Plus, Trash2,
  Calendar, Tag, ChevronDown, ChevronRight, Circle,
  PanelLeftClose, PanelLeft, MoreHorizontal, ArrowRight,
  Copy, RefreshCw, FolderPlus, Settings, X,
  SlidersHorizontal, GripVertical, Sun, Moon, Monitor,
  ListPlus, FolderOpen, Clock, AlertCircle, Flag,
  BookOpen, Archive, Check, ChevronUp, Users, Menu,
  Pencil,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type ViewType = "inbox" | "today" | "tomorrow" | "week" | "priority" | "shared" | "logbook" | { projectId: number };

type SettingsPage = "main" | "appearance" | "general" | "counter" | "today_settings" | "week_settings" | "plus_settings";

const PRIORITY_FLAG_COLORS: Record<string, string> = {
  PILNY: "text-red-500",
  WYSOKI: "text-orange-500",
  ŚREDNI: "text-yellow-500",
  NISKI: "text-blue-400",
  BRAK: "text-muted-foreground/30",
};

const PRIORITY_LABELS: Record<string, string> = {
  PILNY: "Pilny",
  WYSOKI: "Wysoki",
  ŚREDNI: "Średni",
  NISKI: "Niski",
  BRAK: "Brak",
};

const PRIORITY_ORDER: Record<string, number> = {
  PILNY: 0, WYSOKI: 1, ŚREDNI: 2, NISKI: 3, BRAK: 4,
};

const TAG_COLORS: Record<string, string> = {
  pilne: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  praca: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  dom: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  finanse: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  osobiste: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  zdrowie: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  nauka: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  zakupy: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const DEFAULT_TAG_COLOR = "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300";

function getStoredShowCounts(): boolean {
  try { return localStorage.getItem("tasksShowCounts") !== "false"; } catch { return true; }
}

function getStoredShowOverdueInToday(): boolean {
  try { return localStorage.getItem("tasksShowOverdueToday") !== "false"; } catch { return true; }
}

function getStoredWeekStart(): 0 | 1 {
  try { return localStorage.getItem("tasksWeekStart") === "0" ? 0 : 1; } catch { return 1; }
}

function getStoredDefaultProject(): string {
  try { return localStorage.getItem("tasksDefaultProject") || ""; } catch { return ""; }
}

function getStoredDefaultPriority(): string {
  try { return localStorage.getItem("tasksDefaultPriority") || "BRAK"; } catch { return "BRAK"; }
}

function isOverdue(task: Task): boolean {
  if (task.completed || !task.dueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseISO(task.dueDate);
  return isBefore(due, today);
}

function getTagColor(tag: string): string {
  return TAG_COLORS[tag.toLowerCase()] || DEFAULT_TAG_COLOR;
}

function filterTasks(tasks: Task[], view: ViewType, weekStart: 0 | 1, showOverdueInToday: boolean, currentUserId?: string): Task[] {
  if (view === "inbox") return tasks.filter((t) => !t.projectId && !t.completed && t.parentTaskId === null);
  if (view === "today") {
    return tasks.filter((t) => {
      if (t.completed) return false;
      if (t.parentTaskId !== null) return false;
      if (!t.dueDate) return false;
      const d = parseISO(t.dueDate);
      if (isToday(d)) return true;
      if (showOverdueInToday && isOverdue(t)) return true;
      return false;
    });
  }
  if (view === "tomorrow") {
    return tasks.filter((t) => {
      if (t.completed) return false;
      if (t.parentTaskId !== null) return false;
      if (!t.dueDate) return false;
      return isTomorrow(parseISO(t.dueDate));
    });
  }
  if (view === "week") {
    return tasks.filter((t) => {
      if (t.completed) return false;
      if (t.parentTaskId !== null) return false;
      if (!t.dueDate) return false;
      return isThisWeek(parseISO(t.dueDate), { weekStartsOn: weekStart });
    });
  }
  if (view === "priority") return tasks.filter((t) => !t.completed && t.priority && t.priority !== "BRAK" && t.parentTaskId === null);
  if (view === "shared") {
    return tasks.filter((t) => !t.completed && t.parentTaskId === null && currentUserId && (t.sharedWith || []).includes(currentUserId) && t.userId !== currentUserId);
  }
  if (view === "logbook") return tasks.filter((t) => t.completed).sort((a, b) => {
    const aTime = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const bTime = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return bTime - aTime;
  });
  return tasks.filter((t) => t.projectId === view.projectId && !t.completed && t.parentTaskId === null);
}

function sortTasks(tasks: Task[], sortBy: string): Task[] {
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

function viewLabel(view: ViewType, projects: TaskProject[]): string {
  if (view === "inbox") return "Odebrane";
  if (view === "today") return "Dziś";
  if (view === "tomorrow") return "Jutro";
  if (view === "week") return "W tym tygodniu";
  if (view === "priority") return "Priorytetowe";
  if (view === "shared") return "Udostępnione mi";
  if (view === "logbook") return "Logbook";
  const p = projects.find((pr) => pr.id === view.projectId);
  return p?.name || "Projekt";
}

function viewIcon(view: ViewType) {
  if (view === "inbox") return Inbox;
  if (view === "today") return Star;
  if (view === "tomorrow") return Sun;
  if (view === "week") return Calendar;
  if (view === "priority") return AlertCircle;
  if (view === "shared") return Users;
  if (view === "logbook") return BookOpen;
  return FolderOpen;
}

function SortableTaskRow({ id, children, disabled }: { id: string; children: (listeners: Record<string, any> | undefined, isDragging: boolean) => React.ReactNode; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners, isDragging)}
    </div>
  );
}

function SortableSectionItem({ id, children }: { id: string; children: (listeners: Record<string, any> | undefined) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners)}
    </div>
  );
}

function SortableProjectItem({ id, children }: { id: string; children: (listeners: Record<string, any> | undefined) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners)}
    </div>
  );
}

export default function Tasks() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [view, setView] = useState<ViewType>("inbox");
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [inlineAddVisible, setInlineAddVisible] = useState(false);
  const [inlineTitle, setInlineTitle] = useState("");
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [showCounts, setShowCounts] = useState(getStoredShowCounts);
  const [showOverdueInToday, setShowOverdueInToday] = useState(getStoredShowOverdueInToday);
  const [weekStart, setWeekStart] = useState<0 | 1>(getStoredWeekStart);
  const [sortBy, setSortBy] = useState<string>("manual");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [renamingSectionId, setRenamingSectionId] = useState<number | null>(null);
  const [renamingSectionName, setRenamingSectionName] = useState("");
  const renameSectionInputRef = useRef<HTMLInputElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  useEffect(() => {
    if (renamingSectionId !== null && renameSectionInputRef.current) {
      renameSectionInputRef.current.focus();
      renameSectionInputRef.current.select();
    }
  }, [renamingSectionId]);

  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: projects = [] } = useQuery<TaskProject[]>({ queryKey: ["/api/task-projects"] });
  const { data: sections = [] } = useQuery<TaskSection[]>({ queryKey: ["/api/task-sections"] });
  const { data: allUsers = [] } = useQuery<{ id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null }[]>({ queryKey: ["/api/all-users"] });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sidebarSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const toggleComplete = useMutation({
    mutationFn: (task: Task) =>
      apiRequest("PATCH", `/api/tasks/${task.id}`, {
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toISOString() : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/tasks/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Zadanie usunięte" });
    },
  });

  const createTask = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setInlineTitle("");
    },
  });

  const duplicateTask = useMutation({
    mutationFn: (taskId: number) => apiRequest("POST", `/api/tasks/${taskId}/duplicate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Zadanie zduplikowane" });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: number[]) => apiRequest("POST", "/api/tasks/bulk-delete", { ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedTasks(new Set());
      toast({ title: "Zadania usunięte" });
    },
  });

  const bulkMove = useMutation({
    mutationFn: (data: { ids: number[]; projectId: number | null; sectionId: number | null }) =>
      apiRequest("POST", "/api/tasks/bulk-move", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedTasks(new Set());
      setMoveDialogOpen(false);
      toast({ title: "Zadania przeniesione" });
    },
  });

  const createProject = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/task-projects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-projects"] });
      setAddProjectOpen(false);
      toast({ title: "Projekt utworzony" });
    },
  });

  const updateProject = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/task-projects/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/task-projects"] }),
  });

  const deleteProject = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/task-projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Projekt usunięty" });
    },
  });

  const createSection = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/task-sections", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-sections"] });
      setAddSectionOpen(false);
      toast({ title: "Sekcja utworzona" });
    },
  });

  const updateSection = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/task-sections/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/task-sections"] }),
  });

  const deleteSection = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/task-sections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Sekcja usunięta" });
    },
  });

  const batchReorderTasks = useMutation({
    mutationFn: (items: { id: number; sortOrder: number; sectionId?: number | null }[]) =>
      apiRequest("POST", "/api/tasks/batch-reorder", { items }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const batchReorderSections = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("POST", "/api/task-sections/batch-reorder", { items }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/task-sections"] }),
  });

  const batchReorderProjects = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("POST", "/api/task-projects/batch-reorder", { items }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/task-projects"] }),
  });

  const filtered = useMemo(
    () => filterTasks(tasks, view, weekStart, showOverdueInToday, user?.id),
    [tasks, view, weekStart, showOverdueInToday, user?.id]
  );

  const isProjectView = typeof view === "object";
  const projectSections = isProjectView ? sections.filter((s) => s.projectId === view.projectId) : [];

  const childTasksMap = useMemo(() => {
    const map = new Map<number, Task[]>();
    tasks.forEach((t) => {
      if (t.parentTaskId !== null) {
        const arr = map.get(t.parentTaskId) || [];
        arr.push(t);
        map.set(t.parentTaskId, arr);
      }
    });
    return map;
  }, [tasks]);

  const toggleSection = (id: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleArea = (area: string) => {
    setCollapsedAreas((prev) => {
      const next = new Set(prev);
      next.has(area) ? next.delete(area) : next.add(area);
      return next;
    });
  };

  const toggleExpand = (taskId: number) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const archivedProjects = useMemo(() => projects.filter((p) => p.archived), [projects]);
  const areas = useMemo(
    () => Array.from(new Set(activeProjects.map((p) => p.area || "").filter(Boolean))),
    [activeProjects]
  );
  const ungroupedProjects = useMemo(
    () => activeProjects.filter((p) => !p.area).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [activeProjects]
  );

  const smartViews = useMemo(
    () => [
      { key: "inbox", view: "inbox" as ViewType, icon: Inbox, label: "Odebrane", color: "#5ADBFA" },
      { key: "today", view: "today" as ViewType, icon: Star, label: "Dziś", color: "#FFD43B" },
      { key: "tomorrow", view: "tomorrow" as ViewType, icon: Sun, label: "Jutro", color: "#FF922B" },
      { key: "week", view: "week" as ViewType, icon: Calendar, label: "W tym tygodniu", color: "#51CF66" },
      { key: "priority", view: "priority" as ViewType, icon: AlertCircle, label: "Priorytetowe", color: "#FF6B6B" },
      { key: "shared", view: "shared" as ViewType, icon: Users, label: "Udostępnione mi", color: "#9775FA" },
      { key: "logbook", view: "logbook" as ViewType, icon: BookOpen, label: "Logbook", color: "#868E96" },
    ],
    []
  );

  const isActive = useCallback(
    (v: ViewType) => {
      if (typeof view === "object" && typeof v === "object") return view.projectId === v.projectId;
      return view === v;
    },
    [view]
  );

  const overdueCount = useMemo(
    () => tasks.filter((t) => isOverdue(t)).length,
    [tasks]
  );

  const clearSelection = useCallback(() => {
    setSelectedTasks(new Set());
  }, []);

  const handleViewChange = useCallback((newView: ViewType) => {
    setView(newView);
    setSelectedTasks(new Set());
    setDetailTask(null);
    if (isMobile) setSidebarCollapsed(true);
  }, [isMobile]);

  const handleInlineSubmit = useCallback(() => {
    if (!inlineTitle.trim()) return;
    const data: Record<string, unknown> = {
      title: inlineTitle.trim(),
      priority: getStoredDefaultPriority(),
      tags: [],
      projectId: isProjectView ? (view as { projectId: number }).projectId : (getStoredDefaultProject() ? Number(getStoredDefaultProject()) : null),
      sectionId: null,
    };
    createTask.mutate(data);
  }, [inlineTitle, isProjectView, view, createTask]);

  const handleInlineKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleInlineSubmit();
      }
      if (e.key === "Escape") {
        setInlineAddVisible(false);
        setInlineTitle("");
      }
    },
    [handleInlineSubmit]
  );

  useEffect(() => {
    if (inlineAddVisible && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [inlineAddVisible]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setAddTaskOpen(true);
      }
      if (e.key === "t" || e.key === "T") {
        if (selectedTasks.size === 1) {
          const taskId = Array.from(selectedTasks)[0];
          updateTask.mutate({ id: taskId, data: { dueDate: format(new Date(), "yyyy-MM-dd") } });
          toast({ title: "Termin ustawiony na dziś" });
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedTasks.size > 0) {
          e.preventDefault();
          setDeleteConfirmOpen(true);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        if (selectedTasks.size === 1) {
          e.preventDefault();
          duplicateTask.mutate(Array.from(selectedTasks)[0]);
        }
      }
      if (e.key === "Escape") {
        if (detailTask) {
          setDetailTask(null);
        } else {
          clearSelection();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedTasks, detailTask, updateTask, duplicateTask, toast, clearSelection]);

  const handleTaskClick = useCallback(
    (task: Task) => {
      setSelectedTasks(new Set([task.id]));
      setDetailTask(task);
    },
    []
  );

  const handleSectionRenameSubmit = useCallback((sectionId: number) => {
    if (renamingSectionName.trim()) {
      updateSection.mutate({ id: sectionId, data: { name: renamingSectionName.trim() } });
    }
    setRenamingSectionId(null);
    setRenamingSectionName("");
  }, [renamingSectionName, updateSection]);

  const activeDragData = useMemo(() => {
    if (!activeDragId) return null;
    if (activeDragId.startsWith("task-")) {
      const taskId = Number(activeDragId.replace("task-", ""));
      return { type: "task" as const, item: tasks.find(t => t.id === taskId) };
    }
    if (activeDragId.startsWith("section-")) {
      const sectionId = Number(activeDragId.replace("section-", ""));
      return { type: "section" as const, item: sections.find(s => s.id === sectionId) };
    }
    return null;
  }, [activeDragId, tasks, sections]);

  const handleMainDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleMainDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("task-") && overId.startsWith("task-")) {
      const activeTaskId = Number(activeId.replace("task-", ""));
      const overTaskId = Number(overId.replace("task-", ""));

      const sortedFiltered = sortTasks(filtered, sortBy);

      if (isProjectView) {
        const activeTask = tasks.find(t => t.id === activeTaskId);
        const overTask = tasks.find(t => t.id === overTaskId);
        if (!activeTask || !overTask) return;

        const activeSectionId = activeTask.sectionId;
        const overSectionId = overTask.sectionId;

        if (activeSectionId === overSectionId) {
          const sectionTasks = sortTasks(
            filtered.filter(t => t.sectionId === activeSectionId),
            sortBy
          );
          const oldIdx = sectionTasks.findIndex(t => t.id === activeTaskId);
          const newIdx = sectionTasks.findIndex(t => t.id === overTaskId);
          if (oldIdx === -1 || newIdx === -1) return;
          const reordered = arrayMove(sectionTasks, oldIdx, newIdx);
          batchReorderTasks.mutate(
            reordered.map((t, i) => ({ id: t.id, sortOrder: i }))
          );
        } else {
          const targetSectionTasks = sortTasks(
            filtered.filter(t => t.sectionId === overSectionId),
            sortBy
          );
          const overIdx = targetSectionTasks.findIndex(t => t.id === overTaskId);
          const newSectionTasks = [...targetSectionTasks];
          const movedTask = { ...activeTask, sectionId: overSectionId };
          newSectionTasks.splice(overIdx, 0, movedTask as Task);
          batchReorderTasks.mutate(
            newSectionTasks.map((t, i) => ({
              id: t.id,
              sortOrder: i,
              ...(t.id === activeTaskId ? { sectionId: overSectionId } : {}),
            }))
          );
        }
      } else {
        const oldIdx = sortedFiltered.findIndex(t => t.id === activeTaskId);
        const newIdx = sortedFiltered.findIndex(t => t.id === overTaskId);
        if (oldIdx === -1 || newIdx === -1) return;
        const reordered = arrayMove(sortedFiltered, oldIdx, newIdx);
        batchReorderTasks.mutate(
          reordered.map((t, i) => ({ id: t.id, sortOrder: i }))
        );
      }
      return;
    }

    if (activeId.startsWith("section-") && overId.startsWith("section-")) {
      const activeSectionId = Number(activeId.replace("section-", ""));
      const overSectionId = Number(overId.replace("section-", ""));
      const sorted = [...projectSections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const oldIdx = sorted.findIndex(s => s.id === activeSectionId);
      const newIdx = sorted.findIndex(s => s.id === overSectionId);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(sorted, oldIdx, newIdx);
      batchReorderSections.mutate(
        reordered.map((s, i) => ({ id: s.id, sortOrder: i }))
      );
      return;
    }
  }, [filtered, sortBy, isProjectView, tasks, projectSections, batchReorderTasks, batchReorderSections]);

  const handleSidebarDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("project-") && overId.startsWith("project-")) {
      const activeProjectId = Number(activeId.replace("project-", ""));
      const overProjectId = Number(overId.replace("project-", ""));
      const sorted = [...ungroupedProjects];
      const oldIdx = sorted.findIndex(p => p.id === activeProjectId);
      const newIdx = sorted.findIndex(p => p.id === overProjectId);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(sorted, oldIdx, newIdx);
      batchReorderProjects.mutate(
        reordered.map((p, i) => ({ id: p.id, sortOrder: i }))
      );
    }
  }, [ungroupedProjects, batchReorderProjects]);

  const VIcon = viewIcon(view);
  const selectedTasksArray = Array.from(selectedTasks);

  const todayGrouped = useMemo(() => {
    if (view !== "today") return null;
    const overdue: Task[] = [];
    const today: Task[] = [];
    filtered.forEach((t) => {
      if (t.dueDate && isOverdue(t)) overdue.push(t);
      else today.push(t);
    });
    return { overdue, today };
  }, [view, filtered]);

  const weekGrouped = useMemo(() => {
    if (view !== "week") return null;
    const days: Record<string, Task[]> = {};
    const ws = startOfWeek(new Date(), { weekStartsOn: weekStart });
    for (let i = 0; i < 7; i++) {
      const d = addDays(ws, i);
      const key = format(d, "yyyy-MM-dd");
      days[key] = [];
    }
    filtered.forEach((t) => {
      if (t.dueDate) {
        const key = t.dueDate;
        if (!days[key]) days[key] = [];
        days[key].push(t);
      }
    });
    return Object.entries(days)
      .filter(([, arr]) => arr.length > 0)
      .map(([dateStr, arr]) => ({
        date: dateStr,
        label: format(parseISO(dateStr), "EEEE, d MMMM", { locale: pl }),
        tasks: arr,
      }));
  }, [view, filtered, weekStart]);

  const priorityGrouped = useMemo(() => {
    if (view !== "priority") return null;
    const groups: Record<string, Task[]> = { PILNY: [], WYSOKI: [], "ŚREDNI": [], NISKI: [] };
    filtered.forEach((t) => {
      if (t.priority && groups[t.priority]) groups[t.priority].push(t);
    });
    return Object.entries(groups).filter(([, arr]) => arr.length > 0);
  }, [view, filtered]);

  const logbookGrouped = useMemo(() => {
    if (view !== "logbook") return null;
    const today: Task[] = [];
    const yesterday: Task[] = [];
    const older: Task[] = [];
    filtered.forEach((t) => {
      if (t.completedAt) {
        const d = new Date(t.completedAt);
        if (isToday(d)) today.push(t);
        else if (isYesterday(d)) yesterday.push(t);
        else older.push(t);
      } else {
        older.push(t);
      }
    });
    const groups: { label: string; tasks: Task[] }[] = [];
    if (today.length) groups.push({ label: "Dzisiaj", tasks: today });
    if (yesterday.length) groups.push({ label: "Wczoraj", tasks: yesterday });
    if (older.length) groups.push({ label: "Starsze", tasks: older });
    return groups;
  }, [view, filtered]);

  const renderTaskRow = useCallback(
    (t: Task, indent = 0, dragListeners?: Record<string, any> | undefined) => {
      const children = childTasksMap.get(t.id) || [];
      const hasChildren = children.length > 0;
      const isExpanded = expandedTasks.has(t.id);
      const overdue = isOverdue(t);
      const isLogbook = view === "logbook";
      const isDueToday = t.dueDate && !t.completed && isToday(parseISO(t.dueDate));
      const isDueTomorrow = t.dueDate && !t.completed && isTomorrow(parseISO(t.dueDate));

      return (
        <div key={t.id}>
          <motion.div
            layout
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: t.completed && !isLogbook ? 0.6 : 1, y: 0 }}
            exit={{ opacity: 0, x: -20, transition: { duration: 0.3 } }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`flex items-center gap-3 px-5 py-3.5 group transition-all duration-200 cursor-pointer border-b border-border/40 ${
              selectedTasks.has(t.id) ? "bg-primary/5 border-l-2 border-l-primary" : overdue ? "bg-red-50/50 dark:bg-red-950/20" : isDueToday ? "bg-orange-50/30 dark:bg-orange-950/10" : isDueTomorrow ? "bg-yellow-50/30 dark:bg-yellow-950/10" : "hover-elevate"
            }`}
            style={{ paddingLeft: `${20 + indent * 28}px` }}
            onClick={() => handleTaskClick(t)}
            data-testid={`task-row-${t.id}`}
          >
            <div
              className="opacity-0 group-hover:opacity-100 cursor-grab transition-opacity duration-150 -ml-1"
              data-testid={`drag-handle-${t.id}`}
              {...(dragListeners || {})}
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
            </div>

            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(t.id);
                }}
                className="p-0.5 rounded-full hover-elevate"
                data-testid={`button-expand-${t.id}`}
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            )}

            <Checkbox
              checked={!!t.completed}
              onCheckedChange={() => toggleComplete.mutate(t)}
              className={`shrink-0 h-[18px] w-[18px] ${t.priority === "PILNY" ? "border-red-400 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500" : t.priority === "WYSOKI" ? "border-orange-400 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500" : ""}`}
              data-testid={`checkbox-task-${t.id}`}
            />

            <div className="flex-1 min-w-0">
              <div className={`text-[13px] leading-snug truncate transition-all duration-300 ${t.completed || isLogbook ? "line-through text-muted-foreground/60" : "text-foreground"}`}>
                {t.title}
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {t.dueDate && !isLogbook && (
                  <span className={`text-[11px] flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : isDueToday ? "text-orange-500 font-medium" : isDueTomorrow ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}>
                    {isDueToday && <Clock className="h-3 w-3 text-orange-500" />}
                    {isDueTomorrow && <Clock className="h-3 w-3 text-yellow-500" />}
                    {format(parseISO(t.dueDate), "d MMM", { locale: pl })}
                    {t.dueTime ? ` ${t.dueTime}` : ""}
                  </span>
                )}
                {t.tags &&
                  t.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTagColor(tag)}`}
                      data-testid={`tag-badge-${tag}`}
                    >
                      {tag}
                    </span>
                  ))}
                {hasChildren && (
                  <span className="text-[10px] text-muted-foreground">
                    {children.filter((c) => c.completed).length}/{children.length}
                  </span>
                )}
              </div>
            </div>

            {t.priority && t.priority !== "BRAK" && (
              <Flag className={`h-3.5 w-3.5 shrink-0 ${PRIORITY_FLAG_COLORS[t.priority]}`} data-testid={`flag-${t.id}`} />
            )}
          </motion.div>

          {hasChildren && isExpanded && (
            <AnimatePresence>
              {children
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                .map((child) => renderTaskRow(child, indent + 1))}
            </AnimatePresence>
          )}
        </div>
      );
    },
    [
      childTasksMap,
      expandedTasks,
      selectedTasks,
      view,
      toggleComplete,
      handleTaskClick,
      toggleExpand,
    ]
  );

  const renderSortableTaskList = useCallback((taskList: Task[]) => {
    const sorted = sortTasks(taskList, sortBy);
    const ids = sorted.map(t => `task-${t.id}`);
    return (
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <AnimatePresence>
          {sorted.map((t) => (
            <SortableTaskRow key={t.id} id={`task-${t.id}`}>
              {(listeners) => renderTaskRow(t, 0, listeners)}
            </SortableTaskRow>
          ))}
        </AnimatePresence>
      </SortableContext>
    );
  }, [sortBy, renderTaskRow]);

  const renderGroupedView = () => {
    if (view === "tomorrow") {
      return renderSortableTaskList(filtered);
    }

    if (view === "today" && todayGrouped) {
      return (
        <>
          {todayGrouped.overdue.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-red-500 uppercase tracking-wider bg-red-50/30 dark:bg-red-950/10">
                Zaległe
              </div>
              {renderSortableTaskList(todayGrouped.overdue)}
            </div>
          )}
          {todayGrouped.today.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dzisiaj</div>
              {renderSortableTaskList(todayGrouped.today)}
            </div>
          )}
        </>
      );
    }

    if (view === "week" && weekGrouped) {
      return weekGrouped.map(({ date, label, tasks: dayTasks }) => (
        <div key={date}>
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider capitalize">
            {label}
          </div>
          {renderSortableTaskList(dayTasks)}
        </div>
      ));
    }

    if (view === "priority" && priorityGrouped) {
      return priorityGrouped.map(([priority, priorityTasks]) => (
        <div key={priority}>
          <div className={`px-4 py-2 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 ${PRIORITY_FLAG_COLORS[priority]}`}>
            <Flag className="h-3.5 w-3.5" />
            {PRIORITY_LABELS[priority]}
          </div>
          {renderSortableTaskList(priorityTasks as Task[])}
        </div>
      ));
    }

    if (view === "logbook" && logbookGrouped) {
      return logbookGrouped.map(({ label, tasks: groupTasks }) => (
        <div key={label}>
          <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</div>
          <AnimatePresence>
            {groupTasks.map((t) => renderTaskRow(t))}
          </AnimatePresence>
        </div>
      ));
    }

    return null;
  };

  const hasGroupedView = view === "today" || view === "tomorrow" || view === "week" || view === "priority" || view === "logbook";

  const renderProjectView = () => {
    const sortedSections = [...projectSections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const sectionIds = sortedSections.map(s => `section-${s.id}`);
    const unsectionedTasks = sortTasks(filtered.filter((t) => !t.sectionId), sortBy);
    const unsectionedIds = unsectionedTasks.map(t => `task-${t.id}`);

    return (
      <>
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          {sortedSections.map((sec) => {
            const sectionTasks = sortTasks(filtered.filter((t) => t.sectionId === sec.id), sortBy);
            const collapsed = collapsedSections.has(sec.id);
            const sectionTaskIds = sectionTasks.map(t => `task-${t.id}`);
            const isRenaming = renamingSectionId === sec.id;

            return (
              <SortableSectionItem key={sec.id} id={`section-${sec.id}`}>
                {(sectionListeners) => (
                  <div data-testid={`section-${sec.id}`}>
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-3 px-5 w-full text-left transition-colors text-muted-foreground/80 group border-b border-border/60 mt-2">
                      <div
                        className="opacity-0 group-hover:opacity-100 cursor-grab p-0.5 transition-opacity duration-150"
                        {...(sectionListeners || {})}
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground/40" />
                      </div>
                      <button
                        onClick={() => toggleSection(sec.id)}
                        className="flex items-center gap-1.5 flex-1 min-w-0"
                        data-testid={`button-toggle-section-${sec.id}`}
                      >
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {isRenaming ? (
                          <Input
                            ref={renameSectionInputRef}
                            value={renamingSectionName}
                            onChange={(e) => setRenamingSectionName(e.target.value)}
                            onBlur={() => handleSectionRenameSubmit(sec.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleSectionRenameSubmit(sec.id);
                              }
                              if (e.key === "Escape") {
                                setRenamingSectionId(null);
                                setRenamingSectionName("");
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 text-sm font-semibold border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 py-0"
                            data-testid={`input-rename-section-${sec.id}`}
                          />
                        ) : (
                          <>
                            {sec.name}
                            <span className="text-muted-foreground font-normal ml-1">({sectionTasks.length})</span>
                          </>
                        )}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="invisible group-hover:visible p-0.5 rounded hover-elevate text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-section-menu-${sec.id}`}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => {
                              setRenamingSectionId(sec.id);
                              setRenamingSectionName(sec.name);
                            }}
                            data-testid={`menu-rename-section-${sec.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Zmień nazwę
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteSection.mutate(sec.id)}
                            className="text-destructive"
                            data-testid={`menu-delete-section-${sec.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Usuń sekcję
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {!collapsed && (
                      <SortableContext items={sectionTaskIds} strategy={verticalListSortingStrategy}>
                        <AnimatePresence>
                          {sectionTasks.map((t) => (
                            <SortableTaskRow key={t.id} id={`task-${t.id}`}>
                              {(listeners) => renderTaskRow(t, 0, listeners)}
                            </SortableTaskRow>
                          ))}
                        </AnimatePresence>
                      </SortableContext>
                    )}
                  </div>
                )}
              </SortableSectionItem>
            );
          })}
        </SortableContext>
        <SortableContext items={unsectionedIds} strategy={verticalListSortingStrategy}>
          <AnimatePresence>
            {unsectionedTasks.map((t) => (
              <SortableTaskRow key={t.id} id={`task-${t.id}`}>
                {(listeners) => renderTaskRow(t, 0, listeners)}
              </SortableTaskRow>
            ))}
          </AnimatePresence>
        </SortableContext>
      </>
    );
  };

  return (
    <div className="flex h-full" data-testid="page-tasks">
      {isMobile && !sidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarCollapsed(true)}
          data-testid="sidebar-backdrop"
        />
      )}
      <AnimatePresence>
        {!sidebarCollapsed && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`shrink-0 border-r flex flex-col overflow-hidden bg-muted/10 ${
              isMobile ? "fixed inset-y-0 left-0 z-50 bg-background" : ""
            }`}
            data-testid="tasks-sidebar"
          >
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
              <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2 px-2.5">Widoki</div>
              {smartViews.map((sv) => {
                const count = filterTasks(tasks, sv.view, weekStart, showOverdueInToday, user?.id).length;
                const active = isActive(sv.view);
                return (
                  <button
                    key={sv.key}
                    onClick={() => handleViewChange(sv.view)}
                    className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13px] w-full text-left transition-all duration-150 ${
                      active ? "bg-primary/8 text-foreground font-medium shadow-sm" : "hover-elevate text-foreground/80"
                    }`}
                    data-testid={`button-view-${sv.key}`}
                  >
                    <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${active ? "" : "bg-muted/40"}`} style={active ? { backgroundColor: `${sv.color}20` } : undefined}>
                      <sv.icon className="h-3.5 w-3.5" style={{ color: sv.color }} />
                    </div>
                    <span className="flex-1">{sv.label}</span>
                    {showCounts && count > 0 && (
                      <span
                        className={`text-[10px] min-w-[18px] text-center px-1 py-0.5 rounded-full font-medium tabular-nums ${
                          sv.key === "inbox" && overdueCount > 0 ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" : "text-muted-foreground"
                        }`}
                        data-testid={`badge-count-${sv.key}`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}

              {ungroupedProjects.length > 0 && (
                <>
                  <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-5 mb-1.5 px-2.5">Projekty</div>
                  <DndContext sensors={sidebarSensors} collisionDetection={closestCenter} onDragEnd={handleSidebarDragEnd}>
                    <SortableContext items={ungroupedProjects.map(p => `project-${p.id}`)} strategy={verticalListSortingStrategy}>
                      {ungroupedProjects.map((p) => (
                        <SortableProjectItem key={p.id} id={`project-${p.id}`}>
                          {(projectListeners) => (
                            <ProjectSidebarItem
                              project={p}
                              tasks={tasks}
                              isActive={isActive({ projectId: p.id })}
                              onClick={() => handleViewChange({ projectId: p.id })}
                              dragListeners={projectListeners}
                              onArchive={() => updateProject.mutate({ id: p.id, data: { archived: !p.archived } })}
                              onDelete={() => deleteProject.mutate(p.id)}
                            />
                          )}
                        </SortableProjectItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                </>
              )}

              {areas.map((area) => {
                const areaProjects = activeProjects
                  .filter((p) => p.area === area)
                  .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                const isCollapsed = collapsedAreas.has(area);
                return (
                  <div key={area}>
                    <button
                      onClick={() => toggleArea(area)}
                      className="flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 mt-4 mb-0.5 hover-elevate rounded-md"
                      data-testid={`button-area-${area}`}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                      ) : (
                        <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
                      )}
                      <span className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">{area}</span>
                    </button>
                    {!isCollapsed &&
                      areaProjects.map((p) => (
                        <ProjectSidebarItem
                          key={p.id}
                          project={p}
                          tasks={tasks}
                          isActive={isActive({ projectId: p.id })}
                          onClick={() => handleViewChange({ projectId: p.id })}
                          onArchive={() => updateProject.mutate({ id: p.id, data: { archived: !p.archived } })}
                          onDelete={() => deleteProject.mutate(p.id)}
                        />
                      ))}
                  </div>
                );
              })}

              {archivedProjects.length > 0 && (
                <>
                  <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-5 mb-1.5 px-2.5 flex items-center gap-1.5">
                    <Archive className="h-3 w-3" />
                    Archiwum
                  </div>
                  {archivedProjects.map((p) => (
                    <ProjectSidebarItem
                      key={p.id}
                      project={p}
                      tasks={tasks}
                      isActive={isActive({ projectId: p.id })}
                      onClick={() => handleViewChange({ projectId: p.id })}
                      onArchive={() => updateProject.mutate({ id: p.id, data: { archived: !p.archived } })}
                      onDelete={() => deleteProject.mutate(p.id)}
                    />
                  ))}
                </>
              )}
            </div>

            <div className="border-t px-3 py-2 flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-1" data-testid="button-new-list">
                    <Plus className="h-3.5 w-3.5" />
                    <span>Nowa Lista</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start" side="top">
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-md hover-elevate transition-colors"
                    onClick={() => setAddProjectOpen(true)}
                    data-testid="button-new-project-popover"
                  >
                    <FolderPlus className="h-4 w-4 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">Nowy Projekt</div>
                      <div className="text-[10px] text-muted-foreground">Zdefiniuj cel i pracuj nad zadaniami</div>
                    </div>
                  </button>
                  <button
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-md hover-elevate transition-colors"
                    onClick={() => setAddSectionOpen(true)}
                    data-testid="button-new-section-popover"
                  >
                    <ListPlus className="h-4 w-4 text-emerald-500" />
                    <div className="text-left">
                      <div className="font-medium">Nowa Sekcja</div>
                      <div className="text-[10px] text-muted-foreground">Grupuj zadania w ramach projektu</div>
                    </div>
                  </button>
                </PopoverContent>
              </Popover>
              <div className="flex-1" />
              <button
                className="p-1.5 rounded-md hover-elevate text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setSettingsOpen(true)}
                data-testid="button-settings"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <main className="flex-1 flex flex-col overflow-hidden relative" data-testid="tasks-main">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/50">
          {isMobile && (
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-full hover-elevate text-muted-foreground"
              data-testid="button-mobile-menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-1.5 rounded-full hover-elevate text-muted-foreground ${isMobile ? "hidden" : ""}`}
            data-testid="button-toggle-sidebar"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <VIcon className="h-5 w-5 text-muted-foreground/60 shrink-0" />
            <h2 className="text-lg font-semibold tracking-tight truncate" data-testid="text-view-title">
              {isProjectView ? (
                <span className="flex items-center gap-1.5">
                  <span className="text-muted-foreground/60 text-sm font-normal">Projekt</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                  {viewLabel(view, projects)}
                </span>
              ) : (
                viewLabel(view, projects)
              )}
            </h2>
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[130px] h-8 text-xs border-border/50" data-testid="select-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Ręcznie</SelectItem>
              <SelectItem value="dueDate">Termin</SelectItem>
              <SelectItem value="priority">Priorytet</SelectItem>
              <SelectItem value="createdAt">Data utworzenia</SelectItem>
              <SelectItem value="alpha">Alfabetycznie</SelectItem>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-full hover-elevate text-muted-foreground" data-testid="button-context-menu">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setAddTaskOpen(true)} data-testid="menu-add-task">
                <Plus className="h-3.5 w-3.5 mr-2" /> Dodaj zadanie
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isProjectView && (() => {
          const currentProject = projects.find((p) => p.id === (view as { projectId: number }).projectId);
          const projectTasks = tasks.filter((t) => t.projectId === (view as { projectId: number }).projectId && t.parentTaskId === null);
          const completedCount = projectTasks.filter((t) => t.completed).length;
          const totalCount = projectTasks.length;
          const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
          const color = currentProject?.color || "#5ADBFA";
          return (
            <div className="px-4 py-3" style={{ background: `linear-gradient(135deg, ${color}15, ${color}05)` }} data-testid="project-header">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{completedCount}/{totalCount} ukończonych</span>
                <span className="text-xs font-medium" style={{ color }}>{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })()}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleMainDragStart} onDragEnd={handleMainDragEnd}>
          <motion.div
            key={typeof view === "object" ? `project-${view.projectId}` : view}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-y-auto"
          >
            {hasGroupedView ? (
              renderGroupedView()
            ) : isProjectView ? (
              renderProjectView()
            ) : (
              renderSortableTaskList(filtered)
            )}

            {filtered.length === 0 && !inlineAddVisible && (
              <div className="text-center text-muted-foreground/50 py-20" data-testid="text-empty-tasks">
                <VIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-medium">Brak zadań w tym widoku</p>
                <p className="text-xs mt-1 text-muted-foreground/40">Naciśnij + aby dodać nowe zadanie</p>
              </div>
            )}

            {view !== "logbook" && (
              <>
                {inlineAddVisible ? (
                  <div className="px-5 py-3.5 border-t border-border/30 bg-muted/5" data-testid="inline-add-task">
                    <div className="flex items-center gap-3">
                      <div className="h-[18px] w-[18px] rounded-full border-2 border-muted-foreground/20 shrink-0" />
                      <Input
                        ref={inlineInputRef}
                        value={inlineTitle}
                        onChange={(e) => setInlineTitle(e.target.value)}
                        onKeyDown={handleInlineKeyDown}
                        onBlur={() => {
                          if (!inlineTitle.trim()) setInlineAddVisible(false);
                        }}
                        placeholder="Nowe zadanie..."
                        className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm h-auto py-0"
                        data-testid="input-inline-task-title"
                      />
                    </div>
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-3 px-5 py-3 w-full text-left text-[13px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors duration-200"
                    onClick={() => setInlineAddVisible(true)}
                    data-testid="button-inline-add"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Dodaj Zadanie</span>
                  </button>
                )}
              </>
            )}
          </motion.div>

          <DragOverlay>
            {activeDragData?.type === "task" && activeDragData.item && (
              <div className="bg-card border border-border/50 rounded-xl shadow-2xl px-5 py-3.5 flex items-center gap-3 max-w-sm opacity-95">
                <div className="h-[18px] w-[18px] rounded-full border-2 border-muted-foreground/25 shrink-0" />
                {(activeDragData.item as Task).priority && (activeDragData.item as Task).priority !== "BRAK" && (
                  <Flag className={`h-3.5 w-3.5 shrink-0 ${PRIORITY_FLAG_COLORS[(activeDragData.item as Task).priority || "BRAK"]}`} />
                )}
                <span className="text-[13px] truncate">{(activeDragData.item as Task).title}</span>
              </div>
            )}
            {activeDragData?.type === "section" && activeDragData.item && (
              <div className="bg-card border border-border/50 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-2 opacity-95">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">{(activeDragData.item as TaskSection).name}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {selectedTasks.size > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card border rounded-xl shadow-lg px-2 py-1.5 z-50" data-testid="bottom-action-bar">
            <span className="text-xs text-muted-foreground px-2 tabular-nums">{selectedTasks.size} zaznaczonych</span>
            <div className="w-px h-5 bg-border mx-1" />
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setMoveDialogOpen(true)} data-testid="button-action-move">
              <ArrowRight className="h-3.5 w-3.5" />
              Przenieś
            </Button>
            {selectedTasks.size === 1 && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => duplicateTask.mutate(selectedTasksArray[0])} data-testid="button-action-duplicate">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-destructive"
              onClick={() => setDeleteConfirmOpen(true)}
              data-testid="button-action-delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={clearSelection} data-testid="button-action-clear">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="absolute bottom-6 right-6 z-40">
          {isMobile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  className="rounded-full shadow-lg"
                  data-testid="button-fab-add"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-48">
                <DropdownMenuItem onClick={() => setAddTaskOpen(true)} data-testid="fab-menu-new-task">
                  <Plus className="h-3.5 w-3.5 mr-2" /> Nowe zadanie
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {activeProjects.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => { setView({ projectId: p.id }); setInlineAddVisible(true); }} data-testid={`fab-menu-project-${p.id}`}>
                    <Circle className="h-3 w-3 mr-2" style={{ color: p.color || "#5ADBFA", fill: p.color || "#5ADBFA" }} />
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="icon"
              className="rounded-full shadow-lg"
              onClick={() => setAddTaskOpen(true)}
              data-testid="button-fab-add"
            >
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </div>
      </main>

      <AnimatePresence>
        {detailTask && (
          <DetailPanel
            task={detailTask}
            tasks={tasks}
            projects={projects}
            sections={sections}
            childTasks={childTasksMap.get(detailTask.id) || []}
            allUsers={allUsers}
            currentUserId={user?.id}
            isMobile={isMobile}
            onClose={() => {
              setDetailTask(null);
              clearSelection();
            }}
            onUpdate={(data) => {
              updateTask.mutate(
                { id: detailTask.id, data },
                {
                  onSuccess: () => {
                    const updated = { ...detailTask, ...data } as Task;
                    setDetailTask(updated);
                  },
                }
              );
            }}
            onDelete={() => {
              deleteTask.mutate(detailTask.id);
              setDetailTask(null);
              clearSelection();
            }}
            onToggleComplete={() => toggleComplete.mutate(detailTask)}
            onCreateSubtask={(title) => {
              createTask.mutate({
                title,
                priority: "BRAK",
                tags: [],
                parentTaskId: detailTask.id,
                projectId: detailTask.projectId,
                sectionId: detailTask.sectionId,
              });
            }}
          />
        )}
      </AnimatePresence>

      <TaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        projects={projects}
        sections={sections}
        defaultProjectId={isProjectView ? (view as { projectId: number }).projectId : undefined}
      />

      <ProjectDialog open={addProjectOpen} onOpenChange={setAddProjectOpen} onSubmit={(data) => createProject.mutate(data)} />

      <SectionDialog
        open={addSectionOpen}
        onOpenChange={setAddSectionOpen}
        projects={projects}
        currentProjectId={isProjectView ? (view as { projectId: number }).projectId : undefined}
        onSubmit={(data) => createSection.mutate(data)}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        showCounts={showCounts}
        setShowCounts={(v) => {
          setShowCounts(v);
          localStorage.setItem("tasksShowCounts", String(v));
        }}
        showOverdueInToday={showOverdueInToday}
        setShowOverdueInToday={(v) => {
          setShowOverdueInToday(v);
          localStorage.setItem("tasksShowOverdueToday", String(v));
        }}
        weekStart={weekStart}
        setWeekStart={(v) => {
          setWeekStart(v);
          localStorage.setItem("tasksWeekStart", String(v));
        }}
        projects={projects}
      />

      <MoveDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        projects={projects}
        sections={sections}
        onMove={(projectId, sectionId) => bulkMove.mutate({ ids: selectedTasksArray, projectId, sectionId })}
        isPending={bulkMove.isPending}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć zadania?</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć {selectedTasks.size} {selectedTasks.size === 1 ? "zadanie" : "zadań"}? Tej operacji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkDelete.mutate(selectedTasksArray);
                setDeleteConfirmOpen(false);
              }}
              data-testid="button-confirm-delete"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProjectSidebarItem({
  project,
  tasks,
  isActive,
  onClick,
  dragListeners,
  onArchive,
  onDelete,
}: {
  project: TaskProject;
  tasks: Task[];
  isActive: boolean;
  onClick: () => void;
  dragListeners?: Record<string, any>;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const count = tasks.filter((t) => t.projectId === project.id && !t.completed && t.parentTaskId === null).length;

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-[7px] rounded-lg text-[13px] w-full text-left transition-all duration-150 cursor-pointer group ${
        isActive ? "bg-primary/8 text-foreground font-medium shadow-sm" : "hover-elevate text-foreground/80"
      }`}
      onClick={onClick}
      data-testid={`sidebar-project-${project.id}`}
    >
      {dragListeners && (
        <div className="opacity-0 group-hover:opacity-100 cursor-grab transition-opacity duration-150" {...dragListeners}>
          <GripVertical className="h-3 w-3 text-muted-foreground/40" />
        </div>
      )}
      <div className="h-5 w-5 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${project.color || "#5ADBFA"}20` }}>
        <Circle className="h-2.5 w-2.5 shrink-0" style={{ color: project.color || "#5ADBFA", fill: project.color || "#5ADBFA" }} />
      </div>
      <span className="flex-1 truncate">{project.name}</span>
      {count > 0 && (
        <span className="text-[10px] min-w-[18px] text-center px-1 py-0.5 rounded-full text-muted-foreground tabular-nums" data-testid={`badge-project-count-${project.id}`}>
          {count}
        </span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover-elevate text-muted-foreground transition-opacity duration-150"
            onClick={(e) => e.stopPropagation()}
            data-testid={`button-project-menu-${project.id}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right">
          <DropdownMenuItem onClick={onArchive} data-testid={`menu-archive-project-${project.id}`}>
            <Archive className="h-3.5 w-3.5 mr-2" />
            {project.archived ? "Przywróć z archiwum" : "Archiwizuj"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive" data-testid={`menu-delete-project-${project.id}`}>
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Usuń
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DetailPanel({
  task,
  tasks,
  projects,
  sections,
  childTasks,
  allUsers,
  currentUserId,
  isMobile,
  onClose,
  onUpdate,
  onDelete,
  onToggleComplete,
  onCreateSubtask,
}: {
  task: Task;
  tasks: Task[];
  projects: TaskProject[];
  sections: TaskSection[];
  childTasks: Task[];
  allUsers: { id: string; firstName: string | null; lastName: string | null; email: string | null; profileImageUrl: string | null }[];
  currentUserId?: string;
  isMobile: boolean;
  onClose: () => void;
  onUpdate: (data: Record<string, unknown>) => void;
  onDelete: () => void;
  onToggleComplete: () => void;
  onCreateSubtask: (title: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || "");
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [tagsInput, setTagsInput] = useState((task.tags || []).join(", "));
  const subtaskRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes || "");
    setTagsInput((task.tags || []).join(", "));
  }, [task.id, task.title, task.notes, task.tags]);

  const { data: checklist = [] } = useQuery<TaskChecklistItem[]>({
    queryKey: ["/api/task-checklist", task.id],
  });

  const updateChecklist = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/task-checklist/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/task-checklist", task.id] }),
  });

  const createChecklistItem = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/task-checklist", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/task-checklist", task.id] }),
  });

  const deleteChecklistItem = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/task-checklist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/task-checklist", task.id] }),
  });

  const [newChecklistTitle, setNewChecklistTitle] = useState("");

  const projectSections = sections.filter((s) => s.projectId === task.projectId);

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className={`${isMobile ? "fixed inset-0 z-50 w-full" : "w-[380px]"} shrink-0 border-l bg-background flex flex-col overflow-hidden`}
      data-testid="detail-panel"
    >
      <div className="flex items-center gap-2 px-5 py-3.5 border-b">
        <button onClick={onClose} className="p-1.5 rounded-full hover-elevate text-muted-foreground" data-testid="button-close-detail">
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setDeleteConfirm(true)}
          className="p-1.5 rounded-full hover-elevate text-destructive/60 hover:text-destructive"
          data-testid="button-delete-detail"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={!!task.completed}
            onCheckedChange={onToggleComplete}
            className="mt-1.5 shrink-0 h-5 w-5"
            data-testid="checkbox-detail-complete"
          />
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== task.title) onUpdate({ title: title.trim() });
            }}
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-lg font-semibold h-auto py-0 leading-snug"
            data-testid="input-detail-title"
          />
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Notatki</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (task.notes || "")) onUpdate({ notes });
            }}
            placeholder="Dodaj notatki..."
            className="mt-1.5 resize-none text-sm min-h-[80px] border-border/50"
            data-testid="textarea-detail-notes"
          />
        </div>

        <div className="border-t border-border/40 pt-4 grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Priorytet</Label>
            <Select value={task.priority || "BRAK"} onValueChange={(v) => onUpdate({ priority: v })}>
              <SelectTrigger className="mt-1.5" data-testid="select-detail-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    <div className="flex items-center gap-2">
                      <Flag className={`h-3.5 w-3.5 ${PRIORITY_FLAG_COLORS[val]}`} />
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Projekt</Label>
            <Select
              value={task.projectId ? String(task.projectId) : "none"}
              onValueChange={(v) => onUpdate({ projectId: v === "none" ? null : Number(v), sectionId: null })}
            >
              <SelectTrigger className="mt-1" data-testid="select-detail-project">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Brak</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {projectSections.length > 0 && (
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Sekcja</Label>
            <Select
              value={task.sectionId ? String(task.sectionId) : "none"}
              onValueChange={(v) => onUpdate({ sectionId: v === "none" ? null : Number(v) })}
            >
              <SelectTrigger className="mt-1" data-testid="select-detail-section">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Brak</SelectItem>
                {projectSections.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Termin</Label>
            <Input
              type="date"
              value={task.dueDate || ""}
              onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
              className="mt-1"
              data-testid="input-detail-due-date"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Godzina</Label>
            <Input
              type="time"
              value={task.dueTime || ""}
              onChange={(e) => onUpdate({ dueTime: e.target.value || null })}
              className="mt-1"
              data-testid="input-detail-due-time"
            />
          </div>
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Tagi (oddzielone przecinkami)</Label>
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            onBlur={() => {
              const newTags = tagsInput
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
              const oldTags = task.tags || [];
              if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) {
                onUpdate({ tags: newTags });
              }
            }}
            placeholder="np. praca, dom, pilne"
            className="mt-1"
            data-testid="input-detail-tags"
          />
        </div>

        <div>
          <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Powtarzanie</Label>
          <Select
            value={task.recurring || "none"}
            onValueChange={(v) => onUpdate({ recurring: v === "none" ? null : v })}
          >
            <SelectTrigger className="mt-1" data-testid="select-detail-recurring">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Brak</SelectItem>
              <SelectItem value="codziennie">Codziennie</SelectItem>
              <SelectItem value="co tydzień">Co tydzień</SelectItem>
              <SelectItem value="co miesiąc">Co miesiąc</SelectItem>
              <SelectItem value="co rok">Co rok</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Przypomnienie</Label>
            <Input
              type="date"
              value={task.reminderDate || ""}
              onChange={(e) => onUpdate({ reminderDate: e.target.value || null })}
              className="mt-1"
              data-testid="input-detail-reminder-date"
            />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Godz. przyp.</Label>
            <Input
              type="time"
              value={task.reminderTime || ""}
              onChange={(e) => onUpdate({ reminderTime: e.target.value || null })}
              className="mt-1"
              data-testid="input-detail-reminder-time"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Lista kontrolna</Label>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {checklist.filter((c) => c.completed).length}/{checklist.length}
            </span>
          </div>
          {checklist
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((item) => (
              <div key={item.id} className="flex items-center gap-2 py-1 group">
                <Checkbox
                  checked={!!item.completed}
                  onCheckedChange={() => updateChecklist.mutate({ id: item.id, data: { completed: !item.completed } })}
                  data-testid={`checkbox-checklist-${item.id}`}
                />
                <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                <button
                  onClick={() => deleteChecklistItem.mutate(item.id)}
                  className="invisible group-hover:visible p-0.5 rounded hover-elevate text-muted-foreground"
                  data-testid={`button-delete-checklist-${item.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          <div className="flex items-center gap-2 mt-1">
            <Input
              value={newChecklistTitle}
              onChange={(e) => setNewChecklistTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newChecklistTitle.trim()) {
                  createChecklistItem.mutate({ taskId: task.id, title: newChecklistTitle.trim(), sortOrder: checklist.length });
                  setNewChecklistTitle("");
                }
              }}
              placeholder="Dodaj element..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm h-auto py-1"
              data-testid="input-checklist-new"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Podzadania</Label>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {childTasks.filter((c) => c.completed).length}/{childTasks.length}
            </span>
          </div>
          {childTasks
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((child) => (
              <div key={child.id} className="flex items-center gap-2 py-1">
                <Checkbox checked={!!child.completed} disabled className="shrink-0" />
                <span className={`text-sm flex-1 ${child.completed ? "line-through text-muted-foreground" : ""}`}>{child.title}</span>
              </div>
            ))}
          <div className="flex items-center gap-2 mt-1">
            <Input
              ref={subtaskRef}
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && subtaskTitle.trim()) {
                  onCreateSubtask(subtaskTitle.trim());
                  setSubtaskTitle("");
                }
              }}
              placeholder="Dodaj podzadanie..."
              className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm h-auto py-1"
              data-testid="input-subtask-new"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              Udostępnij
            </Label>
          </div>
          {(task.sharedWith || []).map((uid: string) => {
            const u = allUsers.find((au) => au.id === uid);
            return (
              <div key={uid} className="flex items-center gap-2 py-1 group">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                  {u ? (u.firstName?.[0] || u.email?.[0] || "?").toUpperCase() : "?"}
                </div>
                <span className="text-sm flex-1 truncate">{u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || uid : uid}</span>
                <button
                  onClick={() => {
                    const newShared = (task.sharedWith || []).filter((id: string) => id !== uid);
                    onUpdate({ sharedWith: newShared });
                  }}
                  className="invisible group-hover:visible p-0.5 rounded hover-elevate text-muted-foreground"
                  data-testid={`button-remove-share-${uid}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
          <Select
            value=""
            onValueChange={(uid) => {
              if (uid && !(task.sharedWith || []).includes(uid)) {
                onUpdate({ sharedWith: [...(task.sharedWith || []), uid] });
              }
            }}
          >
            <SelectTrigger className="mt-1 h-8 text-xs" data-testid="select-share-user">
              <SelectValue placeholder="Dodaj osobę..." />
            </SelectTrigger>
            <SelectContent>
              {allUsers
                .filter((u) => u.id !== currentUserId && !(task.sharedWith || []).includes(u.id))
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {`${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || u.id}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usunąć zadanie?</AlertDialogTitle>
            <AlertDialogDescription>Tej operacji nie można cofnąć.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-detail-delete">Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} data-testid="button-confirm-detail-delete">
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}

function TaskDialog({
  open,
  onOpenChange,
  projects,
  sections,
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects: TaskProject[];
  sections: TaskSection[];
  defaultProjectId?: number;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState(getStoredDefaultPriority());
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [tags, setTags] = useState("");
  const [projectId, setProjectId] = useState<string>(defaultProjectId ? String(defaultProjectId) : getStoredDefaultProject() || "none");
  const [sectionId, setSectionId] = useState<string>("none");

  useEffect(() => {
    if (open) {
      setTitle("");
      setNotes("");
      setPriority(getStoredDefaultPriority());
      setDueDate("");
      setDueTime("");
      setTags("");
      setProjectId(defaultProjectId ? String(defaultProjectId) : getStoredDefaultProject() || "none");
      setSectionId("none");
    }
  }, [open, defaultProjectId]);

  const createTask = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      onOpenChange(false);
    },
  });

  const projectSections = sections.filter((s) => s.projectId === (projectId !== "none" ? Number(projectId) : null));

  const handleSubmit = () => {
    if (!title.trim()) return;
    createTask.mutate({
      title: title.trim(),
      notes: notes || null,
      priority,
      dueDate: dueDate || null,
      dueTime: dueTime || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      projectId: projectId !== "none" ? Number(projectId) : null,
      sectionId: sectionId !== "none" ? Number(sectionId) : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-add-task">
        <DialogHeader>
          <DialogTitle>Nowe zadanie</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Tytuł</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tytuł zadania" className="mt-1" data-testid="input-task-title" autoFocus />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Notatki</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notatki..." className="mt-1 resize-none min-h-[60px]" data-testid="textarea-task-notes" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Priorytet</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1" data-testid="select-task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      <div className="flex items-center gap-2">
                        <Flag className={`h-3.5 w-3.5 ${PRIORITY_FLAG_COLORS[val]}`} />
                        {label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Projekt</Label>
              <Select value={projectId} onValueChange={(v) => { setProjectId(v); setSectionId("none"); }}>
                <SelectTrigger className="mt-1" data-testid="select-task-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak</SelectItem>
                  {projects.filter((p) => !p.archived).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {projectSections.length > 0 && (
            <div>
              <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Sekcja</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger className="mt-1" data-testid="select-task-section">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak</SelectItem>
                  {projectSections.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Termin</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" data-testid="input-task-due-date" />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Godzina</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="mt-1" data-testid="input-task-due-time" />
            </div>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Tagi</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="pilne, praca, dom" className="mt-1" data-testid="input-task-tags" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-task">
            Anuluj
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || createTask.isPending} data-testid="button-save-task">
            Utwórz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (data: Record<string, unknown>) => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#5ADBFA");
  const [area, setArea] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setColor("#5ADBFA");
      setArea("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="dialog-add-project">
        <DialogHeader>
          <DialogTitle>Nowy Projekt</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Nazwa</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa projektu" className="mt-1" data-testid="input-project-name" autoFocus />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Kolor</Label>
            <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="mt-1 h-9 w-16 p-1" data-testid="input-project-color" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Obszar (opcjonalnie)</Label>
            <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="np. Praca, Dom" className="mt-1" data-testid="input-project-area" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-project">
            Anuluj
          </Button>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              onSubmit({ name: name.trim(), color, area: area.trim() || null });
            }}
            disabled={!name.trim()}
            data-testid="button-save-project"
          >
            Utwórz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionDialog({
  open,
  onOpenChange,
  projects,
  currentProjectId,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects: TaskProject[];
  currentProjectId?: number;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState<string>(currentProjectId ? String(currentProjectId) : "");

  useEffect(() => {
    if (open) {
      setName("");
      setProjectId(currentProjectId ? String(currentProjectId) : "");
    }
  }, [open, currentProjectId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="dialog-add-section">
        <DialogHeader>
          <DialogTitle>Nowa Sekcja</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Nazwa</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa sekcji" className="mt-1" data-testid="input-section-name" autoFocus />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Projekt</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1" data-testid="select-section-project">
                <SelectValue placeholder="Wybierz projekt" />
              </SelectTrigger>
              <SelectContent>
                {projects.filter((p) => !p.archived).map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-section">
            Anuluj
          </Button>
          <Button
            onClick={() => {
              if (!name.trim() || !projectId) return;
              onSubmit({ name: name.trim(), projectId: Number(projectId) });
            }}
            disabled={!name.trim() || !projectId}
            data-testid="button-save-section"
          >
            Utwórz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({
  open,
  onOpenChange,
  showCounts,
  setShowCounts,
  showOverdueInToday,
  setShowOverdueInToday,
  weekStart,
  setWeekStart,
  projects,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  showCounts: boolean;
  setShowCounts: (v: boolean) => void;
  showOverdueInToday: boolean;
  setShowOverdueInToday: (v: boolean) => void;
  weekStart: 0 | 1;
  setWeekStart: (v: 0 | 1) => void;
  projects: TaskProject[];
}) {
  const [page, setPage] = useState<SettingsPage>("main");

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "system");
  const [defaultProject, setDefaultProject] = useState(getStoredDefaultProject);
  const [defaultPriority, setDefaultPriority] = useState(getStoredDefaultPriority);

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem("theme", t);
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else if (t === "light") {
      root.classList.remove("dark");
    } else {
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  };

  useEffect(() => {
    if (open) setPage("main");
  }, [open]);

  const handleBack = () => setPage("main");

  const pageTitle: Record<SettingsPage, string> = {
    main: "Ustawienia",
    appearance: "Wygląd",
    general: "Ogólne",
    counter: "Licznik zadań",
    today_settings: "Dziś",
    week_settings: "Tydzień",
    plus_settings: "Przycisk Plus",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPage("main"); }}>
      <DialogContent className="max-w-sm" data-testid="dialog-settings">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {page !== "main" && (
              <button onClick={handleBack} className="p-1 rounded hover-elevate" data-testid="button-settings-back">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
            )}
            <DialogTitle>{pageTitle[page]}</DialogTitle>
          </div>
        </DialogHeader>

        {page === "main" && (
          <div className="space-y-1 py-2">
            {[
              { key: "appearance" as SettingsPage, label: "Wygląd", icon: <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-bold">Aa</div> },
              { key: "counter" as SettingsPage, label: "Licznik zadań", icon: <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center"><Tag className="h-4 w-4 text-white" /></div> },
              { key: "today_settings" as SettingsPage, label: "Dziś", icon: <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center"><Star className="h-4 w-4 text-white" /></div> },
              { key: "week_settings" as SettingsPage, label: "Tydzień", icon: <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center"><Calendar className="h-4 w-4 text-white" /></div> },
              { key: "plus_settings" as SettingsPage, label: "Przycisk Plus", icon: <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"><Plus className="h-4 w-4 text-white" /></div> },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover-elevate transition-colors text-left"
                onClick={() => setPage(key)}
                data-testid={`button-settings-${key}`}
              >
                {icon}
                <span className="text-sm flex-1">{label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {page === "appearance" && (
          <div className="space-y-4 py-2">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Motyw</div>
              <div className="space-y-1">
                {[
                  { value: "light", label: "Jasny", icon: Sun },
                  { value: "dark", label: "Ciemny", icon: Moon },
                  { value: "system", label: "Automatyczny", icon: Monitor },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left ${theme === value ? "bg-primary/10" : "hover-elevate"}`}
                    onClick={() => applyTheme(value)}
                    data-testid={`button-theme-${value}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm flex-1">{label}</span>
                    {theme === value && <Check className="h-4 w-4 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {page === "counter" && (
          <div className="py-2 space-y-4">
            <p className="text-sm text-muted-foreground">Pokaż liczniki zadań przy widokach inteligentnych na pasku bocznym.</p>
            <div className="flex items-center justify-between">
              <span className="text-sm">Pokaż liczniki</span>
              <Switch checked={showCounts} onCheckedChange={setShowCounts} data-testid="switch-show-counts" />
            </div>
          </div>
        )}

        {page === "today_settings" && (
          <div className="py-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Pokaż zaległe</div>
                <div className="text-xs text-muted-foreground">Wyświetlaj przeterminowane zadania w widoku Dziś</div>
              </div>
              <Switch checked={showOverdueInToday} onCheckedChange={setShowOverdueInToday} data-testid="switch-show-overdue" />
            </div>
          </div>
        )}

        {page === "week_settings" && (
          <div className="py-2 space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Początek tygodnia</div>
              <Select value={String(weekStart)} onValueChange={(v) => setWeekStart(Number(v) as 0 | 1)}>
                <SelectTrigger data-testid="select-week-start">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Poniedziałek</SelectItem>
                  <SelectItem value="0">Niedziela</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {page === "plus_settings" && (
          <div className="py-2 space-y-4">
            <div>
              <div className="text-sm font-medium mb-2">Domyślny projekt</div>
              <Select
                value={defaultProject || "none"}
                onValueChange={(v) => {
                  const val = v === "none" ? "" : v;
                  setDefaultProject(val);
                  localStorage.setItem("tasksDefaultProject", val);
                }}
              >
                <SelectTrigger data-testid="select-default-project">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak (Odebrane)</SelectItem>
                  {projects.filter((p) => !p.archived).map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Domyślny priorytet</div>
              <Select
                value={defaultPriority}
                onValueChange={(v) => {
                  setDefaultPriority(v);
                  localStorage.setItem("tasksDefaultPriority", v);
                }}
              >
                <SelectTrigger data-testid="select-default-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({
  open,
  onOpenChange,
  projects,
  sections,
  onMove,
  isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projects: TaskProject[];
  sections: TaskSection[];
  onMove: (projectId: number | null, sectionId: number | null) => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs" data-testid="dialog-move">
        <DialogHeader>
          <DialogTitle>Przenieś zadania</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2 max-h-[60vh] overflow-y-auto">
          <button
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg hover-elevate transition-colors text-left text-sm"
            onClick={() => onMove(null, null)}
            disabled={isPending}
            data-testid="button-move-inbox"
          >
            <Inbox className="h-4 w-4 text-[#5ADBFA]" />
            Odebrane (bez projektu)
          </button>
          {projects.filter((p) => !p.archived).map((p) => {
            const projectSections = sections.filter((s) => s.projectId === p.id);
            return (
              <div key={p.id}>
                <button
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg hover-elevate transition-colors text-left text-sm"
                  onClick={() => onMove(p.id, null)}
                  disabled={isPending}
                  data-testid={`button-move-project-${p.id}`}
                >
                  <Circle className="h-3 w-3" style={{ color: p.color || "#5ADBFA", fill: p.color || "#5ADBFA" }} />
                  {p.name}
                </button>
                {projectSections.map((s) => (
                  <button
                    key={s.id}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 pl-8 rounded-lg hover-elevate transition-colors text-left text-sm text-muted-foreground"
                    onClick={() => onMove(p.id, s.id)}
                    disabled={isPending}
                    data-testid={`button-move-section-${s.id}`}
                  >
                    <ChevronRight className="h-3 w-3" />
                    {s.name}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
