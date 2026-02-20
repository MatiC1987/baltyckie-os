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
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import type { Task, TaskProject, TaskSection, TaskChecklistItem } from "@shared/schema";
import { format, parseISO, isToday, isThisWeek } from "date-fns";
import { pl } from "date-fns/locale";
import {
  Inbox, CalendarDays, Star, FolderOpen, Plus, Trash2,
  Calendar, Clock, Tag, ChevronDown, ChevronRight, Circle,
} from "lucide-react";

type ViewType = "inbox" | "today" | "week" | "priority" | { projectId: number };

const PRIORITY_COLORS: Record<string, string> = {
  PILNY: "bg-red-500/15 text-red-700 dark:text-red-400",
  WYSOKI: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  ŚREDNI: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  NISKI: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  BRAK: "bg-muted text-muted-foreground",
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

export default function Tasks() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewType>("inbox");
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: projects = [] } = useQuery<TaskProject[]>({ queryKey: ["/api/task-projects"] });
  const { data: sections = [] } = useQuery<TaskSection[]>({ queryKey: ["/api/task-sections"] });

  const toggleComplete = useMutation({
    mutationFn: (task: Task) => apiRequest("PATCH", `/api/tasks/${task.id}`, { completed: !task.completed }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }),
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

  const smartViews: { key: string; view: ViewType; icon: typeof Inbox; label: string }[] = [
    { key: "inbox", view: "inbox", icon: Inbox, label: "Odebrane" },
    { key: "today", view: "today", icon: CalendarDays, label: "Dziś" },
    { key: "week", view: "week", icon: Calendar, label: "W tym tygodniu" },
    { key: "priority", view: "priority", icon: Star, label: "Priorytetowe" },
  ];

  const isActive = (v: ViewType) => {
    if (typeof view === "object" && typeof v === "object") return view.projectId === v.projectId;
    return view === v;
  };

  return (
    <div className="flex h-full" data-testid="page-tasks">
      <aside className="w-[250px] shrink-0 border-r flex flex-col p-3 gap-1 overflow-y-auto" data-testid="tasks-sidebar">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 px-2">Widoki</div>
        {smartViews.map((sv) => (
          <button
            key={sv.key}
            onClick={() => setView(sv.view)}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm w-full text-left transition-colors ${isActive(sv.view) ? "bg-accent text-accent-foreground" : "hover-elevate"}`}
            data-testid={`button-view-${sv.key}`}
          >
            <sv.icon className="h-4 w-4 shrink-0" />
            <span>{sv.label}</span>
            <Badge variant="secondary" className="ml-auto no-default-hover-elevate no-default-active-elevate">{filterTasks(tasks, sv.view).length}</Badge>
          </button>
        ))}

        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mt-4 mb-1 px-2">Projekty</div>
        {projects.map((p) => (
          <button
            key={p.id}
            onClick={() => setView({ projectId: p.id })}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm w-full text-left transition-colors ${isActive({ projectId: p.id }) ? "bg-accent text-accent-foreground" : "hover-elevate"}`}
            data-testid={`button-project-${p.id}`}
          >
            <Circle className="h-3 w-3 shrink-0" style={{ color: p.color || "#5ADBFA", fill: p.color || "#5ADBFA" }} />
            <span className="truncate">{p.name}</span>
            <Badge variant="secondary" className="ml-auto no-default-hover-elevate no-default-active-elevate">
              {tasks.filter((t) => t.projectId === p.id).length}
            </Badge>
          </button>
        ))}
        <Button variant="ghost" size="sm" className="mt-1 justify-start gap-2" onClick={() => setAddProjectOpen(true)} data-testid="button-add-project">
          <Plus className="h-4 w-4" /> Dodaj projekt
        </Button>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden" data-testid="tasks-main">
        <div className="flex items-center justify-between gap-2 p-4 border-b flex-wrap">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold" data-testid="text-view-title">{viewLabel(view, projects)}</h2>
          </div>
          <Button size="sm" onClick={() => setAddTaskOpen(true)} data-testid="button-add-task">
            <Plus className="h-4 w-4 mr-1" /> Dodaj zadanie
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {isProjectView ? (
            <>
              {projectSections.map((sec) => {
                const sectionTasks = filtered.filter((t) => t.sectionId === sec.id);
                const collapsed = collapsedSections.has(sec.id);
                return (
                  <div key={sec.id} data-testid={`section-${sec.id}`}>
                    <button onClick={() => toggleSection(sec.id)} className="flex items-center gap-1 text-sm font-medium py-1 hover-elevate rounded-md px-1 w-full text-left" data-testid={`button-toggle-section-${sec.id}`}>
                      {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {sec.name} <span className="text-muted-foreground ml-1">({sectionTasks.length})</span>
                    </button>
                    {!collapsed && sectionTasks.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggleComplete.mutate(t)} onEdit={() => setEditingTask(t)} />)}
                  </div>
                );
              })}
              {filtered.filter((t) => !t.sectionId).map((t) => (
                <TaskRow key={t.id} task={t} onToggle={() => toggleComplete.mutate(t)} onEdit={() => setEditingTask(t)} />
              ))}
            </>
          ) : (
            filtered.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggleComplete.mutate(t)} onEdit={() => setEditingTask(t)} />)
          )}
          {filtered.length === 0 && <div className="text-center text-muted-foreground py-12" data-testid="text-empty-tasks">Brak zadań w tym widoku</div>}
        </div>
      </main>

      <TaskDialog open={addTaskOpen} onOpenChange={setAddTaskOpen} projects={projects} sections={sections} defaultProjectId={isProjectView ? view.projectId : undefined} />
      {editingTask && <TaskDialog open={!!editingTask} onOpenChange={(o) => { if (!o) setEditingTask(null); }} task={editingTask} projects={projects} sections={sections} />}
      <ProjectDialog open={addProjectOpen} onOpenChange={setAddProjectOpen} />
    </div>
  );
}

