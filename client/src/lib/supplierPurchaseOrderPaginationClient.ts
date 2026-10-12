import { fetchLegacyPaginatedList } from "./legacyPaginatedListFetch";
import { resolveFetchUrl as resolveUrl, fetchRequestMethod } from "./fetchRequestUtils";
const ENDPOINT_PATTERN = /^\/api\/suppliers\/\d+\/purchase-orders$/;
const PAGE_SIZE = 250;

declare global {
  interface Window {
    __erpSupplierPurchaseOrderPaginationInstalled?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__erpSupplierPurchaseOrderPaginationInstalled) {
  window.__erpSupplierPurchaseOrderPaginationInstalled = true;
  const previousFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = fetchRequestMethod(input, init);
    if (method !== "GET") return previousFetch(input, init);
    const url = resolveUrl(input);
    if (!url || !ENDPOINT_PATTERN.test(url.pathname) || url.searchParams.has("pagination")) {
      return previousFetch(input, init);
    }

    return fetchLegacyPaginatedList(input, init, url, PAGE_SIZE, previousFetch);
  };
}
