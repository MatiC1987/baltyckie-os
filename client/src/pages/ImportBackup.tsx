import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";
import { ArrowUpDown, Upload, DatabaseBackup } from "lucide-react";
import Import from "@/pages/Import";
import DataBackup from "@/pages/DataBackup";

const TABS = [
  { value: "import", label: "Import danych", icon: Upload },
  { value: "backup", label: "Backup i eksport", icon: DatabaseBackup },
];

export default function ImportBackup() {
  const [activeTab, setActiveTab] = useState("import");

  return (
    <div className="space-y-0" data-testid="page-import-backup">
      <div className="px-4 lg:px-6 pt-4 lg:pt-6 pb-2">
        <PageHeader title="Import i backup danych" description="Import rezerwacji, eksport danych i kopie zapasowe" icon={ArrowUpDown} />
      </div>
      <div className="px-4 lg:px-6 pb-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0" data-testid="tabs-import-backup">
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
          <TabsContent value="import" className="mt-0">
            <Import />
          </TabsContent>
          <TabsContent value="backup" className="mt-0">
            <DataBackup />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
