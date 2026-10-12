# Universal responsive pill tabs

**Branch:** `feat/universal-responsive-pill-tabs-20261011`  
**Scope:** secondary (in-page) tab bars in ERP, Factory, Payroll, POS settings, Supplier Partner, Properties, Settings, Import/Export and shared dialogs.  
**Design reference:** Tracking Hub's Containers OTW / GIT Tracking / Transporter Statement strip.

This page describes the tab standard as implemented. Phases 1–7 migrated the screens; Phase 8 audited, tested and fixed the result (see [Phase 8 audit and verification](#phase-8-audit-and-verification)).

## Component standard

All secondary tab bars use `client/src/components/ui/tabs.tsx`:

| Export | Use |
| --- | --- |
| `Tabs` | Controlled (`value` + `onValueChange`) or uncontrolled (`defaultValue`) state. Supplies an id so tabs and panels can reference each other. |
| `TabsList` | The pill container (`role="tablist"`, `aria-orientation="horizontal"`, `data-responsive-tabs="true"`). One row, never wraps, scrolls sideways. Owns arrow-key navigation. Always give it an `aria-label`. |
| `TabsTrigger` | A tab bound to `Tabs` state. The selected trigger carries `aria-controls`, pointing at its mounted panel. |
| `TabsContent` | The panel (`role="tabpanel"`, `aria-labelledby`). Only the selected panel is mounted. |
| `PillTabButton` | For hubs that render panels directly (route-backed tabs, `useHubQueryState`, conditional JSX). Same look and keyboard behaviour, `selected` prop instead of `Tabs` state. |
| `useActiveTabVisibility` | For bespoke tabs that cannot be a plain button (the editable Factory Status Builder pages). Keeps the selected tab scrolled into view. |

`variant="underline"` is still accepted for API compatibility; no screen uses it now.

### Visual rules

- Rounded-full outer container (`border`, `bg-muted/40`, `p-1`) and rounded-full tabs; the selected tab is `bg-background`, semibold, `text-foreground`, `shadow-sm`. Colours are theme tokens, so light and dark themes both work.
- Tabs are at least **44px** high below the `sm` breakpoint (640px) and on any coarse-pointer device (phone landscape, tablets, including tab strips in portalled dialogs), and **36px** on desktop.
- Labels are `whitespace-nowrap` and `shrink-0`: they never truncate, squeeze or wrap; the strip scrolls instead.
- Hub pages wrap the list in `.erp-mobile-scroll-tabs` with `w-max min-w-full sm:min-w-0 sm:w-fit`, so the pill spans the width on phones and hugs its content on desktop.
- Overflow fades come from the shell's `useScrollOverflowProbe` (`data-scroll-overflow`) and `mobile-browser-compat.css`. Only the edge that hides tabs fades. In Arabic the physical edge is mirrored, using `:dir(rtl)` with a `[dir="rtl"]` fallback for browsers without `:dir()`.

### Behaviour rules

- **Selected tab stays visible.** On selection, focus, container resize, text or zoom changes and width changes, the selected tab is scrolled into its strip (and the enclosing `.erp-mobile-scroll-tabs`), with clearance for the 2.5rem fade. Only the strip scrolls; the page never does. Height-only window resizes (a mobile toolbar collapsing during vertical scroll) are ignored, so they do not undo a sideways swipe.
- **Keyboard:** Left/Right move and select (automatic activation), Home/End jump to the ends, and focus wraps. Disabled tabs and tabs that are not rendered are skipped. In RTL, Left moves to the next tab. The app-wide scroll-key handler (`client/src/app/useGlobalScrollKeys.ts`) leaves Left/Right/Home/End alone when a tab has focus. Before Phase 8 it swallowed them on any page that had a sideways-scrollable region.
- **Touch:** the list is `touch-auto`, so sideways swipes scroll the strip and a vertical swipe that starts on the strip still scrolls the page.
- **Permissions and URL state are owned by each page.** Pages compute the visible tabs from access and settings. They render only those tabs, and fall back to the first visible tab when the URL (`?tab=`, `?section=`) names a hidden one (`useHubQueryState` `allowedValues`, or an `effective…Tab` value). The tab primitive never changes access rules or query parameters.

### Do not

- Add a second horizontal observer or mask system, or copy pill classes into pages.
- Put non-tab controls inside a `TabsList`. Put actions such as "Add page" or "New batch" beside it, inside the same scroll wrapper if they need to scroll with it.
- Wrap a panel that already renders its own `TabsContent` in another `TabsContent`. That creates nested tabpanels with duplicate ids.
- Restyle primary navigation, sidebars, bottom navigation, view-mode toggles, workflow progress steps or independent filters as tabs.

## Migration map

| Surface | Implementation | Approach |
| --- | --- | --- |
| Tracking | `TrackingHub.tsx`, `GITMockup.tsx` | Shared tabs, full-width scroll strip |
| Stock and Inventory | `StockHub.tsx`, `InventoryHub.tsx` | Custom button rows replaced by `Tabs`/`TabsContent`. Permission filtering and `?tab=` kept |
| Parties and Sales Tools | `PartiesHub.tsx`, `SalesToolsHub.tsx` | Shared tabs. Role-aware visibility and lazy panels kept |
| Accounting and Daybook | `AccountsLegacy.tsx`, `Daybook.tsx`, `factory/FactoryDaybook.tsx` | Scroll strip. The Accounts phone statement view still hides its tab strip |
| ERP Payroll | `payroll/PayrollView.tsx`, `payroll/AdvancesTab.tsx`, `payroll/BonusDialog.tsx`, `erprunpayroll/ERPRunPayrollView.tsx`, `erprunpayroll/CompactRunPayrollSelection.tsx`, `ERPWorkerDetail.tsx` | Shared appearance. Former underline and grid variants removed |
| Factory hubs | `FactoryBalesHub`, `FactorySupplierHub`, `FactoryFinanceHub`, `FactoryPartiesHub`, `FactoryProductionIntelHub`, `DailyProductionReport`, `FactoryKpis`, `FactoryProfitability` | Scroll strip, one row |
| Factory sales | `FactoryLoadingsHub`, `FactoryInvoicing`, `FactoryDispatchBatches` | Manual underline rows and header buttons converted to `PillTabButton`. "New batch" stays a separate action |
| Factory people | `FactoryPayrollHub`, `FactoryWorkersHub`, `FactoryEmployeesHub`, `factoryworkers/FactoryWorkersView`, `factoryworkerdetail/FactoryWorkerDetailView`, `factorypayroll/FactoryPayrollView`, `FactoryAdvancesTab`, `FactoryCustomerStatement` | Workers and Employees section dropdowns became tab strips. The test ids are now `tabs-workers-section` / `tab-workers-*` and `tabs-employees-section` / `tab-employees-*` |
| Factory stock | `BaleStockEntry`, `FactorySheetsAndSacks`, `FactoryImport`, `FactoryBaleRelabeling`, `WipersReEntry`, `FactoryStockAllocationV3`, `production-raw-stock/RawStockRecalculate` | Shared pills. Relabeling and Wipers Re-Entry stay route-backed |
| Status Builder | `FactoryStatusBuilder`, `factorystatusbuilder/components/TabLabel` | Editable pages are `role="tab"` inside a `TabsList`, with arrow keys, Enter/Space to select and F2 to rename (double-click still works). "Add page" sits beside the list |
| POS settings and Supplier Partner | `settings/PosSetupHub.tsx`, `sp/SpGoldenCoast.tsx`, `sp/SpReports.tsx` | Scroll strip. POS checkout and cart navigation unchanged |
| Properties | `properties/PropertiesRentalsHub.tsx`, `property-rental/components/UnitActionDialog.tsx` | Rental hub and all three unit-dialog layouts (formerly fixed grids) |
| Settings and admin | `settings/SessionsHub.tsx`, `settings/ApprovalsPage.tsx`, `settings/ExportCenter.tsx`, `settings/FileStorageAndExport.tsx`, `settings/datatoolstab/components/MergeStockItemsLauncher.tsx` | Standard pills, including the formerly underlined approval tabs |
| Shared dialogs | `CombinedImportDialog.tsx`, `ImportStockItems.tsx`, `stockitemdetailsdialog/StockItemDetailsDialogView.tsx`, `FactoryCatalogTranslationEditor.tsx`, `NotificationsCenter.tsx`, `suppliers/SupplierDetailDialog.tsx` | Independently scrollable strip inside the dialog |

Every other page that imports the shared primitive inherits the design without a page-level change.

**Deliberate exclusions:** `Vouchers.tsx` / `vouchers/VoucherTabNav.tsx` (route sidebar and phone sheet), `FactoryProduction.tsx` (primary vertical navigation), the three `FactoryStockAllocationV5` filters (independent toggles), the Settings primary sidebar and phone section picker, the remote-support browser-tab selector, view-mode switches, progress steps, report filters and action buttons.

## Phase 8 audit and verification

### Defects found and fixed

| # | Problem | Fix |
| --- | --- | --- |
| 1 | **Arrow keys did nothing on any tab strip in the running app.** `useGlobalScrollKeys` (a capture-phase window listener) treated a focused tab as a scroll request and called `preventDefault()` whenever any sideways-scrollable region existed, so `TabsList` saw an already-handled event. Isolated unit tests missed it because they did not mount the shell handler. | The handler skips Left/Right/Home/End when the target is inside `[role="tab"]`. A regression test mounts both. |
| 2 | Inactive tabs set `aria-controls` to panels that are never mounted (dangling ARIA references). | `aria-controls` is set only on the selected tab. |
| 3 | A height-only `resize` (mobile toolbars collapsing during vertical scroll) snapped the strip back to the selected tab, undoing the user's sideways swipe. | The window listener reacts to width changes only. Container changes still go through `ResizeObserver`. |
| 4 | `FactoryWorkersView` wrapped panels that already render their own `TabsContent`, creating nested tabpanels with duplicate ids. | Wrapper removed. |
| 5 | Status Builder: "Add page" (not a tab) sat inside the tablist. Editable tabs had no focus ring, no keyboard rename and no auto-reveal, and the delete control had no accessible name. | Button moved beside the list. Focus ring, F2 rename, `useActiveTabVisibility` and `aria-label` added. |
| 6 | Tabs dropped to 36px on touch devices at or above 640px (phone landscape, tablets), and in dialogs, which portal outside `#main-content`. | Coarse-pointer rule in `mobile-browser-compat.css` keeps 44px. |
| 7 | RTL fade rules relied on `:dir()` alone; browsers without it showed the fade on the wrong edge. | Forgiving `:is(:dir(rtl), [dir="rtl"] *)` fallback. |
| 8 | The Workers/Employees tab conversion made the Attendance panel reachable from the page button sweep, exposing a crash when the API omits `employees`/`attendance`. | Null-safe iteration. Behaviour with real data unchanged. |
| 9 | CI blockers introduced on the branch: 7 frontend tests failing, the Phase 6 and Wave 2 static verifiers failing on obsolete tokens (`touch-pan-x`, Factory Import `overflow-x-auto`), this doc missing from `config/doc-index.json` and `docs/README.md`, 48 changed files failing the changed-file Prettier check, and `FactoryStatusBuilder.tsx` growing past the 900-line cap. | Tests and verifiers updated to the intended new contracts (not weakened: each still asserts the behaviour, for example that `touch-pan-x` is absent so vertical swipes work). Doc indexed. Changed files formatted. File kept at 900 lines. |

New behaviour tests: `tests/ui/universal-pill-tabs.test.tsx` covers ARIA wiring, Home/End/arrow navigation with wrap, skipping disabled and hidden tabs, RTL arrow direction, coexistence with the global scroll-key handler, `PillTabButton` strips, and width-only reveal. Three of these fail without the Phase 8 fixes.

### Automated results (12 October 2026, local container)

| Check | Result |
| --- | --- |
| `npm run check` (TypeScript) | Pass |
| `npm run lint` + `audit:lint-ratchet` | Pass: 3,799 files, 0 errors, 0 warnings |
| Prettier on every changed file (CI's changed-file check) | Pass |
| Frontend suite (`vitest.config.frontend.ts`) | Pass: 2,236 / 2,236. As pushed at the end of Phase 7: 7 failures |
| `npm run build` (client, server bundle, runtime dependency checks) | Pass |
| Static verifiers: Phase 6 core ERP, Phase 7 Factory, Waves 2–3, Phase 11 matrix, Program 7a/7d, Phase 1 critical flows, `audit:ux-consistency`, `audit:doc-index`, `audit:type-escapes`, god-file boundaries | Pass |
| Browser smokes on the built app with a disposable Postgres fixture: Waves 2, 3, 4 | Pass: 54, 138 and 126 cases |
| Phase 9 language smoke (English, Arabic, French at phone, tablet and desktop) and Phase 1 browser smoke | Pass, 30 Phase 1 cases, using the versions on `main` (#2175). The copies at this branch's base predate #2173's collapsed-sidebar and touch-opacity changes and fail identically on the base commit |
| Factory mobile browser suite (`verify-factory-mobile-browser.mjs`, strict seeds/tables) | Pass: 528 cases |
| Backend suite (`vitest.config.ts`) | Not meaningful in this container: DB-backed files fail identically on the base commit. The branch changes no server or shared code |

### Rendered tab-strip matrix

A Puppeteer script (kept outside the repository) logged in to the built app and measured every visible `TabsList` on 30 routes covering every migrated area. It checked one row, no wrapping, no clipped labels, pill radii, tab height, a single distinct selected tab kept in view, page horizontal overflow, correct fade state, RTL order and direction, and arrow-key selection without page scroll.

| Configuration | Routes | Result |
| --- | --- | --- |
| 320, 375, 390, 430 px (touch) | 30 each | Pass |
| 768, 1024 px (touch) | 30 each | Pass |
| 1280, 1440, 1920 px (desktop) | 30 each | Pass |
| Phone landscape 844×390 | 8 | Pass |
| Arabic RTL at 390 and 1440 | 8 each | Pass |
| French at 390 | 8 | Pass |
| Dark theme at 390 and 1440 | 8 each | Pass |
| 125% root text at 390 | 8 | Pass |
| 200% zoom (1280 wide at DPR 2) | 8 | Pass |

The script ran 334 route/configuration cases with no layout or design failures. In the first run its keyboard probe flagged 11 cases where focus moved after selection. In those cases the newly shown panel autofocuses its scan or search input (Stock, Accounts Find Voucher, Bales barcode, Stock Entry), or the tab is route-backed (Bale Relabeling). In every case selection moved correctly. The probe now judges selection rather than focus.

### Not verified

- **Real devices, Safari/WebKit and Firefox:** the only browser available was Chromium (headless, with device emulation). iPhone Safari momentum scrolling, Firefox rendering and real touch gestures were not exercised.
- **Real swipe gestures:** emulated, not performed. Touch behaviour is asserted through computed `touch-action` and layout only.
- **Production data and permission matrices:** the disposable fixture signs in as one Developer user. Permission-restricted tab visibility is covered by the existing unit suites (`hub-restricted-tabs`, `factory-tab-route-restrictions`, `factory-opt-in-tabs`, `factory-permission-query-gating`), not by rendered role-by-role runs.

## Phase 8 status

All in-scope defects found in the audit are fixed, and every check that can run in this environment passes. The branch merges cleanly with current `main` (verified with `git merge-tree`; not merged). On `main`, #2175/#2176 update the browser-smoke and source-text ratchet files that fail at this branch's base. A pull request is tested against the merge with `main`, so it picks those up.

Outstanding before production: real-device Safari/iOS and Firefox checks, and a role-by-role permission walkthrough on staging. No merge to `main` and no deployment has been performed.
