/**
 * StatusBadge — extracted sub-component.
 *
 * Extracted from FactoryStockAllocationV3.tsx during the Phase 4 god-file split.
 */
import { StatusBadge as SharedStatusBadge } from "@/components/StatusBadge";
import { STATUS_COLORS, STATUS_LABELS } from "../utils";

/** Keep the legacy allocation-specific labels/colors while sharing badge markup. */
export function StatusBadge({ status }: { status: string }) {
  return (
    <SharedStatusBadge
      status={status}
      label={STATUS_LABELS[status] ?? status}
      showIcon={false}
      className={`rounded-sm ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"}`}
    />
  );
}
