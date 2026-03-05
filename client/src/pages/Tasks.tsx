import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DefaultTasksApiProvider } from "@/lib/tasksApiContext";
import { AnimatePresence } from "framer-motion";
import { format, parseISO, isToday, isTomorrow, isYesterday } from "date-fns";
import { pl } from "date-fns/locale";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { Task, TaskProject, TaskSection } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useTasksApi } from "@/lib/tasksApiContext";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Circle,
  PanelLeftClose, PanelLeft, MoreHorizontal, ArrowRight,
  Copy, GripVertical, Menu, X, Flag, Pencil, Search,
  Inbox, Star, Sun, Moon, Clock, AlertTriangle, BookOpen, Sparkles,
  CalendarDays, RefreshCw, Layers, Tag, ListPlus, CheckSquare, UserPlus, Check, Calendar,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext, DragOverlay, closestCenter, pointerWithin, rectIntersection,
  KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragStartEvent, type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { WhenPopover } from "@/components/tasks/WhenPopover";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { TaskRow } from "@/components/tasks/TaskRow";
import { TaskDetailPanel } from "@/components/tasks/TaskDetailPanel";
import { TaskInlineCard } from "@/components/tasks/TaskInlineCard";
import { TaskSidebar, SidebarFooter } from "@/components/tasks/TaskSidebar";
import { TaskInlineAdd } from "@/components/tasks/TaskInlineAdd";
import { QuickFind } from "@/components/tasks/QuickFind";
import { TaskDialog, ProjectDialog, SectionDialog, SettingsDialog, MoveDialog, AreaDialog } from "@/components/tasks/TaskDialogs";
import {
  type ViewType, type TaskFontSize,
  PRIORITY_FLAG_COLORS, PRIORITY_LABELS,
  filterTasks, sortTasks, viewLabel, viewIcon, isOverdue, getTagColor,
  getStoredShowCounts, getStoredShowOverdueInToday, getStoredWeekStart, getStoredDefaultPriority, getStoredDefaultProject, getStoredFontSize,
  buildUpcomingGroups, buildAnytimeGroups,
  getProjectCompletedTasks, getProjectLaterTasks,
  getProjectHideLater, setProjectHideLater,
  getProjectShowLogged, setProjectShowLogged,
} from "@/components/tasks/taskUtils";

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

const customCollisionDetection: CollisionDetection = (args) => {
  const activeId = String(args.active.id);
  const isDraggingProject = activeId.startsWith("sortable-project-");
  const isDraggingAreaItem = activeId.startsWith("sortable-area-");

  if (isDraggingAreaItem) {
    const pointerHits = pointerWithin(args);
    const areaHit = pointerHits.find(c => String(c.id).startsWith("sortable-area-") && c.id !== activeId);
    if (areaHit) return [areaHit];
    return closestCenter(args);
  }

  if (isDraggingProject) {
    const pointerHits = pointerWithin(args);
    const areaHit = pointerHits.find(c => String(c.id).startsWith("droppable-area-"));
    const sortableHit = pointerHits.find(c => String(c.id).startsWith("sortable-project-"));
    if (sortableHit) return [sortableHit];
    if (areaHit) return [areaHit];
    return closestCenter(args);
  }

  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    const sidebarHit = pointerCollisions.find(c =>
      String(c.id).startsWith("sidebar-project-") || String(c.id) === "sidebar-inbox"
    );
    if (sidebarHit) return [sidebarHit];
    return pointerCollisions;
  }
  return closestCenter(args);
};

