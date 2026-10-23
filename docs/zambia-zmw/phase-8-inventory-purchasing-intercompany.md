# Zambia ZMW integration — Phase 8: inventory, purchasing, stock movements, intercompany

**Status: IN PROGRESS, implementation started and source changes committed. Phase 8 is NOT complete and NOT independently verified.**

Branch: `feature/zambia-zmw-multicurrency` only. No CI, tests, lint, typechecks, builds, merges, rebases, deployments, production migrations, production-rate entries or production accounting changes were performed. The added regression test is **source only** and was not executed. Claude performs verification at the end of all implementation phases.

## Historical accounting boundary

- Zambia keeps **USD base** and may use **ZMW native transaction currency** only with an approved, company-owned historical rate, **ZMW per 1 USD**. Mali USD/CFA code paths remain in place.
- Parent HADI L'SHI and Zambia entries must reconcile at one common **historical USD base amount**; native ZMW is recorded only on the configured Zambia side. Neither the latest/current rate nor the parent's display currency is used to calculate an old transfer.
- Inventory, purchases, goods in transit, landed-cost allocations, stock value movements, and COGS must remain **historical USD** unless and until native original purchase prices, transaction date and locked rate are stored as separately auditable facts. No cash/bank-only current revaluation can touch them.

## Implemented on this branch

### ZMW parent-linked intercompany transfers

- New `server/services/accounting/zambiaIntercompanyTransfer.ts` resolves an explicitly ZMW-denominated transfer. Requires the source or destination to be the *sole* active USD/ZMW-configured subsidiary, the other to be its actual linked parent, and both sides to be authorized by the existing company-access boundary.
- `assertApprovedZmwVoucherRate` checks the selected company's approved, effective-dated rate against the exact supplied rate for the transaction date. Missing, mismatched, or future FX fails closed.
- Converts native K to USD once for the common 6dp historical base, with decimal-safe arithmetic and no current rate or guessed rate. Rejects unsupported currencies, malformed amount, sub-cent base for ZMW, and fractional-ngwee inputs beyond two decimals.
- `companyTransferPosting.ts` writes original ZMW debit/credit, historical exchange rate, rate convention, original USD base, and backward-compatible USD accounting debit/credit on **only** the Zambia side. The parent side remains historical USD. Idempotency fingerprint distinguishes ZMW original amount/rate, preserving the original USD path.
- Both `interCompanyTransferService.ts` and `simpleCompanyTransferService.ts` use the resolver and existing paired posting transaction, scoped accounts and recording. The simple-transfer reversal mirrors the original ZMW native/base evidence and original rate, with no fresh-date conversion. Non-ZMW reversal payload remains unchanged.
- Native-ZMW requests require a caller-provided stable `clientRequestId`. Both sides use deterministic voucher numbers on retries; the ZMW leg uses one fixed idempotency key per transfer request/side. A changed amount or approved rate with the same request ID is rejected by the posting fingerprint check (and the paired transaction rolls back). USD/CFA identities and display numbers remain unchanged. Client retry identity is passed by the existing request middleware.
- `transferValidation.ts` exposes optional explicit `currency: ZMW` and `exchangeRate` to the existing APIs. Omitting both keeps USD backwards compatibility.
- `CompanyTransfer.tsx` labels transfer history as **USD base**, not the user's currently selected local display currency.

### Safe purchasing, PO edits, imports, landed cost and stock valuation

**Current limitation:** This branch does *not yet* store a ZMW native PO price/charge ledger with locked dated FX in the PO, container, line and landed-cost schemas. The existing purchase import, PO editor, voucher, goods-in-transit and stock costing infrastructure treats those numerical fields as **USD historical amounts**. Accepting a bare `purchase_orders.currency="ZMW"` would post raw Kwacha 1:1 to USD ledger/inventory and parent.

- New `server/services/accounting/zambiaPurchaseCurrencyGuard.ts` explicitly refuses unsupported native-ZMW PO costs with a controlled HTTP 409 rather than silently treating Kwacha as USD.
- Enforced at `server/storage/containers-store/purchase-orders.ts` **before** purchase-order creation or any parent/journal writes.
- Enforced before any container, voucher, ledger or intercompany side effect on `/api/po-import/import` and AI `/api/chatbot/confirm-po-import`; Excel `/api/po-import/validate` provides the same explanatory warning.
- Enforced on both line-item and charge-only `PATCH /api/purchase-orders/:id` paths, including attempts to relabel existing USD-valued prices as ZMW.
- Enforced on `PATCH /api/vouchers/:id/purchase` when the associated PO is native-ZMW-labeled.
- **USD-denominated PO and stock entries in Zambia are still allowed**, with their existing cost basis; existing non-ZMW purchase flows, including Mali, are left intact.
- Existing perpetual-inventory GIT/stock-in and stock movement services remain USD-based; no inventory movement, historical cost, historical invoice or COGS was repriced.

### Deferred regression contracts

- Added `tests/zambia-phase8-intercompany-boundary.test.ts` for K250 / illustrative 25 ZMW-per-USD = $10 historical base, native amounts, rate locking, legacy USD request shape and rejection of unsafe native-ZMW purchasing. **Not run.** The illustrative rate is not a production/market rate.

## Remaining Phase 8 work — MUST NOT call Phase 8 complete

1. Design and implement *full native ZMW PO* historical metadata for each original item cost, charge and discount; company-owned, approved voucher-date FX, USD base amounts; safe structural migration only, with no retroactive changes.
2. Implement end-to-end ZMW purchasing/import UI and server conversion, editing/reversal, goods-in-transit, offload, landed freight, inventory valuation, warehouse movements, COGS, refunds/returns and export printing. Preserve original ZMW and fixed USD historical valuation; never let a later display FX reprice history.
3. Integrate parent-company **purchase import** intercompany voucher construction with the same locked historical USD amount (separate from cash transfers). Review existing parent freight and supplier allocation, prevent duplicate charges or double conversion.
4. Audit all alternate ingestion/writes (manual/import/backfill/AI, direct stock adjustment, quick stock, transfer order, offload, returns, stock-price changes) and ensure no unguarded path accepts ZMW as an implied USD value.
5. Resolve the cross-writer serialization/overdraft race described in Phase 7; review ZMW parent-side retry mismatch rollback under concurrency, all legacy retry identities, multi-company RLS and closed-period mutation policies.
6. Add full source tests for native ZMW PO/stock and parent crossing when implemented; Claude alone will run them, along with CI/lint/typecheck/build, and Zambia/Mali historical accounting reconciliation.
7. Keep all subsequent work on this same branch, do not activate Zambia display/rates or run structural migrations in production during implementation.

**Next:** continue Phase 8 work on native purchase cost schema and controlled import/edit/stock paths before starting Phase 9 Factory. Only after Phases 8–11 and Claude independent checks should a draft PR/release decision be considered.
