/**
 * Shared fixture for the accounting audit wave 11 factory bale cost-basis
 * suites (tests/wave11-factory-cost-basis.test.ts and
 * tests/wave11-factory-cost-basis-recost.test.ts).
 *
 * Each suite seeds its own factory company (code W11FCB) through
 * setupWave11FactoryCostBasisFixture() and drives the registered factory routes
 * through call(). Backend suites run serially, so the shared prefix is safe;
 * a run that failed half-way is cleaned up by the next one. The suites must
 * mock ../server/auth (requireAuth/requireNonPOS pass-through) before this
 * module's route imports load.
 */
import bcrypt from "bcryptjs";
import { afterAll, beforeAll } from "vitest";

import { pool } from "../../server/db";
import { deleteAuditLogRowsForTests } from "./auditLogCleanup";
import { ensureFactoryCostBasisSchema } from "../../server/services/factory/factoryCostBasisSchema";
import { registerFactoryMixBatchCreateRoutes } from "../../server/routes/factory/mix-batches/create";
import { registerBalesFinalizeRoutes } from "../../server/routes/factory/bales/balesFinalizeRoutes";
import { registerBaleRecostRoutes } from "../../server/routes/factory/bales/baleRecostRoutes";
import { registerFactoryStockEntryRoutes } from "../../server/routes/factory/stock/stockEntryRoutes";
import { registerPosSaleWriteRoutes } from "../../server/routes/factory/employee-pos/pos-financial/sale-write";
import { registerPosSaleDeleteRoutes } from "../../server/routes/factory/employee-pos/pos-financial/sale-delete";
import { registerFactoryStockRemovalRoutes } from "../../server/routes/factory/stock/stockRemovalRoutes";
import { registerEmployeeNetPositionRoutes } from "../../server/routes/factory/employee-pos/employeeNetPositionRoutes";

export const PREFIX = "w11fcb";
export const today = new Date().toISOString().slice(0, 10);

type Handler = (req: unknown, res: unknown, next?: () => unknown) => Promise<unknown> | unknown;
const routes = new Map<string, Handler[]>();
const fakeApp = new Proxy(
  {},
  {
    get:
      (_target, method: string) =>
      (path: unknown, ...handlers: Handler[]) => {
        if (typeof path === "string") routes.set(`${method.toUpperCase()} ${path}`, handlers);
      },
  }
) as never;

export let companyId: number;
export let locationId: number;
export let productId: number;
export let audContainer: number;
export let audNoRateContainer: number;
export let usdContainer: number;
export let customerId: number;
export let supervisorId: string;

export async function call(route: string, req: Record<string, any>) {
  const handlers = routes.get(route);
  if (!handlers) throw new Error(`route not registered: ${route}`);
  const [method, path] = route.split(" ");
  let statusCode = 200;
  let body: any;
  const res: Record<string, any> = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(value: unknown) {
      body = value;
      return res;
    },
    set: () => res,
    setHeader: () => res,
  };
  const headers: Record<string, string> = { "x-client-date": today, ...(req.headers ?? {}) };
  const request = {
    method,
    path,
    params: {},
    query: {},
    body: {},
    get: (name: string) => headers[name.toLowerCase()],
    header: (name: string) => headers[name.toLowerCase()],
    ...req,
    headers,
    session: {
      factoryCompanyId: companyId,
      currentCompanyId: companyId,
      userId: "1",
      username: "owner",
      ...req.session,
    },
  };
  // Middleware (requireRole) then the handler.
  for (const [index, handler] of handlers.entries()) {
    let next = false;
    await handler(request, res, () => {
      next = true;
    });
    if (index < handlers.length - 1 && !next) break;
  }
  return { statusCode, body };
}

export const one = async <T = any>(text: string, values: unknown[] = []) =>
  (await pool.query(text, values)).rows[0] as T;
export const all = async <T = any>(text: string, values: unknown[] = []) =>
  (await pool.query(text, values)).rows as T[];

export async function setCutover(active: boolean) {
  await pool.query(`DELETE FROM gl_inventory_cutovers WHERE company_id = $1`, [companyId]);
  if (active) {
    await pool.query(
      `INSERT INTO gl_inventory_cutovers (company_id, effective_from, opening_plan, applied_by)
       VALUES ($1, $2, '{}'::jsonb, 'test')`,
      [companyId, today]
    );
  }
}

