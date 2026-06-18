# SuperAdmin + Admin RBAC Implementation — Gap Analysis

> **Date**: 2026-06-16  
> **Scope**: Backend only — review of implemented SuperAdmin/Admin RBAC + Invitation system  
> **Source**: Reviewed all new and modified files from the implementation phase

---

## 1. What is Well Done

### Database Layer
- **Migration 045** (`sql/045_superadmin_rbac_invitations.sql`) is solid: `invitations` table with proper indexes, `SUPER_ADMIN` role seeded with idempotent `ON CONFLICT`, wildcard `*` permission ensured, `admins` table marked deprecated via comment.
- **Seed script** (`src/scripts/seed-superadmin.js`) correctly checks for existing SUPER_ADMIN before promoting, supports `SUPER_ADMIN_EMAIL` env var with sensible fallbacks.

### Model Layer
- `invitation.model.js` is well-structured: token generation (64-char hex), CRUD, pagination, expiry handling, proper error code handling for `PGRST116`.
- `user.model.js` additions (`findAdmins`, `findSuperAdmins`, `isSuperAdmin`, `getUserRolesAndPermissions`) are correct and query the `users` + `user_roles` + `roles` + `role_permissions` join properly.

### Middleware Layer
- **`require-admin.middleware.js`** (rewritten): Correctly queries `users` table, checks for ADMIN/SUPER_ADMIN roles, loads real permissions, no wildcard fallback for ADMIN, sets `req.admin` with proper shape. Session destroyed for inactive/invalid users.
- **`require-super-admin.middleware.js`**: Clean array-based middleware that chains after `requireAdmin`.
- **`permission.middleware.js`** (rewritten): `resolveActor` correctly prioritizes `req.admin` over `req.user`. `hasPermission`, `hasAnyPermission`, `hasAllPermissions` all properly check wildcard only for SUPER_ADMIN.

### Service Layer
- `invitation.service.js` is comprehensive: validates inviter is SUPER_ADMIN, checks for existing user/pending invite, defaults to ADMIN role, sends email with non-blocking try/catch, audit logs, cleanup method. Token validation uses generic error messages to prevent email enumeration.
- `notification.service.js` additions: three new email template methods (`sendAdminInvitationEmail`, `sendAdminInvitationAcceptedEmail`, `sendAdminInvitationRevokedEmail`) properly wrapped with error handling.

