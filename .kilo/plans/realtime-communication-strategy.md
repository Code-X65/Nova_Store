# Real-Time Communication Strategy — Low-Latency Roadmap (Nova Store)

> **Grounded in current stack:** Express 5 monolith, Supabase/Postgres, Redis (event bus +
> SSE fan-out), React 18 + TanStack Query + `useSharedRealtime` SSE client. Existing realtime
> path: `realtime/event-bus.js` (Redis `nova:events` pub/sub) → `notification-router.service.js`
> (RBAC role→team) → `realtime/sse.gateway.js` (per-user `nova:rt:user:{id}` channels) →
> browser `EventSource('/api/v1/admin/stream')`. This doc evaluates WS / SSE / gRPC against
> that baseline and defines a phased roadmap.

---

## 1. Decision Matrix

| Criterion | WebSockets | SSE (`text/event-stream`) | gRPC (HTTP/2) |
|---|---|---|---|
| Direction | Full-duplex | Server → Client (client uses normal POST for sends) | Full-duplex (client↔server) |
| Transport | TCP (ws/wss) | HTTP/1.1 or HTTP/2 | HTTP/2 only |
| Payload | Binary or text (your choice) | UTF-8 text only | Protobuf (binary) |
| Browser API | `new WebSocket()` | native `EventSource` (auto-reconnect) | none (needs client lib / gateway) |
| Proxy/firewall friendliness | often needs ws-aware proxy | passes through any HTTP proxy/CDN | needs h2 + grpc-web for browsers |
| Connection cost @ scale | 1 socket/client (stateful) | 1 long-lived req/client (stateless, replayable) | multiplexed streams, very cheap |
| Best fit for Nova Store | Live *bidirectional* features (multi-admin inventory editing, presence, cursors) | **Notifications, audit stream, dashboards** ✅ | Internal service-to-service (only if you split the monolith) |

**Verdict for this app:**
- **Keep SSE as the client-delivery channel.** Your use case is unidirectional server→admin
  (notifications, audit, dashboard metrics). SSE gives you native reconnection, CDN/proxy
  traversal, and an HTTP/2-multiplexed connection for free. WS would add bidirectional power
  you don't currently need and a stateful-socket operational burden.
- **Adopt WebSockets only for the next interactivity tier** (concurrent inventory editing,
  "who's viewing this SKU", live stock locks). Do it as an *additional* channel, not a
  replacement — keep SSE for notifications.
- **Adopt gRPC only when you extract a microservice** (e.g., promote `notification-queue.service`
  + worker into a standalone "Realtime/Notify" service, or an "Inventory Engine"). gRPC over
  HTTP/2 with Protobuf is ideal *internally*; the browser still talks HTTP/SSE/WS at the edge,
  with the API gateway translating. Don't bolt gRPC onto a single Express process — it buys
  complexity, not latency wins, at monolith scale.

---

## 2. Current Baseline (what's already good)

- `event-bus.js` already fans out across instances via Redis Pub/Sub (`nova:events`) with a
  per-instance `INSTANCE_ID` echo-guard — good for multi-instance consistency.
- `sse.gateway.js` keys connections by `user_id` and `dashboardClients` set; delivers via Redis
  `nova:rt:user:{id}` so even cross-instance pushes reach the right socket.
- `audit-log` table has a **unique `event_id` index** (`063_audit_enrichment.sql`) — use it as
  the idempotency key to dedupe Redis fan-out replays.
- `useSharedRealtime.ts` is a correct singleton `EventSource` with reconnect + listener sets.

**Gaps to close for "ultra-low latency":** (1) `ProductModel.updateStock` does **read → compute
→ write** (a TOCTOU race under concurrent adjustments); (2) no client-side causality/versioning;
(3) no connection *pooling* story for Redis beyond a single client + `.duplicate()`; (4) SSE is
JSON (fine, but not the cheapest).

---

## 3. Concurrency Management

**Server (DB is the source of truth):**
- Make stock mutation **atomic in SQL**, never read-then-write in JS:
  ```sql
  UPDATE products
     SET stock_quantity = stock_quantity + $1,
         updated_at = now()
   WHERE id = $2
     AND stock_quantity + $1 >= 0          -- integrity guard
  RETURNING stock_quantity;
  ```
  Replace the `SELECT stock_quantity` + compute + `UPDATE` in `product.model.js::updateStock`
  with the above (or a `SECURITY DEFINER` RPC `apply_stock_delta(product_id, delta)`). This
  eliminates the race and the `INSUFFICIENT_STOCK` check becomes a row-count/`updated_at` check.
