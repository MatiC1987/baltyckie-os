import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  TrendingUp,
  CalendarDays, 
  ClipboardList,
  Plane,
  Wallet,
  Receipt,
  HandCoins,
  BarChart3,
  Building,
  Building2,
  Coins,
  Scale,
  FileText,
  FileSignature,
  Briefcase,
  Files,
  Upload,
  GitCompareArrows, 
  Download,
  Users,
  Settings,
  MapPin,
  LogOut,
  Menu,
  X,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
  CalendarRange,
  CalendarCheck,
  Landmark,
  Moon,
  Sun,
  FileSpreadsheet,
  FileDown,
  DatabaseBackup,
  History,
  UserCog,
  PieChart,
  ArrowUpDown,
  Thermometer,
  LineChart,
  BadgeDollarSign,
  Home,
  Gauge,
  Calculator,
  ScrollText,
  Plus
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/ThemeProvider";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import logoSrc from "@assets/logobaltyckie_1770719337266.png";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface NavItem {
  id: string;
  href: string;
  label: string;
  iconName: string;
}

interface NavSection {
  id: string;
  title?: string;
  itemIds: string[];
}

interface SidebarLayout {
  sections: NavSection[];
  items: Record<string, NavItem>;
}

const ICON_MAP: Record<string, any> = {
  LayoutDashboard,
  TrendingUp,
  CalendarDays,
  ClipboardList,
  Plane,
  Wallet,
  Receipt,
  HandCoins,
  BarChart3,
  Building,
  Building2,
  Coins,
  Scale,
  FileText,
  FileSignature,
  Briefcase,
  Files,
  Upload,
  Download,
  Users,
  Settings,
  MapPin,
  CalendarRange,
  CalendarCheck,
  Landmark,
  GitCompareArrows,
  FileSpreadsheet,
  FileDown,
  DatabaseBackup,
  History,
  UserCog,
  PieChart,
  ArrowUpDown,
  Thermometer,
  LineChart,
  BadgeDollarSign,
  Home,
  Gauge,
  Calculator,
  ScrollText,
};

const DEFAULT_ITEMS: Record<string, NavItem> = {
  kokpit: { id: "kokpit", href: "/", label: "Pulpit", iconName: "LayoutDashboard" },
  calendar: { id: "calendar", href: "/calendar", label: "Terminarz", iconName: "CalendarDays" },
  reservations: { id: "reservations", href: "/reservations", label: "Rezerwacje", iconName: "ClipboardList" },
  podnajem: { id: "podnajem", href: "/podnajem", label: "Podnajem", iconName: "FileSignature" },
  analizy: { id: "analizy", href: "/analizy", label: "Analizy", iconName: "BarChart3" },
  "finance-forecast": { id: "finance-forecast", href: "/finance-forecast", label: "Prognoza finansowa", iconName: "TrendingUp" },
  "revenue": { id: "revenue", href: "/revenue", label: "Przychody", iconName: "Wallet" },
  "koszty": { id: "koszty", href: "/koszty", label: "Koszty", iconName: "Calculator" },
  "apartment-schedule": { id: "apartment-schedule", href: "/apartment-schedule", label: "Harmonogram", iconName: "CalendarCheck" },
  salda: { id: "salda", href: "/salda", label: "Salda", iconName: "Scale" },
  invoices: { id: "invoices", href: "/invoices", label: "Faktury", iconName: "FileSpreadsheet" },
  "dokumenty-ksiegowe": { id: "dokumenty-ksiegowe", href: "/dokumenty-ksiegowe", label: "Dokumenty księgowe", iconName: "FileText" },
  "contracts-services": { id: "contracts-services", href: "/contracts-services", label: "Usługi", iconName: "Briefcase" },
};

const DEFAULT_SECTIONS: NavSection[] = [
  { id: "main", itemIds: ["kokpit"] },
  { id: "rezerwacje", title: "REZERWACJE", itemIds: ["calendar", "podnajem", "reservations"] },
  { id: "finanse", title: "FINANSE", itemIds: ["analizy", "finance-forecast", "revenue", "koszty", "apartment-schedule", "salda", "invoices", "dokumenty-ksiegowe", "contracts-services"] },
];

const STORAGE_KEY = "sidebar-layout-v5";
const COLLAPSED_KEY = "sidebar-collapsed-v2";
const LABELS_KEY = "sidebar-custom-labels-v1";

