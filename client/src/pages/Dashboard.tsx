import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/components/ui/page-state";
import {
  ArrowDownLeft,
  BarChart2,
  BookOpen,
  Boxes,
  ChevronDown,
  DollarSign,
  Factory,
  ReceiptText,
  Scale,
  TrendingUp,
  Zap,
} from "lucide-react";

import { DashboardFinancePanel } from "./dashboard/components/DashboardFinancePanel";
import { DashboardKPICard } from "./dashboard/components/DashboardKPICard";
import { FactoryProductionPanel } from "./dashboard/components/FactoryProductionPanel";
import { useDashboard } from "./dashboard/useDashboard";
import { getGreeting } from "./dashboard/utils";

export default function Dashboard() {
  const dashboard = useDashboard();
  const {
    selectedCompany,
    formatAmount,
    appMode,
    modePrefix,
    setLocation,
    isFactoryMode,
    isViewer,
    profitData,
    isLoading,
    isError,
    refetchProfit,
  } = dashboard;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Page header ── */}
      <PageHeader
        title={isFactoryMode ? "Factory Dashboard" : "Dashboard"}
        subtitle={isFactoryMode ? "Today's factory floor overview" : "Business performance at a glance"}
        showHomeButton={false}
      />

      {/* ── Net-profit error banner (non-fatal) ── */}
      {isError && (
        <ErrorState
          title="Some financial data is unavailable"
          description="Figures may be incomplete. Retry the financial summary without losing the rest of the dashboard."
          actionLabel="Retry financial data"
          onAction={() => void refetchProfit()}
          className="border-destructive/30"
        />
      )}

      {/* ── Greeting banner ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 -mt-2 px-0.5">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{getGreeting()}</span>
          {selectedCompany?.name ? ` · ${selectedCompany.name}` : ""}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {new Date().toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      {/* ── Quick Actions dropdown ── */}
      {!isViewer && <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" data-testid="button-quick-actions">
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Quick Actions
              <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {!isFactoryMode ? (
              <>
                <DropdownMenuItem
                  onClick={() => setLocation("/vouchers?type=payment")}
                  data-testid="quick-action-payment"
                >
                  <ReceiptText className="h-4 w-4 mr-2" />
                  New Payment
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation("/vouchers?type=receipt")}
                  data-testid="quick-action-receipt"
                >
                  <ArrowDownLeft className="h-4 w-4 mr-2" />
                  New Receipt
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation("/vouchers?type=journal")}
                  data-testid="quick-action-journal"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  New Journal
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation("/sales-report")} data-testid="quick-action-reports">
                  <BarChart2 className="h-4 w-4 mr-2" />
                  Sales Report
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation("/location-inventory")}
                  data-testid="quick-action-inventory"
                >
                  <Boxes className="h-4 w-4 mr-2" />
                  Inventory
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuItem
                  onClick={() => setLocation("/factory/press-bale")}
                  data-testid="quick-action-press-bale"
                >
                  <Factory className="h-4 w-4 mr-2" />
                  Press Bale
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setLocation("/factory/stock-adjustment")}
                  data-testid="quick-action-stock-adj"
                >
                  <Scale className="h-4 w-4 mr-2" />
                  Stock Adjustment
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation("/factory/location-inventory")}
                  data-testid="quick-action-factory-inventory"
                >
                  <Boxes className="h-4 w-4 mr-2" />
                  Inventory
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>}
      {/* ── Top KPI row ── */}
      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4",
          !isFactoryMode ? "lg:grid-cols-2" : "lg:grid-cols-2"
        )}
      >
        {!isFactoryMode && (
          <DashboardKPICard
            title="Total Income"
            value={isLoading ? "Loading..." : formatAmount(profitData?.totalIncome || 0)}
            change="All income accounts combined"
            changeType="positive"
            icon={DollarSign}
            stripeClass="bg-linear-to-r from-chart-2 via-chart-2/60 to-chart-2/20"
            iconBgClass="bg-chart-2/15"
            iconFgClass="text-chart-2"
            onClick={() => setLocation("/sales-report")}
            testId="kpi-total-income"
          />
        )}
        <DashboardKPICard
          title="Net Position"
          value={isLoading ? "Loading..." : formatAmount(profitData?.netPosition || 0)}
          change={profitData?.netPositionLabel || "What we have minus what we owe"}
          changeType={(profitData?.netPosition ?? 0) >= 0 ? "positive" : "negative"}
          icon={TrendingUp}
          stripeClass={
            (profitData?.netPosition ?? 0) >= 0
              ? "bg-linear-to-r from-chart-2 via-chart-2/60 to-chart-2/20"
              : "bg-linear-to-r from-destructive via-destructive/60 to-destructive/20"
          }
          iconBgClass={(profitData?.netPosition ?? 0) >= 0 ? "bg-chart-2/15" : "bg-destructive/15"}
          iconFgClass={(profitData?.netPosition ?? 0) >= 0 ? "text-chart-2" : "text-destructive"}
          onClick={() =>
            setLocation(
              modePrefix === ""
                ? "/net-position-details"
                : appMode === "properties"
                  ? "/properties/net-position-details"
                  : `${modePrefix}/net-position`
            )
          }
          testId="kpi-net-position"
        />
      </div>

      {/* ── Main content area: 2-col on XL ── */}
      <DashboardFinancePanel dashboard={dashboard} />

      <FactoryProductionPanel dashboard={dashboard} />
    </div>
  );
}
