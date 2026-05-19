# Runbook: DSR Erasure Sweep Failure

**Severity:** High  
**Owner:** Engineering on-call  
**Escalation:** DPO if a request remains unprocessed > 24 h  
**Related queue:** `dsr-sweep` (BullMQ, Redis)

---

## What this runbook covers

The erasure worker polls every 60 seconds for `gdpr_requests` rows with
`type = 'erasure'` and `status = 'pending'`. It claims them by setting
`status = 'in_progress'` and processes each one. A failure leaves the
request in `in_progress` indefinitely — the next sweep skips it (only
claims `pending`). This runbook covers detection, diagnosis, and recovery.

---

## Detecting a problem

### Symptom 1 — Worker logs show an error

```
DSR erasure failed — request left in_progress for retry
```

The log includes `requestId` and `userId`. This is expected for transient
failures; it becomes a problem if the same request fails repeatedly.

### Symptom 2 — SLA monitor fires without pending → completed transition

The SLA monitor runs daily at 06:00 UTC. If it fires an alert for a request
that should have been erased, the sweep is likely stalled.

### Symptom 3 — Stalled `in_progress` row detected manually

```sql
-- Requests stuck in_progress for > 2 hours
SELECT id, user_id, created_at, updated_at
FROM gdpr_requests
WHERE type = 'erasure'
  AND status = 'in_progress'
  AND updated_at < NOW() - INTERVAL '2 hours';
```

---

## Diagnosis

### 1. Check worker logs (Railway dashboard or CLI)

```bash
railway logs --service workers --environment <env> | grep "DSR erasure"
```

Look for the `err` field on the failure log line. Common errors:

| Error | Likely cause |
|-------|-------------|
| `Brevo error 4xx` | Invalid/expired Brevo API key or rate limit hit |
| `Brevo error 5xx` | Brevo transient outage — safe to retry |
| `connection refused` / `ECONNREFUSED` | DB or Redis unreachable |
| `duplicate key value violates unique constraint` | Erased email already exists — double-processing |
| `emitEvent failed` | Audit SDK error — check `audit_events` table write permissions |

### 2. Confirm the request state

```sql
SELECT id, user_id, status, notes, updated_at, completed_at
FROM gdpr_requests
WHERE id = '<requestId>';
```

### 3. Confirm user PII state

```sql
SELECT id, email, first_name, last_name, is_active
FROM users
WHERE id = '<userId>';
```

If `email` already matches `erased_<userId>@praxisa.invalid`, PII was zeroed
but the request wasn't marked completed. See "Partial erasure recovery" below.

---

## Recovery procedures

### A — Transient failure (network/Brevo blip)

Reset the request to `pending` so the next sweep claims it:

```sql
UPDATE gdpr_requests
SET status = 'pending', updated_at = NOW()
WHERE id = '<requestId>'
  AND status = 'in_progress';
```

Confirm the next sweep run (within 60 s) picks it up.

### B — Permanent Brevo failure (email cannot be sent)

The confirmation email is non-critical — erasure must proceed even if the
email fails. Two options:

**Option 1 — Manual send + reset to pending**

Send the confirmation manually via Brevo dashboard, then reset to `pending`
as in procedure A.

**Option 2 — Skip email, complete manually**

```sql
-- Only use if user PII is already zeroed (eraseUserPii ran successfully)
UPDATE gdpr_requests
SET status    = 'completed',
    completed_at = NOW(),
    notes     = 'Auto-completed manually — Brevo delivery failed; erasure confirmed by operator <name>',
    updated_at   = NOW()
WHERE id = '<requestId>';
```

### C — Partial erasure (PII zeroed, lesson_progress not deleted)

```sql
-- Find enrolments for the user
SELECT id FROM enrolments WHERE student_id = '<userId>';

-- Delete lesson_progress for those enrolments
DELETE FROM lesson_progress
WHERE enrolment_id IN (
  SELECT id FROM enrolments WHERE student_id = '<userId>'
);

-- Mark request completed
UPDATE gdpr_requests
SET status       = 'completed',
    completed_at = NOW(),
    notes        = 'Manually completed after partial failure — PII already zeroed, progress deleted by operator <name>',
    updated_at   = NOW()
WHERE id = '<requestId>';
```

Then emit a manual audit event (or note the manual action in the completion
notes for the audit trail).

### D — DB unreachable / Redis unreachable

1. Check Railway service health dashboard.
2. If DB: verify `DATABASE_URL` is valid and the Postgres plugin is running.
3. If Redis: verify `REDIS_URL` and the Redis plugin health.
4. Once connectivity is restored, the worker reconnects automatically (ioredis
   retry + pg pool reconnect). No manual action needed — sweep runs on next tick.

---

## Escalation criteria

Escalate to DPO if:

- Any erasure request remains unprocessed > 24 hours after the user submitted it
- There is evidence that PII was read or transmitted during a failed run
- The failure affects more than one user

---

## Post-incident

1. Confirm the affected request is `completed` and PII is zeroed.
2. Check `audit_events` for `gdpr.erasure.completed` event on the request.
3. File an incident note in the DPO register if the request was delayed > 24 h.
4. Fix the root cause (code or infrastructure) before closing the incident.
