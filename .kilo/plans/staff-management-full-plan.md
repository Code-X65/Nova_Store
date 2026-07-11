# Staff Management — Full Implementation Plan (Frontend + Backend)

> Unified plan covering the complete staff lifecycle: **Invitation → Acceptance → Onboarding → Management → Revocation → Audit**.
> Pairs frontend and backend, maps to what is already on the ground, and closes all identified gaps.

---

## 0. Current State Summary

| Layer | Status | Notes |
|-------|--------|-------|
| Database (schema/migrations) | ❌ Not in repo | `sql/053–057` applied to DB but not tracked; only 4 legacy SQL files in `sql/` |
| RBAC middleware | ✅ Ready | `requireAdmin`, `requireStoreOwner`, `requireManager`, `requireOrderStaff`, `requireInventoryStaff` |
| User/Role/Permission/Invitation models | ✅ Ready | Full CRUD + RBAC helpers |
| Invitation service | ✅ Ready | Create/accept/list/revoke/resend/cleanup; role validation + store scoping |
| Admin auth (session cookie + JWT) | ✅ Ready | Login/verify/logout, session table, Redis cache, CSRF |
| Staff list + role/permission PATCH | ✅ Ready | `GET/PATCH/DELETE /admin/:id` + roles/permissions |
| My Permissions endpoint | ✅ Ready | `GET /admin/my-permissions` |
| Frontend shell + guards | ✅ Ready | LoginPage, AppShell, Sidebar, RequireAuth, RequirePermission |
| Frontend staff pages | ✅ Ready | StaffList, Invitations, RoleManager, EditStaffAccessModal, MyPermissions |
| Sales/Inventory routes | ⚠️ Partial | Use `hasPermission` instead of role-specific middleware |
| Order status transition validation | ❌ Missing | Service-layer validation for ORDER_STAFF transitions |
| Accept-invite frontend UI | ❌ Missing | No page in frontend repo |
| SQL migrations tracked in Git | ❌ Missing | Must add `sql/053–057` to repo |

---

## 1. Backend Plan

### 1.1 Phase 1 — Database & Seeding (Immediate)

#### 1.1.1 Add missing migrations to version control
Create the following files under `Backend/sql/` (they already exist in the DB):

- `053_create_stores_table.sql`
- `054_add_store_id_to_tables.sql`
- `055_update_create_order_rpc.sql`
- `056_add_store_id_to_rpcs.sql`
- `057_rbac_store_staff_roles.sql`

This ensures fresh installs, CI/CD, and onboarding work correctly.

#### 1.1.2 Fix MANAGER permission seed
The current MANAGER role seed lacks permissions that the route guards require. Update `sql/057` (or create `057b_manager_permissions.sql`) to assign:

```
category:create, category:write, brand:create, brand:write,
analytics:read, settings:read, settings:write, audit:read,
coupon:create, coupon:write, coupon:delete, coupon:read,
shipping:read, shipping:write, review:read, review:write,
notification:read, notification:write
```

#### 1.1.3 Add `getRoleByName` to Role model
Ensure `RoleModel.findByName(name)` is available (exists as alias to `findByName`). Add explicit `getRoleByName` method for clarity.

### 1.2 Phase 2 — Order & Inventory Route Hardening (HIGH PRIORITY)

#### 1.2.1 Order routes: enforce role middleware
In `Backend/src/routes/order.routes.js`, switch write/fulfillment endpoints from `hasPermission('order:write')` to `requireOrderStaff`:

```js
const requireOrderStaff = require('../../middlewares/require-order-staff.middleware');

// Fulfillment endpoints — role-gated
router.post('/admin/:id/ready', requireOrderStaff, orderController.markReady);
router.post('/admin/:id/dispatch', requireOrderStaff, orderController.dispatchOrder);
router.post('/admin/:id/deliver', requireOrderStaff, orderController.deliverOrder);
router.patch('/admin/:id', requireOrderStaff, orderController.updateOrderStatus);

// Read endpoints — permission-gated (cross-department OK)
router.get('/admin/list', hasPermission('order:read'), orderController.getAllOrders);
router.get('/admin/dispatch-queue', hasPermission('order:read'), orderController.getDispatchQueue);
```

#### 1.2.2 Inventory routes: enforce role middleware
In `Backend/src/routes/inventory.routes.js`, switch mutation endpoints to `requireInventoryStaff`:

