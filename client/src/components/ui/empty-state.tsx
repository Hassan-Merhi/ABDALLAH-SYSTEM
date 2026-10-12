import type * as React from "react";
import type { LucideIcon } from "lucide-react";
import { PageState } from "@/components/ui/page-state";

/**
 * Compatibility adapter for the old compact empty-state presentation.
 * Rendering and accessibility are owned by the same PageState used elsewhere.
 * New pages should import EmptyState from @/components/shared (panel layout).
 */
export interface CompactEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}
export function EmptyState({ icon, title, description, action, ...props }: CompactEmptyStateProps) {
  return (
    <PageState layout="legacy" icon={icon ?? null} title={title} description={description} action={action} {...props} />
  );
}
