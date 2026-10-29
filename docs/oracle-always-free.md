# Oracle Cloud Always Free deployment — ABDALLAH-SYSTEM

**Status: deployment preparation only.** Do not connect real accounting data until the
ARM64 workflow passes, a trusted initial schema is restored, first-boot migrations
complete without unexplained errors, and a backup/restore test succeeds.

This runbook is for the dedicated ABDALLAH-SYSTEM ERP repository, not the
original ERP + Factory environment. Hiding non-ERP modes in the UI does not
automatically remove their database tables or startup migration code.

## 1. Verified project facts and remaining gaps

- Frontend: React/Vite. API: Express/Node.js. Data: PostgreSQL/Drizzle.
- Node version is pinned in `.node-version` to **24.22.1**.
- The committed lockfile includes Linux ARM64 GNU builds of canvas, esbuild,
  Rolldown, Lightning CSS and Tailwind native dependencies.
- The native Linux ARM64 build and canvas smoke test **passed** in the first
  `Oracle ARM64 readiness` GitHub Actions run (2026-10-29). New commits must
  pass again; functional production readiness still requires database validation.
- A truly empty database is **not** self-bootstrapping via application startup:
  `docs/fresh-db-bootstrap.md` identifies missing foundational tables.
- `drizzle-kit push --force` is restricted to disposable CI or the new
  fail-closed **one-time empty-database bootstrap**. **Never** run it after
  runtime migration or against existing/persistent ERP data: runtime-only
  tables, sequences and production schema drift can make it destructive.
- Existing startup verification documents known first-boot failures; a valid
  core schema is a prerequisite, **not** a promise that all application startup
  DDL will pass. Inspect `/api/health/db` for `failureCount` and `skipped`.

## 2. Create an Always Free OCI VM

In the OCI Console, create `VM.Standard.A1.Flex` in the tenancy's **home
region**, using an **Always Free-eligible Ubuntu 24.04 ARM64** image. Start
with **2 OCPUs and 12 GiB RAM**, a roughly **80–100 GiB** boot volume and an
SSH public key. Check Oracle's current allocation and the **200 GiB combined
block-volume** allowance in the console before creating resources; the VM is
not guaranteed to be available in every region.

Set a public IP. In the VCN security list/network security group allow inbound
**TCP 80 and 443** from the internet, and **TCP 22** only from the administrator's
known IP. **Do not expose PostgreSQL (5432) or Express (5000).** The Ubuntu
host firewall must also permit 80/443 while restricting 5432/5000.

Oracle can reclaim idle Always Free instances. Keep **off-instance backups**;
never rely solely on the instance's boot disk or its survival.

## 3. Install software

SSH as `ubuntu` and run:

```bash
sudo apt update
sudo apt install -y git caddy build-essential
```

