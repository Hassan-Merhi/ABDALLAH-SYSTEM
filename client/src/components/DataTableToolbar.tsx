import * as React from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ErpMobileFilters } from "@/components/ui/erp-mobile-filters";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DataTableToolbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchTestId?: string;
  /** Controlled filters supplied by the owning page. */
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  /** Reuse the existing mobile filter sheet for complex filter controls. */
  mobileFilters?: boolean;
  filterLabel?: string;
  activeFilterCount?: number;
  onResetFilters?: () => void;
  className?: string;
  "data-testid"?: string;
}

/**
 * Canonical list toolbar. Search stays visible on phones; advanced filters
 * open in the existing ERP bottom sheet. All state/queries belong to callers.
 */
export function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchTestId = "input-search",
  filters,
  actions,
  mobileFilters = false,
  filterLabel = "Table filters",
  activeFilterCount = 0,
  onResetFilters,
  className,
  "data-testid": testId,
}: DataTableToolbarProps) {
  const searchControl = onSearchChange ? (
    <div className="relative w-full min-w-0 sm:w-72 sm:max-w-full">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
      <Input
        type="search"
        value={search ?? ""}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label={searchPlaceholder}
        className="w-full pl-9 pr-9"
        data-testid={searchTestId}
      />
      {search ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => onSearchChange("")}
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          data-testid="button-clear-search"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  ) : null;

  const filterControls = filters ? (
    <div className="flex min-w-0 flex-wrap items-center gap-2">{filters}</div>
  ) : null;

  const left = mobileFilters && filters ? (
    <ErpMobileFilters
      label={filterLabel}
      quick={searchControl}
      activeCount={activeFilterCount}
      canClear={activeFilterCount > 0 || Boolean(search)}
      onClear={onResetFilters}
      data-testid={testId ? `${testId}-filters` : "table-filters"}
    >
      {(layout) => layout === "inline" ? (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {searchControl}
          {filterControls}
        </div>
      ) : filterControls}
    </ErpMobileFilters>
  ) : (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      {searchControl}
      {filterControls}
    </div>
  );

  return (
    <div
      className={cn("mb-4 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}
      data-testid={testId ?? "toolbar-data-table"}
    >
      {left}
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div> : null}
    </div>
  );
}
