import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRecepcjaAuth } from "./RecepcjaApp";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Wallet, FileText, HandCoins, UserPlus, History,
  Gauge, ClipboardList, FolderOpen, Search, CalendarDays, Hotel,
  Phone, CheckSquare, Clock, LogOut, Sun, Moon, Menu, X,
  PanelLeftClose, PanelLeft, ChevronDown, ChevronRight, FileBarChart,
} from "lucide-react";

type NavItem = {
  label: string;
  path: string;
  icon: any;
};

type NavSection = {
  label: string;
  icon?: any;
  items: NavItem[];
  collapsible?: boolean;
};

const NAV_SECTIONS: NavSection[] = [
  {
    label: "GŁÓWNE",
    items: [
      { label: "Dashboard", path: "/recepcja/dashboard", icon: LayoutDashboard },
      { label: "Saldo", path: "/recepcja/saldo", icon: Wallet },
    ],
  },
  {
    label: "PODNAJEM",
    collapsible: true,
    items: [
      { label: "Umowy", path: "/recepcja/podnajem/umowy", icon: FileText },
      { label: "Rozliczenia", path: "/recepcja/podnajem/rozliczenia", icon: HandCoins },
      { label: "Nowi najemcy", path: "/recepcja/podnajem/nowy-najemca", icon: UserPlus },
      { label: "Historia zmian", path: "/recepcja/podnajem/historia", icon: History },
    ],
  },
  {
    label: "OPERACJE",
    collapsible: true,
    items: [
      { label: "Liczniki", path: "/recepcja/liczniki", icon: Gauge },
      { label: "Protokoły", path: "/recepcja/protokoly", icon: ClipboardList },
      { label: "Dokumenty", path: "/recepcja/dokumenty", icon: FolderOpen },
      { label: "Przeglądy", path: "/recepcja/przeglady", icon: Search },
    ],
  },
  {
    label: "REZERWACJE",
    collapsible: true,
    items: [
      { label: "Terminarz", path: "/recepcja/terminarz", icon: CalendarDays },
      { label: "Rezerwacje", path: "/recepcja/rezerwacje", icon: Hotel },
    ],
  },
  {
    label: "ZARZĄDZANIE",
    collapsible: true,
    items: [
      { label: "RCP", path: "/recepcja/rcp", icon: Clock },
      { label: "Kontakty najemców", path: "/recepcja/kontakty", icon: Phone },
      { label: "Zadania", path: "/recepcja/zadania", icon: CheckSquare },
      { label: "Raport dzienny", path: "/recepcja/raport-dzienny", icon: FileBarChart },
    ],
  },
];

const MOBILE_NAV: NavItem[] = [
  { label: "Dashboard", path: "/recepcja/dashboard", icon: LayoutDashboard },
  { label: "Saldo", path: "/recepcja/saldo", icon: Wallet },
  { label: "RCP", path: "/recepcja/rcp", icon: Clock },
  { label: "Podnajem", path: "/recepcja/podnajem/umowy", icon: FileText },
];

export default function RecepcjaLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useRecepcjaAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isActive = (path: string) => location === path || (path !== '/recepcja/dashboard' && path !== '/recepcja' && location.startsWith(path));

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
          {user?.name?.charAt(0) || 'M'}
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.name}</div>
            <div className="text-xs text-muted-foreground">Recepcja</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {NAV_SECTIONS.map(section => (
          <div key={section.label}>
            {section.collapsible ? (
              <button
                onClick={() => toggleSection(section.label)}
                className="flex items-center justify-between w-full px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
              >
                {!collapsed && <span>{section.label}</span>}
                {!collapsed && (collapsedSections[section.label] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
              </button>
            ) : (
              !collapsed && <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{section.label}</div>
            )}
            {!collapsedSections[section.label] && section.items.map(item => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.path} href={item.path}>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm transition-colors",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    data-testid={`nav-recepcja-${item.path.split('/').pop()}`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="border-t p-2 space-y-1">
        <div className="flex items-center gap-1 justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="w-9 h-9" data-testid="button-recepcja-theme">
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{theme === 'dark' ? 'Tryb jasny' : 'Tryb ciemny'}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="w-9 h-9 hidden lg:flex" data-testid="button-recepcja-collapse">
                {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">{collapsed ? 'Rozwiń' : 'Zwiń'}</TooltipContent>
          </Tooltip>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="w-full text-xs justify-start text-muted-foreground" data-testid="button-recepcja-logout">
          <LogOut className="h-3.5 w-3.5 mr-2" />
          {!collapsed && "Wyloguj"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-card border-r transition-all duration-200 lg:relative lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-3 right-3 z-50 lg:hidden p-1 rounded-md hover:bg-muted"
            data-testid="button-recepcja-close-sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {sidebarContent}
      </aside>

      <main className="flex-1 overflow-y-auto pb-20 lg:pb-4">
        <div className="p-4 max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t lg:hidden" data-testid="nav-recepcja-bottom">
        <div className="flex items-center justify-around h-14">
          {MOBILE_NAV.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} href={item.path}>
                <button className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px]",
                  active ? "text-primary" : "text-muted-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px]">{item.label}</span>
                </button>
              </Link>
            );
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px] text-muted-foreground"
            data-testid="button-recepcja-menu"
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px]">Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
}