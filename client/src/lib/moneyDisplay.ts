/**
 * Explicit-currency display for already denominated amounts.
 *
 * No FX conversions happen here. Historical accounting amounts must never be
 * retranslated using a current exchange rate. Use CurrencyContext for any
 * conversion, and only when the business operation explicitly calls for it.
 */
export interface MoneyDisplayOptions {
  currency: string;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  placeholder?: string;
}

const currencyPrefixes: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CFA: "CFA ",
  XAF: "CFA ",
  XOF: "CFA ",
  CDF: "CDF ",
};

const zeroDecimalCurrencies = new Set(["CFA", "XAF", "XOF"]);

export function formatMoneyDisplay(
  amount: number | string | null | undefined,
  {
    currency,
    locale = "en-US",
    minimumFractionDigits = 0,
    maximumFractionDigits,
    placeholder = "—",
  }: MoneyDisplayOptions,
): string {
  if (amount == null || amount === "") return placeholder;
  const numeric = typeof amount === "string" ? Number(amount.trim()) : amount;
  if (!Number.isFinite(numeric)) return placeholder;
  const code = currency.trim().toUpperCase();
  const precision = maximumFractionDigits ?? (zeroDecimalCurrencies.has(code) ? 0 : 2);
  const decimals = Math.max(0, Math.min(20, precision));
  const minimum = Math.max(0, Math.min(decimals, minimumFractionDigits));
  const formatted = numeric.toLocaleString(locale, {
    minimumFractionDigits: minimum,
    maximumFractionDigits: decimals,
  });
  const prefix = currencyPrefixes[code] ?? (code ? `${code} ` : "");
  return `${prefix}${formatted}`;
}

/** Numeric-only formatting, e.g. a summary containing several currencies. */
export function formatMoneyNumber(
  amount: number | string | null | undefined,
  decimals = 2,
  locale = "en-US",
): string {
  if (amount == null || amount === "") return "—";
  const numeric = typeof amount === "string" ? Number(amount.trim()) : amount;
  return Number.isFinite(numeric)
    ? numeric.toLocaleString(locale, { maximumFractionDigits: Math.max(0, Math.min(decimals, 20)) })
    : "—";
}
