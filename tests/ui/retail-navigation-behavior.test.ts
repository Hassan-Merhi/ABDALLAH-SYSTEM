/**
 * Retail inventory is the only dedicated stock workspace. Retail POS remains
 * available through /pos and stock transfers live under Vouchers.
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
  it("lists only the Retail inventory workspace", () => {
    expect(RETAIL_NAV_LINKS.map((link) => link.href)).toEqual(["/retail/inventory"]);
  });

  it("sends old Selling settings bookmarks to Tracking now that /retail is retired", () => {
    expect(route("/retail/selling", "retail")).toEqual({ kind: "redirect", to: "/tracking" });
  });

  it("redirects retired retail quick-add, stock operations and optional vouchers", () => {
    for (const path of ["/retail/quick-add", "/retail/stock", "/optional-vouchers"]) {
      // ABDALLAH blocks every /retail page for all companies before Retail routing runs.
      const isRetailPage = path.startsWith("/retail/");
      expect(route(path, "retail")).toEqual(
        isRetailPage ? { kind: "redirect", to: "/tracking" } : { kind: "redirect", to: "/retail/inventory" }
      );
      expect(route(path, "erp")).toEqual(isRetailPage ? { kind: "redirect", to: "/tracking" } : { kind: "continue" });
    }
  });

  it("sends the standard POS entry to the variant-aware Retail POS", () => {
    expect(route("/pos", "retail")).toEqual({ kind: "redirect", to: "/retail/pos" });
  });

  it("blocks retired Transfer Order links for every company type", () => {
    expect(route("/stock-transfer-order", "retail")).toEqual({ kind: "redirect", to: "/tracking" });
    expect(route("/stock-transfer-order/12", "retail")).toEqual({ kind: "redirect", to: "/tracking" });
    expect(route("/stock-transfer-order", "erp")).toEqual({ kind: "redirect", to: "/tracking" });
  });
});
