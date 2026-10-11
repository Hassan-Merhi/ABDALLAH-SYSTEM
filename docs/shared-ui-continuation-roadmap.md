# Shared UI Architecture Continuation Roadmap

**Repository:** `Hassan-Merhi/ERP-FACTORY-SYSTEM`
**Working branch:** `refactor/shared-ui-standardization-phases-1-5`
**Latest completed implementation phase:** 4
**Current next phase:** 5
**Created:** 2026-10-12

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
- **Phase 5 — Cross-module adoption and consistency:** NEXT. Address
  noncanonical form, tab, page-state, badge, toolbar and table implementations
  across the remaining modules. Consolidate duplicate presentation components,
  replace obsolete compatibility imports safely, and update developer-facing
  conventions. Do not add or run CI workflow gates.
- **Phase 6 — Accessibility and behavior hardening:** PLANNED. Improve
  focus/keyboard semantics, form labeling, loading/empty/error feedback,
  responsive mobile layouts, RTL and accessible submission affordances in the
  areas not migrated during Phases 1–5.
- **Phase 7 — Architecture debt and dead-code cleanup:** PLANNED. Address
  residual duplicated client services/hooks, unused exports and dead UI
  helpers where they can be removed without changing API or domain behavior.
  Avoid deleting code based solely on an absence from one search; account for
  dynamic imports and test-only callers.
- **Phase 8+ — New phases:** add whenever concrete unaddressed opportunities
  are discovered. Record the exact scope, source evidence and safe boundaries
  here, and continue them on the same branch.

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