let baleSeq = 0;
export async function bale(values: {
  status: string;
  weight: string;
  costPerKg: string;
  totalCost: string;
  mixBatchId?: number | null;
  product?: boolean;
}) {
  baleSeq += 1;
  return (
    await one<{ id: number }>(
      `INSERT INTO factory_bales (company_id, bale_code, reference_number, weight_kg, cost_per_kg, total_cost, status,
                                  mix_batch_id, product_id, erp_location_id, article_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [
        companyId,
        `${PREFIX}-B`,
        `${PREFIX}-R${baleSeq}`,
        values.weight,
        values.costPerKg,
        values.totalCost,
        values.status,
        values.mixBatchId ?? null,
        values.product === false ? null : productId,
        locationId,
        `${PREFIX}ART`,
      ]
    )
  ).id;
}

export const baleCost = async (id: number) =>
  one<{ cost_per_kg: string; total_cost: string; status: string }>(
    `SELECT cost_per_kg::text, total_cost::text, status FROM factory_bales WHERE id = $1`,
    [id]
  );

/**
 * Registers the suite-level fixture hooks: seeds the factory company, its
 * location, customer, product, AUD/USD containers and Owner supervisor before
 * the suite, and removes everything the suite wrote after it.
 */
export function setupWave11FactoryCostBasisFixture(): void {
  beforeAll(async () => {
    await ensureFactoryCostBasisSchema(pool);
    // A run that failed half-way leaves its company behind.
    for (const leftover of await all<{ id: number }>(`SELECT id FROM companies WHERE code = $1`, [
      PREFIX.toUpperCase(),
    ])) {
      await cleanup(leftover.id);
    }
    for (const register of [
      registerFactoryMixBatchCreateRoutes,
      registerBalesFinalizeRoutes,
      registerBaleRecostRoutes,
      registerFactoryStockEntryRoutes,
      registerPosSaleWriteRoutes,
      registerPosSaleDeleteRoutes,
      registerFactoryStockRemovalRoutes,
      registerEmployeeNetPositionRoutes,
    ]) {
      register(fakeApp);
    }

    companyId = (
      await one(
        `INSERT INTO companies (code, name, company_type) VALUES ($1::varchar, $1::text, 'factory') RETURNING id`,
        [PREFIX.toUpperCase()]
      )
    ).id;
    locationId = (
      await one(`INSERT INTO locations (company_id, code, name) VALUES ($1, $2::varchar, $2::text) RETURNING id`, [
        companyId,
        `${PREFIX}-LOC`,
      ])
    ).id;
    customerId = (
      await one(
        `INSERT INTO customers (company_id, code, legal_name) VALUES ($1, $2::varchar, $2::text) RETURNING id`,
        [companyId, `${PREFIX}-CUST`]
      )
    ).id;
    productId = (
      await one(
        `INSERT INTO factory_bale_products (company_id, code, name, article_code, production_price, selling_price)
         VALUES ($1, $2::varchar, $2::text, $3, '40.00', '60.00') RETURNING id`,
        [companyId, `${PREFIX}P`.toUpperCase(), `${PREFIX}ART`]
      )
    ).id;
    // A supplier with no locked rate yet: its containers' sources are priced at
    // the container's landed USD cost.
    const supplierId = (
      await one(`INSERT INTO factory_suppliers (company_id, name) VALUES ($1, $2) RETURNING id`, [
        companyId,
        `${PREFIX} supplier`,
      ])
    ).id;
    const container = async (number: string, currency: string, fx: string) =>
      (
        await one(
          `INSERT INTO factory_containers (company_id, container_number, currency_code, fx_rate_to_usd, supplier_id)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [companyId, `${PREFIX}-${number}`, currency, fx, supplierId]
        )
      ).id;
    audContainer = await container("AUD", "AUD", "0.65");
    audNoRateContainer = await container("AUD-NR", "AUD", "1");
    usdContainer = await container("USD", "USD", "1");
    supervisorId = (
      await one(`INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id`, [
        `${PREFIX}_supervisor`,
        await bcrypt.hash("supervisor-pass", 4),
      ])
    ).id;
    await pool.query(`INSERT INTO user_company_roles (user_id, company_id, role) VALUES ($1, $2, 'Owner')`, [
      supervisorId,
      companyId,
    ]);
    await pool.query(
      `INSERT INTO factory_raw_stock (company_id, container_id, received_kg, used_kg, cost_per_kg, cost_per_kg_usd)
       VALUES ($1, $2, 1000, 0, 2.0, 1.3), ($1, $3, 1000, 0, 2.0, NULL), ($1, $4, 1000, 900, 1.0, 1.0)`,
      [companyId, audContainer, audNoRateContainer, usdContainer]
    );
  }, 60000);

  afterAll(async () => {
    await cleanup(companyId, supervisorId);
  }, 60000);
}

