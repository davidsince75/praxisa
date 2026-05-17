# ADR-003: Transactional Email Provider — Brevo

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-05-17 |
| Decider | David Muller |
| Stakeholder | Gerome Ricour |
| Review Gate | Gate A (Day 30) |
| Supersedes | — |

---

## Context

The build manual (§05, §14) requires a transactional email provider for the `comms` module (enrollment notifications, messaging reminders, template-driven admin communications, DSR acknowledgements). Requirements:

- EU data residency — personal data (recipient email addresses, student names in templates) must be processed and stored in the EU, or Standard Contractual Clauses must be in place with documented transfer impact assessment
- GDPR DPA available from the provider
- Provider must be pluggable — isolated behind an adapter interface in the `comms` module; no direct SDK calls outside the adapter
- Free tier required for demo/staging
- Template management support (for the `message_templates` entity in §05)
- Delivery logs accessible via API (maps to the `delivery_logs` entity)

---

## Decision

**Brevo** (formerly Sendinblue) is selected as the transactional email provider.

- **Headquarters:** Paris, France
- **Data processing:** EU-only by default. Brevo is an EU company; no SCCs or transfer impact assessment required for EU→EU processing.
- **Plan:** Free (300 emails/day, unlimited contacts, transactional email API)
- **Template management:** Yes — Brevo template editor with API-driven variable substitution
- **Delivery logs:** Yes — Brevo provides webhook events (delivered, bounced, opened, spam) and API log retrieval. These will populate `delivery_logs` in the application DB.
- **GDPR DPA:** Available and pre-signed under Brevo's standard DPA for EU customers.

---

## Alternatives Considered

| Option | HQ / Data Location | SCC Required | Free Tier | Reason Rejected |
|---|---|---|---|---|
| **Resend** | USA (Delaware) | Yes — TIA required | Yes (100/day) | US-headquartered; SCC + transfer impact assessment required. Lower free tier volume. |
| **Postmark** | USA | Yes — TIA required | Yes (100/month trial) | US-headquartered; trial only, not ongoing free tier. |
| **Mailgun** | USA (Rackspace) | Yes — TIA required | No ongoing free tier | US-headquartered; no free tier for ongoing use. |
| **Amazon SES (EU)** | AWS EU Frankfurt | Formal SCC review needed | Near-free ($0.10/1k) | Adds AWS dependency; SCC chain for AWS EU still requires TIA under Schrems II analysis. Operational overhead disproportionate for demo scale. |
| **Mailtrap (sandbox only)** | EU | N/A | Yes | Sandbox/testing tool only — cannot send real emails to students. Appropriate for local dev email catching but not for staging/production. |

---

## Consequences

**Accepted trade-offs:**
- Brevo free tier is capped at 300 emails/day. At current scale (~158 students), this is sufficient for demo and early staging. If volume exceeds this (e.g., bulk enrollment notifications), upgrade to Starter plan (~€19/month). This threshold must be monitored.
- Brevo's template editor uses its own variable syntax (`{{ params.variable_name }}`). The `comms` module adapter must translate between the internal `message_templates` schema and Brevo's template format. This is an adapter responsibility — the domain layer is unaware of Brevo's syntax.

**Actions required before Gate A:**
- [ ] David Muller: Create Brevo account. Select EU data region during account setup. Obtain API key and store in Doppler (`BREVO_API_KEY`).
- [ ] David Muller: Confirm Brevo DPA is accepted (available at [brevo.com/legal/termsofuse](https://www.brevo.com/legal/termsofuse) — DPA is incorporated for EU customers).
- [ ] David Muller: Configure sender domain (SPF, DKIM, DMARC) before first email is sent from staging. Do not send from unverified domain.
- [ ] David Muller: Implement Brevo webhook endpoint in the `comms` module to receive delivery events and write to `delivery_logs`.
- [ ] Gerome Ricour: Add Brevo to ROPA as a sub-processor. Processing purpose: transactional email delivery. Personal data categories: email address, name (in templates). Legal basis: contract performance / legitimate interest (communications).
- [ ] Gerome Ricour: Confirm Brevo is listed in Praxisa's privacy notice as an email delivery sub-processor.

---

## Adapter Interface

The email adapter in `packages/comms` must implement the following interface. No other code in the codebase may call Brevo's SDK directly.

```typescript
interface EmailAdapter {
  sendTransactional(params: {
    to: { email: string; name?: string };
    templateId: string;
    variables: Record<string, string>;
    attachments?: { name: string; content: string; contentType: string }[];
    idempotencyKey: string;
  }): Promise<{ messageId: string; provider: string }>;

  getDeliveryStatus(messageId: string): Promise<DeliveryStatus>;
}
```

The `idempotencyKey` field maps to Brevo's `X-Mailin-custom` header for deduplication. Provider is always `'brevo'` in this implementation but the interface supports future provider swap without domain layer changes.

---

## Compliance Notes

- Email addresses are personal data under GDPR. Brevo must be listed in the ROPA before any real email address enters the system.
- Brevo's DPA is self-service for EU customers (no negotiation required). Confirm acceptance before connecting staging environment.
- Unsubscribe handling: any bulk or marketing-adjacent communication must honour `list-unsubscribe`. Transactional emails (enrollment confirmations, payment receipts, DSR responses) are exempt but must be clearly transactional in nature — not used for marketing.
- Delivery log retention: `delivery_logs` records are subject to the retention policy defined in D05. Brevo's own log retention (30 days on free tier) is shorter than application-level retention requirements. The application DB is the authoritative record for delivery logs — not Brevo's dashboard.
