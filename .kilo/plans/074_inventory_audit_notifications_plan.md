# Inventory Audit Log & Real-Time Notification — Implementation Plan

> **Scope note (grounded in current codebase):** Nova Store already has the hard parts:
> `realtime/event-bus.js` (Redis fan-out), `realtime/sse.gateway.js` (per-user SSE),
> `services/notification-router.service.js` (RBAC role→team routing), `models/notification.model.js`,
> `services/audit.service.js`, `utils/audit-diff.js`, `utils/audit-labels.js`, and a fully working
> frontend `NotificationBell` + `useSharedRealtime` SSE client. The requirement is therefore **not a
> greenfield build** — it is *wiring the inventory-adjustment event into the existing pipeline + raising
> audit-log fidelity*. This plan lists exactly what to add/change, with file references.

---

## 0. Current-State Gap Analysis

| Requirement | Status today | Gap to close |
|---|---|---|
| Notify **Store Manager + Store Owner** on inventory adjustment | `inventory.discrepancy` event exists but routes to `{INVENTORY_STAFF, MANAGER}` (Warehouse Team), not specifically Manager+Owner. `addStock`/`reduceStock` emit **no** routed event. | Add dedicated `inventory.adjustment` event + routing rule `{MANAGER, STORE_OWNER}`; emit from all 3 adjustment endpoints. |
| High-fidelity "Plain English" audit summary | `audit-diff.js::summarizeDelta` produces *exactly* the "Bad Example" (`QuantityChange changed from (none) to 20; ...`). `inventory.stock_adjusted` is logged with `oldValues=null`. | New domain-aware summary builder `summarizeInventoryAdjustment()` + capture full snapshot. |
| Capture SKU / Product Name / Category / Warehouse / Batch-Lot / Delta / Reason / device+session | `audit_logs` stores only `old_values`/`new_values`/`delta`/`summary` JSONB. `inventory_transactions` has **no** `warehouse_location`, `batch_lot`, or explicit `reason_code` (reason is folded into `type`). `products` has `sku`,`name`,`category`. | Migration `074`: structured audit columns + `inventory_transactions.warehouse_location`/`.batch_lot`. |
| Real-time delivery via bell icon | Already works (SSE → `useSharedRealtime` → `NotificationBell`). Badge count polls every 30s. | Make unread badge reactive via SSE so it is truly instant. |
| Immutable audit logs | All tables have **RLS disabled**; backend uses `supabaseAdmin` (bypasses RLS). | Append-only trigger + hash chain + dedicated least-privilege DB role. |

---

## 1. End-to-End Data Flow

```
Inventory Staff → POST /api/v1/inventory/adjust (requireInventoryStaff)
        │
        ├─(1) InventoryService.adjustStock() updates stock + writes inventory_transaction
        │
        ├─(2) NEW: capture snapshot {sku, name, category, warehouse, batchLot,
        │         prevQty, newQty, delta, reasonCode, notes, device/session}
        │
        ├─(3) AuditService.log(..., { summary: summarizeInventoryAdjustment(...) })  ──▶ audit_logs
        │
        └─(4) eventBus.emit('inventory.adjustment', payload)                         ──▶ defer (setImmediate)
                  │
                  ├─ (local) + Redis Pub/Sub 'nova:events' (cross-instance)
                  ▼
        notification-router.route('inventory.adjustment', payload)
                  ├─ writes enriched audit entry (idempotent)
                  ├─ resolveTeamRecipients(['MANAGER','STORE_OWNER'])  → active users w/ role
                  └─ for each recipient: NotificationModel.create(...) + sseGateway.publishToUser()
                          │
                          ▼  Redis 'nova:rt:user:{id}'
                  SSE gateway → connected admin browser
                          │
                          ▼
                  useSharedRealtime (EventSource /admin/stream) → NotificationBell
                          ├─ unread badge +1 (reactive)
                          └─ dropdown shows: "Inventory Staff [Name] added 20 units of
                             iPhone 15 (SKU: IP15-BLK) due to 'Return'. Note: Found in backroom."
```

---

