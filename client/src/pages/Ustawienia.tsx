import { lazy, Suspense, useState, useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSidebar } from "@/contexts/SidebarContext";
import { serializeForServer } from "@/lib/sidebar-config";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Building2, Users, UserCog, MapPin, Briefcase, Files,
  FileText, FileDown, History, ScrollText, Building, ArrowUpDown,
  Type, Menu, ChevronDown, ChevronRight, PanelLeft, TrendingUp,
  Monitor, Shield, Bell, BellOff, BellRing, Loader2,
  Download, Upload, Mail, CalendarClock, CreditCard, FileCheck,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const MenuCustomizationPanel = lazy(() => import("@/components/MenuCustomizationPanel"));

const SIDEBAR_FONT_SIZE_KEY = "sidebarFontSize";
const PAGE_FONT_SIZE_KEY = "pageFontSize";
const LEGACY_FONT_SIZE_KEY = "globalFontSize";

const FONT_SIZES = [
  { value: 12, label: "Mała" },
  { value: 13, label: "Mniejsza" },
  { value: 14, label: "Średnia" },
  { value: 15, label: "Większa" },
  { value: 16, label: "Duża" },
  { value: 18, label: "Bardzo duża" },
];

function loadFontSize(key: string): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return Number(stored);
    const legacy = localStorage.getItem(LEGACY_FONT_SIZE_KEY);
    if (legacy) return Number(legacy);
  } catch {}
  return 14;
}

interface SettingsItem {
  href: string;
  label: string;
  description: string;
  icon: any;
}

const ZARZADZANIE_ITEMS: SettingsItem[] = [
  { href: "/apartments", label: "Apartamenty", description: "Zarządzanie apartamentami i ich parametrami", icon: Building2 },
  { href: "/owners", label: "Właściciele", description: "Lista właścicieli apartamentów", icon: Users },
  { href: "/employees", label: "Pracownicy", description: "Kadra i badania lekarskie", icon: UserCog },
  { href: "/locations", label: "Lokalizacje", description: "Kategorie lokalizacji apartamentów", icon: MapPin },
  { href: "/contracts-services", label: "Umowy", description: "Zarządzanie umowami", icon: Briefcase },
  { href: "/document-templates", label: "Szablony dokumentów", description: "Wzory umów i dokumentów", icon: Files },
  { href: "/user-accounts", label: "Konta użytkowników", description: "Zarządzanie dostępem do systemu", icon: ScrollText },
];

const FINANSE_ITEMS: SettingsItem[] = [
  { href: "/v2/prognoza-przychodow", label: "Prognoza przychodów", description: "Planowane przychody per apartament, miesięcznie i rocznie", icon: TrendingUp },
];

const NARZEDZIA_ITEMS: SettingsItem[] = [
  { href: "/company-settings", label: "Dane firmowe", description: "Nazwa, NIP, adres i logo firmy", icon: Building },
  { href: "/dokumenty-ksiegowe", label: "Dokumenty księgowe", description: "Faktury kosztowe i noty księgowe", icon: FileText },
  { href: "/reports", label: "Raporty PDF", description: "Generowanie raportów miesięcznych", icon: FileDown },
  { href: "/import-export", label: "Import i backup danych", description: "Import Excel, eksport danych, kopie zapasowe", icon: ArrowUpDown },
  { href: "/activity-log", label: "Historia zmian", description: "Dziennik aktywności użytkowników", icon: History },
];

