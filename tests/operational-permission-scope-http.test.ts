/**
 * The operational permission layer over HTTP
 * (server/middleware/operationalPermissionScope.ts with the per-route table in
 * server/services/security/operationalPermissionRoutePolicy.ts).
 *
 *   - Express routes URLs case-insensitively; the old rules did not, so an
 *     upper-case import URL reached the handler unchecked. It no longer does.
 *
 * The Factory raw-stock recalculation and import-cycle cases are retired with
 * Factory Mode in ABDALLAH-SYSTEM.
 */
import request from "supertest";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "../server/db";
import * as schema from "../shared/schema";
import { seedTestData, cleanupTestData, closeTestServer, type TestContext } from "./setup";

const TEST_PREFIX = "opperm";

let ctx: TestContext;
let agent: request.SuperAgentTest;
/** Sets the user's role and re-selects the company (the session copies the role). */
async function setRole(role: string, companyId: number): Promise<void> {
  await db.update(schema.userCompanyRoles).set({ role }).where(eq(schema.userCompanyRoles.userId, ctx.userId));
  expect((await agent.post("/api/auth/set-company").send({ companyId })).status).toBe(200);
}

beforeAll(async () => {
  ctx = await seedTestData(TEST_PREFIX);
  agent = request.agent(ctx.app);
  expect(
    (await agent.post("/api/auth/login").send({ username: `${TEST_PREFIX}_testuser`, password: "testpassword123" }))
      .status
  ).toBe(200);
}, 120000);

afterAll(async () => {
  await cleanupTestData(TEST_PREFIX);
  closeTestServer();
}, 60000);

describe("operational permission scope", () => {
  it("does not reach the import handler through an upper-case URL", async () => {
    await setRole("View Only", ctx.companyId);
    const response = await agent.post("/api/STOCK-ITEMS/IMPORT").send({});
    expect(response.status).toBe(404);
  });
});
