# Shared UI components — Phase 1

Phase 1 makes previously duplicated UI implementations share a single source of truth.
It changes **presentation only**: routes, permissions, calculations, APIs, queries, and
form submissions are deliberately outside this phase.

## Canonical implementations and imports

| Concern | Canonical implementation | Standard import |
|---|---|---|
| Page layout | `ui/page-shell.tsx` (`PageShell`) | `@/components/ui/page-shell` |
| Page action bar | `ui/page-shell.tsx` (`PageActions`) | `@/components/ui/page-shell` |
| Page header | `components/PageHeader.tsx` | `@/components/PageHeader` |
| Full empty/loading/error/success state | `ui/page-state.tsx` | `@/components/ui/page-state` |
| Compact empty state | `ui/empty-state.tsx` compatibility adapter | `@/components/ui/empty-state` |
| Skeleton layouts | `components/LoadingSkeleton.tsx` | `@/components/LoadingSkeleton` |
| Status badges | `components/StatusBadge.tsx` | `@/components/StatusBadge` |
| Actions, forms and other primitives | `ui/` | Direct source import |

`@/components/shared` also re-exports the public shared interface for consumers
that need several primitives. Direct canonical imports are supported and
recommended for feature-level code to avoid pulling a broad UI barrel into
every lazy-loaded page.

## Supported page layouts

- `<PageShell layout="workspace">`: default for new ERP, Factory, POS and
  Properties pages; no extra page padding. Old `WorkspacePage` delegates here.
- `<PageShell layout="padded">`: historical report page spacing, preserving
  existing `PageShell` callers.
- `<PageShell layout="core-erp" as="section">`: phone-friendly ERP page spacing,
  preserving the existing `CoreErpPage` wrapper and its `data-core-erp-page`
  marker.
- `<PageActions layout="responsive">`: shared two-column phone action
  arrangement, used by `WorkspaceActions`. `compact` retains the legacy
  `PageActions` layout.

**Never combine two of these containers on a single page.** Pick the variant
that matches that screen; do not add wrapper padding on top of workspace
padding. These wrappers remain compatible and delegate to the same implementation.

## Page states

`PageState` owns the UI for panel-style empty/loading/error/success states.
The compact `ui/empty-state.tsx` API is retained for older callers that supply
an `action` React element rather than an `actionLabel` callback. The adapter
uses `PageState layout="legacy"` so there is no competing renderer.

Use `LoadingSkeleton` for a visual loading placeholder when the page shape
is known; use `LoadingState` for simple messaging and loading feedback.
Every `LoadingSkeleton` variant now supplies an accessible loading status.
Do not render both for the same request.

## Statuses

`StatusBadge` owns a semantic status-to-color/icon registry, including
shared accounting, scanning, operational, migration, and profit statuses.
Domain-level badge wrappers remain only where they adapt business-specific
labels or props (e.g. a transporter statement's **remaining amount**).
The wrappers no longer decide colors/icon treatments independently, except
where a stock-allocation workflow intentionally preserves its existing
status-specific colors.

When adding a new status, extend the shared registry once. Do not introduce
another hard-coded green/red/amber badge mapper in a page.

## Not part of Phase 1

Tab interaction/appearance belongs to Phase 2, table/filter adoption and
saved preferences to Phase 3, financial formatting and form behavior to
Phase 4, and automated consistency gates to Phase 5.

Per request, Phase 1 was implemented without executing tests, CI, linters,
or build verification. The changes should be verified before production use.
