# Retail POS + Inventory workflow — implementation phases

Branch: `feature/retail-pos-inventory-workflow`

## Scope and invariants

The user wants the **Retail** company type to keep normal ERP navigation, accounting and
customer concepts, but sell exact retail product color/size/barcode variants with photos.
Existing ERP, Factory, Supplier Partner and other company types must be unaffected.

- Preserve existing Retail inventory, variant barcode, stock ledger and accounting history.
- Reuse normal ERP POS presentation where possible, not its stock-item sale API.
  Retail sales must continue to use retail variant-aware sale/return endpoints until
  a separately designed and verified server-side integration safely replaces them.
- Do not route a retail variant sale through a normal ERP stock-item sale endpoint.
- UI changes to vouchers must not turn off automatic accounting journals or credit-note
  postings required by sales, returns and refunds.
- Sales Report integration must include retail sale/return data and avoid duplication;
  do not assume normal ERP's existing sales-report source already includes retail.
- All future phases on this same branch. No CI, tests, lint, typechecks or builds by
  ChatGPT. No merge/deploy/production accounting or inventory data changes. Claude
  performs verification after implementation phases are complete.

## Phase 1 — retail-only navigation + shared UI groundwork (implemented)

- Retail workspace pills now show **Inventory**, **Quick add**, **Stock operations**,
  and **Selling settings** only.
- Removed Retail POS, Reports, Stock count and Sales history pills from retail
  workspaces, and the redundant `Open POS` button from Retail Inventory.
- Regular ERP POS entry (`/pos`) continues to route retail-company users to
  `/retail/pos`, and POS-role cashiers keep their existing retail POS entry.
  This is intentional until the replacement POS presentation is complete.
- Previously implemented routes and server endpoints remain in place; this is a
  **visibility change**, not a destructive data or accounting deletion.
- Added `PosWorkspaceColumns`, now shared by both normal ERP and Retail POS,
  preserving the **existing** layouts independently. The common shell provides the
  migration seam for later matching the normal POS grid and item sidebar.
- Updated existing source contract assertions to reflect the new retail navigation
  while retaining deep-link/POS reachability checks.

No tests, CI, lint, typechecks or builds were executed for this phase.

## Remaining phases

### Phase 2 — product gallery
Main product thumbnail throughout retail inventory. Image click opens a full-screen
(or roomy dialog) gallery of every product image with next/previous and zoom.
Preserve color/size-specific images and accessible keyboard/dialog interaction.

### Phase 3 — standard ERP POS presentation for Retail
Retain the standard normal-ERP POS screen arrangement (header, location/date,
cash/credit/customer row, sale grid, totals, notes, item sidebar) while resolving
items by retail barcode to exact variant IDs, with thumbnails in the sale grid and
sidebar and image-gallery entry points. Reuse view components and hooks where safe;
keep the retail transaction backend until monetary/accounting behavior is reconciled.

### Phase 4 — customers and checkout controls
Full customer selection, cash/bank and credit sales as normal ERP allows, per-line and
invoice discounts in fixed amount or percent, permissions and audit metadata; locked
discount/tax/cost history. Do not introduce duplicate receivables or journals.

### Phase 5 — returns/refunds/exchanges
Select original sale/receipt and exact line/quantity. Refund only that line's
unreturned quantity with its original discount, tax, COGS and payment split; reverse
the correct retail journal and inventory movements without editing the original
sale. Support refund, account credit, exchange, and damaged/no-restock options;
ensure partial returns, repeated submissions and POS authorization are safe.

### Phase 6 — retail-specific voucher visibility
Hide manual Transfer Order, Adjustment/Credit Note and Journal entries *only for
Retail* (menus and selector UI); preserve underlying accounting records,
read-only audit access and system-generated accounting entries.

### Phase 7 — transfers between locations
Image thumbnails and full gallery in variant selector. Transfer exact variant with
quantity/location validation, preserving cost and no artificial revenue; immediate
transfer and dispatch/receipt modes, with statuses and audit log.

### Phase 8 — source-level integration and Claude handoff
Finish wiring, review migration expectations and document Claude's checks.
No execution of CI/tests/lint/typechecks/builds by ChatGPT, no merging/deploying.

## Phase 1 boundaries

Phase 1 does **not** yet switch the Retail POS to the normal ERP grid, implement
gallery interactions, enable credit terms, change refunds, hide voucher forms, add
transfer receiving, or pipe retail transactions into the standard Sales Report.
Those are explicitly subsequent phases.
