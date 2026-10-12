import { useState, useEffect } from "react";

/** Canonical debounce hook. In both legacy naming styles it keeps the previous
 * value until the latest input has remained unchanged for the delay. */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), Math.max(0, delay));
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
