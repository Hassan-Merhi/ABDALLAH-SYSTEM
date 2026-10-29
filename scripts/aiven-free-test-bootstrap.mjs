#!/usr/bin/env node
/**
 * GitHub Actions manual, ONE-TIME initializer of an entirely empty Aiven
 * Free TEST PostgreSQL database. Never used by Render application startup.
 *
 * Drizzle Kit is unsafe to use on an established ERP DB because runtime-only
 * tables and sequences aren't all represented in shared/schema.ts.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import pg from "pg";

const fail = (message) => {
  console.error("[Aiven fresh DB bootstrap] " + message);
  process.exit(1);
};
if (process.env.AIVEN_FREE_TEST_BOOTSTRAP_APPROVAL !== "INITIALIZE_EMPTY_AIVEN_FREE_TEST_ONLY")
  fail("One-time bootstrap must be explicitly approved.");
if (!process.env.DATABASE_URL) fail("AIVEN_FREE_TEST_DATABASE_URL secret is missing.");
const expectedHost = process.env.AIVEN_TEST_EXPECTED_HOST?.trim().toLowerCase();
const expectedDb = process.env.AIVEN_TEST_EXPECTED_DATABASE?.trim();
if (!expectedHost || !expectedDb) fail("Expected Aiven host and database name required.");
let uri;
try {
  uri = new URL(process.env.DATABASE_URL);
} catch {
  fail("DATABASE_URL is not a valid URL.");
}
const hostname = uri.hostname.toLowerCase();
const dbName = decodeURIComponent(uri.pathname.slice(1));
if (!["postgres:", "postgresql:"].includes(uri.protocol) ||
    !hostname.endsWith(".aivencloud.com") ||
    hostname !== expectedHost ||
    dbName !== expectedDb ||
    ["", "postgres", "template0", "template1"].includes(dbName)) {
  fail("Database URL is not the explicitly approved NEW Aiven PostgreSQL test database.");
}
if (["sslmode","sslcert","sslkey","sslrootcert"].some((key) => uri.searchParams.has(key)))
  fail("Remove SSL query parameters from URL; TLS verification uses PGSSLROOTCERT.");
if (process.env.PGSSLMODE === "disable") fail("Refusing TLS-disabled external database.");
const caFile = process.env.PGSSLROOTCERT;
if (!caFile) fail("PGSSLROOTCERT is missing.");
let ca;
try {
  ca = readFileSync(caFile, "utf8");
  if (!ca.includes("-----BEGIN CERTIFICATE-----")) throw Error("Invalid PEM");
} catch {
  fail("Aiven CA certificate file missing or invalid.");
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca, rejectUnauthorized: true },
  connectionTimeoutMillis: 15_000,
});
try {
  await client.connect();
  const result = await client.query(
    "SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid=c.relnamespace WHERE s.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')"
  );
  const count = Number(result.rows[0]?.n ?? -1);
  if (count !== 0) {
    process.exitCode = 1;
    console.error("Refused to bootstrap nonempty public schema (" + count + " relations).");
  } else {
    // Node pg clients see explicit PEM in 'ssl'. Drizzle Kit uses the verified
    // full certificate mode and CA path encoded into its own connection URL.
    const drizzleUri = new URL(process.env.DATABASE_URL);
    drizzleUri.searchParams.set("sslmode", "verify-full");
    drizzleUri.searchParams.set("sslrootcert", caFile);
    console.log("Confirmed zero public relations on approved Aiven test DB. Creating baseline ONCE.");
    const result = spawnSync("node_modules/.bin/drizzle-kit", ["push","--force"], {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: drizzleUri.toString(),
        AIVEN_FREE_TEST_BOOTSTRAP_APPROVAL: "",
      },
    });
    if (result.error || result.status !== 0) {
      console.error("Baseline failed. Discard/recreate this test DB; NEVER rerun on a partially populated DB.");
      process.exitCode = 1;
    } else {
      const required = ["companies","users","locations","vouchers","voucher_entries","stock_items"];
      const tables = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name=ANY($1)",
        [required]
      );
      const present = new Set(tables.rows.map((row) => row.table_name));
      const missing = required.filter((name) => !present.has(name));
      if (missing.length) {
        console.error("Bootstrap incomplete; missing " + missing.join(", "));
        process.exitCode = 1;
      } else {
        const size = await client.query("SELECT pg_database_size(current_database()) AS size");
        console.log("Core tables verified. Current DB size: " + size.rows[0].size + " bytes.");
        console.log("Do NOT run Drizzle push again. Start Render once and gate on 0 startup migration failures.");
      }
    }
  }
} catch (error) {
  console.error("Aiven bootstrap error:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
