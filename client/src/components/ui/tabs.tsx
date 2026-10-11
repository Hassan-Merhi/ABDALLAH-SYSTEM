import * as React from "react";

import { cn } from "@/lib/utils";

type TabsContextValue = {
  id: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue>({
  id: "tabs",
  value: undefined,
  onValueChange: () => {},
});

function Tabs({
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  const id = React.useId();
  const [internalValue, setInternalValue] = React.useState<string | undefined>(defaultValue);

  const isControlled = controlledValue !== undefined;
  const activeValue = isControlled ? controlledValue : internalValue;

  const handleChange = React.useCallback(
    (val: string) => {
      if (!isControlled) setInternalValue(val);
      onValueChange?.(val);
    },
    [isControlled, onValueChange]
  );

  return (
    <TabsContext.Provider value={{ id, value: activeValue, onValueChange: handleChange }}>
      <div className={cn("min-w-0", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

// The pill treatment is shared by ERP, Factory, POS, Payroll and Properties.
// Overflow is scrollable; the fade is only visible when there are hidden tabs.
const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { variant?: "pill" | "underline" }
>(({ className, variant = "pill", onKeyDown, ...props }, ref) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]:not(:disabled)'
    ));
    if (!tabs.length) return;
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (currentIndex < 0) return;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const previous = event.key === (rtl ? "ArrowRight" : "ArrowLeft");
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : (currentIndex + (previous ? -1 : 1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[nextIndex].focus();
    tabs[nextIndex].click();
  };

  return (
    <div
      ref={ref}
      role="tablist"
      data-responsive-tabs="true"
      data-variant={variant}
      onKeyDown={handleKeyDown}
      className={cn(
        "inline-flex max-w-full items-center justify-start gap-1 overflow-x-auto overscroll-x-contain touch-pan-x",
        variant === "pill" && "rounded-full border border-border bg-muted/40 p-1 text-muted-foreground",
        variant === "underline" && "border-b border-border bg-transparent p-0 text-muted-foreground",
        className
      )}
      {...props}
    />
  );
});
TabsList.displayName = "TabsList";

const pillTriggerClasses = [
  "inline-flex min-h-11 shrink-0 touch-manipulation items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-all sm:min-h-9",
  "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  "disabled:pointer-events-none disabled:opacity-40",
  "rounded-full px-3 py-1.5 text-muted-foreground hover:text-foreground sm:px-4",
].join(" ");

function scrollSelectedTabIntoView(node: HTMLButtonElement | null) {
  const list = node?.closest<HTMLElement>('[role="tablist"]');
  if (!node || !list) return;
  const scroller = list.scrollWidth > list.clientWidth + 1
    ? list : list.closest<HTMLElement>(".erp-mobile-scroll-tabs") ?? list;
  if (scroller.scrollWidth <= scroller.clientWidth) return;
  const listBox = scroller.getBoundingClientRect();
  const tabBox = node.getBoundingClientRect();
  if (tabBox.left < listBox.left) scroller.scrollLeft -= listBox.left - tabBox.left + 8;
  else if (tabBox.right > listBox.right) scroller.scrollLeft += tabBox.right - listBox.right + 8;
}

const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ className, value, onClick, children, ...props }, ref) => {
  const ctx = React.useContext(TabsContext);
  const active = ctx.value === value;
  const localRef = React.useRef<HTMLButtonElement | null>(null);
  const setRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      localRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  React.useEffect(() => {
    if (active) scrollSelectedTabIntoView(localRef.current);
  }, [active]);

  return (
    <button
      ref={setRef}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`${ctx.id}-panel-${value}`}
      id={`${ctx.id}-tab-${value}`}
      tabIndex={active ? 0 : -1}
      data-state={active ? "active" : "inactive"}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) ctx.onValueChange(value);
      }}
      className={cn(
        pillTriggerClasses,
        active && "bg-background font-semibold text-foreground shadow-sm",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = "TabsTrigger";

// For hubs that render their panels directly (rather than using TabsContent),
// use this button inside TabsList to keep existing navigation logic intact.
const PillTabButton = React.forwardRef<
  HTMLButtonElement,
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-selected"> & { selected: boolean }
>(({ selected, className, children, ...props }, ref) => {
  const localRef = React.useRef<HTMLButtonElement | null>(null);
  const setRef = React.useCallback((node: HTMLButtonElement | null) => {
    localRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  React.useEffect(() => {
    if (selected) scrollSelectedTabIntoView(localRef.current);
  }, [selected]);

  return (
    <button
      ref={setRef}
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      data-state={selected ? "active" : "inactive"}
      className={cn(pillTriggerClasses, selected && "bg-background font-semibold text-foreground shadow-sm", className)}
      {...props}
    >
      {children}
    </button>
  );
});
PillTabButton.displayName = "PillTabButton";


const TabsContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { value: string }>(
  ({ className, value, children, ...props }, ref) => {
    const ctx = React.useContext(TabsContext);

    if (ctx.value !== undefined && ctx.value !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        id={`${ctx.id}-panel-${value}`}
        aria-labelledby={`${ctx.id}-tab-${value}`}
        data-state={ctx.value === value ? "active" : "inactive"}
        className={cn(
          "mt-4 min-w-0 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent, PillTabButton };
