import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { Wallet, TrendingUp } from "lucide-react";
import V2Przychody from "@/pages/V2Przychody";
import PriorityRevenueForecast from "@/pages/PriorityRevenueForecast";

const TABS = [
  { value: "przychody", label: "Przychody", icon: Wallet },
  { value: "prognoza", label: "Prognoza", icon: TrendingUp },
];

export default function PrzychodyHub() {
  const validTabs = TABS.map(t => t.value);
  const params = new URLSearchParams(window.location.search);
  const rawTab = params.get("tab") || "przychody";
  const initialTab = validTabs.includes(rawTab) ? rawTab : "przychody";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === "przychody") {
      url.searchParams.delete("tab");
    } else {
      url.searchParams.set("tab", activeTab);
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);

  return (
    <div className="space-y-0" data-testid="page-przychody-hub">
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-2">
        <PageHeader title="Przychody" icon={Wallet} description="Przychody i prognoza przychodów" />
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full mt-4">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0" data-testid="tabs-przychody">
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
          <TabsContent value="przychody" className="mt-0">
            <V2Przychody />
          </TabsContent>
          <TabsContent value="prognoza" className="mt-0">
            <PriorityRevenueForecast />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
