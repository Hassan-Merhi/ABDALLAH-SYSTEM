# Shared UI Architecture Continuation Roadmap

**Repository:** `Hassan-Merhi/ERP-FACTORY-SYSTEM`
**Working branch:** `refactor/shared-ui-standardization-phases-1-5`
**Latest completed implementation phase:** 8
**Current next phase:** 9 — Follow-up adoption and remaining cleanup (optional)
**Created:** 2026-10-12
**Last implementation checkpoint:** Phase 8 (2026-10-12)

Use this file as the resumable checkpoint for scheduled continuation. At the
start of each future run, read this file from the working branch, inspect the
latest code, and prioritize the first incomplete phase. Make direct, scoped
commits on the **same branch**. Update this file with completed work, exact
commit SHAs, remaining gaps and the newly chosen next phase.

## Phase status

- **Phase 1 — Common UI foundations:** implemented. Page shells, action
  bars, status badges, empty/loading presentations. See
  `docs/shared-ui-phase-1.md`.
- **Phase 2 — Shared responsive tabs:** implemented. Unified desktop/phone
  presentation and keyboard interactions, migrated selected hubs. See
  `docs/shared-ui-phase-2.md`.
- **Phase 3 — Tables, filters, pagination and view preferences:** implemented
  for canonical primitives and selected ERP, Factory, POS, Properties and
  Settings lists. See `docs/shared-ui-phase-3.md`.
- **Phase 4 — Forms, monetary display and protective actions:** implementation
  committed. See `docs/shared-ui-phase-4.md`.
- **Phase 5 — Cross-module adoption and consistency:** IMPLEMENTED.
  Consolidated controlled SearchField, unified semantic status and page states,
  applied shared forms, improved async confirmations, and migrated selected
  workflows across Accounting, Agents, Bales, Stock, Inventory, Payroll, POS,
  Settings and Factory. See `docs/shared-ui-phase-5.md`. Most recent Phase 5
  implementation commit: `3431f69977d946784f0e78e7eae611aa4dec155d`.
  Remaining specialized-module UI adoption is not automatically considered
  production-verified and may be incorporated into subsequent targeted waves.
- **Phase 6 — Accessibility and behavior hardening:** IMPLEMENTED.
  Hardened shared search/tabs/table/filters/pagination/confirmations and
  migrated representative Factory, POS and inventory workflows for labelled
  fields, keyboard actions, recoverable API errors, phone touch targets, RTL
  and safe async form closing. See `docs/shared-ui-phase-6.md`.
  Last implementation commit: `8085a97a7a5d1ad6d4e35f80d4ec96a0e7a19983`.
  Accessibility has NOT been certified or tested.
- **Phase 7 — Architecture debt and dead-code cleanup:** IMPLEMENTED.
  Unified browser fetch-request and pagination key helpers across seven
  interceptors; consolidated legacy flat-list pagination and two debounce
  hooks; removed redundant local interfaces and confirmed dead imports.
  All existing side-effect entry points and tenant-scoped query cache keys
  were retained. See `docs/shared-ui-phase-7.md`. Last implementation
  commit: `9cc134fa285ceba998ca696a2e07a22dced6a7b7`.
  No checks run and no claim that the entire repository has zero dead code.
- **Phase 8 — Claude review, validation and fixes:** EXECUTED on
  2026-10-12 on the review branch `claude/erp-phase-8-review-iyue1u`, which
  was created from the tip of this branch (`df6e48d`) with `origin/main`
  merged in. Independent review of the full Phases 1–7 diff, real
  verification runs (typecheck, lint, Prettier gate, frontend suite, build,
  doc-index, UX/accessibility/pagination verifiers) and fixes for every
  confirmed defect. See `docs/shared-ui-phase-8-claude-handoff.md` for the
  execution record: issues found, fixes, commands and results, and the
  remaining limitations. Fix commit: `7612c13` (after Prettier commit
  `0c94488`). Backend tests and the browser smokes were not run
  locally (database and browser fixtures are CI-provided); Render CI remains
  the final gate before merge.
- **Phase 9 — Follow-up adoption and remaining cleanup:** defined from Phase 8
  evidence, not started. Scope: (1) adopt the shared toolbar, view options and
  pagination in the live Settings Users/Companies tabs (the standalone tables
  Phase 3 migrated were unreferenced and have been removed); (2) migrate the
  remaining hand-rolled search inputs (about 85 files still render an absolute
  `Search` icon over an `Input`) and the inline `setTimeout` debounces (15
  files) to `SearchField`/`useDebounce`; (3) fold the remaining per-page
  status colour maps (stock entry history, shipping containers, bale import
  history, batch detail, attendance, dispatch batches, payroll, bale
  tracking, supplier dialogs, AI command center) into the `StatusBadge`
  registry; (4) decide the Properties-module currency prefix (`FC` in
  `property-rental/utils.tsx` versus the app-wide `CFA`) and align
  `RentalPaymentsLog`; (5) optional: let Radix own `ConfirmDialog` closing so
  `onCancel` fires exactly once on Cancel and also on Escape. Each item is
  presentation-only and must keep calculations, permissions and routes intact.

## Continuation instructions

At each recurrence, continue **as much of the next unfinished phase as
possible** and make real code changes, not just a plan. If a phase is
incomplete after the run, record exact next files and keep it active. When
complete, mark it implemented, create the next logical phase if necessary,
and continue. Do not call a phase production-ready merely because its code
was committed.

**Explicit constraints:**
- Phases 1–7 were implemented without test, lint, type-check, build, CI,
  browser/e2e, Render, or production verification commands. Phase 8 ran the
  repository's own checks locally (see its execution record); Render and the
  GitHub workflows remain the deployment gate and were not changed.
- Never disable or remove existing Render checks or security safeguards.
- One long-lived branch for all implementation waves.
- Do not merge into `main`, create a release, deploy, or alter production.
- Preserve accounting calculations, historical FX rules, permissions,
  mutation behavior, route/query state and company scoping.
- Document unverified changes plainly. When action permissions or repository
  access are unavailable, report the limitation instead of fabricating work.
