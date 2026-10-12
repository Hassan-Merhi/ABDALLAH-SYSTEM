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

## Phases 3 and 4 — source implementation completed (11 October 2026)

### Phase 3 — Core ERP

- **Tracking:** `TrackingHub.tsx` keeps the complete Containers OTW / GIT Tracking / Transporter Statement labels, with a phone-safe horizontal strip and an accessible group label.
- **GIT workbook:** `GITMockup.tsx` also uses the scrollable pill strip for its Detail, Truck / Location, and Agent / Duty tabs.
- **Stock & Inventory:** `StockHub.tsx` and `InventoryHub.tsx` use the shared tabs rather than their former custom button rows; existing permission filtering and URL query-state logic remain in place.
- **Sales Tools & Parties:** `SalesToolsHub.tsx` and `PartiesHub.tsx` use shared navigation and preserve role-aware visibility and lazy content.

### Phase 4 — Accounting, vouchers, payroll and reports

- **Accounts and Daybook:** `AccountsLegacy.tsx`, `Daybook.tsx`, and `factory/FactoryDaybook.tsx` use scrollable pill navigation. The Accounts statement-only phone view still hides its parent tab strip.
- **Payroll:** `payroll/PayrollView.tsx`, `payroll/AdvancesTab.tsx`, `payroll/BonusDialog.tsx`, `components/erprunpayroll/ERPRunPayrollView.tsx`, `components/erprunpayroll/CompactRunPayrollSelection.tsx`, and `factory/factorypayroll/FactoryPayrollView.tsx` use the shared appearance, retaining their separate actions and selection logic.
- **Financial and personnel details:** `components/ERPWorkerDetail.tsx`, `factory/factoryworkerdetail/FactoryWorkerDetailView.tsx`, `factory/FactoryCustomerStatement.tsx`, `factory/FactoryAdvancesTab.tsx`, and `suppliers/SupplierDetailDialog.tsx` have consistent pill navigation with horizontal overflow where applicable.
- **Reports:** The production report tabs in `factory/DailyProductionReport.tsx` use a scrollable strip with full labels. Report views already using the shared `TabsList` inherit the global styling.
- **Explicit non-tab exclusions:** `Vouchers.tsx` and `vouchers/VoucherTabNav.tsx` use a route/type sidebar and a phone selection sheet, not a horizontal secondary tab bar. Those remain unchanged to preserve the agreed navigation model. Segmented view-mode switches (e.g. Condensed/Detailed), workflow progress indicators, and report filters are also not reclassified as tabs.

**Verification status:** Source changes are committed. No TypeScript command, linting, CI run, unit/integration/browser tests, runtime responsive checks, merge, or deployment were performed as requested. Implementation is complete at code level, not validated at runtime.

## Phase 5 — Factory Mode source implementation (11 October 2026)

Phase 5 is implemented on the same feature branch. The Factory surfaces reviewed and updated include:

| Area | Factory screens | Status |
| --- | --- | --- |
| Main hubs | `FactoryFinanceHub`, `FactoryPartiesHub`, `FactorySupplierHub`, `FactoryProductionIntelHub`, `FactoryBalesHub` | One-row pill navigation and horizontally scrollable tab containers |
| Factory navigation | `FactoryInvoicing`, `FactoryLoadingsHub`, `FactoryPayrollHub`, `FactoryDaybook` | Reused shared tabs or `PillTabButton`, maintaining query-state/permission conditions |
| Workers and employees | `FactoryWorkersHub`, `FactoryEmployeesHub`, `factoryworkers/FactoryWorkersView` | Replaced section dropdowns/uncoupled panels with shared pill tabs; preserved setting and permission filters |
| Production and stock | `DailyProductionReport`, `FactoryKpis`, `FactoryProfitability`, `BaleStockEntry`, `FactoryStockAllocationV3`, `production-raw-stock/RawStockRecalculate` | Shared responsive tab strip and selected state |
| Stock, dispatch and imports | `FactorySheetsAndSacks`, `FactoryDispatchBatches`, `FactoryImport` | Replaced bespoke button-style tab navigation with shared pills; left New Batch/action controls separate |
| Customer and workers | `FactoryCustomerStatement`, `factoryworkerdetail/FactoryWorkerDetailView`, `FactoryAdvancesTab`, `factorypayroll/FactoryPayrollView` | Existing tab content and permissions preserved, unified responsive layout |
| Relabeling and editable sheets | `FactoryBaleRelabeling`, `WipersReEntry`, `FactoryStatusBuilder`, `factorystatusbuilder/components/TabLabel` | Matched pill style, retained navigation, rename and delete controls, and added keyboard tab selection |

### Deliberate exclusions

`FactoryProduction.tsx` is a primary vertical navigation sidebar; it is not a secondary horizontal tab bar. The three switches in `FactoryStockAllocationV5.tsx` are independent stock filters, not mutually exclusive pages. Report options, view-mode switches, progress steps, tables and form buttons remain specialized controls rather than being restyled as tabs.

### Verification and delivery status

**Phase 5 code implementation is complete, not proven error-free.** No TypeScript, lint, unit, integration, CI, browser, phone, responsive or accessibility test runs were initiated, per the user's instruction. Do not merge or deploy without separate approval; no PR or release is part of this phase.

