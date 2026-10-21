/**
 * Accounting audit wave 11, agent C: the factory bale cost basis.
 *
 *   - a mix from an AUD container is costed at the container's USD landed cost
 *     (never its AUD cost); a source with no USD rate leaves the mix unvalued
 *     before the cut-over and is refused (409) after it;
 *   - pressing gives each bale weight × the mix's USD cost per kg, so the work
 *     in progress it relieves equals the finished goods it adds; the ERP bale
 *     mirror receives the bales at rate 0 (quantity only);
 *   - a stock-entry bale with no mix costs its product's production price per
 *     bale (cost per kg = price ÷ weight);
 *   - after the cut-over a cost cascade leaves SOLD bales alone (before it, it
 *     re-costs them as it always did) and records a revaluation event;
 *   - the daily factory stock journal posts waste to Factory Waste and
 *     Write-off, revaluations to Factory Stock Revaluation, and only the rest
 *     to Production Variance;
 *   - a factory POS sale records the bales it took; its void restores exactly
 *     those bales, and FPOS-COGS is their cost;
 *
 * The reviewed re-cost and the factory net position are covered by
 * tests/wave11-factory-cost-basis-recost.test.ts on the same fixture
 * (tests/helpers/wave11FactoryCostBasisFixture.ts).
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../server/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/auth")>();
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return { ...actual, requireAuth: pass, requireNonPOS: pass };
});

import { db, pool } from "../server/db";
import { factoryStockValuation } from "../server/services/accounting/perpetualInventory/factoryValuation";
import { syncFactoryStockJournalTx } from "../server/services/accounting/perpetualInventory/factoryStockJournal";
import { cascadeContainerCostChange } from "../server/services/factory/rawStockCostCascade";
import { stockEntryBaleCost } from "../server/services/factory/baleCostBasis";
import {
  PREFIX,
  all,
  audContainer,
  audNoRateContainer,
  bale,
  baleCost,
  call,
  companyId,
  customerId,
  locationId,
  one,
  productId,
  setCutover,
  today,
  usdContainer,
  setupWave11FactoryCostBasisFixture,
} from "./helpers/wave11FactoryCostBasisFixture";

setupWave11FactoryCostBasisFixture();

describe("mix sources at their USD rate", () => {
  it("costs a mix from an AUD container at its USD landed cost, never the AUD cost", async () => {
    const { statusCode, body } = await call("POST /api/factory/mix-batches", {
      body: { sources: [{ containerId: audContainer, weightKg: "100" }] },
    });
    expect({ statusCode, message: body?.message }).toEqual({ statusCode: 200, message: undefined });
    expect(body.unvalued).toBe(false);
    const mix = await one(`SELECT cost_per_kg::text, total_cost::text FROM factory_mix_batches WHERE id = $1`, [
      body.id,
    ]);
    expect(mix).toEqual({ cost_per_kg: "1.3000000", total_cost: "130.0000000" });
    const [source] = await all(`SELECT cost_per_kg::text FROM factory_mix_batch_sources WHERE mix_batch_id = $1`, [
      body.id,
    ]);
    expect(source.cost_per_kg).toBe("1.3000000");
  });

  it("records a mix unvalued before the cut-over and refuses it after when a source has no USD rate", async () => {
    const before = await call("POST /api/factory/mix-batches", {
      body: { sources: [{ containerId: audNoRateContainer, weightKg: "10" }] },
    });
    expect(before.statusCode).toBe(200);
    expect(before.body.unvalued).toBe(true);
    const mix = await one(`SELECT cost_per_kg::text, total_cost::text FROM factory_mix_batches WHERE id = $1`, [
      before.body.id,
    ]);
    expect(mix).toEqual({ cost_per_kg: "0.0000000", total_cost: "0.0000000" });

    await setCutover(true);
    try {
      const after = await call("POST /api/factory/mix-batches", {
        body: { sources: [{ containerId: audNoRateContainer, weightKg: "10" }] },
      });
      expect(after.statusCode).toBe(409);
      expect(after.body.code).toBe("FACTORY_SOURCE_NO_USD_RATE");
    } finally {
      await setCutover(false);
    }
  });
});

describe("bale cost from pressing and stock entry", () => {
  it("prices pressed bales at the mix's USD cost: WIP relieved = finished goods added; the ERP mirror at rate 0", async () => {
    const mixId = (
      await one(
        `INSERT INTO factory_mix_batches (company_id, batch_code, total_weight_kg, used_kg, cost_per_kg, total_cost, status)
         VALUES ($1, $2, 100, 0, 1.3, 130, 'ACTIVE') RETURNING id`,
        [companyId, `${PREFIX}-PRESS`]
      )
    ).id;
    const pressingId = (
      await one(
        `INSERT INTO factory_pressing_batches (company_id, product_id, expected_count) VALUES ($1, $2, 2) RETURNING id`,
        [companyId, productId]
      )
    ).id;
    const bales: number[] = [];
    for (const index of [1, 2]) {
      bales.push(
        (
          await one(
            `INSERT INTO factory_bales (company_id, pressing_batch_id, product_id, bale_code, reference_number,
                                        article_code, weight_kg, status)
             VALUES ($1, $2, $3, $4, $5, $6, 25, 'PENDING_PRESSING') RETURNING id`,
            [companyId, pressingId, productId, `${PREFIX}-PB`, `${PREFIX}-P${index}`, `${PREFIX}ART`]
          )
        ).id
      );
    }
    const valuationBefore = await factoryStockValuation(db, companyId);
    const { statusCode, body } = await call("POST /api/factory/finalize", {
      session: { currentRole: "Admin" },
      body: { pressingBatchId: pressingId, scannedBaleIds: bales, erpLocationId: locationId, mixBatchId: mixId },
    });
    expect({ statusCode, message: body?.message }).toEqual({ statusCode: 200, message: undefined });
    for (const id of bales) {
      expect(await baleCost(id)).toEqual({ cost_per_kg: "1.3000000", total_cost: "32.5000000", status: "IN_STOCK" });
    }
    const valuationAfter = await factoryStockValuation(db, companyId);
    const wipRelieved = valuationBefore.wip.minus(valuationAfter.wip);
    const finishedAdded = valuationAfter.finished.minus(valuationBefore.finished);
    expect(wipRelieved.toFixed(2)).toBe("65.00");
    expect(finishedAdded.toFixed(2)).toBe("65.00");

    const mirror = await one(
      `SELECT i.quantity::text AS quantity, i.total_value::text AS value
         FROM inventory i JOIN stock_items si ON si.id = i.stock_item_id
        WHERE i.location_id = $1 AND si.code = $2`,
      [locationId, `${PREFIX}ART`]
    );
    expect(Number(mirror.quantity)).toBe(2);
    expect(Number(mirror.value)).toBe(0);
  });

  it("costs a stock-entry bale with no mix at its production price per bale", async () => {
    const { statusCode, body } = await call("POST /api/factory/stock-entry", {
      body: { items: [{ productId, qty: 2, weightPerBaleKg: "25" }], erpLocationId: locationId, entryDate: today },
    });
    expect({ statusCode, message: body?.message }).toEqual({ statusCode: 200, message: undefined });
    expect(body.bales).toHaveLength(2);
    for (const created of body.bales) {
      expect(await baleCost(created.id)).toEqual({
        cost_per_kg: "1.6000000",
        total_cost: "40.0000000",
        status: "IN_STOCK",
      });
    }
    // The old rule was production price × kg: 25 × 40 = 1,000 per bale.
    expect(stockEntryBaleCost("40", "25").totalCost.toFixed(2)).toBe("40.00");
    expect(stockEntryBaleCost("40", "25", "HMD16-X").totalCost.toFixed(2)).toBe("0.00");
  });
});

describe("factory POS sale bales", () => {
  it("records the bales a sale took and its void restores exactly those", async () => {
    // A SOLD bale of the same product at the location with a higher id: the old
    // void re-opened "the most recent SOLD bale", which would be this one.
    const sale = await call("POST /api/factory/pos/sale", {
      body: {
        locationId,
        // Wave 8.4 continuation: an unpaid credit sale needs a customer (its
        // receivable is posted to the customer's ledger).
        customerId,
        paymentType: "CREDIT",
        depositAmount: "0",
        items: [{ productId, productName: "P", quantity: 1, unitPrice: "60" }],
        txDate: today,
        clientRequestId: `${PREFIX}-sale-1`,
      },
    });
    expect({ statusCode: sale.statusCode, message: sale.body?.message }).toEqual({
      statusCode: 200,
      message: undefined,
    });
    const recorded = await all<{ bale_id: number }>(`SELECT bale_id FROM factory_pos_sale_bales WHERE sale_id = $1`, [
      sale.body.id,
    ]);
    expect(recorded).toHaveLength(1);
    const taken = recorded[0].bale_id;
    expect((await baleCost(taken)).status).toBe("SOLD");
    const otherSold = await bale({ status: "SOLD", weight: "25", costPerKg: "1.3", totalCost: "32.5" });

    const voided = await call("DELETE /api/factory/pos/sales/:id", { params: { id: String(sale.body.id) } });
    expect(voided.statusCode).toBe(200);
    expect((await baleCost(taken)).status).toBe("IN_STOCK");
    expect((await baleCost(otherSold)).status).toBe("SOLD");
    expect(await all(`SELECT 1 FROM factory_pos_sale_bales WHERE sale_id = $1`, [sale.body.id])).toEqual([]);
    await pool.query(`UPDATE factory_bales SET status = 'REMOVED' WHERE id = $1`, [otherSold]);
  });
});

describe("after the cut-over", () => {
  let cascadeMix: number;
  let inStock: number;
  let sold: number;

  beforeAll(async () => {
    cascadeMix = (
      await one(
        `INSERT INTO factory_mix_batches (company_id, batch_code, total_weight_kg, used_kg, cost_per_kg, total_cost, status)
         VALUES ($1, $2, 20, 20, 1.0, 20, 'CLOSED') RETURNING id`,
        [companyId, `${PREFIX}-CASC`]
      )
    ).id;
    await pool.query(
      `INSERT INTO factory_mix_batch_sources (mix_batch_id, container_id, source_type, weight_kg, cost_per_kg, total_cost)
       VALUES ($1, $2, 'CONTAINER_DIRECT', 20, 1.0, 20)`,
      [cascadeMix, usdContainer]
    );
    inStock = await bale({ status: "IN_STOCK", weight: "10", costPerKg: "1", totalCost: "10", mixBatchId: cascadeMix });
    sold = await bale({ status: "SOLD", weight: "10", costPerKg: "1", totalCost: "10", mixBatchId: cascadeMix });
  });

  it("re-costs SOLD bales before the cut-over, as it always did", async () => {
    await db.transaction((tx) =>
      cascadeContainerCostChange(
        tx,
        { companyId, containerId: usdContainer, newCostPerKg: 1.5, newCostPerKgUsd: 1.5 },
        { includeCompletedBatches: true }
      )
    );
    expect((await baleCost(inStock)).total_cost).toBe("15.0000000");
    expect((await baleCost(sold)).total_cost).toBe("15.0000000");
    expect(await all(`SELECT 1 FROM factory_stock_value_events WHERE company_id = $1`, [companyId])).toEqual([]);
  });

  it("leaves SOLD bales alone after it, and tags the revaluation", async () => {
    await setCutover(true);
    await db.transaction((tx) =>
      cascadeContainerCostChange(
        tx,
        { companyId, containerId: usdContainer, newCostPerKg: 2, newCostPerKgUsd: 2 },
        { includeCompletedBatches: true }
      )
    );
    expect((await baleCost(inStock)).total_cost).toBe("20.0000000");
    expect((await baleCost(sold)).total_cost).toBe("15.0000000");
    // Raw: 100 kg left × (2 − 1.5) = 50; the in-stock bale: 20 − 15 = 5.
    const events = await all(
      `SELECT kind, amount::text AS amount FROM factory_stock_value_events WHERE company_id = $1 ORDER BY id`,
      [companyId]
    );
    expect(events).toEqual([{ kind: "REVALUATION", amount: "55.0000000" }]);
  });

  it("splits the daily factory stock journal by source", async () => {
    const wasted = await bale({ status: "IN_STOCK", weight: "10", costPerKg: "3", totalCost: "30" });
    const removal = await call("POST /api/factory/stock-entry/remove", {
      body: {
        baleIds: [wasted],
        supervisorUsername: `${PREFIX}_supervisor`,
        supervisorPassword: "supervisor-pass",
        reason: "damaged",
      },
    });
    expect({ statusCode: removal.statusCode, message: removal.body?.message }).toEqual({
      statusCode: 200,
      message: undefined,
    });
    expect((await baleCost(wasted)).status).toBe("DELETED");
    const result = await db.transaction((tx) => syncFactoryStockJournalTx(tx, companyId, today));
    expect(result.voucherId).not.toBeNull();
    expect(result.explained).toEqual({
      FACTORY_WASTE_WRITE_OFF: "30.00",
      FACTORY_REVALUATION: "-55.00",
      FACTORY_MATERIAL_PRICE_VARIANCE: "0.00",
    });
    const lines = await all(
      `SELECT la.code, ve.debit_amount::text AS d, ve.credit_amount::text AS c
         FROM voucher_entries ve JOIN ledger_accounts la ON la.id = ve.ledger_account_id
        WHERE ve.voucher_id = $1 ORDER BY ve.id`,
      [result.voucherId]
    );
    expect(lines).toEqual(
      expect.arrayContaining([
        { code: "FACTORY_WASTE_WRITE_OFF", d: "30.00", c: "0.00" },
        { code: "FACTORY_REVALUATION", d: "0.00", c: "55.00" },
      ])
    );
    // Production Variance takes only what no tagged change explains.
    const moved = result.accounts.reduce((sum, account) => sum + Number(account.amount), 0);
    const remainder = Number(result.received) - moved - 30 + 55;
    expect(Number(result.variance)).toBeCloseTo(remainder, 2);
    // The events now belong to today's journal; a second run the same day replaces it with the same split.
    const again = await db.transaction((tx) => syncFactoryStockJournalTx(tx, companyId, today));
    expect(again.explained).toEqual(result.explained);
  });

  it("posts FPOS-COGS for exactly the bales the sale took", async () => {
    const sale = await call("POST /api/factory/pos/sale", {
      body: {
        locationId,
        // Wave 8.4 continuation: an unpaid credit sale needs a customer (its
        // receivable is posted to the customer's ledger).
        customerId,
        paymentType: "CREDIT",
        depositAmount: "0",
        items: [{ productId, productName: "P", quantity: 1, unitPrice: "60" }],
        txDate: today,
        clientRequestId: `${PREFIX}-sale-2`,
      },
    });
    expect(sale.statusCode).toBe(200);
    const [recorded] = await all<{ bale_id: number }>(`SELECT bale_id FROM factory_pos_sale_bales WHERE sale_id = $1`, [
      sale.body.id,
    ]);
    const cost = (await baleCost(recorded.bale_id)).total_cost;
    const cogs = await all(
      `SELECT la.code, ve.debit_amount::text AS d, ve.credit_amount::text AS c
         FROM vouchers v JOIN voucher_entries ve ON ve.voucher_id = v.id JOIN ledger_accounts la ON la.id = ve.ledger_account_id
        WHERE v.company_id = $1 AND v.voucher_number = $2 ORDER BY ve.id`,
      [companyId, `FPOS-COGS-${sale.body.id}`]
    );
    const amount = Number(cost).toFixed(2);
    expect(cogs).toEqual([
      { code: "COGS", d: amount, c: "0.00" },
      { code: "FACTORY_FINISHED_GOODS", d: "0.00", c: amount },
    ]);
    const voided = await call("DELETE /api/factory/pos/sales/:id", { params: { id: String(sale.body.id) } });
    expect(voided.statusCode).toBe(200);
    expect((await baleCost(recorded.bale_id)).status).toBe("IN_STOCK");
    expect(
      await all(`SELECT 1 FROM vouchers WHERE company_id = $1 AND voucher_number = $2`, [
        companyId,
        `FPOS-COGS-${sale.body.id}`,
      ])
    ).toEqual([]);
  });

  afterAll(async () => {
    await setCutover(false);
  });
});
