# Capacity Planning Guide

This guide provides technical benchmarks and configurations required to estimate capacity, scale nodes, and allocate database connections for the Nova Store backend.

---

## 1. Memory and CPU Benchmarks

Estimated resources required per Node.js server container:

| Environment | CPU Allocation (cores) | Memory Allocation (MB) | Expected Throughput |
|-------------|-------------------------|------------------------|---------------------|
| Development | 0.5 Cores               | 512 MB                 | N/A                 |
| Staging     | 1.0 Cores               | 1024 MB                | 200 req/sec         |
| Production  | 2.0 Cores (min)         | 2048 MB (min)          | 800 - 1200 req/sec  |

*Note: Enabling Compression middleware reduces network bandwidth but increases CPU utilization under high request volume.*

---

## 2. Database Connection Pool Limits

Nova Store utilizes PostgreSQL connection pooling via the `pg` library. Direct database connections are managed by a centralized pool.

### Connection Limits Calculation

Supabase PostgreSQL plans have strict maximum connection counts (e.g. Free Tier = 60, Pro Tier = 90-500).

To prevent connection exhaustion, follow this pooling connection allocation formula:

$$\text{Max Pools Size} = \frac{\text{DB Connection Limit} - \text{Buffer (10)}}{\text{Number of App Instances}}$$

### Configuration Guidelines
- **Max Connections (`Backend/src/config/db.js`)**: Currently configured at `max: 20`.
- **Scaling Limit**: With 2 app nodes running, the maximum database connections used is $2 \times 20 = 40$, leaving a safe buffer for ad-hoc scripts (e.g., migrations, telemetry run).
- If app nodes scale beyond 3, you **must** decrease the pool size `max` in `db.js` or migrate `.env` connection URLs to the Supabase transaction pooler port (`6543`).

---

## 3. Redis Memory & Throughput Estimates

### Redis Sizing
- **Session Keys**: Session cookie keys utilize negligible storage (~2KB per session). An active footprint of 10,000 active sessions requires ~20MB of Redis RAM.
- **Notification Queue**: Jobs are popped and processed dynamically. Under maximum load (e.g. 50,000 enqueued emails), Redis RAM footprint peaks at ~100MB.

### Throughput Limits
- Rate limit configurations default to:
  - Auth limits: 15 request per 15 minutes.
  - API limits: 200 request per 15 minutes.
  - Health checks: 30 request per 1 minute.
- Standard single-node Redis handles up to 80,000 operations/sec, presenting no bottleneck under anticipated product loads.