- For multi-row / cross-entity transactions use `SELECT … FOR UPDATE SKIP LOCKED` or Postgres
  advisory locks (`pg_advisory_xact_lock`) keyed by `product_id` to serialize adjustments per SKU
  without global locking.
- **Idempotency:** generate `event_id = uuid` per adjustment and rely on the unique index so a
  Redis replay can't double-apply a notification/audit row.

**Event loop / Node:**
- Keep handler work off the request path. You already `setImmediate` in `event-bus.emit` — keep
  audit/notification side-effects async and non-blocking.
- Bound concurrency with a small in-process queue / p-limit for notification fan-out so a burst
  of inventory adjustments can't exhaust sockets or DB connections.

---

## 4. Payload Serialization

- **SSE ⇒ JSON** (protocol requires UTF-8 text). Optimize instead via *shape*: send only
  `{type, id, title, severity, deepLink}` in the SSE frame; let the client fetch full detail
  lazily. (You already do this — `notification` frames carry the notification object.)
- **If you add WebSockets:** use **MessagePack** (compact, fast) or **Protobuf** for binary
  frames. Define a `.proto` for the hot path (`InventoryDelta`, `NotificationEnvelope`):
  ```proto
  message InventoryDelta {
    string product_id = 1;
    int32 delta = 2;
    int32 new_quantity = 3;
    string actor_id = 4;
    int64 version = 5;            // lamport/vector clock
    int64 ts = 6;
  }
  ```
- **gRPC (future, internal):** Protobuf is native. Use `server-streaming` RPCs for the notify
  service pushing to the API gateway, which re-emits to SSE/WS clients.
- **Rule of thumb:** compress JSON with `zlib`/`compression` for SSE; switch to binary only on
  the WS hot path where payload size/latency actually matters (high-frequency deltas).

---

## 5. Connection Pooling

- **Redis:** you use one `redisClient` + `.duplicate()` for pub/sub. That's fine (Redis connections
  are cheap), but (a) ensure every duplicate has an error handler (fixed in `event-bus.js`), and
  (b) consider a small pool/`ioredis` Cluster client if you exceed per-instance connection limits
  under heavy fan-out. Keep `enable_offline_queue` sensible so a downed Redis doesn't buffer
  unbounded commands.
- **Postgres:** front with **PgBouncer in transaction mode**; cap `max` to DB capacity; set
  `idle_in_transaction_session_timeout`. The `startServer` PG readiness loop (5×2s) is reasonable
  — keep it.
- **HTTP/2:** terminate TLS + HTTP/2 at the edge (Caddy/Nginx). SSE and any future WS then
  **multiplex over one connection per browser tab**, slashing per-request RTT and TCP/TLS overhead.
- **Keep-alive:** `Connection: keep-alive`, `X-Accel-Buffering: no` (already set in SSE), and a
  server-side heartbeat comment every ~25s (you already send `: ping`) to defeat proxy idle cuts.

---

## 6. Minimizing Round-Trip Time (RTT)

1. **HTTP/2 + edge multiplexing** — one TLS handshake per tab, many streams.
2. **Coalesce writes** — batch rapid inventory deltas per SKU into one frame every ~50–100ms
   (sliding window) before emitting; the client renders the latest. Reduces frame count ~10×.
3. **Push, don't poll** — SSE already removes the 30s poll; extend the reactive `setQueryData`
   pattern to all realtime-affected queries (audit feed, low-stock badges).
4. **Edge caching + CDN** for static/dashboard shells; only the stream is dynamic.
5. **Geo/region affinity** — single store, so keep the API + Redis + Postgres in one region;
   place the SSE/WS termination close to admins.
6. **Precompute** dashboard aggregates (low-stock counts, unread) server-side and invalidate on
   event, rather than recomputing per poll.

---

## 7. Optimistic UI (frontend)

TanStack Query already gives you the primitives. Pattern for an inventory adjust:

