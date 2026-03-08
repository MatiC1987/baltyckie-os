import { lazy, Suspense, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedTabContent } from "@/components/AnimatedTabContent";
import { PageHeader } from "@/components/PageHeader";
import { TablePageSkeleton } from "@/components/PageSkeleton";
import { Building2, MapPin, ClipboardCheck, AlertTriangle } from "lucide-react";

const Apartments = lazy(() => import("@/pages/Apartments"));
const Lokalizacje = lazy(() => import("@/pages/Lokalizacje"));
const TechnicalInspections = lazy(() => import("@/pages/TechnicalInspections"));
const Usterki = lazy(() => import("@/pages/Usterki"));

const TABS = [
  { value: "apartamenty", label: "Apartamenty", icon: Building2 },
  { value: "lokalizacje", label: "Lokalizacje", icon: MapPin },
  { value: "przeglady", label: "Przeglądy", icon: ClipboardCheck },
  { value: "usterki", label: "Usterki", icon: AlertTriangle },
] as const;

function getTabFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  if (tab && TABS.some(t => t.value === tab)) return tab;
  return "apartamenty";
}

export default function ApartamentyHub() {
  const [location, setLocation] = useLocation();
  const searchStr = typeof window !== "undefined" ? window.location.search : "";
  const [activeTab, setActiveTab] = useState(() => getTabFromSearch(searchStr));

  useEffect(() => {
    const tab = getTabFromSearch(window.location.search);
    setActiveTab(tab);
  }, [searchStr]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const newUrl = value === "apartamenty" ? "/apartments" : `/apartments?tab=${value}`;
    window.history.replaceState(null, "", newUrl);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nieruchomości"
        description="Zarządzanie apartamentami, lokalizacjami, przeglądami i usterkami."
        icon={Building2}
      />

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5" data-testid={`tab-${tab.value}`}>
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <AnimatedTabContent value="apartamenty" activeValue={activeTab} className="mt-4">
          <Suspense fallback={<TablePageSkeleton />}>
            <Apartments />
          </Suspense>
        </AnimatedTabContent>

        <AnimatedTabContent value="lokalizacje" activeValue={activeTab} className="mt-4">
          <Suspense fallback={<TablePageSkeleton />}>
            <Lokalizacje />
          </Suspense>
        </AnimatedTabContent>

        <AnimatedTabContent value="przeglady" activeValue={activeTab} className="mt-4">
          <Suspense fallback={<TablePageSkeleton />}>
            <TechnicalInspections />
          </Suspense>
        </AnimatedTabContent>

        <AnimatedTabContent value="usterki" activeValue={activeTab} className="mt-4">
          <Suspense fallback={<TablePageSkeleton />}>
            <Usterki />
          </Suspense>
        </AnimatedTabContent>
      </Tabs>
    </div>
  );
}
