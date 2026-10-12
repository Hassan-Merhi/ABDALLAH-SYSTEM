import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  children: ReactNode;
  className?: string;
}

export function PageShell({ children, className }: PageShellProps) {
  return <div className={cn("space-y-6 p-3 sm:p-6", className)}>{children}</div>;
}

interface PageActionsProps {
  children: ReactNode;
  className?: string;
}

export function PageActions({ children, className }: PageActionsProps) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

export const financialNumberClassName = "text-right font-mono tabular-nums";
