import { memo, useCallback } from "react";
import { parseISO, isToday } from "date-fns";
import type { Task, TaskProject } from "@shared/schema";
import { Moon, RefreshCw, Star, ChevronRight, ChevronDown } from "lucide-react";
import { TaskCheckbox } from "./TaskCheckbox";
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
  isMobile?: boolean;
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
  isMobile = false,
  dragListeners,
  onToggleComplete,
  onClick,
  onToggleExpand,
}: TaskRowProps) {
  const isLogbook = view === "logbook";
  const isTodayView = view === "today";
  const isTaggedForToday = !isTodayView && task.dueDate && !task.completed && isToday(parseISO(task.dueDate));
  const isEvening = task.evening;
  const isRecurring = !!task.recurring;

  const handleClick = useCallback(() => onClick(task), [onClick, task]);
  const handleToggle = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onToggleComplete(task);
  }, [onToggleComplete, task]);

  return (
    <div
      className={`task-row flex items-start gap-3 ${isMobile ? "px-4 py-3" : "px-6 py-2.5"} cursor-pointer transition-colors duration-100 ${
        isSelected ? "bg-muted/30" : "hover:bg-muted/20"
      }`}
      style={{ paddingLeft: `${(isMobile ? 16 : 24) + indent * 28}px` }}
      onClick={handleClick}
      data-testid={`task-row-${task.id}`}
      {...(dragListeners || {})}
    >
      {isTodayView && project && (
        <div
          className="w-[7px] h-[7px] rounded-full mt-[7px] shrink-0"
          style={{ backgroundColor: project.color || "#5ADBFA" }}
        />
      )}

      {isMobile ? (
        <div className="shrink-0 flex items-center justify-center w-[44px] h-[44px] -m-[10px]">
          <TaskCheckbox
            checked={!!task.completed}
            priority={task.priority || "BRAK"}
            onToggle={handleToggle}
            data-testid={`checkbox-task-${task.id}`}
          />
        </div>
      ) : (
        <div className="mt-[2px] shrink-0">
          <TaskCheckbox
            checked={!!task.completed}
            priority={task.priority || "BRAK"}
            onToggle={handleToggle}
            data-testid={`checkbox-task-${task.id}`}
          />
        </div>
      )}

      {hasChildren && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleExpand(task.id); }}
          className="mt-[3px] shrink-0 text-muted-foreground/50 hover:text-muted-foreground p-0.5 -ml-1"
          data-testid={`button-expand-${task.id}`}
        >
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
      )}

      <div className="flex-1 min-w-0">
        <div className={`text-[13.5px] leading-snug transition-all duration-300 flex items-center gap-1.5 ${task.completed || isLogbook ? "line-through text-muted-foreground/50" : "text-foreground"}`}>
          {isTaggedForToday && (
            <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
          )}
          <span className="truncate">{task.title}</span>
          {isRecurring && (
            <RefreshCw className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          )}
          {isEvening && (
            <Moon className="h-3 w-3 text-indigo-400/60 shrink-0" data-testid={`icon-evening-${task.id}`} />
          )}
        </div>
        {showProjectBar && project && (
          <div className={`${isMobile ? "text-[12px]" : "text-[11px]"} text-muted-foreground/50 mt-0.5 truncate`}>
            {project.name}
          </div>
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
    prev.task.recurring === next.task.recurring &&
    prev.task.projectId === next.task.projectId &&
    prev.isSelected === next.isSelected &&
    prev.isExpanded === next.isExpanded &&
    prev.hasChildren === next.hasChildren &&
    prev.childCompletedCount === next.childCompletedCount &&
    prev.childTotalCount === next.childTotalCount &&
    prev.indent === next.indent &&
    prev.showProjectBar === next.showProjectBar &&
    prev.isMobile === next.isMobile &&
    prev.view === next.view
  );
});
