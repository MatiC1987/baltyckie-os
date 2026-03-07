import { memo, useMemo, useCallback, useState, useRef, useEffect } from "react";
import type { Task, TaskProject, TaskSection } from "@shared/schema";
import { Input } from "@/components/ui/input";
import {
  Plus, SlidersHorizontal, FolderPlus, ListPlus, Archive, Circle,
  MoreHorizontal, Trash2, ChevronDown, ChevronRight, Search,
  LogOut, Pencil, Link2, Download, X as XIcon,
} from "lucide-react";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

function SortableAreaItem({ area, isDraggingProject, isDraggingArea, children }: { area: string; isDraggingProject?: boolean; isDraggingArea?: boolean; children: (listeners: Record<string, unknown> | undefined) => React.ReactNode }) {
  const { setNodeRef: setDropRef, isOver: isDropOver } = useDroppable({ id: `droppable-area-${area}` });
  const {
    attributes, listeners, setNodeRef: setSortRef, transform, transition, isDragging,
  } = useSortable({ id: `sortable-area-${area}` });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const dropHighlight = isDraggingProject && isDropOver ? "ring-2 ring-emerald-400 bg-emerald-500/10 rounded-lg" : "";
  const sortHighlight = isDraggingArea && isDropOver && !isDragging ? "ring-2 ring-primary/40 bg-primary/5 rounded-lg" : "";
  return (
    <div
      ref={(node) => { setDropRef(node); setSortRef(node); }}
      style={style}
      className={`${dropHighlight} ${sortHighlight} transition-all duration-150`}
      data-testid={`droppable-area-${area}`}
      {...attributes}
    >
      {children(listeners)}
    </div>
  );
}

function UngroupedDropTarget({ isDraggingProject, children }: { isDraggingProject?: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "droppable-area-ungrouped" });
  const dropHighlight = isDraggingProject && isOver ? "ring-2 ring-blue-400 bg-blue-500/10 rounded-lg" : "";
  return (
    <div ref={setNodeRef} className={`${dropHighlight} transition-all duration-150`}>
      {children}
    </div>
  );
}

