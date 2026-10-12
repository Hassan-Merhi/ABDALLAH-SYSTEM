import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FactoryContainerLoadingScan from "./FactoryContainerLoadingScan";
import FactoryPendingLoadings from "./FactoryPendingLoadings";
import FactoryPriorityScan from "./FactoryPriorityScan";
import { Truck } from "lucide-react";
import type { FactoryMyAccess } from "@shared/apiTypes";
import { useHubQueryState } from "@/hooks/use-hub-query-state";
import { useApplicationLanguage } from "@/contexts/ApplicationLanguageContext";
import { translatePriorityScanText } from "@/i18n/priorityScanTranslations";

type LoadingsTab = "loadings" | "pending" | "priority";
const ALL_LOADING_TABS: readonly LoadingsTab[] = ["loadings", "pending", "priority"];

export default function FactoryLoadingsHub() {
  const { language } = useApplicationLanguage();
  const priorityScanLabel = translatePriorityScanText("priorityScan", language);

  const { data: settings } = useQuery({
    queryKey: ["/api/factory/settings"],
    queryFn: async () => {
      const r = await fetch("/api/factory/settings");
      return r.ok ? r.json() : {};
    },
    staleTime: 60000,
  });

  const { data: myAccess } = useQuery<FactoryMyAccess>({
    queryKey: ["/api/factory/my-access"],
    staleTime: 5 * 60000,
  });
  const hiddenTabs = myAccess?.hiddenCostFields ?? [];

  const showLoadings = !hiddenTabs.includes("hide_invoicing_loadings_tab");
  const showPending =
    settings?.loadingsTabPendingEnabled !== false && !hiddenTabs.includes("hide_tab_loadings_pending");
  const showPriority = showLoadings && showPending;

  const visibleTabs: LoadingsTab[] = [
    ...(showLoadings ? (["loadings"] as const) : []),
    ...(showPending ? (["pending"] as const) : []),
    ...(showPriority ? (["priority"] as const) : []),
  ];
  const [effectiveActiveTab, setActiveTab] = useHubQueryState<LoadingsTab>({
    key: "tab",
    allowedValues: visibleTabs,
    knownValues: ALL_LOADING_TABS,
    defaultValue: visibleTabs[0] ?? "loadings",
  });

  function handleTabChange(value: LoadingsTab) {
    setActiveTab(value);
  }

  return (
    <Tabs
      value={effectiveActiveTab}
      onValueChange={(value) => handleTabChange(value as LoadingsTab)}
      className="flex flex-col h-full overflow-hidden"
    >
      <div className="border-b bg-background shrink-0">
        {/* Header row */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Truck className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">Loadings</h1>
            <p className="text-xs text-muted-foreground">
              {translatePriorityScanText("loadingsHubSubtitle", language)}
            </p>
          </div>
        </div>
        {/* Tab row */}
        <TabsList variant="underline" className="w-full px-4" aria-label="Loadings sections">
          {showLoadings && (
            <TabsTrigger value="loadings" data-testid="tab-container-loadings">
              Container Loadings
            </TabsTrigger>
          )}
          {showPending && (
            <TabsTrigger value="pending" data-testid="tab-pending-loadings">
              Pending Loadings
            </TabsTrigger>
          )}
          {showPriority && (
            <TabsTrigger value="priority" data-testid="tab-priority-scan">
              {priorityScanLabel}
            </TabsTrigger>
          )}
        </TabsList>
      </div>

      <TabsContent value={effectiveActiveTab} className="flex-1 overflow-auto min-h-0 mt-0">
        {!effectiveActiveTab && (
          <div className="p-6 text-sm text-muted-foreground">No Loadings tabs are available for this user.</div>
        )}
        {effectiveActiveTab === "loadings" && showLoadings && <FactoryContainerLoadingScan />}
        {effectiveActiveTab === "pending" && showPending && <FactoryPendingLoadings />}
        {effectiveActiveTab === "priority" && showPriority && <FactoryPriorityScan />}
      </TabsContent>
    </Tabs>
  );
}
