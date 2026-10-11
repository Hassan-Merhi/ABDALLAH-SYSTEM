import * as React from "react";
import { formatMoneyDisplay, type MoneyDisplayOptions } from "@/lib/moneyDisplay";
import { cn } from "@/lib/utils";

export interface MoneyAmountProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children">,
    MoneyDisplayOptions {
  amount: number | string | null | undefined;
  /** Monetary amounts remain left-to-right in RTL interfaces. */
  negativeTone?: boolean;
}

/** Presentation only: requires the existing value's own currency; never FX converts. */
export function MoneyAmount({
  amount,
  currency,
  locale,
  minimumFractionDigits,
  maximumFractionDigits,
  placeholder,
  negativeTone = false,
  className,
  ...props
}: MoneyAmountProps) {
  const parsed = typeof amount === "string" ? Number(amount) : amount;
  return (
    <span
      dir="ltr"
      className={cn("inline-block whitespace-nowrap font-mono tabular-nums", negativeTone && parsed != null && parsed < 0 && "text-destructive", className)}
      {...props}
    >
      {formatMoneyDisplay(amount, { currency, locale, minimumFractionDigits, maximumFractionDigits, placeholder })}
    </span>
  );
}
