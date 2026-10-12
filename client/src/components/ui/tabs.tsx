import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * One tab interaction and presentation contract across ERP, Factory, POS,
 * Properties, and Supplier Partner. Controlled tabs preserve the caller's
 * route/query state. Uncontrolled tabs preserve defaultValue semantics.
 */
export type TabsVariant = "pill" | "underline";

type TabsContextValue = {
  value: string | undefined;
  onValueChange: (value: string) => void;
  baseId: string;
};
const TabsContext = React.createContext<TabsContextValue | null>(null);
const TabsAppearanceContext = React.createContext<TabsVariant>("pill");

function useTabsContext(component: string): TabsContextValue {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error(`${component} must be inside <Tabs>`);
  return context;
}

function tabId(baseId: string, value: string) {
  return `${baseId}-tab-${encodeURIComponent(value)}`;
}
function panelId(baseId: string, value: string) {
  return `${baseId}-panel-${encodeURIComponent(value)}`;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

function Tabs({ value: controlledValue, defaultValue, onValueChange, className, children, ...props }: TabsProps) {
  const baseId = React.useId();
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);
  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;
  const handleChange = React.useCallback(
    (next: string) => {
      if (next === activeValue) return;
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [activeValue, isControlled, onValueChange]
  );
  const context = React.useMemo(
    () => ({ value: activeValue, onValueChange: handleChange, baseId }),
    [activeValue, handleChange, baseId]
  );
  return (
    <TabsContext.Provider value={context}>
      <div className={cn("min-w-0", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: TabsVariant;
  /** Horizontal tab strips scroll on narrow screens instead of clipping. */
  orientation?: "horizontal" | "vertical";
  activationMode?: "automatic" | "manual";
}

/** Moves focus through visible, enabled tabs and supports Home/End and RTL. */
function handleListKeyDown(event: React.KeyboardEvent<HTMLDivElement>, activationMode: "automatic" | "manual") {
  const key = event.key;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) return;
  const list = event.currentTarget;
  const orientation = list.getAttribute("aria-orientation") === "vertical" ? "vertical" : "horizontal";
  if (
    key.startsWith("Arrow") &&
    !(orientation === "vertical"
      ? key === "ArrowUp" || key === "ArrowDown"
      : key === "ArrowLeft" || key === "ArrowRight")
  )
    return;
  const options = Array.from(
    list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled):not([aria-disabled="true"])')
  ).filter(
    (tab) =>
      tab.closest('[role="tablist"]') === list &&
      !tab.closest('[hidden], [inert], [aria-hidden="true"]') &&
      getComputedStyle(tab).display !== "none"
  );
  if (!options.length) return;
  const current = options.indexOf(document.activeElement as HTMLButtonElement);
  if (current < 0 && key !== "Home" && key !== "End") return;
  const rtl = getComputedStyle(list).direction === "rtl";
  const previous = key === "ArrowUp" || (rtl ? key === "ArrowRight" : key === "ArrowLeft");
  let index: number;
  if (key === "Home") index = 0;
  else if (key === "End") index = options.length - 1;
  else index = (current + (previous ? -1 : 1) + options.length) % options.length;
  event.preventDefault();
  const target = options[index];
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
  if (activationMode === "automatic") target.click();
}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  (
    {
      className,
      variant = "pill",
      orientation = "horizontal",
      activationMode = "automatic",
      onKeyDown,
      children,
      ...props
    },
    ref
  ) => (
    <TabsAppearanceContext.Provider value={variant}>
      <div
        {...props}
        ref={ref}
        role="tablist"
        aria-label={props["aria-label"] ?? "Sections"}
        aria-orientation={orientation}
        data-responsive-tabs="true"
        data-tabs-variant={variant}
        onKeyDown={(event) => {
          onKeyDown?.(event);
          if (!event.defaultPrevented) handleListKeyDown(event, activationMode);
        }}
        className={cn(
          "flex max-w-full min-w-0 items-center justify-start gap-1",
          orientation === "horizontal" && "overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-gutter-stable",
          orientation === "vertical" && "flex-col items-stretch",
          variant === "pill" && "rounded-xl border border-border bg-muted/40 p-1 text-muted-foreground",
          variant === "underline" && "gap-0 border-b border-border bg-transparent p-0 text-muted-foreground",
          className
        )}
      >
        {children}
      </div>
    </TabsAppearanceContext.Provider>
  )
);
TabsList.displayName = "TabsList";

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, onClick, children, onKeyDown, ...props }, ref) => {
    const { value: selectedValue, onValueChange, baseId } = useTabsContext("TabsTrigger");
    const variant = React.useContext(TabsAppearanceContext);
    const active = selectedValue === value;
    const internalRef = React.useRef<HTMLButtonElement | null>(null);
    const setRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        internalRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref]
    );

    React.useEffect(() => {
      const node = internalRef.current;
      const list = node?.closest<HTMLElement>('[role="tablist"]');
      if (!active || !node || !list || list.scrollWidth <= list.clientWidth) return;
      // Browser-native scrolling handles negative/positive RTL scrollLeft
      // conventions consistently; manual left/right arithmetic does not.
      node.scrollIntoView({ block: "nearest", inline: "nearest" });
    }, [active]);

    return (
      <button
        {...props}
        ref={setRef}
        id={props.id ?? tabId(baseId, value)}
        type="button"
        role="tab"
        aria-selected={active}
        aria-controls={panelId(baseId, value)}
        tabIndex={props.disabled ? -1 : active ? 0 : -1}
        data-state={active ? "active" : "inactive"}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented && !props.disabled) onValueChange(value);
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors sm:min-h-9",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-40",
          variant === "pill" &&
            "rounded-lg px-3 py-2 text-muted-foreground hover:bg-background/60 hover:text-foreground sm:px-4",
          variant === "pill" && active && "bg-background font-semibold text-foreground shadow-xs",
          variant === "underline" &&
            "rounded-none border-b-2 border-transparent px-4 py-2 text-muted-foreground hover:text-foreground",
          variant === "underline" && active && "border-primary font-semibold text-foreground",
          className
        )}
      >
        {children}
      </button>
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  /** Keep hidden panels mounted for expensive forms when explicitly desired. */
  forceMount?: boolean;
}
const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, forceMount = false, ...props }, ref) => {
    const { value: selectedValue, baseId } = useTabsContext("TabsContent");
    const active = selectedValue === value;
    // Preserve the previous fallback behavior when Tabs has no selected value.
    if (!active && selectedValue !== undefined && !forceMount) return null;
    return (
      <div
        {...props}
        ref={ref}
        id={props.id ?? panelId(baseId, value)}
        role="tabpanel"
        aria-labelledby={tabId(baseId, value)}
        tabIndex={0}
        hidden={!active && selectedValue !== undefined}
        data-state={active ? "active" : "inactive"}
        className={cn(
          "mt-4 min-w-0 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
