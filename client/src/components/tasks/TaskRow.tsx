import { memo, useCallback } from "react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { pl } from "date-fns/locale";
import type { Task, TaskProject } from "@shared/schema";
import { Flag, ChevronDown, ChevronRight, GripVertical, Clock, Moon, AlertTriangle } from "lucide-react";
import { TaskCheckbox } from "./TaskCheckbox";
import { PRIORITY_FLAG_COLORS, isOverdue, isDeadlineNear, getTagColor } from "./taskUtils";
import type { ViewType } from "./taskUtils";

interface TaskRowProps {
  task: Task;
  isSelected: boolean;
  view: ViewType;
  hasChildren: boolean;
  isExpanded: boolean;
  childCompletedCount?: number;
  childTotalCount?: number;
  indent?: number;
  project?: TaskProject | null;
  showProjectBar?: boolean;
  dragListeners?: Record<string, any>;
  onToggleComplete: (task: Task) => void;
  onClick: (task: Task) => void;
  onToggleExpand: (taskId: number) => void;
}

export const TaskRow = memo(function TaskRow({
  task,
  isSelected,
  view,
  hasChildren,
  isExpanded,
  childCompletedCount = 0,
  childTotalCount = 0,
  indent = 0,
  project,
  showProjectBar = false,
  dragListeners,
  onToggleComplete,
  onClick,
  onToggleExpand,
}: TaskRowProps) {
  const overdue = isOverdue(task);
  const isLogbook = view === "logbook";
  const isDueToday = task.dueDate && !task.completed && isToday(parseISO(task.dueDate));
  const isDueTomorrow = task.dueDate && !task.completed && isTomorrow(parseISO(task.dueDate));
  const deadlineStatus = isDeadlineNear(task);
  const isEvening = task.evening;

  const handleClick = useCallback(() => onClick(task), [onClick, task]);
  const handleToggle = useCallback(() => onToggleComplete(task), [onToggleComplete, task]);
  const handleExpand = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(task.id);
  }, [onToggleExpand, task.id]);

  return (
    <div
      className={`task-row flex items-center gap-3 px-5 py-3.5 group cursor-pointer border-b border-border/40 relative ${
        isSelected ? "bg-primary/5 border-l-2 border-l-primary" :
        deadlineStatus === "passed" ? "bg-red-50/60 dark:bg-red-950/30" :
        deadlineStatus === "urgent" ? "bg-red-50/40 dark:bg-red-950/20" :
        deadlineStatus === "warning" ? "bg-amber-50/40 dark:bg-amber-950/10" :
        overdue ? "bg-red-50/50 dark:bg-red-950/20" :
        isDueToday ? "bg-orange-50/30 dark:bg-orange-950/10" :
        isDueTomorrow ? "bg-yellow-50/30 dark:bg-yellow-950/10" :
        "hover:bg-muted/30"
      }`}
      style={{ paddingLeft: `${20 + indent * 28}px` }}
      onClick={handleClick}
      data-testid={`task-row-${task.id}`}
    >
      {showProjectBar && project && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full"
          style={{ backgroundColor: project.color || "#5ADBFA" }}
        />
      )}

      <div
        className="opacity-0 group-hover:opacity-100 cursor-grab transition-opacity duration-150 -ml-1"
        data-testid={`drag-handle-${task.id}`}
        {...(dragListeners || {})}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>

      {hasChildren && (
        <button
          onClick={handleExpand}
          className="p-0.5 rounded-full hover:bg-muted/50"
          data-testid={`button-expand-${task.id}`}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      )}

      <TaskCheckbox
        checked={!!task.completed}
        priority={task.priority || "BRAK"}
        onToggle={handleToggle}
        data-testid={`checkbox-task-${task.id}`}
      />

      <div className="flex-1 min-w-0">
        <div className={`text-[13px] leading-snug truncate transition-all duration-300 ${task.completed || isLogbook ? "line-through text-muted-foreground/60" : "text-foreground"}`}>
          {task.title}
        </div>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {task.dueDate && !isLogbook && (
            <span className={`text-[11px] flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : isDueToday ? "text-orange-500 font-medium" : isDueTomorrow ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}>
              {isDueToday && <Clock className="h-3 w-3 text-orange-500" />}
              {isDueTomorrow && <Clock className="h-3 w-3 text-yellow-500" />}
              {format(parseISO(task.dueDate), "d MMM", { locale: pl })}
              {task.dueTime ? ` ${task.dueTime}` : ""}
            </span>
          )}
          {task.deadlineDate && !isLogbook && (
            <span className={`text-[10px] flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-medium ${
              deadlineStatus === "passed" ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400" :
              deadlineStatus === "urgent" ? "bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400" :
              deadlineStatus === "warning" ? "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400" :
              "bg-muted/50 text-muted-foreground"
            }`}>
              <AlertTriangle className="h-2.5 w-2.5" />
              {format(parseISO(task.deadlineDate), "d MMM", { locale: pl })}
            </span>
          )}
          {task.tags &&
            task.tags.map((tag) => (
              <span
                key={tag}
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${getTagColor(tag)}`}
                data-testid={`tag-badge-${tag}`}
              >
                {tag}
              </span>
            ))}
          {showProjectBar && project && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{
                backgroundColor: `${project.color || "#5ADBFA"}15`,
                color: project.color || "#5ADBFA",
              }}
            >
              {project.name}
            </span>
          )}
          {hasChildren && (
            <span className="text-[10px] text-muted-foreground">
              {childCompletedCount}/{childTotalCount}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isEvening && (
          <Moon className="h-3 w-3 text-indigo-400" data-testid={`icon-evening-${task.id}`} />
        )}
        {task.priority && task.priority !== "BRAK" && (
          <Flag className={`h-3.5 w-3.5 ${PRIORITY_FLAG_COLORS[task.priority]}`} data-testid={`flag-${task.id}`} />
        )}
      </div>
    </div>
  );
}, (prev, next) => {
  return (
    prev.task.id === next.task.id &&
    prev.task.title === next.task.title &&
    prev.task.completed === next.task.completed &&
    prev.task.priority === next.task.priority &&
    prev.task.dueDate === next.task.dueDate &&
    prev.task.deadlineDate === next.task.deadlineDate &&
    prev.task.evening === next.task.evening &&
    prev.task.someday === next.task.someday &&
    prev.task.projectId === next.task.projectId &&
    prev.isSelected === next.isSelected &&
    prev.isExpanded === next.isExpanded &&
    prev.hasChildren === next.hasChildren &&
    prev.childCompletedCount === next.childCompletedCount &&
    prev.childTotalCount === next.childTotalCount &&
    prev.indent === next.indent &&
    JSON.stringify(prev.task.tags) === JSON.stringify(next.task.tags)
  );
});
