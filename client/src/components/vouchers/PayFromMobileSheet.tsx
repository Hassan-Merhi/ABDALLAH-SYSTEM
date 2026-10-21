import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/components/AccountSidebar";
import type { VoucherFormData } from "@/pages/vouchers/voucherTypes";
import type { useCurrencyContext } from "@/contexts/CurrencyContext";

interface PayFromMobileSheetProps {
  form: UseFormReturn<VoucherFormData>;
  payFromSheetOpen: boolean;
  setPayFromSheetOpen: (open: boolean) => void;
  payFromSearch: string;
  setPayFromSearch: (value: string) => void;
  accountLabel: string;
  sidebarAccounts: Account[];
  payFromKeys: Set<string>;
  paymentAccountId: number;
  paymentAccountType: string;
  setEditingSource: (editing: boolean) => void;
  setPayFromTouched: (touched: boolean) => void;
  formatAmount: ReturnType<typeof useCurrencyContext>["formatAmount"];
}

/** Mobile bottom sheet for choosing the Pay From / Receive Into account. */
export function PayFromMobileSheet({
  form,
  payFromSheetOpen,
  setPayFromSheetOpen,
  payFromSearch,
  setPayFromSearch,
  accountLabel,
  sidebarAccounts,
  payFromKeys,
  paymentAccountId,
  paymentAccountType,
  setEditingSource,
  setPayFromTouched,
  formatAmount,
}: PayFromMobileSheetProps) {
  return (
    <Sheet
      open={payFromSheetOpen}
      onOpenChange={(isOpen) => {
        setPayFromSheetOpen(isOpen);
        if (!isOpen) setPayFromSearch("");
      }}
    >
      <SheetContent side="bottom" className="flex flex-col p-0" style={{ height: "auto", maxHeight: "88vh" }}>
        <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <SheetTitle className="text-base">{accountLabel}</SheetTitle>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              autoFocus
              placeholder={`Search ${accountLabel.toLowerCase()}...`}
              value={payFromSearch}
              onChange={(e) => setPayFromSearch(e.target.value)}
              className="pl-9"
              data-testid="input-pay-from-mobile-search"
            />
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto min-h-0">
          {(() => {
            const search = payFromSearch.toLowerCase().replace(/[\s.-]/g, "");
            const filtered = sidebarAccounts.filter((a) => {
              // Only show cash / bank / loan eligible accounts in the Pay From sheet
              if (!payFromKeys.has(`${a.type}:${a.id}`)) return false;
              if (!payFromSearch) return true;
              return a.name
                .toLowerCase()
                .replace(/[\s.-]/g, "")
                .includes(search);
            });
            if (filtered.length === 0) {
              return (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {payFromSearch ? "No accounts match your search" : "No accounts available"}
                </div>
              );
            }
            return filtered.slice(0, 40).map((account) => {
              const isSelected = account.id === paymentAccountId && account.type === paymentAccountType;
              const bal = typeof account.balance === "string" ? parseFloat(account.balance) : (account.balance ?? null);
              return (
                <button
                  key={`${account.type}-${account.id}`}
                  type="button"
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-muted/40 flex items-center justify-between gap-3 active-elevate-2",
                    isSelected && "bg-accent"
                  )}
                  onClick={() => {
                    form.setValue("paymentAccountType", account.type);
                    form.setValue("paymentAccountId", account.id);
                    form.setValue("paymentAccountName", account.name);
                    setEditingSource(false);
                    setPayFromTouched(true);
                    setPayFromSheetOpen(false);
                  }}
                  data-testid={`pay-from-mobile-option-${account.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{account.name}</div>
                    {bal != null && (
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{formatAmount(bal)}</div>
                    )}
                  </div>
                  {isSelected && <div className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                </button>
              );
            });
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
