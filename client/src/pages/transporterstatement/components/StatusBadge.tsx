/**
 * StatusBadge — extracted sub-component.
 *
 * Extracted from TransporterStatement.tsx during the Phase 4 god-file split.
 */
import { StatusBadge as SharedStatusBadge } from "@/components/StatusBadge";
import { fmtAmt } from "../utils";

/** Amount calculation stays here; the shared status component owns presentation. */
export function StatusBadge({
  status,
  paidAmount,
  total,
}: {
  status: "unpaid" | "partial" | "paid" | null;
  paidAmount: string | null;
  total: string | null;
}) {
  if (!status) return null;
  if (status === "partial") {
    const remaining = parseFloat(total || "0") - parseFloat(paidAmount || "0");
    return (
      <SharedStatusBadge
        status="partial"
        label={`Partial · ${fmtAmt(remaining.toFixed(2))} left`}
        showIcon={false}
        className="text-[11px]"
      />
    );
  }
  if (status === "paid") return <SharedStatusBadge status="paid" showIcon={false} className="text-[11px]" />;
  // Unpaid statements stay in the destructive tone this screen always used.
  return <SharedStatusBadge status="error" label="Unpaid" showIcon={false} className="text-[11px]" />;
}
