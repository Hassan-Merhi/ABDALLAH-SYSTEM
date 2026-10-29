#!/usr/bin/env node
/**
 * One-time, explicitly approved bootstrap of a FRESH Aiven PostgreSQL database.
 *
 * Never run this against an existing ERP database. Existing production
 * installations must use reviewed, non-destructive schema migrations instead.
 * This initializer is intended only for a disposable Cloud Run test database.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { Client } from "pg";

const REQUIRED_APPROVAL = "BOOTSTRAP_EMPTY_AIVEN_TEST_DATABASE_ONLY";
const raw = process.env.DATABASE_URL;
if (!raw || process.env.CLOUD_RUN_FRESH_DATABASE_APPROVAL !== REQUIRED_APPROVAL) {
  console.error("Set DATABASE_URL and CLOUD_RUN_FRESH_DATABASE_APPROVAL=" + REQUIRED_APPROVAL);
  process.exit(2);
}
if (process.env.PGSSLMODE?.toLowerCase() === "disable") {
  console.error("TLS cannot be disabled for an external Aiven connection.");
  process.exit(2);
}
let uri;
try {
  uri = new URL(raw);
} catch {
  console.error("DATABASE_URL is not a valid URL.");
  process.exit(2);
}
const hostname = uri.hostname.toLowerCase();
const dbName = decodeURIComponent(uri.pathname.slice(1));
if (
  !["postgres:", "postgresql:"].includes(uri.protocol) ||
  !hostname.endsWith(".aivencloud.com") ||
  !hostname.includes(".") ||
  !process.env.CLOUD_RUN_EXPECTED_DATABASE_HOST ||
  !process.env.CLOUD_RUN_EXPECTED_DATABASE_NAME ||
  hostname !== process.env.CLOUD_RUN_EXPECTED_DATABASE_HOST.toLowerCase().trim() ||
  dbName !== process.env.CLOUD_RUN_EXPECTED_DATABASE_NAME.trim() ||
  ["", "postgres", "template0", "template1"].includes(dbName)
) {
  console.error("Only an explicitly named NEW Aiven PostgreSQL test database may be bootstrapped.");
  process.exit(2);
}
const rootCert = process.env.PGSSLROOTCERT;
if (!rootCert || !existsSync(rootCert)) {
  console.error("Set PGSSLROOTCERT to your downloaded Aiven project CA certificate.");
  process.exit(2);
}
if (!existsSync("node_modules/.bin/drizzle-kit")) {
  console.error("Install the repository's dependencies with npm ci before bootstrapping.");
  process.exit(2);
}
if (uri.searchParams.has("sslmode") && uri.searchParams.get("sslmode") !== "verify-full") {
  console.error("DATABASE_URL cannot specify weaker SSL settings. Use verify-full.");
  process.exit(2);
}
// Include CA options for Drizzle Kit, which uses its own database driver.
uri.searchParams.set("sslmode", "verify-full");
uri.searchParams.set("sslrootcert", rootCert);
const secureUrl = uri.toString();
const client = new Client({ connectionString: secureUrl, connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  const preflight = await client.query(
    "SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')"
  );
  const relationCount = Number(preflight.rows[0]?.n ?? -1);
  if (relationCount !== 0) {
    console.error("Refusing destructive bootstrap: " + relationCount + " public relations exist.");
    process.exitCode = 1;
  } else {
    console.log("Fresh Aiven database verified; applying ONE-TIME Drizzle-declared baseline.");
    const child = spawnSync("node_modules/.bin/drizzle-kit", ["push", "--force"], {
      env: { ...process.env, DATABASE_URL: secureUrl, CLOUD_RUN_FRESH_DATABASE_APPROVAL: "" },
      stdio: "inherit",
    });
    if (child.error || child.status !== 0) {
      console.error("Bootstrap failed. Delete/recreate this TEST database before retrying.");
      console.error(child.error?.message ?? "Drizzle Kit exited " + child.status);
      process.exitCode = 1;
    } else {
      const needed = ["companies", "users", "locations", "vouchers", "voucher_entries", "stock_items"];
      const check = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)",
        [needed]
      );
      const seen = new Set(check.rows.map((r) => r.table_name));
      const missing = needed.filter((name) => !seen.has(name));
      if (missing.length) {
        console.error("Baseline incomplete: " + missing.join(", "));
        process.exitCode = 1;
      } else {
        console.log("Core tables verified. Do not run drizzle-kit push again.");
        console.log("Deploy app and verify /api/health/db has zero failures and /api/health/ready is healthy.");
      }
    }
  }
} catch (error) {
  console.error("Aiven test database bootstrap failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
