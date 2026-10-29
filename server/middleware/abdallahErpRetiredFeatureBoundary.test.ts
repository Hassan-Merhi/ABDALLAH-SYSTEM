import { describe, expect, it } from "vitest";
import { RETIRED_ABDALLAH_ERP_API_PREFIXES, isRetiredAbdallahErpRequest } from "./abdallahErpRetiredFeatureBoundary";

describe("Abdallah ERP retired feature boundary", () => {
  it.each(RETIRED_ABDALLAH_ERP_API_PREFIXES)("blocks direct API access to %s (including child URLs)", (prefix) => {
    expect(isRetiredAbdallahErpRequest("GET", prefix)).toBe(true);
    expect(isRetiredAbdallahErpRequest("POST", prefix + "/123")).toBe(true);
    expect(isRetiredAbdallahErpRequest("DELETE", prefix + "/123")).toBe(true);
    expect(isRetiredAbdallahErpRequest("HEAD", prefix.toUpperCase() + "/")).toBe(true);
  });

  it("blocks watching active users without breaking presence heartbeat or sign-out", () => {
    expect(isRetiredAbdallahErpRequest("GET", "/api/user-presence")).toBe(true);
    expect(isRetiredAbdallahErpRequest("GET", "/api/user-presence/123/activity")).toBe(true);
    expect(isRetiredAbdallahErpRequest("PATCH", "/api/user-presence")).toBe(false);
    expect(isRetiredAbdallahErpRequest("POST", "/api/user-presence/leave")).toBe(false);
    expect(isRetiredAbdallahErpRequest("DELETE", "/api/user-presence")).toBe(false);
  });

  it("blocks Floating Widgets preference changes but preserves other preferences", () => {
    expect(isRetiredAbdallahErpRequest("PUT", "/api/user-preferences", { showChatWidget: false })).toBe(true);
    expect(isRetiredAbdallahErpRequest("PUT", "/api/user-preferences", { showNotesPanel: true })).toBe(true);
    expect(
      isRetiredAbdallahErpRequest("PUT", "/api/user-preferences", { showChatWidget: null, dateFormat: "DD/MM/YYYY" })
    ).toBe(true);
    expect(isRetiredAbdallahErpRequest("PUT", "/api/user-preferences", { dateFormat: "DD/MM/YYYY" })).toBe(false);
    expect(isRetiredAbdallahErpRequest("GET", "/api/user-preferences")).toBe(false);
  });

  it.each([
    "/api/users",
    "/api/auth/me",
    "/api/settings/role-permissions",
    "/api/my-erp-pages",
    "/api/companies",
    "/api/accounts/all",
    "/api/accounts/ledger/123/transactions",
    "/api/export/start",
    "/api/export/settings",
    "/api/stats/net-profit",
    "/api/git/containers",
    "/api/git/containers/123",
    "/api/git/send-containers-whatsapp",
    "/api/stats/net-position",
    "/api/file-folders-extra",
    "/api/sessions-extra",
    "/api/stats/group-net-positioning",
  ])("keeps essential or unrelated ERP endpoint %s available", (path) => {
    expect(isRetiredAbdallahErpRequest("GET", path)).toBe(false);
    expect(isRetiredAbdallahErpRequest("POST", path)).toBe(false);
  });
});
