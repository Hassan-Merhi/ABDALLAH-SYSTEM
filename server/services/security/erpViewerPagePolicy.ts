import { FEATURE_KEYS } from "@shared/schema";

/**
 * For an ERP View Only role, no per-company ERP page allow-list means every
 * business-data page is browseable (not Settings or Create Voucher). A nonempty list remains restrictive.
 * The global View Only HTTP middleware separately rejects every business write.
 */
export function effectiveErpPageKeys(role: string, savedPageKeys: readonly string[]): string[] {
  if (role === "View Only" && savedPageKeys.length === 0) {
    return FEATURE_KEYS.filter((key) => key !== "settings" && key !== "create");
  }
  return [...savedPageKeys];
}