async function cleanup(companyId: number, supervisorId?: string) {
  // audit_log is append-only (wave 12): its rows go through the test-only helper.
  await deleteAuditLogRowsForTests(pool, "company_id = $1", [companyId]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.company_scope_maintenance', 'on', true)");
    await client.query("SET LOCAL app.ledger_integrity_bypass = 'on'");
    const q = (text: string) => client.query(text, [companyId]);
    await q(`DELETE FROM gl_inventory_cutovers WHERE company_id = $1`);
    await q(`DELETE FROM accounting_posting_requests WHERE company_id = $1`);
    await q(`DELETE FROM voucher_entries WHERE voucher_id IN (SELECT id FROM vouchers WHERE company_id = $1)`);
    await q(`DELETE FROM vouchers WHERE company_id = $1`);
    await q(`DELETE FROM factory_pos_sale_bales WHERE company_id = $1`);
    await q(`DELETE FROM factory_pos_sale_items WHERE company_id = $1`);
    await q(`DELETE FROM factory_pos_sales WHERE company_id = $1`);
    await q(
      `DELETE FROM customer_order_bales WHERE order_id IN (SELECT id FROM customer_orders WHERE company_id = $1)`
    );
    await q(`DELETE FROM customer_orders WHERE company_id = $1`);
    for (const table of [
      "canonical_stock_movement_audit",
      "canonical_stock_movement_requests",
      "canonical_stock_movements",
      "factory_stock_value_events",
      "factory_bale_recost_runs",
      "factory_bale_production_attributions",
      "factory_daybook_entries",
    ]) {
      await q(`DELETE FROM ${table} WHERE company_id = $1`);
    }
    await q(`DELETE FROM user_company_roles WHERE company_id = $1`);
    await q(`DELETE FROM factory_bales WHERE company_id = $1`);
    await q(`DELETE FROM factory_pressing_batches WHERE company_id = $1`);
    await q(
      `DELETE FROM factory_mix_batch_sources WHERE mix_batch_id IN (SELECT id FROM factory_mix_batches WHERE company_id = $1)`
    );
    await q(`DELETE FROM factory_mix_batches WHERE company_id = $1`);
    await q(`DELETE FROM factory_raw_stock WHERE company_id = $1`);
    await q(`DELETE FROM factory_containers WHERE company_id = $1`);
    await q(`DELETE FROM factory_suppliers WHERE company_id = $1`);
    await q(`DELETE FROM factory_fx_rates WHERE company_id = $1`);
    await q(`DELETE FROM financial_operation_requests WHERE company_id = $1`);
    await q(`DELETE FROM factory_bale_sequences WHERE company_id = $1`);
    await q(`DELETE FROM factory_bale_products WHERE company_id = $1`);
    await q(
      `DELETE FROM inventory_negative_layers WHERE location_id IN (SELECT id FROM locations WHERE company_id = $1)`
    ).catch(() => undefined);
    await q(`DELETE FROM inventory WHERE company_id = $1`);
    await q(`DELETE FROM stock_items WHERE company_id = $1`);
    await q(`DELETE FROM stock_groups WHERE company_id = $1`);
    await q(`DELETE FROM customer_balances WHERE company_id = $1`);
    await q(`UPDATE customers SET ledger_account_id = NULL WHERE company_id = $1`);
    await q(`DELETE FROM customers WHERE company_id = $1`);
    await q(`DELETE FROM ledger_accounts WHERE company_id = $1`);
    await q(`DELETE FROM locations WHERE company_id = $1`);
    await q(`DELETE FROM companies WHERE id = $1`);
    await client.query(`DELETE FROM users WHERE id = $1 OR username = $2`, [
      supervisorId ?? "",
      `${PREFIX}_supervisor`,
    ]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