function SortableProjectItem({
  project,
  tasks,
  isActive,
  onClick,
  onArchive,
  onDelete,
  isDraggingTask,
  isRenaming,
  renamingName,
  onStartRename,
  onRenamingChange,
  onRenameSubmit,
  onRenameCancel,
  areas,
  onMoveToArea,
}: {
  project: TaskProject;
  tasks: Task[];
  isActive: boolean;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isDraggingTask?: boolean;
  isRenaming?: boolean;
  renamingName?: string;
  onStartRename?: () => void;
  onRenamingChange?: (v: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  areas?: string[];
  onMoveToArea?: (projectId: number, area: string | null) => void;
}) {
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `sidebar-project-${project.id}` });
  const {
    attributes, listeners, setNodeRef: setSortRef, transform, transition, isDragging,
  } = useSortable({ id: `sortable-project-${project.id}` });

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    fontSize: 'var(--tasks-font-size, 13px)',
  };

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
      ref={(node) => { setDropRef(node); setSortRef(node); }}
      style={style}
      className={`flex items-center gap-2 px-2.5 py-[3px] rounded-md w-full text-left transition-all duration-150 group ${
        isRenaming ? "cursor-text" : "cursor-grab active:cursor-grabbing touch-none"
      } ${
        isActive ? "bg-gradient-to-r from-primary/8 to-primary/3 text-foreground font-medium shadow-sm" : "hover:bg-muted/30 text-foreground/80"
      } ${dropHighlight}`}
      {...attributes}
      {...(isRenaming ? {} : listeners)}
      onClick={isRenaming ? undefined : onClick}
      data-testid={`sidebar-project-${project.id}`}
    >
      <Circle className="h-[13px] w-[13px] shrink-0" strokeWidth={2.5} style={{ color }} />
      {isRenaming ? (
        <Input
          ref={renameInputRef}
          value={renamingName || ""}
          onChange={(e) => onRenamingChange?.(e.target.value)}
          onBlur={() => onRenameSubmit?.()}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onRenameSubmit?.(); }
            if (e.key === "Escape") { onRenameCancel?.(); }
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-6 flex-1 text-[13px] font-medium border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 py-0"
          data-testid={`input-rename-project-${project.id}`}
        />
      ) : (
        <span className="flex-1 truncate">{project.name}</span>
      )}
      {!isRenaming && stats.total > 0 && (
        <ProgressRing completed={stats.completed} total={stats.total} color={color} />
      )}
      {!isRenaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 max-md:opacity-40 p-0.5 rounded hover:bg-muted/50 text-muted-foreground transition-opacity duration-150"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-project-menu-${project.id}`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem onClick={() => onStartRename?.()} data-testid={`menu-rename-project-${project.id}`}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Zmień nazwę
            </DropdownMenuItem>
            {areas && areas.length > 0 && onMoveToArea && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger data-testid={`menu-move-area-${project.id}`}>
                  <Link2 className="h-3.5 w-3.5 mr-2" />
                  Przestrzeń
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => onMoveToArea(project.id, null)} data-testid={`menu-area-none-${project.id}`}>
                    {!project.area ? "✓ " : ""}Bez przestrzeni
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {areas.map((a) => (
                    <DropdownMenuItem key={a} onClick={() => onMoveToArea(project.id, a)} data-testid={`menu-area-${a}-${project.id}`}>
                      {project.area === a ? "✓ " : ""}{a}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
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
      )}
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
  isDraggingProject?: boolean;
  isDraggingArea?: boolean;
  areaOrder: string[];
  isMobile?: boolean;
  onViewChange: (view: ViewType) => void;
  onToggleArea: (area: string) => void;
  onAddProject: () => void;
  onAddArea: () => void;
  onOpenSettings: () => void;
  onOpenQuickFind: () => void;
  onUpdateProject: (id: number, data: Record<string, unknown>) => void;
  onDeleteProject: (id: number) => void;
  onRenameArea: (oldName: string, newName: string) => void;
  onDeleteArea: (areaName: string) => void;
}

function StaticProjectItem({
  project,
  tasks,
  isActive,
  onClick,
  onArchive,
  onDelete,
  isDraggingTask,
  isRenaming,
  renamingName,
  onStartRename,
  onRenamingChange,
  onRenameSubmit,
  onRenameCancel,
}: {
  project: TaskProject;
  tasks: Task[];
  isActive: boolean;
  onClick: () => void;
  onArchive: () => void;
  onDelete: () => void;
  isDraggingTask?: boolean;
  isRenaming?: boolean;
  renamingName?: string;
  onStartRename?: () => void;
  onRenamingChange?: (v: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
}) {
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `sidebar-project-${project.id}` });

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

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
      className={`flex items-center gap-2 px-2.5 py-[7px] min-h-[44px] rounded-lg w-full text-left transition-all duration-150 group ${
        isRenaming ? "cursor-text" : "cursor-pointer"
      } ${
        isActive ? "bg-gradient-to-r from-primary/8 to-primary/3 text-foreground font-medium shadow-sm" : "hover:bg-muted/30 text-foreground/80"
      } ${dropHighlight}`}
      style={{ fontSize: 'var(--tasks-font-size, 13px)' }}
      onClick={isRenaming ? undefined : onClick}
      data-testid={`sidebar-project-${project.id}`}
    >
      <Circle className="h-[15px] w-[15px] shrink-0" strokeWidth={2.5} style={{ color }} />
      {isRenaming ? (
        <Input
          ref={renameInputRef}
          value={renamingName || ""}
          onChange={(e) => onRenamingChange?.(e.target.value)}
          onBlur={() => onRenameSubmit?.()}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); onRenameSubmit?.(); }
            if (e.key === "Escape") { onRenameCancel?.(); }
          }}
          onClick={(e) => e.stopPropagation()}
          className="h-6 flex-1 text-[13px] font-medium border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 py-0"
          data-testid={`input-rename-project-${project.id}`}
        />
      ) : (
        <span className="flex-1 truncate">{project.name}</span>
      )}
      {!isRenaming && stats.total > 0 && (
        <ProgressRing completed={stats.completed} total={stats.total} color={color} />
      )}
      {!isRenaming && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="opacity-0 group-hover:opacity-100 max-md:opacity-40 p-0.5 rounded hover:bg-muted/50 text-muted-foreground transition-opacity duration-150"
              onClick={(e) => e.stopPropagation()}
              data-testid={`button-project-menu-${project.id}`}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="right">
            <DropdownMenuItem onClick={() => onStartRename?.()} data-testid={`menu-rename-project-${project.id}`}>
              <Pencil className="h-3.5 w-3.5 mr-2" />
              Zmień nazwę
            </DropdownMenuItem>
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
      )}
    </div>
  );
}

