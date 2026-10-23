# Retail POS & Inventory Workflow — Claude Handoff (Phases 1–8)

**Branch:** `feature/retail-pos-inventory-workflow`
**Target:** `main` — do not merge without verification and owner approval.
**Status:** Source changes committed; NO CI, unit/integration tests, typechecks,
lint, builds, migrations, deployment, merge or rebase have been executed by ChatGPT.

## Objective and boundaries

The Retail company type must use normal ERP-style POS layout while keeping the
Retail barcode/color/size variant and financial posting engine. Retail Inventory
uses one cover image per product, with full interactive galleries. Retail
navigation hides Reports, Stock Count, Retail POS and Sales History as redundant
inventory tabs; sales remain discoverable through the existing Sales Report.
Manual Journal, Credit Note, Adjustment and Transfer Order voucher entry options
are hidden for Retail and protected in generic voucher HTTP creation/edit paths.
Automatic financial journals/stock accounting and read-only Daybook vouchers
remain available. Legacy normal ERP, Factory, Properties and Supplier Partner
behavior must remain unchanged.

### Implementation by phase

1. **Navigation/layout:** `RetailNav.tsx`, `RetailInventory.tsx`,
   `PosWorkspaceColumns.tsx`, `POS.tsx`, `RetailPOS.tsx`.
2. **Photos:** `RetailProductImage.tsx`, `RetailCatalogList.tsx`,
   `RetailProductEditor.tsx`, `RetailInventory.tsx`.
   Includes keyboard-accessible gallery/zoom, exact-variant previews,
   cover-photo reordering and image URL normalization.
3. **ERP-style Retail POS:** `RetailErpPosWorkspace.tsx`, `RetailPOS.tsx`.
   Left exact-variant sale grid, right photo-enabled scanner/sidebar, header,
   payment/customer controls, discounts, notes; server variant APIs retained.
4. **Credit and customer balances:** `RetailPaymentPanel.tsx`,
   `RetailCustomerPicker.tsx`, `retailFinancialService.ts`,
   `retailSaleService.ts`, `retailPosRoutes.ts`,
   `retailCustomerRoutes.ts`, `retailReceipt.tsx`, `retailPosTypes.ts`,
   `shared/schema/retailPos.ts`.
   Credit is the unpaid portion Dr customer. Other methods Dr actual cash/
   bank/clearing. The full sale amount still posts Cr sales/tax.
5. **Returns/exchange:** `RetailReturnDialog.tsx`,
   `RetailExchangeDialog.tsx`, `retailSaleService.ts`,
   `retailFinancialService.ts`, `retailPosRoutes.ts`,
   `retailStockOpsRoutes.ts`, `retailReporting.ts`,
   `retailVariantReports.ts`, `retailReceipt.tsx`.
   Receipt lookup, exact partial quantities, historical price/tax/COGS,
   original-tender vs ERP customer-account credit, manager-gated damaged
   no-restock, atomic exchange, audit trails.
6. **Retail voucher UI:** `retailVoucherPolicy.ts`, `Vouchers.tsx`,
   `VoucherEdit.tsx`, `VoucherEditDialog.tsx`,
   `StockTransferOrder.tsx`, command palette/sidebar/routes.
   Source-only Phase 8 adds `retailManualVoucherBoundary.ts` before generic
   voucher handlers in `voucherRoutes.ts` for Retail-only HTTP safeguards.
7. **Transfers:** `RetailStockOperations.tsx`,
   `retailTransferWorkflowRoutes.ts`, `server/routes/pos/index.ts`,
   `retailStockOpsRoutes.ts`, `retailInventoryJournal.ts`,
   `systemAccounts.ts`, `RetailPOSPanels.tsx`.
   Immediate exact-variant transfer OR dispatch→OTW→receipt, photo selection,
   immutable source costing, transfer asset and idempotent receipt.
8. **Integration hardening:** Split tender now works with an initially fully
   allocated default payment; return idempotency rejects reuse for changed
   sale/items/restock; dispatch retry rejects changed variants, quantities,
   locations or notes; generic manual-voucher HTTP creation/edit is guarded.
   See final checklist below for runtime validation still required.

