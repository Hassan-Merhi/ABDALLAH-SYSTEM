# ABDALLAH-SYSTEM: Google Cloud Run + Aiven Free PostgreSQL (test only)

> **Test / prototype deployment, not production accounting.** Cloud Run has a
> monthly usage allowance, not a no-charge guarantee. Cloud Build, Artifact
> Registry, Secret Manager, network egress and logs may generate bills. Aiven
> Free can stop after inactivity and has 1 GB of disk. Do not migrate live
> financial data into this setup before acceptance, persistence and restore tests.

## Architecture

- `Google Cloud Run`: one Linux AMD64 container for the bundled React/Vite
  frontend and Express/Node backend. Source Dockerfile uses Node **24.22.1**,
  matching `.node-version`, and intentionally skips bundled Chromium.
- `Aiven Free PostgreSQL`: a separate *NEW* database. Choose PostgreSQL 18
  if the free service offers it. **Never point the bootstrap at the existing
  Render ERP database.**
- HTTPS and web URL provided by Cloud Run. No public PostgreSQL endpoint on
  Cloud Run and no long-running Node scheduler.
- All sensitive configuration goes through Secret Manager with a dedicated
  runtime service account. The Aiven project CA certificate is mounted as a
  read-only secret file for TLS server verification.

This branch is isolated from the active Render `main` deployment and from
the Oracle deployment PR.

## 1. Create Google Cloud account and guard costs BEFORE enabling services

1. Open https://console.cloud.google.com/ and sign in or create a billing
   account. Free-tier access **requires billing**.
2. Create a dedicated project, e.g. `abdallah-erp-test` (the project ID
   must be globally unique; note its exact ID). Select **Frankfurt
   (europe-west3)** for Cloud Run if Aiven provides a geographically close
   region, or choose regions together for low latency.
3. In **Billing -> Budgets & alerts**, create a project-scoped **$1 monthly
   alert-only budget** at 50/90/100%, or an eligible **Cloud Run spend-cap
   budget** if the feature is offered in your account. Alert-only budgets
   **do not stop charges**. A Cloud Run spend cap does not cover other
   products such as Artifact Registry.
4. Confirm quota/usage in Billing frequently, and avoid add-on products
   (Cloud SQL, VPC/NAT, minimum instances, GPUs, custom domains) for this test.
   Configure Artifact Registry cleanup to remove old images, after ensuring
   you preserve the current live revision. Artifact Registry has only 0.5 GiB
   of free storage per billing account: a large ERP image may exceed it.

Official cost docs:
https://cloud.google.com/run/pricing
https://cloud.google.com/artifact-registry/pricing
https://docs.cloud.google.com/billing/docs/how-to/budgets

## 2. Create an entirely NEW Aiven Free PostgreSQL service

1. Sign up at https://console.aiven.io/ (Free plan requires no card).
2. Create a **PostgreSQL / Free** service, choose **18** if supported, and a
   region near Cloud Run. Free includes 1 CPU, 1 GB RAM, **1 GB storage** and
   up to 20 server connections. It may power down when inactive.
3. Save the database name, server host and port, and username. Download the
   Aiven project's **CA Certificate** as `ca.pem`.
4. Prepare the Aiven connection URL on your own computer or Cloud Shell;
   URL-encode special characters in the password. Use only the *new* test
   database. **Do not paste the password, URL, or CA private keys into a chat.**

The repository's startup schema migrations cannot create core tables in an
empty database by themselves. The following one-time test initializer verifies
the exact expected Aiven hostname and database name, verifies TLS via the
downloaded Aiven CA, and refuses any database with public relations.

From your **clone of this branch**, with Node 24.22.1 installed:

```bash
npm ci --include=dev --no-audit --no-fund
# Type the URL privately; do NOT commit or paste it into GitHub.
read -rs -p "New Aiven TEST DATABASE_URL: " DATABASE_URL; echo
export DATABASE_URL
export PGSSLROOTCERT="$PWD/ca.pem"
export CLOUD_RUN_EXPECTED_DATABASE_HOST="PASTE_EXACT_NEW_AIVEN_HOST"
export CLOUD_RUN_EXPECTED_DATABASE_NAME="PASTE_EXACT_NEW_AIVEN_DATABASE_NAME"
export CLOUD_RUN_FRESH_DATABASE_APPROVAL="BOOTSTRAP_EMPTY_AIVEN_TEST_DATABASE_ONLY"
node scripts/cloud-run-bootstrap-new-aiven.mjs
unset CLOUD_RUN_FRESH_DATABASE_APPROVAL
```

Copy `ca.pem` to the clone root for this one-time command, then keep it
**outside version control**. If the initializer fails after writing some
tables, delete/recreate the **new test database**; never rerun on a partially
initialized one. Only run this once, **before first application startup**.
The CLI uses Drizzle Kit only for the initial declared baseline, never after
runtime migrations or on existing business data. After core table creation,
the application startup DDL must run and report no failures.

If Aiven's Free service cannot support the schema size, stop: **do not point
Cloud Run at the existing production ERP database** and don't upgrade to a
paid service without deciding to incur those charges.

## 3. Set up Google Cloud project and secrets

Open **Cloud Shell** in the Google Cloud Console (terminal icon).
Set the project ID from step 1:

