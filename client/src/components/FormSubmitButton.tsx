import * as React from "react";
import { Button, type ButtonProps } from "@/components/ui/button";

export interface FormSubmitButtonProps extends ButtonProps {
  pending?: boolean;
  pendingLabel?: string;
}

/** Use for forms whose mutation exposes isPending. Prevents repeated UI submits. */
export const FormSubmitButton = React.forwardRef<HTMLButtonElement, FormSubmitButtonProps>(
  ({ pending = false, pendingLabel = "Saving…", isLoading, disabled, type = "submit", ...props }, ref) => (
    <Button
      {...props}
      ref={ref}
      type={type}
      disabled={disabled || pending || isLoading}
      isLoading={pending || isLoading}
      loadingLabel={pendingLabel}
    />
  ),
);
FormSubmitButton.displayName = "FormSubmitButton";