## 2. Backend — Database Schema Changes

New migration **`Backend/sql/074_inventory_audit_notifications.sql`** (next sequential number after `073_*`).

### 2.1 Structured, queryable audit columns (for filtering/export — JSONB alone is not indexable)

```sql
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS resource_sku TEXT,
  ADD COLUMN IF NOT EXISTS resource_name TEXT,
  ADD COLUMN IF NOT EXISTS resource_category TEXT,
  ADD COLUMN IF NOT EXISTS context_location TEXT,        -- warehouse / aisle / bin
  ADD COLUMN IF NOT EXISTS context_batch_lot TEXT,       -- batch / lot number
  ADD COLUMN IF NOT EXISTS delta_numeric INT,            -- exact signed numeric difference
  ADD COLUMN IF NOT EXISTS reason_code TEXT,             -- 'return' | 'damaged' | ...
  ADD COLUMN IF NOT EXISTS device_info JSONB,            -- { ip, userAgent, sessionId, requestId }
  ADD COLUMN IF NOT EXISTS record_hash TEXT,             -- tamper-evidence (see §7)
  ADD COLUMN IF NOT EXISTS prev_record_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_resource_sku   ON audit_logs(resource_sku);
CREATE INDEX IF NOT EXISTS idx_audit_resource_name  ON audit_logs(resource_name);
CREATE INDEX IF NOT EXISTS idx_audit_reason         ON audit_logs(reason_code);
CREATE INDEX IF NOT EXISTS idx_audit_delta          ON audit_logs(delta_numeric);
```

### 2.2 Capture contextual warehouse / batch-lot on the transaction itself

```sql
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS warehouse_location TEXT,
  ADD COLUMN IF NOT EXISTS batch_lot TEXT,
  ADD COLUMN IF NOT EXISTS reason_code TEXT,             -- explicit, not just 'type'
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inv_txn_warehouse ON inventory_transactions(warehouse_location);
CREATE INDEX IF NOT EXISTS idx_inv_txn_batch    ON inventory_transactions(batch_lot);
```

> `inventory.adjust` Joi schema (`inventory.routes.js:33`) must add `warehouseLocation` and `batchLot`
> (both optional), and `InventoryService.adjustStock` / `addStock` / `reduceStock` must persist them into
> `inventory_transactions` via `ProductModel.updateStock`.

### 2.3 Routing rule — Inventory Manager adjustment → Store Manager + Store Owner

```sql
INSERT INTO notification_routing_rules
  (name, event_key, recipient_roles, channel, severity, template_key)
VALUES
  ('Inventory adjustment → Manager + Owner', 'inventory.adjustment',
   '{MANAGER,STORE_OWNER}', '{inapp}', 'info', NULL)
ON CONFLICT (event_key) DO NOTHING;
```

> Note: keep the existing `inventory.discrepancy` rule (Warehouse Team) for the zero-stock / anomaly case.
> The new rule is the *business* notification to management; `discrepancy` is the *accuracy* alert.

---

## 3. Backend — High-Fidelity Audit Summary Generator

The current `summarizeDelta` (`utils/audit-diff.js:76`) yields the exact "Bad Example". Add a
**domain-aware** builder and wire it specifically for inventory events.

**New file `Backend/src/utils/audit-summary.js`:**