```bash
export PROJECT_ID="REPLACE_WITH_YOUR_ACTUAL_PROJECT_ID"
export REGION="europe-west3"
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud iam service-accounts create abdallah-run-test \
  --display-name="ABDALLAH ERP Cloud Run test runtime"
export RUN_SA="abdallah-run-test@$PROJECT_ID.iam.gserviceaccount.com"
```

For new secrets, use the same Aiven URL used by the safe initializer; do not
include weak `sslmode=require` settings. With the database URL available in a
local shell variable `DATABASE_URL`:

```bash
printf '%s' "$DATABASE_URL" |
  gcloud secrets create abdallah-test-database-url --data-file=-
unset DATABASE_URL
openssl rand -hex 48 |
  gcloud secrets create abdallah-test-session-secret --data-file=-
gcloud secrets create abdallah-test-aiven-ca --data-file=ca.pem

for secret in abdallah-test-database-url abdallah-test-session-secret abdallah-test-aiven-ca; do
  gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:$RUN_SA" \
    --role="roles/secretmanager.secretAccessor"
done
```

Use the original URL without inline TLS query settings. At runtime the app
uses `PGSSLROOTCERT` to load the mounted Aiven CA and verify server identity.
If adding secret versions to an existing project instead of creating new
secrets, use `gcloud secrets versions add` deliberately (the above create
commands refuse duplicate secret names). Limit who can read the secrets.

## 4. Build and deploy Cloud Run from this branch

Use the exact project branch `deployment/cloud-run-free-tier`. For a
**private GitHub repository**, authenticate your GitHub account in Cloud
Shell using a GitHub-approved SSH key or `gh auth login`, then:

```bash
git clone --branch deployment/cloud-run-free-tier \
  https://github.com/Hassan-Merhi/ABDALLAH-SYSTEM.git
cd ABDALLAH-SYSTEM

gcloud run deploy abdallah-erp-test \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --service-account "$RUN_SA" \
  --allow-unauthenticated \
  --ingress all \
  --cpu 1 \
  --memory 2Gi \
  --min-instances 0 \
  --max-instances 1 \
  --concurrency 10 \
  --timeout 900 \
  --port 8080 \
  --set-env-vars "NODE_ENV=production,NODE_OPTIONS=--max-old-space-size=1152,MEMORY_SOFT_RSS_MB=1400,MEMORY_HARD_RSS_MB=1750,PG_POOL_MAX=3,PG_POOL_MIN=0,PG_SESSION_POOL_MAX=1,PG_IDLE_TIMEOUT_MS=30000,ENABLE_SCHEDULERS=false,RUN_STARTUP_MIGRATIONS=true,CSRF_ENFORCE=1,PGSSLROOTCERT=/secrets/aiven-ca.pem" \
  --set-secrets "DATABASE_URL=abdallah-test-database-url:1,SESSION_SECRET=abdallah-test-session-secret:1,/secrets/aiven-ca.pem=abdallah-test-aiven-ca:1"
```

`gcloud run deploy --source .` uses `Dockerfile`, Cloud Build and Artifact
Registry. It may take longer and cost more than a smaller Node.js project
because this repository has many dependencies and native packages.

**Important**: `--allow-unauthenticated` exposes your ERP's login page and
HTTP routes publicly; the application must enforce auth and role isolation.
Use only disposable test accounts and test data until independently verified.
Cloud Run scales to 0, only one instance is allowed for cost control, and
WebSockets will reconnect approximately every 15 minutes because their
requests time out. Higher max counts, minimum instances and always-on CPU can
exceed the free tier.

## 5. Verify before anyone uses it

From the returned HTTPS URL:

```bash
curl -fsS "https://YOUR-CLOUD-RUN-URL/api/health/ready"
curl -fsS "https://YOUR-CLOUD-RUN-URL/api/health/db"
```

**Go/no-go:** `/api/health/db` must report `migrations.completed=true`,
`migrations.skipped=false`, `migrations.failureCount=0`, while readiness
must return success. Check Cloud Logging for errors and actual memory usage.
Then provision a **test** admin/company via the approved ERP setup process,
and test login, company isolation, basic inventory, invoice/posting, session
persistence, PDFs and WebSocket reconnects. If this fails, do not treat a
successful container build as evidence of full ERP readiness.

**Files:** Cloud Run local disk is ephemeral. Files stored under uploads or
other local directories are **lost when instances stop**. This test setup
does not configure permanent cloud object storage. Avoid real document
uploads. Chromedriver/Chromium is not installed, so browser-based carrier
scraping is unavailable. Background schedulers are disabled because request-
based Cloud Run CPU is not suitable for regular timer-driven work.

**Data:** Aiven Free is not HA and can be suspended for inactivity.
Maintain independently restorable backups for anything important. Do not
restore the full live ERP database or production financial records into the
1 GB Aiven Free test service.

## Next steps outside this repository

Actual deployment requires your Google Cloud project and billing, Aiven
Free account, authentication of private GitHub source, creation of secrets,
and completing the first-time database initialization. None of those actions
can be accomplished by committing source files alone.

Official guides:
- https://docs.cloud.google.com/run/docs/deploying-source-code
- https://docs.cloud.google.com/run/docs/configuring/services/secrets
- https://aiven.io/docs/products/postgresql/concepts/pg-free-tier
- https://aiven.io/docs/products/postgresql/howto/connect-node
