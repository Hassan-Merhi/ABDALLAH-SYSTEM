/**
 * Payment and receipt vouchers, worker deductions, manual advance repayments
 * and POS shift close used to read amounts with parseFloat. A binary float
 * cannot hold most cent values: 1.005 is 1.00499…, so toFixed(2) wrote a
 * repayment of 1.00 against an advance of 2.00 while the remaining balance
 * became 0.99, and the advance no longer added up. These routes now compute in exact decimals at cents.
 */
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { pool } from "../server/db";
import { seedTestData, cleanupTestData, closeTestServer, type TestContext } from "./setup";

const TEST_PREFIX = "mexact15";

let ctx: TestContext;
let agent: request.SuperAgentTest;
let workerId: number;

beforeAll(async () => {
  ctx = await seedTestData(TEST_PREFIX);
  await pool.query(`UPDATE companies SET company_type = 'factory' WHERE id = $1`, [ctx.companyId]);
  agent = request.agent(ctx.app);
  const login = await agent.post("/api/auth/login").send({
    username: `${TEST_PREFIX}_testuser`,
    password: "testpassword123",
  });
  if (login.status !== 200) throw new Error(`Login failed: ${login.status}`);
  await agent.post("/api/auth/set-company").send({ companyId: ctx.companyId });

  const worker = await pool.query<{ id: number }>(
    `INSERT INTO factory_workers (company_id, full_name) VALUES ($1, $2) RETURNING id`,
    [ctx.companyId, `${TEST_PREFIX} Worker`]
  );
  workerId = worker.rows[0].id;
}, 120000);

afterAll(async () => {
  await pool.query(`DELETE FROM factory_advance_repayments WHERE company_id = $1`, [ctx.companyId]);
  await pool.query(`DELETE FROM factory_worker_advances WHERE company_id = $1`, [ctx.companyId]);
  await pool.query(`DELETE FROM factory_worker_deductions WHERE company_id = $1`, [ctx.companyId]);
  await pool.query(`DELETE FROM factory_workers WHERE company_id = $1`, [ctx.companyId]);
  await cleanupTestData(TEST_PREFIX);
  closeTestServer();
}, 60000);

describe("exact money in payroll and voucher writes", () => {
  it("refuses a payment voucher whose entry amount is not a number", async () => {
    const response = await agent.post("/api/vouchers/payment-receipt").send({
      voucherType: "Payment",
      voucherDate: "2026-10-01",
      paymentAccountType: "ledger",
      paymentAccountId: ctx.cashAccountId,
      entries: [{ accountType: "ledger", accountId: ctx.salesAccountId, amount: "abc" }],
    });
    expect([response.status, response.body.message]).toEqual([400, "Invalid amount"]);
  });

  it("stores a CFA payment voucher's base total as the entries over the rate", async () => {
    const response = await agent.post("/api/vouchers/payment-receipt").send({
      voucherType: "Payment",
      voucherDate: "2026-10-01",
      paymentAccountType: "ledger",
      paymentAccountId: ctx.cashAccountId,
      currency: "XOF",
      exchangeRate: "655.957",
      entries: [
        { accountType: "ledger", accountId: ctx.salesAccountId, amount: "1000.10" },
        { accountType: "ledger", accountId: ctx.salesAccountId, amount: "312.20" },
      ],
    });
    expect(response.status).toBeLessThan(300);
    const voucherId = response.body.voucher?.id ?? response.body.id;
    const voucher = await pool.query<{ total_amount: string }>(`SELECT total_amount FROM vouchers WHERE id = $1`, [
      voucherId,
    ]);
    // 1312.30 / 655.957 = 2.000588…, stored at the column's cents.
    expect(voucher.rows[0].total_amount).toBe("2.00");
  });
});
