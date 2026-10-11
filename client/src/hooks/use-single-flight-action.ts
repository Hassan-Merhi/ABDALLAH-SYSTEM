import { useCallback, useRef, useState } from "react";

/**
 * Prevents duplicate async submissions immediately, before React Query's
 * isPending state reaches the component. No global state, delays, or side
 * effects: the caller still owns validation, transport, and error handling.
 */
export function useSingleFlightAction() {
  const lockedRef = useRef(false);
  const [pending, setPending] = useState(false);

  const execute = useCallback(async <T,>(work: () => Promise<T>): Promise<T | undefined> => {
    if (lockedRef.current) return undefined;
    lockedRef.current = true;
    setPending(true);
    try {
      return await work();
    } finally {
      lockedRef.current = false;
      setPending(false);
    }
  }, []);

  return { execute, pending };
}
