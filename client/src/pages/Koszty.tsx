import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Receipt } from "lucide-react";
import CostsApartments from "@/pages/CostsApartments";
import CostsExpenses from "@/pages/CostsExpenses";

const TABS = [
  { value: "apartamenty", label: "Koszty apartamentów", icon: Calculator },
  { value: "operacyjne", label: "Koszty operacyjne", icon: Receipt },
];

export default function Koszty() {
  const [activeTab, setActiveTab] = useState("apartamenty");

  return (
    <div className="space-y-0" data-testid="page-koszty">
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
