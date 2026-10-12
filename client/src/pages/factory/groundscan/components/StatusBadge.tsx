/**
 * StatusBadge — extracted sub-component.
 *
 * Extracted from GroundScan.tsx during the Phase 4 god-file split.
 */
import { StatusBadge as SharedStatusBadge } from "@/components/StatusBadge";

/** Domain-specific override: bales in a loading order show Loading. */
export function StatusBadge({ status, isInLoadingOrder }: { status: string; isInLoadingOrder?: boolean }) {
  const current = (status || "").toUpperCase();
  if (current === "LOADING" || current === "LOADED" || (current === "IN_STOCK" && isInLoadingOrder)) {
    return <SharedStatusBadge status="loading" showIcon={false} />;
  }
  if (current === "IN_STOCK") return <SharedStatusBadge status="in_stock" showIcon={false} />;
  if (current === "SOLD") return <SharedStatusBadge status="sold" showIcon={false} />;
  if (current === "RESERVED_FOR_ORDER") return <SharedStatusBadge status="reserved_for_order" showIcon={false} />;
  if (current === "LABEL_PRINTED") return <SharedStatusBadge status="label_printed" showIcon={false} />;
  // Unknown historic statuses must keep their original text exactly.
  return <SharedStatusBadge status={status || "neutral"} label={status || undefined} showIcon={false} />;
}
