# Real-Time Administrative Access Management — Technical Architecture & Implementation Plan

> Grounded in the Nova Store codebase (Node/Express 5 + Supabase/Postgres + Redis + React/Vite).
> "Super Admin" maps to the existing `STORE_OWNER` role (`require-store-owner.middleware`, the `requireSuperAdmin` shim at `Backend/src/middlewares/require-super-admin.middleware.js:1` already aliases it).

---

## 0. Goals & Scope

| Capability | Current state | This plan adds |
|------------|---------------|----------------|
| Role reassign | `PATCH /admin/:id/roles` ✅ | Real-time fan-out + session-safe re-eval |
| Lock / Unlock | Only auto lockout (`is_locked`, `lock_until`) | **Explicit** Super-Admin lock/unlock + instant session kill |
| Remove | Soft-delete (`is_active=false`) | **Permanent purge** + forensic archive |
| Granular overrides | `extra_permissions` flat array (permanent only) | `permission_overrides` table: allow/deny, **ABAC scope**, **TTL** |
| Real-time sync | None (polling only) | **SSE + Redis Pub/Sub** fan-out; instant session invalidation |

Design principles:
1. **Server is the single source of truth.** `require-admin` already recomputes `roles`/`permissions` per request from the DB (`userModel.getUserRolesAndPermissions`), so enforcement is always live. Real-time events only *tell clients to refetch*.
2. **No privilege escalation.** Reuse `requireStoreOwner` for lock/unlock/remove; reuse the existing hierarchy checks in `admin-management.controller.js`. Add a "cannot grant a permission you don't hold" rule.
3. **Zero new runtime deps for real-time** — use **SSE** (native `res.write`, cookie/CSRF-friendly) over the existing HTTP server, fanned out via **Redis Pub/Sub** (already wired in `config/redis.js`).

---

## 1. Database Schema

### 1.1 New table — `permission_overrides` (RBAC + ABAC + TTL)

Replaces the brittle `users.extra_permissions` array as the granular-override store. ABAC is expressed through `scope`/`conditions` JSONB; TTL through `expires_at`.

```sql
-- Backend/sql/060_permission_overrides.sql
create table if not exists permission_overrides (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  permission_key text not null,                 -- from permissions.key, or '*' (wildcard)
  effect        text not null check (effect in ('allow','deny')),
  scope         jsonb not null default '{}'::jsonb,   -- ABAC: {store_id, resource_type, region, ...}
  conditions    jsonb not null default '{}'::jsonb,   -- ABAC runtime: e.g. {"days":["Mon"..],"ip_cidr":"10.0.0.0/8"}
  granted_by    uuid references users(id),
  expires_at    timestamptz,                    -- null = permanent; set = temporary (TTL)
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ix_perm_ov_user_active   on permission_overrides (user_id, is_active);
create index if not exists ix_perm_ov_expires        on permission_overrides (expires_at) where expires_at is not null;
create index if not exists ix_perm_ov_key            on permission_overrides (permission_key);
create index if not exists ix_perm_ov_scope_gin      on permission_overrides using gin (scope);
```

### 1.2 Extend `users` for explicit lock/remove lifecycle

`is_locked` / `lock_until` already exist; add the manual-lock audit trail columns.

```sql
-- Backend/sql/061_admin_lifecycle_cols.sql
alter table users
  add column if not exists lock_type      text default 'auto' check (lock_type in ('auto','manual')),
  add column if not exists locked_reason  text,
  add column if not exists locked_by      uuid references users(id),
  add column if not exists locked_at      timestamptz;
```

### 1.3 Forensic archive — `admin_purges` (for permanent Remove)

A hard delete must leave an immutable record (who/when/snapshot) so the email cannot be silently re-invited and audit trails survive.

```sql
-- Backend/sql/062_admin_purges.sql
create table if not exists admin_purges (
  id            uuid primary key default gen_random_uuid(),
  purged_user_id uuid not null,                    -- original id (now deleted from users)
  email         text not null,
  full_name     text,
  roles         jsonb not null default '[]'::jsonb,
  snapshot      jsonb not null default '{}'::jsonb, -- copy of user row + overrides + roles
  purged_by     uuid references users(id),
  reason        text,
  created_at    timestamptz not null default now()
);
create index if not exists ix_admin_purges_email on admin_purges (email);
```

### 1.4 Effective-permission computation (ABAC merge)

Add `getEffectivePermissions(userId)` to `userModel` / a new `access.service.js`:

