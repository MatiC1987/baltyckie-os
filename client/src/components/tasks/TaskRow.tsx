import { memo, useCallback, useRef, useState } from "react";
import { parseISO, isToday } from "date-fns";
import type { Task, TaskProject } from "@shared/schema";
import { Moon, RefreshCw, Star, ChevronRight, ChevronDown, Bell, Check, CalendarDays } from "lucide-react";
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

  if (isMobile) {
    return (
      <div
        className={`task-row flex items-center gap-2.5 px-4 py-[10px] cursor-pointer transition-colors duration-100 border-b border-white/[0.06] ${
          isSelected ? "bg-amber-500/10" : ""
        }`}
        style={{ paddingLeft: `${16 + indent * 24}px` }}
        onClick={handleClick}
        data-testid={`task-row-${task.id}`}
        {...(dragListeners || {})}
      >
        {project && (
          <div
            className="w-[7px] h-[7px] rounded-full shrink-0"
            style={{ backgroundColor: project.color || "#5ADBFA" }}
          />
        )}

        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleExpand(task.id); }}
            className="shrink-0 text-white/30 p-0.5 -ml-0.5"
            data-testid={`button-expand-${task.id}`}
          >
            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className={`text-[15px] leading-tight flex items-center gap-1.5 ${task.completed || isLogbook ? "line-through text-white/30" : "text-white"}`}>
            {isTaggedForToday && (
              <Star className="h-3 w-3 text-amber-400 fill-amber-400 shrink-0" />
            )}
            <span className="truncate">{task.title}</span>
            {isRecurring && (
              <RefreshCw className="h-3 w-3 text-white/25 shrink-0" />
            )}
            {isEvening && (
              <Moon className="h-3 w-3 text-indigo-400/50 shrink-0" data-testid={`icon-evening-${task.id}`} />
            )}
            {task.reminderDate && (
              <Bell className="h-3 w-3 text-amber-400/50 shrink-0" data-testid={`icon-reminder-${task.id}`} />
            )}
          </div>
          {task.notes && (
            <div className="text-[11px] text-white/25 mt-0.5 truncate leading-tight" data-testid={`text-task-notes-${task.id}`}>
              {task.notes}
            </div>
          )}
          {showProjectBar && project && (
            <div className="text-[12px] text-white/35 mt-0.5 truncate">
              {project.name}
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-center w-[40px] h-[40px] -mr-1.5">
          <TaskCheckbox
            checked={!!task.completed}
            priority={task.priority || "BRAK"}
            onToggle={handleToggle}
            size={22}
            data-testid={`checkbox-task-${task.id}`}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`task-row flex items-start gap-2 px-5 py-[5px] cursor-pointer transition-colors duration-100 ${
        isSelected ? "bg-muted/30" : "hover:bg-muted/20"
      }`}
      style={{ paddingLeft: `${20 + indent * 24}px` }}
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

      <div className="mt-[1px] shrink-0">
        <TaskCheckbox
          checked={!!task.completed}
          priority={task.priority || "BRAK"}
          onToggle={handleToggle}
          data-testid={`checkbox-task-${task.id}`}
        />
      </div>

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
          {task.reminderDate && (
            <Bell className="h-3 w-3 text-amber-400/60 shrink-0" data-testid={`icon-reminder-${task.id}`} />
          )}
        </div>
        {task.notes && (
          <div className="text-[10.5px] text-muted-foreground/40 mt-0.5 truncate leading-snug" data-testid={`text-task-notes-${task.id}`}>
            {task.notes}
          </div>
        )}
        {showProjectBar && project && (
          <div className="text-[11px] text-muted-foreground/50 mt-0.5 truncate">
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
    prev.task.notes === next.task.notes &&
    prev.task.completed === next.task.completed &&
    prev.task.priority === next.task.priority &&
    prev.task.dueDate === next.task.dueDate &&
    prev.task.deadlineDate === next.task.deadlineDate &&
    prev.task.evening === next.task.evening &&
    prev.task.someday === next.task.someday &&
    prev.task.recurring === next.task.recurring &&
    prev.task.reminderDate === next.task.reminderDate &&
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

interface SwipeableTaskRowProps {
  taskId: number;
  children: React.ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export function SwipeableTaskRow({ taskId, children, onSwipeLeft, onSwipeRight }: SwipeableTaskRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const startRef = useRef({ x: 0, y: 0, time: 0 });
  const directionRef = useRef<"horizontal" | "vertical" | null>(null);
  const THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    startRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    directionRef.current = null;
    setSwiping(false);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;

    if (!directionRef.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      directionRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }

    if (directionRef.current === "horizontal") {
      setSwiping(true);
      const clamped = Math.max(-160, Math.min(160, dx));
      setTranslateX(clamped);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!swiping) return;
    const elapsed = Date.now() - startRef.current.time;
    const velocity = Math.abs(translateX) / Math.max(elapsed, 1) * 1000;

    if (translateX < -THRESHOLD || (translateX < -40 && velocity > 800)) {
      if ('vibrate' in navigator) try { navigator.vibrate(5); } catch {}
      onSwipeLeft?.();
    } else if (translateX > THRESHOLD || (translateX > 40 && velocity > 800)) {
      if ('vibrate' in navigator) try { navigator.vibrate(5); } catch {}
      onSwipeRight?.();
    }

    setTranslateX(0);
    setSwiping(false);
    directionRef.current = null;
  }, [swiping, translateX, onSwipeLeft, onSwipeRight]);

  return (
    <div className="task-swipe-container" data-testid={`swipeable-task-${taskId}`}>
      {translateX < 0 && (
        <div className="task-swipe-bg task-swipe-bg-left">
          <Check className="h-5 w-5" />
          <span>Zaznacz</span>
        </div>
      )}
      {translateX > 0 && (
        <div className="task-swipe-bg task-swipe-bg-right" style={{ color: "#000" }}>
          <CalendarDays className="h-5 w-5" />
          <span>Kiedy</span>
        </div>
      )}
      <div
        className="task-swipe-content"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: swiping ? 'none' : 'transform 0.3s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
