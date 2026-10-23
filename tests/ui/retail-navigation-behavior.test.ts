/**
 * Retail navigation (Phase 1/6): the Retail workspace shows only Inventory,
 * Quick add, Stock operations and Selling settings. The Retail POS stays
 * reachable through the standard /pos entry, and the legacy Transfer Order
 * editor redirects to the exact-variant stock operations for Retail only.
 */
import { resolveAuthenticatedAppRoute } from "@/app/authenticatedAppRouteGuard";
import { RETAIL_NAV_LINKS } from "@/pages/retail/RetailNav";

const route = (currentLocation: string, companyType: string) =>
  resolveAuthenticatedAppRoute({
    currentLocation,
    companyType,
    isAdminOwner: true,
    userRole: "Admin",
    myAccessLoading: false,
    myAccessError: false,
  }).decision;

describe("Retail navigation", () => {
  it("lists only the four Retail workspace pills", () => {
    expect(RETAIL_NAV_LINKS.map((link) => link.href)).toEqual([
      "/retail/inventory",
      "/retail/quick-add",
      "/retail/stock",
      "/retail/selling",
    ]);
  });

  it("sends the standard POS entry to the variant-aware Retail POS", () => {
    expect(route("/pos", "retail")).toEqual({ kind: "redirect", to: "/retail/pos" });
  });

  it("redirects legacy Transfer Order links to Retail stock operations, for Retail only", () => {
    expect(route("/stock-transfer-order", "retail")).toEqual({ kind: "redirect", to: "/retail/stock" });
    expect(route("/stock-transfer-order/12", "retail")).toEqual({ kind: "redirect", to: "/retail/stock" });
    expect(route("/stock-transfer-order", "erp")).toEqual({ kind: "continue" });
  });
});
