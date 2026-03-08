import { useLocation } from "wouter";
import { ChevronRight, ChevronLeft, ChevronRight as Forward, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";

const ROUTE_LABELS: Record<string, { label: string; parent?: string }> = {
  "/": { label: "Pulpit" },
  "/calendar": { label: "Terminarz", parent: "/" },
  "/reservations": { label: "Rezerwacje", parent: "/" },
  "/podnajem": { label: "Podnajem", parent: "/" },
  "/analizy": { label: "Analizy", parent: "/" },
  "/finance-forecast": { label: "Prognoza finansowa", parent: "/" },
  "/revenue": { label: "Przychody", parent: "/" },
  "/koszty-apartamentowe": { label: "Koszty apartamentów", parent: "/" },
  "/koszty-operacyjne": { label: "Koszty operacyjne", parent: "/" },
  "/apartment-schedule": { label: "Harmonogram", parent: "/" },
  "/salda": { label: "Salda", parent: "/" },
  "/invoices": { label: "Faktury", parent: "/" },
  "/dokumenty-ksiegowe": { label: "Dokumenty księgowe", parent: "/" },
  "/contracts-services": { label: "Umowy", parent: "/" },
  "/przeglady": { label: "Przeglądy techniczne", parent: "/" },
  "/finance": { label: "Finanse", parent: "/" },
  "/apartments": { label: "Apartamenty", parent: "/" },
  "/owners": { label: "Właściciele", parent: "/" },
  "/employees": { label: "Pracownicy", parent: "/" },
  "/pracownicy": { label: "Pracownicy", parent: "/" },
  "/locations": { label: "Lokalizacje", parent: "/" },
  "/document-templates": { label: "Szablony dokumentów", parent: "/" },
  "/user-accounts": { label: "Konta użytkowników", parent: "/" },
  "/company-settings": { label: "Dane firmowe", parent: "/" },
  "/reports": { label: "Raporty", parent: "/" },
  "/import-export": { label: "Import / Eksport", parent: "/" },
  "/import-bankowy": { label: "Import bankowy", parent: "/" },
  "/activity-log": { label: "Dziennik aktywności", parent: "/" },
  "/ustawienia": { label: "Ustawienia", parent: "/" },
  "/ustawienia-menu": { label: "Menu ustawień", parent: "/" },
  "/customers": { label: "Klienci", parent: "/" },
  "/saldo-firmowe": { label: "Saldo firmowe", parent: "/" },
  "/v2/przychody": { label: "Przychody", parent: "/" },
  "/v2/koszty": { label: "Koszty", parent: "/" },
  "/v2/prognoza": { label: "Prognoza finansowa", parent: "/" },
  "/v2/realizacja": { label: "Realizacja", parent: "/" },
  "/bank-connections": { label: "Połączenia bankowe", parent: "/import-bankowy" },
  "/sprawy-sadowe": { label: "Sprawy sądowe", parent: "/" },
  "/rcp/admin": { label: "RCP Admin", parent: "/" },
  "/rcp/employee": { label: "RCP Pracownik", parent: "/" },
  "/occupancy": { label: "Obłożenie", parent: "/" },
  "/profitability": { label: "Rentowność", parent: "/" },
  "/year-comparison": { label: "Porównanie rok do roku", parent: "/" },
  "/apartment-comparison": { label: "Porównanie apartamentów", parent: "/" },
  "/price-seasonality": { label: "Sezonowość cen", parent: "/" },
  "/source-comparison": { label: "Porównanie źródeł", parent: "/" },
  "/roi-analysis": { label: "Analiza ROI", parent: "/" },
  "/sublease-dashboard": { label: "Dashboard podnajmu", parent: "/podnajem" },
};

function buildBreadcrumbs(path: string): Array<{ label: string; href: string }> {
  const crumbs: Array<{ label: string; href: string }> = [];
  let current: string | undefined = path;

  while (current) {
    const route = ROUTE_LABELS[current];
    if (route) {
      crumbs.unshift({ label: route.label, href: current });
      current = route.parent;
    } else {
      crumbs.unshift({ label: current.replace(/^\//, "").replace(/-/g, " ") || "Pulpit", href: current });
      break;
    }
  }

  return crumbs;
}

const HISTORY_KEY = "breadcrumb_history";
const MAX_HISTORY = 50;

export function Breadcrumbs() {
  const [location, setLocation] = useLocation();
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const navigatingRef = useRef(false);

  useEffect(() => {
    if (navigatingRef.current) {
      navigatingRef.current = false;
      return;
    }
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, location].slice(-MAX_HISTORY);
      return next;
    });
    setHistoryIndex(prev => {
      const trimmed = history.slice(0, prev + 1);
      return Math.min(trimmed.length, MAX_HISTORY - 1);
    });
  }, [location]);

  useEffect(() => {
    setHistoryIndex(history.length - 1);
  }, [history.length]);

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < history.length - 1;

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    navigatingRef.current = true;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    setLocation(history[newIdx]);
  }, [canGoBack, historyIndex, history, setLocation]);

  const goForward = useCallback(() => {
    if (!canGoForward) return;
    navigatingRef.current = true;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    setLocation(history[newIdx]);
  }, [canGoForward, historyIndex, history, setLocation]);

  const crumbs = buildBreadcrumbs(location);

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground mb-4 animate-fade-in" data-testid="breadcrumbs">
      <div className="flex items-center gap-0.5 mr-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={goBack}
          disabled={!canGoBack}
          data-testid="breadcrumb-back"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg"
          onClick={goForward}
          disabled={!canGoForward}
          data-testid="breadcrumb-forward"
        >
          <Forward className="h-4 w-4" />
        </Button>
      </div>

      {crumbs.map((crumb, idx) => (
        <span key={crumb.href} className="flex items-center gap-1">
          {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
          {idx === 0 && <Home className="h-3.5 w-3.5 mr-0.5" />}
          {idx === crumbs.length - 1 ? (
            <span className="font-medium text-foreground" data-testid={`breadcrumb-current`}>
              {crumb.label}
            </span>
          ) : (
            <button
              onClick={() => setLocation(crumb.href)}
              className="hover:text-foreground transition-colors cursor-pointer"
              data-testid={`breadcrumb-link-${idx}`}
            >
              {crumb.label}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}
