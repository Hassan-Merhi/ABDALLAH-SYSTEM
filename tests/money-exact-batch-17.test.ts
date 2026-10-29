/**
 * Factory employee bulk withdrawal credited cash with the float total of every
 * requested amount, rounded once, and debited each employee with that amount
 * rounded on its own. Two withdrawals of 1.005 credited 2.01 but debited 1.00
 * twice, and an employee outside the company was skipped while its amount
 * stayed in the cash credit: the voucher did not balance. Amounts are now
 * taken at cents and only the company's employees count toward the credit.
 */
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { pool } from "../server/db";
import { seedTestData, cleanupTestData, closeTestServer, type TestContext } from "./setup";
import { buildAllocationsForPayment } from "../server/services/rental/rentalPaymentAllocationService";

const TEST_PREFIX = "mexact17";

let ctx: TestContext;
let agent: request.SuperAgentTest;
let employeeIds: number[];
let foreignCompanyId: number;
let foreignEmployeeId: number;

async function insertEmployee(companyId: number, code: string): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO employees (company_id, code, first_name, last_name, join_date, current_balance, total_withdrawals)
     VALUES ($1, $2, 'Test', $3, '2026-01-01', '10.00', '0') RETURNING id`,
    [companyId, code, code]
  );
  return result.rows[0].id;
}

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

  employeeIds = [await insertEmployee(ctx.companyId, "MX17-A"), await insertEmployee(ctx.companyId, "MX17-B")];
  const company = await pool.query<{ id: number }>(
    `INSERT INTO companies (code, name, base_currency) VALUES ($1, $2, 'USD') RETURNING id`,
    [`${TEST_PREFIX.toUpperCase()}F`, `${TEST_PREFIX}_Foreign`]
  );
  foreignCompanyId = company.rows[0].id;
  foreignEmployeeId = await insertEmployee(foreignCompanyId, "MX17-F");
}, 120000);

afterAll(async () => {
  // The bulk withdrawal is one engine voucher (phase 22): remove all of its
  // lines together, never only the employee legs (the balance guards refuse a
  // voucher left one-sided).
  await pool.query(
    `DELETE FROM voucher_entries WHERE voucher_id IN (
       SELECT voucher_id FROM voucher_entries WHERE employee_id = ANY($1)
     )`,
    [[...employeeIds, foreignEmployeeId]]
  );
  await pool.query(`DELETE FROM employees WHERE id = ANY($1)`, [[...employeeIds, foreignEmployeeId]]);
  await pool.query(`DELETE FROM companies WHERE id = $1`, [foreignCompanyId]);
  await cleanupTestData(TEST_PREFIX);
  closeTestServer();
}, 60000);

describe("rental payment allocation for posting", () => {
  it("splits a prepaid payment into monthly chunks that add back up to it", async () => {
    // No ledger rows or posted payments: each future month takes the full rent.
    const allocations = await buildAllocationsForPayment(-1, 2099, 1, "250.05", "100.00", 1, "2026-10-01");
    expect(allocations.map((allocation) => [allocation.year, allocation.month, allocation.chunk])).toEqual([
      [2099, 1, "100.00"],
      [2099, 2, "100.00"],
      [2099, 3, "50.05"],
    ]);
  });
});
