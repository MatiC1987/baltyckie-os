import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
import { useToast } from "@/hooks/use-toast";
import { useState, useRef, useEffect, useCallback } from "react";
import type { Task, TaskProject, TaskSection, TaskChecklistItem } from "@shared/schema";
import { format, parseISO, isToday, isThisWeek, isBefore } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Inbox, CalendarDays, Star, Plus, Trash2,
  Calendar, Tag, ChevronDown, ChevronRight, Circle,
  PanelLeftClose, PanelLeft, MoreHorizontal, ArrowRight,
  Copy, RefreshCw, FolderPlus, Settings, X,
  SlidersHorizontal, GripVertical, Sun, Moon, Monitor,
  ListPlus, FolderOpen, Clock, AlertCircle,
} from "lucide-react";

type ViewType = "inbox" | "today" | "week" | "priority" | { projectId: number };

const PRIORITY_COLORS: Record<string, string> = {
  PILNY: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  WYSOKI: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  ŚREDNI: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  NISKI: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
  BRAK: "bg-muted text-muted-foreground",
};

const PRIORITY_DOT: Record<string, string> = {
  PILNY: "bg-red-500",
  WYSOKI: "bg-orange-500",
  ŚREDNI: "bg-yellow-500",
  NISKI: "bg-blue-400",
  BRAK: "",
};

function filterTasks(tasks: Task[], view: ViewType): Task[] {
  if (view === "inbox") return tasks.filter((t) => !t.projectId);
  if (view === "today") return tasks.filter((t) => t.dueDate && isToday(parseISO(t.dueDate)));
  if (view === "week") return tasks.filter((t) => t.dueDate && isThisWeek(parseISO(t.dueDate), { weekStartsOn: 1 }));
  if (view === "priority") return tasks.filter((t) => t.priority && t.priority !== "BRAK");
  return tasks.filter((t) => t.projectId === view.projectId);
}

function viewLabel(view: ViewType, projects: TaskProject[]): string {
  if (view === "inbox") return "Odebrane";
  if (view === "today") return "Dziś";
  if (view === "week") return "W tym tygodniu";
  if (view === "priority") return "Priorytetowe";
  const p = projects.find((pr) => pr.id === view.projectId);
  return p?.name || "Projekt";
}

function viewIcon(view: ViewType): typeof Inbox {
  if (view === "inbox") return Inbox;
  if (view === "today") return Star;
  if (view === "week") return Calendar;
  if (view === "priority") return AlertCircle;
  return FolderOpen;
}