function SortableProjectList({
  projectList,
  tasks,
  isActive,
  onViewChange,
  onUpdateProject,
  onDeleteProject,
  isDraggingTask,
  renamingProjectId,
  renamingProjectName,
  onStartRename,
  onRenamingChange,
  onRenameSubmit,
  onRenameCancel,
  allAreas,
}: {
  projectList: TaskProject[];
  tasks: Task[];
  isActive: (v: ViewType) => boolean;
  onViewChange: (v: ViewType) => void;
  onUpdateProject: (id: number, data: Record<string, unknown>) => void;
  onDeleteProject: (id: number) => void;
  isDraggingTask?: boolean;
  renamingProjectId: number | null;
  renamingProjectName: string;
  onStartRename: (id: number, name: string) => void;
  onRenamingChange: (v: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  allAreas?: string[];
}) {
  const sortableIds = useMemo(() => projectList.map(p => `sortable-project-${p.id}`), [projectList]);
  const handleMoveToArea = useCallback((projectId: number, area: string | null) => {
    onUpdateProject(projectId, { area });
  }, [onUpdateProject]);

  return (
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      {projectList.map((p) => (
        <SortableProjectItem
          key={p.id}
          project={p}
          tasks={tasks}
          isActive={isActive({ projectId: p.id })}
          onClick={() => onViewChange({ projectId: p.id })}
          onArchive={() => onUpdateProject(p.id, { archived: !p.archived })}
          onDelete={() => onDeleteProject(p.id)}
          isDraggingTask={isDraggingTask}
          isRenaming={renamingProjectId === p.id}
          renamingName={renamingProjectId === p.id ? renamingProjectName : undefined}
          onStartRename={() => onStartRename(p.id, p.name)}
          onRenamingChange={onRenamingChange}
          onRenameSubmit={onRenameSubmit}
          onRenameCancel={onRenameCancel}
          areas={allAreas}
          onMoveToArea={handleMoveToArea}
        />
      ))}
    </SortableContext>
  );
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
  isDraggingProject,
  isDraggingArea,
  areaOrder,
  isMobile = false,
  onViewChange,
  onToggleArea,
  onAddProject,
  onAddArea,
  onOpenSettings,
  onOpenQuickFind,
  onUpdateProject,
  onDeleteProject,
  onRenameArea,
  onDeleteArea,
}: TaskSidebarProps) {
  const [renamingProjectId, setRenamingProjectId] = useState<number | null>(null);
  const [renamingProjectName, setRenamingProjectName] = useState("");
  const [renamingAreaName, setRenamingAreaName] = useState<string | null>(null);
  const [renamingAreaValue, setRenamingAreaValue] = useState("");

  const activeProjects = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const archivedProjects = useMemo(() => projects.filter((p) => p.archived), [projects]);
  const areas = useMemo(() => {
    const uniqueAreas = Array.from(new Set(activeProjects.map((p) => p.area || "").filter(Boolean)));
    const ordered = areaOrder.filter(a => uniqueAreas.includes(a));
    const unordered = uniqueAreas.filter(a => !areaOrder.includes(a));
    return [...ordered, ...unordered];
  }, [activeProjects, areaOrder]);
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

  const handleStartRename = useCallback((id: number, name: string) => {
    setRenamingProjectId(id);
    setRenamingProjectName(name);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (renamingProjectId !== null && renamingProjectName.trim()) {
      onUpdateProject(renamingProjectId, { name: renamingProjectName.trim() });
    }
    setRenamingProjectId(null);
    setRenamingProjectName("");
  }, [renamingProjectId, renamingProjectName, onUpdateProject]);

  const handleRenameCancel = useCallback(() => {
    setRenamingProjectId(null);
    setRenamingProjectName("");
  }, []);

  const renameProps = {
    renamingProjectId,
    renamingProjectName,
    onStartRename: handleStartRename,
    onRenamingChange: setRenamingProjectName,
    onRenameSubmit: handleRenameSubmit,
    onRenameCancel: handleRenameCancel,
  };

  return (
    <div className={`flex-1 overflow-y-auto ${isMobile ? "px-5 pt-[max(env(safe-area-inset-top),16px)] pb-4" : "p-3"} space-y-0.5`} style={{ fontSize: 'var(--tasks-font-size, 14px)' }} data-testid="tasks-sidebar-content">
      <button
        onClick={onOpenQuickFind}
        className={`flex items-center justify-center gap-2 w-full mb-4 min-h-[40px] transition-colors ${
          isMobile
            ? "rounded-xl bg-white/[0.08] text-white/40 text-[15px] py-2"
            : "rounded-lg bg-muted/40 hover:bg-muted/60 text-muted-foreground/60 text-[13px] px-3 py-1.5"
        }`}
        data-testid="sidebar-quick-find"
      >
        <Search className={isMobile ? "h-4 w-4" : "h-3.5 w-3.5"} />
        <span>{isMobile ? "Quick Find" : "Szybkie wyszukiwanie"}</span>
      </button>

      {SMART_VIEWS.map((sv) => {
        const count = counts[sv.key] || 0;
        const active = isActive(sv.view);
        const isInbox = sv.key === "inbox";
        return (
          <SmartViewDroppable key={sv.key} id={isInbox ? "sidebar-inbox" : `sidebar-view-${sv.key}`} isInbox={isInbox} isDraggingTask={isDraggingTask}>
            <button
              onClick={() => onViewChange(sv.view)}
              className={`flex items-center w-full text-left transition-all duration-150 ${
                isMobile
                  ? `gap-3.5 px-1 py-[10px] min-h-[44px] rounded-lg ${active ? "text-white font-medium" : "text-white/80"}`
                  : `gap-2 px-2.5 py-[3px] rounded-md ${active ? "bg-gradient-to-r from-primary/8 to-primary/3 text-foreground font-medium shadow-sm" : "hover:bg-muted/30 text-foreground/80"}`
              }`}
              style={{ fontSize: isMobile ? '17px' : 'var(--tasks-font-size, 13px)' }}
              data-testid={`button-view-${sv.key}`}
            >
              {isMobile ? (
                <sv.icon className="h-[22px] w-[22px] shrink-0" style={{ color: sv.color, ...(sv.key === "today" || sv.key === "logbook" ? { fill: sv.color } : {}) }} />
              ) : (
                <div className={`h-5 w-5 rounded flex items-center justify-center shrink-0 ${active ? "" : "bg-muted/40"}`} style={active ? { backgroundColor: `${sv.color}20` } : undefined}>
                  <sv.icon className="h-3 w-3" style={{ color: sv.color }} />
                </div>
              )}
              <span className="flex-1">{sv.label}</span>
              {sv.showCount && count > 0 && (
                <span
                  className={`tabular-nums font-medium ${isMobile ? "text-[15px] text-white/35" : "text-[11px] min-w-[18px] text-center text-muted-foreground/70"}`}
                  data-testid={`badge-count-${sv.key}`}
                >
                  {count}
                </span>
              )}
            </button>
          </SmartViewDroppable>
        );
      })}

      {(areas.length > 0 || ungroupedProjects.length > 0) && (
        <div className={`mt-4 mb-1 mx-1 border-t ${isMobile ? "border-white/[0.06]" : "border-border/20"}`} />
      )}

      <SortableContext items={areas.map(a => `sortable-area-${a}`)} strategy={verticalListSortingStrategy}>
        {areas.map((area) => {
          const areaProjects = activeProjects
            .filter((p) => p.area === area)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
          const isCollapsed = collapsedAreas.has(area);
          const areaActive = isActive({ area });
          const isRenamingThisArea = renamingAreaName === area;
          return (
            <SortableAreaItem key={area} area={area} isDraggingProject={isDraggingProject} isDraggingArea={isDraggingArea}>
              {(dragListeners) => (
                <>
                  <div
                    role="button"
                    tabIndex={0}
                    className={`flex items-center w-full text-left mt-3 mb-0 rounded-md cursor-pointer group/area ${
                      isMobile
                        ? `gap-3 px-1 py-[10px] min-h-[36px] ${areaActive ? "text-white" : "text-white/70"}`
                        : `gap-2 px-2.5 py-[2px] ${areaActive ? "bg-gradient-to-r from-primary/8 to-primary/3" : "hover:bg-muted/30"}`
                    }`}
                    onClick={isRenamingThisArea ? undefined : () => onViewChange({ area })}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onViewChange({ area }); } }}
                    data-testid={`button-area-${area}`}
                  >
                    {!isMobile && (
                      <span {...(dragListeners || {})} className="cursor-grab active:cursor-grabbing touch-none shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                        <Link2 className="h-4 w-4 text-muted-foreground/50" />
                      </span>
                    )}
                    {isRenamingThisArea ? (
                      <Input
                        value={renamingAreaValue}
                        onChange={(e) => setRenamingAreaValue(e.target.value)}
                        onBlur={() => {
                          const trimmed = renamingAreaValue.trim();
                          if (trimmed && trimmed !== area && !areas.includes(trimmed)) {
                            onRenameArea(area, trimmed);
                          }
                          setRenamingAreaName(null);
                          setRenamingAreaValue("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const trimmed = renamingAreaValue.trim();
                            if (trimmed && trimmed !== area && !areas.includes(trimmed)) {
                              onRenameArea(area, trimmed);
                            }
                            setRenamingAreaName(null);
                            setRenamingAreaValue("");
                          }
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setRenamingAreaName(null);
                            setRenamingAreaValue("");
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-6 flex-1 text-[12px] font-bold uppercase tracking-wider border-0 bg-transparent shadow-none focus-visible:ring-1 px-1 py-0"
                        autoFocus
                        data-testid={`input-rename-area-${area}`}
                      />
                    ) : (
                      <span className={`flex-1 ${isMobile ? "text-[15px] font-semibold" : "text-[12px] font-bold uppercase tracking-wider"} ${isMobile ? "" : areaActive ? "text-foreground" : "text-foreground/70"}`}>{area}</span>
                    )}
                    {!isRenamingThisArea && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="opacity-0 group-hover/area:opacity-100 md:max-lg:opacity-0 p-0.5 rounded hover:bg-muted/50 text-muted-foreground transition-opacity duration-150 max-md:opacity-40"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`button-area-menu-${area}`}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="right">
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); setRenamingAreaName(area); setRenamingAreaValue(area); }}
                            data-testid={`menu-rename-area-${area}`}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2" />
                            Zmień nazwę
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onDeleteArea(area); }}
                            className="text-destructive"
                            data-testid={`menu-delete-area-${area}`}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" />
                            Usuń przestrzeń
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleArea(area); }}
                      className="shrink-0 p-0.5 rounded hover:bg-muted/40 transition-colors"
                      data-testid={`button-area-chevron-${area}`}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </button>
                  </div>
                  {!isCollapsed && (
                    <div className="pl-2">
                      <SortableProjectList
                        projectList={areaProjects}
                        tasks={tasks}
                        isActive={isActive}
                        onViewChange={onViewChange}
                        onUpdateProject={onUpdateProject}
                        onDeleteProject={onDeleteProject}
                        isDraggingTask={isDraggingTask}
                        allAreas={areas}
                        {...renameProps}
                      />
                    </div>
                  )}
                </>
              )}
            </SortableAreaItem>
          );
        })}
      </SortableContext>

      {ungroupedProjects.length > 0 && (
        <UngroupedDropTarget isDraggingProject={isDraggingProject}>
          {areas.length > 0 && (
            <div className="mt-3 mb-1 mx-1 border-t border-border/20" />
          )}
          <SortableProjectList
            projectList={ungroupedProjects}
            tasks={tasks}
            isActive={isActive}
            onViewChange={onViewChange}
            onUpdateProject={onUpdateProject}
            onDeleteProject={onDeleteProject}
            isDraggingTask={isDraggingTask}
            allAreas={areas}
            {...renameProps}
          />
        </UngroupedDropTarget>
      )}

      {ungroupedProjects.length === 0 && areas.length > 0 && isDraggingProject && (
        <UngroupedDropTarget isDraggingProject={isDraggingProject}>
          <div className="mt-3 px-2.5 py-2 text-[11px] text-muted-foreground/50 italic">
            Upuść tutaj aby usunąć z przestrzeni
          </div>
        </UngroupedDropTarget>
      )}

      {archivedProjects.length > 0 && (
        <>
          <div className="mt-3 mb-1 mx-1 border-t border-border/20" />
          <div className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mt-2 mb-1.5 px-2.5 flex items-center gap-1.5">
            <Archive className="h-3 w-3" />
            Archiwum
          </div>
          {archivedProjects.map((p) => (
            <StaticProjectItem
              key={p.id}
              project={p}
              tasks={tasks}
              isActive={isActive({ projectId: p.id })}
              onClick={() => onViewChange({ projectId: p.id })}
              onArchive={() => onUpdateProject(p.id, { archived: !p.archived })}
              onDelete={() => onDeleteProject(p.id)}
              isDraggingTask={isDraggingTask}
              isRenaming={renamingProjectId === p.id}
              renamingName={renamingProjectId === p.id ? renamingProjectName : undefined}
              onStartRename={() => handleStartRename(p.id, p.name)}
              onRenamingChange={setRenamingProjectName}
              onRenameSubmit={handleRenameSubmit}
              onRenameCancel={handleRenameCancel}
            />
          ))}
        </>
      )}
    </div>
  );
});

