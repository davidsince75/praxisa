# Staging Environment — Doppler → Railway

All secrets are managed in Doppler (project: `praxisa`, config: `stg`).
Railway pulls them at deploy time via the Doppler → Railway integration.

## Setup steps

1. In Doppler: create project `praxisa`, config `stg`.
2. In Railway: install the Doppler integration and link it to the `staging` environment.
3. Add `RAILWAY_TOKEN` as a GitHub Actions secret (Settings → Secrets → Actions).
4. Set every variable listed below in Doppler `stg`.

---

## API service (`apps/api`)

| Env var                  | Doppler secret           | Notes                                                   |
| ------------------------ | ------------------------ | ------------------------------------------------------- |
| `NODE_ENV`               | `NODE_ENV`               | Set to `staging`                                        |
| `PORT`                   | —                        | Railway injects `PORT` automatically                    |
| `LOG_LEVEL`              | `LOG_LEVEL`              | `info` for staging                                      |
| `DATABASE_URL`           | `DATABASE_URL`           | Railway Postgres plugin injects this automatically      |
| `REDIS_URL`              | `REDIS_URL`              | Railway Redis plugin injects this automatically         |
| `CORS_ORIGINS`           | `CORS_ORIGINS`           | Comma-separated list, e.g. `https://staging.praxisa.fr` |
| `APP_BASE_URL`           | `APP_BASE_URL`           | e.g. `https://staging.praxisa.fr`                       |
| `JWT_SIGNING_KEY`        | `JWT_SIGNING_KEY`        | Base64-encoded Ed25519 private key (PEM)                |
| `JWT_SIGNING_KEY_PUBLIC` | `JWT_SIGNING_KEY_PUBLIC` | Base64-encoded Ed25519 public key (PEM)                 |
| `BREVO_API_KEY`          | `BREVO_API_KEY`          | Brevo v3 API key                                        |
| `BREVO_SENDER_EMAIL`     | `BREVO_SENDER_EMAIL`     | e.g. `noreply@staging.praxisa.fr`                       |
| `BREVO_SENDER_NAME`      | `BREVO_SENDER_NAME`      | e.g. `Praxisa Staging`                                  |
| `MISTRAL_API_KEY`        | `MISTRAL_API_KEY`        | Optional — AI features disabled if absent               |

### Generating JWT keys

```bash
# Generate an Ed25519 key pair
openssl genpkey -algorithm ed25519 -out jwt_private.pem
openssl pkey -in jwt_private.pem -pubout -out jwt_public.pem

# Base64-encode for Doppler
base64 -w0 jwt_private.pem   # → JWT_SIGNING_KEY
base64 -w0 jwt_public.pem    # → JWT_SIGNING_KEY_PUBLIC
```

---

## Workers service (`apps/workers`)

| Env var              | Doppler secret       | Notes                          |
| -------------------- | -------------------- | ------------------------------ |
| `NODE_ENV`           | `NODE_ENV`           | Set to `staging`               |
| `LOG_LEVEL`          | `LOG_LEVEL`          | `info` for staging             |
| `DATABASE_URL`       | `DATABASE_URL`       | Same Railway Postgres as API   |
| `REDIS_URL`          | `REDIS_URL`          | Same Railway Redis as API      |
| `BREVO_API_KEY`      | `BREVO_API_KEY`      | Same Brevo key as API          |
| `BREVO_SENDER_EMAIL` | `BREVO_SENDER_EMAIL` | Same as API                    |
| `BREVO_SENDER_NAME`  | `BREVO_SENDER_NAME`  | Same as API                    |
| `ADMIN_ALERT_EMAIL`  | `ADMIN_ALERT_EMAIL`  | DSR SLA breach alert recipient |

---

## Railway infrastructure

| Resource      | Railway plugin   | Notes                                                                             |
| ------------- | ---------------- | --------------------------------------------------------------------------------- |
| PostgreSQL 16 | Railway Postgres | Enable `pgvector`, `uuid-ossp`, `citext`, `pg_trgm` extensions after first deploy |
| Redis 7       | Railway Redis    | Used by BullMQ for job queues                                                     |

### Enabling Postgres extensions after first deploy

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;
```

Run this once via Railway's Postgres shell or `psql` with the `DATABASE_URL`.
Migrations (`0001`–`0004`) run automatically on API container start.

---

## GitHub Actions secret

| Secret name                   | Value                                                          |
| ----------------------------- | -------------------------------------------------------------- |
| `RAILWAY_TOKEN`               | Railway project token (Settings → Tokens in Railway dashboard) |
| `JWT_SIGNING_KEY_TEST`        | Base64-encoded Ed25519 private key for CI test runs            |
| `JWT_SIGNING_KEY_PUBLIC_TEST` | Base64-encoded Ed25519 public key for CI test runs             |
