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
  LogOut,
  Menu,
  X,
  GripVertical,
  ChevronDown
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
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
};

const DEFAULT_ITEMS: Record<string, NavItem> = {
  kokpit: { id: "kokpit", href: "/", label: "Dashboard", iconName: "LayoutDashboard" },
  "finance-forecast": { id: "finance-forecast", href: "/finance-forecast", label: "Finanse / Prognoza", iconName: "TrendingUp" },
  calendar: { id: "calendar", href: "/calendar", label: "Terminarz", iconName: "CalendarDays" },
  reservations: { id: "reservations", href: "/reservations", label: "Rezerwacje", iconName: "ClipboardList" },
  arrivals: { id: "arrivals", href: "/arrivals", label: "Przyjazdy", iconName: "Plane" },
  "income-rent": { id: "income-rent", href: "/income-rent", label: "Przychody Najem", iconName: "Wallet" },
  "income-subrent": { id: "income-subrent", href: "/income-subrent", label: "Przychody Podnajem", iconName: "HandCoins" },
  forecast: { id: "forecast", href: "/forecast", label: "Prognoza", iconName: "BarChart3" },
  "costs-apartments": { id: "costs-apartments", href: "/costs-apartments", label: "Koszty (Apartamenty)", iconName: "Building2" },
  "costs-expenses": { id: "costs-expenses", href: "/costs-expenses", label: "Koszty (Koszty)", iconName: "Receipt" },
  "saldo-ml": { id: "saldo-ml", href: "/saldo-ml", label: "Saldo - M. Latasiewicz", iconName: "Scale" },
  "saldo-jg": { id: "saldo-jg", href: "/saldo-jg", label: "Saldo - J. Głodkowska", iconName: "Coins" },
  "contracts-rent": { id: "contracts-rent", href: "/contracts-rent", label: "Umowy Najmu", iconName: "FileText" },
  "contracts-subrent": { id: "contracts-subrent", href: "/contracts-subrent", label: "Umowy Podnajmu", iconName: "FileSignature" },
  "contracts-services": { id: "contracts-services", href: "/contracts-services", label: "Umowy (usługi)", iconName: "Briefcase" },
  "contracts-other": { id: "contracts-other", href: "/contracts-other", label: "Umowy (inne)", iconName: "Files" },
  apartments: { id: "apartments", href: "/apartments", label: "Apartamenty", iconName: "Building2" },
  owners: { id: "owners", href: "/owners", label: "Właściciele", iconName: "Users" },
  employees: { id: "employees", href: "/employees", label: "Pracownicy", iconName: "Users" },
  import: { id: "import", href: "/import", label: "Import rezerwacji", iconName: "Upload" },
  export: { id: "export", href: "/export", label: "Eksport rezerwacji", iconName: "Download" },
  "user-accounts": { id: "user-accounts", href: "/user-accounts", label: "Konta użytkowników", iconName: "Users" },
  locations: { id: "locations", href: "/locations", label: "Lokalizacje", iconName: "MapPin" },
};

const DEFAULT_SECTIONS: NavSection[] = [
  { id: "main", itemIds: ["kokpit", "finance-forecast", "calendar"] },
  { id: "rezerwacje", title: "REZERWACJE", itemIds: ["reservations", "arrivals"] },
  { id: "finanse", title: "FINANSE", itemIds: ["income-rent", "income-subrent", "forecast", "costs-apartments", "costs-expenses", "saldo-ml", "saldo-jg"] },
  { id: "umowy", title: "UMOWY", itemIds: ["contracts-rent", "contracts-subrent", "contracts-services", "contracts-other"] },
  { id: "dane", title: "DANE", itemIds: ["apartments", "owners", "employees"] },
  { id: "ustawienia", title: "USTAWIENIA", itemIds: ["import", "export", "user-accounts", "locations"] },
];

const STORAGE_KEY = "sidebar-layout-v1";
const COLLAPSED_KEY = "sidebar-collapsed-v1";

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

function loadLayout(): SidebarLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as SidebarLayout;
      const allDefaultIds = Object.keys(DEFAULT_ITEMS);
      const storedIds = new Set(parsed.sections.flatMap(s => s.itemIds));
      const missingIds = allDefaultIds.filter(id => !storedIds.has(id));
      if (missingIds.length > 0) {
        const lastSection = parsed.sections[parsed.sections.length - 1];
        if (lastSection) {
          lastSection.itemIds.push(...missingIds);
        }
      }
      const items = { ...DEFAULT_ITEMS };
      return { sections: parsed.sections, items };
    }
  } catch {}
  return { sections: DEFAULT_SECTIONS, items: DEFAULT_ITEMS };
}

function saveLayout(sections: NavSection[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sections, items: {} }));
  } catch {}
}

function findSectionOfItem(sections: NavSection[], itemId: string): string | null {
  for (const section of sections) {
    if (section.itemIds.includes(itemId)) return section.id;
  }
  return null;
}

function SortableNavItem({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 rounded-lg transition-all duration-200 group",
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
      <Link href={item.href} data-testid={`link-nav-${item.href === "/" ? "home" : item.href.slice(1)}`} className="flex-1 min-w-0">
        <div
          onClick={onClick}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group",
            isActive
              ? "text-white shadow-lg"
              : "text-slate-400 hover:text-white hover:bg-white/10"
          )}
          style={isActive ? { backgroundColor: "#5ADBFA", boxShadow: "0 4px 14px rgba(90, 219, 250, 0.3)" } : undefined}
        >
          <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
          <span className="font-medium text-xs truncate">{item.label}</span>
        </div>
      </Link>
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

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [layout, setLayout] = useState<SidebarLayout>(loadLayout);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(loadCollapsed);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      saveCollapsed(next);
      return next;
    });
  }, []);

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
    return layout.items[activeId as string] || null;
  }, [activeId, layout.items]);

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
          return { ...prev, sections: newSections };
        });
        return;
      }
    }

    setLayout(prev => {
      saveLayout(prev.sections);
      return prev;
    });
  }, [layout.sections]);

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
          <div className="px-5 pt-5 pb-4 flex items-center justify-center">
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
                        className="px-3 pt-1 pb-2 flex items-center justify-between cursor-pointer select-none group"
                        onClick={() => toggleSection(section.id)}
                        data-testid={`toggle-section-${section.id}`}
                      >
                        <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">{section.title}</span>
                        <ChevronDown className={cn(
                          "h-3 w-3 text-slate-500 transition-transform duration-200 group-hover:text-slate-300",
                          isCollapsed ? "-rotate-90" : ""
                        )} />
                      </div>
                    )}
                    <div className={cn(
                      "transition-all duration-200 overflow-hidden",
                      isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
                    )}>
                      <SortableContext items={section.itemIds} strategy={verticalListSortingStrategy} id={section.id}>
                        {section.itemIds.map((itemId) => {
                          const item = layout.items[itemId];
                          if (!item) return null;
                          return (
                            <SortableNavItem
                              key={item.id}
                              item={item}
                              isActive={location === item.href}
                              onClick={() => setIsOpen(false)}
                            />
                          );
                        })}
                      </SortableContext>
                      {section.itemIds.length === 0 && (
                        <div
                          className="mx-2 py-3 border border-dashed border-white/10 rounded-lg flex items-center justify-center"
                          data-testid={`empty-section-${section.id}`}
                        >
                          <span className="text-[10px] text-slate-600">Przeciągnij tutaj</span>
                        </div>
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
    </>
  );
}
