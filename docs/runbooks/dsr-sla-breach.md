# Runbook: DSR SLA Breach Alert

**Severity:** High (regulatory obligation)  
**Owner:** DPO (primary), Engineering on-call (secondary)  
**SLA:** GDPR Art. 12 — respond within 30 days of receipt  
**Alert trigger:** Request is 28+ days old and not yet `completed`

---

## What this runbook covers

The SLA monitor worker runs daily at 06:00 UTC. It queries for
`gdpr_requests` rows with `status IN ('pending', 'in_progress')` that are
older than 28 days. When found, it sends an alert email to `ADMIN_ALERT_EMAIL`
(the DPO inbox). This runbook covers how to respond to that alert.

---

## When you receive an SLA alert email

The email subject is:

```
[ACTION REQUIRED] N DSR request(s) approaching 30-day SLA
```

It lists each overdue request with: Request ID, User ID, Type, Opened At.

**You have at most 2 days to process or respond to each listed request**
before the 30-day deadline is breached.

---

## Step 1 — Triage each request

Query the current state:

```sql
SELECT
  r.id,
  r.user_id,
  r.type,
  r.status,
  r.created_at,
  r.notes,
  u.email
FROM gdpr_requests r
JOIN users u ON u.id = r.user_id
WHERE r.id IN ('<id1>', '<id2>');
```

For each request, determine:

| Status | Action |
|--------|--------|
| `pending` | Erasure worker hasn't run or has been failing — see erasure sweep runbook |
| `in_progress` | Sweep claimed it but failed — check worker logs for the `requestId` |
| `completed` | False alarm (monitor ran before completion timestamp propagated) — verify and close |

---

## Step 2 — Erasure requests (`type = 'erasure'`)

If the request is stuck `pending` or `in_progress`, follow
`docs/runbooks/dsr-erasure-sweep-failure.md`.

If the workers are healthy but the request hasn't been claimed, reset it:

```sql
UPDATE gdpr_requests
SET status = 'pending', updated_at = NOW()
WHERE id = '<requestId>'
  AND type = 'erasure';
```

The next sweep (within 60 s) will claim and process it.

---

## Step 3 — Access / portability requests (`type = 'access'` or `'portability'`)

These are not yet automated. Process manually:

1. Use the admin SAR export endpoint to retrieve the user's data:

   ```
   GET /v1/gdpr/users/:userId/export
   Authorization: Bearer <admin_token>
   ```

2. The response includes: user record, enrolments, lesson progress,
   policy consents, and the last 500 audit events.

3. Send the export to the user's registered email via a secure channel
   (encrypted attachment or secure download link).

4. Mark the request completed:

   ```sql
   UPDATE gdpr_requests
   SET status       = 'completed',
       completed_at = NOW(),
       completed_by = '<operator_user_id>',
       notes        = 'SAR export sent to user email on <date> by <operator>',
       updated_at   = NOW()
   WHERE id = '<requestId>';
   ```

---

## Step 4 — If the deadline cannot be met

GDPR Art. 12(3) permits a 2-month extension where requests are complex or
numerous. **This extension must be communicated to the data subject within
the original 30-day window.**

Draft and send an extension notice to the user explaining:
- That you received their request
- That you need additional time (up to 2 months)
- The reason for the delay
- Their right to lodge a complaint with the CNIL

Update the request notes:

```sql
UPDATE gdpr_requests
SET notes    = 'Extension notice sent to user on <date> — reason: <reason>',
    updated_at = NOW()
WHERE id = '<requestId>';
```

---

## Confirming resolution

After each request is processed, verify:

```sql
SELECT id, status, completed_at, notes
FROM gdpr_requests
WHERE id = '<requestId>';
```

And confirm an `audit_events` row exists:

```sql
SELECT event_type, event_at, metadata
FROM audit_events
WHERE request_id = '<requestId>'
ORDER BY event_at DESC
LIMIT 5;
```

---

## CNIL notification threshold

If a request is not responded to within 30 days and no extension notice was
sent, this is a potential GDPR violation. Inform Praxisa's legal counsel
immediately. The CNIL must be notified of systematic non-compliance.

---

## Preventing recurrence

- Confirm `ADMIN_ALERT_EMAIL` in Doppler points to the DPO inbox, not a
  shared engineering alias that may be missed.
- Verify the SLA monitor job is registered in BullMQ
  (`dsr-sla-monitor-scheduler` repeatable job) — check via Redis CLI:

  ```bash
  redis-cli -u "$REDIS_URL" KEYS "bull:dsr-sla-monitor:*"
  ```

- If the SLA monitor alert email itself wasn't delivered, check Brevo
  delivery logs for `ADMIN_ALERT_EMAIL`.
