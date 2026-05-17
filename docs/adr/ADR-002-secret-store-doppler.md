# ADR-002: Secret Store — Doppler

| Field       | Value           |
| ----------- | --------------- |
| Status      | Accepted        |
| Date        | 2026-05-17      |
| Decider     | David Muller    |
| Stakeholder | Gerome Ricour   |
| Review Gate | Gate A (Day 30) |
| Supersedes  | —               |

---

## Context

The build manual (§03, §08) requires a dedicated secret store with the following properties:

- No secrets in source code, committed `.env` files, or CI logs — hard requirement
- Application retrieves secrets at startup via SDK; no build-time secret injection
- Rotation runbooks must exist for: DB credentials, Mistral AI API key, GoCardless API key, JWT signing keys, object storage credentials
- CI/CD pipelines use scoped short-lived tokens only
- Secret store must be in EU region or have EU data residency guarantees
- A separate secret store ADR must be written and committed before first credentials are generated (§03)

For the demo and staging phase, a free tier is required.

---

## Decision

**Doppler** is selected as the secret store.

- **Plan:** Developer (free — unlimited secrets, unlimited projects, 1 user)
- **EU residency:** Doppler stores secrets encrypted at rest using AES-256. Data residency region can be configured; EU region selected.
- **Integration:** Native Railway sync — Doppler injects secrets directly into Railway service environments at deploy time via the Doppler Railway integration. No secrets pass through CI logs.
- **Rotation:** Doppler supports webhook-triggered rotation hooks. Rotation runbooks (§12) will reference Doppler CLI commands for each secret type.

---

## Alternatives Considered

| Option                            | Free Tier               | EU Residency      | Self-Hosted Option | Reason Rejected                                                                                                                                                                     |
| --------------------------------- | ----------------------- | ----------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **HashiCorp Vault (self-hosted)** | Yes (open source)       | Yes (you control) | Yes                | Adds operational overhead (managing Vault HA, unsealing, backups) that is disproportionate for a single-developer demo. Remain viable for production if Doppler becomes unsuitable. |
| **Infisical**                     | Yes (cloud free tier)   | Yes (EU region)   | Yes                | Functionally comparable to Doppler; Railway native sync is marginally better documented for Doppler at this time. Revisit if Doppler free plan limits are hit.                      |
| **AWS Secrets Manager**           | No meaningful free tier | Yes               | No                 | Cost and AWS dependency not justified at demo stage.                                                                                                                                |
| **Committed `.env` files**        | N/A                     | N/A               | N/A                | Explicitly prohibited by build manual §03. Not an option.                                                                                                                           |

---

## Consequences

**Accepted trade-offs:**

- Doppler Developer plan is limited to 1 user. When a second team member is added, upgrade to Team plan (~$6/user/month) is required.
- Doppler is a third-party SaaS. A DPA must be obtained before any production secrets (particularly those that could decrypt personal data, such as DB credentials or JWT signing keys) are stored.
- If Doppler experiences an outage, application startups will fail until secrets are available. Mitigation: Railway's environment variable cache means running containers are unaffected; only new deploys fail. Accept this risk at demo/staging scale.

**Actions required before Gate A (D11):**

- [ ] David Muller: Create Doppler account. Configure EU data region. Create `praxisa` project with `staging` and `production` configs.
- [ ] David Muller: Install Doppler Railway integration. Verify secrets inject correctly into a test Railway service before first real credential is stored.
- [ ] David Muller: Obtain Doppler DPA — available at [doppler.com/legal/dpa](https://www.doppler.com/legal/dpa). Confirm EU processing.
- [ ] David Muller: Write rotation runbook entries in `/docs/runbooks/secret-rotation.md` covering: DB credentials, Mistral AI API key, GoCardless API key, JWT signing key, R2 object storage credentials. Each entry must reference the Doppler CLI command sequence.
- [ ] Gerome Ricour: Add Doppler to ROPA as a sub-processor (it processes encryption keys that protect personal data).

---

## Secret Naming Convention

All secrets in Doppler follow this naming scheme to avoid ambiguity across environments:

```
DATABASE_URL                  # PgBouncer connection string
REDIS_URL                     # Upstash/Railway Redis URL
MISTRAL_API_KEY               # Mistral AI API key
GOCARDLESS_ACCESS_TOKEN       # GoCardless live/sandbox token
JWT_SIGNING_KEY               # RS256 private key (PEM, base64-encoded)
JWT_SIGNING_KEY_PUBLIC        # RS256 public key (PEM, base64-encoded)
R2_ACCESS_KEY_ID              # Cloudflare R2 access key
R2_SECRET_ACCESS_KEY          # Cloudflare R2 secret key
R2_BUCKET_NAME                # Cloudflare R2 bucket name
R2_ENDPOINT                   # Cloudflare R2 S3-compatible endpoint
```

Staging and production configs in Doppler are kept separate. No production secret ever appears in a staging config.

---

## Compliance Notes

- Doppler DPA must be signed before any credential that could decrypt personal data is stored (i.e., before DATABASE_URL is added).
- Doppler must be listed in the ROPA as a sub-processor handling encryption key material.
- CI/CD pipelines must use Doppler service tokens scoped to a single environment (staging or production). No cross-environment tokens.
