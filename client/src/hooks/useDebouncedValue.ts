import { useDebounce } from "./use-debounce";

/** Compatibility name retained for existing imports; delegates to one timer
 * and cleanup implementation in use-debounce.ts. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  return useDebounce(value, delayMs);
}
