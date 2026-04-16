import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnimatedTabContent } from "@/components/AnimatedTabContent";
import { FileText, FileSpreadsheet, Home } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { DokumentyKsiegowe, AirbnbInvoicesTab } from "@/pages/DokumentyKsiegowe";
import { Invoices } from "@/pages/Invoices";

const TABS = [
  { value: "dokumenty", label: "Dokumenty księgowe", icon: FileText },
  { value: "faktury", label: "Faktury", icon: FileSpreadsheet },
  { value: "airbnb", label: "AirBnb", icon: Home },
];

export default function DokumentyHub() {
  const [activeTab, setActiveTab] = useState(() => {
    const validTabs = TABS.map(t => t.value);
    const params = new URLSearchParams(window.location.search);
    const rawTab = params.get("tab") || "dokumenty";
    return validTabs.includes(rawTab) ? rawTab : "dokumenty";
  });

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === "dokumenty") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", activeTab);
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  return (
    <div className="space-y-0" data-testid="page-dokumenty-hub">
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-2">
        <PageHeader
          title="Dokumenty"
          description="Dokumenty księgowe, faktury sprzedaży i faktury AirBnb"
          icon={FileText}
        />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0" data-testid="tabs-dokumenty-hub">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                  data-testid={`tab-${tab.value}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <AnimatedTabContent value="dokumenty" activeValue={activeTab}>
            <DokumentyKsiegowe />
          </AnimatedTabContent>
          <AnimatedTabContent value="faktury" activeValue={activeTab}>
            <Invoices />
          </AnimatedTabContent>
          <AnimatedTabContent value="airbnb" activeValue={activeTab}>
            <AirbnbInvoicesTab />
          </AnimatedTabContent>
        </Tabs>
      </div>
    </div>
  );
}
