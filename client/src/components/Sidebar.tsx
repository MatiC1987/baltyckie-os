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
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import logoSrc from "@assets/logobaltyckie_1770719337266.png";

interface NavItem {
  href: string;
  label: string;
  icon: any;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    items: [
      { href: "/", label: "Kokpit", icon: LayoutDashboard },
      { href: "/finance-forecast", label: "Finanse / Prognoza", icon: TrendingUp },
      { href: "/calendar", label: "Kalendarz", icon: CalendarDays },
    ],
  },
  {
    title: "REZERWACJE",
    items: [
      { href: "/reservations", label: "Rezerwacje", icon: ClipboardList },
      { href: "/arrivals", label: "Przyjazdy", icon: Plane },
    ],
  },
  {
    title: "FINANSE",
    items: [
      { href: "/income-rent", label: "Przychody Najem", icon: Wallet },
      { href: "/income-subrent", label: "Przychody Podnajem", icon: HandCoins },
      { href: "/forecast", label: "Prognoza", icon: BarChart3 },
      { href: "/costs-apartments", label: "Koszty (Apartamenty)", icon: Building2 },
      { href: "/costs-expenses", label: "Koszty (Koszty)", icon: Receipt },
      { href: "/saldo-ml", label: "Saldo - M. Latasiewicz", icon: Scale },
      { href: "/saldo-jg", label: "Saldo - J. Głodkowska", icon: Coins },
    ],
  },
  {
    title: "UMOWY",
    items: [
      { href: "/contracts-rent", label: "Umowy Najmu", icon: FileText },
      { href: "/contracts-subrent", label: "Umowy Podnajmu", icon: FileSignature },
      { href: "/contracts-services", label: "Umowy (usługi)", icon: Briefcase },
      { href: "/contracts-other", label: "Umowy (inne)", icon: Files },
    ],
  },
  {
    title: "USTAWIENIA",
    items: [
      { href: "/import", label: "Import rezerwacji", icon: Upload },
      { href: "/export", label: "Eksport rezerwacji", icon: Download },
      { href: "/user-accounts", label: "Konta użytkowników", icon: Users },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

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
            {sections.map((section, sIdx) => (
              <div key={sIdx}>
                {sIdx > 0 && (
                  <div className="my-3 border-t border-white/10" />
                )}
                {section.title && (
                  <div className="px-3 pt-1 pb-2">
                    <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">{section.title}</span>
                  </div>
                )}
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Link key={item.href} href={item.href} data-testid={`link-nav-${item.href === "/" ? "home" : item.href.slice(1)}`}>
                      <div
                        onClick={() => setIsOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group",
                          isActive
                            ? "bg-primary text-white shadow-lg shadow-primary/25"
                            : "text-slate-400 hover:text-white hover:bg-white/10"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
                        <span className="font-medium text-xs truncate">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
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
