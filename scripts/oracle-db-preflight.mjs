#!/usr/bin/env node
/**
 * Safe preflight for Oracle's local PostgreSQL instance.
 * --empty: verify no public relations before restoring an approved baseline.
 * --ready: verify essential ERP tables before starting the app.
 * Never performs DDL.
 */
import { Client } from "pg";
import { resolveDatabaseSsl } from "../server/lib/databaseSsl.mjs";

const mode = process.argv[2] ?? "--ready";
if (!["--empty", "--ready"].includes(mode) || process.argv.length > 3) {
  console.error("Usage: node scripts/oracle-db-preflight.mjs [--empty|--ready]");
  process.exit(2);
}
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is required. Refusing to inspect an unspecified database.");
  process.exit(2);
}
const REQUIRED_TABLES = [
  "companies", "users", "locations", "vouchers", "voucher_entries", "stock_items",
];
const client = new Client({
  connectionString,
  ssl: resolveDatabaseSsl(connectionString),
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const relations = await client.query(
    "SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f') ORDER BY c.relname"
  );
  const names = new Set(relations.rows.map((row) => row.name));
  if (mode === "--empty") {
    if (names.size !== 0) {
      console.error("Refusing schema restore: public schema already has " +
        names.size + " relation(s), including: " + [...names].slice(0, 12).join(", "));
      process.exitCode = 1;
    } else {
      console.log("OK: target public schema is empty. Schema-only restore may proceed.");
    }
  } else {
    const missing = REQUIRED_TABLES.filter((name) => !names.has(name));
    if (missing.length) {
      console.error("ERP core schema is missing: " + missing.join(", ") +
        ". Restore an approved schema-only baseline before starting the ERP. " +
        "See docs/oracle-always-free.md.");
      process.exitCode = 1;
    } else {
      console.log("OK: all " + REQUIRED_TABLES.length + " required core ERP tables exist.");
    }
  }
  await client.query("ROLLBACK");
} catch (error) {
  console.error("PostgreSQL preflight failed: " +
    (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
