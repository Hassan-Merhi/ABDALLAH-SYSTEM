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

### Phase 2 — product gallery (implemented)
- Retail product cards and product detail use the first saved style image as their
  primary cover thumbnail. Clicking a photo (not the product name) opens a roomy,
  responsive gallery modal with all the style photos and additional variant photos.
- Exact color/size inventory rows use their own photos first, then generic style
  photos, and deliberately do not mix photos from other variants.
- Gallery includes image counter, next/previous buttons, clickable thumbnail filmstrip,
  left/right keyboard navigation, close via existing Radix dialog and scrollable zoom.
  Empty-image placeholders remain non-interactive; duplicate URLs are deduplicated.
- Product and variant editors support **Set main**, placing the selected photo first
  in their persisted image URL list. No new photo data schema or backend routes.
- Existing media-route URL normalization remains in use for portability across hosts.
- No changes to standard ERP/Factory POS, Retail checkout, stock or accounting.
- Implementation committed without running tests, CI, typechecks, lint or builds.
  Claude should later manually verify touch layout, many-photo galleries, keyboard
  focus/escape behavior, chosen cover-photo persistence and graceful broken images.

### Phase 3 — standard ERP POS presentation for Retail (implemented in source)

- Retail POS now renders a standard ERP-style **Point of Sale** header and a
  working top Save action, plus a location/date/payment/customer control strip.
- Retail exact-variant sale lines appear in a left-hand table with item, photo,
  color/size, barcode, quantity +/- controls, effective rate, amount, line
  discount/price override and remove actions. Its total is fed by the **retail
  server-side cart preview**, not duplicated client accounting math.
- A right-hand scrollable item selector supports barcode scanning, text search,
  image thumbnails, click-to-open full product gallery and item selection.
  Clicking the photo does NOT add an item; clicking the item entry does.
- Shared `PosWorkspaceColumns` places these two screens in the same pattern as
  normal ERP POS, with narrow/mobile layouts stacking them vertically.
- Customer picker is in the top strip; whole-sale discounts, manager approval,
  split payments, existing receipts, returns/exchanges, shift requirement,
  location controls and back-office transfer widgets remain in place.
- Sale notes now appear below the grid and are saved through the pre-existing
  retail sale `notes` field. They participate in the checkout idempotency
  fingerprint and clear only when a sale succeeds or the context changes.
- The top payment method picker is bound to the existing first tender; when
  cart totals change, the selected payment method is no longer reset to cash.
- The date reflects the local current day, for display only: Retail checkout
  still uses the server's actual sale timestamp. Do not imply manual
  backdating exists. Retail credit sales are **not yet available**: the credit
  control is explicitly disabled until Phase 4 implements correct A/R.
- The grid deliberately does not show simulated P/L; retail POS item responses
  do not expose authoritative profitability data. This remains a separately
  verified reporting requirement, not an invented value.
- **Retail-only presentation.** Existing ERP / Factory / Supplier Partner POS
  components, server-side retail variant accounting, stock movements and journal
  posting were not changed.

No tests, CI, lint, typechecks or builds were run. Claude should verify the
responsive grid, scanner input, image viewer focus, stock guard, promotions and
server preview, tender persistence, discounts/approval, receipt flow, route
guards and existing ERP POS behavior before merging or deployment.

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