```
rolePerms   = getUserRolesAndPermissions(userId).permissions        // from roles
overrides   = active permission_overrides WHERE user_id = userId
              AND (expires_at IS NULL OR expires_at > now())
              AND is_active
allowSet    = rolePerms ∪ {o.permission_key | o.effect='allow' AND matchesAbac(o.scope, ctx)}
denySet     = {o.permission_key | o.effect='deny' AND matchesAbac(o.scope, ctx)}
effective   = allowSet − denySet
if STORE_OWNER: effective = ['*']
```

`matchesAbac(scope, ctx)` evaluates scope/conditions against request context (store_id, resource_type, time, ip). Wire `require-admin.middleware.js:93` to call this so `req.admin.permissions` is always the live ABAC result.

---

## 2. Backend Architecture

### 2.1 Authorization (privilege-escalation safe)

Reuse existing middlewares; add two rules:

- **Lock / Unlock / Remove** of *any* admin → `requireStoreOwner` (Super Admin only).
- **Override grant** → Super Admin, or Manager for *lower* roles (reuse `admin-management.controller.js:179` checks). **New rule:** an actor may only grant an `allow` override whose `permission_key` they themselves effectively hold (Super Admin `'*'` exempt). A Manager cannot mint a permission they lack.

Add `is_locked` enforcement to `require-admin.middleware.js` (currently only `is_active` is checked, line 84):

```js
if (!user.is_active || user.is_locked || (user.lock_until && new Date(user.lock_until) > new Date())) {
  req.session?.destroy(() => {});
  return res.status(401).json({ success:false, error:'Account is locked. Contact a Super Admin.' });
}
```

### 2.2 New endpoints

Mount under `Backend/src/routes/admin/access.routes.js` (alongside `admin-management.routes.js`).

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| `POST` | `/admin/:id/lock` | `requireStoreOwner` | Explicit lock (manual). Body `{ reason }`. |
| `POST` | `/admin/:id/unlock` | `requireStoreOwner` | Clear `is_locked`/`lock_until`. |
| `DELETE` | `/admin/:id/remove` | `requireStoreOwner` | **Permanent purge** (archive + cascade delete). |
| `PATCH` | `/admin/:id/roles` | `requireStoreOwner`/`requireManager` | Reassign roles (existing logic). |
| `POST` | `/admin/:id/overrides` | `requireStoreOwner`/`requireManager` | Add granular override (allow/deny, scope, `expires_at`). |
| `GET` | `/admin/:id/overrides` | `requireManager` | List active+expired overrides for a user. |
| `PATCH` | `/admin/:id/overrides/:oid` | `requireStoreOwner`/`requireManager` | Edit (scope / extend / convert permanent↔temp). |
| `DELETE` | `/admin/:id/overrides/:oid` | `requireStoreOwner`/`requireManager` | Revoke an override early. |
| `GET` | `/admin/stream` | `requireAdmin` | **SSE** real-time event stream (per-connection). |

All mutating routes also: audit via `AuditService.log` (reuse `admin-management.controller.js` style) and publish a real-time event (§3).

### 2.3 Temporary-permission TTL strategy (dual mechanism)

1. **Passive (request-time):** `getEffectivePermissions` ignores overrides where `expires_at <= now()`. Always correct even if the job lags.
2. **Active (cleanup job):** new `Backend/src/jobs/override-expiry.job.js` via `cron` (register in `server.js` like the others at `server.js:36`):

```js
// every minute
new CronJob('* * * * *', require('./jobs/override-expiry.job'), null, true, 'UTC');
```

```js
// override-expiry.job.js
module.exports = async function overrideExpiryJob() {
  const { data } = await supabaseAdmin
    .from('permission_overrides')
    .update({ is_active: false })
    .eq('is_active', true)
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date().toISOString())
    .select('user_id');
  for (const row of data || []) {
    await realtime.publishToUser(row.user_id, { type:'permissions.updated', reason:'override_expired' });
  }
};
```

### 2.4 Real-time service (Redis Pub/Sub fan-out)

`Backend/src/services/realtime.service.js` — wrapper over `redisClient` (already configured in `config/redis.js`):

```js
const { redisClient } = require('../config/redis');
const USER_CH   = (uid) => `nova:rt:user:${uid}`;       // targeted to one admin's devices
const DASH_CH   = 'nova:rt:admin-dashboard';            // broadcast to owner/manager dashboards

async function publishToUser(userId, event) {
  await redisClient.publish(USER_CH(userId), JSON.stringify(event));
}
async function publishDashboard(event) {
  await redisClient.publish(DASH_CH, JSON.stringify(event));
}
// gateway subscribes once to both patterns and forwards to SSE sockets (§3)
module.exports = { publishToUser, publishDashboard, USER_CH, DASH_CH };
```