function loadCustomLabels(): Record<string, string> {
  try {
    const stored = localStorage.getItem(LABELS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function saveCustomLabels(labels: Record<string, string>) {
  try { localStorage.setItem(LABELS_KEY, JSON.stringify(labels)); } catch {}
}

function loadCollapsed(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

function saveCollapsed(collapsed: Set<string>) {
  try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed])); } catch {}
}

function reconcileLayout(stored: { sections: NavSection[] }): SidebarLayout {
  const allDefaultIds = new Set(Object.keys(DEFAULT_ITEMS));
  const validSectionIds = new Set(DEFAULT_SECTIONS.map(s => s.id));

  const validStoredSections = stored.sections.filter(s => validSectionIds.has(s.id));

  const seen = new Set<string>();
  let sections: NavSection[] = DEFAULT_SECTIONS.map(ds => {
    const match = validStoredSections.find(s => s.id === ds.id);
    const itemIds = (match ? match.itemIds : ds.itemIds).filter(id => {
      if (!allDefaultIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return { id: ds.id, title: ds.title, itemIds };
  });

  const orphaned = [...allDefaultIds].filter(id => !seen.has(id));
  if (orphaned.length > 0 && sections.length > 0) {
    sections[sections.length - 1].itemIds.push(...orphaned);
  }

  sections = sections.filter(s => s.itemIds.length > 0);
  return { sections, items: { ...DEFAULT_ITEMS } };
}

function loadLayout(): SidebarLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as { sections: NavSection[] };
      return reconcileLayout(parsed);
    }
  } catch {}
  return { sections: DEFAULT_SECTIONS, items: DEFAULT_ITEMS };
}

function saveLayout(sections: NavSection[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sections, items: {} }));
  } catch {}
}

let syncTimer: ReturnType<typeof setTimeout> | null = null;
function syncToServer(layout: NavSection[], collapsed: Set<string>, labels: Record<string, string>) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      await apiRequest("PUT", "/api/user-preferences", {
        sidebarLayout: JSON.stringify({ sections: layout }),
        sidebarCollapsed: JSON.stringify([...collapsed]),
        sidebarLabels: JSON.stringify(labels),
      });
    } catch {}
  }, 1000);
}

function findSectionOfItem(sections: NavSection[], itemId: string): string | null {
  for (const section of sections) {
    if (section.itemIds.includes(itemId)) return section.id;
  }
  return null;
}

function SortableNavItem({ item, isActive, onClick, onRename, badgeCount }: { item: NavItem; isActive: boolean; onClick: () => void; onRename: (id: string, newLabel: string) => void; badgeCount?: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = ICON_MAP[item.iconName] || LayoutDashboard;
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const confirmRename = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== item.label) {
      onRename(item.id, trimmed);
    } else {
      setEditValue(item.label);
    }
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 rounded-lg transition-all duration-200 group/navitem",
        isDragging ? "opacity-50 z-50" : "",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="flex items-center justify-center w-5 h-8 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 shrink-0"
        data-testid={`drag-handle-${item.id}`}
      >
        <GripVertical className="h-3 w-3" />
      </div>
      {isEditing ? (
        <div className="flex-1 min-w-0 flex items-center gap-1 px-1">
          <Icon className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmRename();
              if (e.key === "Escape") { setEditValue(item.label); setIsEditing(false); }
            }}
            onBlur={confirmRename}
            className="flex-1 min-w-0 bg-white/10 text-white text-xs font-medium rounded px-2 py-1.5 outline-none border border-white/20 focus:border-[#5ADBFA]"
            data-testid={`input-rename-${item.id}`}
          />
        </div>
      ) : (
        <>
          <Link href={item.href} data-testid={`link-nav-${item.href === "/" ? "home" : item.href.slice(1)}`} className={cn("flex-1 min-w-0 no-underline", isActive ? "!text-[#5ADBFA]" : "")}>
            <div
              onClick={onClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer",
                isActive
                  ? "!text-[#5ADBFA]"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "!text-[#5ADBFA]" : "text-slate-400 group-hover/navitem:text-white")} />
              <span className="font-medium text-xs leading-tight">{item.label}</span>
              {badgeCount && badgeCount > 0 ? (
                <span className="ml-auto shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1" data-testid={`badge-overdue-${item.id}`}>
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              ) : null}
            </div>
          </Link>
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setEditValue(item.label);
              setIsEditing(true);
            }}
            className="invisible group-hover/navitem:visible flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            data-testid={`button-rename-${item.id}`}
            title="Zmień nazwę"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </>
      )}
    </div>
  );
}