Install **Node.js 24.22.1 for user ubuntu** using the official
[Node.js downloads](https://nodejs.org/en/download) / [nvm](https://github.com/nvm-sh/nvm)
instructions. Verify:

```bash
node --version                 # v24.22.1
uname -m                       # aarch64
```

Create a read-only GitHub SSH deploy key for this private repository and clone
it to the expected path:

```bash
cd /home/ubuntu
git clone git@github.com:Hassan-Merhi/ABDALLAH-SYSTEM.git
cd ABDALLAH-SYSTEM
npm ci --include=optional --no-audit
node scripts/oracle-arm64-check.mjs
npm run build
```

Clone the branch under review for testing, or merge it before final deployment.
Avoid copying `node_modules` built on x64 to the ARM machine.

## 4. Set up PostgreSQL on the same VM

The source ERP PostgreSQL database was read-only inspected on 2026-10-29 and
runs **PostgreSQL 18.3**. Match its major version when restoring a schema dump:
Ubuntu 24.04's default package is older. Install version 18 from the
[official PostgreSQL APT repository](https://www.postgresql.org/download/linux/ubuntu/):

```bash
sudo apt install -y postgresql-common ca-certificates
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh
sudo apt update
sudo apt install -y postgresql-18 postgresql-client-18
pg_lsclusters
```

Keep PostgreSQL 18 bound to localhost and verify that its cluster is online on
port 5432. Create a dedicated login and database (you will be prompted for a
password):

```bash
sudo -u postgres createuser --pwprompt abdallah
sudo -u postgres createdb --owner=abdallah abdallah_erp
```

Generate a long random `SESSION_SECRET` locally. Store your credentials
**outside Git** in `/etc/abdallah-system/erp.env`, for example:

```dotenv
DATABASE_URL=postgresql://abdallah:URL_ENCODED_PASSWORD@127.0.0.1:5432/abdallah_erp
SESSION_SECRET=REPLACE_WITH_LONG_RANDOM_VALUE
NODE_ENV=production
PGSSLMODE=disable
ERP_BIND_HOST=127.0.0.1
PORT=5000
RUN_STARTUP_MIGRATIONS=true
```

URL-encode any special characters in the database password. PostgreSQL TLS is
disabled **only because traffic stays on the same VM at 127.0.0.1**. For remote
PostgreSQL, configure verified TLS instead.

```bash
sudo install -d -m 0750 -o root -g ubuntu /etc/abdallah-system
sudoedit /etc/abdallah-system/erp.env
sudo chown root:ubuntu /etc/abdallah-system/erp.env
sudo chmod 0640 /etc/abdallah-system/erp.env
```

For the one-time commands below, export the environment to the current shell
without echoing credentials to logs. Ensure the `ubuntu` user can read the file:

```bash
set -a
source /etc/abdallah-system/erp.env
set +a
node scripts/oracle-db-preflight.mjs --empty
```

## 5. Bootstrap a genuinely fresh database — critical

**Do not start the ERP directly on an empty database.** Runtime migrations
depend on foundational tables which the current source does not create.

For a *new* Oracle ERP database, get a **reviewed schema-only dump from an
existing compatible ERP database**. Use a trusted source connection with the
schema version corresponding to the code you will deploy:

```bash
pg_dump --schema-only --no-owner --no-acl --format=plain \
  --file=/private/path/abdallah-schema-only.sql "$SOURCE_DATABASE_URL"
```

This SQL contains no table rows, but may reveal database structure and defaults:
keep it private; never commit it. Review the output and ensure it belongs to
your own database. If your source schema includes owner-specific extensions or
roles, reconcile them *before* restoring.

Copy the trusted dump securely to the Oracle VM, then from the repository root:

```bash
node scripts/oracle-db-preflight.mjs --empty
bash deploy/oracle/restore-schema-baseline.sh \
  /private/path/abdallah-schema-only.sql
```

The restore script refuses nonempty public schemas, imports the SQL in **one
PostgreSQL transaction** using `ON_ERROR_STOP`, and checks that the key tables
exist. It does **not** touch a preexisting database. PostgreSQL only rolls back
the restore transaction; it cannot undo arbitrary external side effects from
untrusted SQL. Never execute a dump supplied by an unknown party.

**Alternative for a truly empty new database with no source schema dump:**
the guarded one-time bootstrap creates *only the Drizzle-declared foundational
tables* from the source definitions, then runtime migrations create more
tables when the ERP starts.

```bash
node scripts/oracle-db-preflight.mjs --empty
ORACLE_BOOTSTRAP_NEW_DATABASE=YES node scripts/oracle-bootstrap-empty-db.mjs
node scripts/oracle-db-preflight.mjs --ready
```

This is allowed **once, before any ERP startup or business data**, and only
on a newly created local database containing zero public relations.
The script refuses remote databases, maintenance databases and nonempty
databases. Never rerun Drizzle push after initialization. If it partially
fails, **discard and recreate the new database**; do not retry against a
partly created schema. Restore a vetted schema-only dump instead if one is
available.

The initial core-table check is **not full ERP readiness**. The runtime
migration pass still needs to complete with no unexpected failures before
real use, and full business smoke tests remain mandatory.

## 6. Start behind Caddy and systemd

Edit `deploy/oracle/abdallah-erp.service` if the repo or Node paths differ.
Then install it:

```bash
sudo cp deploy/oracle/abdallah-erp.service \
  /etc/systemd/system/abdallah-erp.service
sudo systemctl daemon-reload
sudo systemctl enable --now abdallah-erp
sudo journalctl -u abdallah-erp --no-pager -n 100
```

Point a DNS A record (for example, `erp.example.com`) to your OCI public IP.
Replace the hostname in `deploy/oracle/Caddyfile.example`, install as
`/etc/caddy/Caddyfile`, and reload:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Caddy serves HTTPS and forwards both the React frontend and Express API to
`127.0.0.1:5000`. Open ports 80/443 in **both** OCI and the VM firewall; keep
5000 private. Use a domain you own so Caddy can obtain a certificate.

## 7. Go/no-go verification before real use

From the VM, or a trusted workstation as appropriate:

```bash
node scripts/oracle-db-preflight.mjs --ready
curl -fsS http://127.0.0.1:5000/api/health/db
curl -fsS http://127.0.0.1:5000/api/health/ready
```

Before loading production transactions, confirm:

1. ARM64 GitHub workflow passes `npm ci`, canvas native smoke test and
   `npm run build`.
2. `/api/health/db` reports `migrations.completed=true`,
   `migrations.skipped=false`, and **zero unexplained failures**.
3. `/api/health/ready` returns a healthy response.
4. Login, company isolation, stock changes, voucher posting, export generation,
   and session persistence have been smoke-tested without factory mode access.
5. All uploaded file paths and any scheduled jobs required by the ERP are
   persistent, backed up and permitted by the host.
6. A backup **and a restore into a separate test database** have passed.

Do not treat the preflight's six-table check as full application readiness.

## 8. Backups and maintenance

Schedule `pg_dump --format=custom` at least daily, preferably more often
when financial data is changing. Encrypt and copy every backup to a different
host or off-instance object store, with access independent of this VM. Test
`pg_restore` into a scratch database regularly. Back up uploaded documents
separately; a PostgreSQL dump **does not contain uploaded files**.

Monitor free disk, memory, PostgreSQL availability, application logs, HTTPS
renewals and the OCI instance's status. Keep an emergency restore procedure
outside the VM. Oracle Always Free is **not** a high-availability SLA.

For existing production installations, never replace or reinitialize the
database under this deployment guide. Migrations require a separate, reviewed
data-migration and rollback plan.

## Official references

- [OCI Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [GitHub native ARM64 runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Caddy installation](https://caddyserver.com/docs/install)
- Project-specific bootstrap gap: [fresh-db-bootstrap.md](fresh-db-bootstrap.md)
