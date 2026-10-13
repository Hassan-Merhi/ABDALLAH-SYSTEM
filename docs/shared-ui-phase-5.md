# Shared UI Standardization — Phase 5

**Status:** Core cross-module adoption implemented and committed on
`refactor/shared-ui-standardization-phases-1-5` on 2026-10-12.
**Validation:** No tests, typecheck, lint, builds, CI checks or deployments were
performed as requested. The source changes are not production verified.

## Purpose

Phase 5 increases adoption of the primitives from Phases 1–4 across
ERP, Factory, POS, Settings, Payroll, Properties, Accounting and Inventory
without replacing domain-specific services, permissions, transaction logic,
historical currency treatment, or workflow APIs.

## Shared component improvement

- New `client/src/components/ui/search-field.tsx` is the canonical controlled
  standalone search input. It provides a leading search icon, optional clear
  button, accessible input labeling, responsive outer layout, and forwarding of
  ordinary input props including keyboard handlers, autofocusing and test IDs.
  The owning component retains debounce and result filtering.
- `DataTableToolbar` now composes `SearchField`; there is one
  implementation of the icon/input/clear behavior rather than another bespoke
  copy for every table.
- `StatusBadge` now recognizes `critical`, `verified`, and
  `finalized`, allowing Factory alerts and invoices to use the same semantic
  status palette as other modules.
- `LoadingState` forwards ordinary PageState div attributes so feature pages
  can preserve accessibility properties and existing test IDs.
- `ConfirmDialog` supports separately configurable cancel and confirm
  test IDs, preserving automation hooks during deletion-dialog migration.

## Module migrations

| Module | Migrated screens | Shared replacements |
|---|---|---|
| Accounting | Account Groups, Find Voucher | SearchField |
| Agent Ledger | AgentListPanel | SearchField |
| Container/stock | ContainerFilters, StockOTW, OffloadItemSearch | SearchField |
| Inventory | Location AllItemsView | SearchField |
| Payroll | WorkersTab, EmployeeCrudDialogs, WorkerDialogs | SearchField, MoneyInput, pending submit |
| Bales | BalesTable | SearchField, PageState, StatusBadge, mobile record cards |
| POS | RetailCustomerPicker, POS PriceList table empty state | SearchField, PageState |
| Settings | AuditLog, AddUserDialog (`UsersTable`/`CompaniesTable` were unreferenced and removed in Phase 8) | SearchField, StatusBadge, pending submit |
| Factory | FactoryAlerts, FactoryPendingInvoices, FactoryPriceList, FactorySuppliersDirectory, insurance MemberFormDialog, sheets-and-sacks ItemFormDialog | SearchField, StatusBadge, PageState, ConfirmDialog, FormGrid, numeric inputs, single-flight submit |
| Other lists | DataTableToolbar | SearchField composition |

The Factory invoice delete confirmation uses awaited `mutateAsync`, maintains
the contextual text about restoring assigned bales, prevents repeated confirms
and retains the original per-invoice trigger/confirm/cancel test IDs.
The insurance member save now uses the shared one-flight async guard without
changing its mutation payload. The sheets-and-sacks quantity fields retain
nonnegative values with explicit integer step.

## Representative commits

- `2b3f0a78c33af873c98a05fd37644fdd4a23d7d9` — shared search field.
- `c60c19696a66e666f54d116978fe30b44009f31d` — initial module search adoption.
- `cc840f5b668b9e8142c309495aa07ee1519a6a2d` — additional modules and bale states.
- `7afcb1d4f82343ac066eb902cbcffa6328eaafae` — status and alert adoption.
- `d50391717acf15df2161057fb489e9a04a4a1150` — loading-state attribute forwarding.
- `21ac0a6c720f457ba3f823d71be954109cf3705e` — audit/price-list searches and forms.
- `c4ab8e59dfeed4c21faf031a3529d297227456b7` — payroll and manufacturing form adoption.
- `3431f69977d946784f0e78e7eae611aa4dec155d` — awaited pending-invoice deletion.

## Boundaries and future work

The phase establishes shared UI adoption across major areas. It does **not**
claim that every specialized form, table, report, modal, dropdown, stock
allocation grid, or dynamic module in the repository was migrated; replacing
them all without tests could damage accounting, POS keyboard workflows or
inventory selection semantics.

- Phase 6 owns unaddressed accessibility and interaction hardening, including
  keyboard/focus/RTL semantics, correct mobile layouts and error feedback.
- Phase 7 owns architectural dead-code deduplication and safe compatibility
  removal after callers are accounted for.
- Future phases may continue lower-priority specialty-module UI adoption as
  evidence and risk allow.

**No Render CI configuration was changed, no checks executed, and no branch
was merged or deployed.**