function DragOverlayItem({ item }: { item: NavItem }) {
  const Icon = ICON_MAP[item.iconName] || LayoutDashboard;
  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-800 border border-white/20 shadow-2xl">
      <div className="flex items-center justify-center w-5 h-8 text-slate-400 shrink-0">
        <GripVertical className="h-3 w-3" />
      </div>
      <div className="flex items-center gap-3 px-3 py-2">
        <Icon className="h-4 w-4 shrink-0 text-slate-300" />
        <span className="font-medium text-xs text-white">{item.label}</span>
      </div>
    </div>
  );
}

function DroppableEmptySection({ sectionId }: { sectionId: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: sectionId });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-2 py-3 border border-dashed rounded-lg flex items-center justify-center transition-colors",
        isOver ? "border-[#5ADBFA]/50 bg-[#5ADBFA]/10" : "border-white/10"
      )}
      data-testid={`empty-section-${sectionId}`}
    >
      <span className="text-[10px] text-slate-600">Przeciągnij tutaj</span>
    </div>
  );
}

export function Sidebar() {
  const [location, navigate] = useLocation();
  const { logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [layout, setLayout] = useState<SidebarLayout>(loadLayout);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(loadCollapsed);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(loadCustomLabels);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const lastAppliedTimestamp = useRef<string | null>(null);

  const { data: serverPrefs } = useQuery<any>({
    queryKey: ["/api/user-preferences"],
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: overdueCounts } = useQuery<{ costs: number; subleases: number }>({
    queryKey: ["/api/overdue-counts"],
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (!serverPrefs) return;
    const serverTimestamp = serverPrefs.updatedAt || "";
    if (lastAppliedTimestamp.current === serverTimestamp) return;
    lastAppliedTimestamp.current = serverTimestamp;
    try {
      if (serverPrefs.sidebarLayout) {
        const parsed = JSON.parse(serverPrefs.sidebarLayout);
        if (parsed?.sections) {
          const reconciled = reconcileLayout(parsed);
          setLayout(reconciled);
          saveLayout(reconciled.sections);
        }
      }
      if (serverPrefs.sidebarCollapsed) {
        const parsed = JSON.parse(serverPrefs.sidebarCollapsed);
        if (Array.isArray(parsed)) {
          const set = new Set<string>(parsed);
          setCollapsedSections(set);
          saveCollapsed(set);
        }
      }
      if (serverPrefs.sidebarLabels) {
        const parsed = JSON.parse(serverPrefs.sidebarLabels);
        if (parsed && typeof parsed === "object") {
          setCustomLabels(parsed);
          saveCustomLabels(parsed);
        }
      }
    } catch {}
  }, [serverPrefs]);

  const layoutRef = useRef(layout.sections);
  const collapsedRef = useRef(collapsedSections);
  const labelsRef = useRef(customLabels);
  useEffect(() => { layoutRef.current = layout.sections; }, [layout.sections]);
  useEffect(() => { collapsedRef.current = collapsedSections; }, [collapsedSections]);
  useEffect(() => { labelsRef.current = customLabels; }, [customLabels]);

  const syncAllToServer = useCallback(() => {
    syncToServer(layoutRef.current, collapsedRef.current, labelsRef.current);
  }, []);

  const itemsWithLabels = useMemo(() => {
    const merged: Record<string, NavItem> = {};
    for (const [key, item] of Object.entries(layout.items)) {
      merged[key] = customLabels[key] ? { ...item, label: customLabels[key] } : item;
    }
    return merged;
  }, [layout.items, customLabels]);

  const badgeMap = useMemo<Record<string, number>>(() => {
    if (!overdueCounts) return {};
    const map: Record<string, number> = {};
    if (overdueCounts.costs > 0) {
      map["koszty"] = overdueCounts.costs;
      map["apartment-schedule"] = overdueCounts.costs;
    }
    if (overdueCounts.subleases > 0) {
      map["podnajem"] = overdueCounts.subleases;
    }
    return map;
  }, [overdueCounts]);

  const handleRenameItem = useCallback((id: string, newLabel: string) => {
    setCustomLabels(prev => {
      const next = { ...prev, [id]: newLabel };
      saveCustomLabels(next);
      syncAllToServer();
      return next;
    });
  }, [syncAllToServer]);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      saveCollapsed(next);
      syncAllToServer();
      return next;
    });
  }, [syncAllToServer]);

  const titledSectionIds = useMemo(() => {
    return layout.sections.filter(s => !!s.title).map(s => s.id);
  }, [layout.sections]);

  const moveSection = useCallback((sectionId: string, direction: "up" | "down") => {
    setLayout(prev => {
      const titled = prev.sections.filter(s => !!s.title);
      const untitled = prev.sections.filter(s => !s.title);
      const idx = titled.findIndex(s => s.id === sectionId);
      if (idx < 0) return prev;
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= titled.length) return prev;
      const newTitled = [...titled];
      [newTitled[idx], newTitled[targetIdx]] = [newTitled[targetIdx], newTitled[idx]];
      const newSections = [...untitled, ...newTitled];
      saveLayout(newSections);
      syncAllToServer();
      return { ...prev, sections: newSections };
    });
  }, [syncAllToServer]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    return itemsWithLabels[activeId as string] || null;
  }, [activeId, itemsWithLabels]);

  const allItemIds = useMemo(() => {
    return layout.sections.flatMap(s => s.itemIds);
  }, [layout.sections]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    const activeSection = findSectionOfItem(layout.sections, activeItemId);
    let overSection = findSectionOfItem(layout.sections, overId);

    if (!overSection) {
      overSection = layout.sections.find(s => s.id === overId)?.id || null;
    }

    if (!activeSection || !overSection || activeSection === overSection) return;

    setLayout(prev => {
      const newSections = prev.sections.map(s => ({ ...s, itemIds: [...s.itemIds] }));
      const fromSection = newSections.find(s => s.id === activeSection)!;
      const toSection = newSections.find(s => s.id === overSection)!;

      fromSection.itemIds = fromSection.itemIds.filter(id => id !== activeItemId);

      const overIndex = toSection.itemIds.indexOf(overId);
      if (overIndex >= 0) {
        toSection.itemIds.splice(overIndex, 0, activeItemId);
      } else {
        toSection.itemIds.push(activeItemId);
      }

      return { ...prev, sections: newSections };
    });
  }, [layout.sections]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeItemId = active.id as string;
    const overId = over.id as string;

    const activeSection = findSectionOfItem(layout.sections, activeItemId);
    const overSection = findSectionOfItem(layout.sections, overId);

    if (activeSection && overSection && activeSection === overSection) {
      const section = layout.sections.find(s => s.id === activeSection)!;
      const oldIndex = section.itemIds.indexOf(activeItemId);
      const newIndex = section.itemIds.indexOf(overId);

      if (oldIndex !== newIndex) {
        setLayout(prev => {
          const newSections = prev.sections.map(s => {
            if (s.id === activeSection) {
              return { ...s, itemIds: arrayMove(s.itemIds, oldIndex, newIndex) };
            }
            return s;
          });
          saveLayout(newSections);
          syncAllToServer();
          return { ...prev, sections: newSections };
        });
        return;
      }
    }

    setLayout(prev => {
      saveLayout(prev.sections);
      syncAllToServer();
      return prev;
    });
  }, [layout.sections, syncAllToServer]);

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-white/10 z-50 flex items-center px-4 justify-between">
        <img src={logoSrc} alt="Bałtyckie Finanse" className="h-6" />
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)} className="text-white">
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-screen shadow-xl",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          <div className="px-5 pt-5 pb-5 flex items-center justify-center">
            <img src={logoSrc} alt="Bałtyckie Finanse" className="h-7 object-contain" data-testid="img-logo" />
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-1" data-testid="nav-sidebar">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              {layout.sections.map((section, sIdx) => {
                const isCollapsed = section.title ? collapsedSections.has(section.id) : false;
                return (
                  <div key={section.id} data-testid={`nav-section-${section.id}`}>
                    {sIdx > 0 && (
                      <div className="my-3 border-t border-white/10" />
                    )}
                    {section.title && (
                      <div
                        className="px-3 pt-1 pb-2 flex items-center justify-between select-none group/section"
                        data-testid={`section-header-${section.id}`}
                      >
                        <div
                          className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer"
                          onClick={() => toggleSection(section.id)}
                          data-testid={`toggle-section-${section.id}`}
                        >
                          <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">{section.title}</span>
                          <ChevronDown className={cn(
                            "h-3 w-3 text-slate-500 transition-transform duration-200 group-hover/section:text-slate-300",
                            isCollapsed ? "-rotate-90" : ""
                          )} />
                        </div>
                        <div className="invisible group-hover/section:visible flex items-center gap-0.5 shrink-0">
                          {titledSectionIds.indexOf(section.id) > 0 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); moveSection(section.id, "up"); }}
                              className="flex items-center justify-center w-5 h-5 rounded text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                              data-testid={`button-section-up-${section.id}`}
                              title="Przesuń w górę"
                            >
                              <ChevronUp className="h-3 w-3" />
                            </button>
                          )}
                          {titledSectionIds.indexOf(section.id) < titledSectionIds.length - 1 && (
                            <button
                              onClick={(e) => { e.stopPropagation(); moveSection(section.id, "down"); }}
                              className="flex items-center justify-center w-5 h-5 rounded text-slate-500 hover:text-white hover:bg-white/10 transition-colors"
                              data-testid={`button-section-down-${section.id}`}
                              title="Przesuń w dół"
                            >
                              <ChevronDown className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    <div className={cn(
                      "transition-all duration-200 overflow-hidden",
                      isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
                    )}>
                      <SortableContext items={section.itemIds} strategy={verticalListSortingStrategy} id={section.id}>
                        {section.itemIds.map((itemId) => {
                          const item = itemsWithLabels[itemId];
                          if (!item) return null;
                          return (
                            <SortableNavItem
                              key={item.id}
                              item={item}
                              isActive={location === item.href}
                              onClick={() => setIsOpen(false)}
                              onRename={handleRenameItem}
                              badgeCount={badgeMap[item.id]}
                            />
                          );
                        })}
                      </SortableContext>
                      {section.id === "main" && (
                        <button
                          onClick={() => setShowQuickActions(true)}
                          className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors bg-[#5ADBFA]/15 text-[#5ADBFA] hover:bg-[#5ADBFA]/25 border border-[#5ADBFA]/20"
                          data-testid="button-quick-actions"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Akcje</span>
                        </button>
                      )}
                      {section.itemIds.length === 0 && (
                        <DroppableEmptySection sectionId={section.id} />
                      )}
                    </div>
                  </div>
                );
              })}

              <DragOverlay>
                {activeItem ? <DragOverlayItem item={activeItem} /> : null}
              </DragOverlay>
            </DndContext>
          </nav>

          <div className="px-3 pb-4 pt-2 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 mb-3">
              {user?.profileImageUrl ? (
                <img src={user.profileImageUrl} alt="Profile" className="h-8 w-8 rounded-full border border-white/10" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                </div>
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-white truncate">{user?.firstName}</span>
                <span className="text-xs text-slate-400">Admin</span>
              </div>
            </div>
            <Link href="/ustawienia">
              <div
                onClick={() => setIsOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors mb-1 cursor-pointer",
                  location === "/ustawienia"
                    ? "text-[#5ADBFA]"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
                data-testid="link-nav-ustawienia"
              >
                <Settings className={cn("h-4 w-4", location === "/ustawienia" ? "text-[#5ADBFA]" : "")} />
                <span className="text-sm font-medium">Ustawienia</span>
              </div>
            </Link>
            <div className="flex items-center gap-3 px-3 py-2 mb-1">
              <Sun className="h-4 w-4 text-slate-400" />
              <Switch
                checked={theme === "dark"}
                onCheckedChange={toggleTheme}
                data-testid="switch-toggle-theme"
                className="data-[state=checked]:bg-slate-600 data-[state=unchecked]:bg-slate-600"
              />
              <Moon className="h-4 w-4 text-slate-400" />
            </div>
            <button
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              data-testid="button-logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Wyloguj</span>
            </button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <Dialog open={showQuickActions} onOpenChange={setShowQuickActions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Akcje</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { label: "Nowa rezerwacja", description: "Dodaj rezerwację krótkoterminową", icon: CalendarDays, href: "/reservations?action=new", color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Nowy podnajem", description: "Utwórz umowę podnajmu", icon: FileSignature, href: "/podnajem?action=new", color: "text-violet-500", bg: "bg-violet-500/10" },
              { label: "Nowy koszt", description: "Dodaj wydatek operacyjny", icon: Receipt, href: "/koszty?tab=operacyjne&action=new", color: "text-red-500", bg: "bg-red-500/10" },
              { label: "Faktura kosztowa", description: "Dodaj dokument księgowy", icon: FileText, href: "/dokumenty-ksiegowe", color: "text-amber-500", bg: "bg-amber-500/10" },
              { label: "Importuj rezerwacje", description: "Import z Excel / HotRes", icon: Upload, href: "/import-export", color: "text-emerald-500", bg: "bg-emerald-500/10" },
            ].map((action) => (
              <Card
                key={action.href}
                className="hover-elevate cursor-pointer"
                onClick={() => {
                  setShowQuickActions(false);
                  setIsOpen(false);
                  navigate(action.href);
                }}
                data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <CardContent className="p-3 flex flex-col items-center text-center gap-2">
                  <div className={cn("rounded-lg p-2.5", action.bg)}>
                    <action.icon className={cn("h-5 w-5", action.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-tight">{action.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{action.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