### Database changes

- **Additive migration only:** `migrations/20261023_001_retail_return_disposition.sql`.
  Adds `retail_pos_return_items.restocked BOOLEAN NOT NULL DEFAULT true`,
  preserving the interpretation of historical returns. The always-running
  retail financial schema guard also adds this column idempotently.
- No new table is needed for deferred transfers; the existing
  `retail_stock_operations` JSONB metadata holds status/variant/locations/cost,
  with `retail_stock_movements` for one dispatch and one receipt audit leg.
- `RETAIL-IN-TRANSIT` is an **Asset** account in the existing system-account
  registry; it is resolved by the Retail stock posting helper *after* the
  company's stock opening. It is never manually created by this branch.
- Do not edit historical customer balances, Retail vouchers, inventory rows,
  company settings, bank accounts or production data as part of integration.
  Use an isolated test database for any migration and financial tests.

## Mandatory Claude verification checklist

### 0 — First actions

- Fetch this branch and compare with current `main` before touching source.
  There was an outstanding six-commit divergence when Phase 8 was written.
  Resolve conflicts conservatively and keep the same branch.
- Run the project's appropriate typecheck, lint, focused test suites and CI
  **only under Claude ownership**, as agreed with the user. Do not deploy or
  merge unless explicitly instructed and the gate is green.
- Review the incremental source diffs before changing any database schema,
  balance logic or journals. Look for unused imports/TSX conflicts/React
  hook dependency and accessibility errors.

### 1 — Retail navigation & images

- Inventory navigation contains ONLY Inventory, Quick Add, Stock Operations,
  Selling Settings; no redundant tabs.
- Cover photo opens gallery; arrow keys, escape, focus return, filmstrip,
  zoom, narrow phones and dozens of photos work correctly.
- Set-main saves cover order; exact variant images do not mix colors/sizes,
  generic style photos appear as fallback.
- Broken/empty images remain graceful and never add a sale/variant to cart.

### 2 — POS, pricing, payments, approvals

- Retail POS resembles normal ERP POS; normal ERP POS unchanged.
- Scanner Enter, global hardware scanning, input focus and invalid barcode
  feedback; exact SKU/color/size is preserved.
- Verify item grid price/rate/amount against server cart preview with
  promotions, line discounts, order discounts, tax and overrides.
- **Phase 8 fix:** On a $100 default cash tender, pressing Split should create
  two positive tenders whose sum is $100 (not a zero-value second tender).
  Rebalance to $60 cash + $40 credit, with customer selected; no misleading
  "Paid $100" when only $60 was collected.
- Check all supported tender methods, cash change and original payment refs;
  changing cart price does not reset selected method or silently corrupt split.
- Credit requires existing active customer and posts to ERP party receivable,
  not to a phantom cash account or duplicated customer balance cache.
- Confirm managers can approve/deny discounts without unintended submission,
  duplicate idempotency token or stale approval state.
- Full and partial credit receipt displays reflect paid vs on-account portions.

### 3 — Returns, refund allocations, exchanges

- Search receipts, product names and numeric/non-numeric variant barcodes.
- Return one/multiple sale lines; enforce unreturned quantity, correct
  historical price/promotion/discount/tax snapshots and same location/company.
- $100 sale: $60 cash + $40 credit. A $30 return should clear up to $30
  receivable and pay no cash. A subsequent $30 return should clear $10 more
  receivable and refund only the $20 actually collected.
- Test customer-account credit on a fully paid sale vs original-tender refund.
  Debit and credit to a real ERP customer must reconcile to posting engine.
- Damaged/non-restock return: no stock quantity/average-cost increase,
  no original COGS reversal, but refund revenue/tax and a zero-delta audit
  movement with `returnedQuantity`. Verify reports and reconciliation.
- Exchange: original sale return + replacement sale are one transaction;
  replacement price comes from authoritative server preview; original
  customer and credit terms are retained correctly.