```js
const REASON_LABELS = {
  return: 'Return', damaged: 'Damage', restock: 'Restock',
  correction: 'Correction', loss: 'Loss', other: 'Other',
};

/**
 * Plain-English inventory adjustment summary.
 * @returns {string} e.g. "Inventory Staff Jane Doe added 20 units of iPhone 15
 *          (SKU: IP15-BLK) due to a 'Return'. Note: Found in backroom."
 */
function summarizeInventoryAdjustment(s) {
  const {
    actorName, actorRole, quantityChange, productName, sku,
    reasonCode, notes, warehouseLocation, batchLot, previousQuantity, newQuantity,
  } = s;

  const dir = quantityChange > 0 ? 'added' : 'removed';
  const abs = Math.abs(quantityChange);
  const role = actorRole ? `${actorRole.replace('_', ' ')} ` : '';
  const who = actorName ? `${role}${actorName}` : 'A staff member';

  let out = `${who} ${dir} ${abs} unit${abs === 1 ? '' : 's'} of ${productName || 'a product'}`;
  if (sku) out += ` (SKU: ${sku})`;
  if (reasonCode) out += ` due to a '${REASON_LABELS[reasonCode] || reasonCode}'`;
  out += '.';

  const ctx = [];
  if (warehouseLocation) ctx.push(`Location: ${warehouseLocation}`);
  if (batchLot) ctx.push(`Batch/Lot: ${batchLot}`);
  if (Number.isFinite(previousQuantity) && Number.isFinite(newQuantity))
    ctx.push(`Stock: ${previousQuantity} → ${newQuantity}`);
  if (notes) out += ` Note: ${notes}.`;
  if (ctx.length) out += ` [${ctx.join('; ')}]`;
  return out;
}

module.exports = { summarizeInventoryAdjustment };
```

**Wire it in `inventory.controller.js`** (`adjustStock`, and similarly `addStock`/`reduceStock`):

```js
const { summarizeInventoryAdjustment } = require('../utils/audit-summary');

// after InventoryService.adjustStock(...) returns { stock_quantity, ... }:
const product = await ProductModel.findById(productId);     // has sku, name, category
const summary = summarizeInventoryAdjustment({
  actorName: req.actor?.fullName || `${req.user.firstName} ${req.user.lastName}`,
  actorRole: req.user.role,
  quantityChange,
  productName: product.name,
  sku: product.sku,
  reasonCode,
  notes,
  warehouseLocation,            // from req.body
  batchLot,                     // from req.body
  previousQuantity: result.previous_quantity,
  newQuantity: result.stock_quantity,
});

await AuditService.log(req, 'inventory.stock_adjusted', 'product', productId, null,
  { quantityChange, reasonCode, notes, warehouseLocation, batchLot, variantId }, {
    actionType: 'UPDATE',
    severity: 'warning',
    summary,                                          // <- overrides generic delta summary
    delta: [{ field: 'quantity', label: 'Quantity', before: result.previous_quantity, after: result.stock_quantity }],
  });
```

> `AuditService.log` already prefers `opts.summary` over the auto-computed `computeDelta` summary
> (`audit.service.js:80`), so passing `summary` is sufficient — no change needed in the service.

---

## 4. Backend — Trigger Wiring (emit the event)

In `inventory.controller.js`, **all three** adjustment endpoints must emit `inventory.adjustment` so any
inventory movement notifies management (not only manual `adjust`). Reuse the existing `eventBus` import
(line 3) and the same payload shape the router already consumes (`notification-router.service.js:97`).

```js
// adjustStock (and analogous in addStock/reduceStock)
eventBus.emit('inventory.adjustment', {
  actor: req.actor || { id: userId, fullName: null, role: req.user?.role },
  resourceType: 'product',
  resourceId: productId,
  actionType: 'UPDATE',
  severity: 'info',
  title: 'Inventory adjustment',
  message: summary,                                  // the Plain-English summary
  data: { productId, sku: product.sku, productName: product.name,
          quantityChange, reasonCode, warehouseLocation, batchLot,
          previousQuantity: result.previous_quantity, newQuantity: result.stock_quantity,
          notes, deepLink: `/inventory/${productId}` },
  deepLink: `/inventory/${productId}`,
});
```

Then register the handler once in `notification-router.service.js`:

```js
// add to HANDLED_EVENTS (line ~146):
'inventory.adjustment',
```

No other handler code is needed — `route()` already (a) writes the enriched audit entry, (b) resolves
`{MANAGER, STORE_OWNER}` recipients via `notification_routing_rules`, (c) creates the in-app
`notifications` row, and (d) `publishToUser` over SSE (`deliverOne`, line 71). The manager/owner receive
it instantly.

---

## 5. Backend — API Design (mostly already exist)

