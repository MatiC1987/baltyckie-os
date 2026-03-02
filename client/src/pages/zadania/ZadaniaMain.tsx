import { useState, useEffect, useCallback, useMemo } from "react";
import { useZadaniaAuth, zadaniaFetch } from "./ZadaniaApp";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Inbox, Star, CalendarDays, Sparkles, BookOpen, Moon,
  LogOut, Menu, X, MoreHorizontal, ChevronRight, ChevronDown,
  RefreshCw, Search, Trash2, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, parseISO, isToday, isYesterday, addDays, isBefore, startOfDay } from "date-fns";
import { pl } from "date-fns/locale";
import { TaskCheckbox } from "@/components/tasks/TaskCheckbox";
import { WhenPopover } from "@/components/tasks/WhenPopover";
import type { Task, TaskProject } from "@shared/schema";

type ViewType = "inbox" | "today" | "upcoming" | "someday" | "logbook";

const VIEWS: { key: ViewType; label: string; icon: any; color: string; showCount?: boolean }[] = [
  { key: "inbox", label: "Inbox", icon: Inbox, color: "#5ADBFA", showCount: true },
  { key: "today", label: "Dziś", icon: Star, color: "#FFD43B", showCount: true },
  { key: "upcoming", label: "Nadchodzące", icon: CalendarDays, color: "#51CF66" },
  { key: "someday", label: "Kiedyś", icon: Sparkles, color: "#C4B5FD" },
  { key: "logbook", label: "Dziennik", icon: BookOpen, color: "#868E96" },
];

