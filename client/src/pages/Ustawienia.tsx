import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";
import {
  Building2, Users, UserCog, MapPin, Briefcase, Files,
  FileText, FileDown, DatabaseBackup, History, ScrollText, Building, ArrowUpDown,
  Settings, Type
} from "lucide-react";

const FONT_SIZE_KEY = "globalFontSize";

const FONT_SIZES = [
  { value: 12, label: "Mała" },
  { value: 13, label: "Mniejsza" },
  { value: 14, label: "Średnia" },
  { value: 15, label: "Większa" },
  { value: 16, label: "Duża" },
  { value: 18, label: "Bardzo duża" },
];

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
  { href: "/contracts-services", label: "Umowy serwisowe", description: "Umowy z dostawcami usług", icon: Briefcase },
  { href: "/document-templates", label: "Szablony dokumentów", description: "Wzory umów i dokumentów", icon: Files },
  { href: "/user-accounts", label: "Konta użytkowników", description: "Zarządzanie dostępem do systemu", icon: ScrollText },
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

function GlobalFontSizeCard() {
  const [fontSize, setFontSize] = useState(() => {
    try {
      const stored = localStorage.getItem(FONT_SIZE_KEY);
      return stored ? Number(stored) : 14;
    } catch {
      return 14;
    }
  });

  const handleChange = (value: number[]) => {
    const v = value[0];
    setFontSize(v);
    localStorage.setItem(FONT_SIZE_KEY, String(v));
    document.documentElement.style.fontSize = `${v}px`;
  };

  const currentLabel = FONT_SIZES.find(f => f.value === fontSize)?.label || "Średnia";

  return (
    <Card data-testid="card-global-font-size">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
            <Type className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">Rozmiar czcionki</p>
            <p className="text-xs text-muted-foreground mt-0.5 mb-3">Zmiana rozmiaru tekstu w całej aplikacji</p>
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
                data-testid="slider-global-font-size"
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

export default function Ustawienia() {
  return (
    <div className="p-4 lg:p-6 space-y-6" data-testid="page-ustawienia">
      <PageHeader title="Ustawienia" description="Konfiguracja systemu, zarządzanie danymi i narzędzia" />
      
      <div className="space-y-3">
        <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase" data-testid="section-Wygląd">Wygląd</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <GlobalFontSizeCard />
        </div>
      </div>

      <SettingsGrid title="Zarządzanie" items={ZARZADZANIE_ITEMS} />
      <SettingsGrid title="Narzędzia" items={NARZEDZIA_ITEMS} />
    </div>
  );
}
