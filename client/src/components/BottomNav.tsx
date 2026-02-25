import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarRange,
  Calculator,
  TrendingUp,
  Menu,
} from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/terminarz", icon: CalendarRange, label: "Terminarz" },
  { href: "/v2-koszty", icon: Calculator, label: "Koszty" },
  { href: "/v2-przychody", icon: TrendingUp, label: "Przychody" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background border-t flex items-center justify-around lg:hidden"
      data-testid="nav-bottom"
    >
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <Link key={item.href} href={item.href}>
            <div
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 cursor-pointer min-w-[56px]",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
              data-testid={`bottom-nav-${item.href === "/" ? "dashboard" : item.href.slice(1)}`}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
            </div>
          </Link>
        );
      })}
      <div
        onClick={() => window.dispatchEvent(new Event("toggle-mobile-sidebar"))}
        className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 cursor-pointer min-w-[56px] text-muted-foreground"
        data-testid="bottom-nav-menu"
      >
        <Menu className="h-5 w-5" />
        <span className="text-[10px] font-medium leading-tight">Menu</span>
      </div>
    </nav>
  );
}
