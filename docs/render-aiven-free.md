# ABDALLAH-SYSTEM: Render Free web service + Aiven Free PostgreSQL

**Status: isolated test configuration, NOT production accounting.** Nothing in
this branch changes the existing Render paid ERP service or database. Do not
restore real business data here, and never convert or reconfigure the existing
paid service to Free merely to follow this guide.

## Architecture, limits and safety

- **Render Free Web Service (Node)**: 512 MiB RAM, one instance, sleep after
  15 minutes of inactivity, no persistent local filesystem, limited monthly
  service hours, outbound bandwidth and build minutes. Production workloads,
  file uploads and guaranteed uptime do not fit this tier.
- **Aiven Free PostgreSQL**: free without an expiry date; 1 CPU, 1 GB RAM,
  1 GB database storage, up to 20 PostgreSQL connections and no connection
  pooling. Free services may shut down after inactivity and lack an SLA.
  Choose the closest available Aiven region: Free may **not** let you choose
  an exact cloud or region.
- The database URL uses **verified external TLS** with the Aiven CA certificate.
  Never use `PGSSLMODE=disable`, turn off certificate verification, or paste
  database credentials into GitHub source or this chat.
- The ERP has a large schema with legacy runtime-created tables. A successful
  build isn't enough to prove that a 1 GB Aiven Free database can hold it.
  Avoid using the original ERP+Factory Render DB or actual financial records.

Official limits:
- https://render.com/docs/free
- https://aiven.io/docs/products/postgresql/concepts/pg-free-tier
- https://aiven.io/pricing/postgresql
- https://render.com/docs/configure-environment-variables

## 1. Create a NEW Aiven Free PostgreSQL database (you do this in Aiven)

1. Open https://console.aiven.io/ and create a Free account if needed. No
   credit card is required for the Free database.
2. Create a **new** PostgreSQL service, select **Free** and PostgreSQL **18**
   if available. Name it `abdallah-erp-free-test`.
3. In its **Overview** or **Connection Information** view, record the
   **host** (such as `pg-xxx.aivencloud.com`), **port**, **database name**,
   and **user**. The hostname, port, database name and PostgreSQL major
   version are safe to share; **do not share the password or Service URI**.
4. Download the project's **CA certificate** to a file named `aiven-ca.pem`.
   This is a trust certificate (public, not a database password).
5. Ensure the *new test database* has no application tables. The Aiven
   default database may be `defaultdb`; the script refuses nonempty public
   schemas. Do not point this guide at your current ERP database.

## 2. Create the core schema ONCE, before deploying Render

**Critical:** ERP startup migrations are not sufficient to create the
foundational tables in an empty database. The one-time initializer
`scripts/aiven-free-test-bootstrap.mjs` is restricted to a confirmed new
Aiven test database, refuses any public tables/views/sequences, verifies
PostgreSQL TLS against the project CA, and creates the Drizzle core schema.
Never run `drizzle-kit push` on an existing ERP DB or after first startup.

Use Node.js **24.22.1** on your computer, clone the isolated GitHub branch
and enter the Aiven test connection privately:

```bash
git clone --branch deployment/render-free-aiven-free \
  git@github.com:Hassan-Merhi/ABDALLAH-SYSTEM.git
cd ABDALLAH-SYSTEM
npm ci --include=dev --no-audit

# Save the downloaded Aiven CA certificate OUTSIDE Git, then point here:
export PGSSLROOTCERT="$HOME/aiven-ca.pem"

# Enter only the new database URL, without ?sslmode=require:
read -rs -p "New Aiven FREE test DATABASE_URL: " DATABASE_URL; echo
export DATABASE_URL
export AIVEN_TEST_EXPECTED_HOST="PASTE_EXACT_AIVEN_HOST"
export AIVEN_TEST_EXPECTED_DATABASE="PASTE_EXACT_DATABASE_NAME"
export AIVEN_FREE_TEST_BOOTSTRAP_APPROVAL="INITIALIZE_EMPTY_AIVEN_FREE_TEST_ONLY"
node scripts/aiven-free-test-bootstrap.mjs
unset AIVEN_FREE_TEST_BOOTSTRAP_APPROVAL
unset DATABASE_URL
```

If the initializer fails after creating any relations, **delete and recreate
the new test database**. Never retry `drizzle-kit push` against partially
populated data. It is not safe to use this script against a restored or
previously deployed database. The initial baseline is not a full production
migration; runtime schema setup on first boot remains mandatory.

If using Windows without Bash, run these commands in WSL or another POSIX
terminal. You can also use a disposable developer environment such as GitHub
Codespaces, but Codespaces may incur charges.

## 3. Create a SEPARATE Render Free service

