import type { LucideIcon } from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import { useLocation } from "wouter";

type SectionTheme = {
  iconBg: string;
  iconText: string;
  gradientFrom: string;
  gradientTo: string;
};

const SECTION_THEMES: Record<string, SectionTheme> = {
  rezerwacje: {
    iconBg: "bg-cyan-500/10 dark:bg-cyan-400/10",
    iconText: "text-cyan-600 dark:text-cyan-400",
    gradientFrom: "from-cyan-500/60",
    gradientTo: "to-cyan-300/0",
  },
  finanse: {
    iconBg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    iconText: "text-emerald-600 dark:text-emerald-400",
    gradientFrom: "from-emerald-500/60",
    gradientTo: "to-emerald-300/0",
  },
  kadry: {
    iconBg: "bg-violet-500/10 dark:bg-violet-400/10",
    iconText: "text-violet-600 dark:text-violet-400",
    gradientFrom: "from-violet-500/60",
    gradientTo: "to-violet-300/0",
  },
  dokumenty: {
    iconBg: "bg-blue-500/10 dark:bg-blue-400/10",
    iconText: "text-blue-600 dark:text-blue-400",
    gradientFrom: "from-blue-500/60",
    gradientTo: "to-blue-300/0",
  },
  nieruchomosci: {
    iconBg: "bg-orange-500/10 dark:bg-orange-400/10",
    iconText: "text-orange-600 dark:text-orange-400",
    gradientFrom: "from-orange-500/60",
    gradientTo: "to-orange-300/0",
  },
  analityka: {
    iconBg: "bg-blue-500/10 dark:bg-blue-400/10",
    iconText: "text-blue-600 dark:text-blue-400",
    gradientFrom: "from-blue-500/60",
    gradientTo: "to-blue-300/0",
  },
  administracja: {
    iconBg: "bg-amber-500/10 dark:bg-amber-400/10",
    iconText: "text-amber-600 dark:text-amber-400",
    gradientFrom: "from-amber-500/60",
    gradientTo: "to-amber-300/0",
  },
};

const DEFAULT_THEME: SectionTheme = {
  iconBg: "bg-primary/10",
  iconText: "text-primary",
  gradientFrom: "from-primary/50",
  gradientTo: "to-primary/0",
};

const ROUTE_SECTION_MAP: Record<string, string> = {
  "/calendar": "rezerwacje",
  "/reservations": "rezerwacje",
  "/customers": "rezerwacje",
  "/podnajem": "rezerwacje",
  "/arrivals": "rezerwacje",
  "/rezerwacje-all": "rezerwacje",
  "/apartments": "rezerwacje",
  "/apartamenty": "nieruchomosci",
  "/owners": "nieruchomosci",
  "/lokalizacje": "nieruchomosci",
  "/saldo-firmowe": "finanse",
  "/v2/przychody": "finanse",
  "/v2/koszty": "finanse",
  "/salda": "finanse",
  "/import-bankowy": "finanse",
  "/finance": "finanse",
  "/invoices": "finanse",
  "/bank-connections": "finanse",
  "/bank-statement-import": "finanse",
  "/costs-expenses": "finanse",
  "/costs-apartments": "finanse",
  "/subrent-settlement": "finanse",
  "/media-settlement": "finanse",
  "/checkout-settlement": "finanse",
  "/sprawy-sadowe": "finanse",
  "/dokumenty-ksiegowe": "dokumenty",
  "/contracts-services": "dokumenty",
  "/document-templates": "dokumenty",
  "/dokumenty": "dokumenty",
  "/report-export": "dokumenty",
  "/rcp": "kadry",
  "/pracownicy": "kadry",
  "/employees": "kadry",
  "/time-admin": "kadry",
  "/time-clock": "kadry",
  "/rcp-statystyki": "kadry",
  "/umowy-pracownicze": "kadry",
  "/szkolenia": "kadry",
  "/lista-plac": "kadry",
  "/occupancy": "analityka",
  "/profitability": "analityka",
  "/year-comparison": "analityka",
  "/apartment-comparison": "analityka",
  "/price-seasonality": "analityka",
  "/source-comparison": "analityka",
  "/priority-revenue-forecast": "analityka",
  "/ustawienia": "administracja",
  "/user-accounts": "administracja",
  "/company-settings": "administracja",
  "/activity-log": "administracja",
  "/import-backup": "administracja",
  "/data-backup": "administracja",
};

function getSectionForRoute(location: string): string | undefined {
  if (ROUTE_SECTION_MAP[location]) return ROUTE_SECTION_MAP[location];
  for (const [route, section] of Object.entries(ROUTE_SECTION_MAP)) {
    if (location.startsWith(route + "/") || location.startsWith(route)) {
      return section;
    }
  }
  return undefined;
}

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  hideBreadcrumbs?: boolean;
  section?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, hideBreadcrumbs, section }: PageHeaderProps) {
  const [location] = useLocation();
  const showBreadcrumbs = !hideBreadcrumbs && location !== "/";

  const detectedSection = section || getSectionForRoute(location);
  const theme = detectedSection ? (SECTION_THEMES[detectedSection] || DEFAULT_THEME) : DEFAULT_THEME;

  return (
    <div className="space-y-2">
      {showBreadcrumbs && <Breadcrumbs />}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className={`hidden sm:flex h-10 w-10 items-center justify-center rounded-md shrink-0 ${theme.iconBg} ${theme.iconText}`} data-testid="icon-page-header">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" data-testid="text-page-title">{title}</h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5" data-testid="text-page-description">{description}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-wrap" data-testid="page-header-actions">
            {actions}
          </div>
        )}
      </div>
      <div className={`h-[3px] rounded-full bg-gradient-to-r ${theme.gradientFrom} ${theme.gradientTo} max-w-[120px]`} data-testid="page-header-accent-bar" />
    </div>
  );
}
