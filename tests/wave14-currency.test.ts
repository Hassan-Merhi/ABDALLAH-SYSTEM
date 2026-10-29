/**
 * Accounting audit wave 14 (A): currency, against the database.
 *
 *   - Decision 4: the voucher-entry currency normalization trigger
 *     (migrations/20260720_005) is installed by an idempotent, versioned,
 *     fatal boot installer with the migration's exact definition, and the
 *     integrity diagnostic lists it among the database guards.
 *   - Decision 2: saving, changing or deleting an exchange rate is Admin/Owner
 *     (Developer) only and audited with the old and new value.
 *
 * Decision 1 (the wave 6 legacy repair at a dated factory rate) and the
 * factory rate routes are retired with Factory Mode in ABDALLAH-SYSTEM.
 */
import fs from "node:fs";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { pool } from "../server/db";
import {
  CURRENCY_NORMALIZATION_FUNCTION_DDL,
  CURRENCY_NORMALIZATION_GUARD_VERSION,
  CURRENCY_NORMALIZATION_MIGRATION,
  CURRENCY_NORMALIZATION_TRIGGER,
  CURRENCY_NORMALIZATION_TRIGGER_DDL,
  ensureCurrencyNormalizationGuard,
  installedCurrencyNormalizationVersion,
} from "../server/services/accounting/currencyNormalizationGuard";
import { runAccountingIntegrityDiagnostic } from "../server/services/accounting/integrity/accountingIntegrityDiagnostic";
import { deleteAuditLogRowsForTests } from "./helpers/auditLogCleanup";
import { withFixtureTransaction } from "./helpers/voucherFixtureTransaction";
import { cleanupTestData, closeTestServer, seedTestData, type TestContext } from "./setup";

const PREFIX = "wave14cur";
let ctx: TestContext;
let agent: request.SuperAgentTest;

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

async function setRole(role: string) {
  await pool.query(`UPDATE user_company_roles SET role = $1 WHERE user_id = $2 AND company_id = $3`, [
    role,
    ctx.userId,
    ctx.companyId,
  ]);
  expect((await agent.post("/api/auth/set-company").send({ companyId: ctx.companyId })).status).toBe(200);
}

async function auditRows(tableName: string) {
  return (
    await pool.query(
      `SELECT action, record_identifier, changes FROM audit_log WHERE company_id = $1 AND table_name = $2 ORDER BY id`,
      [ctx.companyId, tableName]
    )
  ).rows;
}

beforeAll(async () => {
  ctx = await seedTestData(PREFIX);
  expect(await ensureCurrencyNormalizationGuard(pool)).toBe(true);
  agent = request.agent(ctx.app);
  expect(
    (await agent.post("/api/auth/login").send({ username: `${PREFIX}_testuser`, password: "testpassword123" })).status
  ).toBe(200);
  expect((await agent.post("/api/auth/set-company").send({ companyId: ctx.companyId })).status).toBe(200);
}, 120000);

afterAll(async () => {
  // The trigger stays installed: it is what every boot (CI included) installs.
  await withFixtureTransaction(async (client) => {
    await client.query(`SET LOCAL app.ledger_integrity_bypass = 'on'`);
    await client.query(`DELETE FROM exchange_rates WHERE company_id = $1`, [ctx.companyId]);
    await client.query(`DELETE FROM factory_fx_rates WHERE company_id = $1`, [ctx.companyId]);
    await client.query(
      `DELETE FROM voucher_entries WHERE voucher_id IN (SELECT id FROM vouchers WHERE company_id = $1)`,
      [ctx.companyId]
    );
    await client.query(`DELETE FROM vouchers WHERE company_id = $1`, [ctx.companyId]);
    await client.query(`DELETE FROM factory_suppliers WHERE company_id = $1`, [ctx.companyId]);
  });
  await deleteAuditLogRowsForTests(pool, "company_id = $1", [ctx.companyId]);
  await cleanupTestData(PREFIX);
  await closeTestServer();
}, 120000);

