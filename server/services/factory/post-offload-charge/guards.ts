import type { AccountingContext, PostOffloadChargeData } from "./types";

/**
 * Fail closed before any inventory costing or charge is saved or changed. A
 * charge without both sides of its ledger posting (exactly one company-owned
 * expense account or supplier, and a valid payable account) would otherwise
 * become a permanent unposted financial operation.
 */
export function assertChargePostingDestination(
  companyId: number,
  chargeData: PostOffloadChargeData,
  accountingCtx: AccountingContext | undefined,
  message: string
): asserts accountingCtx is AccountingContext {
  if (
    !accountingCtx ||
    accountingCtx.voucherCompanyId !== companyId ||
    accountingCtx.chargesPayableAcctId <= 0 ||
    Number(Boolean(chargeData.ledgerAccountId)) + Number(Boolean(chargeData.supplierId)) !== 1
  ) {
    throw new Error(message);
  }
}

/**
 * Never edit or undo a historical charge whose accounting identity cannot be
 * resolved. Otherwise the charge and its cost change while the original
 * payable voucher survives and cannot be retired or updated.
 */
export function assertResolvedHistoricalLinks(chargeRow: {
  id: number;
  voucherId: number | null;
  daybookEntryId: number | null;
}): void {
  if (!chargeRow.voucherId || !chargeRow.daybookEntryId) {
    throw new Error(
      `Charge #${chargeRow.id} has missing historical voucher/daybook links. Reconcile the original records before editing or undoing it.`
    );
  }
}
