import { useState, useEffect, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useOrientationLock } from "@/hooks/use-orientation-lock";
import { useRecepcjaAuth, recepcjaFetch } from "./RecepcjaApp";
import { useTheme } from "@/components/ThemeProvider";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LayoutDashboard, Wallet, FileText, HandCoins, UserPlus, History,
  Gauge, ClipboardList, FolderOpen, Search, CalendarDays, Hotel,
  Phone, CheckSquare, Clock, LogOut, Sun, Moon, Menu, X,
  PanelLeftClose, PanelLeft, ChevronDown, FileBarChart, AlertTriangle,
  Bell, Check, CheckCheck, Plus,
  type LucideIcon,
} from "lucide-react";
import logoSrc from "@assets/logobaltyckie_1770719337266.png";
import { InstallPrompt } from "@/components/InstallPrompt";

type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
};

type NavSection = {
  id: string;
  label?: string;
  color?: string;
  items: NavItem[];
};

const NAV_SECTIONS: NavSection[] = [
  {
    id: "main",
    items: [
      { label: "Pulpit", path: "/recepcja/dashboard", icon: LayoutDashboard },
      { label: "Saldo", path: "/recepcja/saldo", icon: Wallet },
    ],
  },
  {
    id: "podnajem",
    label: "PODNAJEM",
    color: "text-violet-400",
    items: [
      { label: "Umowy", path: "/recepcja/podnajem/umowy", icon: FileText },
      { label: "Rozliczenia", path: "/recepcja/podnajem/rozliczenia", icon: HandCoins },
      { label: "Nowi najemcy", path: "/recepcja/podnajem/nowy-najemca", icon: UserPlus },
      { label: "Historia zmian", path: "/recepcja/podnajem/historia", icon: History },
    ],
  },
  {
    id: "operacje",
    label: "OPERACJE",
    color: "text-emerald-400",
    items: [
      { label: "Liczniki", path: "/recepcja/liczniki", icon: Gauge },
      { label: "Protokoły", path: "/recepcja/protokoly", icon: ClipboardList },
      { label: "Dokumenty", path: "/recepcja/dokumenty", icon: FolderOpen },
      { label: "Przeglądy", path: "/recepcja/przeglady", icon: Search },
      { label: "Usterki", path: "/recepcja/usterki", icon: AlertTriangle },
    ],
  },
  {
    id: "rezerwacje",
    label: "REZERWACJE",
    color: "text-cyan-400",
    items: [
      { label: "Terminarz", path: "/recepcja/terminarz", icon: CalendarDays },
      { label: "Rezerwacje", path: "/recepcja/rezerwacje", icon: Hotel },
    ],
  },
  {
    id: "zarzadzanie",
    label: "ZARZĄDZANIE",
    color: "text-blue-400",
    items: [
      { label: "RCP", path: "/recepcja/rcp", icon: Clock },
      { label: "Kontakty najemców", path: "/recepcja/kontakty", icon: Phone },
      { label: "Zadania", path: "/recepcja/zadania", icon: CheckSquare },
      { label: "Raport dzienny", path: "/recepcja/raport-dzienny", icon: FileBarChart },
    ],
  },
];

const MOBILE_NAV: NavItem[] = [
  { label: "Pulpit", path: "/recepcja/dashboard", icon: LayoutDashboard },
  { label: "Saldo", path: "/recepcja/saldo", icon: Wallet },
  { label: "RCP", path: "/recepcja/rcp", icon: Clock },
  { label: "Podnajem", path: "/recepcja/podnajem/umowy", icon: FileText },
];

function NavItemLink({ item, isActive, onClick, compact }: {
  item: NavItem; isActive: boolean; onClick: () => void; compact?: boolean;
}) {
  const Icon = item.icon;

  if (compact) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={item.path} className="no-underline">
              <div
                onClick={onClick}
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 cursor-pointer mx-auto",
                  isActive
                    ? "!text-[#5ADBFA] bg-[#5ADBFA]/10"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
                data-testid={`nav-recepcja-${item.path.split('/').pop()}`}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "!text-[#5ADBFA]" : "text-slate-400")} />
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {item.label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Link href={item.path} className={cn("flex-1 min-w-0 no-underline", isActive ? "!text-[#5ADBFA]" : "")}>
      <div
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer",
          isActive
            ? "!text-[#5ADBFA]"
            : "text-slate-400 hover:text-white hover:bg-white/5"
        )}
        data-testid={`nav-recepcja-${item.path.split('/').pop()}`}
      >
        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "!text-[#5ADBFA]" : "text-slate-400")} />
        <span className="font-medium text-xs leading-tight">{item.label}</span>
      </div>
    </Link>
  );
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "przed chwilą";
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} godz. temu`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} dni temu`;
  return `${Math.floor(diffDays / 30)} mies. temu`;
}

function RecepcjaNotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/recepcja/notifications/unread-count"],
    queryFn: async () => {
      const res = await recepcjaFetch("GET", "/api/recepcja/notifications/unread-count");
      if (!res.ok) return { count: 0 };
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: notificationsList, isLoading } = useQuery<any[]>({
    queryKey: ["/api/recepcja/notifications"],
    queryFn: async () => {
      const res = await recepcjaFetch("GET", "/api/recepcja/notifications");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await recepcjaFetch("PATCH", `/api/recepcja/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/notifications/unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await recepcjaFetch("POST", "/api/recepcja/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja/notifications/unread-count"] });
    },
  });

  const unreadCount = unreadData?.count || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="relative text-slate-400 hover:text-white hover:bg-white/5"
          data-testid="button-recepcja-notification-bell"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground"
              data-testid="badge-recepcja-unread-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" data-testid="popover-recepcja-notifications">
        <div className="flex items-center justify-between gap-2 border-b p-3">
          <h4 className="text-sm font-semibold" data-testid="text-recepcja-notifications-title">Powiadomienia</h4>
          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              data-testid="button-recepcja-mark-all-read"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Oznacz wszystkie
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-recepcja-notifications-loading">
              Ładowanie...
            </div>
          ) : !notificationsList || notificationsList.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground" data-testid="text-recepcja-no-notifications">
              Brak powiadomień
            </div>
          ) : (
            <div className="divide-y">
              {notificationsList.map((notification: any) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 p-3 ${!notification.isRead ? "bg-muted/50" : ""}`}
                  data-testid={`recepcja-notification-item-${notification.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium" data-testid={`text-recepcja-notification-title-${notification.id}`}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5" data-testid={`text-recepcja-notification-message-${notification.id}`}>
                      {notification.message}
                    </p>
                    {notification.createdAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {timeAgo(notification.createdAt.toString())}
                      </p>
                    )}
                  </div>
                  {!notification.isRead && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => markReadMutation.mutate(notification.id)}
                      disabled={markReadMutation.isPending}
                      data-testid={`button-recepcja-mark-read-${notification.id}`}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function RecepcjaFAB() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();

  const actions = [
    { label: "Nowy odczyt", icon: Gauge, path: "/recepcja/liczniki", color: "bg-emerald-600" },
    { label: "Zgłoś usterkę", icon: AlertTriangle, path: "/recepcja/usterki", color: "bg-amber-600" },
    { label: "Raport dzienny", icon: FileBarChart, path: "/recepcja/raport-dzienny", color: "bg-blue-600" },
  ];

  return (
    <div className="fixed bottom-20 right-4 z-40 lg:bottom-6 lg:right-6 flex flex-col-reverse items-end gap-2">
      {open && actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            onClick={() => { setOpen(false); navigate(action.path); }}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2.5 text-white shadow-lg transition-all duration-200",
              action.color
            )}
            data-testid={`fab-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        );
      })}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={cn(
          "flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-200 text-white",
          open ? "bg-red-600 rotate-45" : "bg-primary"
        )}
        data-testid="button-recepcja-fab"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}