### 2.5 SSE gateway (zero new deps)

`Backend/src/realtime/sse.gateway.js` attached to the existing Express `app`/server (`server.js:72`). Authenticates via the session cookie (reuse `requireAdmin` semantics), then opens a long-lived `text/event-stream`:

- On connect: subscribe this socket to `USER_CH(req.admin.id)` + (if owner/manager) `DASH_CH`.
- On Redis message: write `data: <json>\n\n` to the socket.
- Heartbeat comment `: ping\n\n` every 25s to keep proxies alive.

Event vocabulary:
`account.locked`, `account.unlocked`, `account.removed`, `session.revoked`, `roles.updated`, `permissions.updated`, `admin.list.changed`.

---

## 3. Real-Time Synchronization Workflow

### 3.1 Lock a user (instant kill across all devices)

```
Super Admin ──POST /admin/:id/lock──▶ access.controller.lock()
   1. requireStoreOwner ✓
   2. users.update({ is_locked:true, lock_type:'manual', locked_by, locked_at, locked_reason })
   3. sessionModel.revokeAllAdminSessionsForUser(targetId)   // DB-level kill
   4. AuditService.log('admin.locked', ...)
   5. realtime.publishToUser(targetId, {type:'account.locked'})   ─┐
      realtime.publishDashboard({type:'admin.list.changed'})       ├─▶ Redis Pub/Sub
                                                                  │
   Target's open SSE stream (every device) ──▶ {type:'account.locked'} ─▶
      frontend: clear session, force redirect to /admin/login (toast: "Your account was locked")

   Subsequent requests from target: require-admin now rejects (is_locked) ✓
```

### 3.2 Permission / role override (instant re-eval, no logout)

```
Super Admin ──POST /admin/:id/overrides──▶ access.controller.addOverride()
   1. validate grantor holds permission_key (no escalation)
   2. insert into permission_overrides (effect, scope, expires_at)
   3. AuditService.log('admin.override.granted', ...)
   4. publishToUser(targetId, {type:'permissions.updated'}) + publishDashboard(list.changed)
        └─▶ target's SSE ─▶ frontend useRealtimeAdminEvents():
              invalidate ['my-permissions']; refetch; update AdminSessionContext
              → RequirePermission guards recompute live (no stale state)
   Request-time enforcement already correct because getEffectivePermissions reads overrides.
```

### 3.3 Remove (permanent purge)

```
Super Admin ──DELETE /admin/:id/remove──▶ access.controller.removeAdmin()
   1. requireStoreOwner ✓ ; block self
   2. snapshot user + roles + overrides → insert admin_purges (immutable)
   3. cascade: revokeAllAdminSessionsForUser; delete permission_overrides,
      user_roles, invitations where invited_email = user.email
   4. users.delete(id)   // hard purge
   5. AuditService.log('admin.removed', ...)
   6. publishToUser(targetId, {type:'account.removed'}) + publishDashboard(list.changed)
        └─▶ target SSE ─▶ force logout; Super Admin dashboard list refreshes instantly
```

---

## 4. Frontend Architecture

Stack already present: React + Vite + TS, TanStack Query, cookie/CSRF axios (`Frontend/src/admin/lib/api.ts`, `auth.ts`), `RequirePermission`/`RequireAuth`, `features/staff/*`.

### 4.1 New/updated files (under `Frontend/src/admin/`)

| File | Purpose |
|------|---------|
| `features/staff/AdminAccessConsole.tsx` | Master dashboard: table of admins w/ live status, Lock/Unlock/Remove, "Manage overrides" |
| `features/staff/LockUnlockButton.tsx` | Toggle lock w/ reason dialog (Super Admin only) |
| `features/staff/RemoveAdminDialog.tsx` | Confirm + reason → permanent purge (Super Admin only) |
| `features/staff/PermissionOverrideManager.tsx` | Add/edit/schedule overrides: effect (allow/deny), permission picker, ABAC scope, permanent vs TTL date |
| `features/staff/OverrideScheduler.tsx` | Time-bound UI (expires_at picker, "permanent" toggle) |
| `hooks/useRealtimeAdminEvents.ts` | Opens SSE `/api/v1/admin/stream`, dispatches events to query cache + session context |
| `hooks/useAdminAccessConsole.ts` | TanStack Query hooks for lock/unlock/remove/overrides (optimistic + invalidate) |
| `lib/realtime.ts` | SSE EventSource wrapper w/ auth cookie, auto-reconnect, heartbeat handling |

