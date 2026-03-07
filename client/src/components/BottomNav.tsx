import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Menu } from "lucide-react";
import { getBottomNavForPath } from "@/lib/bottom-nav-config";

export function BottomNav() {
  const [location, navigate] = useLocation();
  const navItems = getBottomNavForPath(location);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background border-t flex items-center justify-around lg:hidden"
      data-testid="nav-bottom"
    >
      {navItems.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href + "/"));
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => navigate(item.href)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 cursor-pointer min-w-[56px] bg-transparent border-0 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            data-testid={`bottom-nav-${item.testId}`}
          >
            <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
            {isActive ? (
              <span className="text-[10px] font-semibold leading-tight" data-testid={`bottom-nav-label-${item.testId}`}>
                {item.label}
              </span>
            ) : null}
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("toggle-mobile-sidebar"))}
        className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 cursor-pointer min-w-[56px] bg-transparent border-0 text-muted-foreground"
        data-testid="bottom-nav-menu"
      >
        <Menu className="h-5 w-5" />
      </button>
    </nav>
  );
}