export function TasksCore() {
  const { toast } = useToast();
  const { apiRequest, currentUser: user, isZadaniaPanel, onLogout } = useTasksApi();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewType>("inbox");
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [addAreaOpen, setAddAreaOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quickFindOpen, setQuickFindOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(window.innerWidth < 768);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [inlineAddVisible, setInlineAddVisible] = useState(false);
  const [inlineAddTarget, setInlineAddTarget] = useState<string | undefined>(undefined);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expandedTasks, setExpandedTasks] = useState<Set<number>>(new Set());
  const [showCounts, setShowCounts] = useState(getStoredShowCounts);
  const [showOverdueInToday, setShowOverdueInToday] = useState(getStoredShowOverdueInToday);
  const [weekStart, setWeekStart] = useState<0 | 1>(getStoredWeekStart);
  const [sortBy, setSortBy] = useState<string>("manual");
  const [fontSize, setFontSize] = useState<TaskFontSize>(getStoredFontSize);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [renamingSectionId, setRenamingSectionId] = useState<number | null>(null);
  const [renamingSectionName, setRenamingSectionName] = useState("");
  const renameSectionInputRef = useRef<HTMLInputElement>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [todayBannerDismissed, setTodayBannerDismissed] = useState(false);
  const [anytimeExpandedProjects, setAnytimeExpandedProjects] = useState<Set<number>>(new Set());
  const [projectHideLater, setProjectHideLaterState] = useState<Record<number, boolean>>({});
  const [projectShowLogged, setProjectShowLoggedState] = useState<Record<number, boolean>>({});
  const [filterTags, setFilterTags] = useState<Set<string>>(new Set());
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [assignCheckedIds, setAssignCheckedIds] = useState<Set<number>>(new Set());
  const [bulkTagsInput, setBulkTagsInput] = useState("");
  const [bulkTagsOpen, setBulkTagsOpen] = useState(false);
  const [bulkDeadlineInput, setBulkDeadlineInput] = useState("");
  const [bulkDeadlineOpen, setBulkDeadlineOpen] = useState(false);
  const [areaOrder, setAreaOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("tasksAreaOrder") || "[]"); } catch { return []; }
  });

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
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const toggleComplete = useMutation({
    mutationFn: (task: Task) =>
      apiRequest("PATCH", `/api/tasks/${task.id}`, {
        completed: !task.completed,
        completedAt: !task.completed ? new Date().toISOString() : null,
      }),
    onMutate: async (task: Task) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const prev = queryClient.getQueryData<Task[]>(["/api/tasks"]);
      queryClient.setQueryData<Task[]>(["/api/tasks"], old =>
        (old || []).map(t => t.id === task.id ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : null } : t)
      );
      return { prev };
    },
    onError: (_err, _task, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/tasks"], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const updateTask = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/tasks/${id}`, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const prev = queryClient.getQueryData<Task[]>(["/api/tasks"]);
      queryClient.setQueryData<Task[]>(["/api/tasks"], old =>
        (old || []).map(t => t.id === id ? { ...t, ...data } as Task : t)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/tasks"], ctx.prev);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const deleteTask = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/tasks/${id}`),
    onMutate: async (id: number) => {
      await queryClient.cancelQueries({ queryKey: ["/api/tasks"] });
      const prev = queryClient.getQueryData<Task[]>(["/api/tasks"]);
      queryClient.setQueryData<Task[]>(["/api/tasks"], old => (old || []).filter(t => t.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["/api/tasks"], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Zadanie usunięte" });
    },
  });

  const createTask = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/tasks", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
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
    mutationFn: (data: { ids: number[]; projectId: number | null; sectionId: number | null; clearSchedule?: boolean }) =>
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

  const bulkAssign = useMutation({
    mutationFn: (data: { taskIds: number[]; employeeIds: number[] }) =>
      apiRequest("POST", "/api/tasks/bulk-assign", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedTasks(new Set());
      toast({ title: "Przydzielono pracowników" });
    },
  });

  const bulkComplete = useMutation({
    mutationFn: (data: { taskIds: number[]; completed: boolean }) =>
      apiRequest("POST", "/api/tasks/bulk-complete", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedTasks(new Set());
      toast({ title: "Zadania oznaczone jako ukończone" });
    },
  });

  const bulkTags = useMutation({
    mutationFn: (data: { taskIds: number[]; tags: string[] }) =>
      apiRequest("POST", "/api/tasks/bulk-tags", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedTasks(new Set());
      toast({ title: "Tagi ustawione" });
    },
  });

  const bulkDeadline = useMutation({
    mutationFn: (data: { taskIds: number[]; deadlineDate: string }) =>
      apiRequest("POST", "/api/tasks/bulk-deadline", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedTasks(new Set());
      toast({ title: "Deadline ustawiony" });
    },
  });

  const bulkDuplicate = useMutation({
    mutationFn: (data: { taskIds: number[] }) =>
      apiRequest("POST", "/api/tasks/bulk-duplicate", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({ title: "Zadania zduplikowane" });
    },
  });

  const filtered = useMemo(
    () => filterTasks(tasks, view, weekStart, showOverdueInToday, user?.id),
    [tasks, view, weekStart, showOverdueInToday, user?.id]
  );

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    filtered.forEach(t => {
      if (t.tags && Array.isArray(t.tags)) {
        t.tags.forEach(tag => { if (tag) tagSet.add(tag); });
      }
    });
    return Array.from(tagSet).sort();
  }, [filtered]);

  const tagFilteredTasks = useMemo(() => {
    if (filterTags.size === 0) return filtered;
    return filtered.filter(t =>
      t.tags && Array.isArray(t.tags) && t.tags.some(tag => filterTags.has(tag))
    );
  }, [filtered, filterTags]);

  const isAreaView = typeof view === "object" && "area" in view;
  const isProjectView = typeof view === "object" && "projectId" in view;
  const projectSections = isProjectView ? sections.filter((s) => s.projectId === (view as { projectId: number }).projectId) : [];

  const [renamingArea, setRenamingArea] = useState(false);
  const [renamingAreaName, setRenamingAreaName] = useState("");
  const renameAreaInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingArea && renameAreaInputRef.current) {
      renameAreaInputRef.current.focus();
      renameAreaInputRef.current.select();
    }
  }, [renamingArea]);

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

  const projectsMap = useMemo(() => {
    const map = new Map<number, TaskProject>();
    projects.forEach(p => map.set(p.id, p));
    return map;
  }, [projects]);

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

  const toggleExpand = useCallback((taskId: number) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTasks(new Set());
  }, []);

  const handleViewChange = useCallback((newView: ViewType) => {
    setView(newView);
    setSelectedTasks(new Set());
    setDetailTask(null);
    setInlineAddVisible(false);
    setTodayBannerDismissed(false);
    setFilterTags(new Set());
    setMultiSelectMode(false);
    if (isMobile) setSidebarCollapsed(true);
    if (typeof newView === "object" && "projectId" in newView) {
      const pid = newView.projectId;
      setProjectHideLaterState(prev => ({ ...prev, [pid]: getProjectHideLater(pid) }));
      setProjectShowLoggedState(prev => ({ ...prev, [pid]: getProjectShowLogged(pid) }));
    }
  }, [isMobile]);

  const [inlineCardTaskId, setInlineCardTaskId] = useState<number | null>(null);

  const handleTaskClick = useCallback((task: Task) => {
    if (multiSelectMode) {
      setSelectedTasks(prev => {
        const next = new Set(prev);
        next.has(task.id) ? next.delete(task.id) : next.add(task.id);
        return next;
      });
      return;
    }
    setSelectedTasks(new Set([task.id]));
    if (isMobile) {
      setDetailTask(task);
    } else {
      setInlineCardTaskId(prev => prev === task.id ? null : task.id);
    }
  }, [isMobile, multiSelectMode]);

  const handleToggleComplete = useCallback((task: Task) => {
    toggleComplete.mutate(task);
  }, [toggleComplete]);

  const handleSectionRenameSubmit = useCallback((sectionId: number) => {
    if (renamingSectionName.trim()) {
      updateSection.mutate({ id: sectionId, data: { name: renamingSectionName.trim() } });
    }
    setRenamingSectionId(null);
    setRenamingSectionName("");
  }, [renamingSectionName, updateSection]);

  const handleAreaRenameSubmit = useCallback(() => {
    if (!isAreaView || !renamingAreaName.trim()) {
      setRenamingArea(false);
      return;
    }
    const oldAreaName = (view as { area: string }).area;
    const newAreaName = renamingAreaName.trim();
    if (oldAreaName === newAreaName) {
      setRenamingArea(false);
      return;
    }
    const areaProjects = projects.filter(p => p.area === oldAreaName);
    areaProjects.forEach(p => {
      updateProject.mutate({ id: p.id, data: { area: newAreaName } });
    });
    setView({ area: newAreaName });
    setRenamingArea(false);
    toast({ title: "Nazwa zmieniona" });
  }, [isAreaView, view, renamingAreaName, projects, updateProject, toast]);

  const handleAreaDelete = useCallback(() => {
    if (!isAreaView) return;
    const areaName = (view as { area: string }).area;
    const areaProjects = projects.filter(p => p.area === areaName);
    areaProjects.forEach(p => {
      updateProject.mutate({ id: p.id, data: { area: null } });
    });
    setView("inbox");
    toast({ title: "Obszar usunięty" });
  }, [isAreaView, view, projects, updateProject, toast]);

  const saveAreaOrder = useCallback((newOrder: string[]) => {
    setAreaOrder(newOrder);
    localStorage.setItem("tasksAreaOrder", JSON.stringify(newOrder));
  }, []);

  const handleSidebarAreaRename = useCallback((oldName: string, newName: string) => {
    const existingAreas = new Set(projects.filter(p => !p.archived && p.area).map(p => p.area!));
    if (existingAreas.has(newName) && newName !== oldName) {
      toast({ title: "Taka przestrzeń już istnieje", variant: "destructive" });
      return;
    }
    const areaProjects = projects.filter(p => p.area === oldName);
    areaProjects.forEach(p => {
      updateProject.mutate({ id: p.id, data: { area: newName } });
    });
    tasks.filter(t => t.area === oldName).forEach(t => {
      updateTask.mutate({ id: t.id, data: { area: newName } });
    });
    saveAreaOrder(areaOrder.map(a => a === oldName ? newName : a));
    if (isAreaView && (view as { area: string }).area === oldName) {
      setView({ area: newName });
    }
    toast({ title: "Nazwa zmieniona" });
  }, [projects, tasks, updateProject, updateTask, isAreaView, view, toast, areaOrder, saveAreaOrder]);

  const handleSidebarAreaDelete = useCallback((areaName: string) => {
    const areaProjects = projects.filter(p => p.area === areaName);
    areaProjects.forEach(p => {
      updateProject.mutate({ id: p.id, data: { area: null } });
    });
    tasks.filter(t => t.area === areaName).forEach(t => {
      updateTask.mutate({ id: t.id, data: { area: null } });
    });
    saveAreaOrder(areaOrder.filter(a => a !== areaName));
    if (isAreaView && (view as { area: string }).area === areaName) {
      setView("inbox");
    }
    toast({ title: "Przestrzeń usunięta" });
  }, [projects, tasks, updateProject, updateTask, isAreaView, view, toast, areaOrder, saveAreaOrder]);

  const handleInlineSubmit = useCallback((data: Record<string, unknown>) => {
    if (isAreaView) {
      const areaName = (view as { area: string }).area;
      createTask.mutate({ ...data, area: areaName });
    } else {
      createTask.mutate(data);
    }
  }, [createTask, isAreaView, view]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (isInput) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "f" || e.key === "k")) {
        e.preventDefault();
        setQuickFindOpen(true);
        return;
      }

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setInlineAddVisible(true);
        return;
      }

      const viewKeys: Record<string, ViewType> = {
        "1": "inbox", "2": "today", "3": "upcoming", "4": "anytime", "5": "someday", "6": "logbook",
      };
      if (viewKeys[e.key]) {
        e.preventDefault();
        handleViewChange(viewKeys[e.key]);
        return;
      }

      if (e.key === "t" || e.key === "T") {
        if (selectedTasks.size === 1) {
          const taskId = Array.from(selectedTasks)[0];
          updateTask.mutate({ id: taskId, data: { dueDate: format(new Date(), "yyyy-MM-dd") } });
          toast({ title: "Termin ustawiony na dziś" });
        }
      }

      if (e.key === "s" || e.key === "S") {
        if (selectedTasks.size === 1) {
          const taskId = Array.from(selectedTasks)[0];
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            updateTask.mutate({ id: taskId, data: { someday: !task.someday } });
            toast({ title: task.someday ? "Usunięto z Someday" : "Oznaczono jako Someday" });
          }
        }
      }

      if (e.key === "e" || e.key === "E") {
        if (selectedTasks.size === 1) {
          const taskId = Array.from(selectedTasks)[0];
          const task = tasks.find(t => t.id === taskId);
          if (task) {
            updateTask.mutate({ id: taskId, data: { evening: !task.evening } });
            toast({ title: task.evening ? "Usunięto z Wieczorem" : "Oznaczono jako Wieczorne" });
          }
        }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        if (selectedTasks.size === 1) {
          e.preventDefault();
          const taskId = Array.from(selectedTasks)[0];
          const task = tasks.find(t => t.id === taskId);
          if (task) toggleComplete.mutate(task);
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
        if (inlineCardTaskId) {
          setInlineCardTaskId(null);
          clearSelection();
        } else if (detailTask) {
          setDetailTask(null);
        } else {
          clearSelection();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedTasks, detailTask, tasks, updateTask, toggleComplete, duplicateTask, toast, clearSelection, handleViewChange, inlineCardTaskId]);

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
    if (activeDragId.startsWith("sortable-project-")) {
      const projectId = Number(activeDragId.replace("sortable-project-", ""));
      return { type: "project" as const, item: projects.find(p => p.id === projectId) };
    }
    return null;
  }, [activeDragId, tasks, sections, projects]);

  const handleMainDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleMainDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith("sortable-area-") && overId.startsWith("sortable-area-")) {
      const activeArea = activeId.replace("sortable-area-", "");
      const overArea = overId.replace("sortable-area-", "");
      const uniqueAreas = Array.from(new Set(projects.filter(p => !p.archived && p.area).map(p => p.area!)));
      const currentOrder = areaOrder.filter(a => uniqueAreas.includes(a));
      const unordered = uniqueAreas.filter(a => !areaOrder.includes(a));
      const fullOrder = [...currentOrder, ...unordered];
      const oldIdx = fullOrder.indexOf(activeArea);
      const newIdx = fullOrder.indexOf(overArea);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(fullOrder, oldIdx, newIdx);
      saveAreaOrder(reordered);
      return;
    }

    if (activeId.startsWith("sortable-project-") && overId.startsWith("droppable-area-")) {
      const activeProjectId = Number(activeId.replace("sortable-project-", ""));
      const targetArea = overId.replace("droppable-area-", "");
      const newArea = targetArea === "ungrouped" ? null : targetArea;
      const activeProject = projects.find(p => p.id === activeProjectId);
      if (!activeProject || (activeProject.area || null) === newArea) return;
      updateProject.mutate({ id: activeProjectId, data: { area: newArea } });
      toast({ title: newArea ? `Przeniesiono do "${newArea}"` : "Usunięto z przestrzeni" });
      return;
    }

    if (activeId.startsWith("sortable-project-") && overId.startsWith("sortable-project-")) {
      const activeProjectId = Number(activeId.replace("sortable-project-", ""));
      const overProjectId = Number(overId.replace("sortable-project-", ""));
      const activeProject = projects.find(p => p.id === activeProjectId);
      const overProject = projects.find(p => p.id === overProjectId);
      if (!activeProject || !overProject) return;
      const sameArea = (activeProject.area || "") === (overProject.area || "");
      if (!sameArea) {
        updateProject.mutate({ id: activeProjectId, data: { area: overProject.area || null } });
        return;
      }
      const groupArea = overProject.area || "";
      const groupProjects = projects
        .filter(p => !p.archived && (p.area || "") === groupArea)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      const oldIdx = groupProjects.findIndex(p => p.id === activeProjectId);
      const newIdx = groupProjects.findIndex(p => p.id === overProjectId);
      if (oldIdx === -1 || newIdx === -1) return;
      const reordered = arrayMove(groupProjects, oldIdx, newIdx);
      batchReorderProjects.mutate(reordered.map((p, i) => ({ id: p.id, sortOrder: i })));
      return;
    }

    if (activeId.startsWith("task-") && overId.startsWith("sidebar-project-")) {
      const taskId = Number(activeId.replace("task-", ""));
      const projectId = Number(overId.replace("sidebar-project-", ""));
      updateTask.mutate({ id: taskId, data: { projectId, sectionId: null } });
      return;
    }

    if (activeId.startsWith("task-") && overId === "sidebar-inbox") {
      const taskId = Number(activeId.replace("task-", ""));
      updateTask.mutate({ id: taskId, data: { projectId: null, sectionId: null, dueDate: null, evening: false, someday: false } });
      return;
    }

    if (activeId.startsWith("task-") && overId.startsWith("task-")) {
      const activeTaskId = Number(activeId.replace("task-", ""));
      const overTaskId = Number(overId.replace("task-", ""));
      const sortedFiltered = sortTasks(tagFilteredTasks, sortBy);

      if (isProjectView) {
        const activeTask = tasks.find(t => t.id === activeTaskId);
        const overTask = tasks.find(t => t.id === overTaskId);
        if (!activeTask || !overTask) return;

        const activeSectionId = activeTask.sectionId;
        const overSectionId = overTask.sectionId;

        if (activeSectionId === overSectionId) {
          const sectionTasks = sortTasks(tagFilteredTasks.filter(t => t.sectionId === activeSectionId), sortBy);
          const oldIdx = sectionTasks.findIndex(t => t.id === activeTaskId);
          const newIdx = sectionTasks.findIndex(t => t.id === overTaskId);
          if (oldIdx === -1 || newIdx === -1) return;
          const reordered = arrayMove(sectionTasks, oldIdx, newIdx);
          batchReorderTasks.mutate(reordered.map((t, i) => ({ id: t.id, sortOrder: i })));
        } else {
          const targetSectionTasks = sortTasks(tagFilteredTasks.filter(t => t.sectionId === overSectionId), sortBy);
          const overIdx = targetSectionTasks.findIndex(t => t.id === overTaskId);
          const newSectionTasks = [...targetSectionTasks];
          const movedTask = { ...activeTask, sectionId: overSectionId };
          newSectionTasks.splice(overIdx, 0, movedTask as Task);
          batchReorderTasks.mutate(
            newSectionTasks.map((t, i) => ({
              id: t.id, sortOrder: i,
              ...(t.id === activeTaskId ? { sectionId: overSectionId } : {}),
            }))
          );
        }
      } else {
        const oldIdx = sortedFiltered.findIndex(t => t.id === activeTaskId);
        const newIdx = sortedFiltered.findIndex(t => t.id === overTaskId);
        if (oldIdx === -1 || newIdx === -1) return;
        const reordered = arrayMove(sortedFiltered, oldIdx, newIdx);
        batchReorderTasks.mutate(reordered.map((t, i) => ({ id: t.id, sortOrder: i })));
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
      batchReorderSections.mutate(reordered.map((s, i) => ({ id: s.id, sortOrder: i })));
    }
  }, [tagFilteredTasks, sortBy, isProjectView, tasks, projects, projectSections, batchReorderTasks, batchReorderSections, batchReorderProjects, updateTask, updateProject, toast, areaOrder, saveAreaOrder]);

  const VIcon = viewIcon(view);
  const selectedTasksArray = selectedTasks.size > 0 ? Array.from(selectedTasks) : inlineCardTaskId ? [inlineCardTaskId] : [];
  const showProjectBar = !isProjectView && !isAreaView && view !== "anytime";

  const emptyStateConfig: Record<string, { icon: any; title: string; subtitle: string }> = {
    inbox: { icon: Inbox, title: "Skrzynka jest pusta", subtitle: "Naciśnij N, aby dodać nowe zadanie" },
    today: { icon: Star, title: "Nic na dziś!", subtitle: "Wszystko zrobione. Miłego dnia." },
    upcoming: { icon: CalendarDays, title: "Brak nadchodzących zadań", subtitle: "Zaplanuj przyszłe zadania" },
    anytime: { icon: Layers, title: "Brak zadań w Kiedykolwiek", subtitle: "Przypisz zadania do projektów" },
    someday: { icon: Sparkles, title: "Kiedyś jest puste", subtitle: "Przenieś tutaj pomysły na później" },
    logbook: { icon: BookOpen, title: "Dziennik jest pusty", subtitle: "Ukończone zadania pojawią się tutaj" },
    project: { icon: null, title: "Brak zadań w tym projekcie", subtitle: "Naciśnij N, aby dodać" },
  };

  const emptyKey = isProjectView ? "project" : isAreaView ? "area" : (view as string);
  const emptyState = emptyStateConfig[emptyKey] || emptyStateConfig.inbox;

  const todayGrouped = useMemo(() => {
    if (view !== "today") return null;
    const allTasks: Task[] = [];
    const evening: Task[] = [];
    tagFilteredTasks.forEach((t) => {
      if (t.evening) evening.push(t);
      else allTasks.push(t);
    });
    return { tasks: allTasks, evening };
  }, [view, tagFilteredTasks]);

  const upcomingGroups = useMemo(() => {
    if (view !== "upcoming") return null;
    return buildUpcomingGroups(tagFilteredTasks);
  }, [view, tagFilteredTasks]);

  const anytimeGroups = useMemo(() => {
    if (view !== "anytime") return null;
    return buildAnytimeGroups(tagFilteredTasks, projects);
  }, [view, tagFilteredTasks, projects]);

  const areaData = useMemo(() => {
    if (!isAreaView) return null;
    const areaName = (view as { area: string }).area;
    const areaProjects = projects.filter(p => p.area === areaName && !p.archived).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const tagSet = new Set<string>();
    areaProjects.forEach(p => {
      tasks.filter(t => t.projectId === p.id).forEach(t => {
        (t.tags || []).forEach((tag: string) => tagSet.add(tag));
      });
    });
    return { areaName, projects: areaProjects, tags: Array.from(tagSet) };
  }, [isAreaView, view, projects, tasks]);

  const logbookGrouped = useMemo(() => {
    if (view !== "logbook") return null;
    const todayTasks: Task[] = [];
    const yesterday: Task[] = [];
    const older: Task[] = [];
    tagFilteredTasks.forEach((t) => {
      if (t.completedAt) {
        const d = new Date(t.completedAt);
        if (isToday(d)) todayTasks.push(t);
        else if (isYesterday(d)) yesterday.push(t);
        else older.push(t);
      } else {
        older.push(t);
      }
    });
    const groups: { label: string; tasks: Task[] }[] = [];
    if (todayTasks.length) groups.push({ label: "Dzisiaj", tasks: todayTasks });
    if (yesterday.length) groups.push({ label: "Wczoraj", tasks: yesterday });
    if (older.length) groups.push({ label: "Starsze", tasks: older });
    return groups;
  }, [view, tagFilteredTasks]);

  const renderTaskItem = useCallback((t: Task, indent = 0, dragListeners?: Record<string, any>) => {
    const children = childTasksMap.get(t.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedTasks.has(t.id);
    const project = t.projectId ? projectsMap.get(t.projectId) : null;
    const isInlineOpen = inlineCardTaskId === t.id;

    if (isInlineOpen && !isMobile) {
      return (
        <div key={t.id}>
          <TaskInlineCard
            task={t}
            project={project}
            onUpdate={(data) => updateTask.mutate({ id: t.id, data })}
            onToggleComplete={() => handleToggleComplete(t)}
            onClose={() => { setInlineCardTaskId(null); clearSelection(); }}
          />
        </div>
      );
    }

    return (
      <div key={t.id}>
        <TaskRow
          task={t}
          isSelected={selectedTasks.has(t.id)}
          view={view}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          childCompletedCount={children.filter(c => c.completed).length}
          childTotalCount={children.length}
          indent={indent}
          project={project}
          showProjectBar={showProjectBar}
          isMobile={isMobile}
          dragListeners={dragListeners}
          onToggleComplete={handleToggleComplete}
          onClick={handleTaskClick}
          onToggleExpand={toggleExpand}
        />
        {hasChildren && isExpanded && (
          <div>
            {children
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((child) => renderTaskItem(child, indent + 1))}
          </div>
        )}
      </div>
    );
  }, [childTasksMap, expandedTasks, selectedTasks, view, showProjectBar, projectsMap, handleToggleComplete, handleTaskClick, toggleExpand, inlineCardTaskId, isMobile, updateTask, clearSelection]);

  const renderSortableTaskList = useCallback((taskList: Task[]) => {
    const sorted = sortTasks(taskList, sortBy);
    const ids = sorted.map(t => `task-${t.id}`);
    return (
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {sorted.map((t) => (
          <SortableTaskRow key={t.id} id={`task-${t.id}`}>
            {(listeners) => renderTaskItem(t, 0, listeners)}
          </SortableTaskRow>
        ))}
      </SortableContext>
    );
  }, [sortBy, renderTaskItem]);

  const renderGroupedView = () => {
    if (view === "today" && todayGrouped) {
      return (
        <>
          {!todayBannerDismissed && tagFilteredTasks.length > 0 && (
            <div className={`${isMobile ? 'mx-2' : 'mx-4'} mt-3 mb-2 flex items-center justify-between px-4 py-2 rounded-lg border border-amber-200/60 dark:border-amber-800/40`} style={{ backgroundColor: "#FFF9DB" }} data-testid="today-banner">
              <span className="text-[13px] text-amber-900 dark:text-amber-200">
                You have <strong>{tagFilteredTasks.length}</strong> new to-dos
              </span>
              <button
                onClick={() => setTodayBannerDismissed(true)}
                className="text-[12px] font-semibold text-amber-700 dark:text-amber-300 hover:text-amber-900 px-2 py-0.5 rounded"
                data-testid="button-dismiss-banner"
              >
                OK
              </button>
            </div>
          )}
          {renderSortableTaskList(todayGrouped.tasks)}
          {todayGrouped.evening.length > 0 && (
            <div>
              <div className="px-6 py-2 text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider flex items-center gap-2 mt-2">
                <Moon className="h-3 w-3 text-indigo-400/60" />
                This Evening
              </div>
              {renderSortableTaskList(todayGrouped.evening)}
            </div>
          )}
        </>
      );
    }

    if (view === "upcoming" && upcomingGroups) {
      return (
        <div className="py-2">
          {upcomingGroups.map((group) => (
            <div key={group.key} className="mb-1">
              {group.dayNumber && !group.isRange ? (
                <div className={`${isMobile ? 'px-4' : 'px-6'} py-3 flex items-baseline gap-2 border-b border-border/15`}>
                  <span className={`${isMobile ? 'text-[28px]' : 'text-[32px]'} font-bold leading-none text-foreground tabular-nums`}>{group.dayNumber}</span>
                  <span className="text-[15px] text-muted-foreground/70 capitalize">{group.dayName}</span>
                </div>
              ) : (
                <div className={`${isMobile ? 'px-4' : 'px-6'} py-3 border-b border-border/15`}>
                  <span className="text-[15px] font-semibold text-foreground capitalize">{group.label}</span>
                </div>
              )}
              {group.tasks.length > 0 ? (
                renderSortableTaskList(group.tasks)
              ) : (
                !group.isRange && <div className="h-2" />
              )}
            </div>
          ))}
        </div>
      );
    }

    if (view === "anytime" && anytimeGroups) {
      return (
        <div className="py-2">
          {anytimeGroups.map((group) => {
            const isExpanded = !anytimeExpandedProjects.has(group.projectId) || anytimeExpandedProjects.has(group.projectId);
            const showLimit = anytimeExpandedProjects.has(group.projectId) ? group.tasks.length : 4;
            const visibleTasks = group.tasks.slice(0, showLimit);
            const remaining = group.tasks.length - showLimit;

            return (
              <div key={group.projectId} className="mb-2">
                <button
                  onClick={() => handleViewChange({ projectId: group.projectId })}
                  className={`flex items-center gap-2 ${isMobile ? 'px-4' : 'px-6'} py-2.5 w-full text-left hover:bg-muted/20 transition-colors`}
                  data-testid={`anytime-project-${group.projectId}`}
                >
                  <Circle className="h-4 w-4 shrink-0" style={{ color: group.projectColor, fill: group.projectColor }} />
                  <span className="text-[14px] font-semibold text-foreground flex-1">{group.projectName}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                </button>
                {visibleTasks.map((t) => {
                  const project = projectsMap.get(t.projectId!);
                  const isTodayTask = t.dueDate && isToday(parseISO(t.dueDate));
                  return (
                    <div
                      key={t.id}
                      className={`flex items-center gap-3 px-6 py-2 ${isMobile ? 'pl-8' : 'pl-12'} cursor-pointer hover:bg-muted/20 transition-colors ${selectedTasks.has(t.id) ? "bg-muted/30" : ""}`}
                      onClick={() => handleTaskClick(t)}
                      data-testid={`task-row-${t.id}`}
                    >
                      <div className="shrink-0">
                        <div
                          className="h-[18px] w-[18px] rounded-full border-[1.5px] flex items-center justify-center cursor-pointer hover:opacity-80"
                          style={{ borderColor: "#9ca3af" }}
                          onClick={(e) => { e.stopPropagation(); handleToggleComplete(t); }}
                        />
                      </div>
                      <span className="text-[13.5px] text-foreground truncate flex items-center gap-1.5">
                        {isTodayTask && <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />}
                        {t.title}
                      </span>
                    </div>
                  );
                })}
                {remaining > 0 && (
                  <button
                    onClick={() => setAnytimeExpandedProjects(prev => { const n = new Set(prev); n.add(group.projectId); return n; })}
                    className={`px-12 py-1.5 text-[12px] text-primary/70 hover:text-primary transition-colors ${isMobile ? 'min-h-[44px] flex items-center' : ''}`}
                    data-testid={`anytime-show-more-${group.projectId}`}
                  >
                    Pokaż {remaining} więcej
                  </button>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (view === "logbook" && logbookGrouped) {
      return logbookGrouped.map(({ label, tasks: groupTasks }) => (
        <div key={label}>
          <div className="px-6 py-2 text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
            {label}
          </div>
          {groupTasks.map((t) => renderTaskItem(t))}
        </div>
      ));
    }

    if (isAreaView && areaData) {
      const areaTasks = tagFilteredTasks;
      const sortedAreaTasks = sortTasks(areaTasks, sortBy);
      return (
        <div className="py-4" data-testid="area-view">
          {areaData.projects.length > 0 && (
            <div className="mb-4">
              <div className={`text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 ${isMobile ? 'px-4' : 'px-6'} mb-2`}>Projekty</div>
              <div className="space-y-0.5">
                {areaData.projects.map((p) => {
                  const projectTasks = tasks.filter(t => t.projectId === p.id && t.parentTaskId === null);
                  const completedCount = projectTasks.filter(t => t.completed).length;
                  const totalCount = projectTasks.length;
                  const color = p.color || "#5ADBFA";
                  return (
                    <button
                      key={p.id}
                      onClick={() => handleViewChange({ projectId: p.id })}
                      className={`flex items-center gap-3 w-full text-left ${isMobile ? 'px-4 py-2.5' : 'px-6 py-2'} hover:bg-muted/20 transition-colors group`}
                      data-testid={`area-project-${p.id}`}
                    >
                      <Circle className="h-4 w-4 shrink-0" style={{ color, fill: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium text-foreground truncate">{p.name}</div>
                      </div>
                      {totalCount > 0 && (
                        <span className="text-[11px] text-muted-foreground/50 tabular-nums">{completedCount}/{totalCount}</span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {(areaData.projects.length > 0 && sortedAreaTasks.length > 0) && (
            <div className={`${isMobile ? 'mx-4' : 'mx-6'} mb-3 border-t border-border/20`} />
          )}
          {sortedAreaTasks.length > 0 && (
            <div>
              <div className={`text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/50 ${isMobile ? 'px-4' : 'px-6'} mb-2`}>Zadania</div>
              {sortedAreaTasks.map((t) => renderTaskItem(t))}
            </div>
          )}
          {areaData.projects.length === 0 && sortedAreaTasks.length === 0 && (
            <div className="text-center text-muted-foreground/50 py-16" data-testid="text-area-empty">
              <Layers className="h-12 w-12 mx-auto mb-3 opacity-15" />
              <p className="text-sm font-medium">Brak projektów i zadań w tej przestrzeni</p>
              <p className="text-xs mt-1 text-muted-foreground/40">Dodaj projekt lub zadanie do tej przestrzeni</p>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  const hasGroupedView = view === "today" || view === "upcoming" || view === "anytime" || view === "logbook" || isAreaView;

  const renderProjectView = () => {
    const currentProjectId = isProjectView ? (view as { projectId: number }).projectId : 0;
    const hideLater = projectHideLater[currentProjectId] ?? false;
    const showLogged = projectShowLogged[currentProjectId] ?? false;

    const laterTasks = getProjectLaterTasks(tagFilteredTasks);
    const laterTaskIds = new Set(laterTasks.map(t => t.id));
    const laterCount = laterTasks.length;

    const visibleFiltered = hideLater ? tagFilteredTasks.filter(t => !laterTaskIds.has(t.id)) : tagFilteredTasks;

    const completedTasks = getProjectCompletedTasks(tasks, currentProjectId);
    const loggedCount = completedTasks.length;

    const sortedSections = [...projectSections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const sectionIds = sortedSections.map(s => `section-${s.id}`);
    const unsectionedTasks = sortTasks(visibleFiltered.filter((t) => !t.sectionId), sortBy);
    const unsectionedIds = unsectionedTasks.map(t => `task-${t.id}`);

    const toggleHideLater = () => {
      const newVal = !hideLater;
      setProjectHideLater(currentProjectId, newVal);
      setProjectHideLaterState(prev => ({ ...prev, [currentProjectId]: newVal }));
    };

    const toggleShowLogged = () => {
      const newVal = !showLogged;
      setProjectShowLogged(currentProjectId, newVal);
      setProjectShowLoggedState(prev => ({ ...prev, [currentProjectId]: newVal }));
    };

    return (
      <>
        <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
          {sortedSections.map((sec) => {
            const sectionTasks = sortTasks(visibleFiltered.filter((t) => t.sectionId === sec.id), sortBy);
            const collapsed = collapsedSections.has(sec.id);
            const sectionTaskIds = sectionTasks.map(t => `task-${t.id}`);
            const isRenaming = renamingSectionId === sec.id;

            return (
              <SortableSectionItem key={sec.id} id={`section-${sec.id}`}>
                {(sectionListeners) => (
                  <div data-testid={`section-${sec.id}`}>
                    <div
                      className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider py-3 px-5 w-full text-left transition-colors text-muted-foreground/80 group border-b border-border/30 mt-2 ${
                        isRenaming ? "cursor-text" : "cursor-grab active:cursor-grabbing touch-none"
                      }`}
                      {...(isRenaming ? {} : sectionListeners)}
                      data-testid={`section-header-${sec.id}`}
                    >
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
                              if (e.key === "Enter") { e.preventDefault(); handleSectionRenameSubmit(sec.id); }
                              if (e.key === "Escape") { setRenamingSectionId(null); setRenamingSectionName(""); }
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
                            className="invisible group-hover:visible p-0.5 rounded hover:bg-muted/50 text-muted-foreground"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-section-menu-${sec.id}`}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => { setRenamingSectionId(sec.id); setRenamingSectionName(sec.name); }}
                            data-testid={`menu-rename-section-${sec.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Zmień nazwę
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => deleteSection.mutate(sec.id)} className="text-destructive" data-testid={`menu-delete-section-${sec.id}`}>
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Usuń sekcję
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {!collapsed && (
                      <SortableContext items={sectionTaskIds} strategy={verticalListSortingStrategy}>
                        {sectionTasks.map((t) => (
                          <SortableTaskRow key={t.id} id={`task-${t.id}`}>
                            {(listeners) => renderTaskItem(t, 0, listeners)}
                          </SortableTaskRow>
                        ))}
                      </SortableContext>
                    )}
                  </div>
                )}
              </SortableSectionItem>
            );
          })}
        </SortableContext>
        <SortableContext items={unsectionedIds} strategy={verticalListSortingStrategy}>
          {unsectionedTasks.map((t) => (
            <SortableTaskRow key={t.id} id={`task-${t.id}`}>
              {(listeners) => renderTaskItem(t, 0, listeners)}
            </SortableTaskRow>
          ))}
        </SortableContext>

        {laterCount > 0 && (
          <div className="px-6 py-2">
            <button
              onClick={toggleHideLater}
              className="text-[13px] text-primary/70 hover:text-primary transition-colors"
              data-testid="button-toggle-hide-later"
            >
              {hideLater
                ? `Pokaż ${laterCount} późniejsz${laterCount === 1 ? "e" : "ych"}`
                : "Ukryj późniejsze"
              }
            </button>
          </div>
        )}

        {loggedCount > 0 && (
          <div className="px-6 py-2">
            <button
              onClick={toggleShowLogged}
              className="text-[13px] text-primary/70 hover:text-primary transition-colors"
              data-testid="button-toggle-show-logged"
            >
              {showLogged
                ? "Ukryj ukończone"
                : `Pokaż ${loggedCount} ukończon${loggedCount === 1 ? "e" : "ych"}`
              }
            </button>
          </div>
        )}

        {showLogged && completedTasks.length > 0 && (
          <div className="mt-1" data-testid="logged-items-list">
            {completedTasks.map((t) => {
              const completedDate = t.completedAt
                ? format(new Date(t.completedAt), "d MMM", { locale: pl })
                : "";
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-6 py-2 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => handleTaskClick(t)}
                  data-testid={`logged-task-${t.id}`}
                >
                  <div className="shrink-0">
                    <div
                      className="h-[18px] w-[18px] rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "#3B82F6" }}
                      onClick={(e) => { e.stopPropagation(); handleToggleComplete(t); }}
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10">
                        <path
                          d="M2 5 L4 7 L8 3"
                          fill="none"
                          stroke="white"
                          strokeWidth={1.8}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                  <span className="text-[13.5px] text-muted-foreground/50 line-through truncate flex-1">
                    {t.title}
                  </span>
                  {completedDate && (
                    <span className="text-[11px] text-muted-foreground/40 shrink-0">
                      {completedDate}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };

  const activeProjects = useMemo(() => projects.filter(p => !p.archived), [projects]);

  const newToDoRow = (position: "top" | "bottom") => (
    <button
      onClick={() => { setInlineAddVisible(true); }}
      className={`flex items-center gap-3 px-6 ${isMobile ? 'py-3' : 'py-2.5'} w-full text-left text-[13.5px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors`}
      data-testid={`button-new-todo-${position}`}
    >
      <div className="h-[18px] w-[18px] rounded-full border-[1.5px] border-muted-foreground/20 shrink-0" />
      <span>Nowe zadanie</span>
    </button>
  );

  return (
    <div className="flex h-screen" style={{ '--tasks-font-size': `${fontSize}px` } as React.CSSProperties} data-testid="page-tasks">
      <DndContext sensors={sensors} collisionDetection={customCollisionDetection} onDragStart={handleMainDragStart} onDragEnd={handleMainDragEnd}>
      {isMobile && (
        <div
          className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ${sidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"}`}
          onClick={() => setSidebarCollapsed(true)}
          data-testid="sidebar-backdrop"
        />
      )}
      {isMobile ? (
        <aside
          className={`fixed inset-y-0 left-0 z-50 shrink-0 border-r flex flex-col overflow-hidden bg-background w-[280px] transition-transform duration-200 ${
            sidebarCollapsed ? "-translate-x-full" : "translate-x-0"
          }`}
          data-testid="tasks-sidebar"
        >
          <div className="flex items-center justify-end p-2">
            <button
              onClick={() => setSidebarCollapsed(true)}
              className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground"
              data-testid="button-close-sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <TaskSidebar
            tasks={tasks}
            projects={projects}
            activeView={view}
            showCounts={showCounts}
            weekStart={weekStart}
            showOverdueInToday={showOverdueInToday}
            currentUserId={user?.id}
            collapsedAreas={collapsedAreas}
            isDraggingTask={!!activeDragId && activeDragId.startsWith("task-")}
            isDraggingProject={!!activeDragId && activeDragId.startsWith("sortable-project-")}
            isDraggingArea={!!activeDragId && activeDragId.startsWith("sortable-area-")}
            areaOrder={areaOrder}
            onViewChange={handleViewChange}
            onToggleArea={toggleArea}
            onAddProject={() => setAddProjectOpen(true)}
            onAddArea={() => setAddAreaOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenQuickFind={() => setQuickFindOpen(true)}
            onUpdateProject={(id, data) => updateProject.mutate({ id, data })}
            onDeleteProject={(id) => deleteProject.mutate(id)}
            onRenameArea={handleSidebarAreaRename}
            onDeleteArea={handleSidebarAreaDelete}
          />
          <SidebarFooter
            onAddProject={() => setAddProjectOpen(true)}
            onAddArea={() => setAddAreaOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onLogout={onLogout}
          />
        </aside>
      ) : (
        !sidebarCollapsed && (
          <aside
            className="shrink-0 border-r flex flex-col overflow-hidden bg-muted/10 w-[260px] transition-all duration-200"
            data-testid="tasks-sidebar"
          >
            <TaskSidebar
              tasks={tasks}
              projects={projects}
              activeView={view}
              showCounts={showCounts}
              weekStart={weekStart}
              showOverdueInToday={showOverdueInToday}
              currentUserId={user?.id}
              collapsedAreas={collapsedAreas}
              isDraggingTask={!!activeDragId && activeDragId.startsWith("task-")}
              isDraggingProject={!!activeDragId && activeDragId.startsWith("sortable-project-")}
              isDraggingArea={!!activeDragId && activeDragId.startsWith("sortable-area-")}
              areaOrder={areaOrder}
              onViewChange={handleViewChange}
              onToggleArea={toggleArea}
              onAddProject={() => setAddProjectOpen(true)}
              onAddArea={() => setAddAreaOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onOpenQuickFind={() => setQuickFindOpen(true)}
              onUpdateProject={(id, data) => updateProject.mutate({ id, data })}
              onDeleteProject={(id) => deleteProject.mutate(id)}
              onRenameArea={handleSidebarAreaRename}
              onDeleteArea={handleSidebarAreaDelete}
            />
            <SidebarFooter
              onAddProject={() => setAddProjectOpen(true)}
              onAddArea={() => setAddAreaOpen(true)}
              onOpenSettings={() => setSettingsOpen(true)}
              onLogout={onLogout}
            />
          </aside>
        )
      )}

      <main className="flex-1 flex flex-col overflow-hidden relative" data-testid="tasks-main">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/30">
          {isMobile && (
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground" data-testid="button-mobile-menu">
              <Menu className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground ${isMobile ? "hidden" : ""}`}
            data-testid="button-toggle-sidebar"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <VIcon className="h-5 w-5 shrink-0" style={{ color: isAreaView ? "#4ECDC4" : view === "today" ? "#FFD43B" : view === "upcoming" ? "#51CF66" : view === "anytime" ? "#4ECDC4" : view === "someday" ? "#C4B5FD" : view === "logbook" ? "#868E96" : view === "inbox" ? "#5ADBFA" : undefined }} />
            <div>
              <h2 className="text-lg font-semibold tracking-tight truncate" data-testid="text-view-title">
                {isAreaView && renamingArea ? (
                  <Input
                    ref={renameAreaInputRef}
                    value={renamingAreaName}
                    onChange={(e) => setRenamingAreaName(e.target.value)}
                    onBlur={handleAreaRenameSubmit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleAreaRenameSubmit(); }
                      if (e.key === "Escape") { setRenamingArea(false); }
                    }}
                    className="h-7 text-lg font-semibold border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 py-0"
                    data-testid="input-rename-area"
                  />
                ) : isProjectView ? (
                  <span className="flex items-center gap-1.5">
                    {viewLabel(view, projects)}
                  </span>
                ) : (
                  viewLabel(view, projects)
                )}
              </h2>
            </div>
          </div>
          {filterTags.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary gap-1"
              onClick={() => setFilterTags(new Set())}
              data-testid="button-clear-filter"
            >
              <X className="h-3 w-3" />
              Clear filter
            </Button>
          )}
          {view !== "logbook" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground" data-testid="button-context-menu">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {isAreaView ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setRenamingArea(true);
                        setRenamingAreaName((view as { area: string }).area);
                      }}
                      data-testid="menu-rename-area"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Zmień nazwę
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleAreaDelete} className="text-destructive" data-testid="menu-delete-area">
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Usuń przestrzeń
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={() => setInlineAddVisible(true)} data-testid="menu-add-task">
                      <Plus className="h-3.5 w-3.5 mr-2" /> Nowe zadanie
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger data-testid="menu-filter-by-tag">
                        <Tag className="h-3.5 w-3.5 mr-2" />
                        Filtruj po tagu
                        {filterTags.size > 0 && (
                          <span className="ml-auto text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5 tabular-nums">
                            {filterTags.size}
                          </span>
                        )}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-52 p-2" data-testid="submenu-filter-tags">
                        {availableTags.length === 0 ? (
                          <p className="text-xs text-muted-foreground/60 px-2 py-3 text-center">Brak tagów w tym widoku</p>
                        ) : (
                          <div className="space-y-0.5 max-h-60 overflow-y-auto">
                            {availableTags.map(tag => (
                              <button
                                key={tag}
                                className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-muted/50 transition-colors"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setFilterTags(prev => {
                                    const next = new Set(prev);
                                    next.has(tag) ? next.delete(tag) : next.add(tag);
                                    return next;
                                  });
                                }}
                                data-testid={`filter-tag-${tag}`}
                              >
                                <Checkbox
                                  checked={filterTags.has(tag)}
                                  className="h-3.5 w-3.5"
                                />
                                <span className="truncate">{tag}</span>
                              </button>
                            ))}
                            {filterTags.size > 0 && (
                              <>
                                <div className="border-t my-1" />
                                <button
                                  className="w-full text-xs text-primary px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors text-left"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setFilterTags(new Set());
                                  }}
                                  data-testid="button-clear-tag-filter"
                                >
                                  Clear filter
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                    {isProjectView && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setAddSectionOpen(true)}
                          data-testid="menu-new-heading"
                        >
                          <ListPlus className="h-3.5 w-3.5 mr-2" /> New Heading
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => {
                        setMultiSelectMode(prev => !prev);
                        if (!multiSelectMode) setSelectedTasks(new Set());
                      }}
                      data-testid="menu-select"
                    >
                      <CheckSquare className="h-3.5 w-3.5 mr-2" />
                      {multiSelectMode ? "Exit Select" : "Select"}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {isProjectView && (() => {
          const currentProject = projects.find((p) => p.id === (view as { projectId: number }).projectId);
          const projectTasks = tasks.filter((t) => t.projectId === (view as { projectId: number }).projectId && t.parentTaskId === null);
          const completedCount = projectTasks.filter((t) => t.completed).length;
          const totalCount = projectTasks.length;
          const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
          const color = currentProject?.color || "#5ADBFA";
          return (
            <div className="px-6 py-3" data-testid="project-header">
              <div className="text-[11px] text-muted-foreground/50 mb-1">
                {completedCount} z {totalCount} zadań
              </div>
              <div className="h-1 rounded-full bg-muted/50 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })()}

          <div className={`flex-1 overflow-y-auto task-list-transition ${isMobile ? 'pb-20' : 'pb-0'}`} style={{ fontSize: 'var(--tasks-font-size, 14px)' }}>
            {view === "inbox" && !inlineAddVisible && newToDoRow("top")}

            {inlineAddVisible && view !== "logbook" && (
              <TaskInlineAdd
                view={view}
                projects={activeProjects}
                targetDate={inlineAddTarget}
                onSubmit={handleInlineSubmit}
                onCancel={() => { setInlineAddVisible(false); setInlineAddTarget(undefined); }}
              />
            )}

            {hasGroupedView ? (
              renderGroupedView()
            ) : isProjectView ? (
              renderProjectView()
            ) : (
              renderSortableTaskList(tagFilteredTasks)
            )}

            {tagFilteredTasks.length === 0 && !inlineAddVisible && !isAreaView && !hasGroupedView && (
              <div className="text-center text-muted-foreground/50 py-20" data-testid="text-empty-tasks">
                {emptyState.icon && <emptyState.icon className="h-12 w-12 mx-auto mb-3 opacity-15" />}
                <p className="text-sm font-medium">{emptyState.title}</p>
                <p className="text-xs mt-1 text-muted-foreground/40">{emptyState.subtitle}</p>
              </div>
            )}

            {view === "inbox" && !inlineAddVisible && newToDoRow("bottom")}

            {view !== "logbook" && view !== "inbox" && !inlineAddVisible && (
              <button
                className={`flex items-center gap-3 px-6 ${isMobile ? 'py-3' : 'py-2.5'} w-full text-left text-[13.5px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors`}
                onClick={() => setInlineAddVisible(true)}
                data-testid="button-inline-add"
              >
                <div className="h-[18px] w-[18px] rounded-full border-[1.5px] border-muted-foreground/20 shrink-0" />
                <span>Nowe zadanie</span>
              </button>
            )}
          </div>

          <DragOverlay>
            {activeDragData?.type === "task" && activeDragData.item && (
              <div className="bg-card border border-border/50 rounded-xl shadow-2xl px-5 py-3.5 flex items-center gap-3 max-w-sm opacity-95">
                <div className="h-[18px] w-[18px] rounded-full border-2 border-muted-foreground/25 shrink-0" />
                <span className="text-[13px] truncate">{(activeDragData.item as Task).title}</span>
              </div>
            )}
            {activeDragData?.type === "section" && activeDragData.item && (
              <div className="bg-card border border-border/50 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-2 opacity-95">
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/70">{(activeDragData.item as TaskSection).name}</span>
              </div>
            )}
            {activeDragData?.type === "project" && activeDragData.item && (
              <div className="bg-card border border-border/50 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3 max-w-[220px] opacity-95">
                <Circle className="h-4 w-4 shrink-0" style={{ color: (activeDragData.item as TaskProject).color || "#5ADBFA", fill: (activeDragData.item as TaskProject).color || "#5ADBFA" }} />
                <span className="text-[13px] truncate">{(activeDragData.item as TaskProject).name}</span>
              </div>
            )}
          </DragOverlay>

        {(selectedTasks.size > 0 || inlineCardTaskId) && !(isMobile && detailTask) && (
          <div className={`${isMobile ? 'fixed bottom-20' : 'absolute bottom-4'} left-1/2 -translate-x-1/2 flex items-center gap-1 bg-zinc-800 dark:bg-zinc-900 text-white rounded-2xl shadow-lg px-3 py-2 z-[60]`} data-testid="bottom-action-bar">
            <WhenPopover
              onSelectToday={() => { selectedTasksArray.forEach(id => updateTask.mutate({ id, data: { dueDate: format(new Date(), "yyyy-MM-dd"), evening: false, someday: false } })); }}
              onSelectEvening={() => { selectedTasksArray.forEach(id => updateTask.mutate({ id, data: { evening: true, dueDate: format(new Date(), "yyyy-MM-dd"), someday: false } })); }}
              onSelectDate={(date) => { selectedTasksArray.forEach(id => updateTask.mutate({ id, data: { dueDate: date, evening: false, someday: false } })); }}
              onSelectSomeday={() => { selectedTasksArray.forEach(id => updateTask.mutate({ id, data: { someday: true, dueDate: null, evening: false } })); }}
              onClear={() => { selectedTasksArray.forEach(id => updateTask.mutate({ id, data: { dueDate: null, evening: false, someday: false } })); }}
              onSetReminder={(date, time) => { selectedTasksArray.forEach(id => updateTask.mutate({ id, data: { reminderDate: date, reminderTime: time } })); }}
            >
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-white hover:text-white hover:bg-white/10" data-testid="button-action-when">
                <CalendarDays className="h-3.5 w-3.5" /> Kiedy
              </Button>
            </WhenPopover>

            <Popover onOpenChange={(open) => { if (open) setAssignCheckedIds(new Set()); }}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-white hover:text-white hover:bg-white/10" data-testid="button-action-assign">
                  <UserPlus className="h-3.5 w-3.5" /> Przydziel
                </Button>
              </PopoverTrigger>
              <PopoverContent align="center" side="top" className="w-56 p-2" data-testid="popover-assign">
                <div className="text-xs font-medium mb-2 px-1">Przydziel pracowników</div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {employees.map((emp: any) => (
                    <label key={emp.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-xs" data-testid={`assign-employee-${emp.id}`}>
                      <Checkbox
                        checked={assignCheckedIds.has(emp.id)}
                        onCheckedChange={(checked) => {
                          setAssignCheckedIds(prev => {
                            const next = new Set(prev);
                            checked ? next.add(emp.id) : next.delete(emp.id);
                            return next;
                          });
                        }}
                        data-testid={`checkbox-employee-${emp.id}`}
                      />
                      <span>{emp.firstName || emp.name || ""} {emp.lastName || ""}</span>
                    </label>
                  ))}
                  {employees.length === 0 && <div className="text-xs text-muted-foreground px-2 py-1">Brak pracowników</div>}
                </div>
                <Button
                  size="sm"
                  className="w-full mt-2"
                  disabled={assignCheckedIds.size === 0}
                  onClick={() => bulkAssign.mutate({ taskIds: selectedTasksArray, employeeIds: Array.from(assignCheckedIds) })}
                  data-testid="button-confirm-assign"
                >
                  Przydziel ({assignCheckedIds.size})
                </Button>
              </PopoverContent>
            </Popover>

            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-white hover:text-white hover:bg-white/10" onClick={() => setMoveDialogOpen(true)} data-testid="button-action-move">
              <ArrowRight className="h-3.5 w-3.5" />
              Przenieś
            </Button>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-white hover:text-white hover:bg-white/10" onClick={() => setDeleteConfirmOpen(true)} data-testid="button-action-delete">
              <Trash2 className="h-3.5 w-3.5" /> Usuń
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-white hover:text-white hover:bg-white/10" data-testid="button-action-more">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" side="top" className="w-56">
                <DropdownMenuItem onClick={() => bulkComplete.mutate({ taskIds: selectedTasksArray, completed: true })} data-testid="menu-action-complete">
                  <Check className="h-3.5 w-3.5 mr-2" /> Oznacz jako ukończone
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); setBulkTagsOpen(true); setBulkTagsInput(""); }} data-testid="menu-action-tags">
                  <Tag className="h-3.5 w-3.5 mr-2" /> Ustaw tagi
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.preventDefault(); setBulkDeadlineOpen(true); setBulkDeadlineInput(""); }} data-testid="menu-action-deadline">
                  <Calendar className="h-3.5 w-3.5 mr-2" /> Ustaw deadline
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkDuplicate.mutate({ taskIds: selectedTasksArray })} data-testid="menu-action-duplicate">
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplikuj
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled data-testid="menu-action-share">
                  Udostępnij
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <Popover open={bulkTagsOpen} onOpenChange={setBulkTagsOpen}>
          <PopoverTrigger asChild>
            <span className="hidden" />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 fixed bottom-20 left-1/2 -translate-x-1/2" data-testid="popover-bulk-tags">
            <div className="text-xs font-medium mb-2">Ustaw tagi (oddzielone przecinkami)</div>
            <Input
              value={bulkTagsInput}
              onChange={(e) => setBulkTagsInput(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className="text-xs mb-2"
              data-testid="input-bulk-tags"
            />
            <Button
              size="sm"
              className="w-full"
              disabled={!bulkTagsInput.trim()}
              onClick={() => {
                const tags = bulkTagsInput.split(",").map(t => t.trim()).filter(Boolean);
                bulkTags.mutate({ taskIds: selectedTasksArray, tags });
                setBulkTagsOpen(false);
              }}
              data-testid="button-confirm-tags"
            >
              Zastosuj
            </Button>
          </PopoverContent>
        </Popover>

        <Popover open={bulkDeadlineOpen} onOpenChange={setBulkDeadlineOpen}>
          <PopoverTrigger asChild>
            <span className="hidden" />
          </PopoverTrigger>
          <PopoverContent className="w-64 p-3 fixed bottom-20 left-1/2 -translate-x-1/2" data-testid="popover-bulk-deadline">
            <div className="text-xs font-medium mb-2">Ustaw deadline</div>
            <Input
              type="date"
              value={bulkDeadlineInput}
              onChange={(e) => setBulkDeadlineInput(e.target.value)}
              className="text-xs mb-2"
              data-testid="input-bulk-deadline"
            />
            <Button
              size="sm"
              className="w-full"
              disabled={!bulkDeadlineInput}
              onClick={() => {
                bulkDeadline.mutate({ taskIds: selectedTasksArray, deadlineDate: bulkDeadlineInput });
                setBulkDeadlineOpen(false);
              }}
              data-testid="button-confirm-deadline"
            >
              Zastosuj
            </Button>
          </PopoverContent>
        </Popover>

        {view !== "logbook" && selectedTasks.size === 0 && !inlineCardTaskId && (
          <div className={`absolute ${isMobile ? 'bottom-24 right-4' : 'bottom-6 right-6'} z-40`}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="flex items-center justify-center h-14 w-14 rounded-full bg-blue-500 text-white shadow-xl hover:bg-blue-600 transition-colors"
                  onClick={() => setAddTaskOpen(true)}
                  data-testid="button-fab-add"
                >
                  <Plus className="h-6 w-6" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>Dodaj zadanie</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </main>

      <AnimatePresence>
        {detailTask && (
          <TaskDetailPanel
            task={detailTask}
            tasks={tasks}
            projects={projects}
            sections={sections}
            childTasks={childTasksMap.get(detailTask.id) || []}
            allUsers={allUsers}
            currentUserId={user?.id}
            isMobile={isMobile}
            onClose={() => { setDetailTask(null); clearSelection(); }}
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
            onDelete={() => { deleteTask.mutate(detailTask.id); setDetailTask(null); clearSelection(); }}
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

      <QuickFind
        open={quickFindOpen}
        onOpenChange={setQuickFindOpen}
        tasks={tasks}
        projects={projects}
        onSelectTask={handleTaskClick}
        onSelectProject={(projectId) => handleViewChange({ projectId })}
      />

      <TaskDialog
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        projects={projects}
        sections={sections}
        defaultProjectId={isProjectView ? (view as { projectId: number }).projectId : undefined}
        defaultArea={isAreaView ? (view as { area: string }).area : undefined}
      />

      <ProjectDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        onSubmit={(data) => createProject.mutate(data)}
        existingAreas={Array.from(new Set(projects.filter(p => !p.archived && p.area).map(p => p.area!)))}
      />

      <AreaDialog
        open={addAreaOpen}
        onOpenChange={setAddAreaOpen}
        projects={projects}
        onSubmit={(areaName, projectIds) => {
          projectIds.forEach(id => {
            updateProject.mutate({ id, data: { area: areaName } });
          });
          toast({ title: `Przestrzeń "${areaName}" utworzona`, description: projectIds.length > 0 ? `Przypisano ${projectIds.length} projekt(ów).` : "Przypisz projekty z menu kontekstowego (⋯ → Przestrzeń)." });
        }}
      />

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
        setShowCounts={(v) => { setShowCounts(v); localStorage.setItem("tasksShowCounts", String(v)); }}
        showOverdueInToday={showOverdueInToday}
        setShowOverdueInToday={(v) => { setShowOverdueInToday(v); localStorage.setItem("tasksShowOverdueToday", String(v)); }}
        weekStart={weekStart}
        setWeekStart={(v) => { setWeekStart(v); localStorage.setItem("tasksWeekStart", String(v)); }}
        fontSize={fontSize}
        setFontSize={(v) => { setFontSize(v); localStorage.setItem("tasks-font-size", v); }}
        projects={projects}
      />

      <MoveDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        projects={projects}
        sections={sections}
        onMove={(projectId, sectionId) => {
          bulkMove.mutate({ ids: selectedTasksArray, projectId, sectionId, clearSchedule: projectId === null });
        }}
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
              onClick={() => { bulkDelete.mutate(selectedTasksArray); setDeleteConfirmOpen(false); }}
              data-testid="button-confirm-delete"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </DndContext>
    </div>
  );
}

export default function Tasks() {
  return (
    <DefaultTasksApiProvider>
      <TasksCore />
    </DefaultTasksApiProvider>
  );
}
