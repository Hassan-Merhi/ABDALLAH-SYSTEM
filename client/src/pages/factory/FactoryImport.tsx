import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, Package, Boxes } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import type { ImportTab } from "./factoryimport/types";
import { SupplierImport } from "./factoryimport/components/SupplierImport";
import { RawStockImport } from "./factoryimport/components/RawStockImport";
import { BaleImport } from "./factoryimport/components/BaleImport";
import { OpeningStockImport } from "./factoryimport/components/OpeningStockImport";
import { SupplierObEdit } from "./factoryimport/components/SupplierObEdit";
import type { FactoryMyAccess } from "@shared/apiTypes";

const IMPORT_TABS: { key: ImportTab; label: string; icon: typeof Users; hiddenKey: string }[] = [
  { key: "suppliers", label: "Supplier Balances", icon: Users, hiddenKey: "hide_tab_import_suppliers" },
  { key: "raw-stock", label: "Raw Stock", icon: Package, hiddenKey: "hide_tab_import_raw_stock" },
  { key: "bales", label: "Bales Inventory", icon: Boxes, hiddenKey: "hide_tab_import_bales" },
  { key: "opening-stock", label: "Opening Raw Stock", icon: Package, hiddenKey: "hide_tab_import_opening_stock" },
  { key: "ob-edit", label: "Edit Opening Balance", icon: Users, hiddenKey: "hide_tab_import_ob_edit" },
];

export default function FactoryImport() {
  const [requestedTab, setRequestedTab] = useState<ImportTab>("suppliers");
  const { data: myAccess } = useQuery<FactoryMyAccess>({
    queryKey: ["/api/factory/my-access"],
    staleTime: 5 * 60000,
  });
  const hiddenTabs = myAccess?.hiddenCostFields ?? [];
  const tabs = IMPORT_TABS.filter((tab) => !hiddenTabs.includes(tab.hiddenKey));
  const activeTab = tabs.some((tab) => tab.key === requestedTab) ? requestedTab : tabs[0]?.key;

  useEffect(() => {
    if (activeTab && requestedTab !== activeTab) setRequestedTab(activeTab);
  }, [activeTab, requestedTab]);

  if (!activeTab) {
    return <div className="p-6 text-sm text-muted-foreground">No Import tabs are available for this user.</div>;
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setRequestedTab(value as ImportTab)}
      className="min-w-0 space-y-4"
      data-testid="factory-import-page"
    >
      <TabsList
        variant="pill"
        className="w-max max-w-full"
        data-testid="factory-import-tabs"
        aria-label="Import sections"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger key={tab.key} value={tab.key} data-testid={`tab-import-${tab.key}`}>
              <Icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      <TabsContent value={activeTab} className="mt-0 min-w-0">
        {activeTab === "suppliers" && <SupplierImport />}
        {activeTab === "raw-stock" && <RawStockImport />}
        {activeTab === "bales" && <BaleImport />}
        {activeTab === "opening-stock" && <OpeningStockImport />}
        {activeTab === "ob-edit" && <SupplierObEdit />}
      </TabsContent>
    </Tabs>
  );
}