Open https://dashboard.render.com/web/new and connect the private
`Hassan-Merhi/ABDALLAH-SYSTEM` GitHub repo. Create a **new** Web Service
with the following exact values; do not edit the existing paid `system`:

| Setting | Value |
|---|---|
| Name | `abdallah-erp-free-test` |
| Branch | `deployment/render-free-aiven-free` |
| Runtime / Language | `Node` |
| Compute Plan | **Free** |
| Region | Closest available to Aiven (Frankfurt if appropriate) |
| Root directory | repository root (blank) |
| Build command | `npm ci --include=dev --no-audit && npm run build` |
| Start command | `node scripts/render-aiven-preflight.mjs && NODE_OPTIONS=--max-old-space-size=320 npm start` |
| Health check path | `/api/health/ready` |
| Auto-deploy | Off initially; enable later after tests |

Set these environment variables in the **new service only**:

```dotenv
NODE_ENV=production
NODE_VERSION=24.22.1
PUPPETEER_SKIP_DOWNLOAD=true
MEMORY_SOFT_RSS_MB=384
MEMORY_HARD_RSS_MB=448
PG_POOL_MAX=3
PG_POOL_MIN=0
PG_SESSION_POOL_MAX=1
PG_IDLE_TIMEOUT_MS=30000
ENABLE_SCHEDULERS=false
RUN_STARTUP_MIGRATIONS=true
CSRF_ENFORCE=1
PGSSLROOTCERT=/etc/secrets/aiven-ca.pem
PGSSL_REJECT_UNAUTHORIZED=true
AIVEN_TEST_EXPECTED_HOST=PASTE_EXACT_AIVEN_HOST
AIVEN_TEST_EXPECTED_DATABASE=PASTE_EXACT_DATABASE_NAME
```

Add two **secret environment variables** only through the Render Dashboard:
- `DATABASE_URL`: the **NEW** Aiven Free test PostgreSQL connection URI.
  Do **not** append `?sslmode=require`, `?sslmode=disable`, or any other
  `sslmode`/SSL query parameter; the application uses the verified CA.
- `SESSION_SECRET`: new random 32+ character secret, unique to this
  test service. Use a cryptographically random 48-byte value.

Next under **Environment > Secret Files** add
`aiven-ca.pem` and paste the PEM contents of the downloaded **CA
certificate**. Render mounts this at `/etc/secrets/aiven-ca.pem` at
runtime. Never add it to the Git repository. An ordinary native Node Web
Service can access this secret file.

Render automatically supplies `PORT`; leave it unset. The web server must
listen on `0.0.0.0` (the application default on this branch).

**Do not start/deploy until the one-time database initialization succeeded.**
New service creation normally triggers a deployment. If Render starts
before the database is initialized, the fail-closed startup preflight
will refuse to run; add the database core schema first and redeploy.

## 4. Verify safe startup, then test

Once the new service reports Live, copy its `https://...onrender.com`
URL and run:

```bash
curl -fsS "https://YOUR-NEW-RENDER-URL/api/health/ready"
curl -fsS "https://YOUR-NEW-RENDER-URL/api/health/db"
```

**Mandatory go/no-go:** `migrations.completed=true`,
`migrations.skipped=false`, and `migrations.failureCount=0`; a successful
200 response alone is insufficient. Test the **first** boot and check the
Render logs for exceptions before exposing the system to any users. Verify
database size remains below the 1 GB free cap, and that login, test-company
isolation, posting, inventory, sessions and export workflows all function.

App sessions are stored in PostgreSQL, but file uploads saved on Render's
local filesystem are lost on restart/redeploy/spin-down. **Do not upload real
documents** until durable object storage is added and audited. Browser-based
carrier scraping is disabled via `PUPPETEER_SKIP_DOWNLOAD=true`. No scheduled
background jobs are run in this test tier.

The 512 MB Render service may fail during full ERP startup or large exports,
and Aiven Free may be too small for the database schema. If so, stop. Do not
silently upgrade to a paid plan or reuse the existing production database.

## 5. Costs and operational risks

Render Free has monthly service-hour, build-minute and network limits. Render
can charge for overages if a payment method is present; otherwise services
may be suspended. Its Free instance sleeps after 15 minutes and has no
persistent file storage. Aiven Free is limited to 1 GB storage and may sleep
after inactivity; it includes provider-managed backups but is not HA or
covered by a production SLA. Offsite recoverable backups remain your
responsibility for important data.

Keep automatic migrations, seed operations and startup DDL under review.
Any change to accounting schema or startup migrations should be validated in
an isolated test DB first. **Never replace or alter the old Render paid ERP
service or its PostgreSQL database as part of this experiment.**
