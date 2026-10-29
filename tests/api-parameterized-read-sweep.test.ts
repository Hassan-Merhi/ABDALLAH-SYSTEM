import fs from "node:fs";
import path from "node:path";

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isRetiredAbdallahApiRequest } from "../server/middleware/abdallahErpRetiredFeatureBoundary";
import { cleanupTestData, closeTestServer, seedTestData, type TestContext } from "./setup";
import type { SerializedRouteManifest } from "./helpers/routeManifest";

const ERP_PREFIX = "phase33read";
const MANIFEST_PATH = path.join(process.cwd(), "config/route-manifest.json");
const REQUEST_TIMEOUT_MS = 15_000;

const EXCLUDED_PATTERNS: RegExp[] = [
  /(^|\/)(debug)(\/|$)/i,
  /(repair|recalc|backup|restore|reset|seed|rebuild|purge)/i,
  /(^|\/)(run|apply|execute|trigger)(\/|$)/i,
  /(export|download|template)/i,
  /\.(xlsx|pdf|csv|zip)$/i,
  /(whatsapp|email|openai|gemini|ai-validation|track|trace)/i,
  /\/api\/screen-feed\/live\//i,
];

interface SweptRoute {
  manifestPath: string;
  requestPath: string;
}

function loadManifest(): SerializedRouteManifest {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as SerializedRouteManifest;
}

function replacementFor(name: string, ctx: TestContext): string {
  const key = name.toLowerCase();

  if (key.includes("company")) return String(ctx.companyId);
  if (key.includes("location")) return String(ctx.locationId);
  if (key.includes("stockitem") || key === "itemid") return String(ctx.stockItemIds[0]);
  if (key.includes("stockgroup") || key === "groupid") return String(ctx.stockGroupId);
  if (key.includes("cashaccount")) return String(ctx.cashAccountId);
  if (key.includes("salesaccount") || key === "accountid" || key === "ledgeraccountid") {
    return String(ctx.salesAccountId);
  }
  if (key.includes("userid") || key === "user") return encodeURIComponent(ctx.userId);
  if (key.includes("year")) return "2026";
  if (key.includes("month")) return "9";
  if (key.includes("date")) return "2026-09-15";
  if (key.includes("currency")) return "USD";
  if (key.includes("status")) return "active";
  if (key.includes("code")) return "PHASE33";
  if (key.includes("type")) return "all";

  // A deliberately missing integer is safer than accidentally addressing a real
  // row when the manifest only says :id. The handler still executes its auth,
  // company-scope, parsing and lookup/error path, which is the behavior this
  // sweep is intended to protect.
  if (key === "id" || key.endsWith("id")) return "2147483000";
  return "phase33-missing";
}

export function materializeParameterizedPath(routePath: string, ctx: TestContext): string {
  return routePath.replace(/:([A-Za-z0-9_]+)/g, (_match, name: string) =>
    encodeURIComponent(replacementFor(name, ctx))
  );
}

export function selectParameterizedReadRoutes(manifest: SerializedRouteManifest, ctx: TestContext): SweptRoute[] {
  const seen = new Set<string>();
  const selected: SweptRoute[] = [];

  for (const entry of manifest.routes) {
    const [method, routePath] = entry.split(" ");
    if (method !== "GET") continue;
    if (!routePath?.startsWith("/api/")) continue;
    if (!routePath.includes(":")) continue;
    if (routePath.includes("*")) continue;
    if (EXCLUDED_PATTERNS.some((pattern) => pattern.test(routePath))) continue;
    // ABDALLAH-SYSTEM refuses retired modes and features before any handler runs.
    if (isRetiredAbdallahApiRequest(method, routePath)) continue;

    const key = `${method} ${routePath}`;
    if (seen.has(key)) continue;
    seen.add(key);

    selected.push({
      manifestPath: routePath,
      requestPath: materializeParameterizedPath(routePath, ctx),
    });
  }

  return selected;
}

async function authenticatedAgent(ctx: TestContext, prefix: string): Promise<request.SuperAgentTest> {
  const agent = request.agent(ctx.app);
  const login = await agent.post("/api/auth/login").send({
    username: `${prefix}_testuser`,
    password: "testpassword123",
  });
  expect(login.status).toBe(200);

  const company = await agent.post("/api/auth/set-company").send({ companyId: ctx.companyId });
  expect(company.status).toBe(200);
  return agent;
}

describe("parameterized backend read-surface sweep", () => {
  let agent: request.SuperAgentTest;
  let routes: SweptRoute[] = [];

  beforeAll(async () => {
    const ctx = await seedTestData(ERP_PREFIX);
    agent = await authenticatedAgent(ctx, ERP_PREFIX);
    routes = selectParameterizedReadRoutes(loadManifest(), ctx);
  }, 120_000);

  afterAll(async () => {
    await cleanupTestData(ERP_PREFIX);
    await closeTestServer();
  }, 120_000);

  it("executes every safe parameterized GET handler without a server error", async () => {
    expect(routes.length).toBeGreaterThan(25);

    const failures: Array<{ route: string; requestPath: string; status: number; detail: string }> = [];

    for (const route of routes) {
      try {
        const response = await agent
          .get(route.requestPath)
          .query({ limit: 1, page: 1 })
          .timeout({ response: REQUEST_TIMEOUT_MS, deadline: REQUEST_TIMEOUT_MS });

        if (response.status >= 500) {
          failures.push({
            route: route.manifestPath,
            requestPath: route.requestPath,
            status: response.status,
            detail:
              typeof response.body === "object" && response.body
                ? JSON.stringify(response.body).slice(0, 300)
                : String(response.text ?? "").slice(0, 300),
          });
        }
      } catch (error) {
        failures.push({
          route: route.manifestPath,
          requestPath: route.requestPath,
          status: 0,
          detail: error instanceof Error ? error.message : String(error),
        });
      }
    }

    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  }, 300_000);
});
