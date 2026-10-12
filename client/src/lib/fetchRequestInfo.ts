/**
 * Request-shape helpers shared by the fetch guards installed in main.tsx
 * (bandwidth, payload and request-storm guards). Each guard used to carry an
 * identical private copy of these two functions.
 */

/** The request URL resolved against the current origin, or null when it cannot be parsed. */
export function resolveRequestUrl(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === "string") return new URL(input, window.location.origin);
    if (input instanceof URL) return new URL(input.toString(), window.location.origin);
    if (input instanceof Request) return new URL(input.url, window.location.origin);
  } catch {
    return null;
  }
  return null;
}

/** The upper-cased HTTP method of a fetch call (`GET` when none is given). */
export function requestMethod(input: RequestInfo | URL, init?: RequestInit): string {
  return (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
}
