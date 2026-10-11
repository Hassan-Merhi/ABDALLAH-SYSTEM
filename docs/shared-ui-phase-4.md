# Shared UI Phase 4 — Forms, Monetary Displays & Action Safety

**Implementation status:** committed on `refactor/shared-ui-standardization-phases-1-5` (2026-10-12).
**Verification status:** not tested, linted, typechecked, built, or CI-verified per user request.
**Deployment status:** not merged and not deployed.

This phase establishes canonical form inputs, amount presentation, submission
feedback and confirmation behaviors. Domain services and conversion logic stay
in their existing hooks and API endpoints.

## Canonical components

| Concern | Component |
|---|---|
| Form grids and sections | `ui/form.tsx` — `FormGrid`, `FormSection`, `FormSectionLegend` |
| Error-bound validated fields | `ui/form.tsx` — `FormField`, `FormControl`, `FormLabel`, `FormMessage` |
| Responsive footer | `ui/workspace-layout.tsx` — `FormActionBar` |
| Safe numerical entry | `ui/decimal-input.tsx` — `DecimalInput`, `MoneyInput` |
| Pending submit affordance | `components/FormSubmitButton.tsx` |
| Duplicate async action protection | `hooks/use-single-flight-action.ts` |
| Destructive or consequential confirmations | `components/ConfirmDialog.tsx` |
| Explicit-currency display | `components/MoneyAmount.tsx` |
| Pure monetary formatting (no FX) | `lib/moneyDisplay.ts` |

Existing currency accounting is **intentionally not changed**:
`CurrencyContext` continues to own display choice, current rate conversions,
historical USD treatment, and transaction-currency formatting. Never use the
pure amount formatter to convert values. The currency must already describe
the amount's denomination. Do not use a current FX rate to restate historical
posting amounts.

The pure formatter accepts explicit currency codes (USD, EUR, GBP, CFA,
XAF, XOF, CDF, and correctly labeled unknown codes), configurable digit
precision and missing/invalid-value fallbacks. CFA-family amounts use
zero fractional digits by default, and other currencies use at most two;
callers may specify finer precision for unit costs. `MoneyAmount` displays
numbers left-to-right in RTL layouts with tabular figures.

`DecimalInput` protects arrow-key accidental number stepping and delegates
all parsing/validation to the owning form. `MoneyInput` defaults to a
nonnegative decimal input and preserves the caller's step and controlled
value; do not use it for negative adjustment entries without explicitly
overriding `min`. Specialized quantity fields should specify `step="1"`
when integer-only.

`FormSubmitButton` standardizes disabled/pending state while
`useSingleFlightAction` provides a synchronous lock from the *first*
action click until its promise settles. On React Query mutations use
`mutateAsync` inside this guard; preserve the mutation's existing
`onSuccess`/`onError` callbacks for business logic and toast messages.

The shared `ConfirmDialog` now prevents two concurrent confirmations,
stays open and shows a human-readable error after rejected async actions,
uses a unique phrase-input label ID, retains optional double confirmation,
and supports custom confirmation test IDs for compatibility. Await
`mutateAsync` instead of calling fire-and-forget `mutate` in
`onConfirm` if dialog success must reflect actual completion. Destructive
actions must not trigger until confirmed, and must disable while pending.

## Migrated workflows

- Supplier Partner opening stock: decimal/monetary inputs, shared USD
  presentation, responsive form footer, pending submission and one-flight
  posting guard. Existing stock and journal posting payload remains.
- Payroll salary deposit: controlled money input, shared pending submit
  button, async one-flight mutation with original form validation.
- Factory proforma price-line editing: standard quantity, weight and
  price inputs, form grid, pending action; integer quantity step retained.
- POS retail payment entry: common monetary inputs for amount and tendered
  cash, keeping existing payment calculation/state logic.
- Factory contacts: canonical async delete confirmation and guarded create
  and edit submission, retaining mutation callbacks and actions.
- Factory customers: canonical opening balance amount input, pending
  create/edit buttons, guarded create/edit mutations, awaited delete.
  Balance-side accounting and existing cash formatting remain unchanged.
- Factory container editor: shared pending save action and guard while
  creation/update mutations are active, retaining admin override behavior.
- Properties rental payments: canonical currency labels and amount
  presentation; destructive deletion uses awaited shared confirmation
  while preserving accounting reversal mutation behavior.

Existing `ConfirmationDialog` compatibility shim continues to delegate
to the shared primitive. The `react-hook-form` controlled form API and
Radix dialog primitives are retained.

## Do not change in this phase

Do not convert or round values on input, modify precision rules in API
payloads, alter debit/credit sign semantics, recalculate historical totals,
change selected-company permissions, or rewire backend accounting.

Existing specialized forms not yet migrated should adopt these components
incrementally in later adoption waves. This phase establishes shared
building blocks and migrates representative high-value forms; it does not
claim that every form in the repository has been rewritten.

## Verification boundary

The user designated Render for CI/quality checks and explicitly requested
no local or assistant-triggered test/lint/type/build/CI checks while the
architecture waves are in progress. These unverified commits must not be
represented as production-ready or deployed. Leave `main` unchanged.
