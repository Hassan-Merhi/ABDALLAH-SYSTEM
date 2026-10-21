import Decimal from "decimal.js";
import { format } from "date-fns";
import type { getApiRequest } from "@/lib/factoryApi";
import type { useToast } from "@/hooks/use-toast";
import type { VoucherFormData } from "@/pages/vouchers/voucherTypes";
import type { FxAgentWalletEntry, FxPaymentRequestRef } from "@/pages/vouchers/useFxAgentPayment";

interface SubmitFxAgentPaymentArgs {
  formData: VoucherFormData;
  selectedFxWallet: FxAgentWalletEntry;
  fxSupplierBalanceLoading: boolean;
  fxPayoutCurrency: "EUR" | "USD";
  selectedCurrency: string;
  fxPaymentRate: string;
  fxSupplierEurBalance: number;
  voucherEffectiveDate: string;
  fxPaymentRequestRef: FxPaymentRequestRef;
  modeApiRequest: ReturnType<typeof getApiRequest>;
}

// One atomic FX settlement creates a Payment voucher and a native EUR
// wallet movement. Do not also submit to the generic USD voucher path.
export async function submitFxAgentPayment({
  formData,
  selectedFxWallet,
  fxSupplierBalanceLoading,
  fxPayoutCurrency,
  selectedCurrency,
  fxPaymentRate,
  fxSupplierEurBalance,
  voucherEffectiveDate,
  fxPaymentRequestRef,
  modeApiRequest,
}: SubmitFxAgentPaymentArgs) {
  if (!navigator.onLine) throw new Error("FX payments must be posted online");
  if (!selectedFxWallet.synchronized) throw new Error("FX agent ledger needs reconciliation");
  if (fxSupplierBalanceLoading) throw new Error("Wait until the supplier's currency balance has loaded");
  if (fxPayoutCurrency === "USD" && selectedCurrency !== "USD") {
    throw new Error("Select USD as the display currency before entering a USD payout");
  }
  if (formData.optional) throw new Error("FX payments cannot be optional vouchers");
  if (fxPayoutCurrency === "USD" && (!/^\d+(?:\.\d{1,10})?$/.test(fxPaymentRate) || Number(fxPaymentRate) <= 0)) {
    throw new Error("Enter the negotiated USD per EUR payment rate");
  }
  if (formData.entries.length !== 1) {
    throw new Error("FX agent payment supports one beneficiary per voucher");
  }
  const [beneficiary] = formData.entries;
  if (!["ledger", "factorySupplier"].includes(beneficiary.accountType)) {
    throw new Error("Choose a factory supplier or ledger account as the beneficiary");
  }
  if (beneficiary.accountType === "ledger" && beneficiary.accountId === selectedFxWallet.wallet.ledgerAccountId) {
    throw new Error("FX agent cannot pay itself");
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(beneficiary.amount)) {
    throw new Error("Payment must be positive with at most 2 decimal places");
  }
  const amount = new Decimal(beneficiary.amount);
  if (amount.lte(0)) throw new Error("Payment must be positive");
  if (
    fxPayoutCurrency === "EUR" &&
    (beneficiary.accountType !== "factorySupplier" || fxSupplierEurBalance <= 0 || amount.gt(fxSupplierEurBalance))
  ) {
    throw new Error("Choose a supplier with an outstanding EUR payable and do not exceed its EUR balance");
  }
  const eurNeeded = fxPayoutCurrency === "EUR" ? amount : amount.div(new Decimal(fxPaymentRate)).toDecimalPlaces(6);
  if (eurNeeded.lte(0) || eurNeeded.gt(new Decimal(selectedFxWallet.state.eur))) {
    throw new Error("FX agent has insufficient EUR for this USD payment");
  }
  if (fxPayoutCurrency === "USD" && !eurNeeded.times(new Decimal(fxPaymentRate)).toDecimalPlaces(2).eq(amount)) {
    throw new Error("USD amount cannot be paid precisely at this rate; adjust the amount or rate");
  }
  const date = format(formData.voucherDate, "yyyy-MM-dd");
  if (voucherEffectiveDate && voucherEffectiveDate !== date) {
    throw new Error("FX agent Payment Voucher requires the effective date to match the voucher date");
  }
  const fingerprint = JSON.stringify({
    walletId: selectedFxWallet.wallet.id,
    date,
    effectiveDate: voucherEffectiveDate || null,
    beneficiary: beneficiary.accountType + ":" + beneficiary.accountId,
    payoutCurrency: fxPayoutCurrency,
    amount: amount.toFixed(2),
    rate: fxPayoutCurrency === "USD" ? fxPaymentRate : null,
    notes: formData.notes,
    narration: beneficiary.narration,
    paymentAccountNarration: formData.paymentAccountNarration,
  });
  if (fxPaymentRequestRef.current?.fingerprint !== fingerprint) {
    fxPaymentRequestRef.current = { fingerprint, key: crypto.randomUUID() };
  }
  const result = await modeApiRequest(
    "POST",
    "/api/factory/fx-agent-wallets/" + selectedFxWallet.wallet.id + "/settle",
    {
      paymentVoucher: true,
      targetCurrency: fxPayoutCurrency,
      ...(fxPayoutCurrency === "EUR"
        ? { eurAmount: amount.toFixed(2) }
        : { usdAmount: amount.toFixed(2), rateUsdPerEur: fxPaymentRate }),
      targetKind: beneficiary.accountType,
      targetId: beneficiary.accountId,
      date,
      requestKey: fxPaymentRequestRef.current.key,
      narration: formData.notes || "",
      paymentAccountNarration: formData.paymentAccountNarration || "",
      beneficiaryNarration: beneficiary.narration || "",
    }
  );
  return result.json();
}

