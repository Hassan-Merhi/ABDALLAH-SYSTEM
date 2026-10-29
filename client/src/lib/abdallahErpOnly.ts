/** ABDALLAH-SYSTEM is ERP only; these routes stay disabled even for administrators. */
export function isAbdallahErpCompanyType(type: string | null | undefined): boolean {
  return (type ?? "erp") === "erp";
}

const HIDDEN_PATHS = [
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
  // Retired Tracking sections and their legacy direct routes.
  "/git",
  "/mock-git",
  "/git-tracking",
  "/transporter-statement",
  "/tracking/git-tracking",
  "/tracking/transporter-statement",
  "/factory",
  "/factory-production",
  "/bales",
  "/bale-products",
  "/production-bales",
  "/properties",
  "/retail",
  "/sp",
  "/erp/rental",
  "/accounting/factory-production",
  "/accounting/rentals",
] as const;

/** Covers nested pages and old bookmarks, not just sidebar links. */
export function isBlockedAbdallahRoute(url: string): boolean {
  const withoutHash = url.split("#")[0];
  const [pathname, search] = withoutHash.split("?");
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  if (HIDDEN_PATHS.some((root) => path === root || path.startsWith(root + "/"))) return true;
  const tab = new URLSearchParams(search ?? "").get("tab");
  return (
    (path === "/stock" && tab === "offload") ||
    (path === "/sales-tools" && tab === "transfers") ||
    (path === "/tracking" && (tab === "git-tracking" || tab === "transporter-statement"))
  );
}
