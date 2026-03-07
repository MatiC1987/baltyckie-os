import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Receipt, RefreshCw } from "lucide-react";
import CostsApartments from "@/pages/CostsApartments";
import CostsExpenses from "@/pages/CostsExpenses";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import { useIsMobile } from "@/hooks/use-mobile";

const TABS = [
  { value: "apartamenty", label: "Koszty apartamentów", icon: Calculator },
  { value: "operacyjne", label: "Koszty operacyjne", icon: Receipt },
];

export default function Koszty() {
  const [activeTab, setActiveTab] = useState("apartamenty");
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { pullY, isRefreshing: isPullRefreshing, handlers: pullHandlers } = usePullRefresh({
    onRefresh: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["/api/costs-apartments"] }),
      qc.invalidateQueries({ queryKey: ["/api/expenses"] }),
    ]).then(() => {}),
  });

  return (
    <div
      className="space-y-0"
      data-testid="page-koszty"
      onTouchStart={isMobile ? pullHandlers.onTouchStart : undefined}
      onTouchMove={isMobile ? pullHandlers.onTouchMove : undefined}
      onTouchEnd={isMobile ? pullHandlers.onTouchEnd : undefined}
    >
      {isMobile && (pullY > 0 || isPullRefreshing) && (
        <div className="flex items-center justify-center transition-all" style={{ height: isPullRefreshing ? 48 : pullY }}>
          <RefreshCw className={`h-5 w-5 text-muted-foreground ${isPullRefreshing ? 'animate-spin' : ''}`} style={{ transform: `rotate(${pullY * 3}deg)` }} />
        </div>
      )}
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0" data-testid="tabs-koszty">
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
          <TabsContent value="apartamenty" className="mt-0">
            <CostsApartments />
          </TabsContent>
          <TabsContent value="operacyjne" className="mt-0">
            <CostsExpenses />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
