import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSignature, HandCoins, Gauge } from "lucide-react";
import Subleases from "@/pages/Subleases";
import SubrentSettlement from "@/pages/SubrentSettlement";
import MediaSettlement from "@/pages/MediaSettlement";

const TABS = [
  { value: "umowy", label: "Umowy", icon: FileSignature },
  { value: "rozliczenia", label: "Rozliczenia", icon: HandCoins },
  { value: "media", label: "Rozliczenie mediów", icon: Gauge },
];

export default function Podnajem() {
  const [activeTab, setActiveTab] = useState("umowy");

  return (
    <div className="space-y-0" data-testid="page-podnajem">
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0" data-testid="tabs-podnajem">
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
          <TabsContent value="umowy" className="mt-0">
            <Subleases />
          </TabsContent>
          <TabsContent value="rozliczenia" className="mt-0">
            <SubrentSettlement />
          </TabsContent>
          <TabsContent value="media" className="mt-0">
            <MediaSettlement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
