/**
 * StatusBadge — extracted sub-component.
 *
 * Extracted from GroundScan.tsx during the Phase 4 god-file split.
 */
import { StatusBadge as SharedStatusBadge } from "@/components/StatusBadge";

/** Domain-specific override: bales in a loading order show Loading. */
export function StatusBadge({ status, isInLoadingOrder }: { status: string; isInLoadingOrder?: boolean }) {
  const current = (status || "").toUpperCase();
  const effective = isInLoadingOrder && ["IN_STOCK", "LOADING", "LOADED"].includes(current)
    ? "loading"
    : current.toLowerCase();
  return <SharedStatusBadge status={effective || "neutral"} label={undefined} showIcon={false} />;
}
