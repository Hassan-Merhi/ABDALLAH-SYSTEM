/**
 * Read-only Phase 5 reconstruction for Factory Net Position.
 *
 * Uses event time + document time, NOT today's mutable container/order state.
 * Old orders, container amount edits and missing scan timestamps are surfaced
 * as limitations; never infer a past transaction from a future scan or offload.
 */
import { sql } from "drizzle-orm";
import type Decimal from "decimal.js";
import type { FactoryNetPositionAsOf } from "@shared/factoryNetPositionAsOf";
import { db } from "../../db";
import { resultRows } from "../../lib/queryResult";
import { MoneyDecimal, toMoney } from "../../lib/money";
import { netPositionRecordedThrough } from "./netPositionAsOf";

const decimal = (v: unknown): Decimal => toMoney(v as string | number | null | undefined);
const cents = (v: Decimal): number => v.toDecimalPlaces(2, MoneyDecimal.ROUND_HALF_UP).toNumber();
const isBefore = (scope: FactoryNetPositionAsOf, fragment: string, kind: "timestamptz" | "utc-naive-timestamp" = "utc-naive-timestamp") =>
  netPositionRecordedThrough(sql.raw(fragment), scope, kind);

export type DatedPipelineOrder = {
  id: number;
  customerName: string;
  orderDate: string;
  grandTotal: number;
  totalQtyBales: number;
};
export type DatedPipelineSnapshot = {
  stockOtwValue: number;
  pendingOrders: DatedPipelineOrder[];
  verifiedOrders: DatedPipelineOrder[];
  loadingOrders: DatedPipelineOrder[];
  pendingTotal: number;
  verifiedTotal: number;
  loadingTotal: number;
  warnings: string[];
};

export type HistoricalOrderStage = "PENDING_VERIFICATION" | "LOADING" | "VERIFIED" | "FINALIZED" | "UNKNOWN";

/** Derive stage from recorded transitions, never the row's current status. */
export function orderStageAt(events: {
  created: boolean; loadingStarted: boolean; verified: boolean; invoiced: boolean;
  currentStatus: string;
  loadingStartedAt?: string | null;
  verifiedAt?: string | null;
}): HistoricalOrderStage {
  if (!events.created) return "UNKNOWN";
  if (events.invoiced) return "FINALIZED";
  // Reopened orders can move VERIFIED -> LOADING -> VERIFIED. The latest
  // recorded qualifying transition must win; current status is not history.
  if (events.loadingStarted && events.verified &&
      events.loadingStartedAt && events.verifiedAt &&
      events.loadingStartedAt > events.verifiedAt) return "LOADING";
  if (events.verified) return "VERIFIED";
  if (events.loadingStarted) return "LOADING";
  if (events.currentStatus === "PENDING_VERIFICATION") return "PENDING_VERIFICATION";
  return "UNKNOWN";
}

/** Retain precisely the not-yet-received share of each planned container. */
export function historicalOtwRemaining(plannedKg: string, receivedKg: string) {
  const planned = decimal(plannedKg);
  const received = decimal(receivedKg);
  if (planned.lte(0)) return { remainingKg: new MoneyDecimal(0), share: new MoneyDecimal(0), exceeded: false };
  const remainingKg = MoneyDecimal.max(planned.minus(received), 0);
  return {
    remainingKg,
    share: remainingKg.div(planned),
    exceeded: received.gt(planned),
  };
}

type ContainerRow = {
  id: number; status: string; planned_kg: string; goods_rate: string;
  final_payable: string; currency_code: string; freight: string;
  freight_ccy: string; commission: string; commission_ccy: string;
  other_charges: string; other_charges_ccy: string;
  received_kg: string; history_count: string; legacy_kg: string;
  legacy_count: string;
};

