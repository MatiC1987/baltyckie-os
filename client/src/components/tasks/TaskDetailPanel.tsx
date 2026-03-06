import { memo, useState, useEffect, useRef, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { pl } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTasksApi } from "@/lib/tasksApiContext";
import type { Task, TaskProject, TaskSection, TaskChecklistItem, Employee } from "@shared/schema";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TaskCheckbox } from "./TaskCheckbox";
import { PRIORITY_FLAG_COLORS, PRIORITY_LABELS, PRIORITY_BORDER_COLORS, getTagColor, isDeadlineNear } from "./taskUtils";
import {
  X, Trash2, Users, Flag, Calendar, Clock, Tag, FolderOpen, RefreshCw,
  Moon, Sparkles, AlertTriangle, Plus, UserPlus, Layers,
  ChevronLeft, MoreHorizontal,
} from "lucide-react";

interface DetailPanelProps {
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
}

export const TaskDetailPanel = memo(function TaskDetailPanel({
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
}: DetailPanelProps) {
  const { apiRequest } = useTasksApi();
  const queryClient = useQueryClient();
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
  const currentProject = projects.find(p => p.id === task.projectId);
  const deadlineStatus = isDeadlineNear(task);

  const handleTagsBlur = () => {
    const newTags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const oldTags = task.tags || [];
    if (JSON.stringify(newTags) !== JSON.stringify(oldTags)) {
      onUpdate({ tags: newTags });
    }
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [panelTranslateX, setPanelTranslateX] = useState(0);
  const [panelSwiping, setPanelSwiping] = useState(false);
  const panelSwipeRef = useRef({ x: 0, y: 0, direction: null as "horizontal" | "vertical" | null });

  const handlePanelTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const t = e.touches[0];
    panelSwipeRef.current = { x: t.clientX, y: t.clientY, direction: null };
    setPanelSwiping(false);
  };
  const handlePanelTouchMove = (e: React.TouchEvent) => {
    if (!isMobile) return;
    const t = e.touches[0];
    const dx = t.clientX - panelSwipeRef.current.x;
    const dy = t.clientY - panelSwipeRef.current.y;
    if (!panelSwipeRef.current.direction) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      panelSwipeRef.current.direction = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (panelSwipeRef.current.direction === "horizontal" && dx > 0) {
      setPanelSwiping(true);
      setPanelTranslateX(dx);
    }
  };
  const handlePanelTouchEnd = () => {
    if (!panelSwiping) return;
    if (panelTranslateX > window.innerWidth * 0.3) {
      onClose();
    }
    setPanelTranslateX(0);
    setPanelSwiping(false);
    panelSwipeRef.current.direction = null;
  };

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: panelTranslateX || 0, opacity: panelTranslateX > 0 ? 1 - panelTranslateX / window.innerWidth * 0.5 : 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={panelSwiping ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
      className={`${isMobile ? "fixed inset-0 z-50 w-full" : "w-[400px]"} shrink-0 ${isMobile ? "" : "border-l"} ${isMobile ? "bg-black" : "bg-background"} flex flex-col overflow-hidden`}
      style={isMobile ? { fontFamily: "-apple-system, 'SF Pro Text', 'SF Pro Display', system-ui, sans-serif", willChange: "transform" } : undefined}
      onTouchStart={handlePanelTouchStart}
      onTouchMove={handlePanelTouchMove}
      onTouchEnd={handlePanelTouchEnd}
      data-testid="detail-panel"
    >
      {isMobile ? (
        <div className="flex items-center gap-2 px-2 py-2" style={{ paddingTop: "env(safe-area-inset-top, 8px)" }}>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#5ADBFA]" data-testid="button-close-detail">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-white/60"
            data-testid="button-detail-more"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {mobileMenuOpen && (
            <div className="absolute right-4 top-14 z-50 rounded-xl py-2 min-w-[160px]" style={{ backgroundColor: "#2C2C2E" }}>
              <button
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400"
                onClick={() => { setMobileMenuOpen(false); setDeleteConfirm(true); }}
                data-testid="button-delete-detail"
              >
                <Trash2 className="h-4 w-4" />
                Usuń zadanie
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-5 py-3.5 border-b">
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted/50 text-muted-foreground" data-testid="button-close-detail">
            <X className="h-4 w-4" />
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setDeleteConfirm(true)}
            className="p-1.5 rounded-full hover:bg-muted/50 text-destructive/60 hover:text-destructive"
            data-testid="button-delete-detail"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${isMobile ? "pb-20" : ""}`} onClick={isMobile ? () => setMobileMenuOpen(false) : undefined}>
        <div className={isMobile ? "px-5 pt-2 pb-4" : "px-6 pt-6 pb-4"}>
          <div className="flex items-start gap-3">
            <TaskCheckbox
              checked={!!task.completed}
              priority={task.priority || "BRAK"}
              onToggle={onToggleComplete}
              size={isMobile ? 24 : 22}
              className="mt-0.5"
              data-testid="checkbox-detail-complete"
            />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title.trim() && title !== task.title) onUpdate({ title: title.trim() });
              }}
              className={`border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-lg font-semibold h-auto py-0 leading-snug ${isMobile ? "text-[17px] text-white placeholder:text-white/30" : ""}`}
              data-testid="input-detail-title"
            />
          </div>
        </div>

        <div className={isMobile ? "px-5 pb-4" : "px-6 pb-4"}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => {
              if (notes !== (task.notes || "")) onUpdate({ notes });
            }}
            placeholder={isMobile ? "Notes" : "Notatki..."}
            className={`resize-none text-sm min-h-[80px] ${isMobile ? "text-[15px] bg-transparent border-0 text-white/80 placeholder:text-white/25 rounded-none focus-visible:ring-0" : "bg-muted/5 border-border/30 rounded-lg"}`}
            data-testid="textarea-detail-notes"
          />
        </div>

        <div className={isMobile ? "px-5 pb-4" : "px-6 pb-4"}>
          <div className={`flex gap-2 ${isMobile ? "overflow-x-auto whitespace-nowrap pb-1 -mx-5 px-5 scrollbar-none" : "flex-wrap"}`} style={isMobile ? { WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } : undefined}>
            <Popover>
              <PopoverTrigger asChild>
                <button className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                  isMobile ? "rounded-full px-3 py-1.5" : "rounded-lg"
                } ${
                  task.dueDate
                    ? isMobile ? "text-white" : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : isMobile ? "text-white/50" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`} style={isMobile ? { backgroundColor: task.dueDate ? "#1E6FD9" : "#2C2C2E" } : undefined} data-testid="chip-due-date">
                  <Calendar className="h-3 w-3" />
                  {task.dueDate ? format(parseISO(task.dueDate), "d MMM", { locale: pl }) : "+ Data"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <Input
                  type="date"
                  value={task.dueDate || ""}
                  onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
                  className="w-auto"
                  data-testid="input-detail-due-date"
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                  isMobile ? "rounded-full px-3 py-1.5" : "rounded-lg"
                } ${
                  task.deadlineDate
                    ? isMobile ? "text-white" :
                      deadlineStatus === "passed" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    : deadlineStatus === "urgent" ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    : deadlineStatus === "warning" ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                    : "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                  : isMobile ? "text-white/50" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`} style={isMobile ? { backgroundColor: task.deadlineDate ? (deadlineStatus === "passed" || deadlineStatus === "urgent" ? "#D32F2F" : "#E65100") : "#2C2C2E" } : undefined} data-testid="chip-deadline">
                  <AlertTriangle className="h-3 w-3" />
                  {task.deadlineDate ? format(parseISO(task.deadlineDate), "d MMM", { locale: pl }) : "+ Deadline"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <Input
                  type="date"
                  value={task.deadlineDate || ""}
                  onChange={(e) => onUpdate({ deadlineDate: e.target.value || null })}
                  className="w-auto"
                  data-testid="input-detail-deadline"
                />
              </PopoverContent>
            </Popover>

            {task.dueTime && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium shrink-0 ${isMobile ? "rounded-full px-3 py-1.5 text-white" : "rounded-lg bg-muted/30 text-muted-foreground"}`} style={isMobile ? { backgroundColor: "#2C2C2E" } : undefined}>
                <Clock className="h-3 w-3" />
                {task.dueTime}
              </span>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <button className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                  isMobile ? "rounded-full px-3 py-1.5" : "rounded-lg"
                } ${
                  task.priority && task.priority !== "BRAK"
                    ? isMobile ? "text-white" : "bg-opacity-10"
                    : isMobile ? "text-white/50" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`} style={task.priority && task.priority !== "BRAK" ? (isMobile ? {
                  backgroundColor: PRIORITY_BORDER_COLORS[task.priority],
                } : {
                  backgroundColor: `${PRIORITY_BORDER_COLORS[task.priority]}15`,
                  color: PRIORITY_BORDER_COLORS[task.priority],
                }) : (isMobile ? { backgroundColor: "#2C2C2E" } : undefined)} data-testid="chip-priority">
                  <Flag className="h-3 w-3" />
                  {PRIORITY_LABELS[task.priority || "BRAK"]}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" align="start">
                {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                  <button
                    key={val}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors"
                    onClick={() => onUpdate({ priority: val })}
                    data-testid={`priority-option-${val}`}
                  >
                    <Flag className={`h-3.5 w-3.5 ${PRIORITY_FLAG_COLORS[val]}`} />
                    {label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                  isMobile ? "rounded-full px-3 py-1.5" : "rounded-lg"
                } ${
                  currentProject
                    ? isMobile ? "text-white" : ""
                    : isMobile ? "text-white/50" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`} style={currentProject ? (isMobile ? {
                  backgroundColor: currentProject.color || "#5ADBFA",
                } : {
                  backgroundColor: `${currentProject.color || "#5ADBFA"}15`,
                  color: currentProject.color || "#5ADBFA",
                }) : (isMobile ? { backgroundColor: "#2C2C2E" } : undefined)} data-testid="chip-project">
                  <FolderOpen className="h-3 w-3" />
                  {currentProject ? currentProject.name : "+ Projekt"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors text-muted-foreground"
                  onClick={() => onUpdate({ projectId: null, sectionId: null })}
                >
                  Brak
                </button>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors"
                    onClick={() => onUpdate({ projectId: p.id, sectionId: null })}
                  >
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color || "#5ADBFA" }} />
                    {p.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors shrink-0 ${
                  isMobile ? "rounded-full px-3 py-1.5" : "rounded-lg"
                } ${
                  task.area
                    ? isMobile ? "text-white" : "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                    : isMobile ? "text-white/50" : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                }`} style={isMobile ? { backgroundColor: task.area ? "#0D7377" : "#2C2C2E" } : undefined} data-testid="chip-area">
                  <Layers className="h-3 w-3" />
                  {task.area || "+ Przestrzeń"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                <button
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors text-muted-foreground"
                  onClick={() => onUpdate({ area: null })}
                >
                  Brak
                </button>
                {Array.from(new Set(projects.filter(p => !p.archived && p.area).map(p => p.area!))).map((a) => (
                  <button
                    key={a}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors ${task.area === a ? 'bg-muted/50 font-medium' : ''}`}
                    onClick={() => onUpdate({ area: a })}
                  >
                    {a}
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <EmployeeAssignChip task={task} onUpdate={onUpdate} />

            {task.recurring && (
              <span className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium shrink-0 ${isMobile ? "rounded-full px-3 py-1.5 text-white" : "rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300"}`} style={isMobile ? { backgroundColor: "#7C3AED" } : undefined}>
                <RefreshCw className="h-3 w-3" />
                {task.recurring}
              </span>
            )}

            {task.evening && (
              <button
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium shrink-0 ${isMobile ? "rounded-full px-3 py-1.5 text-white" : "rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"}`}
                style={isMobile ? { backgroundColor: "#4338CA" } : undefined}
                onClick={() => onUpdate({ evening: false })}
                data-testid="chip-evening"
              >
                <Moon className="h-3 w-3" />
                Wieczorem
              </button>
            )}

            {task.someday && (
              <button
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium shrink-0 ${isMobile ? "rounded-full px-3 py-1.5 text-white" : "rounded-lg bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"}`}
                style={isMobile ? { backgroundColor: "#7C3AED" } : undefined}
                onClick={() => onUpdate({ someday: false })}
                data-testid="chip-someday"
              >
                <Sparkles className="h-3 w-3" />
                Kiedyś
              </button>
            )}

            {(task.tags || []).map((tag) => (
              <span
                key={tag}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium shrink-0 ${isMobile ? "rounded-full px-3 py-1.5 text-white" : `rounded-lg ${getTagColor(tag)}`}`}
                style={isMobile ? { backgroundColor: "#2C2C2E" } : undefined}
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className={`border-t mx-6 ${isMobile ? "border-white/[0.06]" : "border-border/30"}`} />

        <div className={`${isMobile ? "px-5" : "px-6"} py-4 space-y-4`}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={`text-[10px] uppercase tracking-wider font-semibold ${isMobile ? "text-white/30" : "text-muted-foreground/50"}`}>Kiedy (When)</Label>
              <Input
                type="date"
                value={task.dueDate || ""}
                onChange={(e) => onUpdate({ dueDate: e.target.value || null })}
                className="mt-1 h-8 text-xs"
                data-testid="input-detail-due-date-field"
              />
            </div>
            <div>
              <Label className={`text-[10px] uppercase tracking-wider font-semibold ${isMobile ? "text-white/30" : "text-muted-foreground/50"}`}>Godzina</Label>
              <Input
                type="time"
                value={task.dueTime || ""}
                onChange={(e) => onUpdate({ dueTime: e.target.value || null })}
                className="mt-1 h-8 text-xs"
                data-testid="input-detail-due-time"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className={`text-[10px] uppercase tracking-wider font-semibold ${isMobile ? "text-white/30" : "text-muted-foreground/50"}`}>Deadline</Label>
              <Input
                type="date"
                value={task.deadlineDate || ""}
                onChange={(e) => onUpdate({ deadlineDate: e.target.value || null })}
                className="mt-1 h-8 text-xs"
                data-testid="input-detail-deadline-field"
              />
            </div>
            <div>
              <Label className={`text-[10px] uppercase tracking-wider font-semibold ${isMobile ? "text-white/30" : "text-muted-foreground/50"}`}>Przypomnienie</Label>
              <Input
                type="date"
                value={task.reminderDate || ""}
                onChange={(e) => onUpdate({ reminderDate: e.target.value || null })}
                className="mt-1 h-8 text-xs"
                data-testid="input-detail-reminder-date"
              />
            </div>
          </div>

          {projectSections.length > 0 && (
            <div>
              <Label className={`text-[10px] uppercase tracking-wider font-semibold ${isMobile ? "text-white/30" : "text-muted-foreground/50"}`}>Sekcja</Label>
              <Select
                value={task.sectionId ? String(task.sectionId) : "none"}
                onValueChange={(v) => onUpdate({ sectionId: v === "none" ? null : Number(v) })}
              >
                <SelectTrigger className="mt-1 h-8 text-xs" data-testid="select-detail-section">
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

          <div>
            <Label className={`text-[10px] uppercase tracking-wider font-semibold ${isMobile ? "text-white/30" : "text-muted-foreground/50"}`}>Tagi (oddzielone przecinkami)</Label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onBlur={handleTagsBlur}
              placeholder="np. praca, dom, pilne"
              className="mt-1 h-8 text-xs"
              data-testid="input-detail-tags"
            />
          </div>

          <div>
            <Label className={`text-[10px] uppercase tracking-wider font-semibold ${isMobile ? "text-white/30" : "text-muted-foreground/50"}`}>Powtarzanie</Label>
            <Select
              value={task.recurring || "none"}
              onValueChange={(v) => onUpdate({ recurring: v === "none" ? null : v })}
            >
              <SelectTrigger className="mt-1 h-8 text-xs" data-testid="select-detail-recurring">
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

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Moon className="h-3.5 w-3.5 text-indigo-400" />
              <span className={`text-xs ${isMobile ? "text-white/60" : "text-muted-foreground"}`}>Wieczorem</span>
            </div>
            <Switch
              checked={!!task.evening}
              onCheckedChange={(v) => onUpdate({ evening: v })}
              data-testid="switch-evening"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span className={`text-xs ${isMobile ? "text-white/60" : "text-muted-foreground"}`}>Kiedyś</span>
            </div>
            <Switch
              checked={!!task.someday}
              onCheckedChange={(v) => onUpdate({ someday: v })}
              data-testid="switch-someday"
            />
          </div>
        </div>

        <div className={`border-t mx-6 ${isMobile ? "border-white/[0.06]" : "border-border/30"}`} />

        <div className={`${isMobile ? "px-5" : "px-6"} py-4`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${isMobile ? "text-white/30" : "text-muted-foreground/50"}`}>Lista kontrolna</span>
            <span className={`text-[10px] tabular-nums ${isMobile ? "text-white/40" : "text-muted-foreground"}`}>
              {checklist.filter((c) => c.completed).length}/{checklist.length}
            </span>
          </div>
          {checklist.length > 0 && (
            <div className="h-1 rounded-full bg-muted/50 mb-3 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${checklist.length > 0 ? (checklist.filter(c => c.completed).length / checklist.length) * 100 : 0}%` }}
              />
            </div>
          )}
          {checklist
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((item) => (
              <div key={item.id} className="flex items-center gap-2 py-1 group">
                <TaskCheckbox
                  checked={!!item.completed}
                  onToggle={() => updateChecklist.mutate({ id: item.id, data: { completed: !item.completed } })}
                  size={16}
                  data-testid={`checkbox-checklist-${item.id}`}
                />
                <span className={`text-xs flex-1 ${isMobile ? "text-[14px]" : ""} ${item.completed ? `line-through ${isMobile ? "text-white/30" : "text-muted-foreground"}` : isMobile ? "text-white/80" : ""}`}>{item.title}</span>
                <button
                  onClick={() => deleteChecklistItem.mutate(item.id)}
                  className="invisible group-hover:visible p-0.5 rounded hover:bg-muted/50 text-muted-foreground"
                  data-testid={`button-delete-checklist-${item.id}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          <div className="flex items-center gap-2 mt-1">
            <Plus className={`h-3.5 w-3.5 shrink-0 ${isMobile ? "text-white/25" : "text-muted-foreground/40"}`} />
            <Input
              value={newChecklistTitle}
              onChange={(e) => setNewChecklistTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newChecklistTitle.trim()) {
                  createChecklistItem.mutate({ taskId: task.id, title: newChecklistTitle.trim(), sortOrder: checklist.length });
                  setNewChecklistTitle("");
                }
              }}
              placeholder={isMobile ? "Add item" : "Dodaj element..."}
              className={`border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-xs h-auto py-1 ${isMobile ? "text-[15px] text-white placeholder:text-white/25" : ""}`}
              data-testid="input-checklist-new"
            />
          </div>
        </div>

        <div className={`border-t mx-6 ${isMobile ? "border-white/[0.06]" : "border-border/30"}`} />

        <div className={`${isMobile ? "px-5" : "px-6"} py-4`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`text-[10px] uppercase tracking-wider font-semibold ${isMobile ? "text-white/30" : "text-muted-foreground/50"}`}>Podzadania</span>
            <span className={`text-[10px] tabular-nums ${isMobile ? "text-white/40" : "text-muted-foreground"}`}>
              {childTasks.filter((c) => c.completed).length}/{childTasks.length}
            </span>
          </div>
          {childTasks
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
            .map((child) => (
              <div key={child.id} className="flex items-center gap-2 py-1">
                <TaskCheckbox
                  checked={!!child.completed}
                  onToggle={() => {}}
                  size={16}
                />
                <span className={`text-xs flex-1 ${isMobile ? "text-[14px]" : ""} ${child.completed ? `line-through ${isMobile ? "text-white/30" : "text-muted-foreground"}` : isMobile ? "text-white/80" : ""}`}>{child.title}</span>
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
              className={`border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-xs h-auto py-1 ${isMobile ? "text-[16px]" : ""}`}
              data-testid="input-subtask-new"
            />
          </div>
        </div>

        <div className={`border-t mx-6 ${isMobile ? "border-white/[0.06]" : "border-border/30"}`} />

        <div className={`${isMobile ? "px-5" : "px-6"} py-4`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`text-[10px] uppercase tracking-wider font-semibold flex items-center gap-1 ${isMobile ? "text-white/30" : "text-muted-foreground/50"}`}>
              <Users className="h-3 w-3" />
              Udostępnij
            </span>
          </div>
          {(task.sharedWith || []).map((uid: string) => {
            const u = allUsers.find((au) => au.id === uid);
            return (
              <div key={uid} className="flex items-center gap-2 py-1 group">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium text-primary shrink-0">
                  {u ? (u.firstName?.[0] || u.email?.[0] || "?").toUpperCase() : "?"}
                </div>
                <span className="text-xs flex-1 truncate">{u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email || uid : uid}</span>
                <button
                  onClick={() => {
                    const newShared = (task.sharedWith || []).filter((id: string) => id !== uid);
                    onUpdate({ sharedWith: newShared });
                  }}
                  className="invisible group-hover:visible p-0.5 rounded hover:bg-muted/50 text-muted-foreground"
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

        {task.createdAt && (
          <div className={`${isMobile ? "px-5" : "px-6"} pb-4`}>
            <p className={`text-[10px] ${isMobile ? "text-white/20" : "text-muted-foreground/30"}`}>
              Utworzono: {format(new Date(task.createdAt), "d MMM yyyy, HH:mm", { locale: pl })}
            </p>
          </div>
        )}

        {isMobile && (
          <>
            <div className="border-t border-white/[0.06] mx-5" />
            <div className="px-5 py-6">
              <button
                onClick={() => setDeleteConfirm(true)}
                className="w-full text-center text-red-400 text-[15px] font-medium py-2"
                data-testid="button-delete-task-mobile"
              >
                Usuń zadanie
              </button>
            </div>
          </>
        )}
      </div>

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent className="z-[60]">
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
});

function EmployeeAssignChip({ task, onUpdate }: { task: Task; onUpdate: (data: Record<string, unknown>) => void }) {
  const { data: employeesList = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const activeEmployees = useMemo(() => employeesList.filter((e: Employee) => e.status === "AKTYWNY"), [employeesList]);

  const assignedEmployeeIds = useMemo(() => {
    return (task.sharedWith || [])
      .filter((s: string) => s.startsWith("employee-"))
      .map((s: string) => Number(s.replace("employee-", "")));
  }, [task.sharedWith]);

  const assignedEmployees = useMemo(() => {
    return activeEmployees.filter((e: Employee) => assignedEmployeeIds.includes(e.id));
  }, [activeEmployees, assignedEmployeeIds]);

  const toggleEmployee = (empId: number) => {
    const virtualId = `employee-${empId}`;
    const current = task.sharedWith || [];
    const newShared = current.includes(virtualId)
      ? current.filter((s: string) => s !== virtualId)
      : [...current, virtualId];
    onUpdate({ sharedWith: newShared });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            assignedEmployees.length > 0
              ? "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
              : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
          }`}
          data-testid="chip-assign-employee"
        >
          <UserPlus className="h-3 w-3" />
          {assignedEmployees.length > 0
            ? assignedEmployees.map((e: Employee) => `${e.firstName} ${e.lastName?.[0] || ""}.`).join(", ")
            : "+ Pracownik"}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
          Przypisz do pracownika
        </div>
        {activeEmployees.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">Brak pracowników</div>
        )}
        {activeEmployees.map((emp: Employee) => {
          const isAssigned = assignedEmployeeIds.includes(emp.id);
          return (
            <button
              key={emp.id}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm hover:bg-muted/50 transition-colors ${isAssigned ? "bg-teal-50 dark:bg-teal-900/20 font-medium" : ""}`}
              onClick={() => toggleEmployee(emp.id)}
              data-testid={`assign-employee-${emp.id}`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${isAssigned ? "bg-teal-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {emp.firstName?.[0]}{emp.lastName?.[0]}
              </div>
              <span className="flex-1 text-left truncate">{emp.firstName} {emp.lastName}</span>
              {isAssigned && <span className="text-teal-600 dark:text-teal-400 text-xs">✓</span>}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
