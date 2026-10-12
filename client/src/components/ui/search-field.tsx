import * as React from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchFieldProps
  extends Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange" | "defaultValue"> {
  value: string;
  onValueChange: (value: string) => void;
  /** Styles the outer search container instead of its input. */
  wrapperClassName?: string;
  /** Use false when the surrounding workflow has its own clear action. */
  showClear?: boolean;
  clearTestId?: string;
}

/**
 * One controlled search input for tables, side panels and lookup forms.
 * All query/debounce/selection behavior stays in the owner.
 */
export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      value,
      onValueChange,
      wrapperClassName,
      showClear = true,
      clearTestId = "button-clear-search",
      className,
      placeholder = "Search...",
      "aria-label": ariaLabel,
      ...props
    },
    ref,
  ) => (
    <div className={cn("relative min-w-0 w-full", wrapperClassName)}>
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        {...props}
        ref={ref}
        type="search"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        className={cn("w-full pl-9", showClear && "pr-9", className)}
      />
      {showClear && value.length > 0 ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          aria-label="Clear search"
          data-testid={clearTestId}
          onClick={() => onValueChange("")}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  ),
);
SearchField.displayName = "SearchField";
