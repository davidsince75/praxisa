# Production Environment — Doppler → Railway

All secrets are managed in Doppler (project: `praxisa`, config: `prd`).
Railway pulls them at deploy time via the Doppler → Railway integration.

> **Before going live** complete the pre-launch checklist in
> `docs/runbooks/restore-drill.md` and verify all items in the staging
> smoke-test pass against the production URL.

## Setup steps

1. In Doppler: duplicate config `stg` → `prd` and update every value for production.
2. In Railway: create a new environment named `production` in the same project.
3. Install the Doppler integration on the `production` environment and link it to
   the `prd` Doppler config.
4. Add `RAILWAY_TOKEN_PROD` as a GitHub Actions secret (separate token scoped to
   the production environment).
5. Set `RAILWAY_ENVIRONMENT` to `production` in the GitHub Actions `production`
   environment variables (Settings → Environments → production → Variables).

---

## API service (`apps/api`)

| Env var                  | Doppler secret           | Notes                                                     |
| ------------------------ | ------------------------ | --------------------------------------------------------- |
| `NODE_ENV`               | `NODE_ENV`               | Set to `production`                                       |
| `PORT`                   | —                        | Railway injects `PORT` automatically                      |
| `LOG_LEVEL`              | `LOG_LEVEL`              | `warn` for production (reduce noise, keep errors)         |
| `DATABASE_URL`           | `DATABASE_URL`           | Railway Postgres plugin injects this automatically        |
| `REDIS_URL`              | `REDIS_URL`              | Railway Redis plugin injects this automatically           |
| `CORS_ORIGINS`           | `CORS_ORIGINS`           | `https://app.praxisa.fr` (no trailing slash, no wildcard) |
| `APP_BASE_URL`           | `APP_BASE_URL`           | `https://app.praxisa.fr`                                  |
| `JWT_SIGNING_KEY`        | `JWT_SIGNING_KEY`        | **New key pair — never reuse staging keys in production** |
| `JWT_SIGNING_KEY_PUBLIC` | `JWT_SIGNING_KEY_PUBLIC` | Base64-encoded Ed25519 public key (PEM)                   |
| `BREVO_API_KEY`          | `BREVO_API_KEY`          | Production Brevo API key (separate from staging)          |
| `BREVO_SENDER_EMAIL`     | `BREVO_SENDER_EMAIL`     | `noreply@praxisa.fr`                                      |
| `BREVO_SENDER_NAME`      | `BREVO_SENDER_NAME`      | `Praxisa`                                                 |
| `MISTRAL_API_KEY`        | `MISTRAL_API_KEY`        | Optional — AI features disabled if absent                 |

### Generating production JWT keys

```bash
openssl genpkey -algorithm ed25519 -out prod_jwt_private.pem
openssl pkey -in prod_jwt_private.pem -pubout -out prod_jwt_public.pem

base64 -w0 prod_jwt_private.pem   # → JWT_SIGNING_KEY (Doppler prd)
base64 -w0 prod_jwt_public.pem    # → JWT_SIGNING_KEY_PUBLIC (Doppler prd)

# Delete local key files after uploading — do not commit
rm prod_jwt_private.pem prod_jwt_public.pem
```

---

## Workers service (`apps/workers`)

| Env var              | Doppler secret       | Notes                                      |
| -------------------- | -------------------- | ------------------------------------------ |
| `NODE_ENV`           | `NODE_ENV`           | Set to `production`                        |
| `LOG_LEVEL`          | `LOG_LEVEL`          | `warn`                                     |
| `DATABASE_URL`       | `DATABASE_URL`       | Same Railway Postgres as API               |
| `REDIS_URL`          | `REDIS_URL`          | Same Railway Redis as API                  |
| `BREVO_API_KEY`      | `BREVO_API_KEY`      | Same production Brevo key as API           |
| `BREVO_SENDER_EMAIL` | `BREVO_SENDER_EMAIL` | `noreply@praxisa.fr`                       |
| `BREVO_SENDER_NAME`  | `BREVO_SENDER_NAME`  | `Praxisa`                                  |
| `ADMIN_ALERT_EMAIL`  | `ADMIN_ALERT_EMAIL`  | DPO inbox — receives DSR SLA breach alerts |

---

## Railway infrastructure

| Resource      | Railway plugin   | Notes                                                     |
| ------------- | ---------------- | --------------------------------------------------------- |
| PostgreSQL 16 | Railway Postgres | Enable extensions after first deploy (see below)          |
| Redis 7       | Railway Redis    | Used by BullMQ for job queues and API rate-limit counters |

### Enabling Postgres extensions (run once after first deploy)

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
```

Run via Railway's Postgres shell or `psql "$DATABASE_URL"`.

### Running migrations against production

Migrations run automatically on API container start (`db/migrate.ts`).
To run manually:

```bash
DATABASE_URL="<prod_url>" pnpm db:migrate
```

Always take a manual snapshot in Railway before running migrations on
production for the first time.

---

## CI/CD — promoting to production

The current CI pipeline deploys to staging on every `main` push.
Production promotion is **manual** to prevent accidental deploys.

### Option A — GitHub Actions manual trigger (recommended)

Add a `workflow_dispatch` job to `.github/workflows/ci.yml` that targets
`RAILWAY_ENVIRONMENT=production` and requires the `production` environment
approval gate in GitHub (Settings → Environments → production → Required reviewers).

### Option B — Railway one-shot deploy

```bash
npm install -g @railway/cli
railway login
railway up --service api --environment production --detach
railway up --service workers --environment production --detach
```

---

## Pre-launch checklist

- [ ] Doppler `prd` config populated and verified (no empty secrets)
- [ ] Production JWT key pair generated, uploaded, local files deleted
- [ ] Postgres extensions enabled on production database
- [ ] Migrations applied cleanly (`db:migrate` exits 0)
- [ ] `/health` returns `{"status":"ok"}` from production URL
- [ ] `/ready` returns `{"status":"ok"}` (DB + Redis reachable)
- [ ] Smoke test: register → login → consent → DSR request flow
- [ ] Restore drill completed (see `docs/runbooks/restore-drill.md`)
- [ ] `ADMIN_ALERT_EMAIL` is the DPO inbox, not a personal address
- [ ] Brevo sender domain `praxisa.fr` DNS verified (SPF + DKIM)
