#!/usr/bin/env bash
# Only for a NEW, EMPTY PostgreSQL database. Never run on a populated ERP.
set -euo pipefail
if [[ $# -ne 1 || ! -f "$1" ]]; then
  echo "Usage: bash deploy/oracle/restore-schema-baseline.sh /private/path/schema-only.sql" >&2
  exit 2
fi
if [[ ! -v DATABASE_URL || -z "$DATABASE_URL" ]]; then
  echo "Export DATABASE_URL (and PGSSLMODE=disable for local PostgreSQL)." >&2
  exit 2
fi
if ! command -v psql >/dev/null; then
  echo "PostgreSQL client (psql) is required." >&2
  exit 2
fi
# Only restore a reviewed schema-only dump made from your own trusted ERP.
# The preflight fails closed if the target already has any public relations.
node scripts/oracle-db-preflight.mjs --empty
echo "Restoring reviewed baseline as a single PostgreSQL transaction..."
psql --dbname="$DATABASE_URL" -X --set=ON_ERROR_STOP=1 --single-transaction --file="$1"
node scripts/oracle-db-preflight.mjs --ready
echo "Baseline restored. Start the ERP with RUN_STARTUP_MIGRATIONS=true and verify /api/health/db."