```ts
// useInventoryAdjust.ts
const qc = useQueryClient();
const mutation = useMutation({
  mutationFn: (body) => api.post('/inventory/adjust', body),
  // 1) Optimistically apply before server responds
  onMutate: async (body) => {
    await qc.cancelQueries({ queryKey: ['inventory', body.productId] });
    const prev = qc.getQueryData(['inventory', body.productId]);
    qc.setQueryData(['inventory', body.productId], (old) => ({
      ...old,
      stock_quantity: (old?.stock_quantity ?? 0) + body.quantityChange,
      __optimistic: true,
    }));
    return { prev };
  },
  // 2) Roll back on failure (server is authoritative)
  onError: (_e, body, ctx) => {
    qc.setQueryData(['inventory', body.productId], ctx?.prev);
    toast.error('Adjustment failed — reverted');
  },
  // 3) Reconcile with server truth on success
  onSuccess: (res, body) => {
    qc.setQueryData(['inventory', body.productId], res.data);
  },
});
```

Rules: (a) always keep a `prev` snapshot for rollback; (b) mark optimistic state so an incoming
SSE frame can be distinguished; (c) let the server event be the **single source of truth** that
finalizes state — the optimistic write only masks perceived latency.

---

## 8. State Synchronization & Race Conditions (distributed)

Because `event-bus` fans out across instances and multiple admins can edit the same SKU, clients
must reconcile, not just apply.

- **Versioning / causality:** tag every entity with a monotonic `version` (DB
  `UPDATE … SET version = version + 1`) and every realtime frame with that `version` + a
  **Lamport timestamp**. Client keeps `localVersion`; on an SSE/WS frame, **ignore if
  `frame.version <= localVersion`** (stale/duplicate) — solves Redis replay + out-of-order
  delivery. For multi-writer causality use a **vector clock** `{userId: counter}`.
- **Last-Write-Wins with guard:** accept highest `version`; reject/flag lower. Combine with the
  atomic `UPDATE … + delta` (§3) so the DB never double-applies.
- **Idempotency keys:** reuse `event_id` (unique index) so a fan-out replay can't create a
  duplicate audit/notification row — already supported, wire it through `notification-router`.
- **Conflict UX:** if an admin opens a SKU another admin just changed, show "Updated 3s ago by
  X" and require re-confirm, or use a short **pessimistic lock** (`locked_by`, `locked_until`)
  for concurrent edits (this is where WS shines — broadcast lock/acquire/release).
- **CRDTs (optional, future):** for collaborative fields (e.g., a shared "pick list"), a
  grow-only set / counter CRDT removes the need for central ordering. Overkill for inventory
  counts, which are better as authoritative counters.
- **Audit/integrity:** the `074` hash-chain (`record_hash`/`prev_record_hash`) already gives you
  a verifiable, tamper-evident ordered log — pair it with `version` for end-to-end ordering proof.

---

## 9. Phased Roadmap

- **Phase 0 (now, low risk):** keep SSE; fix atomic stock update (§3); add `version` columns to
  hot entities; enforce `event_id` idempotency end-to-end; reactive `setQueryData` everywhere.
- **Phase 1 (latency):** HTTP/2 edge + SSE multiplexing; delta coalescing; precomputed dashboard
  aggregates; Redis error-handler hardening (done in `event-bus.js`).
- **Phase 2 (interactivity):** add a **WebSocket** channel *alongside* SSE for concurrent
  inventory editing, presence, and edit-locks; Protobuf/MessagePack frames on that channel.
- **Phase 3 (scale-out):** extract `notification-queue` + worker (and later an Inventory Engine)
  into services; connect them with **gRPC** (Protobuf) internally; API gateway translates
  gRPC↔SSE/WS for browsers.

---

## 10. Risks / Trade-offs

- WS adds stateful-socket ops (heartbeats, sticky sessions if not using Redis fan-out). Mitigate
  by keeping Redis-backed routing so any instance can deliver to any socket.
- gRPC-for-browser needs grpc-web + a proxy; don't expose raw gRPC at the edge.
- Over-aggressive optimistic UI without server reconciliation causes "ghost" states — always
  reconcile on the authoritative event.
- Coalescing adds up to ~100ms artificial delay; tune per feature (notifications can batch more
  aggressively than stock locks).
