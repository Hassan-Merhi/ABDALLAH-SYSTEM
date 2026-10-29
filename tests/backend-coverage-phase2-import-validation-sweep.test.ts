/**
 * Phase 2 backend coverage — import/upload validation sweep.
 *
 * Import handlers were deliberately excluded from Phase 1 because they can be
 * expensive and mutation-heavy with real workbooks. Phase 2 executes their
 * authenticated validation edges with empty multipart/body payloads. A missing
 * file or empty batch must be rejected cleanly without creating financial or
 * inventory state, while still exercising upload middleware and parser guards.
 */
import fs from "node:fs";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { pool } from "../server/db";
import { isRetiredAbdallahApiRequest } from "../server/middleware/abdallahErpRetiredFeatureBoundary";
import { cleanupTestData, closeTestServer, seedTestData, type TestContext } from "./setup";

type CompanyMode = "erp";
type Manifest = { routes: string[] };
type RouteCase = { mode: CompanyMode; path: string; multipart: boolean };
type Fingerprint = {
  vouchers: string;
  entries: string;
  inventoryRows: string;
  inventoryQty: string;
  rawStockRows: string;
  baleRows: string;
};

const TEST_PREFIX = "phase2imp";
const MANIFEST_PATH = path.join(process.cwd(), "config/route-manifest.json");
const REQUEST_TIMEOUT_MS = 20000;
// Import handlers share parser/database state and some abort early while
// rejecting malformed payloads. Serial execution keeps this failure-path sweep
// deterministic and avoids ECONNRESET noise from overlapping parser teardown.
const CONCURRENCY = 1;
const IMPORT_PATTERN = /(import|upload|preview|validate)/i;
// Route names containing "import" are not necessarily multipart endpoints.
// Only explicit upload paths are exercised as fileless multipart requests;
// import/validate/preview routes otherwise receive an empty JSON-shaped body.
const MULTIPART_PATTERN = /\/upload(?:\/|$)/i;
const EXCLUDED: RegExp[] = [
  /(whatsapp|email|openai|ai-|carrier|tracking)/i,
  /(repair|recalc|migration|migrate|cutover|backup|restore|reset|seed|rebuild|purge|backfill)/i,
  /(^|\/)(run|apply|execute|trigger|sync|refresh)(\/|$)/i,
];

let ctx: TestContext;
let agent: request.SuperAgentTest;
let companies: Record<CompanyMode, number>;
let routes: RouteCase[] = [];
let before: Record<CompanyMode, Fingerprint>;

/**
 * ABDALLAH-SYSTEM is ERP only: routes owned by the retired Factory, Supplier
 * Partner and Properties modes have no ERP tenant to run in.
 */
function modeForPath(routePath: string): CompanyMode | null {
  if (
    routePath.startsWith("/api/factory/") ||
    routePath.startsWith("/api/factory-") ||
    routePath.startsWith("/api/sp/") ||
    routePath.startsWith("/api/sp-migration/") ||
    routePath.startsWith("/api/properties/") ||
    routePath.startsWith("/api/rental/")
  ) {
    return null;
  }
  return "erp";
}

