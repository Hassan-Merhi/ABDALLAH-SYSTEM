import { describe, it, expect } from "vitest";
import { isBlockedAbdallahRoute, isAbdallahErpCompanyType } from "./abdallahErpOnly";

describe("ABDALLAH ERP-only policy", () => {
  it("permits only ERP companies", () => {
    expect(isAbdallahErpCompanyType("erp")).toBe(true);
    for (const type of ["factory", "factory_v2", "properties", "retail", "supplier_partner"]) {
      expect(isAbdallahErpCompanyType(type)).toBe(false);
    }
  });
  it("blocks retired tabs, pages and mode deep links", () => {
    for (const url of [
      "/agents",
      "/transaction-journal",
      "/supplier-profit-check",
      "/cost-centers",
      "/supplier-profit-reconciliation",
      "/stock-in-sales-report",
      "/item-market-analysis",
      "/intercompany-requests",
      "/intercompany-links",
      "/stock-transfer-order",
      "/stock-transfers",
      "/offload-item-search",
      "/factory/dashboard",
      "/properties/daybook",
      "/retail/inventory",
      "/sp/reports",
      "/erp/rental/shops",
      "/agents/23",
      "/stock?tab=offload",
      "/sales-tools?tab=transfers",
      "/git",
      "/git/legacy",
      "/mock-git",
      "/git-tracking",
      "/transporter-statement",
      "/transporter-statement/123",
      "/tracking/git-tracking",
      "/tracking/transporter-statement",
      "/tracking?tab=git-tracking",
      "/tracking?tab=transporter-statement",
      "/tracking?tab=git-tracking#tab",
    ])
      expect(isBlockedAbdallahRoute(url)).toBe(true);
  });
  it("keeps Daybook and normal ERP pages available", () => {
    for (const url of [
      "/",
      "/tracking",
      "/daybook",
      "/vouchers",
      "/inventory",
      "/tracking?tab=containers-otw",
      "/stock?tab=query",
      "/sales-tools?tab=pricelist",
      "/accounts",
      "/settings",
    ])
      expect(isBlockedAbdallahRoute(url)).toBe(false);
  });
});
