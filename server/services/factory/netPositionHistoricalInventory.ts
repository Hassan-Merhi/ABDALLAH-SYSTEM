/**
 * Factory Net Position historical inventory, read only.
 *
 * Never reverse a mutable "current remaining" figure to fabricate an old day.
 * Receipts, supplier-owned mix sources, and adjustment events are replayed
 * independently through the company's end-of-day cutoff. Historic finished
 * stock uses bale origin/cost and real order scan/finalization timestamps.
 *
 * Old rows without reliable event/cost history produce named warnings. They
 * are intentionally NOT upgraded to an "exact" historical snapshot.
 */
import { sql } from "drizzle-orm";
import type Decimal from "decimal.js";
import type { FactoryNetPositionAsOf } from "@shared/factoryNetPositionAsOf";
import { db } from "../../db";
import { resultRows } from "../../lib/queryResult";
import { MoneyDecimal, toMoney } from "../../lib/money";
import { getFactoryBalanceOnTableSnapshot } from "./productionBalanceOnTable";
import { netPositionRecordedThrough } from "./netPositionAsOf";

type Event = {
  key: string;
  kind: "RECEIPT" | "ADD" | "DEDUCT" | "CONSUME";
  day: string;
  recordedAt: string;
  stableId: number;
  kg: string;
  usdRate: string | null;
  basis?: string | null;
};
type Stock = { kg: Decimal; value: Decimal; events: number };
const ZERO = new MoneyDecimal(0);
const money = (value: unknown): Decimal => toMoney(value as string | number | null | undefined);
const cents = (value: Decimal): number =>
  value.toDecimalPlaces(2, MoneyDecimal.ROUND_HALF_UP).toNumber();

const nextCutoff = (scope: FactoryNetPositionAsOf, column: string) =>
  netPositionRecordedThrough(sql.raw(column), scope, "utc-naive-timestamp");

export interface HistoricalInventorySnapshot {
  inventoryValue: number;
  rawMaterialValue: number;
  balanceOnTableValue: number;
  warnings: string[];
}

/** Pure date-ordered, deterministic supplier stock replay. Exported for focused tests. */
export function replayHistoricalRawEvents(events: readonly Event[]): { value: number; warnings: string[] } {
  const states = new Map<string, Stock>();
  const warnings = new Set<string>();
  const sorted = [...events].sort(
    (a, b) => a.day.localeCompare(b.day) ||
      a.recordedAt.localeCompare(b.recordedAt) ||
      a.stableId - b.stableId ||
      a.kind.localeCompare(b.kind)
  );

  for (const event of sorted) {
    const state = states.get(event.key) ?? { kg: ZERO, value: ZERO, events: 0 };
    const kg = money(event.kg);
    if (kg.lt(0)) {
      warnings.add("HISTORICAL_RAW_NEGATIVE_MOVEMENT");
      continue;
    }
    const price = event.usdRate == null ? null : money(event.usdRate);
    if (event.kind === "RECEIPT") {
      if (!price || price.lte(0)) warnings.add("HISTORICAL_RAW_UNPRICED_RECEIPT");
      state.value = state.value.plus(kg.times(price ?? ZERO));
      state.kg = state.kg.plus(kg);
    } else if (event.kind === "ADD") {
      if (event.basis == null && price?.gt(0)) warnings.add("HISTORICAL_RAW_ADJUSTMENT_BASIS_MISSING");
      const effectivePrice = event.basis === "QUANTITY_ONLY"
        ? state.kg.gt(0) ? state.value.div(state.kg) : ZERO
        : price ?? (state.kg.gt(0) ? state.value.div(state.kg) : ZERO);
      state.kg = state.kg.plus(kg);
      state.value = state.value.plus(kg.times(effectivePrice));
    } else {
      if (kg.gt(state.kg.plus("0.001"))) {
        warnings.add("HISTORICAL_RAW_CONSUMPTION_EXCEEDS_RECEIPTS");
      }
      const used = MoneyDecimal.min(kg, MoneyDecimal.max(state.kg, ZERO));
      const rate = state.kg.gt(0) ? state.value.div(state.kg) : ZERO;
      state.kg = MoneyDecimal.max(state.kg.minus(used), ZERO);
      state.value = MoneyDecimal.max(state.value.minus(used.times(rate)), ZERO);
    }
    state.events += 1;
    states.set(event.key, state);
  }
  // Match the raw-stock listing's per supplier/material-cent rounding.
  let total: Decimal = ZERO;
  for (const state of states.values()) total = total.plus(money(cents(state.value)));
  return { value: cents(total), warnings: [...warnings] };
}