```js
const requireInventoryStaff = require('../../middlewares/require-inventory-staff.middleware');

router.post('/stock', requireInventoryStaff, ...);
router.post('/reduce', requireInventoryStaff, ...);
router.post('/alerts', requireInventoryStaff, ...);
router.put('/:id/threshold', requireInventoryStaff, ...);

// Read endpoints stay permission-gated
router.get('/low-stock', hasPermission('inventory:read'), ...);
router.get('/transactions', hasPermission('inventory:read'), ...);
```

#### 1.2.3 Order service: status transition validation
In `Backend/src/services/order.service.js`, add role-aware transition validation:

```js
function validateStatusTransition(currentStatus, newStatus, adminRole) {
  const TRANSITIONS = {
    ORDER_STAFF: ['confirmed', 'processing', 'ready_for_dispatch', 'dispatched', 'out_for_delivery', 'delivered'],
    MANAGER: ['*'],  // all transitions
    STORE_OWNER: ['*'],
  };

  if (adminRole === 'ORDER_STAFF') {
    const blocked = ['cancelled', 'refunded', 'returned'];
    if (blocked.includes(newStatus)) {
      throw new Error('ORDER_STAFF cannot perform this status transition');
    }
  }
  // ... existing validation
}
```

#### 1.2.4 Admin management routes: correct middleware
In `Backend/src/routes/admin/admin-management.routes.js`:

```js
router.get('/', requireManager, adminController.listAdmins);
router.get('/:id', requireManager, adminController.getAdmin);
router.patch('/:id/roles', requireManager, adminController.updateAdminRoles);
router.patch('/:id/permissions', requireManager, adminController.updateAdminPermissions);
router.get('/:id/permissions', requireManager, adminController.getAdminPermissions);
router.delete('/:id', requireStoreOwner, adminController.revokeAdminAccess);
router.get('/my-permissions', requireAdmin, adminController.getMyPermissions);
```

### 1.3 Phase 3 — Invitation System Enhancements

The invitation service is mostly complete. Verify/clarify:

| Endpoint | Status | Action |
|----------|--------|--------|
| `POST /admin/invitations` | ✅ | Create + email |
| `GET /admin/invitations` | ✅ | List (store-scoped) |
| `GET /admin/invitations/:id` | ✅ | Get single |
| `DELETE /admin/invitations/:id` | ✅ | Revoke |
| `POST /admin/invitations/:id/resend` | ✅ | Resend + extend |
| `GET /api/v1/accept-invite/:token` | ✅ | Validate (public) |
| `POST /api/v1/accept-invite/:token` | ✅ | Accept (public) |

No changes needed if these endpoints work. If `roleId` is not required in POST, enforce it.

#### 1.3.1 Optional: invitation expiry config
Add a configurable `INVITATION_EXPIRY_HOURS` (default 72h) in `Backend/src/config/store.js` instead of hardcoding.

### 1.4 Phase 4 — Cross-Department & Sales Endpoints

Add sales endpoints for INVENTORY_STAFF if missing:

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/v1/admin/sales/reports` | GET | `hasPermission('sales:read')` | Sales reports |
| `/api/v1/admin/sales/daily-summary` | GET | `hasPermission('sales:read')` | Daily summary |
| `/api/v1/admin/sales/top-products` | GET | `hasPermission('sales:read')` | Top products |
| `/api/v1/admin/sales/order-tracking` | GET | `hasPermission('order:read')` | Order tracking |
| `/api/v1/admin/dashboard/order-stats` | GET | `requireOrderStaff` | Order KPIs |
| `/api/v1/admin/dashboard/inventory-stats` | GET | `requireInventoryStaff` | Inventory KPIs |

Mount them in `Backend/src/routes/admin/sales.routes.js` or `admin-management.routes.js`.

### 1.5 Phase 5 — Audit Logging

Ensure these actions are logged via the audit system:
- Invitation created / revoked / resend
- Staff member role/permissions changed
- Staff member revoked (soft delete)
- Admin login with role badge
- Order status changes by role

### 1.6 Phase 6 — CORS Fix

Update `Backend/src/config/cors.js` (or wherever CORS is configured) to allow both origins:
- `https://novastore.com` (storefront)
- `https://admin.novastore.com` (admin)

Plus dev origins:
- `http://localhost:5173`
- `http://localhost:5174`

Use an allowlist array instead of single `CLIENT_URL`.

---

## 2. Frontend Plan

### 2.1 Phase 1 — Staff Invitation Flow (Job #1)

**Pages to implement:**

