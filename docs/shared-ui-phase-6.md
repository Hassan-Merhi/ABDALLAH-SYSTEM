# Shared UI Phase 6 — Accessibility and Interaction Hardening

**Implementation:** committed 2026-10-12 on `refactor/shared-ui-standardization-phases-1-5`.
**Quality/deployment:** NO tests, lint, typecheck, builds, browser/e2e, CI, or Render checks have been run for this phase; no merge or deployment. This is an implementation checkpoint, not an accessibility audit or production certification.

## Shared interaction primitives

- `ui/search-field.tsx`: RTL-safe logical icon/padding placement, search clearing
  that restores focus to the input, optional Escape-to-clear behavior, a
  large phone clear target, and accessible search naming. The owner continues
  to control all filtering, selected records and debounce behavior.
- `ui/tabs.tsx`: tablist has an accessible name. Keyboard navigation continues
  to honor horizontal/vertical orientation and RTL direction. Phase 8 restored
  the horizontal-only `scrollLeft` delta for keeping the active tab in view:
  `scrollIntoView` also scrolls the page vertically on deep links, and a
  relative `scrollLeft` delta is direction-agnostic in modern engines.
- `TableViewOptions`: density is a single-selection radio group, while
  column visibility remains a checkbox group. Required identifying columns
  stay locked visible.
- `PaginationBar`: descriptive navigation labels, sensible mobile button
  target sizes and a single live announcement of the visible result range.
- `ui/table.tsx`: restacked mobile record cards no longer create an extra
  focusable scroll region; wide tables retain a keyboard-accessible labelled
  scroll area. The sticky first column uses RTL-aware logical positioning.
- `ui/erp-mobile-filters.tsx`: filter sheet trigger is a named region, rather
  than a search landmark that misrepresents non-search filtering.
- `ConfirmDialog`: focus moves to the newly displayed heading on double
  confirmation and to a visible error after async rejection; missing
  descriptions get an accessible fallback. Busy operations remain locked
  and cannot close as if successful.

## Feature screens

- Factory invoices: keyboard-operable review rows (Enter/Space); nested
  export/delete controls do not trigger row navigation. Each action has a
  specific accessible name. Status-filter buttons expose `aria-pressed`,
  the group has a name and phone layouts gain compact safe padding. A failed
  query is distinct from an actual empty invoice list, with retry actions.
- Stock on the way: expandable rows work with Enter/Space, the dedicated
  expand button exposes `aria-expanded` and an item-specific name, and its
  click does not toggle the row a second time.
- POS customer selection: expanded state and associated region IDs, explicit
  result group/busy semantics, keyboard-visible choices with phone-sized
  targets, separate no-match versus query-failure announcements and retry.
- POS split-payment panel: each payment method/amount/tendered/reference
  field is associated with a distinct label; multiple payment rows have
  distinct accessible IDs and remove-action names.
- Factory customer, contact, insurance, price-line and sheets-and-sacks
  forms: explicit field label associations, named repeated phone inputs,
  selectable color swatches with accessible labels and pressed state,
  responsive field grids, pending dialog-close guards, and local save-failure
  feedback. Financial input values and accounting semantics remain owned by
  their existing modules.
- Factory alerts: distinguish service failure from an empty alert feed, show
  failed generate/mark-as-read feedback, and allow retrying failed fetches.
- Bale lists: loading skeletons have a nonvisual status announcement, mobile
  padding remains usable, and icon-only delete actions are named.

## Accessibility conventions

1. Use stable `id` + `htmlFor` for labeled native or Radix fields. Repeated
   rows must have distinct IDs; use React `useId()` if multiple instances of
   the dialog can exist in one DOM tree.
2. Every icon-only action needs an `aria-label` that identifies both the
   action and its record. Stateful toggles must communicate pressed/expanded
   state. Do not turn a table row into the only keyboard path to an action;
   retain real focusable buttons or links.
3. Distinguish loading, API failure and empty results. Failed mutations should
   remain recoverable; never claim success solely because a dialog closed.
4. Keep minimum phone touch targets approximately 44px where practical, avoid
   nested scroll/keyboard stops on card layouts, and favor logical
   `start/end` CSS properties over physical `left/right` for directional UI.
5. Preserve the POS barcode scanner's specific keyboard/focus contract;
   generic search controls must not intercept specialized scanner keys.
6. Preserve route/query state, permissions, company-scoped data, inventory and
   accounting mutations, and historical exchange-rate semantics.

## Committed implementation references

- `2cc0f032c3323d5017db0a4e6191479249d35047` — shared UI, RTL and density.
- `202c2cb9acf43d2dd984947304494a16bdf2da31` — keyboard actions and dialog focus.
- `64bf88c62d1eea5a573ec6f75427d8913c8da4b0` — proforma, insurance, POS payment labels.
- `28c0c87fc5c0fe053b7e4ed809998a45a95d8362` — Factory contact/customer/item labels.
- `536cfb26e6e5e6e9551678300a3424397473df49` — retryable errors, phone fields and color controls.
- `5ad1d7377374a427d577780faef086adab50f6bc` — pending dialogs, feedback, touch targets.
- `8085a97a7a5d1ad6d4e35f80d4ec96a0e7a19983` — native RTL tabs, picker and stock/invoice keys.

## Boundaries

These edits address the Phase 6 implementation scope and its highest-value
shared components and migrated screens. They are not proof that every route,
portal, screen reader, RTL language, touch device or keyboard path across the
repository is WCAG-conformant. Render's independent checks and a later
human/assistive-technology review remain necessary before claims of a
verified release; neither was requested or performed in these waves.

The next phase is architecture debt and careful dead-code deduplication,
tracked in `docs/shared-ui-continuation-roadmap.md`. Further issues found in
specialized modules can become evidence-based Phase 8+ work.
