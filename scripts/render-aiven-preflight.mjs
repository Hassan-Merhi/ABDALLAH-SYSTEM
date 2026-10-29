#!/usr/bin/env node
/**
 * Fail-closed startup preflight for the separately configured FREE Render/Aiven
 * test deployment. The existing Render production service uses npm start and
 * is intentionally unaffected.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const fail = (message) => {
  console.error("[Render+Aiven free preflight] " + message);
  process.exit(1);
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) fail("DATABASE_URL must reference the NEW Aiven Free test database.");
if (process.env.NODE_ENV !== "production") fail("NODE_ENV must be production.");
if (process.env.PGSSLMODE?.trim().toLowerCase() === "disable") fail("Disabling database TLS is forbidden.");
if (process.env.RUN_STARTUP_MIGRATIONS !== "true") fail("Startup migrations cannot be skipped.");
const expectedHost = process.env.AIVEN_TEST_EXPECTED_HOST?.trim().toLowerCase();
const expectedDb = process.env.AIVEN_TEST_EXPECTED_DATABASE?.trim();
if (!expectedHost || !expectedDb) fail("Set AIVEN_TEST_EXPECTED_HOST and AIVEN_TEST_EXPECTED_DATABASE.");

let uri;
try {
  uri = new URL(connectionString);
} catch {
  fail("Invalid PostgreSQL DATABASE_URL.");
}
const actualHost = uri.hostname.toLowerCase();
const actualDb = decodeURIComponent(uri.pathname.slice(1));
if (!["postgres:", "postgresql:"].includes(uri.protocol) ||
    !actualHost.endsWith(".aivencloud.com") ||
    actualHost !== expectedHost ||
    actualDb !== expectedDb ||
    ["", "postgres", "template0", "template1"].includes(actualDb)) {
  fail("Connection does not match the specifically approved new Aiven test database.");
}
// node-postgres connection string SSL fields can override explicit trusted CA
// settings. Refuse them rather than silently downgrade verification.
if (["sslmode","sslcert","sslkey","sslrootcert"].some((key) => uri.searchParams.has(key))) {
  fail("Remove all SSL query parameters from DATABASE_URL. Use PGSSLROOTCERT instead.");
}
let ca;
try {
  if (!process.env.PGSSLROOTCERT) throw Error("missing PGSSLROOTCERT");
  ca = readFileSync(process.env.PGSSLROOTCERT, "utf8");
  if (!ca.includes("-----BEGIN CERTIFICATE-----")) throw Error("invalid certificate file");
} catch {
  fail("Aiven CA PEM secret file must exist at PGSSLROOTCERT. Refusing unverified TLS.");
}

const client = new pg.Client({
  connectionString,
  ssl: { ca, rejectUnauthorized: true },
  connectionTimeoutMillis: 12_000,
});
try {
  await client.connect();
  const core = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)",
    [["companies","users","locations","vouchers","voucher_entries","stock_items"]]
  );
  const existing = new Set(core.rows.map((row) => row.table_name));
  const missing = ["companies","users","locations","vouchers","voucher_entries","stock_items"].filter((name) => !existing.has(name));
  if (missing.length) fail("New database needs its ONE-TIME baseline first; missing: " + missing.join(", "));
  console.log("[Render+Aiven free preflight] Verified Aiven host/database, core tables and certificate-verified TLS.");
} catch (error) {
  fail("Cannot safely connect to the approved Aiven database: " + (error instanceof Error ? error.message : String(error)));
} finally {
  await client.end().catch(() => {});
}
