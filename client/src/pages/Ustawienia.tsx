import { lazy, Suspense, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { Slider } from "@/components/ui/slider";
import {
  Building2, Users, UserCog, MapPin, Briefcase, Files,
  FileText, FileDown, History, ScrollText, Building, ArrowUpDown,
  Type, Menu, ChevronDown, ChevronRight, PanelLeft, TrendingUp,
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

      <CollapsibleSection title="Personalizacja menu" icon={Menu} testId="toggle-menu-customization">
        <p className="text-sm text-muted-foreground">
          Dostosuj układ menu bocznego — zmieniaj kolejność sekcji strzałkami, przenoś strony między sekcjami, ukrywaj niepotrzebne elementy
        </p>
        <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Ładowanie...</div>}>
          <MenuCustomizationPanel />
        </Suspense>
      </CollapsibleSection>

      <SettingsGrid title="Zarządzanie" items={ZARZADZANIE_ITEMS} />
      <SettingsGrid title="Dane finansowe" items={FINANSE_ITEMS} />
      <SettingsGrid title="Narzędzia" items={NARZEDZIA_ITEMS} />
    </div>
  );
}
