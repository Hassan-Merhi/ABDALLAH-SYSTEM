import type { RequestHandler } from "express";

/**
 * ABDALLAH-SYSTEM permanently retires these Settings, System Tools, and
 * Dashboard features. Register BEFORE application routes so requests cannot
 * bypass the hidden UI by calling the old API directly.
 *
 * Do not block shared accounting, user administration, /api/export (Export
 * Center), or presence heartbeat/write endpoints.
 */
export const RETIRED_ABDALLAH_ERP_API_PREFIXES = [
  // Settings: Sessions & Users (active sessions, history and remote watch)
  "/api/sessions",
  "/api/login-history",
  "/api/screen-feed",
  "/api/admin/force-refresh-all",
  "/api/admin/force-refresh-privileged",
  // Settings: Supplier Defaults, Scheduled Messages, Recurring Journals
  "/api/tracking-defaults/suppliers",
  "/api/tracking-defaults/backfill",
  "/api/whatsapp/message-schedules",
  "/api/recurring-journals",
  // Settings: Files & Export: only private file storage, NOT Export Center
  "/api/file-folders",
  "/api/files",
  // System Tools + Dashboard
  "/api/stats/import-cycle-balance",
  "/api/stats/import-cycle-diagnostics",
  "/api/stats/group-net-position",
  "/api/stats/group-net-position-excel",
  "/api/stats/country-activity",
] as const;

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(prefix + "/");
}

/** Pure policy for security tests; Express supplies a decoded pathname. */
export function isRetiredAbdallahErpRequest(method: string, pathname: string, body?: unknown): boolean {
  const path = pathname.toLowerCase().replace(/\/+$/, "") || "/";
  const verb = method.toUpperCase();

  if (RETIRED_ABDALLAH_ERP_API_PREFIXES.some((prefix) => matchesPrefix(path, prefix))) {
    return true;
  }

  // Active-user watching is retired, but presence heartbeats and leave
  // requests remain in place for unrelated session/liveness functionality.
  if ((verb === "GET" || verb === "HEAD") && matchesPrefix(path, "/api/user-presence")) {
    return true;
  }

  // The Floating Widgets settings panel is retired, not the whole
  // user-preferences API. Continue allowing currency/date/other preferences.
  if (verb === "PUT" && path === "/api/user-preferences" && body !== null && typeof body === "object") {
    return (
      Object.prototype.hasOwnProperty.call(body, "showChatWidget") ||
      Object.prototype.hasOwnProperty.call(body, "showNotesPanel")
    );
  }

  return false;
}

export const enforceAbdallahErpRetiredFeatureBoundary: RequestHandler = (req, res, next) => {
  if (!isRetiredAbdallahErpRequest(req.method, req.path, req.body)) {
    return next();
  }
  return res.status(403).json({
    code: "ERP_FEATURE_RETIRED",
    message: "This feature is not available in ABDALLAH-SYSTEM",
  });
};
