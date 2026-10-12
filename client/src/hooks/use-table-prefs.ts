import { useCallback, useEffect, useState } from "react";

export type TableDensity = "compact" | "standard" | "comfortable";

export interface TablePrefs {
  sortKey?: string;
  sortDir?: "asc" | "desc";
  filters?: Record<string, unknown>;
  pageSize?: number;
  /** false hides an optional column; required columns are enforced by consumers. */
  columns?: Record<string, boolean>;
  density?: TableDensity;
}

export interface TablePrefsOptions {
  /** Pass the company ID for company-owned data. Global admin tables omit it. */
  companyId?: string | number | null;
}

const VALID_DENSITIES: ReadonlyArray<TableDensity> = ["compact", "standard", "comfortable"];
const STORAGE_VERSION = 2;
const DEFAULT_PAGE_SIZES = [10, 20, 25, 50, 100] as const;

function parsePrefs(value: unknown): TablePrefs {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const candidate = value as Record<string, unknown>;
  const result: TablePrefs = {};
  if (typeof candidate.sortKey === "string") result.sortKey = candidate.sortKey;
  if (candidate.sortDir === "asc" || candidate.sortDir === "desc") result.sortDir = candidate.sortDir;
  if (
    typeof candidate.pageSize === "number" &&
    Number.isInteger(candidate.pageSize) &&
    candidate.pageSize >= 1 &&
    candidate.pageSize <= 500
  )
    result.pageSize = candidate.pageSize;
  if (VALID_DENSITIES.includes(candidate.density as TableDensity)) result.density = candidate.density as TableDensity;
  if (candidate.filters && typeof candidate.filters === "object" && !Array.isArray(candidate.filters)) {
    result.filters = candidate.filters as Record<string, unknown>;
  }
  if (candidate.columns && typeof candidate.columns === "object" && !Array.isArray(candidate.columns)) {
    result.columns = Object.fromEntries(
      Object.entries(candidate.columns).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean")
    );
  }
  return result;
}

export function readTablePrefs(storageKey: string): TablePrefs {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "version" in parsed) {
      const document = parsed as { version?: number; prefs?: unknown };
      return document.version === STORAGE_VERSION ? parsePrefs(document.prefs) : {};
    }
    // Existing pre-Phase-3 stored preferences were unversioned.
    return parsePrefs(parsed);
  } catch {
    return {};
  }
}

function storeTablePrefs(storageKey: string, prefs: TablePrefs) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: STORAGE_VERSION, prefs }));
  } catch {
    // User storage is optional, e.g. private windows and restricted webviews.
  }
}

/**
 * Presentation preferences only. Business filters still belong to the
 * versioned, company-scoped usePaginatedFilterState hook.
 */
export function useTablePrefs(pageKey: string, options: TablePrefsOptions = {}) {
  const storageKey = `table-prefs:${options.companyId == null ? "global" : `company:${options.companyId}`}:${pageKey}`;
  const [state, setState] = useState(() => ({ key: storageKey, prefs: readTablePrefs(storageKey) }));
  const prefs = state.key === storageKey ? state.prefs : readTablePrefs(storageKey);

  useEffect(() => {
    setState((current) =>
      current.key === storageKey ? current : { key: storageKey, prefs: readTablePrefs(storageKey) }
    );
  }, [storageKey]);

  const setPrefs = useCallback(
    (update: Partial<TablePrefs> | ((previous: TablePrefs) => TablePrefs)) => {
      setState((previous) => {
        const current = previous.key === storageKey ? previous.prefs : readTablePrefs(storageKey);
        const next = parsePrefs(typeof update === "function" ? update(current) : { ...current, ...update });
        storeTablePrefs(storageKey, next);
        return { key: storageKey, prefs: next };
      });
    },
    [storageKey]
  );

  const clearPrefs = useCallback(() => {
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(storageKey);
    } catch {
      // Preferences remain optional.
    }
    setState({ key: storageKey, prefs: {} });
  }, [storageKey]);

  return { prefs, setPrefs, clearPrefs, defaultPageSizes: DEFAULT_PAGE_SIZES };
}
