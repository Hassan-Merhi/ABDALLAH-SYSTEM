#!/usr/bin/env node
/**
 * Establish the Drizzle-declared core schema in a verified EMPTY local DB.
 *
 * This is a ONE-TIME bootstrap and must never run against an existing database.
 * Runtime startup migrations create additional tables after the bootstrap.
 *
 * Never use drizzle-kit push again after ERP startup: runtime-only tables and
 * production schema drift can make later pushes destructive.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { Client } from "pg";
import { resolveDatabaseSsl } from "../server/lib/databaseSsl.mjs";

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(2);
}
let dbUrl;
try {
  dbUrl = new URL(rawUrl);
} catch {
  console.error("DATABASE_URL must be a valid PostgreSQL URL.");
  process.exit(2);
}
const host = dbUrl.hostname.toLowerCase();
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error("Bootstrap only supports local PostgreSQL (localhost/127.0.0.1).");
  process.exit(2);
}
if (["postgres", "template0", "template1"].includes(dbUrl.pathname.slice(1))) {
  console.error("Refusing to bootstrap a PostgreSQL maintenance/template database.");
  process.exit(2);
}
if (process.env.ORACLE_BOOTSTRAP_NEW_DATABASE !== "YES") {
  console.error("Set ORACLE_BOOTSTRAP_NEW_DATABASE=YES for a deliberately fresh database.");
  process.exit(2);
}
const binary = "node_modules/.bin/drizzle-kit";
if (!existsSync(binary)) {
  console.error("Install dependencies with npm ci before running the bootstrap.");
  process.exit(2);
}
const client = new Client({
  connectionString: rawUrl,
  ssl: resolveDatabaseSsl(rawUrl),
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  // A read-only inspection. If *any* public relation exists, fail closed.
  const relations = await client.query(
    "SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m','S','f')"
  );
  const count = Number(relations.rows[0]?.n ?? -1);
  if (count !== 0) {
    console.error("Refusing to bootstrap a non-empty database (" + count +
      " public relations). NEVER use this tool on an existing ERP database.");
    process.exitCode = 1;
  } else {
    console.log("Verified empty local database; provisioning Drizzle-declared baseline once.");
    const result = spawnSync(binary, ["push", "--force"], {
      env: { ...process.env, ORACLE_BOOTSTRAP_NEW_DATABASE: "" },
      stdio: "inherit",
    });
    if (result.error || result.status !== 0) {
      console.error("Schema creation failed; this database is not ready. " +
        (result.error?.message ?? "Exit status " + result.status));
      process.exitCode = 1;
    } else {
      const required = ["companies", "users", "locations", "vouchers", "voucher_entries", "stock_items"];
      const core = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)",
        [required]
      );
      const seen = new Set(core.rows.map((row) => row.table_name));
      const missing = required.filter((name) => !seen.has(name));
      if (missing.length) {
        console.error("Declared baseline incomplete: missing " + missing.join(", "));
        process.exitCode = 1;
      } else {
        console.log("Core schema initialized. Next: boot the ERP once and check " +
          "/api/health/db and /api/health/ready before enabling access.");
      }
    }
  }
} catch (error) {
  console.error("Empty DB bootstrap failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
