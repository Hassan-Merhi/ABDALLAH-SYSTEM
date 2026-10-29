/**
 * Backend coverage — non-Factory validation/failure write paths.
 *
 * Parameterized writes already have broad safety matrices. This closes the
 * complementary ERP parameterless-write gap; ABDALLAH-SYSTEM retires the
 * Supplier Partner and Properties modes, so their routes are not swept.
 * Requests carry an intentionally empty body in an isolated tenant,
 * maintenance/external operations are excluded, and before/after fingerprints
 * prove rejected probes never create financial or operational rows.
 */
import fs from "node:fs";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pool } from "../server/db";
import { isRetiredAbdallahApiRequest } from "../server/middleware/abdallahErpRetiredFeatureBoundary";
import { cleanupTestData, closeTestServer, seedTestData, type TestContext } from "./setup";

type Method = "DELETE" | "PATCH" | "POST" | "PUT";
type Manifest = { routes: string[] };
type RouteCase = { method: Method; path: string };
type Failure = { route: string; status: number; detail: string };
type Fingerprint = Record<string, string>;

const TEST_PREFIX = "covnonfw";
const MANIFEST_PATH = path.join(process.cwd(), "config/route-manifest.json");
const REQUEST_TIMEOUT_MS = 15000;

const EXCLUDED: RegExp[] = [
  /^\/api\/(auth|admin|debug|sessions?|users?|companies?|system|health)(\/|$)/i,
  /^\/api\/factory(?:\/|-)/i,
  /(whatsapp|email|openai|ai-|carrier|tracking|track-now|refresh-eta)/i,
  /(import|upload|export|download|template|pdf|excel|xlsx|csv|print)/i,
  /(repair|recalc|migration|migrate|cutover|backup|restore|reset|seed|rebuild|purge|backfill)/i,
  /(^|\/)(run|apply|execute|trigger|sync)(\/|$)/i,
  /^\/api\/sp\/(golden-coast|setup|production)(\/|$)/i,
  /\/rental\/(run-monthly|accrue|re-accrue|payments\/post-scheduled)(\/|$)/i,
];

let ctx: TestContext;
let agent: request.SuperAgentTest;
let routes: RouteCase[] = [];
let before: Fingerprint;

function isWriteMethod(value: string): value is Method {
  return value === "DELETE" || value === "PATCH" || value === "POST" || value === "PUT";
}

export function selectNonFactoryValidationWrites(manifest: Manifest): RouteCase[] {
  const seen = new Set<string>();
  const selected: RouteCase[] = [];

  for (const entry of manifest.routes) {
    const [method, routePath] = entry.split(" ");
    if (!isWriteMethod(method) || !routePath?.startsWith("/api/")) continue;
    if (routePath.includes(":") || routePath.includes("*")) continue;
    if (EXCLUDED.some((pattern) => pattern.test(routePath))) continue;
    // ABDALLAH-SYSTEM refuses retired modes and features before any handler runs.
    if (isRetiredAbdallahApiRequest(method, routePath)) continue;
    // The Properties rental routes belonged to a retired company mode.
    if (routePath.startsWith("/api/rental/")) continue;

    const key = `${method} ${routePath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push({ method, path: routePath });
  }

  return selected;
}

async function fingerprint(companyId: number): Promise<Fingerprint> {
  const { rows } = await pool.query<Fingerprint>(
    `SELECT
       (SELECT COUNT(*)::text FROM vouchers WHERE company_id = $1) AS vouchers,
       (SELECT COUNT(*)::text FROM voucher_entries ve JOIN vouchers v ON v.id = ve.voucher_id WHERE v.company_id = $1) AS entries,
       (SELECT COUNT(*)::text FROM inventory WHERE company_id = $1) AS inventory,
       (SELECT COALESCE(SUM(quantity::numeric), 0)::text FROM inventory WHERE company_id = $1) AS inventory_qty,
       (SELECT COUNT(*)::text FROM customers WHERE company_id = $1) AS customers,
       (SELECT COUNT(*)::text FROM suppliers WHERE company_id = $1) AS suppliers,
       (SELECT COUNT(*)::text FROM employees WHERE company_id = $1) AS employees,
       (SELECT COUNT(*)::text FROM stock_items WHERE company_id = $1) AS stock_items,
       (SELECT COUNT(*)::text FROM property_units WHERE company_id = $1) AS property_units,
       (SELECT COUNT(*)::text FROM property_contracts WHERE company_id = $1) AS property_contracts,
       (SELECT COUNT(*)::text FROM property_payments WHERE company_id = $1) AS property_payments,
       (SELECT COUNT(*)::text FROM sp_sales WHERE company_id = $1) AS sp_sales,
       (SELECT COUNT(*)::text FROM sp_stock_movements WHERE company_id = $1) AS sp_movements`,
    [companyId]
  );
  return rows[0];
}

function requestFor(route: RouteCase) {
  switch (route.method) {
    case "DELETE":
      return agent.delete(route.path);
    case "PATCH":
      return agent.patch(route.path);
    case "POST":
      return agent.post(route.path);
    case "PUT":
      return agent.put(route.path);
  }
}

async function exercise(route: RouteCase): Promise<Failure | null> {
  try {
    const response = await requestFor(route)
      .set("x-client-date", "2026-09-14")
      .send({})
      .timeout({ response: REQUEST_TIMEOUT_MS, deadline: REQUEST_TIMEOUT_MS });

    if (response.status >= 500) {
      const body = response.body as { message?: string; error?: string } | undefined;
      return {
        route: `${route.method} ${route.path}`,
        status: response.status,
        detail: body?.message || body?.error || response.text?.slice(0, 200) || "",
      };
    }
    return null;
  } catch (error) {
    const timedOut = Boolean((error as { timeout?: unknown } | undefined)?.timeout);
    return {
      route: `${route.method} ${route.path}`,
      status: timedOut ? 598 : 599,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

beforeAll(async () => {
  ctx = await seedTestData(TEST_PREFIX);
  agent = request.agent(ctx.app);

  await pool.query(
    `UPDATE user_company_roles SET role = 'Developer', can_delete_records = true, can_sell_negative_stock = true
      WHERE user_id = $1 AND company_id = $2`,
    [ctx.userId, ctx.companyId]
  );
  const login = await agent.post("/api/auth/login").send({
    username: `${TEST_PREFIX}_testuser`,
    password: "testpassword123",
  });
  if (login.status !== 200) throw new Error(`Login failed: ${login.status} ${login.text}`);

  routes = selectNonFactoryValidationWrites(JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest);
  before = await fingerprint(ctx.companyId);
}, 120000);

afterAll(async () => {
  await cleanupTestData(TEST_PREFIX);
  closeTestServer();
}, 120000);

describe("non-Factory validation write coverage", () => {
  it("rejects malformed write probes without unhandled server errors", async () => {
    expect(routes.length).toBeGreaterThan(40);
    const failures: Failure[] = [];

    const selected = await agent.post("/api/auth/set-company").send({ companyId: ctx.companyId });
    expect(selected.status, "set-company erp").toBe(200);

    for (const route of routes) {
      const failure = await exercise(route);
      if (failure) failures.push(failure);
    }

    const report = failures
      .map((failure) => `  ${failure.status} ${failure.route}\n      ${failure.detail}`)
      .join("\n");
    expect(failures, `${failures.length} malformed write probe(s) failed unsafely:\n${report}`).toEqual([]);
  }, 300000);

  it("leaves the isolated tenant unchanged", async () => {
    expect(await fingerprint(ctx.companyId), "erp changed during validation sweep").toEqual(before);
  });
});
