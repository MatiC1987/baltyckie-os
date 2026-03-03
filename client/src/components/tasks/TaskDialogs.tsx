import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTasksApi } from "@/lib/tasksApiContext";
import type { TaskProject, TaskSection } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PRIORITY_FLAG_COLORS, PRIORITY_LABELS, getStoredDefaultPriority, getStoredDefaultProject,
  FONT_SIZE_OPTIONS, type TaskFontSize,
} from "./taskUtils";
import type { SettingsPage } from "./taskUtils";
import {
  Flag, Star, Calendar, Tag, Plus, Sun, Moon, Monitor, Check, ChevronRight,
  Inbox, Circle, Type,
} from "lucide-react";

export function TaskDialog({
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
  const { apiRequest } = useTasksApi();
  const queryClient = useQueryClient();
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
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
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

export function ProjectDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (data: Record<string, unknown>) => void }) {
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

export function SectionDialog({
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

export function SettingsDialog({
  open,
  onOpenChange,
  showCounts,
  setShowCounts,
  showOverdueInToday,
  setShowOverdueInToday,
  weekStart,
  setWeekStart,
  fontSize,
  setFontSize,
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
  fontSize: TaskFontSize;
  setFontSize: (v: TaskFontSize) => void;
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
    font_size: "Wielkość czcionki",
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPage("main"); }}>
      <DialogContent className="max-w-sm" data-testid="dialog-settings">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {page !== "main" && (
              <button onClick={handleBack} className="p-1 rounded hover:bg-muted/50" data-testid="button-settings-back">
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
              { key: "font_size" as SettingsPage, label: "Wielkość czcionki", icon: <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center"><Type className="h-4 w-4 text-white" /></div> },
              { key: "counter" as SettingsPage, label: "Licznik zadań", icon: <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center"><Tag className="h-4 w-4 text-white" /></div> },
              { key: "today_settings" as SettingsPage, label: "Dziś", icon: <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center"><Star className="h-4 w-4 text-white" /></div> },
              { key: "week_settings" as SettingsPage, label: "Tydzień", icon: <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center"><Calendar className="h-4 w-4 text-white" /></div> },
              { key: "plus_settings" as SettingsPage, label: "Przycisk Plus", icon: <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"><Plus className="h-4 w-4 text-white" /></div> },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
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
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left ${theme === value ? "bg-primary/10" : "hover:bg-muted/50"}`}
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

        {page === "font_size" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Zmień wielkość czcionki w zadaniach, menu i notatkach.</p>
            <div className="space-y-1">
              {FONT_SIZE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left ${fontSize === value ? "bg-primary/10" : "hover:bg-muted/50"}`}
                  onClick={() => setFontSize(value)}
                  data-testid={`button-font-size-${value}`}
                >
                  <span className="text-sm flex-1" style={{ fontSize: `${value}px` }}>{label}</span>
                  {fontSize === value && <Check className="h-4 w-4 text-primary" />}
                </button>
              ))}
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

export function MoveDialog({
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
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left text-sm"
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
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left text-sm"
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
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 pl-8 rounded-lg hover:bg-muted/50 transition-colors text-left text-sm text-muted-foreground"
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