#### 2.1.1 Invitations Page (`src/admin/features/staff/Invitations.tsx`) — ENHANCE
Already exists. Verify it supports:
- **Send Invite**: email + role dropdown (ORDER_STAFF, INVENTORY_STAFF, MANAGER) — managers can only invite lower roles
- **List**: pending/accepted/expired/revoked status badges
- **Actions**: resend (extends expiry), revoke (soft delete), copy invite link
- **Validation**: email format, no duplicate pending invites, role restrictions enforced backend-side

#### 2.1.2 Accept Invite Page (`src/admin/features/staff/AcceptInvite.tsx` or public route)
New file. Public route at `/accept-invite/:token` (or live at admin subdomain).

```
Flow:
1. User receives email with link: https://admin.novastore.com/accept-invite/token
2. Opens page → validates token via GET /api/v1/accept-invite/:token
3. Shows: "You've been invited to join [Store Name] as [Role Name]"
4. If already logged in → auto-accept + redirect to dashboard
5. If not logged in → show registration form (name + password)
6. POST /api/v1/accept-invite/:token with { name, password }
7. Success → auto-login → redirect to dashboard
```

Place under `src/admin/features/staff/AcceptInvite.tsx` and add route in `routes.tsx`.

### 2.2 Phase 2 — Staff Management Pages (ENHANCE existing)

#### 2.2.1 Staff List (`src/admin/features/staff/StaffList.tsx`) — ALREADY EXISTS
Verify it shows:
- Name, email, role(s), status (active/inactive), last login, joined date
- Filter by role, status, search
- Role badges with color coding
- "Edit Access" button → opens `EditStaffAccessModal`
- "Revoke Access" button (STORE_OWNER only, with confirmation dialog)

#### 2.2.2 Edit Staff Access Modal (`src/admin/features/staff/EditStaffAccessModal.tsx`) — ALREADY EXISTS
Should allow:
- Role assignment (multi-select, with hierarchy warnings)
- Extra permissions toggle (granular)
- Manager cannot assign higher roles (UI should disable/hide)
- Save → PATCH /admin/:id/roles + PATCH /admin/:id/permissions

#### 2.2.3 Role Manager (`src/admin/features/staff/RoleManager.tsx`) — ALREADY EXISTS
Should allow:
- View all roles (system + custom)
- Create custom role (name + description + permission picker)
- Edit custom role (rename + reassign permissions)
- Delete custom role (system roles protected)
- System role detail view (read-only)

### 2.3 Phase 3 — Accept Invite & Registration (NEW)

| File | Path | Purpose |
|------|------|---------|
| `AcceptInvite.tsx` | `src/admin/features/staff/AcceptInvite.tsx` | Public token validation + registration |
| `useAcceptInvite.ts` | `src/admin/features/staff/hooks/useAcceptInvite.ts` | Hook for validate/accept flow |
| Route | `routes.tsx` | `/accept-invite/:token` (public, no RequireAuth) |

### 2.4 Phase 4 — My Permissions Page (ENHANCE)

`src/admin/features/staff/MyPermissions.tsx` — ALREADY EXISTS
- Show current roles (badges)
- Show all granted permissions (grouped by category)
- Show "effective" vs "extra" permissions
- Read-only self-service view

### 2.5 Phase 5 — Permission-Driven Gate Enhancements

Ensure `src/admin/lib/permissions.ts` helpers are used consistently:
- `hasPermission(perms, 'order:write')`
- `hasRole(perms, 'STORE_OWNER', 'MANAGER')` — variadic
- `isOwner(perms)`, `isManager(perms)`, `isOrderStaff(perms)`, `isInventoryStaff(perms)`

Use `<RequirePermission>` for page guards and `can('order:write')` for button-level gating.

### 2.6 Phase 6 — Sidebar Nav Matrix

Verify `src/admin/components/layout/Sidebar.tsx` uses the permission matrix from `frontend-admin-plan.md` §6:
- Staff → `staff:read`
- Customer → `user:read` or `role:manage`
- Coupons → `coupon:read`
- Shipping → `shipping:read`
- Reviews → `review:read`
- Sales → `sales:read`
- Settings → `settings:read`
- Currencies → `settings:read`
- Audit → `audit:read`
- Notifications Admin → `notifications:write`

### 2.7 Phase 7 — CORS & Auth Fix for Admin Subdomain

- Update `Frontend/src/shared/api/clients/cookieClient.ts` to use `https://admin.novastore.com` in prod
- Update `Frontend/vite.config.ts` (if exists) proxy for dev
- Ensure `withCredentials: true` is set on cookieClient
- CSRF interceptor: fetch token on app init, cache, attach to mutations