interface SidebarFooterProps {
  onAddProject: () => void;
  onAddArea: () => void;
  onOpenSettings: () => void;
  onLogout?: () => void;
}

function TasksInstallBanner() {
  const { showPrompt, isIos, canInstallNative, install, dismiss } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);

  if (!showPrompt) return null;

  return (
    <div className="border-t px-3 py-2">
      <div className="flex items-center justify-between gap-1.5">
        <button
          onClick={isIos ? () => setShowSteps(!showSteps) : install}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          data-testid="button-install-tasks"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium">Zainstaluj aplikację</span>
        </button>
        <button
          onClick={dismiss}
          className="p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
          data-testid="button-dismiss-install-tasks"
        >
          <XIcon className="h-3 w-3" />
        </button>
      </div>
      {isIos && showSteps && (
        <div className="mt-1.5 text-[11px] text-muted-foreground space-y-0.5">
          <p>1. Kliknij ikonę udostępniania</p>
          <p>2. Wybierz <b>Dodaj do ekranu głównego</b></p>
          <p>3. Potwierdź klikając <b>Dodaj</b></p>
        </div>
      )}
    </div>
  );
}

export const SidebarFooter = memo(function SidebarFooter({
  onAddProject,
  onAddArea,
  onOpenSettings,
  onLogout,
}: SidebarFooterProps) {
  return (
    <>
    <TasksInstallBanner />
    <div className="border-t px-3 py-2 flex items-center gap-1">
      <Popover>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5" data-testid="button-new-list">
            <Plus className="h-3.5 w-3.5" />
            <span>Nowa Lista</span>
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
              <div className="font-medium">Nowy Projekt</div>
              <div className="text-[10px] text-muted-foreground">Wyznacz cel i realizuj go krok po kroku.</div>
            </div>
          </button>
          <button
            className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm rounded-md hover:bg-muted/50 transition-colors"
            onClick={onAddArea}
            data-testid="button-new-area-popover"
          >
            <ListPlus className="h-4 w-4 text-emerald-500" />
            <div className="text-left">
              <div className="font-medium">Nowa Przestrzeń</div>
              <div className="text-[10px] text-muted-foreground">Grupuj projekty na sidebarze według obszarów odpowiedzialności.</div>
            </div>
          </button>
        </PopoverContent>
      </Popover>
      <div className="flex-1" />
      {onLogout && (
        <button
          className="p-1.5 flex items-center justify-center rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          onClick={onLogout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      )}
      <button
        className="p-1.5 flex items-center justify-center rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        onClick={onOpenSettings}
        data-testid="button-settings"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>
    </div>
    </>
  );
});
