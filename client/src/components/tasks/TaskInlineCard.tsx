import { useState, useRef, useEffect, useCallback } from "react";
import { format, parseISO, isToday } from "date-fns";
import type { Task, TaskProject, TaskSection } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Tag, ListChecks, Flag, Star, Moon, Package } from "lucide-react";
import { TaskCheckbox } from "./TaskCheckbox";
import { WhenPopover } from "./WhenPopover";
import { PRIORITY_BORDER_COLORS, PRIORITY_FLAG_COLORS, PRIORITY_LABELS, getTagColor } from "./taskUtils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

interface TaskInlineCardProps {
  task: Task;
  project?: TaskProject | null;
  onUpdate: (data: Record<string, unknown>) => void;
  onToggleComplete: () => void;
  onClose: () => void;
}

export function TaskInlineCard({
  task,
  project,
  onUpdate,
  onToggleComplete,
  onClose,
}: TaskInlineCardProps) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || "");
  const cardRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        handleSave();
        onClose();
      }
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSave();
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [title, notes]);

  const handleSave = useCallback(() => {
    const updates: Record<string, unknown> = {};
    if (title.trim() !== task.title) updates.title = title.trim();
    if (notes !== (task.notes || "")) updates.notes = notes;
    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
  }, [title, notes, task.title, task.notes, onUpdate]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const isTodayTask = task.dueDate === todayStr;
  const statusLabel = task.someday ? "Someday" : task.evening ? "This Evening" : isTodayTask ? "Today" : task.dueDate ? format(parseISO(task.dueDate), "d MMM") : null;
  const statusIcon = task.someday ? Package : task.evening ? Moon : isTodayTask ? Star : null;
  const StatusIcon = statusIcon;

  return (
    <div
      ref={cardRef}
      className="mx-3 my-1 border border-border/60 rounded-xl shadow-lg bg-card overflow-hidden animate-in slide-in-from-top-1 duration-200"
      data-testid={`inline-card-${task.id}`}
    >
      <div className="flex items-start gap-3 px-5 pt-4 pb-2">
        <div className="mt-1 shrink-0">
          <TaskCheckbox
            checked={!!task.completed}
            priority={task.priority || "BRAK"}
            onToggle={onToggleComplete}
          />
        </div>
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            if (title.trim() !== task.title) {
              onUpdate({ title: title.trim() });
            }
          }}
          className="flex-1 text-[15px] font-medium bg-transparent border-0 outline-none py-0"
          data-testid={`inline-card-title-${task.id}`}
        />
      </div>

      <div className="px-5 pl-[52px] pb-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => {
            if (notes !== (task.notes || "")) {
              onUpdate({ notes });
            }
          }}
          placeholder="Notes"
          className="border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 text-[13px] text-muted-foreground min-h-[24px] resize-none placeholder:text-muted-foreground/40"
          rows={1}
          data-testid={`inline-card-notes-${task.id}`}
        />
      </div>

      <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/30">
        <div>
          {statusLabel && (
            <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md ${
              task.someday ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
              task.evening ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" :
              isTodayTask ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
              "bg-muted text-muted-foreground"
            }`} data-testid={`inline-card-status-${task.id}`}>
              {StatusIcon && <StatusIcon className="h-3 w-3" />}
              {statusLabel}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
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
            <button className="p-1.5 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors" data-testid={`inline-card-when-${task.id}`}>
              <Calendar className="h-4 w-4" />
            </button>
          </WhenPopover>

          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1.5 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors" data-testid={`inline-card-tags-${task.id}`}>
                <Tag className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="end">
              {["praca", "dom", "pilne", "finanse", "osobiste", "zdrowie", "nauka", "zakupy"].map((tag) => {
                const isActive = (task.tags || []).includes(tag);
                return (
                  <button
                    key={tag}
                    className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted/50 ${isActive ? "bg-muted/30 font-medium" : ""}`}
                    onClick={() => {
                      const newTags = isActive ? (task.tags || []).filter(t => t !== tag) : [...(task.tags || []), tag];
                      onUpdate({ tags: newTags });
                    }}
                  >
                    <span className={`h-2 w-2 rounded-full ${getTagColor(tag).split(" ")[0]}`} />
                    {tag}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>

          <button className="p-1.5 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors" data-testid={`inline-card-checklist-${task.id}`}>
            <ListChecks className="h-4 w-4" />
          </button>

          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1.5 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors" data-testid={`inline-card-priority-${task.id}`}>
                <Flag className={`h-4 w-4 ${task.priority && task.priority !== "BRAK" ? PRIORITY_FLAG_COLORS[task.priority] : ""}`} />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-32 p-1" align="end">
              {Object.entries(PRIORITY_LABELS).map(([val, label]) => (
                <button
                  key={val}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-muted/50 ${task.priority === val ? "bg-muted/30 font-medium" : ""}`}
                  onClick={() => onUpdate({ priority: val })}
                >
                  <Flag className={`h-3 w-3 ${PRIORITY_FLAG_COLORS[val]}`} />
                  {label}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