export default function ZadaniaMain() {
  const { user, logout } = useZadaniaAuth();
  const { toast } = useToast();
  const [view, setView] = useState<ViewType>("today");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, projectsRes] = await Promise.all([
        zadaniaFetch('GET', '/api/task-panel/tasks'),
        zadaniaFetch('GET', '/api/task-panel/projects'),
      ]);
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (projectsRes.ok) setProjects(await projectsRes.json());
    } catch {
      toast({ title: "Błąd", description: "Nie udało się pobrać danych", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const filtered = useMemo(() => {
    const parentTasks = tasks.filter(t => !t.parentTaskId);
    switch (view) {
      case "inbox":
        return parentTasks.filter(t => !t.completed && !t.projectId && !t.someday);
      case "today":
        return parentTasks.filter(t => !t.completed && t.dueDate === todayStr);
      case "upcoming":
        return parentTasks.filter(t => !t.completed && !t.someday && t.dueDate && t.dueDate > todayStr)
          .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
      case "someday":
        return parentTasks.filter(t => !t.completed && t.someday);
      case "logbook":
        return parentTasks.filter(t => t.completed).sort((a, b) =>
          new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime()
        );
      default:
        return parentTasks;
    }
  }, [tasks, view, todayStr]);

  const counts = useMemo(() => ({
    inbox: tasks.filter(t => !t.completed && !t.projectId && !t.someday && !t.parentTaskId).length,
    today: tasks.filter(t => !t.completed && t.dueDate === todayStr && !t.parentTaskId).length,
  }), [tasks, todayStr]);

  const toggleComplete = useCallback(async (task: Task) => {
    const newCompleted = !task.completed;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: newCompleted, completedAt: newCompleted ? new Date().toISOString() : null } as Task : t));
    try {
      await zadaniaFetch('PATCH', `/api/task-panel/tasks/${task.id}`, {
        completed: newCompleted,
        completedAt: newCompleted ? new Date().toISOString() : null,
      });
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? task : t));
    }
  }, []);

  const updateTask = useCallback(async (taskId: number, data: Record<string, unknown>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...data } as Task : t));
    try {
      const res = await zadaniaFetch('PATCH', `/api/task-panel/tasks/${taskId}`, data);
      if (!res.ok) throw new Error();
    } catch {
      fetchData();
    }
  }, [fetchData]);

  const deleteTask = useCallback(async (taskId: number) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setEditingTask(null);
    setSelectedTaskId(null);
    try {
      await zadaniaFetch('DELETE', `/api/task-panel/tasks/${taskId}`);
    } catch {
      fetchData();
    }
  }, [fetchData]);

  const createTask = useCallback(async (title: string) => {
    if (!title.trim()) return;
    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        priority: "BRAK",
        tags: [],
      };
      if (view === "today") body.dueDate = todayStr;
      if (view === "someday") body.someday = true;
      const res = await zadaniaFetch('POST', '/api/task-panel/tasks', body);
      if (res.ok) {
        const task = await res.json();
        setTasks(prev => [...prev, task]);
        setNewTaskTitle("");
      }
    } catch {
      toast({ title: "Błąd", description: "Nie udało się dodać zadania", variant: "destructive" });
    }
  }, [view, todayStr, toast]);

  const handleViewChange = (v: ViewType) => {
    setView(v);
    setSelectedTaskId(null);
    setEditingTask(null);
    setSidebarOpen(false);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTaskId(task.id);
    setEditingTask(task);
  };

  const projectsMap = useMemo(() => {
    const m = new Map<number, TaskProject>();
    projects.forEach(p => m.set(p.id, p));
    return m;
  }, [projects]);

  const VIcon = VIEWS.find(v => v.key === view)?.icon || Inbox;
  const viewColor = VIEWS.find(v => v.key === view)?.color || "#5ADBFA";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex h-screen" data-testid="page-zadania">
      {isMobile && sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`shrink-0 border-r flex flex-col bg-muted/10 transition-transform duration-200 ${
        isMobile
          ? `fixed inset-y-0 left-0 z-50 w-[280px] bg-background ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
          : "w-[240px]"
      }`} data-testid="zadania-sidebar">
        <div className="p-4 border-b flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 text-sm font-bold">
            {user?.name?.[0] || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-[10px] text-muted-foreground truncate">{user?.email}</div>
          </div>
          {isMobile && (
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground" data-testid="button-close-sidebar">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {VIEWS.map((sv) => {
            const count = sv.key === "inbox" ? counts.inbox : sv.key === "today" ? counts.today : 0;
            const active = view === sv.key;
            return (
              <button
                key={sv.key}
                onClick={() => handleViewChange(sv.key)}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] w-full text-left transition-all duration-150 ${
                  active ? "bg-primary/10 text-foreground font-medium" : "hover:bg-muted/30 text-foreground/80"
                }`}
                data-testid={`button-view-${sv.key}`}
              >
                <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${active ? "" : "bg-muted/40"}`} style={active ? { backgroundColor: `${sv.color}20` } : undefined}>
                  <sv.icon className="h-3.5 w-3.5" style={{ color: sv.color }} />
                </div>
                <span className="flex-1">{sv.label}</span>
                {sv.showCount && count > 0 && (
                  <span className="text-[11px] min-w-[18px] text-center tabular-nums text-muted-foreground/70 font-medium">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="border-t px-3 py-2">
          <button onClick={logout} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-1 w-full" data-testid="button-logout">
            <LogOut className="h-3.5 w-3.5" />
            <span>Wyloguj się</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <div className="flex items-center gap-3 px-4 md:px-5 py-3 border-b border-border/30">
          {isMobile && (
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground" data-testid="button-mobile-menu">
              <Menu className="h-4 w-4" />
            </button>
          )}
          <VIcon className="h-5 w-5 shrink-0" style={{ color: viewColor }} />
          <h2 className="text-base md:text-lg font-semibold tracking-tight flex-1" data-testid="text-view-title">
            {VIEWS.find(v => v.key === view)?.label}
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground" data-testid="button-context-menu">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setAddingTask(true)}>
                <Plus className="h-3.5 w-3.5 mr-2" /> Nowe zadanie
              </DropdownMenuItem>
              <DropdownMenuItem onClick={fetchData}>
                <RefreshCw className="h-3.5 w-3.5 mr-2" /> Odśwież
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {addingTask && (
            <div className="mx-3 my-2 border border-border/60 rounded-xl shadow-md bg-card p-4" data-testid="inline-add-card">
              <Input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Nowe zadanie..."
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-[16px] font-medium px-0"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newTaskTitle.trim()) {
                    createTask(newTaskTitle);
                  }
                  if (e.key === "Escape") {
                    setAddingTask(false);
                    setNewTaskTitle("");
                  }
                }}
                data-testid="input-new-task"
              />
              <div className="flex items-center gap-2 mt-2">
                <Button size="sm" onClick={() => { createTask(newTaskTitle); }} disabled={!newTaskTitle.trim()} data-testid="button-save-task">
                  Dodaj
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingTask(false); setNewTaskTitle(""); }} data-testid="button-cancel-task">
                  Anuluj
                </Button>
              </div>
            </div>
          )}

          {filtered.length === 0 && !addingTask && (
            <div className="text-center text-muted-foreground/50 py-20" data-testid="text-empty-tasks">
              <VIcon className="h-12 w-12 mx-auto mb-3 opacity-15" />
              <p className="text-sm font-medium">
                {view === "today" ? "Brak zadań na dziś!" : view === "inbox" ? "Inbox jest pusty" : view === "logbook" ? "Brak ukończonych zadań" : "Brak zadań"}
              </p>
              <p className="text-xs mt-1 text-muted-foreground/40">
                {view === "today" ? "Wszystko zrobione. Miłego dnia!" : "Naciśnij + aby dodać zadanie"}
              </p>
            </div>
          )}

          {filtered.map((task) => {
            const project = task.projectId ? projectsMap.get(task.projectId) : null;
            const isSelected = selectedTaskId === task.id;
            const showProjectName = view !== "logbook";
            const isTodayTask = !task.completed && task.dueDate && isToday(parseISO(task.dueDate)) && view !== "today";
            const isEditing = editingTask?.id === task.id;

            if (isEditing) {
              return (
                <TaskEditCard
                  key={task.id}
                  task={editingTask!}
                  project={project}
                  onUpdate={(data) => {
                    updateTask(task.id, data);
                    setEditingTask({ ...editingTask!, ...data } as Task);
                  }}
                  onToggleComplete={() => toggleComplete(task)}
                  onDelete={() => deleteTask(task.id)}
                  onClose={() => { setEditingTask(null); setSelectedTaskId(null); }}
                />
              );
            }

            return (
              <div
                key={task.id}
                className={`flex items-start gap-3 px-4 md:px-6 py-3 cursor-pointer transition-colors duration-100 ${
                  isSelected ? "bg-muted/30" : "hover:bg-muted/20"
                }`}
                onClick={() => handleTaskClick(task)}
                data-testid={`task-row-${task.id}`}
              >
                {view === "today" && project && (
                  <div className="w-[7px] h-[7px] rounded-full mt-[7px] shrink-0" style={{ backgroundColor: project.color || "#5ADBFA" }} />
                )}
                <div className="mt-[2px] shrink-0" onClick={(e) => { e.stopPropagation(); toggleComplete(task); }}>
                  <TaskCheckbox
                    checked={!!task.completed}
                    priority={task.priority || "BRAK"}
                    onToggle={() => toggleComplete(task)}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[14px] leading-snug flex items-center gap-1.5 ${task.completed ? "line-through text-muted-foreground/50" : "text-foreground"}`}>
                    {isTodayTask && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                    <span className="truncate">{task.title}</span>
                    {task.recurring && <RefreshCw className="h-3 w-3 text-muted-foreground/40 shrink-0" />}
                    {task.evening && <Moon className="h-3 w-3 text-indigo-400/60 shrink-0" />}
                  </div>
                  {showProjectName && project && (
                    <div className="text-[12px] text-muted-foreground/50 mt-0.5 truncate">{project.name}</div>
                  )}
                  {view === "upcoming" && task.dueDate && (
                    <div className="text-[11px] text-muted-foreground/50 mt-0.5">
                      {format(parseISO(task.dueDate), "d MMM", { locale: pl })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="absolute bottom-6 right-4 z-40">
          <Button
            size="icon"
            className="rounded-full shadow-lg bg-indigo-600 hover:bg-indigo-700 h-12 w-12"
            onClick={() => setAddingTask(true)}
            data-testid="button-fab-add"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </main>
    </div>
  );
}

function TaskEditCard({
  task, project, onUpdate, onToggleComplete, onDelete, onClose,
}: {
  task: Task;
  project?: TaskProject | null;
  onUpdate: (data: Record<string, unknown>) => void;
  onToggleComplete: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || "");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (title.trim() !== task.title) onUpdate({ title: title.trim() });
        if (notes !== (task.notes || "")) onUpdate({ notes });
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [title, notes, task, onUpdate, onClose]);

  return (
    <div className="mx-3 my-1 border border-border/60 rounded-xl shadow-lg bg-card overflow-hidden" data-testid={`edit-card-${task.id}`}>
      <div className="flex items-start gap-3 px-4 pt-4 pb-2">
        <div className="mt-1 shrink-0">
          <TaskCheckbox checked={!!task.completed} priority={task.priority || "BRAK"} onToggle={onToggleComplete} />
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title.trim() !== task.title) onUpdate({ title: title.trim() }); }}
          className="flex-1 text-[16px] font-medium bg-transparent border-0 outline-none py-0"
          autoFocus
          data-testid={`edit-card-title-${task.id}`}
        />
      </div>

      <div className="px-4 pl-[48px] pb-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => { if (notes !== (task.notes || "")) onUpdate({ notes }); }}
          placeholder="Notatki..."
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 text-[14px] text-muted-foreground min-h-[24px] resize-none placeholder:text-muted-foreground/40"
          rows={2}
          data-testid={`edit-card-notes-${task.id}`}
        />
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/30">
        <div className="flex items-center gap-2">
          <WhenPopover
            currentDate={task.dueDate}
            evening={!!task.evening}
            someday={!!task.someday}
            onSelectToday={() => onUpdate({ dueDate: todayStr, evening: false, someday: false })}
            onSelectEvening={() => onUpdate({ evening: true, dueDate: todayStr, someday: false })}
            onSelectDate={(date) => onUpdate({ dueDate: date, evening: false, someday: false })}
            onSelectSomeday={() => onUpdate({ someday: true, dueDate: null, evening: false })}
            onClear={() => onUpdate({ dueDate: null, evening: false, someday: false })}
          >
            <button className="p-1.5 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors" data-testid={`edit-card-when-${task.id}`}>
              <CalendarDays className="h-4 w-4" />
            </button>
          </WhenPopover>
          {project && (
            <span className="text-[11px] text-muted-foreground/50 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color || "#5ADBFA" }} />
              {project.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            className="p-1.5 rounded-md text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
            data-testid={`edit-card-delete-${task.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (title.trim() !== task.title) onUpdate({ title: title.trim() });
              if (notes !== (task.notes || "")) onUpdate({ notes });
              onClose();
            }}
            className="p-1.5 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
            data-testid={`edit-card-close-${task.id}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
