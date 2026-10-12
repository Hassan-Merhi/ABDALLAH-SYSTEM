import * as React from "react";
import { AlertCircle, CheckCircle2, Inbox, Loader2, type LucideIcon } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { WorkspaceActions } from "@/components/ui/workspace-layout";
import { cn } from "@/lib/utils";

type PageStateProps = React.HTMLAttributes<HTMLDivElement> & {
  icon?: LucideIcon | null;
  layout?: "panel" | "legacy";
  /** Optional custom action slot used by compact legacy empty states. */
  action?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionVariant?: ButtonProps["variant"];
  actionDisabled?: boolean;
  actionPending?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  iconClassName?: string;
};

const PageState = React.forwardRef<HTMLDivElement, PageStateProps>(
  (
    {
      className,
      icon,
      layout = "panel",
      action,
      title,
      description,
      actionLabel,
      onAction,
      actionVariant = "outline",
      actionDisabled = false,
      actionPending = false,
      secondaryActionLabel,
      onSecondaryAction,
      iconClassName,
      ...props
    },
    ref
  ) => {
    const Icon = icon === undefined ? (layout === "legacy" ? null : Inbox) : icon;
    const hasPrimaryAction = Boolean(actionLabel && onAction);
    const hasSecondaryAction = Boolean(secondaryActionLabel && onSecondaryAction);

    return (
      <div
        ref={ref}
        role="status"
        aria-atomic="true"
        className={cn(
          layout === "legacy"
            ? "empty-state"
            : "flex min-h-48 min-w-0 flex-col items-center justify-center rounded-lg border border-dashed bg-card px-4 py-8 text-center sm:px-6 sm:py-10",
          className
        )}
        {...props}
      >
        {Icon ? (
          <div
            className={
              layout === "legacy" ? "empty-state-icon" : "mb-4 rounded-full bg-muted p-3 text-muted-foreground"
            }
            aria-hidden="true"
          >
            <Icon className={cn(layout === "legacy" ? "h-5 w-5" : "h-6 w-6", iconClassName)} />
          </div>
        ) : null}
        <h3 className={layout === "legacy" ? "empty-state-title" : "max-w-xl text-base font-semibold text-foreground"}>
          {title}
        </h3>
        {description ? (
          <p
            className={
              layout === "legacy" ? "empty-state-desc" : "mt-1 max-w-xl text-sm leading-5 text-muted-foreground"
            }
          >
            {description}
          </p>
        ) : null}
        {action ? (
          <div className="mt-2">{action}</div>
        ) : hasPrimaryAction || hasSecondaryAction ? (
          <WorkspaceActions className="mt-4 w-full justify-center sm:w-auto">
            {hasSecondaryAction ? (
              <Button type="button" variant="ghost" onClick={onSecondaryAction} disabled={actionPending}>
                {secondaryActionLabel}
              </Button>
            ) : null}
            {hasPrimaryAction ? (
              <Button
                type="button"
                variant={actionVariant}
                onClick={onAction}
                disabled={actionDisabled || actionPending}
                aria-busy={actionPending}
              >
                {actionPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}
                {actionLabel}
              </Button>
            ) : null}
          </WorkspaceActions>
        ) : null}
      </div>
    );
  }
);
PageState.displayName = "PageState";

export function LoadingState({
  title = "Loading",
  description = "Please wait while the latest information is loaded.",
  className,
  ...props
}: Omit<PageStateProps, "icon" | "title" | "description"> & { title?: string; description?: string }) {
  return (
    <PageState
      {...props}
      className={className}
      icon={Loader2}
      iconClassName="animate-spin motion-reduce:animate-none"
      title={title}
      description={description}
      aria-live="polite"
      aria-busy="true"
    />
  );
}

export function EmptyState(props: Omit<PageStateProps, "icon"> & { icon?: LucideIcon }) {
  return <PageState icon={props.icon ?? Inbox} {...props} />;
}

export function ErrorState({
  title = "Something went wrong",
  description = "The information could not be loaded. Please try again.",
  ...props
}: Omit<PageStateProps, "icon" | "title"> & { title?: string }) {
  return (
    <PageState
      icon={AlertCircle}
      title={title}
      description={description}
      role="alert"
      aria-live="assertive"
      {...props}
    />
  );
}

export function SuccessState({
  title = "Completed successfully",
  description = "Your changes have been saved.",
  ...props
}: Omit<PageStateProps, "icon" | "title"> & { title?: string }) {
  return <PageState icon={CheckCircle2} title={title} description={description} aria-live="polite" {...props} />;
}

export { PageState };
export type { PageStateProps };