/**
 * Record-time and business-time filters apply to every individual receipt,
 * ADD/DEDUCT, and mix source. The cumulative factory_raw_stock.used_kg and
 * supplier.current_raw_material_cost_per_kg_usd MUST NOT appear here.
 */
async function rawMaterialAt(companyId: number, scope: FactoryNetPositionAsOf) {
  const receipts = resultRows<{
    key: string; day: string; recorded_at: string; stable_id: number;
    kg: string; usd_rate: string | null; fallback: boolean;
  }>(await db.execute(sql`
    WITH candidate AS (
      SELECT COALESCE('s' || fc.supplier_id::text, 'u' || fc.id::text) AS key,
             cr.receipt_date::text AS day,
             cr.created_at::text AS recorded_at, cr.id AS stable_id,
             cr.received_kg::text AS kg,
             COALESCE(NULLIF(cr.fixed_cost_per_kg_usd, 0),
                      CASE WHEN UPPER(COALESCE(fc.currency_code,'USD')) = 'USD'
                           THEN cr.fixed_cost_per_kg ELSE NULL END)::text AS usd_rate,
             false AS fallback
        FROM factory_container_receipts cr
        JOIN factory_containers fc ON fc.id = cr.container_id AND fc.company_id = cr.company_id
       WHERE cr.company_id = ${companyId}
         AND cr.receipt_date <= ${scope.asOf}::date
         AND ${nextCutoff(scope, "cr.created_at")}
         AND (cr.deleted_at IS NULL OR NOT ${nextCutoff(scope, "cr.deleted_at")})
         AND ${nextCutoff(scope, "fc.created_at")}
         AND (fc.deleted_at IS NULL OR NOT ${nextCutoff(scope, "fc.deleted_at")})
      UNION ALL
      SELECT COALESCE('s' || fc.supplier_id::text, 'u' || fc.id::text) AS key,
             rs.offloaded_at::date::text, rs.created_at::text, -rs.id,
             rs.received_kg::text,
             COALESCE(NULLIF(rs.cost_per_kg_usd, 0),
                      CASE WHEN UPPER(COALESCE(fc.currency_code,'USD')) = 'USD'
                           THEN rs.cost_per_kg ELSE NULL END)::text,
             true
        FROM factory_raw_stock rs
        JOIN factory_containers fc ON fc.id = rs.container_id AND fc.company_id = rs.company_id
       WHERE rs.company_id = ${companyId}
         AND rs.offloaded_at::date <= ${scope.asOf}::date
         AND ${nextCutoff(scope, "rs.created_at")}
         AND ${nextCutoff(scope, "fc.created_at")}
         AND (rs.deleted_at IS NULL OR NOT ${nextCutoff(scope, "rs.deleted_at")})
         AND (fc.deleted_at IS NULL OR NOT ${nextCutoff(scope, "fc.deleted_at")})
         AND NOT EXISTS (
           SELECT 1 FROM factory_container_receipts all_receipts
            WHERE all_receipts.company_id = rs.company_id
              AND all_receipts.container_id = rs.container_id
         )
    )
    SELECT * FROM candidate ORDER BY day, recorded_at, stable_id
  `));
  const adjustments = resultRows<{
    key: string; day: string; recorded_at: string; stable_id: number;
    kg: string; usd_rate: string | null; type: string; basis: string | null;
  }>(await db.execute(sql`
    SELECT COALESCE('s' || a.supplier_id::text, 'm' || COALESCE(a.material_label,'unknown')) AS key,
           LEFT(a.date, 10) AS day, a.created_at::text AS recorded_at, a.id AS stable_id,
           a.kg::text AS kg,
           CASE WHEN UPPER(COALESCE(a.currency_code,'USD')) = 'USD'
                THEN a.cost_per_kg::text ELSE NULL END AS usd_rate,
           UPPER(a.type) AS type, a.valuation_basis AS basis
      FROM factory_raw_material_adjustments a
     WHERE a.company_id = ${companyId}
       AND LEFT(a.date, 10) <= ${scope.asOf}
       AND ${nextCutoff(scope, "a.created_at")}
       AND (a.deleted_at IS NULL OR NOT ${nextCutoff(scope, "a.deleted_at")})
  `));
  const sources = resultRows<{
    key: string | null; day: string; recorded_at: string; stable_id: number;
    kg: string;
  }>(await db.execute(sql`
    SELECT CASE WHEN COALESCE(ms.inventory_supplier_id, ms.supplier_id, fc.supplier_id) IS NOT NULL
                THEN 's' || COALESCE(ms.inventory_supplier_id, ms.supplier_id, fc.supplier_id)::text
                WHEN ms.container_id IS NOT NULL THEN 'u' || ms.container_id::text
                ELSE NULL END AS key,
           COALESCE(mb.batch_date, mb.created_at::date)::text AS day,
           GREATEST(ms.created_at, mb.created_at)::text AS recorded_at,
           ms.id AS stable_id, ms.weight_kg::text AS kg
      FROM factory_mix_batch_sources ms
      JOIN factory_mix_batches mb ON mb.id = ms.mix_batch_id
       AND mb.company_id = ${companyId}
      LEFT JOIN factory_containers fc ON fc.id = ms.container_id AND fc.company_id = ${companyId}
     WHERE ms.source_batch_id IS NULL
       AND UPPER(COALESCE(ms.source_type,'')) <> 'BATCH'
       AND COALESCE(mb.batch_date, mb.created_at::date) <= ${scope.asOf}::date
       AND ${nextCutoff(scope, "ms.created_at")}
       AND ${nextCutoff(scope, "mb.created_at")}
       AND (mb.deleted_at IS NULL OR NOT ${nextCutoff(scope, "mb.deleted_at")})
  `));

  // A legacy cumulative raw-stock row has already had its received_kg
  // reduced by a recorded DEDUCT. Reapplying that DEDUCT would remove it
  // twice. The earlier quantity is not fully recoverable without an original
  // receipt event, so do not invent it: retain the known cumulative amount
  // and expose the explicit reconstruction limitation.
  const fallbackKeys = new Set(receipts.filter(r => r.fallback).map(r => r.key));
  const datedAdjustments = adjustments.filter(
    r => !(r.type === "DEDUCT" && fallbackKeys.has(r.key))
  );

  const events: Event[] = [
    ...receipts.map(r => ({
      key: r.key, kind: "RECEIPT" as const, day: r.day,
      recordedAt: r.recorded_at, stableId: Number(r.stable_id),
      kg: r.kg, usdRate: r.usd_rate,
    })),
    ...datedAdjustments.map(r => ({
      key: r.key, kind: (r.type === "ADD" ? "ADD" : "DEDUCT") as "ADD" | "DEDUCT",
      day: r.day, recordedAt: r.recorded_at, stableId: Number(r.stable_id),
      kg: r.kg, usdRate: r.usd_rate, basis: r.basis,
    })),
    ...sources.filter(r => r.key != null).map(r => ({
      key: r.key!, kind: "CONSUME" as const, day: r.day,
      recordedAt: r.recorded_at, stableId: Number(r.stable_id),
      kg: r.kg, usdRate: null,
    })),
  ];
  const replay = replayHistoricalRawEvents(events);
  const warnings = new Set(replay.warnings);
  if (receipts.some(r => r.fallback)) warnings.add("HISTORICAL_RAW_LEGACY_RECEIPT_FALLBACK");
  if (sources.some(r => r.key == null)) warnings.add("HISTORICAL_RAW_SOURCE_OWNER_UNKNOWN");
  if (adjustments.some(r => r.type === "DEDUCT" && fallbackKeys.has(r.key))) {
    warnings.add("HISTORICAL_RAW_LEGACY_DEDUCT_MUTATED_RECEIPT");
  }
  return { value: replay.value, warnings: [...warnings] };
}