export default function Tasks() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewType>("inbox");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());
  const [collapsedAreas, setCollapsedAreas] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [inlineAddVisible, setInlineAddVisible] = useState(false);
  const [inlineTitle, setInlineTitle] = useState("");
  const inlineInputRef = useRef<HTMLInputElement>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);

  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: projects = [] } = useQuery<TaskProject[]>({ queryKey: ["/api/task-projects"] });
  const { data: sections = [] } = useQuery<TaskSection[]>({ queryKey: ["/api/task-sections"] });

  const toggleComplete = useMutation({
    mutationFn: (task: Task) => apiRequest("PATCH", `/api/tasks/${task.id}`, { completed: !task.completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const createTaskInline = useMutation({
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
      setSelectMode(false);
      toast({ title: "Zadania usunięte" });
    },
  });

  const bulkMove = useMutation({
    mutationFn: (data: { ids: number[]; projectId: number | null; sectionId: number | null }) =>
      apiRequest("POST", "/api/tasks/bulk-move", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setSelectedTasks(new Set());
      setSelectMode(false);
      setMoveDialogOpen(false);
      toast({ title: "Zadania przeniesione" });
    },
  });

  const convertToProject = useMutation({
    mutationFn: (taskId: number) => apiRequest("POST", `/api/tasks/${taskId}/convert-to-project`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/task-projects"] });
      setSelectedTasks(new Set());
      setSelectMode(false);
      toast({ title: "Zadanie przekształcone w projekt" });
    },
  });

  const filtered = filterTasks(tasks, view);
  const isProjectView = typeof view === "object";
  const projectSections = isProjectView ? sections.filter((s) => s.projectId === view.projectId) : [];

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

  const smartViews: { key: string; view: ViewType; icon: typeof Inbox; label: string; color: string }[] = [
    { key: "inbox", view: "inbox", icon: Inbox, label: "Odebrane", color: "#5ADBFA" },
    { key: "today", view: "today", icon: Star, label: "Dziś", color: "#FFD43B" },
    { key: "week", view: "week", icon: Calendar, label: "W tym tygodniu", color: "#51CF66" },
    { key: "priority", view: "priority", icon: AlertCircle, label: "Priorytetowe", color: "#FF6B6B" },
  ];

  const isActive = (v: ViewType) => {
    if (typeof view === "object" && typeof v === "object") return view.projectId === v.projectId;
    return view === v;
  };

  const areas = Array.from(new Set(projects.map(p => p.area || "").filter(Boolean)));
  const ungroupedProjects = projects.filter(p => !p.area);

  const toggleTaskSelection = (taskId: number) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  };

  const handleTaskClick = (task: Task) => {
    if (selectMode) {
      toggleTaskSelection(task.id);
    } else {
      setSelectedTasks(new Set([task.id]));
    }
  };

  const handleInlineSubmit = () => {
    if (!inlineTitle.trim()) return;
    const data: Record<string, unknown> = {
      title: inlineTitle.trim(),
      priority: "BRAK",
      tags: [],
      projectId: isProjectView ? view.projectId : null,
      sectionId: null,
    };
    createTaskInline.mutate(data);
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleInlineSubmit();
    }
    if (e.key === "Escape") {
      setInlineAddVisible(false);
      setInlineTitle("");
    }
  };

  useEffect(() => {
    if (inlineAddVisible && inlineInputRef.current) {
      inlineInputRef.current.focus();
    }
  }, [inlineAddVisible]);

  const clearSelection = () => {
    setSelectedTasks(new Set());
    setSelectMode(false);
  };

  const selectedTasksArray = Array.from(selectedTasks);
  const VIcon = viewIcon(view);

  return (
    <div className="flex h-full" data-testid="page-tasks">
      {!sidebarCollapsed && (
        <aside className="w-[250px] shrink-0 border-r flex flex-col overflow-hidden bg-muted/20" data-testid="tasks-sidebar">
          <div className="flex-1 overflow-y-auto p-3 space-y-1">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">Widoki</div>
            {smartViews.map((sv) => (
              <button
                key={sv.key}
                onClick={() => { setView(sv.view); clearSelection(); }}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm w-full text-left transition-all ${isActive(sv.view) ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60 text-foreground"}`}
                data-testid={`button-view-${sv.key}`}
              >
                <sv.icon className="h-4 w-4 shrink-0" style={{ color: isActive(sv.view) ? sv.color : undefined }} />
                <span className="flex-1">{sv.label}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{filterTasks(tasks, sv.view).length || ""}</span>
              </button>
            ))}

            {ungroupedProjects.length > 0 && (
              <>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-4 mb-1 px-2">Projekty</div>
                {ungroupedProjects.map((p) => (
                  <ProjectSidebarItem key={p.id} project={p} tasks={tasks} isActive={isActive({ projectId: p.id })} onClick={() => { setView({ projectId: p.id }); clearSelection(); }} />
                ))}
              </>
            )}

            {areas.map((area) => {
              const areaProjects = projects.filter(p => p.area === area);
              const isCollapsed = collapsedAreas.has(area);
              return (
                <div key={area}>
                  <button
                    onClick={() => toggleArea(area)}
                    className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 mt-3 mb-0.5 hover:bg-muted/40 rounded-md transition-colors"
                    data-testid={`button-area-${area}`}
                  >
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{area}</span>
                  </button>
                  {!isCollapsed && areaProjects.map((p) => (
                    <ProjectSidebarItem key={p.id} project={p} tasks={tasks} isActive={isActive({ projectId: p.id })} onClick={() => { setView({ projectId: p.id }); clearSelection(); }} />
                  ))}
                </div>
              );
            })}
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
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted transition-colors"
                  onClick={() => { setAddProjectOpen(true); }}
                  data-testid="button-new-project-popover"
                >
                  <FolderPlus className="h-4 w-4 text-primary" />
                  <div className="text-left">
                    <div className="font-medium">Nowy Projekt</div>
                    <div className="text-[10px] text-muted-foreground">Zdefiniuj cel i pracuj nad zadaniami</div>
                  </div>
                </button>
                <button
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted transition-colors"
                  onClick={() => { setAddSectionOpen(true); }}
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
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setSettingsOpen(true)}
              data-testid="button-settings"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col overflow-hidden relative" data-testid="tasks-main">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-toggle-sidebar"
          >
            {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <VIcon className="h-5 w-5 text-muted-foreground shrink-0" />
            <h2 className="text-lg font-semibold truncate" data-testid="text-view-title">{viewLabel(view, projects)}</h2>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" data-testid="button-context-menu">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => { setSelectMode(true); }} data-testid="menu-select">
                <Checkbox className="h-3.5 w-3.5 mr-2" /> Zaznacz
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAddTaskOpen(true)} data-testid="menu-add-task">
                <Plus className="h-3.5 w-3.5 mr-2" /> Dodaj zadanie
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="divide-y divide-border">
            {isProjectView ? (
              <>
                {projectSections.map((sec) => {
                  const sectionTasks = filtered.filter((t) => t.sectionId === sec.id).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                  const collapsed = collapsedSections.has(sec.id);
                  return (
                    <div key={sec.id} data-testid={`section-${sec.id}`}>
                      <button
                        onClick={() => toggleSection(sec.id)}
                        className="flex items-center gap-1.5 text-sm font-semibold py-2.5 px-4 w-full text-left hover:bg-muted/30 transition-colors text-foreground"
                        data-testid={`button-toggle-section-${sec.id}`}
                      >
                        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        {sec.name}
                        <span className="text-muted-foreground font-normal ml-1">({sectionTasks.length})</span>
                      </button>
                      {!collapsed && (
                        <div className="divide-y divide-border/50">
                          {sectionTasks.map((t) => (
                            <TaskRow
                              key={t.id}
                              task={t}
                              onToggle={() => toggleComplete.mutate(t)}
                              onEdit={() => setEditingTask(t)}
                              onClick={() => handleTaskClick(t)}
                              selected={selectedTasks.has(t.id)}
                              selectMode={selectMode}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.filter((t) => !t.sectionId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    onToggle={() => toggleComplete.mutate(t)}
                    onEdit={() => setEditingTask(t)}
                    onClick={() => handleTaskClick(t)}
                    selected={selectedTasks.has(t.id)}
                    selectMode={selectMode}
                  />
                ))}
              </>
            ) : (
              filtered.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  onToggle={() => toggleComplete.mutate(t)}
                  onEdit={() => setEditingTask(t)}
                  onClick={() => handleTaskClick(t)}
                  selected={selectedTasks.has(t.id)}
                  selectMode={selectMode}
                />
              ))
            )}
          </div>

          {filtered.length === 0 && !inlineAddVisible && (
            <div className="text-center text-muted-foreground py-16" data-testid="text-empty-tasks">
              <VIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Brak zadań w tym widoku</p>
            </div>
          )}

          {inlineAddVisible ? (
            <div className="px-4 py-3 border-t bg-muted/10" data-testid="inline-add-task">
              <div className="flex items-center gap-3">
                <Checkbox disabled className="opacity-30" />
                <Input
                  ref={inlineInputRef}
                  value={inlineTitle}
                  onChange={(e) => setInlineTitle(e.target.value)}
                  onKeyDown={handleInlineKeyDown}
                  onBlur={() => { if (!inlineTitle.trim()) { setInlineAddVisible(false); } }}
                  placeholder="Nowe zadanie..."
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm h-auto py-0"
                  data-testid="input-inline-task-title"
                />
              </div>
            </div>
          ) : (
            <button
              className="flex items-center gap-3 px-4 py-3 w-full text-left text-sm text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              onClick={() => setInlineAddVisible(true)}
              data-testid="button-inline-add"
            >
              <Plus className="h-4 w-4" />
              <span>Dodaj Zadanie</span>
            </button>
          )}
        </div>

        {selectedTasks.size > 0 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card border rounded-xl shadow-lg px-2 py-1.5 z-50" data-testid="bottom-action-bar">
            <span className="text-xs text-muted-foreground px-2 tabular-nums">{selectedTasks.size} zaznaczonych</span>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => setMoveDialogOpen(true)}
              data-testid="button-action-move"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Przenieś
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive"
              onClick={() => bulkDelete.mutate(selectedTasksArray)}
              disabled={bulkDelete.isPending}
              data-testid="button-action-delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" data-testid="button-action-more">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" side="top">
                {selectedTasks.size === 1 && (
                  <>
                    <DropdownMenuItem onClick={() => {
                      const taskId = selectedTasksArray[0];
                      const task = tasks.find(t => t.id === taskId);
                      if (task) { setEditingTask(task); clearSelection(); }
                    }} data-testid="menu-edit-selected">
                      <Settings className="h-3.5 w-3.5 mr-2" /> Edytuj
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => {
                  if (selectedTasks.size === 1) {
                    const t = tasks.find(t => t.id === selectedTasksArray[0]);
                    if (t?.recurring) {
                      toast({ title: "Zadanie ma już ustawione powtarzanie" });
                    } else {
                      const task = tasks.find(t => t.id === selectedTasksArray[0]);
                      if (task) { setEditingTask(task); clearSelection(); }
                    }
                  }
                }} data-testid="menu-repeat">
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Powtarzaj...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  for (const id of selectedTasksArray) duplicateTask.mutate(id);
                  clearSelection();
                }} data-testid="menu-duplicate">
                  <Copy className="h-3.5 w-3.5 mr-2" /> Duplikuj
                </DropdownMenuItem>
                {selectedTasks.size === 1 && (
                  <DropdownMenuItem onClick={() => {
                    convertToProject.mutate(selectedTasksArray[0]);
                  }} data-testid="menu-convert-project">
                    <FolderPlus className="h-3.5 w-3.5 mr-2" /> Konwertuj na Projekt
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-px h-5 bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={clearSelection} data-testid="button-clear-selection">
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        <button
          className="absolute bottom-6 right-6 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-40"
          onClick={() => setAddTaskOpen(true)}
          data-testid="button-fab-add"
        >
          <Plus className="h-6 w-6" />
        </button>
      </main>

      <TaskDialog open={addTaskOpen} onOpenChange={setAddTaskOpen} projects={projects} sections={sections} defaultProjectId={isProjectView ? view.projectId : undefined} />
      {editingTask && <TaskDialog open={!!editingTask} onOpenChange={(o) => { if (!o) setEditingTask(null); }} task={editingTask} projects={projects} sections={sections} />}
      <ProjectDialog open={addProjectOpen} onOpenChange={setAddProjectOpen} areas={areas} />
      <SectionDialog open={addSectionOpen} onOpenChange={setAddSectionOpen} projects={projects} defaultProjectId={isProjectView ? view.projectId : undefined} />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <MoveDialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen} projects={projects} sections={sections} onMove={(projectId, sectionId) => {
        bulkMove.mutate({ ids: selectedTasksArray, projectId, sectionId });
      }} isPending={bulkMove.isPending} />
    </div>
  );
}

function ProjectSidebarItem({ project, tasks, isActive, onClick }: { project: TaskProject; tasks: Task[]; isActive: boolean; onClick: () => void }) {
  const count = tasks.filter(t => t.projectId === project.id).length;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm w-full text-left transition-all ${isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60 text-foreground"}`}
      data-testid={`button-project-${project.id}`}
    >
      <Circle className="h-3 w-3 shrink-0" style={{ color: project.color || "#5ADBFA", fill: project.color || "#5ADBFA" }} />
      <span className="truncate flex-1">{project.name}</span>
      <span className="text-xs tabular-nums text-muted-foreground">{count || ""}</span>
    </button>
  );
}

function TaskRow({ task, onToggle, onEdit, onClick, selected, selectMode }: {
  task: Task; onToggle: () => void; onEdit: () => void; onClick: () => void; selected: boolean; selectMode: boolean;
}) {
  const isOverdue = task.dueDate && !task.completed && isBefore(parseISO(task.dueDate), new Date()) && !isToday(parseISO(task.dueDate));

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 transition-all cursor-pointer group
        ${task.completed ? "opacity-40" : ""}
        ${selected ? "bg-primary/8 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/30"}`}
      onClick={onClick}
      data-testid={`task-row-${task.id}`}
    >
      {selectMode && (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onClick()}
          className="shrink-0"
          data-testid={`checkbox-select-${task.id}`}
        />
      )}
      <Checkbox
        checked={!!task.completed}
        onCheckedChange={(e) => { e; onToggle(); }}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0"
        data-testid={`checkbox-task-${task.id}`}
      />
      <div className="flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
        <div className={`text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}>{task.title}</div>
        {task.notes && (
          <div className="text-xs text-muted-foreground truncate mt-0.5">{task.notes}</div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {task.priority && task.priority !== "BRAK" && PRIORITY_DOT[task.priority] && (
          <div className={`h-2 w-2 rounded-full ${PRIORITY_DOT[task.priority]}`} title={task.priority} />
        )}
        {task.dueDate && (
          <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`} data-testid={`text-due-${task.id}`}>
            <Clock className="h-3 w-3" />
            {format(parseISO(task.dueDate), "d MMM", { locale: pl })}
          </span>
        )}
        {task.tags && task.tags.length > 0 && (
          <div className="hidden sm:flex items-center gap-1">
            {task.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskDialog({ open, onOpenChange, task, projects, sections, defaultProjectId }: {
  open: boolean; onOpenChange: (o: boolean) => void; task?: Task; projects: TaskProject[]; sections: TaskSection[]; defaultProjectId?: number;
}) {
  const { toast } = useToast();
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title || "");
  const [notes, setNotes] = useState(task?.notes || "");
  const [priority, setPriority] = useState(task?.priority || "BRAK");
  const [dueDate, setDueDate] = useState(task?.dueDate || "");
  const [dueTime, setDueTime] = useState(task?.dueTime || "");
  const [projectId, setProjectId] = useState<string>(String(task?.projectId || defaultProjectId || ""));
  const [sectionId, setSectionId] = useState<string>(String(task?.sectionId || ""));
  const [tagsInput, setTagsInput] = useState((task?.tags || []).join(", "));
  const [recurring, setRecurring] = useState(task?.recurring || "");
  const [reminderDate, setReminderDate] = useState(task?.reminderDate || "");
  const [reminderTime, setReminderTime] = useState(task?.reminderTime || "");
  const [newCheckItem, setNewCheckItem] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setTitle(task?.title || "");
    setNotes(task?.notes || "");
    setPriority(task?.priority || "BRAK");
    setDueDate(task?.dueDate || "");
    setDueTime(task?.dueTime || "");
    setProjectId(String(task?.projectId || defaultProjectId || ""));
    setSectionId(String(task?.sectionId || ""));
    setTagsInput((task?.tags || []).join(", "));
    setRecurring(task?.recurring || "");
    setReminderDate(task?.reminderDate || "");
    setReminderTime(task?.reminderTime || "");
    setConfirmDelete(false);
  }, [task, open]);

  const { data: checklist = [] } = useQuery<TaskChecklistItem[]>({
    queryKey: ["/api/task-checklist", task?.id],
    enabled: !!task?.id,
  });

  const filteredSections = sections.filter((s) => projectId && s.projectId === Number(projectId));

  const createTask = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/tasks", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); onOpenChange(false); toast({ title: "Zadanie utworzone" }); },
  });

  const updateTask = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("PATCH", `/api/tasks/${task!.id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); onOpenChange(false); toast({ title: "Zadanie zaktualizowane" }); },
  });

  const deleteTask = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/tasks/${task!.id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); onOpenChange(false); toast({ title: "Zadanie usunięte" }); },
  });

  const addCheckItem = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/task-checklist", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/task-checklist", task?.id] }); setNewCheckItem(""); },
  });

  const toggleCheckItem = useMutation({
    mutationFn: (item: TaskChecklistItem) => apiRequest("PATCH", `/api/task-checklist/${item.id}`, { completed: !item.completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/task-checklist", task?.id] }),
  });

  const deleteCheckItem = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/task-checklist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/task-checklist", task?.id] }),
  });

  const handleSubmit = () => {
    if (!title.trim()) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const data: Record<string, unknown> = {
      title: title.trim(), notes: notes || null, priority, tags,
      dueDate: dueDate || null, dueTime: dueTime || null,
      projectId: projectId && projectId !== "none" ? Number(projectId) : null,
      sectionId: sectionId && sectionId !== "none" ? Number(sectionId) : null,
      recurring: recurring || null,
      reminderDate: reminderDate || null, reminderTime: reminderTime || null,
    };
    isEdit ? updateTask.mutate(data) : createTask.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" data-testid="dialog-task">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edytuj zadanie" : "Nowe zadanie"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Tytuł</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nazwa zadania" data-testid="input-task-title" />
          </div>
          <div className="space-y-1">
            <Label>Notatki</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dodatkowe informacje..." data-testid="input-task-notes" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Priorytet</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-priority-trigger"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["BRAK", "NISKI", "ŚREDNI", "WYSOKI", "PILNY"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Termin</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="input-task-due-date" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Godzina terminu</Label>
              <Input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} data-testid="input-task-due-time" />
            </div>
            <div className="space-y-1">
              <Label>Powtarzanie</Label>
              <Input value={recurring} onChange={(e) => setRecurring(e.target.value)} placeholder="np. co tydzień" data-testid="input-task-recurring" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Projekt</Label>
              <Select value={projectId} onValueChange={(v) => { setProjectId(v); setSectionId(""); }}>
                <SelectTrigger data-testid="select-project-trigger"><SelectValue placeholder="Brak" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Sekcja</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger data-testid="select-section-trigger"><SelectValue placeholder="Brak" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brak</SelectItem>
                  {filteredSections.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Tagi (oddzielone przecinkami)</Label>
            <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="pilne, praca, dom" data-testid="input-task-tags" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data przypomnienia</Label>
              <Input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} data-testid="input-task-reminder-date" />
            </div>
            <div className="space-y-1">
              <Label>Godzina przypomnienia</Label>
              <Input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} data-testid="input-task-reminder-time" />
            </div>
          </div>

          {isEdit && (
            <div className="space-y-2 border-t pt-3">
              <Label>Lista kontrolna</Label>
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-2" data-testid={`checklist-item-${item.id}`}>
                  <Checkbox checked={!!item.completed} onCheckedChange={() => toggleCheckItem.mutate(item)} data-testid={`checkbox-checklist-${item.id}`} />
                  <span className={`text-sm flex-1 ${item.completed ? "line-through text-muted-foreground" : ""}`}>{item.title}</span>
                  <Button size="icon" variant="ghost" onClick={() => deleteCheckItem.mutate(item.id)} data-testid={`button-delete-checklist-${item.id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <Input value={newCheckItem} onChange={(e) => setNewCheckItem(e.target.value)} placeholder="Nowy element..." className="flex-1" data-testid="input-checklist-new"
                  onKeyDown={(e) => { if (e.key === "Enter" && newCheckItem.trim()) { e.preventDefault(); addCheckItem.mutate({ taskId: task!.id, title: newCheckItem.trim() }); } }} />
                <Button size="icon" variant="ghost" onClick={() => { if (newCheckItem.trim()) addCheckItem.mutate({ taskId: task!.id, title: newCheckItem.trim() }); }} data-testid="button-add-checklist">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
          {isEdit ? (
            <>
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive">Na pewno?</span>
                  <Button size="sm" variant="destructive" onClick={() => deleteTask.mutate()} disabled={deleteTask.isPending} data-testid="button-confirm-delete-task">Tak, usuń</Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)} data-testid="button-cancel-delete-task">Anuluj</Button>
                </div>
              ) : (
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)} data-testid="button-delete-task">
                  <Trash2 className="h-4 w-4 mr-1" /> Usuń
                </Button>
              )}
            </>
          ) : <div />}
          <Button onClick={handleSubmit} disabled={createTask.isPending || updateTask.isPending} data-testid="button-submit-task">
            {(createTask.isPending || updateTask.isPending) ? "Zapisywanie..." : isEdit ? "Zapisz zmiany" : "Dodaj zadanie"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const COLOR_OPTIONS = ["#5ADBFA", "#FF6B6B", "#51CF66", "#FFD43B", "#845EF7", "#FF922B", "#20C997", "#F06595"];

function ProjectDialog({ open, onOpenChange, areas }: { open: boolean; onOpenChange: (o: boolean) => void; areas: string[] }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#5ADBFA");
  const [area, setArea] = useState("");
  const [newArea, setNewArea] = useState("");

  const createProject = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/task-projects", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-projects"] });
      onOpenChange(false);
      setName("");
      setNewArea("");
      toast({ title: "Projekt utworzony" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="dialog-project">
        <DialogHeader>
          <DialogTitle>Nowy projekt</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Nazwa</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa projektu" data-testid="input-project-name" />
          </div>
          <div className="space-y-1">
            <Label>Kolor</Label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  data-testid={`button-color-${c}`}
                />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <Label>Obszar (grupa)</Label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger data-testid="select-project-area"><SelectValue placeholder="Brak" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Brak (bez grupy)</SelectItem>
                {areas.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Lub nowy obszar</Label>
            <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="np. FIRMA, OSOBISTE" data-testid="input-new-area" />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={() => {
              if (name.trim()) {
                const finalArea = newArea.trim() || (area && area !== "none" ? area : null);
                createProject.mutate({ name: name.trim(), color, area: finalArea });
              }
            }}
            disabled={createProject.isPending}
            data-testid="button-submit-project"
          >
            {createProject.isPending ? "Tworzenie..." : "Utwórz projekt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionDialog({ open, onOpenChange, projects, defaultProjectId }: {
  open: boolean; onOpenChange: (o: boolean) => void; projects: TaskProject[]; defaultProjectId?: number;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(String(defaultProjectId || ""));

  const createSection = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/task-sections", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-sections"] });
      onOpenChange(false);
      setName("");
      toast({ title: "Sekcja utworzona" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" data-testid="dialog-section">
        <DialogHeader>
          <DialogTitle>Nowa sekcja</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label>Nazwa sekcji</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa sekcji" data-testid="input-section-name" />
          </div>
          <div className="space-y-1">
            <Label>Projekt</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger data-testid="select-section-project"><SelectValue placeholder="Wybierz projekt" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button
            onClick={() => {
              if (name.trim() && projectId) {
                createSection.mutate({ name: name.trim(), projectId: Number(projectId) });
              }
            }}
            disabled={createSection.isPending}
            data-testid="button-submit-section"
          >
            {createSection.isPending ? "Tworzenie..." : "Utwórz sekcję"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [settingsPage, setSettingsPage] = useState<"main" | "appearance" | "general">("main");
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") || "light";
    }
    return "light";
  });

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem("theme", t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleBack = () => setSettingsPage("main");

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setSettingsPage("main"); }}>
      <DialogContent className="max-w-sm" data-testid="dialog-settings">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {settingsPage !== "main" && (
              <button onClick={handleBack} className="p-1 rounded hover:bg-muted" data-testid="button-settings-back">
                <ChevronRight className="h-4 w-4 rotate-180" />
              </button>
            )}
            <DialogTitle>
              {settingsPage === "main" ? "Ustawienia" : settingsPage === "appearance" ? "Wygląd" : "Ogólne"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {settingsPage === "main" && (
          <div className="space-y-1 py-2">
            <button className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-muted transition-colors text-left" onClick={() => setSettingsPage("appearance")} data-testid="button-settings-appearance">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-xs font-bold">Aa</div>
              <span className="text-sm">Wygląd</span>
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </button>
            <button className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-muted transition-colors text-left" onClick={() => setSettingsPage("general")} data-testid="button-settings-general">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center">
                <Settings className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm">Ogólne</span>
              <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground" />
            </button>
          </div>
        )}

        {settingsPage === "appearance" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Wybierz preferowany rozmiar tekstu i wygląd.</p>
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Wygląd</div>
              <div className="space-y-1">
                {[
                  { value: "light", label: "Jasny", icon: Sun },
                  { value: "dark", label: "Ciemny", icon: Moon },
                  { value: "system", label: "Automatyczny", icon: Monitor },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left ${theme === value ? "bg-primary/10" : "hover:bg-muted"}`}
                    onClick={() => applyTheme(value)}
                    data-testid={`button-theme-${value}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm flex-1">{label}</span>
                    {theme === value && <span className="text-primary text-sm">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {settingsPage === "general" && (
          <div className="space-y-1 py-2">
            {[
              { label: "Licznik zadań", icon: "🔴" },
              { label: "Dziś", icon: "⭐" },
              { label: "Tydzień", icon: "📅" },
              { label: "Przycisk Plus", icon: "➕" },
            ].map(({ label, icon }) => (
              <button
                key={label}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left"
                data-testid={`button-general-${label}`}
              >
                <span className="text-lg">{icon}</span>
                <span className="text-sm flex-1">{label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveDialog({ open, onOpenChange, projects, sections, onMove, isPending }: {
  open: boolean; onOpenChange: (o: boolean) => void;
  projects: TaskProject[]; sections: TaskSection[];
  onMove: (projectId: number | null, sectionId: number | null) => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs" data-testid="dialog-move">
        <DialogHeader>
          <DialogTitle>Przenieś zadania</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 py-2">
          <button
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left text-sm"
            onClick={() => onMove(null, null)}
            disabled={isPending}
            data-testid="button-move-inbox"
          >
            <Inbox className="h-4 w-4 text-[#5ADBFA]" />
            Odebrane (bez projektu)
          </button>
          {projects.map((p) => {
            const projectSections = sections.filter(s => s.projectId === p.id);
            return (
              <div key={p.id}>
                <button
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left text-sm"
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
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 pl-8 rounded-lg hover:bg-muted transition-colors text-left text-sm text-muted-foreground"
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
