# Pressing Scan — Simplified Ground Scan Mode

This specification supersedes the previously implemented complicated Phase 2 and Phase 7 UI.

## What workers see

Factory > Stock Entry > Pressing Machines uses a simplified role-specific layout:
- **Admin / Owner:** full barcode input, Scan action, continuous camera, scan status/sync details, full-company date/user/status filters, corrections and Excel export.
- **All other roles:** **Open Camera / Close Camera** and their own scanned-bale list with totals. No manual barcode field, sync/settings panel, report filters, export, or supervisor actions. When Pressing Machines is their only Stock Entry section, omit the Stock Entry header, print settings, daily production KPIs and tab switcher as well. The camera starts on Open Camera and releases on Close Camera; confirmations appear in the camera panel. The worker's list defaults to all time, with pagination for long histories.

Only the existing user/page permission must be configured. A permitted employee opens the page, and the server automatically creates an internal station and assignment if needed. Every accepted scan records the authenticated user, not a configured shift operator. Workers can see only their own results. Admin and Owner can filter by employee; Manager and Developer do not receive elevated pressing history access.

## Removed from the active system

- Configured shifts, shift schedules, shift selection and shift productivity analysis.
- Machine downtime controls and machine-down scan blocking.
- Productivity reports, bales/hour, KG/hour and machine targets.
- Manual machine management, employee-machine assignments and machine history UI.
- Advanced report saved-view/column configuration UI.

The Phase 7 operation routes are no longer registered. The former manual machine management routes are replaced by restricted authenticated GET /me and POST /activate endpoints under /api/factory/pressing-machines. The shared internal station is needed only for existing schema foreign keys. New pressing confirmations have shift_id=NULL and use company timezone settings for production_date.

## Preserved

Permanent server history, barcode uniqueness across users, immutable audit corrections, supervisor-only voids and rescans, safe offline retries, original request IDs, exact timestamps including seconds, and Excel export of filtered rows.

The existing PostgreSQL pressing schema remains untouched. Do not drop shift/machine/downtime tables because earlier records or foreign keys may reference them. If the two pressing migrations were already executed in TablePlus, no additional SQL is required for this simplification.

A pressing scan NEVER changes Factory bale stock status, stock counts, raw-material costs, or accounting vouchers.

## Verification

Updated tests include simplified permission and user initialization contracts, offline confirmation, report filtering and a real-PostgreSQL integration suite covering automatic activation, concurrent duplicate scans, actor/company isolation, immutable corrections and unchanged stock.

Local TypeScript checks, Vitest tests, isolated PostgreSQL tests and real-phone camera verification remain required before merging/deploying.

October 27, 2026 follow-up: feature/pressing-worker-camera-only-20261027 narrows the operator UI and Admin/Owner-only report/correction authorization.