# Phase 8 — Claude Review, Validation and Fixes (handoff)

**Not executed in Phases 1–7.** This is a handoff, not a claim that any
checks were run or that the current branch is production-ready.

Repository: `Hassan-Merhi/ERP-FACTORY-SYSTEM`
Branch: `refactor/shared-ui-standardization-phases-1-5`
Phase roadmap: `docs/shared-ui-continuation-roadmap.md`
Detailed phase summaries: `docs/shared-ui-phase-1.md` through
`docs/shared-ui-phase-7.md`.

## Prompt for Claude

You are the independent senior reviewer for the ERP Factory System
Phases 1–7 implementation on
`refactor/shared-ui-standardization-phases-1-5`. Do not merge or deploy
without explicit approval.

1. Read the phase documents and examine the *actual branch diff* against
   the correct base commit/main, including all changes on the long-lived
   branch. Check for TypeScript/import/runtime errors, React hooks rules,
   invalid component props, duplicated class names and public API breakage.
2. Run the project's existing appropriate typechecks, tests, lint, build,
   frontend interaction checks, responsive checks and existing CI gates
   **at this Phase 8 verification step only**. Do not disable, delete or
   bypass Render CI checks.
3. Pay particular attention to all seven fetch interceptors using
   `fetchRequestUtils.ts`, the two legacy list flattening wrappers using
   `legacyPaginatedListFetch.ts`, and both debounce hook import paths.
   Confirm that fetch chaining, failure responses, Request/URL handling,
   endpoint guards, query cache keys, selected-company isolation and
   side-effect registration are unchanged.
4. Review permission-gated screens, accounting journals, historical
   currency/FX handling, POS barcode keyboard behavior, offline fallback,
   mutations, stock allocations, exports, route/query persistence, and
   deletion confirmation semantics. Fix regressions on this SAME branch.
5. Verify mobile/desktop, keyboard, focus, RTL, screen reader naming,
   touch targets, table cards, financial amount inputs and dynamic dialogs.
6. Audit dead-code candidates by tracing actual imports, lazy routes,
   dynamic strings, backend references, tests and build manifests before
   proposing deletion. Do not mark a code file dead from a filename scan.
7. Report exact commands run, failures observed, commits for fixes,
   remaining risk, and a clear ready/not-ready conclusion. Ask for approval
   before merging or deploying.

**Non-negotiable:** Protect financial/accounting accuracy, historical
currency semantics, tenant boundaries, authorization rules, current Render
configuration and all production data. No fabricated verification results.
