import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  Calculator,
  Wallet,
  Menu,
} from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/v2/przychody", icon: TrendingUp, label: "Przychody" },
  { href: "/v2/koszty", icon: Calculator, label: "Koszty" },
  { href: "/saldo-firmowe", icon: Wallet, label: "Saldo" },
];

export function BottomNav() {
  const [location, navigate] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-background border-t flex items-center justify-around lg:hidden"
      data-testid="nav-bottom"
    >
      {navItems.map((item) => {
        const isActive = location === item.href;
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => navigate(item.href)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 cursor-pointer min-w-[56px] bg-transparent border-0",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
            data-testid={`bottom-nav-${item.href === "/" ? "dashboard" : item.href.slice(1)}`}
          >
            <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
            <span className="text-[10px] font-medium leading-tight">{item.label}</span>
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
        <span className="text-[10px] font-medium leading-tight">Menu</span>
      </button>
    </nav>
  );
}
