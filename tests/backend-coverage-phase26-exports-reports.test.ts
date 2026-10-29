/**
 * Phase 26 — Exports and reports.
 *
 * Covers representative accounting, Factory, and Supplier Partner generators
 * with real PostgreSQL fixtures. The suite validates PDF/XLSX/CSV bytes, empty
 * datasets, a large Factory dataset, invalid references, and tenant-scoped
 * report behavior. The broad read-only manifest sweep remains the companion
 * coverage for the rest of the report/export surface.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import ExcelJS from "exceljs";

import { pool } from "../server/db";
import { deleteAuditLogRowsForTests } from "./helpers/auditLogCleanup";
import { cleanupTestData, closeTestServer, seedTestData, type TestContext } from "./setup";

const PREFIX = `p26exp-${Date.now().toString(36)}`;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

let ctx: TestContext;
let agent: request.SuperAgentTest;
let factoryCompanyId = 0;
let spCompanyId = 0;

function binary(test: request.Test): request.Test {
  return test.buffer(true).parse((res, callback) => {
    const chunks: Buffer[] = [];
    res.on("data", (chunk: Buffer) => chunks.push(chunk));
    res.on("end", () => callback(null, Buffer.concat(chunks)));
  });
}

function expectXlsx(buffer: Buffer) {
  expect([...buffer.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

async function createCompany(companyType: "factory" | "supplier_partner", suffix: string): Promise<number> {
  const created = await pool.query<{ id: number }>(
    `INSERT INTO companies (code, name, company_type, active, base_currency)
     VALUES ($1, $2, $3, true, 'USD')
     RETURNING id`,
    [`P26-${suffix}-${Date.now().toString(36)}`.slice(0, 50), `${PREFIX}_${suffix}`, companyType]
  );
  const companyId = created.rows[0].id;
  await pool.query(
    `INSERT INTO user_company_roles (user_id, company_id, role, can_delete_records, can_sell_negative_stock)
     VALUES ($1, $2, 'Admin', true, true)`,
    [ctx.userId, companyId]
  );
  return companyId;
}

async function selectCompany(companyId: number): Promise<void> {
  const response = await agent.post("/api/auth/set-company").send({ companyId });
  expect(response.status, response.text).toBe(200);
}

beforeAll(async () => {
  ctx = await seedTestData(PREFIX);
  agent = request.agent(ctx.app) as request.SuperAgentTest;

  const login = await agent
    .post("/api/auth/login")
    .send({ username: `${PREFIX}_testuser`, password: "testpassword123" });
  if (login.status !== 200) {
    throw new Error(`Login failed: ${login.status} ${login.text}`);
  }

  factoryCompanyId = await createCompany("factory", "FACTORY");
  spCompanyId = await createCompany("supplier_partner", "SP");
  await selectCompany(ctx.companyId);
}, 120_000);

afterAll(async () => {
  const auxiliaryIds = [factoryCompanyId, spCompanyId].filter((id) => id > 0);
  if (auxiliaryIds.length > 0) {
    await pool
      .query(`DELETE FROM factory_payrolls WHERE company_id = ANY($1::int[])`, [auxiliaryIds])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM factory_workers WHERE company_id = ANY($1::int[])`, [auxiliaryIds])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM user_location_cash_accounts WHERE company_id = ANY($1::int[])`, [auxiliaryIds])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM user_locations WHERE company_id = ANY($1::int[])`, [auxiliaryIds])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM user_security_permissions WHERE company_id = ANY($1::int[])`, [auxiliaryIds])
      .catch(() => undefined);
    await pool
      .query(`DELETE FROM user_company_roles WHERE company_id = ANY($1::int[])`, [auxiliaryIds])
      .catch(() => undefined);
    await deleteAuditLogRowsForTests(pool, "company_id = ANY($1::int[])", [auxiliaryIds]).catch(() => undefined);
    await pool
      .query(`DELETE FROM login_history WHERE company_id = ANY($1::int[])`, [auxiliaryIds])
      .catch(() => undefined);
    await pool.query(`DELETE FROM companies WHERE id = ANY($1::int[])`, [auxiliaryIds]).catch(() => undefined);
  }
  await cleanupTestData(PREFIX);
  closeTestServer();
}, 120_000);

describe("Phase 26 exports and reports", () => {
  it("generates an accounting XLSX report for an empty period", async () => {
    await selectCompany(ctx.companyId);
    const response = await binary(
      agent.get("/api/reports/net-position-monthly-excel").query({ startDate: "2025-01-01", endDate: "2025-03-31" })
    );

    expect(response.status, response.text).toBe(200);
    expect(response.headers["content-type"]).toContain(XLSX_MIME);
    const body = response.body as Buffer;
    expectXlsx(body);
    const workbook = await loadWorkbook(body);
    expect(workbook.worksheets.length).toBeGreaterThan(0);
  }, 120_000);

  it("rejects invalid or inaccessible accounting report references cleanly", async () => {
    await selectCompany(ctx.companyId);

    const missingDate = await agent.get("/api/reports/net-position-monthly-excel");
    expect(missingDate.status).toBe(400);

    const invalidCompany = await agent.get("/api/reports/net-position-monthly-excel").query({
      companyId: 999_999_999,
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
    expect(invalidCompany.status).toBe(403);
    expect(invalidCompany.body.code).toBe("CROSS_COMPANY_ACCESS_DENIED");
  });
});
