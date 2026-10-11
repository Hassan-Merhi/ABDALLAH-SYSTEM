# Universal responsive pill tabs — implementation inventory

**Branch:** `feat/universal-responsive-pill-tabs-20261011`  
**Scope:** ERP, Factory, POS/Supplier Partner, Properties, Settings, and nested tab-based pages.  
**Design reference:** Tracking Hub’s Containers OTW / GIT Tracking / Transporter Statement tab strip.

## Component standard

- Use `Tabs`, `TabsList`, `TabsTrigger`, and `TabsContent` from `client/src/components/ui/tabs.tsx` for local section selection.
- For pages that intentionally render their content directly, use `TabsList` with `PillTabButton selected={...}` rather than duplicating the pill classes.
- Both use one rounded, theme-aware pill container; selected tabs have a solid background, semibold foreground text, and a light shadow.
- Mobile targets are at least 44px high; desktop targets are at least 36px. Labels stay in one line, overflow scrolls horizontally, and active tabs scroll into view.
- Keyboard Left/Right, Home and End operate through the shared `TabsList`; arrow direction follows computed RTL direction. Existing responsive overflow fades are supplied by `mobile-browser-compat.css` and the shell's `useScrollOverflowProbe`.
- Do not introduce another horizontal observer/mask subsystem or replace primary sidebar and bottom navigation with secondary tabs.
- Do not alter access checks, the active-tab query parameters, translation labels or panel content.
- Existing `variant="underline"` users are migrated to the default pill appearance.

## Inventory and migration map

| Surface | Located implementation | Migration approach |
| --- | --- | --- |
| Tracking | `TrackingHub.tsx`, `GITMockup.tsx` | Shared tab primitive and full-width scroll |
| Stock and Inventory | `StockHub.tsx`, `InventoryHub.tsx` | Custom button rows replaced by shared tabs |
| Parties and Sales Tools | `PartiesHub.tsx`, `SalesToolsHub.tsx` | Shared component; direct panel logic retained |
| Accounting and Daybook | `AccountsLegacy.tsx`, `Daybook.tsx`, `FactoryDaybook.tsx` | Shared component already in use, with normal pill appearance |
| Payroll | `PayrollView.tsx`, `BonusDialog.tsx`, `AdvancesTab.tsx`, `FactoryPayrollHub.tsx`, `factorypayroll/FactoryPayrollView.tsx`, `components/erprunpayroll/CompactRunPayrollSelection.tsx` | Standardized layout and former underline variants |
| Factory Bales / Suppliers / Finance | `FactoryBalesHub.tsx`, `FactorySupplierHub.tsx`, `FactoryFinanceHub.tsx`, `FactoryPartiesHub.tsx`, `FactoryProductionIntelHub.tsx`, `DailyProductionReport.tsx` | Shared component with same one-row pill appearance |
| Factory Loadings and Invoicing | `FactoryLoadingsHub.tsx`, `FactoryInvoicing.tsx` | Manual underline tab rows converted to shared pill buttons |
| Factory Stock and Relabeling | `BaleStockEntry.tsx`, `FactorySheetsAndSacks.tsx`, `FactoryBaleRelabeling.tsx`, `WipersReEntry.tsx`, `FactoryStockAllocationV3.tsx`, `production-raw-stock/RawStockRecalculate.tsx`, `factorystatusbuilder/components/TabLabel.tsx` | Shared pill appearance, direct panel logic and existing routes; editable status tabs retain their special behavior |
| POS / Supplier Partner | `SalesToolsHub.tsx`, `settings/PosSetupHub.tsx`, `sp/SpGoldenCoast.tsx`, `sp/SpReports.tsx` | Standardized section tabs, not the unrelated POS checkout/bottom navigation |
| Properties | `PropertiesRentalsHub.tsx`, `property-rental/components/UnitActionDialog.tsx` | Standardized pill navigation inside hubs and dialogs |
| Settings | `settings/SessionsHub.tsx`, `settings/ExportCenter.tsx`, `settings/FileStorageAndExport.tsx`, `settings/ApprovalsPage.tsx` | Standard pill appearance including previously underlined approval status tabs |
| Shared dialogs and utilities | `components/CombinedImportDialog.tsx`, `components/ERPWorkerDetail.tsx`, `components/stockitemdetailsdialog/StockItemDetailsDialogView.tsx`, `components/FactoryCatalogTranslationEditor.tsx`, `components/NotificationsCenter.tsx` | Inherit shared design through `TabsList` or use `PillTabButton` for direct panel selection |

Other pages importing the shared tabs primitive inherit the pill design without a file-by-file restyle. Tab-shaped view-mode switches, workflow indicators, primary navigation and table controls are intentionally outside scope.

## Delivery constraints

All changes belong to `feat/universal-responsive-pill-tabs-20261011`. No backend, database, or API changes are required. Do not merge to `main` without approval.

**User instruction:** Do not run CI, lint, unit tests, integration tests, browser tests, or responsive test suites as part of this work. Implementation is therefore not verified by automated checks; any untested behavior must not be described as proven.

## Implementation status

The shared pill components and identified custom horizontal tab bars have been migrated on this feature branch. Existing screen-specific controls (sidebar menus, navigation sheets, view toggles and workflow steps) deliberately remain as their original controls. No automated or manual runtime tests were executed as requested; the changes have not been validated in a running browser, and should remain unmerged until accepted by the user.
