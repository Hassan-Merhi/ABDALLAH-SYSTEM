# Dead-code cleanup — Phase 4 frontend reachability review

Status: IN PROGRESS (not cleared for deletion).
Branch: `refactor/erp-dead-code-cleanup`.

## Verified live entry points

A GitHub code-reference review found the following production references:
- `client/src/pages/BarcodeManager.tsx`: `client/src/lazyPages.ts` and `client/src/routes/ErpRoutes.tsx`.
- `client/src/pages/factory/FactoryStockAllocationV3.tsx`: `client/src/lazyPages.ts` and `client/src/components/FactoryRoutes.tsx`.
- `client/src/pages/sp/SpSetupPanel.tsx`: `client/src/pages/sp/SpSetup.tsx`.
- `client/src/pages/containers/ContainerSpView.tsx`: `client/src/pages/Containers.tsx`.
- `client/src/components/vouchers/PaymentReceiptTab.tsx`: `PaymentVoucherTab.tsx`, `ReceiptVoucherTab.tsx`, and `VoucherEntriesTable.tsx`.
- `client/src/components/UserNotesPanel.tsx`: `client/src/App.tsx`.
- `client/src/components/CreateMixBatchDialog.tsx`: `MixBatches.tsx`, `ProductionBales.tsx`, and `factory/ProductionRawStock.tsx`.
- `client/src/pages/factory/production-raw-stock/rawstockrecalculate/RawStockReplayPanel.tsx`: `RawStockRecalculate.tsx`.
- `client/src/pages/barcodelookup/BarcodeAdminDialogs.tsx`: `BarcodeLookupView.tsx`.

These are not safe-to-delete files. A filename containing `Legacy` or a comment saying “unused” is insufficient evidence for deletion. `docs/god-file-split-program.md` separately documents that `AnalyticsLegacy`, `AccountsLegacy`, and `SalesReportLegacy` are live implementations.

## Outstanding

A comprehensive scan of every file under `client/src/pages` and `client/src/components` is still needed, including import aliases, barrels, `React.lazy`, `import()`, glob imports, route registries, plugin registries, and string-loaded components. The GitHub search API only searches indexed code on the default branch and cannot by itself prove a file unreachable on this working branch.

No component or page deletion has been authorized from the evidence gathered so far. CI, type-checking, linting, tests, and builds have not been run (per owner instruction).