/**
 * Only bales that existed and were released into stock at the date qualify.
 * An allocation scanned AFTER the cutoff does not exclude yesterday's bale.
 * Later finalization / soft deletion are considered historical transition events.
 */
async function finishedStockAt(companyId: number, scope: FactoryNetPositionAsOf, valuationMode: "cost" | "selling") {
  const rows = resultRows<{
    total_cost: string; total_selling: string;
    missing_finalization: string; missing_scan_time: string;
    uncertain_removals: string; mutable_prices: string;
  }>(await db.execute(sql`
    WITH eligible AS (
      SELECT b.id, b.status, b.total_cost::numeric AS original_cost,
             COALESCE(p.selling_price::numeric, 0) AS current_catalog_selling,
             b.finalized_at, b.deleted_at,
             (EXISTS (
                SELECT 1 FROM customer_order_bales cob
                JOIN customer_orders co ON co.id = cob.order_id AND co.company_id = ${companyId}
                WHERE cob.bale_id = b.id
                  AND cob.scanned_at IS NOT NULL
                  AND ${netPositionRecordedThrough(sql`cob.scanned_at`, scope, "timestamptz")}
                  AND ${nextCutoff(scope, "co.created_at")}
             ) OR EXISTS (
                -- A scan cancelled after the selected day was still allocated
                -- on the selected day; archived history retains that interval.
                SELECT 1 FROM customer_order_bales_history coh
                JOIN customer_orders co ON co.id = coh.order_id AND co.company_id = ${companyId}
                WHERE coh.bale_id = b.id
                  AND coh.scanned_at IS NOT NULL
                  AND ${netPositionRecordedThrough(sql`coh.scanned_at`, scope, "timestamptz")}
                  AND NOT ${netPositionRecordedThrough(sql`coh.cancelled_at`, scope, "timestamptz")}
                  AND ${nextCutoff(scope, "co.created_at")}
             )) AS scanned_before,
             (EXISTS (
                SELECT 1 FROM customer_order_bales cob
                JOIN customer_orders co ON co.id = cob.order_id AND co.company_id = ${companyId}
                WHERE cob.bale_id = b.id AND cob.scanned_at IS NULL
             ) OR EXISTS (
                SELECT 1 FROM customer_order_bales_history coh
                JOIN customer_orders co ON co.id = coh.order_id AND co.company_id = ${companyId}
                WHERE coh.bale_id = b.id AND coh.scanned_at IS NULL
                  AND NOT ${netPositionRecordedThrough(sql`coh.cancelled_at`, scope, "timestamptz")}
             )) AS missing_scan_time
        FROM factory_bales b
        LEFT JOIN factory_bale_products p ON p.id = b.product_id AND p.company_id = ${companyId}
       WHERE b.company_id = ${companyId}
         AND ${nextCutoff(scope, "b.created_at")}
         AND COALESCE(b.stock_entry_date, b.pressed_at::date, b.created_at::date) <= ${scope.asOf}::date
         AND b.status <> 'PENDING_PRESSING'
         AND (b.deleted_at IS NULL OR NOT ${nextCutoff(scope, "b.deleted_at")})
    )
    SELECT COALESCE(SUM(original_cost) FILTER (WHERE NOT scanned_before
        AND (finalized_at IS NULL OR NOT ${nextCutoff(scope, "finalized_at")})
        AND (status NOT IN ('REMOVED','REPACKED','DELETED') OR deleted_at IS NOT NULL)),0)::text AS total_cost,
           COALESCE(SUM(current_catalog_selling) FILTER (WHERE NOT scanned_before
        AND (finalized_at IS NULL OR NOT ${nextCutoff(scope, "finalized_at")})
        AND (status NOT IN ('REMOVED','REPACKED','DELETED') OR deleted_at IS NOT NULL)),0)::text AS total_selling,
           COUNT(*) FILTER (WHERE status IN ('FINALIZED','SOLD','DISPATCHED')
               AND finalized_at IS NULL)::text AS missing_finalization,
           COUNT(*) FILTER (WHERE missing_scan_time)::text AS missing_scan_time,
           COUNT(*) FILTER (WHERE status IN ('REMOVED','REPACKED') AND deleted_at IS NULL)::text AS uncertain_removals,
           COUNT(*) FILTER (WHERE current_catalog_selling > 0)::text AS mutable_prices
      FROM eligible
  `));
  const row = rows[0] ?? {};
  const warnings: string[] = [];
  if (Number(row.missing_finalization || 0) > 0) warnings.push("HISTORICAL_STOCK_FINALIZATION_TIME_MISSING");
  if (Number(row.missing_scan_time || 0) > 0) warnings.push("HISTORICAL_STOCK_SCAN_TIME_MISSING");
  if (Number(row.uncertain_removals || 0) > 0) warnings.push("HISTORICAL_STOCK_REMOVAL_TIME_UNKNOWN");
  if (valuationMode === "selling" && Number(row.mutable_prices || 0) > 0) {
    warnings.push("HISTORICAL_STOCK_SELLING_PRICE_UNVERSIONED");
  }
  // Historical cost is stored on the bale, but edits to that cost before/after
  // the selected date are not versioned for legacy rows (Phase 8).
  warnings.push("HISTORICAL_STOCK_COST_EDITS_NOT_VERSIONED");
  return {
    value: cents(money(valuationMode === "selling" ? row.total_selling : row.total_cost)),
    warnings,
  };
}

export async function computeHistoricalFactoryInventory(
  companyId: number,
  scope: FactoryNetPositionAsOf,
  valuationMode: "cost" | "selling",
): Promise<HistoricalInventorySnapshot> {
  const [raw, stock, workInProcess] = await Promise.all([
    rawMaterialAt(companyId, scope),
    finishedStockAt(companyId, scope, valuationMode),
    getFactoryBalanceOnTableSnapshot(companyId, scope.asOf, scope),
  ]);
  return {
    inventoryValue: stock.value,
    rawMaterialValue: raw.value,
    balanceOnTableValue: workInProcess.value,
    warnings: [...new Set([...raw.warnings, ...stock.warnings])],
  };
}
