import { sql } from "drizzle-orm";

import { db } from "../../../db";
import { resultRows } from "../../../lib/queryResult";
import { MoneyDecimal, toMoney } from "../../../lib/money";
import { getFactoryBalanceOnTableSnapshot } from "../../../services/factory/productionBalanceOnTable";
import type { FactoryNetPositionAsOf } from "@shared/factoryNetPositionAsOf";

type NetPositionAccount = {
  name: string;
  code: string;
  value: number;
  category: string;
  [key: string]: unknown;
};

type NetPositionResponse = {
  asOf?: string;
  forUsTotal: number;
  onUsTotal: number;
  netPosition: number;
  netPositionLabel: string;
  forUs: {
    total: number;
    breakdown: Array<{ name: string; value: number }>;
    accounts: NetPositionAccount[];
  };
  onUs: {
    total: number;
    breakdown: Array<{ name: string; value: number }>;
    accounts: NetPositionAccount[];
  };
  inventoryValue?: number;
  rawMaterialValue?: number;
  balanceOnTableValue?: number;
  [key: string]: unknown;
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function recomputeBreakdown(accounts: NetPositionAccount[]) {
  const totals = new Map<string, number>();
  for (const account of accounts) {
    totals.set(account.category, (totals.get(account.category) ?? 0) + Number(account.value || 0));
  }
  return [...totals.entries()]
    .map(([name, value]) => ({ name, value: round2(value) }))
    .sort((a, b) => b.value - a.value);
}

function replaceAccountValue(accounts: NetPositionAccount[], code: string, value: number) {
  const account = accounts.find((row) => row.code === code);
  if (account) account.value = round2(value);
}

/**
 * Historical inventory, raw-material and balance-on-table values, computed as
 * decimals and rounded half up to cents once at the end: 6.7 kg left on the
 * table at 0.35/kg is 2.35 (the float product 2.3449999... rounded to 2.34).
 */
export async function computeHistoricalOperationalValues(
  companyId: number,
  asOf: string,
  currentRawMaterialValue: number,
  valuationMode: "cost" | "selling"
) {
  const stockResult = await db.execute(sql`
    SELECT
      COALESCE(SUM(p.production_price::numeric), 0) AS total_cost,
      COALESCE(SUM(p.selling_price::numeric), 0) AS total_selling
    FROM factory_bales b
    JOIN factory_bale_products p ON p.id = b.product_id
    WHERE b.company_id = ${companyId}
      AND p.company_id = ${companyId}
      AND COALESCE(b.stock_entry_date, b.pressed_at::date, b.created_at::date) <= ${asOf}::date
      AND (b.finalized_at IS NULL OR b.finalized_at::date > ${asOf}::date)
      AND (b.deleted_at IS NULL OR b.deleted_at::date > ${asOf}::date)
      AND b.status <> 'PENDING_PRESSING'
  `);
  const stockRow = resultRows(stockResult)[0] ?? {};
  const cents = (value: InstanceType<typeof MoneyDecimal>) => value.toDecimalPlaces(2).toNumber();
  const inventoryCostValue = cents(toMoney(stockRow.total_cost as string));
  const inventorySellingValue = cents(toMoney(stockRow.total_selling as string));
  const inventoryValue = valuationMode === "selling" ? inventorySellingValue : inventoryCostValue;

  // Historical Net Position uses the exact same as-of snapshot as Production
  // Overview with its end-date set to asOf (including bale status exclusions).
  const balanceOnTableValue = (await getFactoryBalanceOnTableSnapshot(companyId, asOf)).value;

  const consumedAfterResult = await db.execute(sql`
    SELECT COALESCE(SUM(fms.total_cost::numeric), 0) AS value_after
    FROM factory_mix_batch_sources fms
    JOIN factory_mix_batches fmb ON fmb.id = fms.mix_batch_id
    WHERE fmb.company_id = ${companyId}
      AND COALESCE(fmb.batch_date, fmb.created_at::date) > ${asOf}::date
      AND fmb.deleted_at IS NULL
  `);
  const consumedAfterRow = resultRows(consumedAfterResult)[0] ?? {};
  const consumedAfter = toMoney(consumedAfterRow.value_after as string);

  const receiptsAfterResult = await db.execute(sql`
    SELECT COALESCE(SUM(
      frs.received_kg::numeric * COALESCE(NULLIF(frs.cost_per_kg_usd::numeric, 0), frs.cost_per_kg::numeric, 0)
    ), 0) AS value_after
    FROM factory_raw_stock frs
    WHERE frs.company_id = ${companyId}
      AND frs.offloaded_at::date > ${asOf}::date
      AND frs.deleted_at IS NULL
  `);
  const receiptsAfterRow = resultRows(receiptsAfterResult)[0] ?? {};
  const receiptsAfter = toMoney(receiptsAfterRow.value_after as string);

  const adjustmentsAfterResult = await db.execute(sql`
    SELECT COALESCE(SUM(
      CASE
        WHEN type = 'ADD' THEN kg::numeric * COALESCE(cost_per_kg::numeric, 0)
        WHEN type = 'DEDUCT' THEN -(kg::numeric * COALESCE(cost_per_kg::numeric, 0))
        ELSE 0
      END
    ), 0) AS value_after
    FROM factory_raw_material_adjustments
    WHERE company_id = ${companyId}
      AND date::date > ${asOf}::date
      AND deleted_at IS NULL
  `);
  const adjustmentsAfterRow = resultRows(adjustmentsAfterResult)[0] ?? {};
  const adjustmentsAfter = toMoney(adjustmentsAfterRow.value_after as string);

  const rawMaterialValue = cents(
    MoneyDecimal.max(
      toMoney(currentRawMaterialValue).plus(consumedAfter).minus(receiptsAfter).minus(adjustmentsAfter),
      0
    )
  );

  return { inventoryValue, rawMaterialValue, balanceOnTableValue };
}

/**
 * Transitional projection for the three production-valued rows until Phases
 * 4–5 replace current-state inventory with dated movements. Kept within the
 * main handler (rather than intercepting res.json), so a failed projection
 * cannot silently return an incorrect success response.
 */
export async function applyHistoricalOperationalCorrection<T extends NetPositionResponse>(
  companyId: number,
  scope: FactoryNetPositionAsOf,
  body: T,
  valuationMode: "cost" | "selling",
): Promise<T> {
  if (!scope.isHistorical) return body;
  if (!Array.isArray(body?.forUs?.accounts) || typeof body.rawMaterialValue !== "number") {
    throw new Error("HISTORICAL_NET_POSITION_RESPONSE_INCOMPLETE");
  }
  let historical: Awaited<ReturnType<typeof computeHistoricalOperationalValues>>;
  try {
    historical = await computeHistoricalOperationalValues(
      companyId,
      scope.asOf,
      body.rawMaterialValue,
      valuationMode,
    );
  } catch (cause) {
    // The main route translates this to a structured 503 response. Never
    // substitute the original (possibly live) figures for a dated snapshot.
    throw new Error("HISTORICAL_NET_POSITION_REPLAY_FAILED", { cause });
  }
  const inventory = body.forUs.accounts.find((row) => row.code === "INVENTORY");
  const rawMaterial = body.forUs.accounts.find((row) => row.code === "RAW_MATERIAL");
  if (!inventory || !rawMaterial) throw new Error("HISTORICAL_STOCK_ROWS_MISSING");

  replaceAccountValue(body.forUs.accounts, "INVENTORY", historical.inventoryValue);
  replaceAccountValue(body.forUs.accounts, "RAW_MATERIAL", historical.rawMaterialValue);
  replaceAccountValue(body.forUs.accounts, "BALANCE_ON_TABLE", historical.balanceOnTableValue);

  body.inventoryValue = historical.inventoryValue;
  body.rawMaterialValue = historical.rawMaterialValue;
  body.balanceOnTableValue = historical.balanceOnTableValue;
  body.forUs.breakdown = recomputeBreakdown(body.forUs.accounts);
  body.forUsTotal = round2(body.forUs.accounts.reduce((sum, account) => sum + Number(account.value || 0), 0));
  body.forUs.total = body.forUsTotal;
  body.netPosition = round2(body.forUsTotal - body.onUsTotal);
  body.netPositionLabel = body.netPosition >= 0 ? "We have more than we owe" : "We owe more than we have";
  return body;
}