| Capability | Endpoint | Status |
|---|---|---|
| Notification history | `GET /api/v1/notifications?isRead=false&type=...&page=&limit=` | ✅ `notification.model.js::findByUserId` |
| Unread count | `GET /api/v1/notifications/unread-count` | ✅ |
| Mark one read | `PUT /api/v1/notifications/:id/read` | ✅ `markAsRead` |
| Mark all read | `POST /api/v1/notifications/mark-all-read` | ✅ `markAllAsRead` |
| Dismiss | `DELETE /api/v1/notifications/:id` | ✅ `delete` |
| SSE stream | `GET /api/v1/admin/stream` | ✅ `sse.gateway.js::registerSse` |
| **Audit log export** (CSV/PDF) | `GET /api/v1/admin/audit/export?from=&to=&action=` | ✅ `audit-exporter.js` + `audit.controller.js` (reuse) |
| **New: audit log by product** | `GET /api/v1/admin/audit?resourceType=product&resourceId=` | add filter (model already supports `resourceId`) |

> Frontend already consumes these via `useNotifications.ts`. **No new endpoints required** for the core
> flow — only the SSE-driven badge (§6) needs a small client tweak.

---

## 6. Frontend — `Topbar.tsx` / `NotificationBell.tsx` (real-time + unread count)

`Topbar.tsx:219` already renders `<NotificationBell />` and the SSE client is live
(`useSharedRealtime.ts:15` → `/api/v1/admin/stream`). Two refinements make delivery **instant**:

### 6.1 Reactive unread badge (kill the 30s poll delay)

Today `useNotifications.ts:14` polls `unread-count` every 30s. Instead, bump the react-query cache when an
SSE `notification` frame arrives. In `useSharedRealtime.ts`, expose the latest notification to a callback
that updates the cache:

```ts
// in NotificationBell.tsx (already calls useAdminRealtime) — add:
useAdminRealtime((n) => {
  // update reactive badge immediately
  qc.setQueryData(['notifications', 'unread-count'], (prev: number = 0) => prev + 1);
  if (open) fetchList();
});
```
(`qc` from `useQueryClient()`; import `useQueryClient` in `NotificationBell`.) Keep the 30s poll as a
fallback only (`refetchInterval: 30000` is fine).

### 6.2 Dropdown enrichment (already 95% done)

`NotificationBell.tsx:100` maps `n.title`/`n.message`/`n.severity`/`n.recipientRole`/`n.deepLink`. Because
the backend `message` now carries the Plain-English summary, the dropdown renders correctly with **no
change**. Recommended small UX additions:
- Group by day + severity (use `date-fns` already imported, line 7).
- Show `<span>{n.data.sku}</span>` and stock delta chip when `n.type === 'inventory.adjustment'`.
- Deep-link already navigates to `/inventory/{productId}` via `handleRowClick` (line 37).

---

## 7. State Management — Global Unread Count

**Recommendation: do NOT introduce Redux/Zustand.** The codebase already uses the idiomatic React pattern:
- **Server state** (notifications list, unread count) → **TanStack Query** (`useNotifications.ts`).
- **Real-time pushes** → **SSE singleton** (`useSharedRealtime.ts`) updating the query cache (§6.1).
- **Local UI state** (open/closed, filter) → `useState` in `NotificationBell`.

This avoids a second source of truth. If you later need the badge outside `Topbar` (e.g., a mobile shell),
promote the unread count to a tiny **Zustand store** (`useUnreadStore`) fed by the same SSE handler — but
only if multiple disconnected components need it. For this scope, react-query cache invalidation is enough.

---

## 8. Strategic Recommendations (making it "perfect")

1. **Notification grouping / coalescing** — Burst protection: if ≥ N adjustments to the same SKU within T
   seconds, emit one grouped notification ("12 adjustments to iPhone 15 totalling +340 units"). Implement in
   `notification-router.service.js` with a short Redis-backed sliding window keyed by `resourceId`.
2. **Severity model** — Already supported (`info`/`warning`/`critical`). Extend `severity` to drive UI color
   (bell already does this, `NotificationBell.tsx:112`). Add `critical` for adjustments that flip stock
   negative or exceed a threshold.