async function getHistoricalOtw(
  companyId: number,
  scope: FactoryNetPositionAsOf,
  getConfigFx: (currency: string) => number,
): Promise<{ value: number; warnings: string[] }> {
  const rows = resultRows<ContainerRow>(await db.execute(sql`
    SELECT fc.id, fc.status,
           COALESCE(fc.total_kg, 0)::text AS planned_kg,
           COALESCE(fc.rate_per_kg, 0)::text AS goods_rate,
           COALESCE(fc.final_payable_amount, 0)::text AS final_payable,
           UPPER(COALESCE(fc.currency_code, 'USD')) AS currency_code,
           COALESCE(fc.freight, 0)::text AS freight,
           UPPER(COALESCE(fc.freight_currency_code, fc.currency_code, 'USD')) AS freight_ccy,
           COALESCE(fc.commission_amount, 0)::text AS commission,
           UPPER(COALESCE(fc.commission_currency_code, 'USD')) AS commission_ccy,
           COALESCE(fc.other_charges, 0)::text AS other_charges,
           UPPER(COALESCE(fc.other_charges_currency_code, fc.currency_code, 'USD')) AS other_charges_ccy,
           COALESCE((
             SELECT SUM(r.received_kg::numeric)
               FROM factory_container_receipts r
              WHERE r.company_id = fc.company_id AND r.container_id = fc.id
                AND r.receipt_date <= ${scope.asOf}::date
                AND ${isBefore(scope, "r.created_at")}
                AND (r.deleted_at IS NULL OR NOT ${isBefore(scope, "r.deleted_at")})
           ),0)::text AS received_kg,
           (SELECT COUNT(*) FROM factory_container_receipts r
              WHERE r.company_id = fc.company_id AND r.container_id = fc.id)::text AS history_count,
           COALESCE((
             SELECT SUM(rs.received_kg::numeric)
               FROM factory_raw_stock rs
              WHERE rs.company_id = fc.company_id AND rs.container_id = fc.id
                AND rs.offloaded_at::date <= ${scope.asOf}::date
                AND ${isBefore(scope, "rs.created_at")}
                AND (rs.deleted_at IS NULL OR NOT ${isBefore(scope, "rs.deleted_at")})
           ),0)::text AS legacy_kg,
           (SELECT COUNT(*) FROM factory_raw_stock rs
              WHERE rs.company_id = fc.company_id AND rs.container_id = fc.id)::text AS legacy_count
      FROM factory_containers fc
     WHERE fc.company_id = ${companyId}
       AND ${isBefore(scope, "fc.created_at")}
       AND (fc.deleted_at IS NULL OR NOT ${isBefore(scope, "fc.deleted_at")})
  `));
  const warnings = new Set<string>();
  let total: Decimal = new MoneyDecimal(0);
  for (const c of rows) {
    // A container that existed by the cutoff is not removed because it is
    // OFFLOADED now; receipt events decide its historical remaining stock.
    if (["DELETED", "CANCELLED"].includes(c.status)) {
      warnings.add("HISTORICAL_OTW_STATUS_HISTORY_MISSING");
    }
    const planned = decimal(c.planned_kg);
    // Current container quantity/rate/FX configuration can have been edited
    // after cutoff. Without a versioned master snapshot this is provisional.
    warnings.add("HISTORICAL_OTW_MASTER_VALUES_UNVERSIONED");
    let received = decimal(c.received_kg);
    if (Number(c.history_count) === 0 && Number(c.legacy_count) > 0) {
      received = decimal(c.legacy_kg);
      warnings.add("HISTORICAL_OTW_LEGACY_OFFLOAD");
    }
    if (planned.lte(0)) {
      warnings.add("HISTORICAL_OTW_PLANNED_WEIGHT_MISSING");
      continue;
    }
    const { remainingKg, share: ratio, exceeded } = historicalOtwRemaining(c.planned_kg, received.toFixed());
    if (exceeded) warnings.add("HISTORICAL_OTW_RECEIPTS_EXCEED_PLAN");
    if (remainingKg.isZero()) continue;
    const nativeGoods = decimal(c.goods_rate).gt(0)
      ? planned.times(decimal(c.goods_rate))
      : decimal(c.final_payable);
    if (decimal(c.goods_rate).lte(0)) warnings.add("HISTORICAL_OTW_GOODS_RATE_UNVERSIONED");
    const add = (amount: Decimal, currency: string) => {
      if (amount.lte(0)) return;
      const cc = (currency || "USD").toUpperCase();
      total = total.plus(amount.times(cc === "USD" ? 1 : getConfigFx(cc)).times(ratio));
    };
    add(nativeGoods, c.currency_code);
    add(decimal(c.freight), c.freight_ccy);
    add(decimal(c.commission), c.commission_ccy);
    add(decimal(c.other_charges), c.other_charges_ccy);
    if (decimal(c.freight).gt(0) || decimal(c.commission).gt(0) || decimal(c.other_charges).gt(0)) {
      // The container has one mutable charge snapshot, not time-versioned
      // charge amounts. Prorating is explicit, provisional and auditable.
      warnings.add("HISTORICAL_OTW_CHARGES_UNVERSIONED");
    }
  }
  return { value: cents(total), warnings: [...warnings] };
}

