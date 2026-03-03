import { memo, useMemo, useCallback } from "react";
import type { Task, TaskProject, TaskSection } from "@shared/schema";
import {
  Plus, SlidersHorizontal, FolderPlus, ListPlus, Archive, Circle,
  MoreHorizontal, Trash2, ChevronDown, ChevronRight, Search,
  LogOut,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useDroppable } from "@dnd-kit/core";
import { SMART_VIEWS, computeSidebarCounts, type ViewType } from "./taskUtils";


function ProgressRing({ completed, total, color, size = 16 }: { completed: number; total: number; color: string; size?: number }) {
  const r = (size - 3) / 2;
  const c = Math.PI * 2 * r;
  const progress = total > 0 ? completed / total : 0;
  const remaining = total - completed;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={`${completed}/${total} ukończonych (${Math.round(progress * 100)}%)`}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={2} className="text-muted/30" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={2} strokeDasharray={c} strokeDashoffset={c * (1 - progress)} strokeLinecap="round" className="transition-all duration-500" />
      </svg>
      {remaining > 0 && (
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-muted-foreground tabular-nums">
          {remaining}
        </span>
      )}
    </div>
  );
}

function SmartViewDroppable({ id, isInbox, isDraggingTask, children }: { id: string; isInbox: boolean; isDraggingTask?: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const dropHighlight = isInbox && isOver && isDraggingTask ? "ring-2 ring-blue-400 bg-blue-500/10 rounded-lg" : "";
  return (
    <div ref={setNodeRef} className={dropHighlight}>
      {children}
    </div>
  );
}

function ProjectSidebarItem({
  project,
  tasks,
  isActive,
  onClick,
  onArchive,
  onDelete,
  isDraggingTask,
}: {
  project: TaskProject;
  tasks: Task[];
  isActive: boolean;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isDraggingTask?: boolean;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `sidebar-project-${project.id}` });

  const stats = useMemo(() => {
    const projectTasks = tasks.filter((t) => t.projectId === project.id && t.parentTaskId === null);
    const completed = projectTasks.filter(t => t.completed).length;
    const total = projectTasks.length;
    return { completed, total, remaining: total - completed };
  }, [tasks, project.id]);

  const color = project.color || "#5ADBFA";
  const dropHighlight = isOver && isDraggingTask ? "ring-2 ring-blue-400 bg-blue-500/10" : "";

  return (
    <div
      ref={setDropRef}
      className={`flex items-center gap-2 px-2.5 py-[7px] min-h-[44px] rounded-lg w-full text-left transition-all duration-150 cursor-pointer group ${
        isActive ? "bg-gradient-to-r from-primary/8 to-primary/3 text-foreground font-medium shadow-sm" : "hover:bg-muted/30 text-foreground/80"
      } ${dropHighlight}`}
      style={{ fontSize: 'var(--tasks-font-size, 13px)' }}
      onClick={onClick}
      data-testid={`sidebar-project-${project.id}`}
    >
      <Circle className="h-4 w-4 shrink-0" style={{ color, fill: color }} />
      <span className="flex-1 truncate">{project.name}</span>
      {stats.total > 0 && (
        <ProgressRing completed={stats.completed} total={stats.total} color={color} />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted/50 text-muted-foreground transition-opacity duration-150"
            onClick={(e) => e.stopPropagation()}
            data-testid={`button-project-menu-${project.id}`}
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right">
          <DropdownMenuItem onClick={onArchive} data-testid={`menu-archive-project-${project.id}`}>
            <Archive className="h-3.5 w-3.5 mr-2" />
            {project.archived ? "Przywróć z archiwum" : "Archiwizuj"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive" data-testid={`menu-delete-project-${project.id}`}>
            <Trash2 className="h-3.5 w-3.5 mr-2" />
            Usuń
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface TaskSidebarProps {
  tasks: Task[];
  projects: TaskProject[];
  activeView: ViewType;
  showCounts: boolean;
  weekStart: 0 | 1;
  showOverdueInToday: boolean;
  currentUserId?: string;
  collapsedAreas: Set<string>;
  isDraggingTask?: boolean;
  onViewChange: (view: ViewType) => void;
  onToggleArea: (area: string) => void;
  onAddProject: () => void;
  onAddSection: () => void;
  onOpenSettings: () => void;
  onOpenQuickFind: () => void;
  onUpdateProject: (id: number, data: Record<string, unknown>) => void;
  onDeleteProject: (id: number) => void;
  onReorderProjects: (items: { id: number; sortOrder: number }[]) => void;
}

export const TaskSidebar = memo(function TaskSidebar({
  tasks,
  projects,
  activeView,
  showCounts,
  weekStart,
  showOverdueInToday,
  currentUserId,
  collapsedAreas,
  isDraggingTask,
  onViewChange,
  onToggleArea,
  onAddProject,
  onAddSection,
  onOpenSettings,
  onOpenQuickFind,
  onUpdateProject,
  onDeleteProject,
  onReorderProjects,
}: TaskSidebarProps) {
  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const archivedProjects = useMemo(() => projects.filter((p) => p.archived), [projects]);
  const areas = useMemo(
    () => Array.from(new Set(activeProjects.map((p) => p.area || "").filter(Boolean))),
    [activeProjects]
  );
  const ungroupedProjects = useMemo(
    () => activeProjects.filter((p) => !p.area).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [activeProjects]
  );

  const counts = useMemo(
    () => computeSidebarCounts(tasks, weekStart, showOverdueInToday, currentUserId),
    [tasks, weekStart, showOverdueInToday, currentUserId]
  );

  const isActive = useCallback(
    (v: ViewType) => {
      if (typeof activeView === "object" && typeof v === "object") {
        if ("area" in activeView && "area" in v) return activeView.area === v.area;
        if ("projectId" in activeView && "projectId" in v) return activeView.projectId === v.projectId;
        return false;
      }
      return activeView === v;
    },
    [activeView]
  );

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-0.5" style={{ fontSize: 'var(--tasks-font-size, 14px)' }} data-testid="tasks-sidebar-content">
      <button
        onClick={onOpenQuickFind}
        className="flex items-center gap-2 w-full px-3 py-1.5 mb-3 min-h-[44px] rounded-lg bg-muted/40 hover:bg-muted/60 text-muted-foreground/60 text-[13px] transition-colors"
        data-testid="sidebar-quick-find"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Quick Find</span>
      </button>

      {SMART_VIEWS.map((sv) => {
        const count = counts[sv.key] || 0;
        const active = isActive(sv.view);
        const isInbox = sv.key === "inbox";
        return (
          <SmartViewDroppable key={sv.key} id={isInbox ? "sidebar-inbox" : `sidebar-view-${sv.key}`} isInbox={isInbox} isDraggingTask={isDraggingTask}>
            <button
              onClick={() => onViewChange(sv.view)}
              className={`flex items-center gap-2.5 px-2.5 py-[7px] min-h-[44px] rounded-lg w-full text-left transition-all duration-150 ${
                active ? "bg-gradient-to-r from-primary/8 to-primary/3 text-foreground font-medium shadow-sm" : "hover:bg-muted/30 text-foreground/80"
              }`}
              style={{ fontSize: 'var(--tasks-font-size, 13px)' }}
              data-testid={`button-view-${sv.key}`}
            >
              <div className={`h-6 w-6 rounded-lg flex items-center justify-center shrink-0 ${active ? "" : "bg-muted/40"}`} style={active ? { backgroundColor: `${sv.color}20` } : undefined}>
                <sv.icon className="h-3.5 w-3.5" style={{ color: sv.color }} />
              </div>
              <span className="flex-1">{sv.label}</span>
              {sv.showCount && count > 0 && (
                <span
                  className="text-[11px] min-w-[18px] text-center tabular-nums text-muted-foreground/70 font-medium"
                  data-testid={`badge-count-${sv.key}`}
                >
                  {count}
                </span>
              )}
            </button>
          </SmartViewDroppable>
        );
      })}

      {areas.map((area) => {
        const areaProjects = activeProjects
          .filter((p) => p.area === area)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        const isCollapsed = collapsedAreas.has(area);
        const areaActive = isActive({ area });
        return (
          <div key={area}>
            <div
              className={`flex items-center gap-1.5 w-full text-left px-2.5 py-1.5 mt-4 mb-0.5 min-h-[44px] rounded-md ${
                areaActive ? "bg-gradient-to-r from-primary/8 to-primary/3" : "hover:bg-muted/30"
              }`}
              data-testid={`button-area-${area}`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onToggleArea(area); }}
                className="shrink-0 p-0.5 rounded hover:bg-muted/40 transition-colors"
                data-testid={`button-area-chevron-${area}`}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
                )}
              </button>
              <button
                onClick={() => onViewChange({ area })}
                className="flex-1 text-left min-w-0"
                data-testid={`button-area-name-${area}`}
              >
                <span className={`text-[11px] font-semibold uppercase tracking-widest ${areaActive ? "text-foreground" : "text-muted-foreground/60"}`}>{area}</span>
              </button>
            </div>
            {!isCollapsed &&
              areaProjects.map((p) => (
                <ProjectSidebarItem
                  key={p.id}
                  project={p}
                  tasks={tasks}
                  isActive={isActive({ projectId: p.id })}
                  onClick={() => onViewChange({ projectId: p.id })}
                  onArchive={() => onUpdateProject(p.id, { archived: !p.archived })}
                  onDelete={() => onDeleteProject(p.id)}
                  isDraggingTask={isDraggingTask}
                />
              ))}
          </div>
        );
      })}

      {ungroupedProjects.length > 0 && (
        <>
          {areas.length > 0 && (
            <div className="flex items-center gap-2 mt-4 mb-1.5 px-2.5">
              <div className="flex-1 border-t border-border/30" />
            </div>
          )}
          {ungroupedProjects.map((p) => (
            <ProjectSidebarItem
              key={p.id}
              project={p}
              tasks={tasks}
              isActive={isActive({ projectId: p.id })}
              onClick={() => onViewChange({ projectId: p.id })}
              onArchive={() => onUpdateProject(p.id, { archived: !p.archived })}
              onDelete={() => onDeleteProject(p.id)}
              isDraggingTask={isDraggingTask}
            />
          ))}
        </>
      )}

      {archivedProjects.length > 0 && (
        <>
          <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-5 mb-1.5 px-2.5 flex items-center gap-1.5">
            <Archive className="h-3 w-3" />
            Archiwum
          </div>
          {archivedProjects.map((p) => (
            <ProjectSidebarItem
              key={p.id}
              project={p}
              tasks={tasks}
              isActive={isActive({ projectId: p.id })}
              onClick={() => onViewChange({ projectId: p.id })}
              onArchive={() => onUpdateProject(p.id, { archived: !p.archived })}
              onDelete={() => onDeleteProject(p.id)}
              isDraggingTask={isDraggingTask}
            />
          ))}
        </>
      )}
    </div>
  );
});

interface SidebarFooterProps {
  onAddProject: () => void;
  onAddSection: () => void;
  onOpenSettings: () => void;
  onLogout?: () => void;
}

export const SidebarFooter = memo(function SidebarFooter({
  onAddProject,
  onAddSection,
  onOpenSettings,
  onLogout,
}: SidebarFooterProps) {
  return (
    <div className="border-t px-3 py-2 flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-1 min-h-[44px]" data-testid="button-new-list">
            <Plus className="h-3.5 w-3.5" />
            <span>New List</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start" side="top">
          <button
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted/50 transition-colors"
            onClick={onAddProject}
            data-testid="button-new-project-popover"
          >
            <FolderPlus className="h-4 w-4 text-primary" />
            <div className="text-left">
              <div className="font-medium">New Project</div>
              <div className="text-[10px] text-muted-foreground">Define a goal, then work towards it one to-do at a time.</div>
            </div>
          </button>
          <button
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted/50 transition-colors"
            onClick={onAddSection}
            data-testid="button-new-section-popover"
          >
            <ListPlus className="h-4 w-4 text-emerald-500" />
            <div className="text-left">
              <div className="font-medium">New Area</div>
              <div className="text-[10px] text-muted-foreground">Group projects and to-dos based on different responsibilities.</div>
            </div>
          </button>
        </PopoverContent>
      </Popover>
      <div className="flex-1" />
      {onLogout && (
        <button
          className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          onClick={onLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      )}
      <button
        className="p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        onClick={onOpenSettings}
        data-testid="button-settings"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
});