3. **Anomaly detection alerts** — In `adjustStock`, flag when `|quantityChange|` > `low_stock_threshold * K`
   or when stock goes negative → emit `inventory.discrepancy` (already routed to Warehouse+Manager) with
   `severity:'critical'`. Add a simple z-score against historical deltas.
4. **Audit exportability** — Already supported by `audit-exporter.js` (CSV/PDF). Add scheduled export to WORM
   storage (S3 Object Lock) for compliance retention.
5. **Read-receipts / acknowledgement** — For `critical` inventory actions, require explicit acknowledge
   (new `acknowledged_at` column + `PUT /notifications/:id/ack`).
6. **Full-text search** — `audit-log.model.js::findAll` already supports `q` on `summary`/`action`. Expose a
   global audit search box in the admin audit page.

---

## 9. Security & Integrity — Immutable Audit Logs

RLS is currently **disabled** on `audit_logs` and the backend uses the `supabaseAdmin` key (which bypasses
RLS), so RLS alone is insufficient. Defense-in-depth:

1. **Append-only DB trigger** (in migration `074`):
   ```sql
   CREATE OR REPLACE FUNCTION forbid_audit_mutate() RETURNS TRIGGER AS $$
   BEGIN RAISE EXCEPTION 'audit_logs is append-only'; END; $$ LANGUAGE plpgsql;
   CREATE TRIGGER trg_audit_no_update BEFORE UPDATE OR DELETE ON audit_logs
     FOR EACH ROW EXECUTE FUNCTION forbid_audit_mutate();
   ```
2. **Least-privilege write role** — Create a dedicated DB role `audit_writer` with **only `INSERT`** on
   `audit_logs`; use a separate Supabase client (`supabaseAuditWriter`) in `audit-log.model.js` instead of
   `supabaseAdmin`. Revoke `UPDATE`/`DELETE` from the app role.
3. **Cryptographic hash chain** (tamper-evidence) — On insert, compute
   `record_hash = sha256(prev_record_hash || payload)`; store `prev_record_hash` from the previous row
   (order by `created_at`). A verifier job replays the chain and fails on mismatch. Add `record_hash` /
   `prev_record_hash` columns (§2.1).
4. **WORM archival** — Stream audit inserts (via the event bus) to an immutable sink (S3 Object Lock /
   append-only log) for regulatory retention independent of the DB.
5. **Audit the auditor** — `actor_session_id` + `request_id` already captured; retain and include in the
   hash chain so a log entry is provably tied to a session/request.

---

## 10. Implementation Checklist (ordered)

- [ ] `sql/074_inventory_audit_notifications.sql` — §2.1, §2.2, §2.3, §9.1
- [ ] `inventory.routes.js` — add `warehouseLocation`, `batchLot` to adjust/stock/reduce Joi schemas
- [ ] `inventory.service.js` — persist `warehouse_location`, `batch_lot`, `reason_code`, `store_id`
- [ ] `utils/audit-summary.js` — new `summarizeInventoryAdjustment()` (§3)
- [ ] `inventory.controller.js` — capture snapshot, set `summary`, emit `inventory.adjustment` from add/reduce/adjust (§3, §4)
- [ ] `notification-router.service.js` — add `'inventory.adjustment'` to `HANDLED_EVENTS` (§4)
- [ ] `audit-log.model.js` — switch to least-privilege `audit_writer` client (§9.2); compute hash chain (§9.3)
- [ ] `NotificationBell.tsx` — reactive unread badge via `useQueryClient().setQueryData` (§6.1)
- [ ] Optional: grouping (§8.1), anomaly flags (§8.3), acknowledge (§8.5)

**Verification:** `npm run db:migrate` → trigger an `POST /inventory/adjust` as INVENTORY_STAFF → confirm
(1) `audit_logs` row has readable `summary` + structured columns, (2) MANAGER & STORE_OWNER rows appear in
`notifications` with `recipient_role` in `{MANAGER,STORE_OWNER}`, (3) their dashboards receive the SSE push
instantly, (4) `UPDATE audit_logs ...` raises the append-only trigger error.
