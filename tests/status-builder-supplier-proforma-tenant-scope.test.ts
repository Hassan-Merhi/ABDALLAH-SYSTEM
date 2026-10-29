/**
 * Child rows reached by id must belong to the active company.
 *
 *   - Supplier proforma delete removed the proforma's lines before checking
 *     the company, so another company's lines were wiped.
 *
 * The Factory status builder is retired with Factory Mode in ABDALLAH-SYSTEM.
 */
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { pool } from "../server/db";
import { seedTestData, cleanupTestData, closeTestServer, type TestContext } from "./setup";

const TEST_PREFIX = "childscope";

let ctx: TestContext;
let agent: request.SuperAgentTest;
let foreignCompanyId: number;
let supplierId: number;
let proformaId: number;

beforeAll(async () => {
  ctx = await seedTestData(TEST_PREFIX);
  agent = request.agent(ctx.app);
  const login = await agent.post("/api/auth/login").send({
    username: `${TEST_PREFIX}_testuser`,
    password: "testpassword123",
  });
  if (login.status !== 200) throw new Error(`Login failed: ${login.status}`);
  await agent.post("/api/auth/set-company").send({ companyId: ctx.companyId });

  const company = await pool.query<{ id: number }>(
    `INSERT INTO companies (code, name, company_type, base_currency) VALUES ($1, $2, 'erp', 'USD') RETURNING id`,
    [`${TEST_PREFIX.toUpperCase()}F`, `${TEST_PREFIX}_Foreign`]
  );
  foreignCompanyId = company.rows[0].id;
  const supplier = await pool.query<{ id: number }>(
    `INSERT INTO suppliers (company_id, code, legal_name, email, active) VALUES ($1, $2, $3, $4, true) RETURNING id`,
    [foreignCompanyId, `${TEST_PREFIX.toUpperCase()}S`, `${TEST_PREFIX} supplier`, `${TEST_PREFIX}@example.test`]
  );
  supplierId = supplier.rows[0].id;
  const proforma = await pool.query<{ id: number }>(
    `INSERT INTO supplier_proformas (company_id, supplier_id, reference) VALUES ($1, $2, 'FOREIGN-PF') RETURNING id`,
    [foreignCompanyId, supplierId]
  );
  proformaId = proforma.rows[0].id;
  await pool.query(
    `INSERT INTO supplier_proforma_lines (proforma_id, barcode, item_name, qty) VALUES ($1, 'B1', 'Item', 3)`,
    [proformaId]
  );
}, 120000);

afterAll(async () => {
  await pool.query(`DELETE FROM supplier_proforma_lines WHERE proforma_id = $1`, [proformaId]);
  await pool.query(`DELETE FROM supplier_proformas WHERE id = $1`, [proformaId]);
  await pool.query(`DELETE FROM suppliers WHERE id = $1`, [supplierId]);
  await pool.query(`DELETE FROM companies WHERE id = $1`, [foreignCompanyId]);
  await cleanupTestData(TEST_PREFIX);
  closeTestServer();
}, 60000);

describe("supplier proforma delete tenant scope", () => {
  it("leaves another company's proforma lines in place", async () => {
    const response = await agent.delete(`/api/suppliers/${supplierId}/proformas/${proformaId}`);
    expect(response.status).toBe(404);
    const lines = await pool.query(`SELECT 1 FROM supplier_proforma_lines WHERE proforma_id = $1`, [proformaId]);
    expect(lines.rowCount).toBe(1);
  });
});