function TaskRow({ task, onToggle, onEdit }: { task: Task; onToggle: () => void; onEdit: () => void }) {
  return (
    <div className={`flex items-center gap-3 px-2 py-1.5 rounded-md hover-elevate group ${task.completed ? "opacity-50" : ""}`} data-testid={`task-row-${task.id}`}>
      <Checkbox checked={!!task.completed} onCheckedChange={onToggle} data-testid={`checkbox-task-${task.id}`} />
      <button className="flex-1 text-left text-sm truncate" onClick={onEdit} data-testid={`button-edit-task-${task.id}`}>
        <span className={task.completed ? "line-through" : ""}>{task.title}</span>
      </button>
      {task.priority && task.priority !== "BRAK" && (
        <Badge variant="secondary" className={`text-xs ${PRIORITY_COLORS[task.priority] || ""}`} data-testid={`badge-priority-${task.id}`}>{task.priority}</Badge>
      )}
      {task.dueDate && (
        <span className="text-xs text-muted-foreground flex items-center gap-1" data-testid={`text-due-${task.id}`}>
          <Calendar className="h-3 w-3" />
          {format(parseISO(task.dueDate), "d MMM", { locale: pl })}
        </span>
      )}
      {task.tags && task.tags.length > 0 && (
        <div className="flex items-center gap-1">
          <Tag className="h-3 w-3 text-muted-foreground" />
          {task.tags.slice(0, 2).map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
        </div>
      )}
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
      projectId: projectId ? Number(projectId) : null,
      sectionId: sectionId ? Number(sectionId) : null,
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
              <Select value={priority} onValueChange={setPriority} data-testid="select-priority">
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

function ProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#5ADBFA");

  const createProject = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiRequest("POST", "/api/task-projects", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/task-projects"] }); onOpenChange(false); setName(""); toast({ title: "Projekt utworzony" }); },
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
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={() => { if (name.trim()) createProject.mutate({ name: name.trim(), color }); }} disabled={createProject.isPending} data-testid="button-submit-project">
            {createProject.isPending ? "Tworzenie..." : "Utwórz projekt"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