describe("currency normalization installer (decision 4)", () => {
  it("installs the migration's exact definition, idempotently and versioned", async () => {
    // Wave 17 (D): the current definition is v2 (CURRENCY_NORMALIZATION_MIGRATION);
    // v1 stays in migrations/20260720_005.
    const migration = fs.readFileSync(path.join(process.cwd(), CURRENCY_NORMALIZATION_MIGRATION), "utf8");
    expect(squash(migration)).toContain(squash(CURRENCY_NORMALIZATION_FUNCTION_DDL));
    expect(squash(migration)).toContain(`${squash(CURRENCY_NORMALIZATION_TRIGGER_DDL)};`);

    expect(await ensureCurrencyNormalizationGuard(pool)).toBe(true);
    expect(await ensureCurrencyNormalizationGuard(pool)).toBe(true);
    expect(await installedCurrencyNormalizationVersion(pool)).toBe(CURRENCY_NORMALIZATION_GUARD_VERSION);
    const triggers = await pool.query(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'voucher_entries'::regclass AND tgname LIKE 'voucher_entries_normalize_currency%'`
    );
    expect(triggers.rows.map((row) => row.tgname)).toEqual([CURRENCY_NORMALIZATION_TRIGGER]);
  });

  it("is fatal on failure, rolling back and releasing the connection", async () => {
    const release = vi.fn();
    const query = vi.fn(async (text: string) => {
      if (text.includes("information_schema.columns")) {
        return {
          rows: [
            ...["id", "currency", "exchange_rate"].map((c) => ({ name: `vouchers.${c}` })),
            ...[
              "voucher_id",
              "debit_amount",
              "credit_amount",
              "transaction_currency",
              "transaction_debit_amount",
              "transaction_credit_amount",
              "base_debit_amount",
              "base_credit_amount",
              "historical_exchange_rate",
              "rate_convention",
            ].map((c) => ({ name: `voucher_entries.${c}` })),
          ],
        };
      }
      if (/CREATE|DROP|COMMENT/.test(text)) throw new Error("lock timeout");
      return { rows: [] };
    });
    const fakePool = { connect: async () => ({ query, release }) } as never;
    await expect(ensureCurrencyNormalizationGuard(fakePool)).rejects.toThrow(/lock timeout/);
    expect(query).toHaveBeenCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("skips with a warning, without a transaction, when a required column is missing", async () => {
    const release = vi.fn();
    const query = vi.fn(async () => ({ rows: [] }));
    const fakePool = { connect: async () => ({ query, release }) } as never;
    expect(await ensureCurrencyNormalizationGuard(fakePool)).toBe(false);
    expect(query).not.toHaveBeenCalledWith("BEGIN");
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("is listed by the diagnostic's database_guards_installed", async () => {
    const currencyMissing = async () => {
      const report = await runAccountingIntegrityDiagnostic(ctx.companyId);
      const check = report.checks.find((c) => c.key === "database_guards_installed");
      return ((check?.samples ?? []) as Array<{ missing: string }>)
        .map((row) => row.missing)
        .filter((name) => name.includes("normalize"));
    };
    expect(await currencyMissing()).toEqual([]);
    // An out-of-date version is reported (a comment only: the trigger keeps working)
    // and the installer brings it back.
    await pool.query(`COMMENT ON FUNCTION normalize_voucher_entry_currency_amounts() IS 'outdated'`);
    try {
      expect(await currencyMissing()).toEqual([
        `normalize_voucher_entry_currency_amounts ${CURRENCY_NORMALIZATION_GUARD_VERSION}`,
      ]);
    } finally {
      expect(await ensureCurrencyNormalizationGuard(pool)).toBe(true);
    }
    expect(await currencyMissing()).toEqual([]);
  });
});

describe("exchange-rate saves (decision 2)", () => {
  const companyRate = (rate: string) => ({
    fromCurrency: "USD",
    toCurrency: "CFA",
    rate,
    effectiveDate: "2026-10-01",
  });

  it("refuses Manager and POS users, and writes nothing", async () => {
    for (const role of ["Manager", "POS"]) {
      await setRole(role);
      expect((await agent.post("/api/exchange-rates").send(companyRate("600"))).status).toBe(403);
    }
    await setRole("Admin");
    expect((await pool.query(`SELECT 1 FROM exchange_rates WHERE company_id = $1`, [ctx.companyId])).rowCount).toBe(0);
    expect(await auditRows("exchange_rates")).toEqual([]);
  });

  it("saves a company rate for Admin, audited with the old and the new rate", async () => {
    await setRole("Admin");
    expect((await agent.post("/api/exchange-rates").send(companyRate("600"))).status).toBe(200);
    const changed = await agent.post("/api/exchange-rates").send(companyRate("610.5"));
    expect(changed.status).toBe(200);
    expect(
      (await pool.query(`SELECT rate::text FROM exchange_rates WHERE company_id = $1`, [ctx.companyId])).rows
    ).toEqual([{ rate: "610.500000" }]);
    const audit = await auditRows("exchange_rates");
    expect(audit.map((row) => [row.action, row.changes.rate])).toEqual([
      ["create", { old: null, new: "600.000000" }],
      ["update", { old: "600.000000", new: "610.500000" }],
    ]);
  });
});
