import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Plane, RefreshCw } from "lucide-react";
import Reservations from "@/pages/Reservations";
import Arrivals from "@/pages/Arrivals";
import { usePullRefresh } from "@/hooks/use-pull-refresh";
import { useIsMobile } from "@/hooks/use-mobile";

const TABS = [
  { value: "rezerwacje", label: "Rezerwacje", icon: ClipboardList },
  { value: "przyjazdy", label: "Przyjazdy", icon: Plane },
];

export default function RezerwacjeAll() {
  const [activeTab, setActiveTab] = useState("rezerwacje");
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { pullY, isRefreshing: isPullRefreshing, handlers: pullHandlers } = usePullRefresh({
    onRefresh: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["/api/reservations"] }),
      qc.invalidateQueries({ queryKey: ["/api/arrivals"] }),
    ]).then(() => {}),
  });

  return (
    <div
      className="space-y-0"
      data-testid="page-rezerwacje-all"
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
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0" data-testid="tabs-rezerwacje">
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
          <TabsContent value="rezerwacje" className="mt-0">
            <Reservations />
          </TabsContent>
          <TabsContent value="przyjazdy" className="mt-0">
            <Arrivals />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
