import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { VoucherEntry } from "@/components/vouchers/VoucherEntriesTable";
import type { PaymentReceiptTabProps } from "@/components/vouchers/PaymentReceiptTab";

interface PaymentReceiptFxSectionProps {
  entries: VoucherEntry[];
  total: number;
  directEurPayment: boolean;
  fxRateValue: number;
  fxEurRequired: number;
  fxUnsupportedEntries: boolean;
  fxWallet: PaymentReceiptTabProps["fxWallet"];
  fxPaymentRate: string;
  onFxPaymentRateChange?: (value: string) => void;
  fxPayoutCurrency: "EUR" | "USD";
  fxSupplierEurBalance: number | null;
  fxSupplierEurBasis: "broker-statement" | "native-ledger" | null;
  fxSupplierBalanceLoading: boolean;
  onFxPayoutCurrencyChange?: (currency: "EUR" | "USD") => void;
}

/** FX agent payment panel shown inside the Payment voucher form when Pay From is an FX agent wallet. */
export function PaymentReceiptFxSection({
  entries,
  total,
  directEurPayment,
  fxRateValue,
  fxEurRequired,
  fxUnsupportedEntries,
  fxWallet,
  fxPaymentRate,
  onFxPaymentRateChange,
  fxPayoutCurrency,
  fxSupplierEurBalance,
  fxSupplierEurBasis,
  fxSupplierBalanceLoading,
  onFxPayoutCurrencyChange,
}: PaymentReceiptFxSectionProps) {
  return (
    <section className="space-y-3 rounded-lg border border-primary/30 bg-muted/20 p-4" data-testid="fx-payment-voucher">
      <div>
        <h4 className="text-sm font-semibold">
          {directEurPayment ? "Direct EUR supplier payment" : "FX agent payment — recipient gets USD"}
        </h4>
      </div>
      {entries[0]?.accountType === "factorySupplier" && (
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant={directEurPayment ? "default" : "outline"}
            disabled={fxSupplierBalanceLoading || !fxSupplierEurBalance}
            onClick={() => onFxPayoutCurrencyChange?.("EUR")}
            data-testid="fx-pay-eur"
          >
            Pay EUR directly
          </Button>
          <Button
            type="button"
            size="sm"
            variant={!directEurPayment ? "default" : "outline"}
            onClick={() => onFxPayoutCurrencyChange?.("USD")}
            data-testid="fx-pay-usd"
          >
            Pay USD (exchange)
          </Button>
        </div>
      )}
      {fxSupplierBalanceLoading && <p className="text-sm text-muted-foreground">Loading supplier EUR balance…</p>}
      {fxSupplierEurBalance !== null && fxSupplierEurBalance > 0 && (
        <p className="text-sm text-muted-foreground" data-testid="fx-supplier-eur-balance">
          {fxSupplierEurBasis === "broker-statement"
            ? "Broker EUR settlement balance (including OTW): "
            : "Supplier EUR payable: "}
          EUR {fxSupplierEurBalance.toFixed(2)}
        </p>
      )}
      {directEurPayment ? (
        <p className="text-sm" data-testid="fx-direct-eur-details">
          Enter the EUR amount below. Both the supplier's EUR payable and the agent's EUR wallet decrease by the same
          amount. No exchange rate needed.
        </p>
      ) : (
        <>
          <label className="block text-sm font-medium" htmlFor="fx-voucher-rate">
            Agreed payment rate — USD per 1 EUR
          </label>
          <Input
            id="fx-voucher-rate"
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 1.14"
            value={fxPaymentRate}
            onChange={(event) => onFxPaymentRateChange?.(event.target.value)}
          />
        </>
      )}
      {total > 0 && (directEurPayment || fxRateValue > 0) && (
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Recipient receives</p>
            <p className="font-mono font-semibold">
              {fxPayoutCurrency} {total.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Agent EUR deduction</p>
            <p className="font-mono font-semibold">
              EUR{" "}
              {fxEurRequired.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })}
            </p>
          </div>
        </div>
      )}
      {!fxWallet?.synchronized && (
        <p className="text-sm text-destructive">Ledger mismatch: reconcile the FX wallet before paying.</p>
      )}
      {fxEurRequired > Number(fxWallet!.state.eur) && (
        <p className="text-sm text-destructive">Insufficient EUR held by this agent.</p>
      )}
      {directEurPayment && fxSupplierEurBalance !== null && total > fxSupplierEurBalance && (
        <p className="text-sm text-destructive">Amount exceeds supplier EUR balance.</p>
      )}
      {fxUnsupportedEntries && (
        <p className="text-sm text-destructive">
          Use one factory supplier or USD ledger recipient (not the FX agent itself) per payment.
        </p>
      )}
    </section>
  );
}
