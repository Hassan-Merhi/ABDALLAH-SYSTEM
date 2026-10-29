/**
 * Wave 18 (C) — accounts list, statements, imports and aging.
 *
 *   1. /api/accounts/all is the balance engine's: a line naming a ledger and a
 *      bank counts once (the ledger's), another company's voucher naming the
 *      bank is not counted, a sideless liability opening is Cr, an employee's
 *      sideless opening Cr, and a start date carries the engine's opening;
 *   2. the statement Excel opens bank and employee at the engine's period
 *      opening (it opened them at zero) and lists only the lines the engine
 *      counts; the PDF refuses another company's account (404);
 *   3. (retired) the Factory bale and raw-stock spreadsheet imports are
 *      retired with Factory Mode in ABDALLAH-SYSTEM;
 *   4. aging includes factory suppliers, ages USD base amounts and counts days
 *      from the company's business date.
 */
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pool } from "../server/db";
import { getCompanyBusinessDate } from "../server/lib/dateUtils";
import { ensureFactoryCostBasisSchema } from "../server/services/factory/factoryCostBasisSchema";
import { serveAccountListForCompany } from "../server/routes/accounts/all";
import { deleteAuditLogRowsForTests } from "./helpers/auditLogCleanup";
import { normalizedLineFields } from "./helpers/normalizedVoucherLine";
import { withFixtureTransaction } from "./helpers/voucherFixtureTransaction";
import { cleanupTestData, closeTestServer, seedTestData, type TestContext } from "./setup";

const PREFIX = "w18c";
const TIMEZONE = "Pacific/Kiritimati";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
const now = new Date();
const daysAgo = (days: number) =>
  iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days)));

let ctx: TestContext;
let agent: request.SuperAgentTest;
let companyB: number;
const ids: Record<string, number> = {};
let sequence = 0;

async function insertId(text: string, params: unknown[]): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(text, params);
  return rows[0].id;
}

interface Line {
  ledger?: number;
  bank?: number;
  employee?: number;
  factorySupplier?: number;
  debit?: string;
  credit?: string;
  baseDebit?: string;
  baseCredit?: string;
}

