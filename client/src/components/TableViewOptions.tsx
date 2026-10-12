import { Columns3, ListFilter } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TableDensity } from "@/hooks/use-table-prefs";

export interface TableColumnOption {
  key: string;
  label: string;
  /** Required columns cannot be hidden (e.g. the identifying name). */
  required?: boolean;
}

export interface TableViewOptionsProps {
  columns: readonly TableColumnOption[];
  visibility: Record<string, boolean>;
  onVisibilityChange: (key: string, visible: boolean) => void;
  density?: TableDensity;
  onDensityChange?: (value: TableDensity) => void;
  "data-testid"?: string;
}

/** Controlled column selector and density picker for all standard tables. */
export function TableViewOptions({
  columns,
  visibility,
  onVisibilityChange,
  density = "standard",
  onDensityChange,
  "data-testid": testId = "table-view-options",
}: TableViewOptionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2" data-testid={testId}>
          <Columns3 className="h-4 w-4" aria-hidden="true" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.key}
            checked={column.required || visibility[column.key] !== false}
            disabled={column.required}
            onCheckedChange={(checked) => onVisibilityChange(column.key, checked === true)}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
        {onDensityChange && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2">
              <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
              Row density
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={density} onValueChange={(value) => onDensityChange(value as TableDensity)}>
              {(["compact", "standard", "comfortable"] as const).map((value) => (
                <DropdownMenuRadioItem key={value} value={value}>
                  {value[0].toUpperCase() + value.slice(1)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
