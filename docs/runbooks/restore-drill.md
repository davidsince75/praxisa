# Runbook: Point-in-Time Restore Drill (D17)

**Gate C evidence requirement:** D17 — demonstrate backup restore capability  
**Target:** Staging environment (never run a destructive restore against production)  
**Cadence:** Run before production go-live; repeat quarterly thereafter  
**Owner:** Engineering on-call  
**Estimated duration:** 30–60 minutes

---

## Purpose

This drill verifies that:

1. Railway's automatic Postgres backups are functioning.
2. The restore procedure is understood and documented before an incident occurs.
3. The application starts cleanly against the restored database.

Complete this drill, fill in the **Evidence record** at the bottom, and
commit the filled-in copy as `docs/runbooks/restore-drill-evidence-<date>.md`.

---

## Prerequisites

- Access to Railway dashboard with Admin role on the `staging` environment.
- `psql` or a Postgres client available locally.
- `DATABASE_URL` for the staging environment (from Doppler `stg` or Railway dashboard).
- The application is deployed and passing `/ready` on staging before you start.

---

## Procedure

### 1. Confirm a backup exists

1. Open Railway dashboard → Project → `staging` environment.
2. Select the Postgres plugin → **Backups** tab.
3. Confirm at least one backup exists and note the most recent backup timestamp.

> Railway retains 7 days of daily backups on all Postgres instances.
> If no backups appear, contact Railway support before proceeding to production.

**Record:** Most recent backup timestamp: `_______________`

---

### 2. Record the current state (pre-restore snapshot)

Before restoring, note the row counts as a baseline to verify after restore.

```sql
SELECT
  (SELECT COUNT(*) FROM users)          AS users,
  (SELECT COUNT(*) FROM gdpr_requests)  AS gdpr_requests,
  (SELECT COUNT(*) FROM audit_events)   AS audit_events,
  (SELECT COUNT(*) FROM policy_consents) AS policy_consents;
```

**Record pre-restore counts:**

| Table           | Row count |
|-----------------|-----------|
| users           |           |
| gdpr_requests   |           |
| audit_events    |           |
| policy_consents |           |

---

### 3. Create a test record to verify it disappears after restore

Insert a canary row that will be absent after restoring to a point before it
was created. Note the exact timestamp so you can verify it's gone.

```sql
INSERT INTO gdpr_requests (id, user_id, type, status, created_at, updated_at)
VALUES (
  'drill-canary-' || gen_random_uuid(),
  (SELECT id FROM users LIMIT 1),
  'access',
  'pending',
  NOW(),
  NOW()
)
RETURNING id, created_at;
```

**Record:** Canary row ID: `_______________`  
**Record:** Insert timestamp (UTC): `_______________`

---

### 4. Perform the point-in-time restore

1. In Railway dashboard → Postgres plugin → **Backups** tab.
2. Select a backup from **before** the canary insert (use the timestamp from
   step 3 to pick the right one).
3. Click **Restore** → confirm the operation.

> ⚠️ Railway restores in-place. The staging database will be unavailable
> for 1–5 minutes during restore. Workers and API will show connection errors
> in their logs — this is expected.

**Record:** Restore initiated at (UTC): `_______________`  
**Record:** Restore completed at (UTC): `_______________`

---

### 5. Verify the restore succeeded

#### 5a. Canary row is gone

```sql
SELECT COUNT(*) FROM gdpr_requests
WHERE id LIKE 'drill-canary-%';
```

Expected result: `0`

**Record:** Canary absent: `yes / no`

#### 5b. Row counts are consistent with pre-restore snapshot

```sql
SELECT
  (SELECT COUNT(*) FROM users)           AS users,
  (SELECT COUNT(*) FROM gdpr_requests)   AS gdpr_requests,
  (SELECT COUNT(*) FROM audit_events)    AS audit_events,
  (SELECT COUNT(*) FROM policy_consents) AS policy_consents;
```

**Record post-restore counts:**

| Table           | Row count | Matches pre-restore? |
|-----------------|-----------|----------------------|
| users           |           |                      |
| gdpr_requests   |           |                      |
| audit_events    |           |                      |
| policy_consents |           |                      |

#### 5c. Application health checks pass

```bash
# Wait ~60 s for Railway to restart the API service, then:
curl -s https://<staging-api-url>/health
# Expected: {"status":"ok"}

curl -s https://<staging-api-url>/ready
# Expected: {"status":"ok"}
```

**Record:** `/health` response: `_______________`  
**Record:** `/ready` response: `_______________`

#### 5d. Migration state is consistent

```sql
SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY created_at;
```

All expected migrations (`0001` through `0006`) should be present.

**Record:** Migration count: `_______________`  
**Record:** Latest migration ID: `_______________`

---

### 6. Smoke test

Run the critical path to confirm data integrity end-to-end:

1. Log in with an existing staging user → confirm JWT issued.
2. `GET /v1/gdpr/consents/me` → confirm consent history returned.
3. `GET /v1/audit/events?limit=5` (admin token) → confirm audit events returned.

**Record:** Smoke test passed: `yes / no`

---

## Evidence record

Fill in after completing all steps. Commit this file as
`docs/runbooks/restore-drill-evidence-YYYY-MM-DD.md`.

| Field                        | Value |
|------------------------------|-------|
| Drill date (UTC)             |       |
| Operator                     |       |
| Staging API URL              |       |
| Backup used (timestamp)      |       |
| Restore duration (min)       |       |
| Canary row absent            |       |
| Row counts consistent        |       |
| /ready passed after restore  |       |
| Smoke test passed            |       |
| Issues observed              |       |
| Follow-up actions            |       |

---

## Quarterly cadence

Schedule the next drill: within 90 days of this drill, or immediately after
any of the following:

- Postgres major version upgrade
- Migration to a new Railway project or region
- Any unplanned production restore event