type OrderRow = {
  id: number; customer_name: string; order_date: string; current_status: string;
  grand_total: string; total_qty_bales: number;
  loading_started_at: string | null; verified_at: string | null;
  finalized_at: string | null; updated_at: string;
  loading_before: boolean; verified_before: boolean; finalized_before: boolean;
  scanned_qty: string; scanned_value: string; unknown_scans: string;
  had_charges: boolean; had_unknown_restores: boolean;
  unproven_verification: boolean;
};

async function getHistoricalOrders(
  companyId: number,
  scope: FactoryNetPositionAsOf,
): Promise<{ pendingOrders: DatedPipelineOrder[]; verifiedOrders: DatedPipelineOrder[]; loadingOrders: DatedPipelineOrder[]; warnings: string[] }> {
  const rows = resultRows<OrderRow>(await db.execute(sql`
    WITH scan_events AS (
      SELECT cob.order_id, cob.bale_id, cob.scanned_at, cob.price_used, 0 AS archived
        FROM customer_order_bales cob
        JOIN customer_orders co ON co.id = cob.order_id AND co.company_id = ${companyId}
       WHERE cob.scanned_at IS NOT NULL
         AND ${isBefore(scope, "cob.scanned_at", "timestamptz")}
      UNION ALL
      SELECT h.order_id, h.bale_id, h.scanned_at, h.price_used, 1 AS archived
        FROM customer_order_bales_history h
        JOIN customer_orders co ON co.id = h.order_id AND co.company_id = ${companyId}
       WHERE h.scanned_at IS NOT NULL
         AND ${isBefore(scope, "h.scanned_at", "timestamptz")}
         AND NOT ${isBefore(scope, "h.cancelled_at", "timestamptz")}
    ), active_scans AS (
      SELECT DISTINCT ON (order_id, bale_id)
             order_id, bale_id, price_used
        FROM scan_events
       ORDER BY order_id, bale_id, archived DESC
    ), totals AS (
      SELECT order_id, COUNT(*)::text AS qty,
             COALESCE(SUM(price_used::numeric),0)::text AS scanned_value
        FROM active_scans GROUP BY order_id
    )
    SELECT o.id, COALESCE(c.legal_name, 'Customer #' || o.customer_id::text) AS customer_name,
           o.order_date::text AS order_date, o.status AS current_status,
           o.grand_total::text AS grand_total, o.total_qty_bales, o.updated_at::text,
           o.loading_started_at::text AS loading_started_at,
           COALESCE(verify_event.recorded_at,
             CASE WHEN ${isBefore(scope, "o.updated_at")}
                   AND (COALESCE(${isBefore(scope, "o.verified_at")},false)
                     OR COALESCE(${isBefore(scope, "o.loading_finalized_at")},false))
                  THEN o.updated_at ELSE NULL END)::text AS verified_at,
           o.finalized_at::text AS finalized_at,
           COALESCE(${isBefore(scope, "o.loading_started_at")},false) AS loading_before,
           (verify_event.recorded_at IS NOT NULL OR
             (COALESCE(${isBefore(scope, "o.updated_at")},false) AND
               (COALESCE(${isBefore(scope, "o.verified_at")},false)
                 OR COALESCE(${isBefore(scope, "o.loading_finalized_at")},false)))) AS verified_before,
           (verify_event.recorded_at IS NULL
             AND (COALESCE(${isBefore(scope, "o.verified_at")},false)
               OR COALESCE(${isBefore(scope, "o.loading_finalized_at")},false))
             AND NOT COALESCE(${isBefore(scope, "o.updated_at")},false)) AS unproven_verification,
           COALESCE(${isBefore(scope, "o.finalized_at")},false) AS finalized_before,
           COALESCE(t.qty, '0') AS scanned_qty,
           COALESCE(t.scanned_value, '0') AS scanned_value,
           (SELECT COUNT(*)::text FROM customer_order_bales cob
             WHERE cob.order_id = o.id AND cob.scanned_at IS NULL) AS unknown_scans,
           (EXISTS (SELECT 1 FROM customer_order_charges ch WHERE ch.order_id = o.id)
             OR COALESCE(o.freight_amount,0)::numeric <> 0
             OR COALESCE(o.other_charges_total,0)::numeric <> 0) AS had_charges,
           EXISTS (
             SELECT 1 FROM customer_order_bales_history h
             JOIN customer_order_bales live ON live.order_id = h.order_id AND live.bale_id = h.bale_id
              WHERE h.order_id = o.id
                AND ${isBefore(scope, "h.cancelled_at", "timestamptz")}
                AND live.scanned_at IS NOT NULL
                AND ${isBefore(scope, "live.scanned_at", "timestamptz")}
           ) AS had_unknown_restores
      FROM customer_orders o
      JOIN customers c ON c.id = o.customer_id AND c.company_id = o.company_id
      LEFT JOIN LATERAL (
        SELECT MAX(d.created_at) AS recorded_at
          FROM factory_daybook_entries d
         WHERE d.company_id = o.company_id AND d.reference_table = 'customer_orders'
           AND d.reference_id = o.id
           AND d.tx_type IN ('ORDER_VERIFIED', 'LOADING_SUBMITTED')
           AND d.tx_date <= ${scope.asOf}::date
           AND ${isBefore(scope, "d.created_at")}
      ) verify_event ON TRUE
      LEFT JOIN totals t ON t.order_id = o.id
     WHERE o.company_id = ${companyId}
       AND o.order_date <= ${scope.asOf}::date
       AND ${isBefore(scope, "o.created_at")}
       AND (o.deleted_at IS NULL OR NOT ${isBefore(scope, "o.deleted_at")})
  `));
  const pendingOrders: DatedPipelineOrder[] = [];
  const verifiedOrders: DatedPipelineOrder[] = [];
  const loadingOrders: DatedPipelineOrder[] = [];
  const warnings = new Set<string>();
  for (const r of rows) {
    const stage = orderStageAt({
      created: true,
      loadingStarted: r.loading_before,
      verified: r.verified_before,
      invoiced: r.finalized_before,
      currentStatus: r.current_status,
      loadingStartedAt: r.loading_started_at,
      verifiedAt: r.verified_at,
    });
    if (stage === "FINALIZED") continue;
    if (r.unproven_verification) warnings.add("HISTORICAL_ORDER_BACKDATED_VERIFICATION_UNPROVEN");
    if (stage === "UNKNOWN") {
      warnings.add("HISTORICAL_ORDER_LIFECYCLE_UNVERSIONED");
      continue;
    }
    if (r.current_status === "FINALIZED" && !r.finalized_at) {
      warnings.add("HISTORICAL_ORDER_FINALIZATION_MISSING");
    }
    if (r.had_unknown_restores) warnings.add("HISTORICAL_ORDER_RESTORE_TIME_UNKNOWN");
    if (Number(r.unknown_scans) > 0) warnings.add("HISTORICAL_ORDER_SCAN_TIME_MISSING");
    if (r.had_charges) warnings.add("HISTORICAL_ORDER_CHARGES_UNVERSIONED");
    if (decimal(r.scanned_value).gt(0)) warnings.add("HISTORICAL_ORDER_SCAN_PRICE_EDITS_UNVERSIONED");
    // Historic subtotal equals individually recorded bale scans, not the
    // today's mutable grand_total / total_qty_bales. Never copy tomorrow's
    // unscanned bales into yesterday's pipeline.
    const item: DatedPipelineOrder = {
      id: Number(r.id),
      customerName: r.customer_name,
      orderDate: r.order_date,
      grandTotal: cents(decimal(r.scanned_value)),
      totalQtyBales: Number(r.scanned_qty),
    };
    if (stage === "VERIFIED") verifiedOrders.push(item);
    else if (stage === "LOADING") loadingOrders.push(item);
    else pendingOrders.push(item);
  }
  return { pendingOrders, verifiedOrders, loadingOrders, warnings: [...warnings] };
}

export async function loadHistoricalFactoryPipeline(
  companyId: number,
  scope: FactoryNetPositionAsOf,
  getConfigFx: (cc: string) => number,
): Promise<DatedPipelineSnapshot> {
  let otw: Awaited<ReturnType<typeof getHistoricalOtw>>;
  let orders: Awaited<ReturnType<typeof getHistoricalOrders>>;
  try {
    [otw, orders] = await Promise.all([
      getHistoricalOtw(companyId, scope, getConfigFx),
      getHistoricalOrders(companyId, scope),
    ]);
  } catch (cause) {
    // Never substitute today's container or order totals for a failed date.
    throw new Error("HISTORICAL_NET_POSITION_PIPELINE_FAILED", { cause });
  }
  const sum = (items: readonly DatedPipelineOrder[]) => cents(
    items.reduce((acc, item) => acc.plus(decimal(item.grandTotal)), new MoneyDecimal(0))
  );
  return {
    stockOtwValue: otw.value,
    ...orders,
    pendingTotal: sum(orders.pendingOrders),
    verifiedTotal: sum(orders.verifiedOrders),
    loadingTotal: sum(orders.loadingOrders),
    warnings: [...new Set([...otw.warnings, ...orders.warnings])],
  };
}