export default function RecepcjaLayout({ children }: { children: React.ReactNode }) {
  useOrientationLock("portrait");
  const [location] = useLocation();
  const { user, logout } = useRecepcjaAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const { data: sidebarConfig } = useQuery<{ hiddenItems: string[] }>({
    queryKey: ["/api/recepcja/sidebar-config"],
    queryFn: async () => {
      const res = await recepcjaFetch("GET", "/api/recepcja/sidebar-config");
      if (!res.ok) return { hiddenItems: [] };
      return res.json();
    },
    staleTime: 60000,
  });

  const hiddenItems = useMemo(() => new Set(sidebarConfig?.hiddenItems || []), [sidebarConfig]);

  const filteredNavSections = useMemo(() => {
    return NAV_SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(item => !hiddenItems.has(item.path)),
    })).filter(section => section.items.length > 0);
  }, [hiddenItems]);

  const filteredMobileNav = useMemo(() => {
    return MOBILE_NAV.filter(item => !hiddenItems.has(item.path));
  }, [hiddenItems]);

  useEffect(() => {
    const handler = () => setIsOpen(prev => !prev);
    window.addEventListener("toggle-recepcja-sidebar", handler);
    return () => window.removeEventListener("toggle-recepcja-sidebar", handler);
  }, []);

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isActive = (path: string) =>
    location === path || (path !== '/recepcja/dashboard' && path !== '/recepcja' && location.startsWith(path));

  const sidebarWidth = compact ? "w-16" : "w-64";

  return (
    <div className="flex h-screen bg-background">
      {isOpen && (
        <div className="lg:hidden fixed top-0 right-0 z-50 p-3">
          <button
            onClick={() => setIsOpen(false)}
            className="text-white bg-slate-900/80 backdrop-blur-sm rounded-full p-2"
            data-testid="button-recepcja-close-sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-slate-900 text-white transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-screen shadow-xl",
          sidebarWidth,
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full flex flex-col">
          <div className={cn("flex items-center justify-center", compact ? "px-2 pt-4 pb-3" : "px-5 pt-5 pb-5")}>
            {compact ? (
              <div className="w-8 h-8 rounded-lg bg-[#5ADBFA]/20 flex items-center justify-center" data-testid="img-recepcja-logo-compact">
                <LayoutDashboard className="h-4 w-4 text-[#5ADBFA]" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1">
                <img src={logoSrc} alt="Bałtyckie - Recepcja" className="h-7 object-contain" data-testid="img-recepcja-logo" />
                <span className="text-[9px] font-medium text-slate-500 tracking-widest uppercase">Recepcja</span>
              </div>
            )}
          </div>

          <nav className={cn("flex-1 overflow-y-auto pb-4 space-y-1", compact ? "px-1" : "px-3")} data-testid="nav-recepcja-sidebar">
            {filteredNavSections.map((section, sIdx) => {
              const isCollapsed = section.label ? collapsedSections.has(section.id) : false;
              return (
                <div key={section.id} data-testid={`nav-recepcja-section-${section.id}`}>
                  {sIdx > 0 && (
                    <div className={cn("border-t border-white/10", compact ? "my-2 mx-1" : "my-3")} />
                  )}
                  {section.label && !compact && (
                    <div className="px-3 pt-1 pb-2 flex items-center justify-between select-none group/section">
                      <div
                        className="flex items-center gap-1 flex-1 min-w-0 cursor-pointer"
                        onClick={() => toggleSection(section.id)}
                        data-testid={`toggle-recepcja-section-${section.id}`}
                      >
                        <span className={cn(
                          "text-[10px] font-bold tracking-widest uppercase",
                          section.color || "text-slate-500"
                        )}>{section.label}</span>
                        <ChevronDown className={cn(
                          "h-3 w-3 text-slate-500 transition-transform duration-200 group-hover/section:text-slate-300",
                          isCollapsed ? "-rotate-90" : ""
                        )} />
                      </div>
                    </div>
                  )}
                  <div className={cn(
                    "transition-all duration-200 overflow-hidden",
                    !compact && isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
                  )}>
                    {section.items.map((item) => (
                      <NavItemLink
                        key={item.path}
                        item={item}
                        isActive={isActive(item.path)}
                        onClick={() => setIsOpen(false)}
                        compact={compact}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>

          <InstallPrompt variant={compact ? "compact" : "sidebar"} />

          <div className={cn("pb-3 pt-2 border-t border-white/10", compact ? "px-1" : "px-3")}>
            {!compact && (
              <div className="flex items-center gap-2.5 px-3 mb-2">
                <div className="w-7 h-7 rounded-full bg-[#5ADBFA]/20 flex items-center justify-center text-[#5ADBFA] font-bold text-xs shrink-0">
                  {user?.name?.charAt(0) || 'M'}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-white truncate">{user?.name}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">Kierownik Recepcji</span>
                </div>
              </div>
            )}

            {compact ? (
              <div className="flex flex-col items-center gap-1">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={toggleTheme}
                        className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        data-testid="button-recepcja-theme"
                      >
                        {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">{theme === "dark" ? "Tryb jasny" : "Tryb ciemny"}</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setCompact(false)}
                        className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                        data-testid="button-recepcja-collapse"
                      >
                        <PanelLeft className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">Rozwiń menu</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={logout}
                        className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        data-testid="button-recepcja-logout"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">Wyloguj</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-1 mb-1">
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={toggleTheme}
                          className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                          data-testid="button-recepcja-theme"
                        >
                          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">{theme === "dark" ? "Tryb jasny" : "Tryb ciemny"}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setCompact(true)}
                          className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                          data-testid="button-recepcja-collapse"
                        >
                          <PanelLeftClose className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Zwiń menu</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  data-testid="button-recepcja-logout"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="text-xs font-medium">Wyloguj</span>
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      <main className="flex-1 overflow-y-auto pb-20 lg:pb-4">
        <div className="flex items-center justify-end gap-2 px-4 pt-3 max-w-7xl mx-auto">
          <RecepcjaNotificationBell />
        </div>
        <div className="p-4 pt-2 max-w-7xl mx-auto">
          {children}
        </div>
        <RecepcjaFAB />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900 border-t border-white/10 lg:hidden" data-testid="nav-recepcja-bottom">
        <div className="flex items-center justify-around h-14">
          {filteredMobileNav.map(item => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} href={item.path}>
                <button className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px]",
                  active ? "text-[#5ADBFA]" : "text-slate-400"
                )}>
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px]">{item.label}</span>
                </button>
              </Link>
            );
          })}
          <button
            onClick={() => setIsOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1 min-w-[56px] text-slate-400"
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