import type { ReactNode } from "react";

type PosWorkspaceColumnsProps = {
  children: ReactNode;
  /** Preserve existing layouts while ERP and retail progressively share POS widgets. */
  layout: "erp" | "retail";
};

/**
 * Shared two-column POS workspace shell.
 *
 * - ERP keeps its desktop-only sales-grid / item-sidebar layout (mobile is separate).
 * - Retail keeps its responsive card layout until the shared sales grid is wired in.
 *
 * This is presentation-only: neither checkout engine, prices nor journals change.
 */
export function PosWorkspaceColumns({ children, layout }: PosWorkspaceColumnsProps) {
  if (layout === "retail") {
    return <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(360px,0.7fr)]">{children}</div>;
  }

  return (
    <div className="hidden lg:flex flex-1 overflow-hidden p-4">
      <div className="flex flex-row gap-4 h-full w-full">{children}</div>
    </div>
  );
}