- Closed shifts, user/manager role gates, two simultaneous returns, receipt
  replay, changed-payload replay, changed customer on posted credit sale,
  retry after network timeout and cancellation of part-returned sales.

### 4 — Voucher access protection

- Retail excludes manual Journal, Credit Note/Adjustment, Transfer Order tabs
  from desktop/mobile and stale query links; Payment, Receipt and Stock
  Transfer remain available where previously permitted.
- Read-only Daybook/voucher detail can show automatic Retail journals.
- **Phase 8 guard:** POST /api/vouchers/journal and generic manual Journal
  create/edit/deletes are forbidden for Retail; other company types unaffected.
- Confirm Retail automatic sale/refund/credit/stock postings bypass HTTP
  manual-voucher guard, and authorization does not shadow valid ERP routes.
- Check any **other** manual voucher endpoints outside `/api/vouchers/*`
  separately; this guard is narrow and is NOT a blanket permission audit.

### 5 — Transfers, costing, inventory valuation

- From-location selector, exact photo item picker, destination and positive
  quantity. Source stock may not go negative for a dispatch.
- Immediate flow posts one source-out + destination-in, with no income/COGS.
- Dispatch creates source-out and an in-transit balance, NOT sellable
  destination stock. Receipt later moves the *same* variant and source cost
  into destination stock, without duplicate receipt.
- Retry same dispatch payload returns same operation. Retry with changed
  barcode, location, quantity or note must NOT succeed as old dispatch.
- Two users confirming receipt simultaneously must result in one receipt.
- Confirm balanced Retail inventory/in-transit journals and compare both
  stock sub-ledger + ERP ledgers before dispatch, OTW and after receipt.
- Validate value rounding on locations with different average costs and
  account mapping. Initial stock opening must refuse while OTW exists.
- Verify restrictions for Retail selected-company, employee assigned
  locations, global POS/Manager/Admin roles, and inactive locations.
  **Per-location permission enforcement is an open security concern:**
  `requireNonPOS` is not a substitute for every user/location assignment.

### 6 — Cross-module regression

- Normal ERP POS, Supplier Partner, Factory production/containers, Properties,
  conventional ERP voucher flows and other companies remain unchanged.
- Sales Report includes Retail sales and refund history correctly; avoid
  duplicate or mismatched new Retail-side report modules.
- Verify daily Daybook balances, COGS, taxes, cash drawers, customer statements,
  payment sources and valuation under the selected company.

## Release and handoff rules

1. No CI/tests/lint/builds/typechecks/merge/rebase/deploy were executed by
   ChatGPT, and no production vouchers or stock records were changed.
2. Claude should run source and integration checks in an isolated environment,
   resolve discovered bugs on **the same feature branch**, and report evidence.
3. The user must approve final merge and Render deployment separately.
4. Do not treat a source-level commit as a production-verified solution.
5. Avoid a new draft PR until the owner's GitHub Actions triggering policy is
   confirmed; PR creation may itself start CI before Claude is ready.

## Prompt for Claude

> Continue work on branch `feature/retail-pos-inventory-workflow` in
> `Hassan-Merhi/ERP-FACTORY-SYSTEM`. All eight phases are committed in source,
> but ChatGPT deliberately ran no checks, CI, builds, merge, rebase or deploy.
> Read `docs/retail-pos-inventory-workflow.md` and this handoff in full.
> Review all Phase 1–8 changes against current main; inspect TS/React/Express/
> Drizzle contracts, migration sequencing and retail accounting invariants.
> Reconcile upstream changes cautiously on the same branch. Run focused tests,
> typecheck, lint and CI under your ownership, repair every integration issue
> and edge case without editing production accounting or stock data. Validate
> Retail cash/credit/discounts, returns, damaged/no-restock, exact variant
> transfers, in-transit valuation and manual voucher authorization, plus normal
> ERP/Factory regressions. Produce a precise pass/fail reconciliation and any
> remaining blockers. **Do not merge or deploy without the owner's approval.**