### 2.8 Phase 8 — Notifications for Staff Events

Hook into existing notification system (`Backend/src/services/notification.service.js`):

| Event | Notification |
|-------|-------------|
| Invitation sent | "You've been invited to [Store] as [Role]" → email to invited user |
| Invitation accepted | "X joined your team as [Role]" → to inviter |
| Staff revoked | "Your access to [Store] has been revoked" → to departed user |
| Role changed | "Your role has been updated to [Role]" → to staff member |

Frontend: NotificationBell dropdown lists these events.

---

## 3. Implementation Execution Order

```
Priority     Task                                      Layer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
P0 (NOW)    Add SQL migrations to repo                  Backend
P0 (NOW)    Fix MANAGER permission seed                 Backend
P0 (NOW)    Add getRoleByName to RoleModel              Backend
P0 (NOW)    CORS allowlist fix                          Backend
P1          Order routes: requireOrderStaff             Backend
P1          Inventory routes: requireInventoryStaff     Backend
P1          Order service: status transition validation Backend
P1          Admin management routes: correct middleware  Backend
P2          Accept-invite frontend page                 Frontend
P2          Invitations page enhancements               Frontend
P2          Staff List page verification                Frontend
P3          My Permissions page verification            Frontend
P3          Role Manager page verification              Frontend
P3          Sidebar nav matrix verification             Frontend
P4          Staff event notifications                   Backend + Frontend
P4          Sales/dashboard endpoints                   Backend
P4          Audit logging for staff actions             Backend
P4          E2E testing: invitation → acceptance → login → role check → action → audit
```

---

## 4. API Contract (Staff Lifecycle)

### 4.1 Invitation
```
POST /api/v1/admin/invitations          Body: { email, roleId }         Auth: requireManager
GET  /api/v1/admin/invitations          Query: ?status=&role=&page=    Auth: requireManager
GET  /api/v1/admin/invitations/:id                              Auth: requireManager
DELETE /api/v1/admin/invitations/:id                           Auth: requireManager (lower staff)
POST /api/v1/admin/invitations/:id/resend                     Auth: requireManager
```

### 4.2 Public Acceptance
```
GET  /api/v1/accept-invite/:token                              Auth: None (public)
POST /api/v1/accept-invite/:token    Body: { name, password }    Auth: None (public)
```

### 4.3 Staff Management
```
GET  /api/v1/admin                      Query: ?role=&search=&page=  Auth: requireManager
GET  /api/v1/admin/:id                                     Auth: requireManager
PATCH /api/v1/admin/:id/roles       Body: { roleIds: [...] }      Auth: requireManager
PATCH /api/v1/admin/:id/permissions Body: { extraPermissions }    Auth: requireManager
GET  /api/v1/admin/:id/permissions                          Auth: requireManager
DELETE /api/v1/admin/:id                                    Auth: requireStoreOwner
GET  /api/v1/admin/my-permissions                           Auth: requireAdmin
```

### 4.4 Roles & Permissions
```
GET  /api/v1/roles                           Auth: protect + role:manage
POST /api/v1/roles                           Auth: protect + role:manage
PATCH /api/v1/roles/:id                      Auth: protect + role:manage
DELETE /api/v1/roles/:id                     Auth: protect + role:manage
POST /api/v1/roles/:id/permissions           Auth: protect + role:manage
GET  /api/v1/permissions                     Auth: protect
GET  /api/v1/permissions/categories          Auth: protect
GET  /api/v1/user-routes/:userId             Auth: protect + role:manage
POST /api/v1/user-routes/:userId             Auth: protect + role:manage
DELETE /api/v1/user-routes/:userId/:roleId   Auth: protect + role:manage
```

### 4.5 Admin Sessions
```
GET  /api/v1/admin/sessions/                    Auth: requireAdmin
DELETE /api/v1/admin/sessions/:sessionId        Auth: requireAdmin
DELETE /api/v1/admin/sessions/                  Auth: requireAdmin
```

---

## 5. Permission Matrix Summary

| Role | order | inventory | product | catalog | sales | coupon | shipping | admin | role | staff | settings | audit | notification |
|------|-------|-----------|---------|---------|-------|--------|----------|-------|------|-------|----------|-------|--------------|
| STORE_OWNER | `*` | `*` | `*` | `*` | `*` | `*` | `*` | `*` | `*` | `*` | `*` | `*` | `*` |
| MANAGER | r/w | r/w | crud | manage | r | crud | r/w | access | manage (lower only) | r (no revoke) | r/w | r | r/w |
| ORDER_STAFF | r (fulfill only) | r | r | r | r | — | — | access | — | — | — | — | — |
| INVENTORY_STAFF | r | r/w/alert | r | r | r | — | — | access | — | — | — | — | — |

