import type { Reservation } from "@shared/schema";

export type WidgetDef = {
  id: string;
  label: string;
  category: "financial" | "operational" | "admin";
  defaultVisible: boolean;
  description: string;
};

export const WIDGET_REGISTRY: WidgetDef[] = [
  { id: "kpi", label: "Wskaźniki KPI", category: "financial", defaultVisible: true, description: "Przychód, rezerwacje, nieopłacone, saldo" },
  { id: "today-reservations", label: "Rezerwacje dzisiaj", category: "operational", defaultVisible: true, description: "Suma rezerwacji dodanych dziś wg miesiąca + brakująca kwota/dzień" },
  { id: "balance", label: "Saldo firmowe", category: "financial", defaultVisible: true, description: "Salda kont bankowych" },
  { id: "forecast", label: "Prognoza przychodów", category: "financial", defaultVisible: true, description: "Realizacja prognozy miesięcznej" },
  { id: "balance-forecast-chart", label: "Saldo firmowe — prognoza", category: "financial", defaultVisible: true, description: "Wykres salda firmowego na 36 miesięcy" },
  { id: "unpaid-subleases", label: "Nieopłacone podnajmy", category: "financial", defaultVisible: true, description: "Zaległe płatności podnajmu" },
  { id: "quick-actions", label: "Szybkie akcje", category: "operational", defaultVisible: true, description: "Skróty do tworzenia rezerwacji, wydatków" },
  { id: "unpaid-arrivals", label: "Nieopłacone przyjazdy", category: "operational", defaultVisible: true, description: "Zakończone rezerwacje z dopłatą" },
  { id: "upcoming-arrivals", label: "Najbliższe przyjazdy", category: "operational", defaultVisible: true, description: "Rezerwacje w ciągu 7 dni" },
  { id: "upcoming-departures", label: "Najbliższe wyjazdy", category: "operational", defaultVisible: true, description: "Wyjazdy w ciągu 7 dni" },
  { id: "expiring-leases", label: "Kończące się umowy", category: "admin", defaultVisible: true, description: "Umowy najmu kończące się w 6 miesięcy" },
  { id: "rcp-summary", label: "RCP — Pracownicy", category: "operational", defaultVisible: true, description: "Obecność i godziny pracowników" },
  { id: "recent-activity", label: "Ostatnia aktywność", category: "operational", defaultVisible: true, description: "Feed ostatnich zdarzeń w systemie" },
  { id: "hr-summary", label: "Kadry — podsumowanie", category: "admin", defaultVisible: true, description: "Alerty kadrowe: umowy, badania, szkolenia" },
];

const PREFS_KEY = "dashboard-widget-prefs";

export type WidgetPrefs = {
  visible: Record<string, boolean>;
  order: string[];
};

export function getDefaultPrefs(): WidgetPrefs {
  return {
    visible: Object.fromEntries(WIDGET_REGISTRY.map(w => [w.id, w.defaultVisible])),
    order: WIDGET_REGISTRY.map(w => w.id),
  };
}

export function loadWidgetPrefs(): WidgetPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const defaults = getDefaultPrefs();
      const order = [...parsed.order || []];
      for (const w of WIDGET_REGISTRY) {
        if (!order.includes(w.id)) order.push(w.id);
      }
      return {
        visible: { ...defaults.visible, ...(parsed.visible || {}) },
        order: order.filter(id => WIDGET_REGISTRY.some(w => w.id === id)),
      };
    }
  } catch {}
  return getDefaultPrefs();
}

export function saveWidgetPrefs(prefs: WidgetPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export type CompanyBalanceAccount = {
  id: number;
  name: string;
  type: string | null;
  category: string | null;
  balanceSource: string | null;
  latestBalance: string;
};

export type CompanyBalance = {
  accounts: CompanyBalanceAccount[];
  totalBalance: string;
};

export type SubleasePaymentExtended = {
  id: number;
  subleaseId: number;
  title: string;
  amount: string;
  dueDate: string;
  status: string;
  apartmentId?: number | null;
  subleaseTenantName: string;
  subleaseApartmentIds: number[];
};

export type SortField = "reservationNumber" | "addDate" | "apartmentName" | "startDate" | "endDate" | "guestName" | "price" | "prepayment" | "paidAmount" | "remaining" | "status";
export type SortDir = "asc" | "desc";

export type DashboardReminders = {
  expiringExams: { id: number; examName: string; validUntil: string; employeeName: string }[];
  overdueCosts: number;
  overdueSubleasePayments: number;
  upcomingArrivals: number;
  expiringLeases: { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null }[];
  expiringSubleases: { id: number; tenantName: string | null; endDate: string | null; apartmentId: number | null }[];
  upcomingInspections?: { id: number; inspectionType: string; nextDate: string; apartmentId: number | null; isOverdue: boolean }[];
};

export function getApartmentName(reservation: Reservation, apartments: any[]): string {
  if (!reservation.apartmentId) return "—";
  const apt = apartments.find((a: any) => a.id === reservation.apartmentId);
  return apt?.name || "—";
}

export function calcRemaining(r: Reservation): number {
  const price = Number(r.price) || 0;
  const prepayment = Number(r.prepayment) || 0;
  const paid = Number(r.paidAmount) || 0;
  return Math.max(0, price - prepayment - paid);
}

export function statusLabel(status: string): string {
  switch (status) {
    case "DO_OPLACENIA": return "DO OPŁACENIA";
    case "PRZYJETA": return "PRZYJĘTA";
    case "ANULOWANA": return "ANULOWANA";
    default: return status;
  }
}

export function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "PRZYJETA": return "default";
    case "ANULOWANA": return "destructive";
    case "DO_OPLACENIA": return "secondary";
    default: return "outline";
  }
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "Dobrej nocy";
  if (hour < 12) return "Dzień dobry";
  if (hour < 18) return "Dzień dobry";
  return "Dobry wieczór";
}