async function voucher(date: string, lines: Line[], opts: { legacy?: boolean; companyId?: number } = {}) {
  sequence += 1;
  return withFixtureTransaction(
    async (client) => {
      const created = await client.query<{ id: number }>(
        `INSERT INTO vouchers (company_id, voucher_number, voucher_type, voucher_date, total_amount, currency, optional)
         VALUES ($1, $2, 'Journal', $3, 0, 'USD', false) RETURNING id`,
        [opts.companyId ?? ctx.companyId, `${PREFIX.toUpperCase()}-${sequence}`, date]
      );
      for (const line of lines) {
        // A line with a base amount is a EUR line normalized at the rate that
        // gives that base (its debit/credit columns hold the native amount, as
        // a legacy factory line does).
        const base = line.baseDebit ?? line.baseCredit;
        const native = line.baseDebit
          ? normalizedLineFields(line.baseDebit, line.debit ?? "0", "debit")
          : line.baseCredit
            ? normalizedLineFields(line.baseCredit, line.credit ?? "0", "credit")
            : null;
        await client.query(
          `INSERT INTO voucher_entries (voucher_id, ledger_account_id, bank_account_id, employee_id,
                                        factory_supplier_id, debit_amount, credit_amount,
                                        transaction_currency, transaction_debit_amount, transaction_credit_amount,
                                        base_debit_amount, base_credit_amount, historical_exchange_rate,
                                        rate_convention)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            created.rows[0].id,
            line.ledger ?? null,
            line.bank ?? null,
            line.employee ?? null,
            line.factorySupplier ?? null,
            line.debit ?? "0",
            line.credit ?? "0",
            base && native ? "EUR" : null,
            native?.transactionDebit ?? null,
            native?.transactionCredit ?? null,
            native?.baseDebit ?? null,
            native?.baseCredit ?? null,
            native?.rate ?? null,
            native?.convention ?? null,
          ]
        );
      }
      return created.rows[0].id;
    },
    { legacyUnbalanced: opts.legacy }
  );
}

async function accountList(query: Record<string, string> = {}) {
  let body: { accounts: Array<Record<string, unknown>> } = { accounts: [] };
  const res = {
    status: () => res,
    json: (value: typeof body) => {
      body = value;
      return res;
    },
  };
  await serveAccountListForCompany({ query, headers: {} } as never, res as never, ctx.companyId);
  return body.accounts;
}

function binaryParser(res: NodeJS.ReadableStream, callback: (error: Error | null, body: Buffer) => void) {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => callback(null, Buffer.concat(chunks)));
}

/** The statement worksheet's rows as [particulars, balance cell] pairs below the header. */
async function excelRows(query: string) {
  const response = await agent
    .get(`/api/accounts/statement/export-excel?${query}`)
    .buffer(true)
    .parse(binaryParser as never);
  expect(response.status).toBe(200);
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(response.body as Buffer);
  const sheet = workbook.getWorksheet("Statement")!;
  const rows: Array<{ particulars: string; balance: number | null; numFmt: string }> = [];
  let afterHeader = false;
  sheet.eachRow((row) => {
    if (row.getCell(1).value === "Date") {
      afterHeader = true;
      return;
    }
    if (!afterHeader) return;
    const balance = row.getCell(6).value;
    rows.push({
      particulars: String(row.getCell(3).value ?? ""),
      balance: typeof balance === "number" ? balance : null,
      numFmt: String(row.getCell(6).numFmt ?? ""),
    });
  });
  return rows.filter(
    (row) => row.particulars !== "TOTAL" && row.particulars !== "Closing Balance" && row.balance !== null
  );
}

beforeAll(async () => {
  ctx = await seedTestData(PREFIX);
  await ensureFactoryCostBasisSchema(pool);
  agent = request.agent(ctx.app);
  expect(
    (await agent.post("/api/auth/login").send({ username: `${PREFIX}_testuser`, password: "testpassword123" })).status
  ).toBe(200);
  expect((await agent.post("/api/auth/set-company").send({ companyId: ctx.companyId })).status).toBe(200);
  const cash = ctx.cashAccountId;

  companyB = await insertId(
    `INSERT INTO companies (code, name, company_type, base_currency) VALUES ($1, $2, 'erp', 'USD') RETURNING id`,
    [`${PREFIX.toUpperCase()}B`, `${PREFIX} company B`]
  );

  ids.LIAB = await insertId(
    `INSERT INTO ledger_accounts (company_id, code, name, account_type, opening_balance, opening_balance_side)
     VALUES ($1, $2, $3, 'Liability', 100, NULL) RETURNING id`,
    [ctx.companyId, `${PREFIX}-LIAB-${ctx.companyId}`, `${PREFIX} liability`]
  );
  ids.BANKLEDGER = await insertId(
    `INSERT INTO ledger_accounts (company_id, code, name, account_type, opening_balance, opening_balance_side)
     VALUES ($1, $2, $3, 'Bank', 0, 'Dr') RETURNING id`,
    [ctx.companyId, `${PREFIX}-BL-${ctx.companyId}`, `${PREFIX} bank ledger`]
  );
  ids.BANK = await insertId(
    `INSERT INTO bank_accounts (company_id, code, name, bank_name, account_number, opening_balance, opening_balance_side)
     VALUES ($1, $2, $3, 'Bank', '001', 70, 'Dr') RETURNING id`,
    [ctx.companyId, `${PREFIX}-BANK-${ctx.companyId}`, `${PREFIX} bank`]
  );
  ids.BANK_B = await insertId(
    `INSERT INTO bank_accounts (company_id, code, name, bank_name, account_number, opening_balance, opening_balance_side)
     VALUES ($1, $2, $3, 'Bank', '002', 0, 'Dr') RETURNING id`,
    [companyB, `${PREFIX}-BANKB-${ctx.companyId}`, `${PREFIX} bank B`]
  );
  ids.B_CASH = await insertId(
    `INSERT INTO ledger_accounts (company_id, code, name, account_type, opening_balance, opening_balance_side)
     VALUES ($1, $2, $3, 'Cash', 0, 'Dr') RETURNING id`,
    [companyB, `${PREFIX}-BCASH-${ctx.companyId}`, `${PREFIX} B cash`]
  );
  ids.EMP = await insertId(
    `INSERT INTO employees (company_id, code, first_name, last_name, join_date, opening_balance, opening_balance_side, current_balance)
     VALUES ($1, $2, 'W18', 'Employee', '2026-01-01', 40, NULL, 52) RETURNING id`,
    [ctx.companyId, `${PREFIX}-EMP-${ctx.companyId}`]
  );

  // A legacy line naming the bank ledger and the bank: the ledger's only.
  await voucher(
    daysAgo(10),
    [
      { ledger: ids.BANKLEDGER, bank: ids.BANK, debit: "25.00" },
      { ledger: cash, credit: "25.00" },
    ],
    { legacy: true }
  );
  await voucher(daysAgo(10), [
    { bank: ids.BANK, debit: "5.00" },
    { ledger: cash, credit: "5.00" },
  ]);
  await voucher(daysAgo(1), [
    { bank: ids.BANK, debit: "7.00" },
    { ledger: cash, credit: "7.00" },
  ]);
  // Company B's voucher naming A's bank (legacy): not A's line.
  await voucher(
    daysAgo(2),
    [
      { bank: ids.BANK, debit: "1000.00" },
      { ledger: ids.B_CASH, credit: "1000.00" },
    ],
    { legacy: true, companyId: companyB }
  );
  // Employee: an advance of 10, then 4 owed to them.
  await voucher(daysAgo(10), [
    { employee: ids.EMP, debit: "10.00" },
    { ledger: cash, credit: "10.00" },
  ]);
  await voucher(daysAgo(1), [
    { ledger: cash, debit: "4.00" },
    { employee: ids.EMP, credit: "4.00" },
  ]);

  // Aging: a factory supplier credited 110 in the line currency, 100 USD base.
  ids.EXP = await insertId(
    `INSERT INTO ledger_accounts (company_id, code, name, account_type, opening_balance, opening_balance_side)
     VALUES ($1, $2, $3, 'Expense', 0, 'Dr') RETURNING id`,
    [ctx.companyId, `${PREFIX}-EXP-${ctx.companyId}`, `${PREFIX} expense`]
  );
  ids.FS = await insertId(`INSERT INTO factory_suppliers (company_id, name) VALUES ($1, $2) RETURNING id`, [
    ctx.companyId,
    `${PREFIX} factory supplier`,
  ]);
  await voucher(daysAgo(40), [
    { ledger: ids.EXP, debit: "110.00", baseDebit: "100.00" },
    { factorySupplier: ids.FS, credit: "110.00", baseCredit: "100.00" },
  ]);
  await pool.query(
    `INSERT INTO company_settings (company_id, timezone) VALUES ($1, $2)
     ON CONFLICT (company_id) DO UPDATE SET timezone = EXCLUDED.timezone`,
    [ctx.companyId, TIMEZONE]
  );
}, 120_000);

afterAll(async () => {
  const id = ctx.companyId;
  await pool.query(`DELETE FROM gl_inventory_cutovers WHERE company_id = $1`, [id]);
  for (const table of ["factory_bales", "factory_bale_import_batches", "factory_bale_sequences", "factory_raw_stock"]) {
    await pool.query(`DELETE FROM ${table} WHERE company_id = $1`, [id]);
  }
  await pool.query(`DELETE FROM factory_containers WHERE company_id = $1`, [id]);
  await pool.query(`DELETE FROM factory_bale_products WHERE company_id = $1`, [id]);
  await withFixtureTransaction(async (client) => {
    await client.query(
      `DELETE FROM voucher_entries WHERE voucher_id IN (SELECT id FROM vouchers WHERE company_id = $1)`,
      [companyB]
    );
    await client.query(`DELETE FROM vouchers WHERE company_id = $1`, [companyB]);
    // Vouchers with lines on the company's factory suppliers go, whole, before
    // the suppliers (a partial line delete would leave them unbalanced).
    const { rows: supplierVouchers } = await client.query<{ voucher_id: number }>(
      `SELECT DISTINCT voucher_id FROM voucher_entries
        WHERE factory_supplier_id IN (SELECT id FROM factory_suppliers WHERE company_id = $1)`,
      [id]
    );
    const voucherIds = supplierVouchers.map((row) => row.voucher_id);
    await client.query(`DELETE FROM voucher_entries WHERE voucher_id = ANY($1::int[])`, [voucherIds]);
    await client.query(`DELETE FROM vouchers WHERE id = ANY($1::int[])`, [voucherIds]);
  });
  await pool.query(`DELETE FROM factory_suppliers WHERE company_id = $1`, [id]);
  for (const table of ["bank_accounts", "ledger_accounts"]) {
    await pool.query(`DELETE FROM ${table} WHERE company_id = $1`, [companyB]);
  }
  await deleteAuditLogRowsForTests(pool, "company_id = $1", [id]);
  await cleanupTestData(PREFIX);
  closeTestServer();
}, 120_000);

describe("1: /api/accounts/all on the balance engine", () => {
  it("counts each line once, by the voucher's company, with the engine's opening sides", async () => {
    const accounts = await accountList();
    const byId = (type: string, id: number) => accounts.find((a) => a.type === type && a.accountId === id);
    // A sideless liability opening is Cr (it was Dr).
    expect(byId("ledger", ids.LIAB)).toMatchObject({
      balance: "100.00",
      balanceSide: "Cr",
      openingBalance: 100,
      openingBalanceSide: "Cr",
    });
    // 70 + 5 + 7: the line also naming the bank ledger and company B's line are not the bank's.
    expect(byId("bank", ids.BANK)).toMatchObject({ balance: "82.00", balanceSide: "Dr" });
    expect(byId("ledger", ids.BANKLEDGER)).toMatchObject({ balance: "25.00", balanceSide: "Dr" });
    // Employee, Cr positive. Without a date range the all-time overview shows the payroll
    // current balance (52), as Payroll does (#2178); the engine's opening side still applies.
    // A dated range keeps the engine figure (see the next test).
    expect(byId("employee", ids.EMP)).toMatchObject({ balance: "52.00", balanceSide: "Cr", openingBalanceSide: "Cr" });
  });

  it("carries the engine's opening into a period", async () => {
    const accounts = await accountList({ startDate: daysAgo(5) });
    const byId = (type: string, id: number) => accounts.find((a) => a.type === type && a.accountId === id);
    expect(byId("bank", ids.BANK)).toMatchObject({ openingBalance: 75, openingBalanceSide: "Dr", balance: "82.00" });
    // A dated range reads the engine, not the payroll balance: 40 (sideless Cr) − 10 + 4.
    expect(byId("employee", ids.EMP)).toMatchObject({
      openingBalance: 30,
      openingBalanceSide: "Cr",
      balance: "34.00",
      balanceSide: "Cr",
    });
  });
});

describe("2: statement exports open at the engine's period opening", () => {
  it("bank Excel carries the opening forward and lists only the bank's lines", async () => {
    const full = await excelRows(`accountType=bank&accountId=${ids.BANK}`);
    expect(full.map((row) => row.particulars)).toEqual(["Opening Balance", "Journal", "Journal"]);
    expect(full.map((row) => row.balance)).toEqual([70, 75, 82]);

    const period = await excelRows(`accountType=bank&accountId=${ids.BANK}&startDate=${daysAgo(5)}`);
    expect(period[0]).toMatchObject({ particulars: "Balance Brought Forward", balance: 75 });
    expect(period.at(-1)?.balance).toBe(82);
  });

  it("employee Excel opens at the engine's opening with its side (Cr)", async () => {
    const period = await excelRows(`accountType=employee&accountId=${ids.EMP}&startDate=${daysAgo(5)}`);
    expect(period[0]).toMatchObject({ particulars: "Balance Brought Forward", balance: 30 });
    expect(period[0].numFmt).toContain('"Cr"');
    expect(period.at(-1)).toMatchObject({ balance: 34 });
    expect(period.at(-1)?.numFmt).toContain('"Cr"');
  });

  it("the PDF refuses another company's account", async () => {
    expect((await agent.get(`/api/accounts/bank/${ids.BANK_B}/statement-pdf`)).status).toBe(404);
    const own = await agent
      .get(`/api/accounts/bank/${ids.BANK}/statement-pdf`)
      .buffer(true)
      .parse(binaryParser as never);
    expect(own.status).toBe(200);
  }, 30_000);
});

describe("4: aging", () => {
  it("ages factory suppliers in USD base amounts from the company's business date", async () => {
    const response = await agent.get("/api/reports/aging?kind=factorySupplier");
    expect(response.status).toBe(200);
    expect(response.body.referenceDate).toBe(getCompanyBusinessDate(TIMEZONE));
    expect(response.body.amountBasis).toBe("historicalBase");
    const row = response.body.parties.find((party: { id: number }) => party.id === ids.FS);
    expect(row.balance).toBe("100.00");
    expect(row.buckets).toMatchObject({ days31to60: "100.00", current: "0.00", opening: "0.00" });
    expect((await agent.get("/api/reports/aging?kind=other")).status).toBe(400);
  });
});
