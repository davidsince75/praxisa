# ADR-001: Cloud Provider — Railway (EU)

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

The Praxisa platform requires a cloud hosting environment that satisfies the following hard constraints from the build manual (§01, §03, §06):

- EU data residency for all personal data, backups, and compute
- Managed PostgreSQL with pgvector extension support
- Managed Redis (session tokens, rate-limit counters, AI prompt cache)
- Container-based deployment for the Node.js API monolith and BullMQ workers
- IaC parameterized by region (must not preclude future cross-region failover)
- GDPR DPA available from the provider
- Minimal operational overhead appropriate for a single-developer team at current scale (~158 students)

For the initial demo and staging environment, a free tier is required to avoid spend before client sign-off.

---

## Decision

**Railway** is selected as the primary cloud provider for the demo and staging environment.

- **Region:** EU West (Amsterdam, `eu-west`) — Frankfurt was not available at provisioning time; Amsterdam (Netherlands, EU member state) satisfies GDPR data residency requirements equivalently.
- **Services used:**
  - Managed PostgreSQL (with pgvector enabled via `CREATE EXTENSION vector;`)
  - Managed Redis
  - Container deployments for API and BullMQ workers
- **Plan:** Hobby (free trial credit; upgrade to Pro for production)

---

## Alternatives Considered

| Option                       | EU Region                  | pgvector                    | Redis              | Free Tier        | Reason Rejected                                                                    |
| ---------------------------- | -------------------------- | --------------------------- | ------------------ | ---------------- | ---------------------------------------------------------------------------------- |
| **Fly.io**                   | Yes (Amsterdam, Frankfurt) | Via managed Postgres add-on | Via Upstash add-on | Yes (limited)    | More complex multi-service wiring; Postgres extension support less straightforward |
| **Render**                   | Yes (Frankfurt)            | Yes (managed Postgres)      | Yes                | Yes (spins down) | Free tier spins down after inactivity — unacceptable for demo stability            |
| **Supabase**                 | Yes (Frankfurt)            | Yes (native)                | No native Redis    | Yes              | No native Redis; would require a second provider for Redis                         |
| **AWS EU (Paris/Frankfurt)** | Yes                        | Yes (RDS)                   | Yes (ElastiCache)  | No               | No meaningful free tier; premature operational complexity at current scale         |
| **OVHcloud**                 | Yes (French)               | Possible                    | Possible           | Limited          | Managed services less mature; more setup friction for a demo timeline              |

---

## Consequences

**Accepted trade-offs:**

- Railway's free trial credit is limited (~$5). Production will require upgrading to Railway Pro (~$20/month base). This is acceptable; the decision must be revisited before Gate C.
- Railway does not provide a native object storage service. Course document storage and export files require a separate solution. **Cloudflare R2** (free tier: 10 GB, 1M reads/month; GDPR-compliant with EU data localization) is designated as the object storage provider. A separate ADR is not required at this stage; R2 usage is noted here.
- Railway's managed PostgreSQL backup schedule must be verified against the RPO target (≤1 hour) before Gate C. WAL archiving availability needs confirmation from Railway documentation before the restore drill (D17).

**Actions required before Gate A (D10):**

- [ ] David Muller: Create Railway account, provision EU West project, enable PostgreSQL with pgvector extension, provision Redis instance.
- [ ] David Muller: Obtain Railway DPA — available at [railway.app/legal/dpa](https://railway.app/legal/dpa). Confirm EU processing locations.
- [ ] David Muller: Lock region in IaC (Terraform) at provider level before any data environment is created.
- [ ] Gerome Ricour: Review Railway DPA and confirm it satisfies Praxisa's GDPR sub-processor requirements. Sign-off required before personal data enters any Railway environment.

**Object storage (Cloudflare R2):**

- [ ] David Muller: Create Cloudflare R2 bucket in EU jurisdiction. Confirm data localization policy. Obtain Cloudflare DPA.
- [ ] Gerome Ricour: Add Cloudflare to ROPA as a sub-processor.

---

## Compliance Notes

- Railway's DPA must be signed before any personal data (including test data derived from real student records) enters the environment.
- Staging environment must use synthetic data only (faker.js `fr` locale seeder) until DPA is signed and GDPR baseline (D05) is complete.
- IaC region lock must be committed before the first `terraform apply` — region must not be configurable at runtime.
