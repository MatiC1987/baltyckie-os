import { memo, useState, useRef, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import type { TaskProject } from "@shared/schema";
import { Calendar, Tag, Flag, FolderOpen, Moon, AlertTriangle } from "lucide-react";
import { PRIORITY_FLAG_COLORS, PRIORITY_LABELS, PRIORITY_BORDER_COLORS, getTagColor, type ViewType } from "./taskUtils";

interface TaskInlineAddProps {
  view: ViewType;
  projects: TaskProject[];
  targetDate?: string;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export const TaskInlineAdd = memo(function TaskInlineAdd({
  view,
  projects,
  targetDate,
  onSubmit,
  onCancel,
}: TaskInlineAddProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState<string | null>(() => {
    if (targetDate) return targetDate;
    if (view === "today") return format(new Date(), "yyyy-MM-dd");
    if (view === "tomorrow") {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return format(d, "yyyy-MM-dd");
    }
    return null;
  });
  const [priority, setPriority] = useState("BRAK");
  const [evening, setEvening] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [projectId, setProjectId] = useState<number | null>(() => {
    if (typeof view === "object") return view.projectId;
    return null;
  });
  const [deadlineDate, setDeadlineDate] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    if (!title.trim()) return;
    const data: Record<string, unknown> = {
      title: title.trim(),
      priority,
      tags: selectedTags,
      dueDate,
      projectId,
      sectionId: null,
      evening,
      deadlineDate,
      someday: view === "someday",
    };
    onSubmit(data);
    setTitle("");
    setTimeout(() => inputRef.current?.focus(), 10);
  }, [title, priority, selectedTags, dueDate, projectId, evening, deadlineDate, view, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape") {
      onCancel();
    }
  }, [handleSubmit, onCancel]);

  const commonTags = ["praca", "dom", "pilne", "finanse", "osobiste", "zdrowie", "nauka", "zakupy"];
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");
  const nextWeek = format(new Date(Date.now() + 7 * 86400000), "yyyy-MM-dd");

  return (
    <div className="px-5 py-3 border-b border-border/30 bg-muted/5" data-testid="inline-add-task">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 rounded-full border-[1.5px] border-muted-foreground/20 shrink-0" />
        <Input
          ref={inputRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nowe zadanie..."
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm h-auto py-0"
          data-testid="input-inline-task-title"
        />
      </div>

      <div className="flex items-center gap-1 mt-2 ml-8 flex-wrap">
        <Popover>
          <PopoverTrigger asChild>
            <button className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
              dueDate ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300" : "text-muted-foreground hover:bg-muted/50"
            }`} data-testid="inline-btn-date">
              <Calendar className="h-3 w-3" />
              {dueDate === today ? "Dziś" : dueDate === tomorrow ? "Jutro" : dueDate || "Data"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-1" align="start">
            <button className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-muted/50" onClick={() => setDueDate(today)}>Dziś</button>
            <button className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-muted/50" onClick={() => setDueDate(tomorrow)}>Jutro</button>
            <button className="w-full text-left px-3 py-1.5 text-xs rounded hover:bg-muted/50" onClick={() => setDueDate(nextWeek)}>Za tydzień</button>
            <div className="border-t my-1" />
            <Input type="date" className="h-7 text-xs" value={dueDate || ""} onChange={(e) => setDueDate(e.target.value || null)} />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
              priority !== "BRAK" ? "" : "text-muted-foreground hover:bg-muted/50"
            }`} style={priority !== "BRAK" ? {
              backgroundColor: `${PRIORITY_BORDER_COLORS[priority]}15`,
              color: PRIORITY_BORDER_COLORS[priority],
            } : undefined} data-testid="inline-btn-priority">
              <Flag className="h-3 w-3" />
              {priority === "BRAK" ? "Priorytet" : PRIORITY_LABELS[priority]}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1" align="start">
            {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
              <button
                key={val}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted/50"
                onClick={() => setPriority(val)}
              >
                <Flag className={`h-3 w-3 ${PRIORITY_FLAG_COLORS[val]}`} />
                {label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <button className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
              selectedTags.length > 0 ? "bg-muted/50 text-foreground" : "text-muted-foreground hover:bg-muted/50"
            }`} data-testid="inline-btn-tags">
              <Tag className="h-3 w-3" />
              {selectedTags.length > 0 ? selectedTags.join(", ") : "Tagi"}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-36 p-1" align="start">
            {commonTags.map((tag) => (
              <button
                key={tag}
                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted/50 ${selectedTags.includes(tag) ? "bg-muted/30 font-medium" : ""}`}
                onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
              >
                <span className={`h-2 w-2 rounded-full ${getTagColor(tag).split(" ")[0]}`} />
                {tag}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {typeof view !== "object" && projects.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
                projectId ? "" : "text-muted-foreground hover:bg-muted/50"
              }`} style={projectId ? {
                backgroundColor: `${projects.find(p => p.id === projectId)?.color || "#5ADBFA"}15`,
                color: projects.find(p => p.id === projectId)?.color || "#5ADBFA",
              } : undefined} data-testid="inline-btn-project">
                <FolderOpen className="h-3 w-3" />
                {projectId ? projects.find(p => p.id === projectId)?.name : "Projekt"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="start">
              <button className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-muted/50 text-muted-foreground" onClick={() => setProjectId(null)}>Brak</button>
              {projects.filter(p => !p.archived).map(p => (
                <button
                  key={p.id}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted/50"
                  onClick={() => setProjectId(p.id)}
                >
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color || "#5ADBFA" }} />
                  {p.name}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        )}

        <button
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] transition-colors ${
            evening ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300" : "text-muted-foreground hover:bg-muted/50"
          }`}
          onClick={() => setEvening(!evening)}
          data-testid="inline-btn-evening"
        >
          <Moon className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
});
