import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { LineChart as LineChartIcon, BarChart3, PieChart, ArrowUpDown, Thermometer, GitCompareArrows, BarChart } from "lucide-react";
import CashFlowForecast from "@/pages/CashFlowForecast";
import OccupancyRates from "@/pages/OccupancyRates";
import Profitability from "@/pages/Profitability";
import YearComparison from "@/pages/YearComparison";
import ApartmentComparison from "@/pages/ApartmentComparison";
import PriceSeasonality from "@/pages/PriceSeasonality";

const TABS = [
  { value: "cash-flow", label: "Przepływy pieniężne", icon: LineChartIcon },
  { value: "occupancy", label: "Obłożenie", icon: BarChart3 },
  { value: "profitability", label: "Rentowność", icon: PieChart },
  { value: "year-comparison", label: "Porównanie r/r", icon: ArrowUpDown },
  { value: "apartment-comparison", label: "Porównanie apartamentów", icon: GitCompareArrows },
  { value: "price-seasonality", label: "Sezonowość cen", icon: Thermometer },
];

export default function Analizy() {
  const [activeTab, setActiveTab] = useState("cash-flow");

  return (
    <div className="space-y-0" data-testid="page-analizy">
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-2">
        <PageHeader title="Analizy" description="Analiza danych finansowych i operacyjnych" icon={BarChart} />
      </div>
      <div className="px-4 lg:px-6 pb-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0" data-testid="tabs-analizy">
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
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          <TabsContent value="cash-flow" className="mt-4">
            <CashFlowForecast />
          </TabsContent>
          <TabsContent value="occupancy" className="mt-4">
            <OccupancyRates />
          </TabsContent>
          <TabsContent value="profitability" className="mt-4">
            <Profitability />
          </TabsContent>
          <TabsContent value="year-comparison" className="mt-4">
            <YearComparison />
          </TabsContent>
          <TabsContent value="apartment-comparison" className="mt-4">
            <ApartmentComparison />
          </TabsContent>
          <TabsContent value="price-seasonality" className="mt-4">
            <PriceSeasonality />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
