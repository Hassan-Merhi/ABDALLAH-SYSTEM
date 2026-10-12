/**
 * StatusBadge — extracted sub-component.
 *
 * Extracted from GcLshiMigration.tsx during the Phase 4 god-file split.
 */
import { StatusBadge as SharedStatusBadge } from "@/components/StatusBadge";

export function StatusBadge({ status }: { status: string }) {
  return <SharedStatusBadge status={status} showIcon={false} />;
}