### 4.2 State management strategy

- **TanStack Query = cache of record.** `['admins']` (list), `['admin', id]`, `['admin', id, 'overrides']`, `['my-permissions']`. Mutations use `optimisticUpdate` + `onSuccess: invalidate`.
- **`useAdminSession` context** (`Frontend/src/admin/hooks/useAdminSession.tsx`) holds `{ roles, permissions }` driving `RequirePermission`. On a `permissions.updated` SSE event it calls `refetchPermissions()` so route/button guards recompute with **zero stale state**.
- **`useRealtimeAdminEvents`** (mounted once in `AppShell`) is the real-time spine:

```ts
switch (event.type) {
  case 'admin.list.changed':        queryClient.invalidateQueries(['admins']); break;
  case 'permissions.updated':
  case 'roles.updated':
    if (event.userId === me.id) { refetchPermissions(); queryClient.invalidateQueries(['my-permissions']); }
    break;
  case 'account.locked':
  case 'account.removed':
  case 'session.revoked':
    if (event.userId === me.id) { session.clear(); navigate('/admin/login'); toast(...); }
    break;
}
```

- **Defensive fallback:** `refetchOnWindowFocus` + 30s `refetchInterval` on `['my-permissions']` so a missed SSE frame can never leave a stale grant. SSE is primary, polling is belt-and-suspenders.
- **Instant UI feedback:** optimistic toggling of the Lock badge before the server confirms; rollback on error.

### 4.3 UI → behavior mapping

| Capability | Component | Event that keeps it live |
|------------|-----------|--------------------------|
| Role reassign | `EditStaffAccessModal` (extend) | `roles.updated` + `admin.list.changed` |
| Lock/Unlock | `LockUnlockButton` | `account.locked/unlocked` |
| Remove | `RemoveAdminDialog` | `account.removed` + `admin.list.changed` |
| Granular override (perm + temp) | `PermissionOverrideManager` / `OverrideScheduler` | `permissions.updated` |

---

## 5. Build Phases (execution order)

```
P0  SQL: 060 permission_overrides, 061 lifecycle cols, 062 admin_purges   Backend
P0  access.service.getEffectivePermissions + wire into require-admin       Backend
P1  access.routes/controller: lock, unlock, remove, overrides CRUD         Backend
P1  override-expiry cron job + register in server.js                       Backend
P1  AuditService calls + privilege checks (reuse controller patterns)      Backend
P2  realtime.service (Redis Pub/Sub) + sse.gateway + /admin/stream         Backend
P2  publish events from every mutating action (lock/unlock/remove/override)Backend
P3  Frontend: useRealtimeAdminEvents + lib/realtime (SSE)                   Frontend
P3  Frontend: AdminAccessConsole, LockUnlockButton, RemoveAdminDialog     Frontend
P3  Frontend: PermissionOverrideManager + OverrideScheduler               Frontend
P4  E2E: lock→all-devices-logout, override-TTL-expiry, remove-purge-archive
```

---

## 6. Security & Correctness Checklist

- [ ] `require-admin` rejects when `is_locked`/`lock_until` set (currently missing).
- [ ] Lock/Unlock/Remove require `requireStoreOwner`; self-action blocked.
- [ ] Override grantor cannot grant a permission they don't hold (no escalation).
- [ ] `deny` overrides beat `allow` + role perms in `getEffectivePermissions`.
- [ ] TTL overrides auto-expire (job) **and** are ignored at request time (passive).
- [ ] Hard delete archives to `admin_purges` before cascade.
- [ ] Every action audits + publishes real-time event.
- [ ] SSE authenticated via session cookie; CSRF exempt for GET stream; connections heartbeat.
- [ ] Redis Pub/Sub fan-out works across multiple server instances.

---

## 7. Mapping to existing code (for implementers)

- RBAC models: `Backend/src/models/{role,permission,user-role,user}.model.js`
- Auth/session: `Backend/src/middlewares/require-*.middleware.js`, `Backend/src/models/session.model.js` (`revokeAllAdminSessionsForUser`)
- Existing management logic to extend: `Backend/src/controllers/admin/admin-management.controller.js` (role/permission/revoke + hierarchy checks)
- Audit: `Backend/src/services/audit.service.js`, `Backend/src/models/audit-log.model.js`
- Redis/notification precedent: `Backend/src/config/redis.js`, `Backend/src/services/notification-queue.service.js`
- Cron precedent: `Backend/src/server.js:36`, `Backend/src/jobs/*.job.js`
- Frontend shell/guards: `Frontend/src/admin/{components,features/staff,hooks,lib}`
