import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HardHat, Shield, Users } from "lucide-react";
import FactoryWorkersHub from "@/pages/factory/FactoryWorkersHub";
import FactoryEmployeesHub from "@/pages/factory/FactoryEmployeesHub";
import FactoryInsurance from "@/pages/factory/FactoryInsurance";
import { useHubQueryState } from "@/hooks/use-hub-query-state";
import { useApplicationLanguage } from "@/contexts/ApplicationLanguageContext";
import { translateFactoryStaffTrackingText } from "@/i18n/factoryStaffTrackingTranslations";
import type { FactoryMyAccess } from "@shared/apiTypes";

type Section = "workers" | "employees" | "insurance";
const SECTIONS: Section[] = ["workers", "employees", "insurance"];
const HIDDEN_KEYS: Record<Section, string> = {
  workers: "hide_tab_payrollhub_workers",
  employees: "hide_tab_payrollhub_employees",
  insurance: "hide_tab_payrollhub_insurance",
};

export default function FactoryPayrollHub() {
  const { data: myAccess } = useQuery<FactoryMyAccess>({ queryKey: ["/api/factory/my-access"], staleTime: 5 * 60000 });
  const { language } = useApplicationLanguage();
  const tr = (key: Parameters<typeof translateFactoryStaffTrackingText>[0]) =>
    translateFactoryStaffTrackingText(key, language);
  const hidden = myAccess?.hiddenCostFields ?? [];

  const sections = SECTIONS.filter((section) => !hidden.includes(HIDDEN_KEYS[section]));
  const defaultSection: Section = sections[0] ?? "workers";
  const allowedSections: readonly Section[] = sections;

  const [activeSection, setActiveSection] = useHubQueryState<Section>({
    key: "section",
    allowedValues: allowedSections,
    knownValues: SECTIONS,
    defaultValue: defaultSection,
    clearKeys: ["tab", "mode"],
  });

  type TabDef = { key: Section; label: string; Icon: React.ElementType };
  const allTabs: TabDef[] = [
    { key: "workers", label: "Workers", Icon: HardHat },
    { key: "employees", label: "Employees", Icon: Users },
    { key: "insurance", label: "Insurance", Icon: Shield },
  ];
  const tabs = allTabs.filter((tab) => sections.includes(tab.key));

  return (
    <Tabs value={activeSection} onValueChange={(value) => setActiveSection(value as Section)} className="flex flex-col h-full overflow-hidden">
      <div className="border-b bg-background shrink-0">
        {/* Shared page-header grammar (accent bar, icon, subtitle) like the ERP and Properties pages. */}
        <div className="px-4 pt-3 [&>header]:mb-0 [&>header]:border-b-0 [&>header]:pb-2">
          <PageHeader
            title="Payroll & Benefits"
            subtitle={tr("hubDescription")}
            icon={<Users className="h-5 w-5" />}
            showBackButton={false}
          />
        </div>

        <TabsList variant="underline" className="w-full px-4" aria-label="Payroll and benefits sections">
          {tabs.map(({ key, label, Icon }) => (
            <TabsTrigger key={key} value={key} data-testid={`tab-people-${key}`}>
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      <TabsContent value={activeSection} className="flex-1 overflow-auto min-h-0 mt-0">
        {sections.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">
            No Payroll & Benefits tabs are available for this user.
          </div>
        )}
        {activeSection === "workers" && sections.includes("workers") && (
          <div className="p-4">
            <FactoryWorkersHub />
          </div>
        )}
        {activeSection === "employees" && sections.includes("employees") && (
          <div className="p-4">
            <FactoryEmployeesHub />
          </div>
        )}
        {activeSection === "insurance" && sections.includes("insurance") && <FactoryInsurance />}
      </TabsContent>
    </Tabs>
  );
}
