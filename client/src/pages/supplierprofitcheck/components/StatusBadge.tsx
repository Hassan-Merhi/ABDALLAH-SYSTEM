/**
 * StatusBadge — extracted sub-component.
 *
 * Extracted from SupplierProfitCheck.tsx during the Phase 4 god-file split.
 */
import { StatusBadge as SharedStatusBadge } from "@/components/StatusBadge";

export function StatusBadge({ status }: { status: string }) {
  const resolved = ["gaining", "losing", "break_even"].includes(status) ? status : "no_data";
  return <SharedStatusBadge status={resolved} />;
}
