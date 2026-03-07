import {
  LayoutDashboard,
  TrendingUp,
  Calculator,
  Wallet,
  CalendarDays,
  ClipboardList,
  FileSignature,
  Users,
  Building2,
  Scale,
  Upload,
  FileText,
  Briefcase,
  Clock,
  UserCog,
  Gauge,
  BarChart3,
  ArrowUpDown,
  Thermometer,
  GitCompareArrows,
  Landmark,
  Gavel,
  type LucideIcon,
} from "lucide-react";

export interface BottomNavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  testId: string;
}

export interface BottomNavSection {
  id: string;
  matchPaths: string[];
  items: BottomNavItem[];
}

const defaultSection: BottomNavSection = {
  id: "default",
  matchPaths: ["/"],
  items: [
    { href: "/", icon: LayoutDashboard, label: "Pulpit", testId: "dashboard" },
    { href: "/v2/przychody", icon: TrendingUp, label: "Przychody", testId: "przychody" },
    { href: "/v2/koszty", icon: Calculator, label: "Koszty", testId: "koszty" },
    { href: "/saldo-firmowe", icon: Wallet, label: "Saldo", testId: "saldo" },
  ],
};

const rezerwacjeSection: BottomNavSection = {
  id: "rezerwacje",
  matchPaths: ["/reservations", "/calendar", "/customers", "/podnajem"],
  items: [
    { href: "/reservations", icon: ClipboardList, label: "Rezerwacje", testId: "reservations" },
    { href: "/calendar", icon: CalendarDays, label: "Terminarz", testId: "calendar" },
    { href: "/podnajem", icon: FileSignature, label: "Podnajem", testId: "podnajem" },
    { href: "/customers", icon: Users, label: "Klienci", testId: "customers" },
  ],
};

const nieruchomosciSection: BottomNavSection = {
  id: "nieruchomosci",
  matchPaths: ["/apartments", "/owners"],
  items: [
    { href: "/apartments", icon: Building2, label: "Apartamenty", testId: "apartments" },
    { href: "/owners", icon: Users, label: "Właściciele", testId: "owners" },
    { href: "/", icon: LayoutDashboard, label: "Pulpit", testId: "dashboard" },
    { href: "/reservations", icon: ClipboardList, label: "Rezerwacje", testId: "reservations" },
  ],
};

const finanseSection: BottomNavSection = {
  id: "finanse",
  matchPaths: ["/saldo-firmowe", "/v2/przychody", "/v2/koszty", "/salda", "/import-bankowy", "/dokumenty-ksiegowe", "/contracts-services", "/sprawy-sadowe"],
  items: [
    { href: "/v2/przychody", icon: TrendingUp, label: "Przychody", testId: "przychody" },
    { href: "/v2/koszty", icon: Calculator, label: "Koszty", testId: "koszty" },
    { href: "/saldo-firmowe", icon: Landmark, label: "Saldo", testId: "saldo-firmowe" },
    { href: "/dokumenty-ksiegowe", icon: FileText, label: "Dokumenty", testId: "dokumenty" },
  ],
};

const kadrySection: BottomNavSection = {
  id: "kadry",
  matchPaths: ["/rcp", "/pracownicy"],
  items: [
    { href: "/rcp/admin", icon: Clock, label: "RCP", testId: "rcp" },
    { href: "/pracownicy", icon: UserCog, label: "Pracownicy", testId: "pracownicy" },
    { href: "/", icon: LayoutDashboard, label: "Pulpit", testId: "dashboard" },
    { href: "/reservations", icon: ClipboardList, label: "Rezerwacje", testId: "reservations" },
  ],
};

const analitykaSection: BottomNavSection = {
  id: "analityka",
  matchPaths: ["/occupancy", "/profitability", "/year-comparison", "/apartment-comparison", "/price-seasonality", "/source-comparison"],
  items: [
    { href: "/occupancy", icon: Gauge, label: "Obłożenie", testId: "occupancy" },
    { href: "/profitability", icon: TrendingUp, label: "Rentowność", testId: "profitability" },
    { href: "/year-comparison", icon: BarChart3, label: "Porównanie", testId: "year-comparison" },
    { href: "/source-comparison", icon: GitCompareArrows, label: "Źródła", testId: "source-comparison" },
  ],
};

export const BOTTOM_NAV_SECTIONS: BottomNavSection[] = [
  rezerwacjeSection,
  nieruchomosciSection,
  finanseSection,
  kadrySection,
  analitykaSection,
  defaultSection,
];

export function getBottomNavForPath(path: string): BottomNavItem[] {
  for (const section of BOTTOM_NAV_SECTIONS) {
    if (section.id === "default") continue;
    if (section.matchPaths.some((p) => path === p || path.startsWith(p + "/"))) {
      return section.items;
    }
  }
  return defaultSection.items;
}
