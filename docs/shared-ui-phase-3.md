# Shared Tables and Filters — Phase 3

Phase 3 consolidates list presentation and client-side paging without replacing
the existing `Table`, mobile card renderer, filter hooks, data queries, or
business logic. Source-of-truth components:

| Concern | Canonical code |
|---|---|
| Tables, sticky headers and phone record cards | `client/src/components/ui/table.tsx` |
| Search, filters and actions | `client/src/components/DataTableToolbar.tsx` |
| Advanced phone filter bottom sheet | `client/src/components/ui/erp-mobile-filters.tsx` |
| Column visibility and density | `client/src/components/TableViewOptions.tsx` |
| Versioned table preferences | `client/src/hooks/use-table-prefs.ts` |
| Client-side list pagination | `client/src/hooks/use-client-table-pagination.ts` |
| Pagination footer | `client/src/components/PaginationBar.tsx` |
| Authoritative operational filters | `client/src/hooks/use-paginated-filter-state.ts` |

## Tables and mobile layouts

Use `<Table mobileLayout="cards">` for ordinary record rows on phones;
the same component renders conventional tables on larger screens. Use
`mobileLayout="scroll"` for financial ledgers, import previews, comparison
matrices, and anything that must retain column alignment. The renderer already
handles scrolling and sticky headings. Optional `density="compact" |
"standard" | "comfortable"` changes row spacing only.

## Toolbars and filters

`DataTableToolbar` accepts controlled `search`, `onSearchChange`, `filters`,
`actions`, and `onResetFilters` props. With `mobileFilters`, phone search
stays visible and advanced controls move into the canonical bottom sheet;
desktop displays both search and filters inline. Callers retain all filters,
API parameters, period logic, and permissions.

Reuse `usePaginatedFilterState` for versioned company-scoped operational
filters. Do not store authoritative business filters or user data in view
preferences.

## Pagination

Use `useClientTablePagination(total, pageSize)` only for bounded datasets
already loaded into the browser. It returns a clamped one-based page, page
setter, reset function, total pages, and `paginate(rows)`. Reset to page 1 on
search/filter/page-size changes. Render the result with `PaginationBar`.

For server-paginated lists, keep the server `page`, `pageSize`, `total`,
and `totalPages` query contract. Use `PaginationBar` with the returned
metadata directly and **never** paginate server-sliced results a second time.

## Saved preferences

Use `useTablePrefs("stable-page-key", { companyId })` for company-owned
tables; global admin tables use a global page key. Preferences are stored
locally in a validated versioned record and contain only optional UI values:
column visibility, density, sorting, and page size. Unavailable/corrupt storage
falls back to defaults. Required identifier and action columns must remain
visible, and header/cell visibility must be changed in tandem.

`TableViewOptions` is the shared controlled menu for optional columns and
density. Do not change calculations or authorization based on these settings.

## Adoption in this phase

The following were migrated to common shared building blocks:

- Settings Companies and Users: the standalone `UsersTable`/`CompaniesTable`
  components migrated here were never imported by `Settings.tsx` (before or
  after this phase) and were removed as confirmed dead code in Phase 8. The
  live Settings tabs still use their own tables; adopting the shared toolbar,
  view options and pagination there is tracked as Phase 9 follow-up work.
- Factory Contacts: company-scoped preferences, phone cards, shared search,
  optional columns, row density and shared pagination.
- Factory Customers: common search and pagination; balance calculations and
  zero-balance exclusion remain untouched.
- Factory Containers: shared search, filter reset, and phone filter sheet.
- ERP Customers and Suppliers: shared search and responsive filters while
  preserving their company-scoped persisted filtering.
- ERP Stock Transfers: shared search/date/reset toolbar; no change to data
  retrieval.
- POS Customers: shared search and phone record cards.
- Stock Query: common search input, retaining existing API search limits.
- Properties rental payments log: shared search in both Properties/ERP shells;
  all payment totals continue to use the full filtered dataset.

Existing Daybook/Stock Items/analytics/financial-report modules already
share the core table, pager and/or mobile-filter primitives. Specialized
transactional, export, virtualized, stock allocation and ledger tables are
not converted to generic client-paginated lists because that would risk
changing their calculation, ordering or selection semantics. New pages should
use the consolidated primitives rather than writing bespoke equivalents.

## Release note

This work was committed on `refactor/shared-ui-standardization-phases-1-5`.
At the user's request, no tests, type checking, lint, build, CI, browser
verification or deployment were performed. Production behavior is unverified.
