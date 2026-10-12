# Shared UI Architecture Continuation Roadmap

**Repository:** `Hassan-Merhi/ERP-FACTORY-SYSTEM`
**Working branch:** `refactor/shared-ui-standardization-phases-1-5`
**Latest completed implementation phase:** 7
**Current next phase:** 8 — Claude verification handoff
**Created:** 2026-10-12
**Last implementation checkpoint:** Phase 7 (2026-10-12)

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
- **Phase 8 — Claude review, validation and fixes:** NEXT — **not executed**.
  Claude should run independently authorized verification, repair issues on
  this same branch, and report readiness; see
  `docs/shared-ui-phase-8-claude-handoff.md`. No merge/deployment without
  explicit user authorization.
- **Phase 9+ — Additional implementation if Claude finds issues:** define
  only from concrete evidence and implement on the same branch. Keep Phase 8
  validation and production approval as separate steps.

## Continuation instructions

At each recurrence, continue **as much of the next unfinished phase as
possible** and make real code changes, not just a plan. If a phase is
incomplete after the run, record exact next files and keep it active. When
complete, mark it implemented, create the next logical phase if necessary,
and continue. Do not call a phase production-ready merely because its code
was committed.

**Explicit constraints:**
- No test, lint, type-check, build, CI, browser/e2e, Render, or production
  verification commands. Render handles deployment CI independently.
- Never disable or remove existing Render checks or security safeguards.
- One long-lived branch for all implementation waves.
- Do not merge into `main`, create a release, deploy, or alter production.
- Preserve accounting calculations, historical FX rules, permissions,
  mutation behavior, route/query state and company scoping.
- Document unverified changes plainly. When action permissions or repository
  access are unavailable, report the limitation instead of fabricating work.
