# Production Operations Runbook

This runbook describes the diagnostic and recovery procedures for common production incidents on the Nova Store backend.

---

## 1. Incident: Redis is Down or Unreachable

### Symptoms
- Increased response latency.
- Health probes `/health` or `/health/ready` report `DEGRADED` or `NOT_READY`.
- Core logs warning: `[Idempotency] PostgreSQL lock failed, falling back to In-Memory store` or `Redis connection lost...`.

### Self-Healing Systems Behavior
- **Rate Limiting**: Rate limiters automatically degrade to in-memory store tracking (via `MemoryStore` fallback class).
- **Idempotency**: Lock mechanism falls back to direct database lock and in-memory map lookup.
- **Worker Queue**: Processing interval pauses and will auto-reconnect once Redis recovers.

### Recovery Actions
1. **Verify Redis Status**:
   - Check if Redis container/cluster is running:
     ```bash
     docker ps | grep redis
     ```
2. **Restart Redis**:
   - If local, restart the server:
     ```bash
     docker restart nova-redis
     ```
3. **Verify Connectivity**:
   - Test ping:
     ```bash
     redis-cli ping
     ```

---

## 2. Incident: Database Connection Exhaustion (Supabase PostgreSQL)

### Symptoms
- Database connection timeouts or failures.
- Logs contain: `PostgreSQL connection attempt failed: remaining connection slots are reserved...` or `Database connection timeout`.
- HTTP server returns `503 Service Unavailable` on database checks.

### Diagnostic Steps
1. **Analyze Pool Usage**:
   - Log into the Supabase dashboard and monitor pool size.
   - Run PG queries to check active client connections:
     ```sql
     SELECT count(*), state FROM pg_stat_activity GROUP BY state;
     ```

### Mitigation Actions
1. **Adjust Pool Settings**:
   - Central connection pool is configured in `Backend/src/config/db.js`. Verify `max` value (default: `20`). If you have many server instances, reduce this to prevent exhausting the DB limit.
2. **Switch to Pooler Port**:
   - In `.env`, check `DATABASE_URL`. Ensure it is using the Supabase pooled connection port `6543` (transaction mode) rather than direct port `5432`.

---

## 3. Incident: Paystack Webhook Delivery Failures

### Symptoms
- Orders remain in `pending` payment status despite client payment.
- Customers complain of missing confirmation screens.
- Webhook logging analytics show `403 Forbidden` or `TIMEOUT` on webhook routes.

### Resolution Steps
1. **Verify CSRF Exemption**:
   - Webhook endpoints must be excluded from CSRF checks. Verify that the webhook path `/api/v1/payments/webhook` is correctly registered in CSRF exemptions.
2. **Verify Signature Keys**:
   - Check `PAYSTACK_SECRET_KEY` env variable. A mismatch will cause signature verification to reject requests with `401 Unauthorized`.
3. **Re-trigger Webhook**:
   - Log into the Paystack Dashboard, navigate to developers -> webhooks, find the failed events, and trigger a retry/resend.

---

## 4. Incident: Notification Delivery Failures (SMTP/Twilio)

### Symptoms
- Users do not receive registration, verification, or order success emails/SMS.
- Notification queue dead-letter entries (`nova:notification:dlq`) size grows.

### Recovery Steps
1. **Fetch Queue Stats**:
   - Query the queue health endpoint: `/api/v1/admin/notifications/health` to review the count of `failed` (DLQ) jobs.
2. **Verify Provider Health**:
   - Check Brevo/SMTP and Twilio status pages.
   - Run the detailed health probe: `/health/detailed` to verify SMTP and SMS connectivity handshakes.
3. **Reprocess DLQ Jobs**:
   - If the outage was transient, execute the queue reprocessing tool to drain the DLQ back into the active queue once providers are online.