### Controller & Route Layer
- `invitation.controller.js`: Clean CRUD with proper auth checks. `listInvitations`/`getInvitation`/`revokeInvitation`/`resendInvitation` all enforce owner-or-SUPER_ADMIN access.
- `admin-management.controller.js`: Good self-prevention (can't modify own roles/revoke self), proper audit logging on all mutations.
- `accept-invite.controller.js`: Public endpoint with rate limiting, generic error messages, validates required fields.
- Route registration in `app.js` is correct: public routes mounted first, then admin auth (bypasses `requireAdmin`), then global `requireAdmin`, then protected admin routes with `requireSuperAdmin`.

### Testing
- Integration test file (`admin-rbac.test.js`) properly mocks external dependencies (Redis, connect-pg-simple, email, SMS, audit).
- Unit test file (`invitation.service.test.js`) covers create, accept, revoke, resend, permission denial scenarios.

### Cleanup Job
- Expired invitation cleanup added as step 5 in `cleanup.job.js`, properly imported and caught.

---

## 2. What is Incomplete and Needs Adjustment

### CRITICAL — Broken Admin Login Flow

| Issue | Files | Problem |
|-------|-------|---------|
| **Dual admin login systems** | `src/routes/admin/auth.routes.js`, `src/controllers/admin/auth.admin.controller.js`, `src/services/admin-auth.service.js` | `/admin/login` still uses `adminAuthService.login()` → queries `admins` table. But `require-admin.middleware.js` (v2) expects `req.session.adminId` to be a UUID from the `users` table. **Result: Admin login creates a session with an `admins` table ID, then `requireAdmin` tries to look it up in `users` table → 401 "Session invalid" on every admin route.** |
| **Hardcoded role in JWT** | `src/controllers/admin/auth.admin.controller.js:31` | JWT payload hardcodes `role: 'admin'` instead of reading from the user's actual role. SuperAdmin gets `role: 'admin'` in their token — downstream `admin` middleware check will fail for SUPER_ADMIN users. |

**Fix required**: Rewrite `admin-auth.service.js` to use `auth.service.js`'s `adminLogin()` method (which queries `users` table), or update `admin-auth.service.js` to query `users` table directly and return the user's actual roles.

### HIGH — Permission Persistence Gap

| Issue | File | Problem |
|-------|------|---------|
| **`updateAdminPermissions` doesn't persist** | `src/controllers/admin/admin-management.controller.js:162-165` | The method logs permissions to console but never writes them to the database. The comment references a `users.extra_permissions JSONB` column that doesn't exist in migration 045. **Granular per-admin permissions cannot actually be saved or enforced.** |
| **`invitation.accept()` doesn't store user reference** | `src/models/invitation.model.js:88-103` | The `accept` method sets `status: 'accepted'` and `accepted_at` but doesn't store the `user_id` of the newly created account. Cannot trace which user accepted which invitation. |

**Fix required**: Either add an `accepted_by` (user UUID) column to `invitations`, or add a JSONB `extra_permissions` column to `users` and update `getUserRolesAndPermissions()` to merge them.

### HIGH — Legacy Code Still References Deprecated `admins` Table

| Issue | Files | Problem |
|-------|-------|---------|
| **CLI scripts use `adminModel`** | `src/scripts/create-admin.js`, `src/scripts/reset-password.js` | These scripts still create/query the `admins` table (which is deprecated). They will create orphaned records not linked to the new `users` table system. |
| **`auth.middleware.js` session fallback** | `src/middlewares/auth.middleware.js:26,148` | `optionalAuth` middleware checks `req.session.adminId` and looks it up via `adminModel.findById()` (the `admins` table). This will fail for new admin sessions. |

**Fix required**: Update CLI scripts to use `users` table + `user_roles`. Update `auth.middleware.js` session fallback to use `userModel.findById()` instead of `adminModel.findById()`.

### MEDIUM — Missing Email Template Seeds

| Issue | Files | Problem |
|-------|-------|---------|
| **No `admin_invitation*` templates in SQL** | `sql/016_notifications_seed.sql` (or equivalent) | The three new template keys (`admin_invitation`, `admin_invitation_accepted`, `admin_invitation_revoked`) are used by `notification.service.js` but never seeded in the database. `NotificationTemplateModel.findByKey()` will return `null` → email sending will fail with "Template not found" and fall back to `customTitle`/`customMessage` which are also null → **invitation emails will silently fail**. |

**Fix required**: Add the three notification templates to a seed SQL file.

### MEDIUM — `auth.service.js` `adminRegister()` Is Dead Code

| Issue | File | Problem |
|-------|------|---------|
| **Unreachable admin registration** | `src/services/auth.service.js:757-790` | `adminRegister()` is still present but with no route calling it. The controller blocks it. This is dead code that should be removed to avoid confusion. |

### MEDIUM — Missing Swagger Documentation

| Issue | Files | Problem |
|-------|-------|---------|
| **No Swagger for new endpoints** | invitation routes, admin-management routes, accept-invite routes | All new endpoints lack `@swagger` annotations. API docs will be incomplete. |

### LOW — Minor Code Issues

| Issue | File | Problem |
|-------|------|---------|
| **Dead import in `permission.middleware.js`** | `src/middlewares/permission.middleware.js:1` | `logger` is imported and used, but `require-admin.middleware.js` doesn't use it. Actually, permission.middleware.js does use it. No issue. |
| **Dead export** | `permission.middleware.js:138` | `hasAllPermissions` is exported but never used anywhere in the codebase. |
| **`invitation.model.js` line 95 dead code** | `src/models/invitation.model.js:95` | `permissions: supabaseAdmin.rpc ? undefined : undefined` — always undefined, no effect on the update. |
| **`requireAdmin` re-queries** | `src/middlewares/require-admin.middleware.js` | If `optionalAuth` already set `req.admin`, `requireAdmin` re-queries the database. Not a bug, just an unnecessary query. |
| **`cleanup.job.js` dynamic import** | `src/jobs/cleanup.job.js:83` | `require('../services/invitation.service')` is inside the try block. Should be at top of file for consistency. |

---

## 3. What Doesn't Exist but is Essential

### Missing CSRF Token Endpoint

| Issue | Problem |
|-------|---------|
| **No way to fetch CSRF token** | `csrf.middleware.js` validates `x-csrf-token` header or `_csrf` body field against `req.session.csrfToken`. But there is **no endpoint** to retrieve the initial token, and no mechanism (like a `<meta>` tag or cookie) to deliver it to the client. State-modifying requests from a browser will fail with 403 because the client has no way to obtain the token. |

**Required**: Add `GET /api/v1/auth/csrf-token` endpoint that returns `{ csrfToken: req.session.csrfToken }` (creating it if missing), or set a `non-csrf` cookie with the token value.

### Missing Granular Permission Storage

| Issue | Problem |
|-------|---------|
| **Per-admin extra permissions not persisted** | `updateAdminPermissions` logs to console but doesn't save. The plan proposed either a separate `admin_extra_permissions` table or a JSONB column on `users`. Without this, SuperAdmin's "determine what a particular admin will have access to" feature is incomplete. |

**Required**: Add `extra_permissions JSONB DEFAULT '[]'` column to `users` table (in migration), update `getUserRolesAndPermissions()` to merge `extra_permissions` into the returned array, and wire `updateAdminPermissions` to actually save.

### Missing Invitation Audit Trail in SQL

| Issue | Problem |
|-------|---------|
| **No `invitation_audit` or similar** | All invitation actions are logged via `AuditService.log()` to the `audit_logs` table, but there's no dedicated `invitations` history/audit sub-table. If an invitation is modified (resent, permissions changed), the previous state is lost. |

**Required**: Either add `invitation_audit_logs` table, or ensure `audit_logs` captures sufficient `old_values`/`new_values` on invitation mutations.

### Missing Invitation Rate Limiting

| Issue | Problem |
|-------|---------|
| **No rate limit on invite creation** | `invitation.routes.js` uses `requireSuperAdmin` but no rate limiter. A compromised SuperAdmin session could spam invitations. |

**Required**: Add `inviteLimiter` to `rate-limit.middleware.js` and apply to invitation creation endpoint.

### Missing Integration Test for Full Login Flow

| Issue | Problem |
|-------|---------|
| **No test for admin login → session → protected route** | `admin-rbac.test.js` mocks the middleware chain. There's no test verifying that an admin created via invitation can log in via `/admin/login` and access a `requireAdmin`-protected endpoint. |

### Missing Invitation Permission Inheritance Test

| Issue | Problem |
|-------|---------|
| **No test that invitation.permissions are enforced** | If `extra_permissions` column is added, need tests verifying that an admin invited with `['product:create']` can create products but cannot access user settings. |

### Additional Missing Items from Original Plan

| Item | Status |
|------|--------|
| `docker-compose.yml` | ❌ Missing |
| Root `README.md` | ❌ Missing |
| `CHANGELOG.md` | ❌ Missing |
| `CONTRIBUTING.md` | ❌ Missing |
| `.editorconfig` | ❌ Missing |
| Image upload endpoint for products | ❌ Missing (frontend would need it too) |
| Full-text search endpoint wired up | ❌ SQL exists but no controller/route |
| Multi-currency endpoint | ❌ SQL exists but no controller/route |
| Configurable tax rules consumed in checkout | ❌ Table exists but checkout still uses hardcoded rate |

---

## 4. Recommended Fix Priority

### P0 — Fix Before Any Admin Can Log In
1. **Rewrite `admin-auth.service.js`** to use `users` table instead of `admins` table
2. **Fix `auth.admin.controller.js`** JWT role to use actual role from DB
3. **Add CSRF token endpoint** (`GET /api/v1/auth/csrf-token`)
4. **Seed invitation email templates** in SQL

### P1 — Fix Before RBAC Is Production-Ready
5. **Add `extra_permissions JSONB` column to `users` table** (migration 046)
6. **Wire `updateAdminPermissions` to persist** to `users.extra_permissions`
7. **Update `getUserRolesAndPermissions()`** to merge `extra_permissions`
8. **Update/remove legacy CLI scripts** (`create-admin.js`, `reset-password.js`)
9. **Fix `auth.middleware.js` session fallback** to use `userModel` instead of `adminModel`

### P2 — Polish & Hardening
10. **Remove dead code**: `adminRegister()` from `auth.service.js`, `hasAllPermissions` export, dead line in `invitation.model.js`
11. **Add rate limiting** to invitation creation
12. **Add Swagger docs** for all new endpoints
13. **Add integration test** for full admin login → protected route flow
14. **Add invitation audit log tests**

---

## 5. Acceptance Criteria Checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Existing admin promoted to SUPER_ADMIN | ✅ Done (seed script) |
| 2 | SUPER_ADMIN role exists with `*` permission | ✅ Done (migration 045) |
| 3 | SuperAdmin can send email invitations | ✅ Done |
| 4 | Invitee receives email with secure token link | ⚠️ Partial — code works, but templates not seeded → emails will fail |
| 5 | Invitee can accept invitation and set password | ✅ Done |
| 6 | SuperAdmin can view all admins | ✅ Done |
| 7 | SuperAdmin can update admin roles | ✅ Done (roles persisted) |
| 8 | SuperAdmin can update admin granular permissions | ❌ Not persisted — only logged |
| 9 | SuperAdmin can revoke admin access | ✅ Done |
| 10 | Non-SUPER_ADMIN cannot invite or manage admins | ✅ Done |
| 11 | Expired/revoked invitations rejected | ✅ Done |
| 12 | Cleanup job removes expired invitations | ✅ Done |
| 13 | Invitation actions audit-logged | ✅ Done (AuditService.log called) |
| 14 | Admin login works with new `users` table system | ❌ **BROKEN** — `/admin/login` still uses `admins` table |
| 15 | CSRF token fetchable by client | ❌ **Missing** — no endpoint or mechanism |
| 16 | Admin login session compatible with `requireAdmin` middleware | ❌ **BROKEN** — dual system mismatch |
