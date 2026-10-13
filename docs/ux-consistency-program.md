# Cross-Module UX Consistency Program

## Completion definition

UX consistency is complete when every authenticated route inherits the same workspace-level safeguards and every filter-heavy operational list uses a versioned, company-scoped filter contract with a visible reset-all action.

The repository enforces this with `npm run audit:ux-consistency` and the Mobile Responsiveness workflow.

## Global module coverage

All lazy-loaded page surfaces render inside one of four authenticated shells:

- ERP
- Factory
- POS
- Properties

Supplier Partner routes use the ERP shell. Each shell must render its route switch inside `WorkspaceRouteBoundary`, which provides:

- mobile touch targets for buttons and fields;
- form, image, dialog, tab, table, and horizontal-scroll containment;
- consistent accessible loading feedback;
- route-level error recovery;
- shared EN, French, and Arabic RTL document behavior through the application language provider.

The audit derives the module inventory directly from `client/src/lazyPages.ts`. New lazy modules are therefore included automatically and cannot bypass the shell contract silently.

## Filter-state coverage

The following high-risk list workflows have versioned persistence, company isolation, pagination reset where applicable, corrupt-storage recovery through the shared hook, and a visible reset-all action:

- Daybook
- All Daybook / Transaction Journal
- Factory Daybook
- Stock Items
- Customers
- Suppliers
- Stock Transfers
- POS Daybook
- POS Customers
- Factory Containers

Use the common responsive tab components described in `docs/shared-ui-phase-2.md` when a page switches between tabbed panels; keep route/query state and access filtering in the page.

Follow the shared table/filter/pager contracts documented in
`docs/shared-ui-phase-3.md` rather than introducing new table toolbars,
independent mobile sheets, or repeated client-side pagination calculations.

Use `usePaginatedFilterState` for new list workflows. A page with no pagination may ignore the returned page state, but it must still scope the storage key to the selected company whenever its data is company-owned.

## Rendered release gate

The pull-request browser fixture creates disposable ERP, Factory, Properties, and Supplier Partner companies. The multilingual smoke switches between those companies and visits the primary accounting, inventory, list, dashboard, and operational routes in:

- English, French, and Arabic RTL;
- phone, tablet, and desktop viewports.

The gate rejects root horizontal overflow, missing application shells, missing skip navigation, wrong language or direction metadata, protected business identifiers rendered RTL, failed documents or assets, browser runtime errors, and unexpected permission redirects.

## Adding a module

1. Register the lazy page normally in `client/src/lazyPages.ts` and its workspace router.
2. Keep the route inside the existing shell; do not create another authenticated `<main>` element.
3. Use the canonical shared UI primitives specified in `docs/shared-ui-phase-1.md` (page layout, empty/loading states, status badges), then the existing dialog, table, form and report primitives.
4. For filter-heavy lists, use the shared persisted filter hook and add a reset-all control.
5. Add the route to the rendered workspace matrix when it introduces a new interaction pattern rather than duplicating an already-covered list or detail pattern.
6. Run `npm run audit:ux-consistency`, the frontend suite, and the responsive Phase 11 verifier.

## Form and action reuse (Phase 4)

The canonical form inputs, explicit-currency display, and protective async
actions are documented in `docs/shared-ui-phase-4.md`. For incremental
adoption, use `FormSubmitButton`, `MoneyInput` and
`useSingleFlightAction` while preserving existing domain mutation callbacks.
The scheduled no-checks architecture waves are tracked separately in
`docs/shared-ui-continuation-roadmap.md`; they do not disable or change
the project's existing CI configuration.

## Cross-module adoption (Phase 5)

The canonical `SearchField`, semantic `StatusBadge`, page states,
`FormSubmitButton`, currency-specific amount controls, and awaited
`ConfirmDialog` have been adopted across additional feature screens.
See `docs/shared-ui-phase-5.md` for migrated screens and remaining
specialized-workflow boundaries. Phase 6 continues focus, keyboard,
responsive and RTL hardening; see
`docs/shared-ui-continuation-roadmap.md`.

## Accessibility and interaction hardening (Phase 6)

Shared controls now include better RTL focus handling, labelled pending
actions, key-activated record rows, error-versus-empty messaging and
associated form labels in the migrated workflows. See
`docs/shared-ui-phase-6.md` for precise behavior and remaining boundaries.
These changes were committed without running checks at the user's request;
Render's independent verification is not replaced by this checkpoint.

## Phase 7 — Safe architecture consolidation

Fetch-request mechanics, stable pagination cache keys, legacy paginated
list assembly and debounce timer behavior were deduplicated without removing
legacy import paths. The targeted changes and remaining boundaries are
documented in `docs/shared-ui-phase-7.md`.

## Phase 8 — Review and validation

Phase 8 independently reviewed the Phases 1–7 diff, ran the repository's
typecheck, lint, Prettier, frontend, build and audit gates, and fixed every
confirmed defect on the branch. The execution record, commands, results and
remaining limitations (backend suite and browser smokes are CI-run) are in
`docs/shared-ui-phase-8-claude-handoff.md`; follow-up adoption work is
scoped as Phase 9 in `docs/shared-ui-continuation-roadmap.md`.
