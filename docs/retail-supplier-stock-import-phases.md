# Retail Supplier Stock Import — Phased implementation

Branch: `feature/retail-supplier-stock-import-20261024`

## Phase 1 — UI and spreadsheet preflight (implemented)

Entry: Retail company > Retail Inventory > **Supplier Stock Import**.

- A downloadable `retail_supplier_stock_template.xlsx` includes:
  `Item Name, Category, Brand, Size, Color, Quantity, Cost Price, Selling Price,
  Main Image, Extra Images, SKU, Barcode, Description`.
- Supplier is selected from the **active company's existing suppliers**
  (`GET /api/suppliers`, without parent-company fallback).
- Receiving location comes from the selected Retail company's active stock
  locations (`GET /api/locations`).
- Invoice/reference, receipt date, and invoice currency are collected in the form.
  Default purchase intent is supplier credit; no payment is posted in Phase 1.
- XLSX and CSV uploads parse the first worksheet; invalid files and empty sheets
  are rejected. Maximum 5,000 rows / 15 MB. Source Excel row numbers are retained.
- Preview validates mandatory fields, integer quantities, nonnegative prices,
  malformed/duplicate SKUs and barcodes, and duplicate style/variant combinations
  within the uploaded file. Preview shows valid-row quantities and estimated cost,
  plus per-row errors. Headers support the existing basic import's aliases.
- Product-image ZIP selector is visible for the future picture matcher.
  **Phase 1 does not upload, store, validate ZIP contents, or associate images.**
- Blank barcodes and SKUs are allowed for later automatic generation.
- No `POST` is used: the preview is **non-persistent**. Closing it does not create
  a purchase, stock receipt, inventory movement, supplier payable, journal, or labels.
- The old **Legacy Import** is preserved separately for existing workflows, but
  clearly warned: it sets **absolute quantities** and is not a supplier purchase.

### Phase 1 source files

- `client/src/pages/retail/retailSupplierImportDraft.ts` — normalized parse, limits,
  duplicate detection, field validation and pure summary.
- `client/src/pages/retail/RetailSupplierImportDialog.tsx` — template, company-scoped
  supplier and location fields, Excel/CSV file parsing and preview UI.
- `client/src/pages/retail/RetailInventory.tsx` — entry button and dialog integration.
- `client/src/pages/retail/RetailImportDialog.tsx` — legacy-import warning.

No CI, tests, merge, rebase, or deployment were run as part of this Phase 1 handoff.

## Phases 2–7: contract and financial invariants

**Phase 2 — Product and image import engine**

- Map product identity to existing Retail brand/style + color/size variant.
  Group by a stable SKU when supplied; resolve to existing company-scoped SKU/
  barcode before creating a variant. Reuse existing brand/category/location.
- Match filenames from the uploaded ZIP to Main Image / Extra Images. Validate
  extension, size, magic bytes and path traversal; apply image-count and company
  storage restrictions. Images are attached to the correct product or variant.
- Never create duplicate variants by skipping already-used identities.
- Respect the existing generated EAN-13 implementation, rather than inventing a
  separate barcode sequence. Only use stored barcodes; no silent regenerations.

**Phase 3 — Barcode and variant identity**

- Generate missing variant barcodes using the existing company-scoped retail
  barcode generator; preserve supplied/existing barcodes.
- Import should still work without vendor barcodes. When the item already exists,
  match its identity and reuse the existing barcode.
- Ensure POS and stock transfer barcode lookup find the resulting variants.

**Phase 4 — Supplier purchase + accounting**

- Do **not** reuse `POST /api/retail/import` for supplier receiving:
  it sets absolute stock and books adjustments rather than supplier payable.
- Create a *new*, transactional, company-scoped supplier purchase/receipt API.
- Validate supplier membership, location, unit costs, accepted quantities,
  duplicates, idempotency, permissions, invoice currency/rates and account mappings
  on the server, with a preflight and explicit confirm step.
- Receive **additional units** (not absolute overwrite), update weighted-average
  inventory cost, write append-only stock movements and persist purchase rows.
- For credit purchases, Dr Retail Inventory Asset / Cr linked Supplier Payable at
  properly converted historical values, in the **same database transaction**.
  Supplier balance, journal and stock must reconcile; an error rolls all back.
- Replayed request keys cannot duplicate either quantity or debt. A supplier
  purchase must never route through Inventory Adjustment/Suspense instead of AP.
- Later full/partial payments reduce the supplier payable through selected cash
  or bank accounts. Use existing account ledgers, not a separate retail balance.
- Support returns/credit notes using reversals; never rewrite posted vouchers.

**Phase 5 — Label popup after receipt**

- After success, open the existing retail label flow; copies per variant must be
  the **received quantity**, not its lifetime balance or an arbitrary 1.
- The cost price must never be printed on customer labels. Provide thermal/A4
  layouts, full/selected reprints and stored-barcode scan consistency.
- Skipping or cancelling printing never rolls back an already completed purchase.

**Phase 6 — History, reprints and resilience**

- Supplier invoice attachments, import batches, resumable error presentation,
  purchase/stock history, company-scoped permissions, duplicate supplier-invoice
  safety, partial receipts, and exact-label reprint from batch quantities.

**Phase 7 — Final integration and Claude review**

- Keep all phases on this same branch. Review navigation,
  Retail POS, transfer/scanner, accounting, cost valuations, multi-company
  isolation and source-level consistency. Let Claude run CI/tests later
  before PR merge/deployment as instructed.

### Why Phase 1 intentionally cannot post

The old bulk import writes quantity **equal to** Excel quantity, not
**plus** purchased quantity, and does not create the supplier payable.
Allowing the new supplier form to call it before Phase 4 would make stock
and debt disagree. The UI therefore provides a useful preflight now without
pretending it is already an operational supplier receipt.
