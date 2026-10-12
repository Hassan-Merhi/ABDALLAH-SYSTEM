import { resolveFetchUrl as resolveUrl, replaceFetchInputUrl as replaceInputUrl, fetchRequestMethod } from "./fetchRequestUtils";
import "./supplierPurchaseOrderPaginationClient";

const ENDPOINTS = new Set([
  "/api/containers",
  "/api/containers/active",
  "/api/containers/sold",
]);
const PAGE_SIZE = 250;

interface ContainerPage {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

declare global {
  interface Window {
    __erpContainerPaginationInstalled?: boolean;
  }
}

if (
  typeof window !== "undefined" &&
  !window.__erpContainerPaginationInstalled
) {
  window.__erpContainerPaginationInstalled = true;
  const previousFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const method = fetchRequestMethod(input, init);
    if (method !== "GET") return previousFetch(input, init);
    const url = resolveUrl(input);
    if (
      !url ||
      !ENDPOINTS.has(url.pathname) ||
      url.searchParams.has("pagination")
    ) {
      return previousFetch(input, init);
    }

    const requestPage = async (page: number): Promise<Response> => {
      const pageUrl = new URL(url.toString());
      pageUrl.searchParams.set("pagination", "1");
      pageUrl.searchParams.set("page", String(page));
      pageUrl.searchParams.set("limit", String(PAGE_SIZE));
      return previousFetch(replaceInputUrl(input, pageUrl), init);
    };

    const firstResponse = await requestPage(1);
    if (!firstResponse.ok) return firstResponse;
    try {
      const first = (await firstResponse.clone().json()) as ContainerPage;
      if (!first || !Array.isArray(first.items)) return firstResponse;
      const items = [...first.items];
      for (
        let page = 2;
        page <= Math.max(1, Number(first.totalPages || 1));
        page += 1
      ) {
        const response = await requestPage(page);
        if (!response.ok) return response;
        const payload = (await response.json()) as ContainerPage;
        if (Array.isArray(payload.items)) items.push(...payload.items);
      }
      const headers = new Headers(firstResponse.headers);
      headers.set("Content-Type", "application/json; charset=utf-8");
      headers.set("X-Total-Count", String(first.total ?? items.length));
      return new Response(JSON.stringify(items), {
        status: firstResponse.status,
        statusText: firstResponse.statusText,
        headers,
      });
    } catch {
      return firstResponse;
    }
  };
}
