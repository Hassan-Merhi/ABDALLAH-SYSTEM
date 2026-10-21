/**
 * Accounting audit wave 11, agent C: the factory bale cost basis (continued).
 *
 *   - the reviewed re-cost: preview, Owner-only apply of the reviewed hash,
 *     audited; it posts FACTORY-RECOST to Factory Stock Revaluation after the
 *     cut-over and nothing before; SOLD bales are never re-costed;
 *   - the factory net position (since #2214 / #2216) values available bales like
 *     the Location Inventory page, lists unfinalized orders for information only,
 *     and refuses to value stock in a currency with no confirmed USD rate.
 *
 * The mix, pressing, stock-entry, POS sale and cut-over cases are covered by
 * tests/wave11-factory-cost-basis.test.ts on the same fixture
 * (tests/helpers/wave11FactoryCostBasisFixture.ts).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../server/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../server/auth")>();
  const pass = (_req: unknown, _res: unknown, next: () => void) => next();
  return { ...actual, requireAuth: pass, requireNonPOS: pass };
});

import { db, pool } from "../server/db";
import { factoryStockValuation } from "../server/services/accounting/perpetualInventory/factoryValuation";
import {
  all,
  bale,
  baleCost,
  call,
  companyId,
  customerId,
  locationId,
  one,
  setCutover,
  today,
  setupWave11FactoryCostBasisFixture,
} from "./helpers/wave11FactoryCostBasisFixture";

setupWave11FactoryCostBasisFixture();

describe("the reviewed bale re-cost", () => {
  it("is Owner-only, applies only the reviewed plan, never re-costs SOLD bales, and posts nothing before the cut-over", async () => {
    // A stock-entry bale costed by the old rule (production price × kg = 1,000).
    const stale = await bale({ status: "IN_STOCK", weight: "25", costPerKg: "40", totalCost: "1000" });
    const staleSold = await bale({ status: "SOLD", weight: "25", costPerKg: "40", totalCost: "1000" });

    const preview = await call("GET /api/factory/bale-cost/recost-preview", { user: { role: "Owner" } });
    expect(preview.statusCode).toBe(200);
    expect(preview.body.perpetual).toBe(false);
    const line = preview.body.bales.find((row: { id: number }) => row.id === stale);
    expect(line).toMatchObject({
      basis: "production-price",
      oldTotalCost: "1000.0000000",
      newTotalCost: "40.0000000",
      newCostPerKg: "1.6000000",
      change: "-960.00",
    });
    expect(preview.body.bales.some((row: { id: number }) => row.id === staleSold)).toBe(false);

    const asAdmin = await call("POST /api/factory/bale-cost/recost-apply", {
      user: { role: "Admin" },
      body: { confirm: true, planHash: preview.body.planHash },
    });
    expect(asAdmin.statusCode).toBe(403);
    const wrongHash = await call("POST /api/factory/bale-cost/recost-apply", {
      user: { role: "Owner" },
      body: { confirm: true, planHash: "0".repeat(64) },
    });
    expect(wrongHash).toMatchObject({ statusCode: 409, body: { code: "PLAN_CHANGED" } });

    const applied = await call("POST /api/factory/bale-cost/recost-apply", {
      user: { role: "Owner" },
      body: { confirm: true, planHash: preview.body.planHash },
    });
    expect({ statusCode: applied.statusCode, message: applied.body?.message }).toEqual({
      statusCode: 200,
      message: undefined,
    });
    expect(applied.body.voucherId).toBeNull();
    expect((await baleCost(stale)).total_cost).toBe("40.0000000");
    expect((await baleCost(staleSold)).total_cost).toBe("1000.0000000");
    const run = await one(`SELECT plan_hash, voucher_id FROM factory_bale_recost_runs WHERE id = $1`, [
      applied.body.runId,
    ]);
    expect(run).toEqual({ plan_hash: preview.body.planHash, voucher_id: null });
    const audit = await all(
      `SELECT 1 FROM audit_log WHERE company_id = $1 AND table_name = 'factory_bales' AND record_id = $2`,
      [companyId, applied.body.runId]
    );
    expect(audit).toHaveLength(1);
  });

  it("reviews SOLD bales on genuinely uninvoiced VERIFIED orders, but refuses invoiced or finalized orders", async () => {
    const unbilled = await bale({ status: "SOLD", weight: "25", costPerKg: "40", totalCost: "1000" });
    const invoiceMarked = await bale({ status: "SOLD", weight: "25", costPerKg: "40", totalCost: "1000" });
    const finalized = await bale({ status: "SOLD", weight: "25", costPerKg: "40", totalCost: "1000" });

    const link = async (baleId: number, status: string, invoiced: boolean) => {
      const rec = await one<{ reference_number: string }>("SELECT reference_number FROM factory_bales WHERE id = $1", [
        baleId,
      ]);
      const order = await one<{ id: number }>(
        `INSERT INTO customer_orders
          (company_id, customer_id, order_date, status, invoice_number, finalized_at)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [companyId, customerId, today, status, invoiced ? `INV-${baleId}` : null, invoiced ? new Date() : null]
      );
      await pool.query(
        `INSERT INTO customer_order_bales
          (order_id, bale_id, bale_reference, location_id, weight, price_used)
         VALUES ($1,$2,$3,$4,25,60)`,
        [order.id, baleId, rec.reference_number, locationId]
      );
      return order.id;
    };

    const unbilledOrder = await link(unbilled, "VERIFIED", false);
    await link(invoiceMarked, "VERIFIED", true);
    await link(finalized, "FINALIZED", true);

    // A bale on two VERIFIED orders: one clean, one whose SALE ledger entry
    // exists even though the order row never received an invoice number.
    const saleLedgerBacked = await bale({ status: "SOLD", weight: "25", costPerKg: "40", totalCost: "1000" });
    await link(saleLedgerBacked, "VERIFIED", false);
    const saleLedgerOrder = await link(saleLedgerBacked, "VERIFIED", false);
    await pool.query(
      `INSERT INTO customer_balances
        (company_id, customer_id, transaction_date, transaction_type, reference_type, reference_id,
         debit_amount, credit_amount, balance, description)
       VALUES ($1,$2,$3,'SALE','INVOICE',$4,60,0,60,'historical sale')`,
      [companyId, customerId, today, saleLedgerOrder]
    );

    const preview = await call("GET /api/factory/bale-cost/recost-preview", { user: { role: "Owner" } });
    expect(preview.statusCode).toBe(200);
    expect(preview.body.bales.some((r: { id: number }) => r.id === saleLedgerBacked)).toBe(false);

    // The read-only audit ranks the SALE-ledger order above the clean one, so
    // the bale reports as invoice evidence rather than as an open order.
    const evidence = await call("GET /api/factory/bale-cost/historical-sold-audit", {
      query: { group: "VERIFIED_WITH_INVOICE_EVIDENCE", limit: "50", offset: "0" },
      user: { role: "Owner" },
    });
    expect(evidence.statusCode).toBe(200);
    expect(evidence.body.details.find((r: { id: number }) => r.id === saleLedgerBacked)).toMatchObject({
      order_id: saleLedgerOrder,
      sale_balance_exists: true,
      review_group: "VERIFIED_WITH_INVOICE_EVIDENCE",
    });
    expect(preview.body.bales.find((r: { id: number }) => r.id === unbilled)).toMatchObject({
      status: "SOLD",
      eligibility: "sold-on-uninvoiced-verified-order",
      oldTotalCost: "1000.0000000",
      newTotalCost: "40.0000000",
    });
    expect(preview.body.bales.some((r: { id: number }) => r.id === invoiceMarked)).toBe(false);
    expect(preview.body.bales.some((r: { id: number }) => r.id === finalized)).toBe(false);

    // A separate explicit Owner approval is required when SOLD bales remain
    // part of stock because their orders have not yet been invoiced.
    const noSecondConfirmation = await call("POST /api/factory/bale-cost/recost-apply", {
      user: { role: "Owner" },
      body: { confirm: true, planHash: preview.body.planHash },
    });
    expect(noSecondConfirmation).toMatchObject({
      statusCode: 409,
      body: { code: "VERIFIED_SOLD_CONFIRM_REQUIRED" },
    });

    // Even without changing the stored SOLD status, an invoice issued between
    // preview and apply must invalidate the previously reviewed plan hash.
    await pool.query("UPDATE customer_orders SET invoice_number=$1, finalized_at=NOW() WHERE id=$2", [
      `INV-${unbilledOrder}`,
      unbilledOrder,
    ]);
    const refused = await call("POST /api/factory/bale-cost/recost-apply", {
      user: { role: "Owner" },
      body: { confirm: true, confirmVerifiedSoldBales: true, planHash: preview.body.planHash },
    });
    expect(refused).toMatchObject({ statusCode: 409, body: { code: "PLAN_CHANGED" } });
    expect((await baleCost(unbilled)).total_cost).toBe("1000.0000000");
    expect((await baleCost(invoiceMarked)).total_cost).toBe("1000.0000000");
    expect((await baleCost(finalized)).total_cost).toBe("1000.0000000");
    expect((await baleCost(saleLedgerBacked)).total_cost).toBe("1000.0000000");
  });

  it("includes uninvoiced VERIFIED-order SOLD bales in book stock and changes their value only after both approvals", async () => {
    const preinvoiceSold = await bale({ status: "SOLD", weight: "25", costPerKg: "40", totalCost: "1000" });
    const rec = await one<{ reference_number: string }>("SELECT reference_number FROM factory_bales WHERE id=$1", [
      preinvoiceSold,
    ]);
    const order = await one<{ id: number }>(
      "INSERT INTO customer_orders (company_id, customer_id, order_date, status) VALUES ($1,$2,$3,'VERIFIED') RETURNING id",
      [companyId, customerId, today]
    );
    await pool.query(
      "INSERT INTO customer_order_bales (order_id,bale_id,bale_reference,location_id,weight,price_used) VALUES ($1,$2,$3,$4,25,60)",
      [order.id, preinvoiceSold, rec.reference_number, locationId]
    );
    const before = await factoryStockValuation(db, companyId);
    const preview = await call("GET /api/factory/bale-cost/recost-preview", { user: { role: "Owner" } });
    expect(preview.statusCode).toBe(200);
    expect(preview.body.bales.some((r: { id: number }) => r.id === preinvoiceSold)).toBe(true);

    const applied = await call("POST /api/factory/bale-cost/recost-apply", {
      user: { role: "Owner" },
      body: { confirm: true, confirmVerifiedSoldBales: true, planHash: preview.body.planHash },
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.body.voucherId).toBeNull(); // No perpetual-inventory cutover in test.
    expect(await baleCost(preinvoiceSold)).toMatchObject({
      status: "SOLD",
      total_cost: "40.0000000",
      cost_per_kg: "1.6000000",
    });
    const after = await factoryStockValuation(db, companyId);
    // The per-bale cost change reduces finished goods; it does not restore
    // or duplicate a physical bale, and the order stays VERIFIED.
    expect(Number(before.soldNotInvoiced.cost) - Number(after.soldNotInvoiced.cost)).toBeCloseTo(960, 2);
    expect((await one<{ status: string }>("SELECT status FROM customer_orders WHERE id=$1", [order.id])).status).toBe(
      "VERIFIED"
    );

    const audit = await call("GET /api/factory/bale-cost/historical-sold-audit", {
      query: { group: "OPEN_VERIFIED_UNINVOICED", limit: "10", offset: "0" },
      user: { role: "Owner" },
    });
    expect(audit.statusCode).toBe(200);
    expect(audit.body.readOnly).toBe(true);
    expect(audit.body.valuationBasis).toBe("current-catalogue-only-NOT-historical-price-at-sale");
  });

  it("posts the value change to Factory Stock Revaluation after the cut-over", async () => {
    const stale = await bale({ status: "IN_STOCK", weight: "25", costPerKg: "4", totalCost: "100" });
    await setCutover(true);
    try {
      const preview = await call("GET /api/factory/bale-cost/recost-preview", { user: { role: "Owner" } });
      expect(preview.body.perpetual).toBe(true);
      const applied = await call("POST /api/factory/bale-cost/recost-apply", {
        user: { role: "Owner" },
        body: { confirm: true, planHash: preview.body.planHash },
      });
      expect(applied.statusCode).toBe(200);
      expect((await baleCost(stale)).total_cost).toBe("40.0000000");
      const lines = await all(
        `SELECT la.code, ve.debit_amount::text AS d, ve.credit_amount::text AS c
           FROM vouchers v JOIN voucher_entries ve ON ve.voucher_id = v.id JOIN ledger_accounts la ON la.id = ve.ledger_account_id
          WHERE v.company_id = $1 AND v.voucher_number = $2 ORDER BY ve.id`,
        [companyId, `FACTORY-RECOST-${companyId}-${applied.body.runId}`]
      );
      const total = Number(preview.body.totals.total);
      expect(total).toBeLessThan(0);
      expect(lines).toEqual(
        expect.arrayContaining([
          { code: "FACTORY_FINISHED_GOODS", d: "0.00", c: (-Number(preview.body.totals.finishedChange)).toFixed(2) },
          { code: "FACTORY_REVALUATION", d: (-total).toFixed(2), c: "0.00" },
        ])
      );
    } finally {
      await setCutover(false);
    }
  });
});

describe("factory net position", () => {
  it("refuses to value stock in a currency with no confirmed USD rate", async () => {
    // #2216: the AUD containers need a manual AUD rate; none is configured yet.
    await pool.query(`DELETE FROM factory_fx_rates WHERE company_id = $1`, [companyId]);
    const { statusCode, body } = await call("GET /api/factory/net-position", { query: { asOf: today } });
    expect({ statusCode, message: body?.message }).toEqual({
      statusCode: 500,
      message: "Missing confirmed USD exchange rate for AUD",
    });
  });

  it("values available bales like Location Inventory and lists unfinalized orders for information only", async () => {
    await pool.query(
      `INSERT INTO factory_fx_rates (company_id, currency_code, rate_to_usd, effective_date, source)
       VALUES ($1, 'AUD', '0.65', $2, 'manual')`,
      [companyId, today]
    );
    await bale({ status: "IN_STOCK", weight: "30", costPerKg: "2", totalCost: "60", product: true });
    const reserved = await bale({
      status: "RESERVED_FOR_ORDER",
      weight: "25",
      costPerKg: "3.08",
      totalCost: "77",
      product: true,
    });
    const orderId = (
      await one(
        `INSERT INTO customer_orders (company_id, customer_id, order_date, status, grand_total)
         VALUES ($1, $2, $3, 'PENDING_VERIFICATION', 500) RETURNING id`,
        [companyId, customerId, today]
      )
    ).id;
    await pool.query(
      `INSERT INTO customer_order_bales (order_id, bale_id, bale_reference, location_id, weight, price_used)
       VALUES ($1, $2, 'R', $3, 25, 500)`,
      [orderId, reserved, locationId]
    );

    // #2214: Stock In Hand matches the Location Inventory page - available IN_STOCK
    // bales not on any order, at their product's catalogue production price.
    const expected = await one<{ value: string }>(
      `SELECT COALESCE(SUM(p.production_price), 0)::text AS value
         FROM factory_bales b
         LEFT JOIN factory_bale_products p ON p.id = b.product_id
        WHERE b.company_id = $1 AND b.status = 'IN_STOCK' AND b.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM customer_order_bales cob WHERE cob.bale_id = b.id)`,
      [companyId]
    );
    const { statusCode, body } = await call("GET /api/factory/net-position", { query: { asOf: today } });
    expect({ statusCode, message: body?.message }).toEqual({ statusCode: 200, message: undefined });
    expect(Number(expected.value)).toBeGreaterThan(0);
    expect(body.inventoryValue).toBeCloseTo(Number(expected.value), 2);
    expect(body.forUs.accounts).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "INVENTORY", value: body.inventoryValue })])
    );

    // #2216: the unfinalized order is not a collectible receivable - listed, never counted.
    expect(body.pendingTotal).toBe(500);
    expect(body.pendingOrders).toEqual([expect.objectContaining({ id: orderId, grandTotal: 500 })]);
    expect(body.forUs.accounts.some((a: { code: string }) => a.code === "PENDING_ORDERS")).toBe(false);
    const accountsTotal = body.forUs.accounts.reduce((sum: number, a: { value: number }) => sum + a.value, 0);
    expect(body.forUsTotal).toBeCloseTo(accountsTotal, 2);
  });
});
