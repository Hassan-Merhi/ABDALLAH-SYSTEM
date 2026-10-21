import { useEffect, useMemo } from "react";
import type { MutableRefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UseFormReturn } from "react-hook-form";
import type { CombinedAccount } from "@/components/AccountAutocomplete";
import type { VoucherFormData } from "@/pages/vouchers/voucherTypes";

export interface FxAgentWalletEntry {
  wallet: { id: number; ledgerAccountId: number; accountName: string };
  state: { eur: string; usd: string; totalBookUsd: string };
  synchronized: boolean;
}

export type FxCurrencyOverride = { beneficiary: string; currency: "EUR" | "USD" } | null;

export type FxPaymentRequestRef = MutableRefObject<{ fingerprint: string; key: string } | null>;

interface UseFxAgentPaymentArgs {
  selectedCompany: { id: number } | null | undefined;
  isFactoryMode: boolean;
  isFactoryCompany: boolean;
  isPOS: boolean;
  activeTab: string;
  voucherIdToEdit: number | null;
  paymentAccountType: VoucherFormData["paymentAccountType"];
  paymentAccountId: number;
  entries: VoucherFormData["entries"];
  form: UseFormReturn<VoucherFormData>;
  fxCurrencyOverride: FxCurrencyOverride;
  setFxCurrencyOverride: (value: FxCurrencyOverride) => void;
  payFromAccounts: CombinedAccount[];
}

/** FX agent wallet state for the Payment voucher: wallet lookup, supplier EUR payable and payout currency. */
export function useFxAgentPayment({
  selectedCompany,
  isFactoryMode,
  isFactoryCompany,
  isPOS,
  activeTab,
  voucherIdToEdit,
  paymentAccountType,
  paymentAccountId,
  entries,
  form,
  fxCurrencyOverride,
  setFxCurrencyOverride,
  payFromAccounts,
}: UseFxAgentPaymentArgs) {
  // Pay From can be an FX agent ledger. Wallet balances are native EUR,
  // while regular account balances are only historical USD book values.
  const { data: fxWallets, isLoading: fxWalletsLoading } = useQuery<{
    wallets: Array<{
      wallet: { id: number; ledgerAccountId: number; accountName: string };
      state: { eur: string; usd: string; totalBookUsd: string };
      synchronized: boolean;
    }>;
  }>({
    queryKey: ["/api/factory/fx-agent-wallets", selectedCompany?.id, "payment"],
    queryFn: async () => {
      const res = await fetch("/api/factory/fx-agent-wallets", { credentials: "include" });
      if (!res.ok) throw new Error("Unable to load FX agent wallet balances");
      return res.json();
    },
    enabled: isFactoryMode && isFactoryCompany && !isPOS,
    staleTime: 15_000,
  });
  const selectedFxWallet =
    activeTab === "payment" && !voucherIdToEdit && paymentAccountType === "ledger"
      ? fxWallets?.wallets?.find((w) => w.wallet.ledgerAccountId === paymentAccountId)
      : undefined;

  // A broker's EUR payable is its Parties settlement pool, NOT its GL EUR lines.
  // Other suppliers still use their posted native EUR ledger payable.
  const fxSelectedBeneficiary = entries[0];
  const fxSupplierId =
    selectedFxWallet && fxSelectedBeneficiary?.accountType === "factorySupplier" ? fxSelectedBeneficiary.accountId : 0;
  const {
    data: fxSupplierBalance,
    isPending: fxSupplierBalancePending,
    isError: fxSupplierBalanceError,
  } = useQuery<{
    fxEurPayable?: {
      balance: string;
      basis: "broker-statement" | "native-ledger";
      includeOtw: boolean;
      eligible: boolean;
    };
  }>({
    queryKey: ["/api/factory/suppliers", selectedCompany?.id, fxSupplierId, "balance", "fx-payment"],
    queryFn: async () => {
      const response = await fetch(`/api/factory/suppliers/${fxSupplierId}/balance?fxEurPayout=true`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to load supplier currency balance");
      return response.json();
    },
    enabled: !!fxSupplierId && isFactoryMode && !isPOS,
    staleTime: 15_000,
  });
  const fxSupplierEurBalance = fxSupplierBalance?.fxEurPayable?.eligible
    ? Math.max(0, Number(fxSupplierBalance.fxEurPayable.balance))
    : 0;
  const fxSupplierEurBasis = fxSupplierBalance?.fxEurPayable?.basis ?? null;
  const fxBeneficiaryKey = `${selectedCompany?.id}:${fxSelectedBeneficiary?.accountType}:${fxSelectedBeneficiary?.accountId}`;
  const fxPayoutCurrency: "EUR" | "USD" =
    fxCurrencyOverride?.beneficiary === fxBeneficiaryKey
      ? fxCurrencyOverride.currency
      : fxSupplierId && fxSupplierEurBalance > 0
        ? "EUR"
        : "USD";
  const fxSupplierBalanceLoading = !!fxSupplierId && (fxSupplierBalancePending || fxSupplierBalanceError);
  // When an async currency lookup changes the payout from USD to EUR, never
  // silently reinterpret an amount typed while the lookup was loading.
  useEffect(() => {
    if (!fxSupplierId || !fxSupplierBalance?.fxEurPayable || fxCurrencyOverride?.beneficiary === fxBeneficiaryKey)
      return;
    if (Number(form.getValues("entries.0.amount") || 0) > 0) {
      form.setValue("entries.0.amount", "");
    }
    setFxCurrencyOverride({
      beneficiary: fxBeneficiaryKey,
      currency: fxSupplierBalance.fxEurPayable.eligible ? "EUR" : "USD",
    });
    // setFxCurrencyOverride is the caller's useState setter (stable identity).
  }, [
    fxSupplierId,
    fxSupplierBalance?.fxEurPayable,
    fxBeneficiaryKey,
    fxCurrencyOverride,
    form,
    setFxCurrencyOverride,
  ]);
  const changeFxPayoutCurrency = (currency: "EUR" | "USD") => {
    if (currency === fxPayoutCurrency) return;
    setFxCurrencyOverride({ beneficiary: fxBeneficiaryKey, currency });
    // Never reuse a USD number as EUR (or vice versa).
    form.setValue("entries.0.amount", "");
  };

  // Most source pickers offer Cash/Bank only. Add active FX agent ledgers so
  // they are selectable directly in Pay From without editing their account.
  const paymentPayFromAccounts = useMemo(() => {
    const walletAccounts = (fxWallets?.wallets || []).map((w) => ({
      type: "ledger" as const,
      id: w.wallet.ledgerAccountId,
      name: w.wallet.accountName + " (FX EUR)",
      code: "FX",
    }));
    const present = new Set(payFromAccounts.map((account) => account.type + ":" + account.id));
    return [...payFromAccounts, ...walletAccounts.filter((a) => !present.has("ledger:" + a.id))].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [payFromAccounts, fxWallets?.wallets]);

  return {
    fxWalletsLoading,
    selectedFxWallet,
    fxSupplierId,
    fxSupplierEurBalance,
    fxSupplierEurBasis,
    fxPayoutCurrency,
    fxSupplierBalanceLoading,
    changeFxPayoutCurrency,
    paymentPayFromAccounts,
  };
}