interface ConfirmFxAgentPaymentArgs {
  validEntries: VoucherFormData["entries"];
  selectedFxWallet: FxAgentWalletEntry;
  fxSupplierBalanceLoading: boolean;
  fxPayoutCurrency: "EUR" | "USD";
  fxPaymentRate: string;
  fxSupplierEurBalance: number;
  toast: ReturnType<typeof useToast>["toast"];
}

/** Pre-submit FX agent payment checks and confirmation; returns false when the save must not proceed. */
export function confirmFxAgentPayment({
  validEntries,
  selectedFxWallet,
  fxSupplierBalanceLoading,
  fxPayoutCurrency,
  fxPaymentRate,
  fxSupplierEurBalance,
  toast,
}: ConfirmFxAgentPaymentArgs): boolean {
  const rate = Number(fxPaymentRate);
  const amount = Number(validEntries[0]?.amount || 0);
  const directEur = fxPayoutCurrency === "EUR";
  const eurAmount = directEur ? amount : rate > 0 ? amount / rate : 0;
  if (
    fxSupplierBalanceLoading ||
    !Number.isFinite(eurAmount) ||
    eurAmount <= 0 ||
    validEntries.length !== 1 ||
    (!directEur && !fxPaymentRate) ||
    !["ledger", "factorySupplier"].includes(validEntries[0].accountType) ||
    (directEur && (validEntries[0].accountType !== "factorySupplier" || eurAmount > fxSupplierEurBalance))
  ) {
    toast({
      title: "Payment details required",
      description: directEur
        ? "Choose a EUR supplier payable and enter an amount within its EUR balance."
        : "Choose one USD recipient, amount, and agreed EUR rate.",
      variant: "destructive",
    });
    return false;
  }
  const paymentDetails = directEur
    ? "Supplier receives: EUR " +
      amount.toFixed(2) +
      "\\n" +
      "Agent EUR deducted: EUR " +
      amount.toFixed(2) +
      "\\n" +
      "No currency exchange or rate entry is needed."
    : "USD recipient receives: " +
      amount.toFixed(2) +
      "\\n" +
      "Agreed USD/EUR rate: " +
      fxPaymentRate +
      "\\n" +
      "EUR deducted (approx.): " +
      eurAmount.toFixed(6) +
      "\\n" +
      "FX gain/loss is booked automatically.";
  if (
    !window.confirm(
      "Post Payment Voucher?\\n" +
        "From: " +
        selectedFxWallet.wallet.accountName +
        "\\n" +
        "To: " +
        validEntries[0].accountName +
        "\\n" +
        paymentDetails
    )
  )
    return false;
  return true;
}
