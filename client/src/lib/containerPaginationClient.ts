import { fetchLegacyPaginatedList } from "./legacyPaginatedListFetch";
import { resolveFetchUrl as resolveUrl, fetchRequestMethod } from "./fetchRequestUtils";
import "./supplierPurchaseOrderPaginationClient";

const ENDPOINTS = new Set(["/api/containers", "/api/containers/active", "/api/containers/sold"]);
const PAGE_SIZE = 250;

declare global {
  interface Window {
    __erpContainerPaginationInstalled?: boolean;
  }
}

if (typeof window !== "undefined" && !window.__erpContainerPaginationInstalled) {
  window.__erpContainerPaginationInstalled = true;
  const previousFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = fetchRequestMethod(input, init);
    if (method !== "GET") return previousFetch(input, init);
    const url = resolveUrl(input);
    if (!url || !ENDPOINTS.has(url.pathname) || url.searchParams.has("pagination")) {
      return previousFetch(input, init);
    }

    return fetchLegacyPaginatedList(input, init, url, PAGE_SIZE, previousFetch);
  };
}
