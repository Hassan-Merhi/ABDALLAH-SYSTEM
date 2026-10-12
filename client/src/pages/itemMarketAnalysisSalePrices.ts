import { apiRequest } from "@/lib/queryClient";
import type { SalePriceExportRow } from "./itemMarketAnalysisExport";

/** The backend permits up to 5,000 items per company/request; smaller batches let large datasets export in full. */
const MAX_ITEMS_PER_BATCH = 2500;

/**
 * Fetches the sale-price breakdown for every company/item in `rows` (the COMPLETE filtered set,
 * not the 250-row screen cap) in batches. A failed batch rejects, aborting the whole export.
 */
export async function fetchSalePriceExportRows(
  rows: ReadonlyArray<{ companyId: number; stockItemId: number }>,
  period: { startDate?: string; endDate?: string }
): Promise<SalePriceExportRow[]> {
  const itemIdsByCompany = new Map<number, Set<number>>();
  for (const row of rows) {
    const ids = itemIdsByCompany.get(row.companyId) ?? new Set<number>();
    ids.add(row.stockItemId);
    itemIdsByCompany.set(row.companyId, ids);
  }

  const salePriceRows: SalePriceExportRow[] = [];
  for (const [companyId, itemIds] of itemIdsByCompany) {
    const ids = [...itemIds];
    for (let offset = 0; offset < ids.length; offset += MAX_ITEMS_PER_BATCH) {
      const response = await apiRequest("POST", "/api/reports/item-market-analysis/export-sale-prices", {
        startDate: period.startDate || undefined,
        endDate: period.endDate || undefined,
        companyItems: [{ companyId, stockItemIds: ids.slice(offset, offset + MAX_ITEMS_PER_BATCH) }],
      });
      const salePrices = (await response.json()) as { rows: SalePriceExportRow[] };
      salePriceRows.push(...salePrices.rows);
    }
  }
  return salePriceRows;
}
