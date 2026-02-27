import { Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Receipt,
  FileText,
  FileSignature,
  Upload,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Pencil,
  Moon,
  Sun,
  Plus,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/ThemeProvider";
import { useState, useCallback, useMemo, useEffect } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import logoSrc from "@assets/logobaltyckie_1770719337266.png";
import {
  type NavItem,
  ICON_MAP,
  getSectionColorClass,
  getSectionColorStyle,
} from "@/lib/sidebar-config";
import { useSidebar } from "@/contexts/SidebarContext";

function NavItemLink({ item, isActive, onClick, badgeCount, compact }: { item: NavItem; isActive: boolean; onClick: () => void; badgeCount?: number; compact?: boolean }) {
  const Icon = ICON_MAP[item.iconName] || LayoutDashboard;

  if (compact) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href={item.href} data-testid={`link-nav-${item.href === "/" ? "home" : item.href.slice(1)}`} className="no-underline">
              <div
                onClick={onClick}
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 cursor-pointer mx-auto",
                  isActive
                    ? "!text-[#5ADBFA] bg-[#5ADBFA]/10 shadow-[0_0_10px_rgba(90,219,250,0.15)]"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "!text-[#5ADBFA]" : "")} />
                {badgeCount && badgeCount > 0 ? (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5" data-testid={`badge-overdue-${item.id}`}>
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                ) : null}
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
    <Link href={item.href} data-testid={`link-nav-${item.href === "/" ? "home" : item.href.slice(1)}`} className={cn("flex-1 min-w-0 no-underline", isActive ? "!text-[#5ADBFA]" : "")}>
      <div
        onClick={onClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer",
          isActive
            ? "!text-[#5ADBFA] sidebar-active-glow rounded-lg"
            : "text-slate-400 hover:text-slate-200 hover:bg-white/5 hover:shadow-[inset_2px_0_0_rgba(90,219,250,0.25)]"
        )}
      >
        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "!text-[#5ADBFA]" : "")} />
        <span className="font-medium text-xs leading-tight">{item.label}</span>
        {badgeCount && badgeCount > 0 ? (
          <span className="ml-auto shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1" data-testid={`badge-overdue-${item.id}`}>
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

export function Sidebar({ style }: { style?: React.CSSProperties }) {
  const [location, navigate] = useLocation();
  const { logout, user } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);

  useEffect(() => {
    const handler = () => setIsOpen(prev => !prev);
    window.addEventListener("toggle-mobile-sidebar", handler);
    return () => window.removeEventListener("toggle-mobile-sidebar", handler);
  }, []);

  const { config, allItems, toggleCollapsed, setCompact } = useSidebar();
  const { sections, hiddenItems, collapsed, compact } = config;
  const hiddenSet = useMemo(() => new Set(hiddenItems), [hiddenItems]);
  const collapsedSet = useMemo(() => new Set(collapsed), [collapsed]);

  const { data: companySettings } = useQuery<any>({
    queryKey: ["/api/company-settings"],
    staleTime: 1000 * 60 * 10,
  });

  const companyLogoUrl = companySettings?.logoUrl ? `/api/company-settings/logo?t=${encodeURIComponent(companySettings.logoUrl)}` : null;
  const companyName = companySettings?.companyName || null;

  const { data: overdueCounts } = useQuery<{ costs: number; subleases: number }>({
    queryKey: ["/api/overdue-counts"],
    staleTime: 1000 * 60 * 5,
  });

  const badgeMap = useMemo<Record<string, number>>(() => {
    if (!overdueCounts) return {};
    const map: Record<string, number> = {};
    if (overdueCounts.costs > 0) {
      if (config.badgeConfig["koszty-apartamentowe"] !== false) map["koszty-apartamentowe"] = overdueCounts.costs;
      if (config.badgeConfig["apartment-schedule"] !== false) map["apartment-schedule"] = overdueCounts.costs;
    }
    if (overdueCounts.subleases > 0) {
      if (config.badgeConfig["podnajem"] !== false) map["podnajem"] = overdueCounts.subleases;
    }
    return map;
  }, [overdueCounts, config.badgeConfig]);

  const toggleCompact = useCallback(() => {
    setCompact(!compact);
  }, [compact, setCompact]);

  const sidebarWidth = compact ? "w-16" : "w-64";

  return (
    <>
      {isOpen && (
        <div className="lg:hidden fixed top-0 right-0 z-50 p-3">
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-white bg-slate-900/80 backdrop-blur-sm rounded-full" data-testid="button-close-sidebar">
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 text-white transform transition-all duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-screen shadow-xl",
        sidebarWidth,
        isOpen ? "translate-x-0" : "-translate-x-full"
      )} style={{ ...style, position: style?.position || undefined }} data-sidebar-fs>
        <div className="h-full flex flex-col">
          <div className={cn("flex items-center justify-center", compact ? "px-2 pt-4 pb-3" : "px-5 pt-5 pb-5")}>
            {compact ? (
              <div className="w-8 h-8 rounded-lg bg-[#5ADBFA]/20 flex items-center justify-center" data-testid="img-logo-compact">
                <LayoutDashboard className="h-4 w-4 text-[#5ADBFA]" />
              </div>
            ) : companyLogoUrl ? (
              <img src={companyLogoUrl} alt={companyName || "Logo"} className="h-7 object-contain" data-testid="img-logo" onError={(e) => { (e.target as HTMLImageElement).src = logoSrc; }} />
            ) : (
              <img src={logoSrc} alt="Bałtyckie Finanse" className="h-7 object-contain" data-testid="img-logo" />
            )}
          </div>

          <nav className={cn("flex-1 overflow-y-auto pb-4 space-y-1", compact ? "px-1" : "px-3")} data-testid="nav-sidebar">
            {sections.map((section, sIdx) => {
              const isCollapsed = (section.title && section.id !== "finanse") ? collapsedSet.has(section.id) : false;
              return (
                <div key={section.id} data-testid={`nav-section-${section.id}`}>
                  {sIdx > 0 && (
                    <div className={cn("border-t border-white/10", compact ? "my-2 mx-1" : "my-3")} />
                  )}
                  {section.title && !compact && (
                    <div
                      className="px-3 pt-1 pb-2 flex items-center justify-between select-none group/section"
                      data-testid={`section-header-${section.id}`}
                    >
                      <div
                        className={cn("flex items-center gap-1 flex-1 min-w-0", section.id !== "finanse" && "cursor-pointer")}
                        onClick={() => section.id !== "finanse" && toggleCollapsed(section.id)}
                        data-testid={`toggle-section-${section.id}`}
                      >
                        <span className={cn(
                          "text-[10px] font-bold tracking-widest uppercase",
                          getSectionColorClass(section.color)
                        )} style={getSectionColorStyle(section.color)}>{section.title}</span>
                        {section.id !== "finanse" && (
                          <ChevronDown className={cn(
                            "h-3 w-3 text-slate-500 transition-transform duration-200 group-hover/section:text-slate-300",
                            isCollapsed ? "-rotate-90" : ""
                          )} />
                        )}
                      </div>
                    </div>
                  )}
                  <div className={cn(
                    "transition-all duration-200 overflow-hidden",
                    !compact && isCollapsed ? "max-h-0 opacity-0" : "max-h-[2000px] opacity-100"
                  )}>
                    {section.itemIds.map((itemId) => {
                      if (hiddenSet.has(itemId)) return null;
                      if (itemId.startsWith("sep-")) {
                        if (compact) return null;
                        return <div key={itemId} className="my-2 mx-3 border-t border-white/10" />;
                      }
                      if (itemId.startsWith("label-")) {
                        if (compact) return null;
                        const labelItem = config.customItems[itemId];
                        return (
                          <div key={itemId} className="px-3 pt-2 pb-1">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{labelItem?.label || ""}</span>
                          </div>
                        );
                      }
                      const item = allItems[itemId];
                      if (!item) return null;
                      return (
                        <NavItemLink
                          key={item.id}
                          item={item}
                          isActive={location === item.href}
                          onClick={() => setIsOpen(false)}
                          badgeCount={badgeMap[item.id]}
                          compact={compact}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          <div className={cn("flex justify-center", compact ? "px-1 py-2" : "px-3 py-2")}>
            {compact ? (
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowQuickActions(true)}
                      className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors bg-[#5ADBFA] text-slate-900 hover:bg-[#5ADBFA]/85"
                      data-testid="button-quick-actions"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">Dodaj</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <button
                onClick={() => setShowQuickActions(true)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors bg-[#5ADBFA] text-slate-900 hover:bg-[#5ADBFA]/85"
                data-testid="button-quick-actions"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Dodaj</span>
              </button>
            )}
          </div>

          <div className={cn("pb-3 pt-2 border-t border-white/10", compact ? "px-1" : "px-3")}>
            {!compact && (
              <div className="flex items-center gap-2.5 px-3 mb-2">
                {user?.id && (
                  <div className="relative group/avatar">
                    <UserAvatar userId={user.id} firstName={user.firstName} lastName={user.lastName} size="sm" className="border border-white/10" />
                    <label className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                      <Pencil className="h-3 w-3 text-white" />
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !user?.id) return;
                          const formData = new FormData();
                          formData.append("photo", file);
                          try {
                            const resp = await fetch(`/api/users/${user.id}/profile-photo`, { method: "POST", body: formData, credentials: "include" });
                            if (!resp.ok) {
                              const err = await resp.json().catch(() => ({ message: "Błąd przesyłania" }));
                              toast({ title: "Błąd", description: err.message, variant: "destructive" });
                              return;
                            }
                            toast({ title: "Sukces", description: "Zdjęcie profilowe zostało zaktualizowane" });
                            setTimeout(() => window.location.reload(), 500);
                          } catch (err) {
                            toast({ title: "Błąd", description: "Nie udało się przesłać zdjęcia", variant: "destructive" });
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-white truncate">{user?.firstName}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">Admin</span>
                </div>
              </div>
            )}

            {compact ? (
              <div className="flex flex-col items-center gap-1">
                <TooltipProvider delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/ustawienia">
                        <div
                          onClick={() => setIsOpen(false)}
                          className={cn(
                            "flex items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer",
                            location === "/ustawienia" ? "text-[#5ADBFA] bg-[#5ADBFA]/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                          )}
                          data-testid="link-nav-ustawienia"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">Ustawienia</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={toggleCompact}
                        className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                        data-testid="button-toggle-compact"
                      >
                        <PanelLeft className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">Rozwiń menu</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => logout()}
                        className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        data-testid="button-logout"
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
                        <Link href="/ustawienia">
                          <div
                            onClick={() => setIsOpen(false)}
                            className={cn(
                              "flex items-center justify-center w-10 h-10 rounded-lg transition-colors cursor-pointer",
                              location === "/ustawienia" || location === "/ustawienia-menu"
                                ? "text-[#5ADBFA] bg-[#5ADBFA]/10"
                                : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                            )}
                            data-testid="link-nav-ustawienia"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </div>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Ustawienia</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={toggleCompact}
                          className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                          data-testid="button-toggle-compact"
                        >
                          <PanelLeftClose className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Zwiń menu</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={toggleTheme}
                          className="flex items-center justify-center w-10 h-10 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
                          data-testid="button-toggle-theme"
                        >
                          {theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">{theme === "dark" ? "Tryb jasny" : "Tryb ciemny"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                  data-testid="button-logout"
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

      <Dialog open={showQuickActions} onOpenChange={setShowQuickActions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dodaj</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[
              { label: "Nowa rezerwacja", description: "Dodaj rezerwację krótkoterminową", icon: CalendarDays, href: "/reservations?action=new", color: "text-blue-500", bg: "bg-blue-500/10" },
              { label: "Nowy podnajem", description: "Utwórz umowę podnajmu", icon: FileSignature, href: "/podnajem?action=new", color: "text-violet-500", bg: "bg-violet-500/10" },
              { label: "Nowy koszt", description: "Dodaj wydatek operacyjny", icon: Receipt, href: "/koszty-operacyjne?action=new", color: "text-red-500", bg: "bg-red-500/10" },
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
