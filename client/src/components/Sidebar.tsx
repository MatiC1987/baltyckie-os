import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Building2, 
  CalendarDays, 
  FileText, 
  Wallet, 
  Upload, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", label: "Kokpit", icon: LayoutDashboard },
  { href: "/apartments", label: "Apartamenty", icon: Building2 },
  { href: "/reservations", label: "Rezerwacje", icon: CalendarDays },
  { href: "/leases", label: "Najem Długoterminowy", icon: FileText },
  { href: "/finance", label: "Finanse", icon: Wallet },
  { href: "/import", label: "Import", icon: Upload },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile Trigger */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b z-50 flex items-center px-4 justify-between">
        <span className="font-display font-bold text-xl text-primary">Bałtyckie Finanse</span>
        <Button variant="ghost" size="icon" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Sidebar Container */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-screen shadow-xl",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-6">
          <div className="mb-10 pt-2 flex items-center gap-3">
             <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
               <span className="font-bold text-white">BF</span>
             </div>
             <span className="font-display font-bold text-xl tracking-tight hidden lg:block">Bałtyckie</span>
          </div>

          <nav className="space-y-2 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;
              
              return (
                <Link key={item.href} href={item.href}>
                  <div className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer group",
                    isActive 
                      ? "bg-primary text-white shadow-lg shadow-primary/25" 
                      : "text-slate-400 hover:text-white hover:bg-white/10"
                  )}>
                    <Icon className={cn("h-5 w-5", isActive ? "text-white" : "text-slate-400 group-hover:text-white")} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="pt-6 border-t border-white/10">
            <div className="flex items-center gap-3 px-4 mb-4">
               {user?.profileImageUrl ? (
                 <img src={user.profileImageUrl} alt="Profile" className="h-8 w-8 rounded-full border border-white/10" />
               ) : (
                 <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                   {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                 </div>
               )}
               <div className="flex flex-col">
                 <span className="text-sm font-medium text-white">{user?.firstName}</span>
                 <span className="text-xs text-slate-400">Admin</span>
               </div>
            </div>
            
            <button 
              onClick={() => logout()}
              className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Wyloguj</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
