import * as React from "react";
import { Input } from "@/components/ui/input";

/** Prevents arrow up/down from accidentally stepping a focused financial field. */
export type DecimalInputProps = Omit<React.ComponentProps<typeof Input>, "type"> & {
  preventArrowStep?: boolean;
};

export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ step = "0.01", inputMode = "decimal", preventArrowStep = true, onKeyDown, ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type="number"
      step={step}
      inputMode={inputMode}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented && preventArrowStep && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
          event.preventDefault();
        }
      }}
    />
  )
);
DecimalInput.displayName = "DecimalInput";

/**
 * Amount input, still controlled by the calling form. No conversion,
 * rounding, parsing or submission is performed by this component.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  ({ min = "0", step = "0.01", ...props }, ref) => <DecimalInput {...props} ref={ref} min={min} step={step} />
);
MoneyInput.displayName = "MoneyInput";