export function selectPhase2ImportValidationRoutes(manifest: Manifest): RouteCase[] {
  const selected: RouteCase[] = [];
  const seen = new Set<string>();

  for (const entry of manifest.routes) {
    const [method, routePath] = entry.split(" ");
    if (method !== "POST" || !routePath?.startsWith("/api/")) continue;
    if (routePath.includes(":") || routePath.includes("*")) continue;
    if (!IMPORT_PATTERN.test(routePath) || EXCLUDED.some((pattern) => pattern.test(routePath))) continue;

    const mode = modeForPath(routePath);
    if (!mode || isRetiredAbdallahApiRequest(method, routePath)) continue;
    const key = `${mode} ${routePath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push({ mode, path: routePath, multipart: MULTIPART_PATTERN.test(routePath) });
  }

  return selected;
}

async function fingerprint(companyId: number): Promise<Fingerprint> {
  const result = await pool.query<Fingerprint>(
    `SELECT
       (SELECT COUNT(*)::text FROM vouchers WHERE company_id = $1) AS vouchers,
       (SELECT COUNT(*)::text FROM voucher_entries ve JOIN vouchers v ON v.id = ve.voucher_id WHERE v.company_id = $1) AS entries,
       (SELECT COUNT(*)::text FROM inventory WHERE company_id = $1) AS "inventoryRows",
       (SELECT COALESCE(SUM(quantity::numeric), 0)::text FROM inventory WHERE company_id = $1) AS "inventoryQty",
       (SELECT COUNT(*)::text FROM factory_raw_stock WHERE company_id = $1 AND deleted_at IS NULL) AS "rawStockRows",
       (SELECT COUNT(*)::text FROM factory_bales WHERE company_id = $1) AS "baleRows"`,
    [companyId]
  );
  return result.rows[0];
}

async function exercise(route: RouteCase): Promise<{ route: string; status: number; detail: string } | null> {
  try {
    let pending: request.Test;
    if (route.multipart) {
      pending = agent.post(route.path).field("phase2Validation", "true").field("mode", "preview");
    } else {
      pending = agent.post(route.path).send({
        rows: [],
        items: [],
        data: [],
        records: [],
        preview: true,
        dryRun: true,
      });
    }

    const response = await pending.timeout({ response: REQUEST_TIMEOUT_MS, deadline: REQUEST_TIMEOUT_MS });
    if (response.status >= 500 || response.status === 401) {
      const body = response.body as { message?: string; error?: string } | undefined;
      return {
        route: `${route.mode} POST ${route.path}`,
        status: response.status,
        detail: body?.message || body?.error || response.text?.slice(0, 200) || "",
      };
    }
    return null;
  } catch (error) {
    const timedOut = Boolean((error as { timeout?: unknown } | undefined)?.timeout);
    return {
      route: `${route.mode} POST ${route.path}`,
      status: timedOut ? 598 : 599,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

beforeAll(async () => {
  ctx = await seedTestData(TEST_PREFIX);
  agent = request.agent(ctx.app);

  await pool.query(
    `UPDATE user_company_roles
        SET role = 'Developer', can_delete_records = true, can_sell_negative_stock = true
      WHERE user_id = $1 AND company_id = $2`,
    [ctx.userId, ctx.companyId]
  );

  const login = await agent.post("/api/auth/login").send({
    username: `${TEST_PREFIX}_testuser`,
    password: "testpassword123",
  });
  if (login.status !== 200) throw new Error(`Login failed: ${login.status} ${login.text}`);

  companies = { erp: ctx.companyId };
  routes = selectPhase2ImportValidationRoutes(JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest);
  before = { erp: await fingerprint(companies.erp) };
}, 120000);

afterAll(async () => {
  await cleanupTestData(TEST_PREFIX);
  closeTestServer();
}, 120000);

describe("Phase 2 import/upload validation sweep", () => {
  it("rejects empty imports cleanly in the ERP company", async () => {
    expect(routes.length).toBeGreaterThan(15);
    const failures: Array<{ route: string; status: number; detail: string }> = [];

    for (const mode of ["erp"] as CompanyMode[]) {
      const switched = await agent.post("/api/auth/set-company").send({ companyId: companies[mode] });
      expect(switched.status, `set-company ${mode}`).toBe(200);

      const modeRoutes = routes.filter((route) => route.mode === mode);
      for (let offset = 0; offset < modeRoutes.length; offset += CONCURRENCY) {
        const outcomes = await Promise.all(modeRoutes.slice(offset, offset + CONCURRENCY).map(exercise));
        failures.push(
          ...outcomes.filter(
            (outcome): outcome is { route: string; status: number; detail: string } => outcome !== null
          )
        );
      }
    }

    const report = failures
      .map((failure) => `  ${failure.status} ${failure.route}\n      ${failure.detail}`)
      .join("\n");
    expect(failures, `${failures.length} import validation route(s) failed:\n${report}`).toEqual([]);
  }, 300000);

  it("does not create accounting or inventory state from rejected imports", async () => {
    for (const [mode, companyId] of Object.entries(companies) as [CompanyMode, number][]) {
      expect(await fingerprint(companyId), `${mode} changed during rejected import sweep`).toEqual(before[mode]);
    }
  });
});
