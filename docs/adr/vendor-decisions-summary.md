# Vendor Decisions Summary — Gate A

**Date recorded:** 2026-05-17  
**Decider:** David Muller  
**Gate:** Gate A (Day 30)  
**Status:** Decisions made — actions pending (see each ADR)

---

## Decision Register

| Decision | ADR | Vendor | Free Tier | EU Residency | DPA Required | DPA Status | ROPA Entry |
|---|---|---|---|---|---|---|---|
| Cloud provider | ADR-001 | Railway (EU West / Amsterdam) | Yes (trial credit) | Yes | Yes | Pending — DM to obtain | Pending — GR |
| Object storage | ADR-001 (note) | Cloudflare R2 (EU) | Yes (10 GB / 1M reads) | Yes (EU localization) | Yes | Pending — DM to obtain | Pending — GR |
| Redis | ADR-001 (note) | Railway managed Redis | Yes (included) | Yes (EU West) | Covered by Railway DPA | — | — |
| Secret store | ADR-002 | Doppler (EU region) | Yes (Developer plan) | Yes | Yes | Pending — DM to obtain | Pending — GR |
| Email provider | ADR-003 | Brevo (Paris, France) | Yes (300/day) | Yes (French company) | Yes (self-service EU) | Pending — GR to confirm | Pending — GR |

---

## Outstanding Actions Before Gate A (D10 / D11)

### David Muller
- [ ] Create Railway account → provision EU West project → enable pgvector on managed Postgres → provision Redis → obtain Railway DPA
- [ ] Create Cloudflare R2 bucket (EU jurisdiction) → obtain Cloudflare DPA
- [ ] Create Doppler account → configure EU region → create `praxisa` project with `staging` / `production` configs → install Railway sync → obtain Doppler DPA
- [ ] Create Brevo account → select EU data region → verify sender domain (SPF/DKIM/DMARC) → store API key in Doppler → confirm DPA acceptance
- [ ] Lock Railway region in IaC (Terraform) at provider level before first `terraform apply`
- [ ] Write secret rotation runbook: `/docs/runbooks/secret-rotation.md`

### Gerome Ricour
- [ ] Review Railway DPA → sign off that it satisfies GDPR sub-processor requirements
- [ ] Add all five vendors to ROPA as sub-processors (Railway, Cloudflare R2, Doppler, Brevo)
- [ ] Confirm Brevo is listed in Praxisa's privacy notice
- [ ] Ensure no personal data enters any vendor environment until DPAs are confirmed

---

## Backlog Task Cross-Reference

| Backlog Task | Covered By |
|---|---|
| D10 — Provision EU staging and production landing zones | Railway ADR-001 + actions above |
| D11 — Enable secrets management, KMS, and centralized audit logging | Doppler ADR-002 + actions above |
| D05 — GDPR baseline matrix (processors) | Brevo ADR-003 + ROPA entries for all vendors |

---

## Notes

- pgvector is available on Railway managed PostgreSQL by running `CREATE EXTENSION vector;` in the first migration. No separate vector database is required.
- BullMQ workers use Railway managed Redis — no separate Redis provider needed.
- Cloudflare R2 is S3-compatible; the object storage adapter uses the AWS SDK v3 with a custom endpoint. No Cloudflare-specific SDK required.
- All vendor API keys go into Doppler before the first staging deploy. No exceptions.
