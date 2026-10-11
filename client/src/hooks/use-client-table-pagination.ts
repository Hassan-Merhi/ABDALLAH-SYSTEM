import { useCallback, useState } from "react";

/**
 * Shared client-side pagination for already-fetched small lists.
 * NEVER use this on a server-paginated response: pass page/pageSize to
 * the query instead and render the returned metadata in PaginationBar.
 */
export function useClientTablePagination(total: number, requestedPageSize: number) {
  const [requestedPage, setPage] = useState(1);
  const pageSize = Number.isFinite(requestedPageSize) && requestedPageSize > 0
    ? Math.floor(requestedPageSize) : 25;
  const totalRecords = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const offset = (page - 1) * pageSize;

  const paginate = useCallback(
    <T,>(rows: readonly T[]): T[] => rows.slice(offset, offset + pageSize),
    [offset, pageSize],
  );
  const resetPage = useCallback(() => setPage(1), []);

  return { page, setPage, resetPage, pageSize, totalPages, offset, paginate };
}