## Phase 6 — POS, Supplier Partner, Properties, Settings and dialogs

Phase 6 source implementation is complete on `feat/universal-responsive-pill-tabs-20261011`. Responsive pill tabs use the existing `TabsList` / `TabsTrigger` components and the `erp-mobile-scroll-tabs` container rather than copying button styles between pages.

| Scope | Updated surfaces | Implementation |
| --- | --- | --- |
| Supplier Partner | `sp/SpGoldenCoast.tsx`, `sp/SpReports.tsx` | Scrollable pill tab bars with preserved reporting and partner state |
| POS configuration | `settings/PosSetupHub.tsx` | POS Settings, Exchange Rates, Fiscal Period, Price Groups and Auto-Transfer share the same pill styling |
| Properties | `properties/PropertiesRentalsHub.tsx`, `properties/property-rental/components/UnitActionDialog.tsx` | Rental hub and all three conditional unit-dialog tab layouts retain complete labels and scroll on narrow viewports |
| Admin and settings | `settings/SessionsHub.tsx`, `settings/ApprovalsPage.tsx` | Session tabs and approval-status tabs use the standard navigation |
| Files and exports | `settings/FileStorageAndExport.tsx`, `settings/ExportCenter.tsx`, `ImportStockItems.tsx`, `components/CombinedImportDialog.tsx` | Import/export method tabs use shared pills and preserve existing workflows |
| Utility dialogs | `components/FactoryCatalogTranslationEditor.tsx`, `components/stockitemdetailsdialog/StockItemDetailsDialogView.tsx`, `settings/datatoolstab/components/MergeStockItemsLauncher.tsx`, `suppliers/SupplierDetailDialog.tsx` | All applicable dialog tabs use an independently scrollable strip with existing content/actions and icon/label semantics |

### Exclusions

The POS checkout/cart navigation, phone product-choice sheet, Settings' primary sidebar/mobile section picker, remote-support **browser tab selector**, permission visibility checkboxes, and other view/filter/action controls are not secondary section-tab bars. They were intentionally left unchanged. The shared tab primitive already governs other dialogs and modules previously converted during Phases 2–5.

### Delivery boundary

**Code-level migration complete; not runtime validated.** No TypeScript, lint, CI, unit, integration, browser, accessibility, or responsive test suites were invoked for this phase, at the user's request. There has been no merge to `main`, pull request, or deployment. A separate review/testing handoff remains necessary before production.

## Phase 7 — responsive source hardening (12 October 2026)

**Scope:** source-only responsive implementation, under the existing user requirement not to run testing, lint, CI or browser/device checks.

### Implemented

- **Shared tab component:** `client/src/components/ui/tabs.tsx` now keeps a horizontal, nonwrapping pill row; both the root tab strip and enclosing `.erp-mobile-scroll-tabs` scroller are considered when moving the selected tab into view. The active tab is repositioned when its dimensions, enclosing layout or browser window size changes, including text expansion and viewport zoom. Keyboard focus into a tab also reveals it.
- **Phone/tablet interaction:** Touch scrolling allows both sideways tab swipes and normal vertical page swipes from the tab-bar area. Touch targets remain minimum 44px on small screens and 36px from the desktop breakpoint, with no label truncation or forced word wrapping.
- **Keyboard and accessibility:** Shared tablists declare horizontal orientation; arrow/Home/End navigation skips visually hidden/disabled tabs, respects document direction, and retains focus styling inside the pill without clipping by the horizontal scroller. Reduced-motion users do not get unnecessary tab transitions.
- **Settings:** `client/src/erp-mobile-operations.css` no longer overrides the universal one-row tabs with multirow wrapping on phones and short-height landscape layouts.
- **RTL overflow indication:** `client/src/mobile-browser-compat.css` places the existing logical start/end edge fades on the proper physical side when content direction is RTL (Arabic); no second overflow-probe subsystem was added.
- **Pill geometry:** `client/src/index.css` reserves the former 2px tablist bottom padding for legacy tablists only. The standardized pill retains balanced padding on every side at narrow widths.
- **Permissions and routing:** Source changes are restricted to the shared visual primitive and responsive styles, without editing ERP/Factory/POS financial logic, tab access controls, URL syncing, or the underlying tab content.

### Responsive handoff matrix

| Width / environment | Source-level coverage | Runtime/device validation |
| --- | --- | --- |
| 320, 375, 390, 430 px phones | One-row scroll, 44px controls, preserved labels, selected tab visibility | **Not run** |
| 768 and 1024 px tablets | Width-constrained strips, horizontal overflow fallback, preserved section content | **Not run** |
| 1280, 1440, 1920 px desktops | Consistent 36px minimum tabs, pill shape, keyboard and direction behavior | **Not run** |
| iPhone Safari, Firefox, Chrome, large text and zoom | Existing momentum scroll, resize-aware selected tab, RTL edge masks and reduced-motion styling | **Not run** |
| Permission-filtered tabs and URL state | Existing feature logic left intact; visibility-aware arrow navigation | **Not run** |

**Phase 7 source-code implementation is complete; its original acceptance criterion (responsive and browser checks passing) is explicitly unverified** because the user has prohibited tests and CI. Do not interpret this as a device compatibility guarantee. No merge, PR, release or deployment was performed.
