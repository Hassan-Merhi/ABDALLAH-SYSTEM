/**
 * Phase 8: the amount on a ZMW intercompany request is native Kwacha.
 * Both companies must post the SAME historical USD base. Only the Zambia leg
 * retains ZMW transaction amounts; the linked parent leg always posts USD.
 * No new cross-company exchange rate or implicit current-rate translation.
 */
import Decimal from "decimal.js";
import { assertApprovedZmwVoucherRate } from "./zambiaVoucherRatePolicy";
import { TransferRouteError } from "../../routes/transfers/transferErrors";

interface TransferCompany {
  id: number;
  active: boolean;
  parentCompanyId: number | null;
  baseCurrency: string | null;
  displayCurrency: string | null;
}

export async function resolveZambiaIntercompanyAmount(params: {
  fromCompany: TransferCompany;
  toCompany: TransferCompany;
  amount: string | number;
  transferDate: string;
  currency?: string | null;
  exchangeRate?: string | number | null;
}): Promise<{
  baseAmount: string;
  nativeAmount: string;
  currency: "USD" | "ZMW";
  historicalRate: string | null;
  zambiaCompanyId: number | null;
}> {
  const currency = String(params.currency ?? "USD").trim().toUpperCase();
  if (currency !== "USD" && currency !== "ZMW") {
    throw new TransferRouteError(400, "Unsupported intercompany transfer currency");
  }
  let amount: Decimal;
  try {
    amount = new Decimal(String(params.amount));
  } catch {
    throw new TransferRouteError(400, "Transfer amount is invalid");
  }
  if (!amount.isFinite() || amount.lte(0) || amount.decimalPlaces() > 2) {
    throw new TransferRouteError(400, "Transfer amount must be positive with at most two decimal places");
  }
  if (currency === "USD") {
    if (params.exchangeRate != null && params.exchangeRate !== "") {
      throw new TransferRouteError(400, "USD intercompany transfers must not supply a foreign exchange rate");
    }
    return { currency, baseAmount: amount.toFixed(2), nativeAmount: amount.toFixed(2),
      historicalRate: null, zambiaCompanyId: null };
  }

  const candidates = [params.fromCompany, params.toCompany].filter(company =>
    company.active && String(company.baseCurrency).toUpperCase() === "USD" &&
    String(company.displayCurrency).toUpperCase() === "ZMW"
  );
  const zambia = candidates.length === 1 ? candidates[0] : null;
  const other = zambia?.id === params.fromCompany.id ? params.toCompany : params.fromCompany;
  if (!zambia || !other.active || zambia.parentCompanyId !== other.id) {
    throw new TransferRouteError(409,
      "Kwacha intercompany transfers require a USD/ZMW subsidiary and its linked parent company");
  }
  let historicalRate: string | null;
  try {
    historicalRate = await assertApprovedZmwVoucherRate(
      zambia.id, params.transferDate, "ZMW", params.exchangeRate
    );
  } catch {
    throw new TransferRouteError(409,
      "An approved USD/ZMW exchange rate matching the transfer date and supplied rate is required");
  }
  if (!historicalRate) {
    throw new TransferRouteError(409, "Historical USD/ZMW exchange rate is missing");
  }
  const base = amount.div(new Decimal(historicalRate)).toDecimalPlaces(6);
  if (base.lt("0.005")) {
    throw new TransferRouteError(400, "Kwacha amount converts to less than half a USD cent");
  }
  return {
    currency: "ZMW",
    nativeAmount: amount.toFixed(2),
    baseAmount: base.toFixed(6),
    historicalRate,
    zambiaCompanyId: zambia.id,
  };
}
