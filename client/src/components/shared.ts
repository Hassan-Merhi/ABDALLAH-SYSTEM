/**
 * Shared UI primitives — canonical building blocks used across every module
 * (ERP/POS, Factory, Properties, Inventory, Accounting, Reporting,
 * internal-tools). Import from here to keep page-level imports tidy.
 *
 *   import {
 *     PageHeader, StatCard, DashboardCard, SectionCard,
 *     DataTableToolbar, EmptyState, LoadingSkeleton, StatusBadge,
 *     ConfirmDialog, QuickActionCard, ActivityTimeline, AlertPanel,
 *     PropertyCard, FactoryKpiCard, FinancialSummaryCard,
 *   } from "@/components/shared";
 */
export { PageHeader } from "./PageHeader";
export { KPICard } from "./KPICard";
export { StatCard, type StatCardProps, type StatTone } from "./StatCard";
export { DashboardCard, type DashboardCardProps } from "./DashboardCard";
export { SectionCard, type SectionCardProps } from "./SectionCard";
export { DataTableToolbar, type DataTableToolbarProps } from "./DataTableToolbar";
export { SearchField, type SearchFieldProps } from "./ui/search-field";
export { TableViewOptions, type TableColumnOption, type TableViewOptionsProps } from "./TableViewOptions";
export { PaginationBar, type PaginationBarProps } from "./PaginationBar";
export { useTablePrefs, type TablePrefs, type TableDensity } from "@/hooks/use-table-prefs";
export { useClientTablePagination } from "@/hooks/use-client-table-pagination";
export {
  PageShell,
  PageActions,
  FinancialReportHeader,
  financialNumberClassName,
  type PageShellProps,
  type PageShellLayout,
  type PageActionsProps,
} from "./ui/page-shell";
export {
  WorkspacePage,
  WorkspaceSection,
  WorkspaceSectionHeader,
  WorkspaceToolbar,
  WorkspaceToolbarGroup,
  WorkspaceActions,
  ResponsiveTableFrame,
  FormActionBar,
} from "./ui/workspace-layout";
export { PageState, LoadingState, EmptyState, ErrorState, SuccessState, type PageStateProps } from "./ui/page-state";
export { EmptyState as CompactEmptyState, type CompactEmptyStateProps } from "./ui/empty-state";
export { LoadingSkeleton, type LoadingSkeletonProps } from "./LoadingSkeleton";
export { StatusBadge, type StatusBadgeProps, type StatusKind } from "./StatusBadge";
export { ConfirmDialog, type ConfirmDialogProps, type ConfirmDialogTone } from "./ConfirmDialog";
export { FormSubmitButton, type FormSubmitButtonProps } from "./FormSubmitButton";
export { useSingleFlightAction } from "@/hooks/use-single-flight-action";
export { MoneyAmount, type MoneyAmountProps } from "./MoneyAmount";
export { DecimalInput, MoneyInput, type DecimalInputProps } from "./ui/decimal-input";
export { formatMoneyDisplay, formatMoneyNumber, type MoneyDisplayOptions } from "@/lib/moneyDisplay";
export { FormGrid, FormSection, FormSectionLegend } from "./ui/form";
export { QuickActionCard, type QuickActionCardProps } from "./QuickActionCard";
export { ActivityTimeline, type ActivityTimelineItem, type ActivityTimelineProps } from "./ActivityTimeline";
export { AlertPanel, type AlertPanelProps, type AlertTone } from "./AlertPanel";
export { PropertyCard, type PropertyCardProps } from "./PropertyCard";
export { FactoryKpiCard, type FactoryKpiCardProps } from "./FactoryKpiCard";
export { FinancialSummaryCard, type FinancialSummaryCardProps } from "./FinancialSummaryCard";