function SettingsGrid({ title, items }: { title: string; items: SettingsItem[] }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase" data-testid={`section-${title}`}>{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="hover-elevate cursor-pointer h-full transition-all duration-200" data-testid={`card-settings-${item.href.slice(1)}`}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function FontSizeCard({ storageKey, title, description, icon: Icon, testId }: { storageKey: string; title: string; description: string; icon: any; testId: string }) {
  const [fontSize, setFontSize] = useState(() => loadFontSize(storageKey));

  const handleChange = (value: number[]) => {
    const v = value[0];
    setFontSize(v);
    localStorage.setItem(storageKey, String(v));
    window.dispatchEvent(new Event("fontSizeChanged"));
  };

  const currentLabel = FONT_SIZES.find(f => f.value === fontSize)?.label || "Średnia";

  return (
    <Card data-testid={testId}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">{description}</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">{currentLabel}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{fontSize}px</span>
              </div>
              <Slider
                min={12}
                max={18}
                step={1}
                value={[fontSize]}
                onValueChange={handleChange}
                data-testid={`slider-${testId}`}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Mała</span>
                <span>Średnia</span>
                <span>Duża</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CollapsibleSection({ title, icon: Icon, defaultOpen = false, children, testId }: { title: string; icon: any; defaultOpen?: boolean; children: React.ReactNode; testId: string }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="space-y-3">
      <button
        className="flex items-center gap-2 w-full text-left group"
        onClick={() => setIsOpen(!isOpen)}
        data-testid={testId}
      >
        {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{title}</h2>
      </button>
      {isOpen && children}
    </div>
  );
}

const RECEPCJA_NAV_SECTIONS = [
  {
    id: "main",
    label: "Główne",
    items: [
      { id: "dashboard", label: "Pulpit", path: "/recepcja/dashboard" },
      { id: "saldo", label: "Saldo", path: "/recepcja/saldo" },
    ],
  },
  {
    id: "podnajem",
    label: "Podnajem",
    items: [
      { id: "umowy", label: "Umowy", path: "/recepcja/podnajem/umowy" },
      { id: "rozliczenia", label: "Rozliczenia", path: "/recepcja/podnajem/rozliczenia" },
      { id: "nowy-najemca", label: "Nowi najemcy", path: "/recepcja/podnajem/nowy-najemca" },
      { id: "historia", label: "Historia zmian", path: "/recepcja/podnajem/historia" },
    ],
  },
  {
    id: "operacje",
    label: "Operacje",
    items: [
      { id: "liczniki", label: "Liczniki", path: "/recepcja/liczniki" },
      { id: "protokoly", label: "Protokoły", path: "/recepcja/protokoly" },
      { id: "dokumenty", label: "Dokumenty", path: "/recepcja/dokumenty" },
      { id: "przeglady", label: "Przeglądy", path: "/recepcja/przeglady" },
      { id: "usterki", label: "Usterki", path: "/recepcja/usterki" },
    ],
  },
  {
    id: "rezerwacje",
    label: "Rezerwacje",
    items: [
      { id: "terminarz", label: "Terminarz", path: "/recepcja/terminarz" },
      { id: "rezerwacje", label: "Rezerwacje", path: "/recepcja/rezerwacje" },
    ],
  },
  {
    id: "zarzadzanie",
    label: "Zarządzanie",
    items: [
      { id: "rcp", label: "RCP", path: "/recepcja/rcp" },
      { id: "kontakty", label: "Kontakty najemców", path: "/recepcja/kontakty" },
      { id: "zadania", label: "Zadania", path: "/recepcja/zadania" },
      { id: "raport-dzienny", label: "Raport dzienny", path: "/recepcja/raport-dzienny" },
    ],
  },
];

function RecepcjaSidebarConfig() {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<{ hiddenItems: string[] }>({
    queryKey: ["/api/recepcja-sidebar-config"],
  });

  const mutation = useMutation({
    mutationFn: async (hiddenItems: string[]) => {
      await apiRequest("PUT", "/api/recepcja-sidebar-config", { hiddenItems });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recepcja-sidebar-config"] });
      toast({ title: "Zapisano", description: "Konfiguracja menu recepcji została zaktualizowana" });
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się zapisać konfiguracji", variant: "destructive" });
    },
  });

  const hiddenItems = config?.hiddenItems || [];

  const toggleItem = (path: string) => {
    const next = hiddenItems.includes(path)
      ? hiddenItems.filter(p => p !== path)
      : [...hiddenItems, path];
    mutation.mutate(next);
  };

  if (isLoading) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Ładowanie konfiguracji...</div>;
  }

  return (
    <Card data-testid="card-recepcja-sidebar-config">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <Monitor className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm">Menu panelu Recepcja</p>
            <p className="text-xs text-muted-foreground mt-0.5">Włącz lub wyłącz pozycje widoczne w menu bocznym panelu recepcji</p>
          </div>
        </div>
        <div className="space-y-4">
          {RECEPCJA_NAV_SECTIONS.map(section => (
            <div key={section.id} data-testid={`section-recepcja-${section.id}`}>
              <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase mb-2">{section.label}</p>
              <div className="space-y-1">
                {section.items.map(item => {
                  const isVisible = !hiddenItems.includes(item.path);
                  return (
                    <div
                      key={item.path}
                      className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md"
                      data-testid={`toggle-recepcja-item-${item.id}`}
                    >
                      <span className={cn("text-sm", !isVisible && "text-muted-foreground")}>{item.label}</span>
                      <Switch
                        checked={isVisible}
                        onCheckedChange={() => toggleItem(item.path)}
                        disabled={mutation.isPending}
                        data-testid={`switch-recepcja-item-${item.id}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PushNotificationsCard() {
  const { status, error, subscribe, unsubscribe } = usePushNotifications("admin");

  const statusLabels: Record<string, { label: string; desc: string }> = {
    loading: { label: "Sprawdzanie...", desc: "Sprawdzanie stanu powiadomień push" },
    unsupported: { label: "Niedostępne", desc: "Twoja przeglądarka nie obsługuje powiadomień push" },
    denied: { label: "Zablokowane", desc: "Powiadomienia push zostały zablokowane w ustawieniach przeglądarki" },
    subscribed: { label: "Aktywne", desc: "Powiadomienia push są włączone na tym urządzeniu" },
    unsubscribed: { label: "Wyłączone", desc: "Włącz powiadomienia push, aby otrzymywać alerty o nowych zadaniach, płatnościach i umowach" },
    error: { label: "Błąd", desc: error || "Wystąpił błąd podczas konfiguracji powiadomień" },
  };

  const info = statusLabels[status] || statusLabels.error;
  const Icon = status === "subscribed" ? BellRing : status === "denied" ? BellOff : Bell;

  return (
    <Card data-testid="card-push-notifications">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-medium text-sm">Powiadomienia push</p>
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-md",
                status === "subscribed" && "bg-green-500/10 text-green-600 dark:text-green-400",
                status === "unsubscribed" && "bg-muted text-muted-foreground",
                status === "denied" && "bg-destructive/10 text-destructive",
                status === "unsupported" && "bg-muted text-muted-foreground",
                status === "error" && "bg-destructive/10 text-destructive",
                status === "loading" && "bg-muted text-muted-foreground",
              )} data-testid="text-push-status">
                {info.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">{info.desc}</p>
            {status === "unsubscribed" && (
              <Button onClick={subscribe} data-testid="button-push-subscribe" className="gap-2">
                <Bell className="h-4 w-4" />
                Włącz powiadomienia
              </Button>
            )}
            {status === "subscribed" && (
              <Button variant="outline" onClick={unsubscribe} data-testid="button-push-unsubscribe" className="gap-2">
                <BellOff className="h-4 w-4" />
                Wyłącz powiadomienia
              </Button>
            )}
            {status === "loading" && (
              <Button disabled data-testid="button-push-loading">
                <Loader2 className="h-4 w-4 animate-spin" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigExportImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const config: Record<string, string | null> = {};
      const keysToExport = [
        SIDEBAR_FONT_SIZE_KEY, PAGE_FONT_SIZE_KEY, LEGACY_FONT_SIZE_KEY,
        "theme", "sidebarCollapsed",
      ];
      for (const key of keysToExport) {
        config[key] = localStorage.getItem(key);
      }
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (key.startsWith("sidebar") || key.startsWith("menu") || key.startsWith("dismissed") || key.startsWith("widget")) {
          config[key] = localStorage.getItem(key);
        }
      }
      const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), config }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ustawienia-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Eksportowano", description: "Konfiguracja została pobrana jako plik JSON" });
    } catch {
      toast({ title: "Błąd", description: "Nie udało się wyeksportować konfiguracji", variant: "destructive" });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.config || typeof data.config !== "object") {
          toast({ title: "Błąd", description: "Nieprawidłowy format pliku konfiguracji", variant: "destructive" });
          return;
        }
        let imported = 0;
        for (const [key, value] of Object.entries(data.config)) {
          if (value !== null && value !== undefined) {
            localStorage.setItem(key, String(value));
            imported++;
          }
        }
        window.dispatchEvent(new Event("fontSizeChanged"));
        toast({ title: "Zaimportowano", description: `Przywrócono ${imported} ustawień. Odśwież stronę, aby zobaczyć wszystkie zmiany.` });
      } catch {
        toast({ title: "Błąd", description: "Nie udało się odczytać pliku konfiguracji", variant: "destructive" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Card data-testid="card-config-export-import">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <ArrowUpDown className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Eksport / import konfiguracji</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">Zapisz ustawienia wyglądu i menu do pliku lub przywróć z pliku</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={handleExport} data-testid="button-export-config" className="gap-2">
                <Download className="h-4 w-4" />
                Eksportuj
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
                data-testid="input-import-config"
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} data-testid="button-import-config" className="gap-2">
                <Upload className="h-4 w-4" />
                Importuj
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationConfigPanel() {
  const NOTIFICATION_CONFIG_KEY = "notificationConfig";

  const loadConfig = (): Record<string, boolean> => {
    try {
      const stored = localStorage.getItem(NOTIFICATION_CONFIG_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return {
      pushNewTask: true,
      pushPaymentOverdue: true,
      pushLeaseExpiring: true,
      pushMediaApproval: true,
      emailDailySummary: false,
      emailWeeklySummary: false,
      emailPaymentOverdue: true,
      emailLeaseExpiring: true,
    };
  };

  const [config, setConfig] = useState(loadConfig);

  const handleToggle = (key: string) => {
    const next = { ...config, [key]: !config[key] };
    setConfig(next);
    localStorage.setItem(NOTIFICATION_CONFIG_KEY, JSON.stringify(next));
  };

  const items = [
    { key: "pushNewTask", label: "Nowe zadania", icon: FileCheck, group: "push" },
    { key: "pushPaymentOverdue", label: "Zaległe płatności", icon: CreditCard, group: "push" },
    { key: "pushLeaseExpiring", label: "Kończące się umowy", icon: CalendarClock, group: "push" },
    { key: "pushMediaApproval", label: "Zatwierdzenie mediów", icon: FileText, group: "push" },
    { key: "emailDailySummary", label: "Podsumowanie dzienne", icon: Mail, group: "email" },
    { key: "emailWeeklySummary", label: "Podsumowanie tygodniowe", icon: Mail, group: "email" },
    { key: "emailPaymentOverdue", label: "Zaległe płatności", icon: CreditCard, group: "email" },
    { key: "emailLeaseExpiring", label: "Kończące się umowy", icon: CalendarClock, group: "email" },
  ];

  const pushItems = items.filter(i => i.group === "push");
  const emailItems = items.filter(i => i.group === "email");

  return (
    <Card data-testid="card-notification-config">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm">Konfiguracja powiadomień</p>
            <p className="text-xs text-muted-foreground mt-0.5">Wybierz, o jakich zdarzeniach chcesz być powiadamiany</p>
          </div>
        </div>

        <div data-testid="section-notification-push">
          <div className="flex items-center gap-2 mb-2">
            <BellRing className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Push</p>
          </div>
          <div className="space-y-1">
            {pushItems.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md" data-testid={`toggle-notif-${item.key}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={cn("text-sm", !config[item.key] && "text-muted-foreground")}>{item.label}</span>
                  </div>
                  <Switch checked={!!config[item.key]} onCheckedChange={() => handleToggle(item.key)} data-testid={`switch-notif-${item.key}`} />
                </div>
              );
            })}
          </div>
        </div>

        <div data-testid="section-notification-email">
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-bold tracking-wide text-muted-foreground uppercase">Email</p>
          </div>
          <div className="space-y-1">
            {emailItems.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-center justify-between gap-3 py-1.5 px-2 rounded-md" data-testid={`toggle-notif-${item.key}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className={cn("text-sm", !config[item.key] && "text-muted-foreground")}>{item.label}</span>
                  </div>
                  <Switch checked={!!config[item.key]} onCheckedChange={() => handleToggle(item.key)} data-testid={`switch-notif-${item.key}`} />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsHistoryCard() {
  const { data, isLoading } = useQuery<{ logs: Array<{ id: number; userName: string | null; action: string; entityName: string | null; details: string | null; createdAt: string }> }>({
    queryKey: ["/api/activity-logs", "settings"],
    queryFn: async () => {
      const res = await fetch("/api/activity-logs?entityType=settings&limit=20");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const logs = data?.logs || [];

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const actionLabels: Record<string, string> = {
    update: "Zaktualizowano",
    create: "Utworzono",
    delete: "Usunięto",
    import: "Zaimportowano",
    export: "Wyeksportowano",
  };

  return (
    <Card data-testid="card-settings-history">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm">Historia zmian ustawień</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ostatnie zmiany w konfiguracji systemu</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-settings-history">
            Brak historii zmian ustawień
          </div>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2 px-2 rounded-md" data-testid={`row-settings-history-${log.id}`}>
                <Clock className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">{actionLabels[log.action] || log.action}</Badge>
                    {log.entityName && <span className="text-xs font-medium">{log.entityName}</span>}
                  </div>
                  {log.details && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>}
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    <span>{formatDate(log.createdAt)}</span>
                    {log.userName && <span>{log.userName}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ForceMenuButton() {
  const { config } = useSidebar();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const forceMutation = useMutation({
    mutationFn: async () => {
      const sidebarLayout = serializeForServer(config);
      const res = await apiRequest("POST", "/api/force-menu-config", { sidebarLayout });
      return res.json();
    },
    onSuccess: (data: { success: boolean; updatedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      toast({ title: "Układ wymuszony", description: `Układ menu został nadpisany dla ${data.updatedCount} użytkowników.` });
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Błąd", description: "Nie udało się wymusić układu menu.", variant: "destructive" });
    },
  });

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="gap-2 border-amber-500/50 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10" data-testid="button-force-menu">
            <Shield className="h-4 w-4" />
            Wymuś aktualny układ dla wszystkich użytkowników
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wymuś układ menu</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz nadpisać układ menu u wszystkich użytkowników? Ta operacja zastąpi ich indywidualne ustawienia Twoim aktualnym układem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-force-menu-cancel">Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => forceMutation.mutate()} disabled={forceMutation.isPending} data-testid="button-force-menu-confirm">
              {forceMutation.isPending ? "Wymuszanie..." : "Tak, wymuś"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Ustawienia() {
  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="page-ustawienia">
      <PageHeader title="Ustawienia" description="Konfiguracja systemu, zarządzanie danymi i narzędzia" />
      
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase" data-testid="section-Wygląd">Wygląd</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FontSizeCard
            storageKey={PAGE_FONT_SIZE_KEY}
            title="Czcionka strony"
            description="Rozmiar tekstu na stronach aplikacji"
            icon={Type}
            testId="card-page-font-size"
          />
          <FontSizeCard
            storageKey={SIDEBAR_FONT_SIZE_KEY}
            title="Czcionka menu"
            description="Rozmiar tekstu w menu bocznym"
            icon={PanelLeft}
            testId="card-sidebar-font-size"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase" data-testid="section-Powiadomienia">Powiadomienia</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <PushNotificationsCard />
          <NotificationConfigPanel />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase" data-testid="section-Konfiguracja">Konfiguracja</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ConfigExportImport />
        </div>
      </div>

      <CollapsibleSection title="Personalizacja menu" icon={Menu} testId="toggle-menu-customization">
        <p className="text-sm text-muted-foreground">
          Dostosuj układ menu bocznego — zmieniaj kolejność sekcji strzałkami, przenoś strony między sekcjami, ukrywaj niepotrzebne elementy
        </p>
        <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Ładowanie...</div>}>
          <MenuCustomizationPanel />
        </Suspense>
        <ForceMenuButton />
      </CollapsibleSection>

      <CollapsibleSection title="Menu panelu Recepcja" icon={Monitor} testId="toggle-recepcja-menu-config">
        <p className="text-sm text-muted-foreground">
          Włącz lub wyłącz pozycje widoczne w menu bocznym panelu recepcji. Zmiany są zapisywane automatycznie.
        </p>
        <RecepcjaSidebarConfig />
      </CollapsibleSection>

      <SettingsGrid title="Zarządzanie" items={ZARZADZANIE_ITEMS} />
      <SettingsGrid title="Dane finansowe" items={FINANSE_ITEMS} />
      <SettingsGrid title="Narzędzia" items={NARZEDZIA_ITEMS} />

      <CollapsibleSection title="Historia zmian ustawień" icon={History} testId="toggle-settings-history">
        <SettingsHistoryCard />
      </CollapsibleSection>
    </div>
  );
}
