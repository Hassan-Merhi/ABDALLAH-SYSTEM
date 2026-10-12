import { replaceFetchInputUrl } from "./fetchRequestUtils";

interface LegacyListPage {
  items?: unknown[];
  total?: number | null;
  totalPages?: number | null;
}

/**
 * Flattens the legacy opt-in paginated response without changing the outward
 * unpaginated JSON-array contract used by old container and supplier screens.
 *
 * The installing interceptor supplies its OWN captured previousFetch. Do not
 * call window.fetch here: doing so would recurse through fetch wrappers.
 *
 * Failure semantics are intentionally preserved:
 * - an unsuccessful first page is returned unchanged;
 * - an unsuccessful later page is returned unchanged;
 * - an unexpected envelope or JSON parse error returns the original first
 *   response, letting the normal caller handle it;
 * - only successful page sets are exposed as a flat JSON response with
 *   X-Total-Count and the original first-page response status.
 */
export async function fetchLegacyPaginatedList(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  sourceUrl: URL,
  pageSize: number,
  previousFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): Promise<Response> {
  const requestPage = (page: number): Promise<Response> => {
    const pageUrl = new URL(sourceUrl.toString());
    pageUrl.searchParams.set("pagination", "1");
    pageUrl.searchParams.set("page", String(page));
    pageUrl.searchParams.set("limit", String(pageSize));
    return previousFetch(replaceFetchInputUrl(input, pageUrl), init);
  };

  const firstResponse = await requestPage(1);
  if (!firstResponse.ok) return firstResponse;
  try {
    const first = (await firstResponse.clone().json()) as LegacyListPage;
    if (!first || !Array.isArray(first.items)) return firstResponse;
    const items = [...first.items];

    for (let page = 2; page <= Math.max(1, Number(first.totalPages || 1)); page += 1) {
      const response = await requestPage(page);
      if (!response.ok) return response;
      const payload = (await response.json()) as LegacyListPage;
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
}