Legend: `r` = read, `w` = write, `access` = admin panel, `—` = no access, `*` = wildcard/all

---

## 6. Testing Checklist

### 6.1 Backend
- [ ] MANAGER can invite ORDER_STAFF but cannot invite MANAGER/STORE_OWNER
- [ ] INVITE token accepted → user created with correct role
- [ ] invited user can login → has correct permissions
- [ ] ORDER_STAFF cannot cancel/refund/return orders
- [ ] ORDER_STAFF can fulfill: pending→confirmed→processing→ready→dispatched→out_for_delivery→delivered
- [ ] INVENTORY_STAFF cannot access fulfillment endpoints
- [ ] STORE_OWNER can revoke any staff member
- [ ] MANAGER cannot revoke STORE_OWNER or other MANAGER
- [ ] Manager cannot edit higher-role staff permissions
- [ ] Audit log records all staff operations
- [ ] CSRF token required for mutations
- [ ] CORS allows both admin and storefront origins

### 6.2 Frontend
- [ ] LoginPage works with role-based redirect
- [ ] Sidebar shows correct nav items per role
- [ ] RequirePermission guard redirects unauthenticated users
- [ ] Invitations page: send → list → resend → revoke
- [ ] StaffList: shows all staff, edit modal opens, revoke works (owner only)
- [ ] RoleManager: create/edit/delete custom roles
- [ ] AcceptInvite page: token validation → registration → auto-login
- [ ] NotificationBell shows staff invites/joins
- [ ] MyPermissions shows accurate effective permissions
- [ ] Button-level gating: `can('order:write')` hides action buttons correctly

---

## 7. Environment Config

### Backend (`.env`)
```env
# RBAC
ADMIN_ROLES=STORE_OWNER,MANAGER,ORDER_STAFF,INVENTORY_STAFF

# Invitation
INVITATION_EXPIRY_HOURS=72

# CORS (allowlist)
ADMIN_ALLOWED_ORIGINS=https://admin.novastore.com,http://localhost:5174
STOREFRONT_ALLOWED_ORIGINS=https://novastore.com,http://localhost:5173
```

### Frontend
```env
VITE_ADMIN_API_URL=https://api.novastore.com/api/v1
VITE_ADMIN_APP_URL=https://admin.novastore.com
```

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| SQL migrations not tracked → DB drift on new deploy | High | High | Add `sql/053–057` to Git immediately |
| MANAGER blocked from catalog/settings pages | High | Medium | Fix permission seed SQL |
| ORDER_STAFF bypass via permission middleware | Medium | High | Switch to `requireOrderStaff` |
| CORS blocks admin cookies in prod | Medium | High | Allowlist both origins |
| Invitation email not delivered | Medium | Medium | Verify SMTP config + fallback UI for copy link |
| Frontend monorepo path divergence | Low | Low | Current flat structure works; refactor later |

---

## 9. What Is Already Done ✅

1. Full RBAC models (User, Role, Permission, UserRole, Invitation, Store)
2. Complete middleware stack (requireAdmin, requireStoreOwner, requireManager, requireOrderStaff, requireInventoryStaff)
3. Invitation service with role validation + store scoping + email
4. Admin session management (cookie + JWT + CSRF + Redis)
5. Staff list + role/permission assignment endpoints
6. Admin auth controller (login/verify/logout)
7. Frontend: Login, AppShell, Sidebar (permission-driven), guards, StaffList, Invitations, RoleManager, EditStaffAccessModal, MyPermissions
8. Frontend API client (cookie-based with CSRF interceptor)
9. TanStack Query integration
10. Audit logging infrastructure
11. Notification service (email + in-app)

---

## 10. What Still Needs to be Done ❌

1. Add `sql/053–057` to Git repo
2. Fix MANAGER permission seed (missing catalog/settings/audit permissions)
3. Order routes → `requireOrderStaff` for write/fulfill
4. Inventory routes → `requireInventoryStaff` for mutations
5. Order service → status transition validation by role
6. Admin management routes → correct middleware chain
7. CORS allowlist for both admin + storefront origins
8. Accept-invite frontend page
9. Sales/dashboard endpoints for cross-department access (if missing)
10. Staff event notifications (invite accepted, role changed, revoked)
11. E2E test suite for invitation → acceptance → role enforcement → audit trail
