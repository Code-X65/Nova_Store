# BACKEND GAP ANALYSIS — Nova Store API

**Generated:** 2026-05-11  
**Scope:** Full backend codebase analysis covering all API endpoints, controllers, services, models, middleware, database schema, and tests.

---

## TABLE OF CONTENTS

1. [What Was Done Perfectly](#1-what-was-done-perfectly)
2. [What Needs To Be Completed](#2-what-needs-to-be-completed)
3. [What Needs To Be Added](#3-what-needs-to-be-added)
4. [What Needs To Be Removed](#4-what-needs-to-be-removed)

---

## 1. WHAT WAS DONE PERFECTLY

### 1.1 Authentication & Security

| Aspect | Details |
|--------|---------|
| **JWT Authentication** | Full implementation with access tokens (15min expiry) and refresh tokens (30 days) stored in HttpOnly cookies |
| **Password Hashing** | bcrypt with salt rounds for all password operations |
| **Account Lockout** | Auto-lock after 5 failed attempts for 15 minutes (`incrementFailedAttempts` / `resetFailedAttempts`) |
| **Email Verification** | Token-based email verification with 24-hour expiry, resend capability |
| **Password Reset** | Secure token-based reset with 1-hour expiry and automatic session invalidation on password change |
| **Rate Limiting** | Tiered rate limiting: auth (5/15min), reset (3/hr), refresh (10/15min), admin (100/15min), general API (200/15min) — all backed by Redis |
| **XSS Sanitization** | Global XSS sanitization middleware for body, query, and params |
| **Helmet Security Headers** | Comprehensive CSP, HSTS, frameguard, XSS filter, referrer policy, etc. |
| **CORS** | Properly configured with credentials support |
| **Request Correlation ID** | Unique request ID middleware with response header |
| **CSRF for OAuth** | OAuth state cookie with 15-minute expiry for Google OAuth flow |
| **OAuth Token Refresh** | Automatic session revocation and rotation on refresh |

### 1.2 Database & Data Layer

| Aspect | Details |
|--------|---------|
| **SQL Migrations** | 20 sequential migration files with proper ordering, covering all tables, indexes, constraints, triggers, and RPC functions |
| **Supabase Integration** | Clean connection setup with service role key support |
| **Soft Delete Pattern** | Consistent `deleted_at` / `is_active` pattern across products, users, coupons, categories, brands |
| **Inventory Transactions** | Full audit trail of all stock movements with type classification (sale, restock, adjustment, return, reservation) |
| **Database Triggers** | Automated `updated_at` trigger, product rating stats trigger, review helpfulness count trigger |
| **PostgreSQL RPC Functions** | `create_order_with_items` (atomic), `get_sales_summary`, `get_best_sellers`, `get_user_growth`, `get_low_stock_products`, `is_coupon_valid_for_user`, `increment_coupon_usage` |
| **Indexes** | Proper indexes on all foreign keys, unique constraints, and commonly filtered columns |

### 1.3 API Structure & Architecture

| Aspect | Details |
|--------|---------|
| **MVC Pattern** | Clean separation: routes → controllers → services → models |
| **Consistent Response Format** | All endpoints use `{ success, data/message, ... }` pattern |
| **Error Handling** | Centralized error middleware with proper HTTP status codes, error codes, and stack traces |
| **Swagger Documentation** | Comprehensive OpenAPI 3.0 documentation on all major endpoints |
| **Modular Routes** | Well-organized route files split by domain (auth, user, products, orders, etc.) |
| **Middleware Chain** | Proper middleware composition: request-id → optionalAuth → maintenance → helmet → CORS → rate-limit → body-parser → sanitize → routes → error-handler |

### 1.4 Core Business Logic

| Aspect | Details |
|--------|---------|
| **Cart System** | Full guest + authenticated cart with merge capability, auto-creation, proper pricing |
| **Order Lifecycle** | Complete flow: create → validate → process → ship → deliver → cancel with inventory restoration |
| **Coupon Engine** | Percentage/fixed discounts, per-customer limits, min order amounts, bulk generation, usage analytics |
| **Inventory Management** | Stock tracking, low-stock alerts, threshold configuration, transaction history |
| **Notification System** | Multi-channel (email, SMS, in-app), template system, user preferences, broadcast capability |
| **Review System** | One review per user per product, verified purchase tracking, helpfulness voting with toggle |
| **Onboarding** | Multi-step questionnaire with conditional logic, feature unlocking based on answers |
| **RBAC** | Role-permission system with `protect`, `admin`, `hasPermission`, `authorize` middleware layers |
| **Address Management** | Full CRUD with default address handling, automatic first-address-default logic |

### 1.5 Testing

| Aspect | Details |
|--------|---------|
| **Integration Tests** | Auth flow tests (register, login, password validation, duplicate email) including onboarding |
| **Unit Tests** | AuthService tests with mocked dependencies (login success, user not found, account locked, unverified email) |
| **Test Setup** | Proper Jest configuration with setup/teardown and Redis disconnect cleanup |
| **Onboarding Tests** | Integration tests for onboarding endpoints with proper cleanup |

---

## 2. WHAT NEEDS TO BE COMPLETED

### 2.1 Incomplete or Stub Implementations

| Item | Location | Issue |
|------|----------|-------|
| **SMS Service** | `src/services/sms.service.js` | Entirely stubbed — returns `{ success: true, messageId: 'stub-sms-...' }`. No actual Twilio/provider integration. |
| **OAuth (Apple & Facebook)** | `auth.service.js` `getOAuthStatus` | References `apple_id` and `facebook_id` fields in DB and user model, but no OAuth routes or controller methods exist for Apple/Facebook login. |
| **Email Change Flow** | `user.service.js` — `verifyEmailChange` | The `requestEmailChange` stores a verification token but links it to the user (not the new email). The `verifyEmailChange` requires the user to provide `newEmail` again, which is awkward UX. The code comment says: *"Better: Add a column for 'new_email' in verification_tokens."* |
| **Maintenance Mode** | `maintenance.middleware.js` | Only checks `req.user.role === 'ADMIN'` with the legacy `role` field. Does NOT check for the new RBAC `roles` array (e.g., `req.user.roles.includes('admin')`). New-style admin users cannot bypass maintenance during RBAC migration. |
| **RBAC Inconsistency** | Multiple files | Role check in `maintenance.middleware.js` (line 9) uses `req.user.role` but other admin routes use `hasPermission()` or `authorize('ADMIN')` which checks `req.user.roles`. Both should be consistent. |
| **`permissionController.getAllPermissions`** | `permission.routes.js` | Route exists but is a simple pass-through to `permissionModel.findAll()` with no pagination, no filtering, no caching — potentially dangerous to expose full permissions list without restriction. |
| **Product Variants** | `product.controller.js` | `createProduct` accepts `variants` in body but there is no dedicated variant CRUD endpoint. Variant management is embedded in product creation only. |
| **`updateOrderStatus`** | `order.service.js` | The service comment says *"For now, let's just update the status and history"* and *"We might need a generic update method in OrderModel"* — this is acknowledged as incomplete. |
| **Payment Webhook Stripe Support** | `payment.service.js` — `verifySignature` | Stripe signature verification returns `true` unconditionally: `return true; // Implement for other providers...` |
| **`/api/v1/shipping` route in app.js** | `app.js` line 137 | Mounts `shippingRoutes` at `/api/v1/shipping` but the admin shipping routes are mounted separately at `/api/v1/admin/shipping`. The public shipping `calculate` POST at `/shipping/calculate` conflicts with app.js route structure — verify `/api/v1/shipping/calculate` actually works as expected. |

### 2.2 Missing Business Logic

| Item | Details |
|------|---------|
| **Order Refund Processing** | No endpoint or service method for processing refunds. The `payments` table schema supports `refunded` status, and `order_status_history` supports `refunded` status, but no code path exists. |
| **Return Management** | Orders table has `return_reason` and `return_status` columns, and status check allows `returned`, but no endpoint or service exists for managing returns. |
| **Wishlist Event Notifications** | No notifications are sent when a user adds/removes items from wishlist. The `NotificationService` has no wishlist-related triggers. |
| **Order Status Notification Templates** | `order.service.js` calls `sendToUser` for `order_shipped` and `order_delivered` but `NotificationService.sendToUser` requires matching notification templates. No code verifies these templates actually exist. |
| **Bulk Order Operations** | No admin endpoint for bulk updating, deleting, or exporting orders. |
| **Product Image Management** | No endpoint for managing the `image_gallery` array on products. Only `primary_image_url` is set via product create/update. |
| **Review Reporting/Moderation Queue** | No reporting system for inappropriate reviews. Admin can moderate (approve/hide/delete) but there's no user-facing "report" endpoint or reported reviews queue. |
| **Duplicate Review Prevention** | `review.service.js` checks `findByUserAndProduct` before creating but doesn't verify `orderId` matches the product — a user with multiple delivered orders for the same product could exploit the orderId parameter. |
| **Session Cleanup** | No cron job or cleanup mechanism for expired sessions in DB or Redis. |
| **Token Cleanup** | No cleanup of expired/used verification tokens and password reset tokens. They accumulate indefinitely. |
| **Coupon Usage Recording** | `coupon.service.js` — `validateAndApplyCoupon` validates coupon eligibility and calculates discount but **never calls `CouponModel.incrementUsage()` or `CouponModel.logUserUsage()`**. Coupons are validated but usage is never recorded in `user_coupons` table and `used_count` is never incremented. |
| **`per_customer_limit` Bypass via guest checkout** | When `userId` is null (guest), the per-customer coupon limit check is skipped entirely. Users can create unlimited accounts to reuse single-use coupons. |

### 2.3 Test Gaps

| Item | Details |
|------|---------|
| **No product endpoint tests** | Zero tests for products, categories, brands, inventory endpoints |
| **No order endpoint tests** | Zero tests for orders, checkout, payments endpoints |
| **No user profile endpoint tests** | No tests for user profile, avatar upload, email change, address CRUD |
| **No notification endpoint tests** | No tests for notification endpoints |
| **No cart/wishlist endpoint tests** | No tests for cart or wishlist functionality |
| **Low unit test coverage** | Only `auth.service.test.js` has meaningful unit tests — no tests for other services |
| **No e2e tests** | No end-to-end test pipeline |
| **Estimated test coverage** | < 5% of backend code |
| **Onboarding test** | `tests/integration/onboarding.test.js` exists but may not be properly configured (was found open in environment) |

---

## 3. WHAT NEEDS TO BE ADDED

### 3.1 Missing Endpoints

| Missing Endpoint | Priority | Details |
|------------------|----------|---------|
| **`POST /api/v1/orders/:id/refund`** | HIGH | Schema supports `refunded` status and `refund_reason`, but no endpoint exists |
| **`POST /api/v1/orders/:id/return`** | HIGH | Schema supports `return_status` column, but no return management endpoint |
| **`POST /api/v1/products/:id/images`** | MEDIUM | No image gallery management endpoint |
| **`POST /api/v1/auth/apple/login`** | MEDIUM | DB schema has `apple_id` column but no OAuth route |
| **`POST /api/v1/auth/facebook/login`** | MEDIUM | DB schema has `facebook_id` column but no OAuth route |
| **`POST /api/v1/auth/unlink/:provider`** | LOW | No endpoint to unlink OAuth accounts |
| **`POST /api/v1/orders/bulk-action`** | LOW | Admin bulk operations for orders (analogous to review bulk-action) |
| **`GET /api/v1/products/:id/related`** | LOW | Related products recommendation endpoint |
| **`POST /api/v1/reviews/:id/report`** | MEDIUM | User-reported reviews endpoint and moderation queue |
| **`POST /api/v1/webhooks/sms`** | LOW | SMS delivery status webhook endpoint |
| **`GET /api/v1/stats/summary`** | LOW | Public-facing store stats (total products, orders, users count) |
| **`PUT /api/v1/products/:id/variants/:variantId`** | MEDIUM | Update individual variant (currently only bulk within product update) |
| **`DELETE /api/v1/products/:id/variants/:variantId`** | MEDIUM | Delete individual variant |

### 3.2 Missing Services/Utilities

| Missing Service | Priority | Details |
|-----------------|----------|---------|
| **SMS Provider Integration** | HIGH | Replace stub in `sms.service.js` with actual Twilio/vonage integration |
| **Audit Logger Integration** | HIGH | `audit.service.js` exists but is never called from any business service. Add `auditService.log()` calls to product CRUD, order status changes, user updates, coupon modifications, etc. |
| **Coupon Usage Recording** | HIGH | Fix `validateAndApplyCoupon` to actually call `CouponModel.incrementUsage()` and `CouponModel.logUserUsage()` after successful validation |
| **Inventory Reservation System** | MEDIUM | Reserve stock during checkout to prevent overselling (the `reservation` type exists in `inventory_transactions` schema but no service logic implements it) |
| **Session Cleanup Job** | MEDIUM | Cron/scheduled job to purge expired sessions from DB and Redis |
| **Token Cleanup Job** | MEDIUM | Cron/scheduled job to purge expired/used tokens from DB |
| **Email Template Renderer** | MEDIUM | Use proper Handlebars/template rendering instead of simple string `.replace()` with regex |
| **Search/Elasticsearch Service** | MEDIUM | Product search uses basic `ilike` queries — implement full-text search for better performance |
| **Queue System** | MEDIUM | Notification broadcasting and email sending should use a queue (acknowledged in comments) |
| **Price History Tracking** | LOW | No price change tracking for products — schema doesn't have a `price_history` table |
| **Customer Segment Service** | LOW | User classification logic based on order history, loyalty points, etc. |

### 3.3 Missing Infrastructure

| Item | Priority | Details |
|------|----------|---------|
| **Complete Seeder Scripts** | MEDIUM | `003_seed_onboarding.sql` and `007_seed_products_data.sql` exist but no seeder for default roles, permissions, admin user, shipping zones/rates, notification templates, or settings |
| **Default Data Setup** | HIGH | First-run setup script to create default roles (USER, ADMIN), permissions, admin user, default shipping zone, default notification templates, and default settings |
| **Health Check Enhancement** | LOW | `/health` endpoint only returns basic status — should include DB connectivity, Redis status check |
| **Pagination Max-Limit Enforcement** | LOW | No global maximum limit on paginated queries — a client could request `limit=10000` |
| **Request/Response Logging** | MEDIUM | Winston logger exists (`utils/logger.js`) but is not integrated into the request middleware chain. No access logging. |
| **API Versioning Strategy** | LOW | Current version is hardcoded as `/api/v1` prefix — no version negotiation or deprecation headers |
| **Rate Limiter by User ID** | MEDIUM | Current rate limiters use IP-based keys. Authenticated endpoints should also consider per-user rate limiting. |

### 3.4 Missing Frontend-Supporting Features

| Item | Priority | Details |
|------|----------|---------|
| **Real-time Stock Validation on Cart Add** | HIGH | Cart `addItem` doesn't validate stock availability — only `checkout/validate` checks stock at checkout time. Users can fill carts with unavailable items. |
| **Cart Price Synchronization** | MEDIUM | Cart stores `unit_price` at add-time and never refreshes. If product price changes between cart add and checkout, users pay stale prices. |
| **Address Geocoding/Validation** | MEDIUM | No address validation or geocoding for shipping accuracy |
| **Customer Account Deletion Compliance** | MEDIUM | `deleteAccount` anonymizes user record but does not handle right-to-erasure for related records (orders, reviews, notifications, etc.) which may contain PII |
| **Webhook Signature Verification for Stripe** | HIGH | `verifySignature` returns `true` unconditionally for Stripe — no actual signature verification |
| **Guest Checkout User Conversion** | MEDIUM | No endpoint to link guest orders to a newly created account post-purchase |

---

## 4. WHAT NEEDS TO BE REMOVED (OR REVISED)

### 4.1 Dead/Unused Code

| Item | Location | Issue | Action |
|------|----------|-------|--------|
| **Hardcoded shipping costs in checkout** | `checkout.service.js:145-167` | `getShippingCost` contains legacy hardcoded costs (`standard: 1500`, `express: 3500`, `pickup: 0`). The `ShippingService.calculateShippingOptions` already implements proper rate-based calculation. | **Remove** legacy fallback costs or keep only as last-resort fallback with a TODO comment |
| **Hardcoded shipping in checkout controller** | `checkout.controller.js:22-25` | `calculateShipping` returns hardcoded options completely ignoring `ShippingService`. | **Replace** with `shippingService.calculateShippingOptions()` call |
| **`authorize` middleware** | `auth.middleware.js:51-60` | The `admin` middleware checks `req.user.role === 'ADMIN'` which bypasses the RBAC permission system. Every other admin route uses `hasPermission()` or `authorize(roleName)` from `role.middleware.js`. | **Remove** or **refactor** to check `req.user.roles` for consistency |
| **`req.user.role` checks scattered in code** | Multiple locations including `maintenance.middleware.js`, `auth.controller.js`, `onboarding.service.js` | These bypass the RBAC system. `maintenance.middleware.js` checks `req.user.role === 'ADMIN'` but RBAC-enabled admin users have roles as array (`req.user.roles`). | **Revise** all checks to use `req.user.roles && req.user.roles.includes('admin')` or `hasPermission` |

### 4.2 Security Concerns Requiring Immediate Action

| Item | Location | Issue |
|------|----------|-------|
| **RBAC bypass in maintenance** | `maintenance.middleware.js:9` | Only checks legacy `req.user.role === 'ADMIN'`. Any admin user created via `hasPermission('role:manage')` route (new RBAC system) but without `role: 'ADMIN'` literal string is blocked during maintenance. The inverse is also true — users with `role: 'ADMIN'` but no proper permissions can bypass. |
| **Auth routes bypass RBAC** | `auth.routes.js:224-243` | Uses `authorize('ADMIN')` (legacy role check) instead of `hasPermission('user:read')`. This creates two different authorization paradigms for admin access. |
| **Maintenance mode allows registration** | `app.js:50-51` | `optionalAuth` and `maintenanceMiddleware` are applied globally. The maintenance middleware allows all `/api/v1/auth` routes including `POST /register`. Malicious actors can create accounts during maintenance. |
| **No self-review-vote prevention** | `review.service.js:115` | `voteHelpful` does not check if the user voting is the same user who wrote the review. |
| **Guest coupon abuse** | `coupon.service.js:54-69` | When `userId` is null (guest checkout), per-customer coupon limits are entirely bypassed. |
| **User data leakage in profile** | `user.service.js:18` | Uses destructuring `const { password_hash, ...profile } = user` which only removes `password_hash`. Other sensitive fields like `google_id`, `apple_id`, `facebook_id`, `failed_login_attempts`, `lock_until` are exposed. |

### 4.3 Deprecated/Inconsistent Patterns

| Item | Issue |
|------|-------|
| **Mixed controller export patterns** | Auth and User controllers use class-based export (`class Foo {} module.exports = new Foo()`). Review, analytics, and admin controllers use `exports.functionName = ...`. Standardize on class-based pattern. |
| **Mixed validation strategy** | Some routes define Joi schemas at route level and use `validate()` middleware. Others validate inside controllers or skip validation entirely (e.g., `coupon.routes.js` `validateCoupon` has no schema in the route). Standardize validation at route level. |
| **Hardcoded tax rate** | `checkout.service.js:171` — `0.075` (7.5% VAT) is hardcoded. Should be pulled from settings database table. The settings table already exists but tax config is not used. |
| **Magic status strings** | `order.service.js:30` — `['shipped', 'delivered', 'cancelled', 'returned', 'refunded']` are hardcoded. Should use constants or enum validation. |
| **`onboarding_status` uses string literals** | `onboarding.model.js` and `onboarding.controller.js` use hardcoded strings `'not_started'`, `'in_progress'`, `'completed'`, `'skipped'`. Should be enum constants. |

### 4.4 Redundant Functionality

| Item | Details |
|------|---------|
| **Duplicate shipping calculation** | `checkout.controller.js:calculateShipping` returns hardcoded options AND `shipping.controller.js:calculateShipping` uses `ShippingService`. These serve the same purpose inconsistently. Consolidate into one path. |
| **Duplicate coupon validation** | `coupon.controller.js:validateCoupon` and `checkout.controller.js:applyCoupon` both call `CouponService.validateAndApplyCoupon`. The validate endpoint is redundant with apply — consider returning validation info from apply endpoint or merging them. |
| **Double `getOrCreateCart` calls** | `cart.controller.js` calls `getOrCreateCart` in every handler, which creates a cart if none exists. Multiple sequential calls (e.g., in `updateItemQuantity`, `removeItem`) create and fetch the cart twice. Optimize by passing the existing cart through the service chain. |

---

## SUMMARY STATISTICS

| Metric | Count |
|--------|-------|
| **Total API Routes** | 68+ unique endpoints across 24 route files |
| **Controllers** | 20 controller files (17 base + 3 admin subdirectory) |
| **Services** | 18 service files |
| **Models** | 25 model files |
| **Middleware** | 10 middleware files |
| **Database Tables** | 25 tables |
| **SQL Migrations** | 20 migration files |
| **Stored Procedures/RPCs** | 7 RPC functions (`create_order_with_items`, `get_sales_summary`, `get_best_sellers`, `get_user_growth`, `get_low_stock_products`, `is_coupon_valid_for_user`, `increment_coupon_usage`) |
| **Test Files** | 3 test files (~15 individual tests total) |
| **Unit Test Files** | 2 test files |
| **Integration Test Files** | 1 test file (auth) + onboarding |
| **Estimated Test Coverage** | < 5% |

---

## PRIORITY MATRIX

### 🔴 CRITICAL — Blocks Production Readiness

1. **Coupon usage not recorded** — `validateAndApplyCoupon` (`coupon.service.js:45-98`) validates and calculates discount but never calls `incrementUsage()` or `logUserUsage()`. This means single-use coupons can be used infinitely.

2. **SMS service is pure stub** — `sms.service.js` returns fake success for every message. All SMS notifications (order updates, password reset if configured) silently fail.

3. **RBAC inconsistency creates privilege escalation risk** — `auth.routes.js` uses legacy `authorize('ADMIN')` checking `req.user.role`, while all other admin routes use `hasPermission()` checking `req.user.permissions`. A user with permissions but `role !== 'ADMIN'` is denied by auth routes but accepted by others.

4. **Maintenance bypass allows user registration** — All `/api/v1/auth` routes (including `/register`) bypass maintenance mode check.

### 🟠 HIGH PRIORITY

5. **No refund/return endpoints** — Database schema fully supports `refunded` status and `return_status`, but no API exists to process them.

6. **No audit logging in business services** — `audit.service.js` exists and works, but is never called from any controller or service except test references.

7. **No session/token garbage collection** — Expired sessions and used tokens accumulate in DB and Redis indefinitely.

8. **Inventory race condition** — No reservation system during checkout. Two concurrent checkouts for the same product can over-sell stock.

9. **Stripe webhook signature not verified** — Accepts any payload as valid Stripe webhook.

### 🟡 MEDIUM PRIORITY

10. **No product image gallery management API**
11. **Cart adds unvalidated stock** — Users can add out-of-stock items to cart
12. **Cart uses stale prices** — Unit price locked at add-time, not refreshed at checkout
13. **No email template verification** — Order shipped/delivered notifications called but templates not verified to exist
14. **No queue system for async notifications** — Email/SMS sent synchronously during checkout
15. **Seeder scripts incomplete** — No seed for roles, permissions, admin user, shipping zones, notification templates
16. **No user data cleanup on account deletion** — GDPR compliance gap

### 🟢 LOW PRIORITY

17. **Hardcoded tax rate** should be settings-driven (7.5% in code, settings table exists)
18. **Legacy hardcoded shipping costs** — Duplicate of proper rate-based system
19. **Health endpoint** should check DB and Redis connectivity
20. **API versioning strategy** — No version negotiation or deprecation headers
21. **No request/access logging middleware** — Winston logger exists but not in middleware chain
22. **Mixed controller export patterns** — Should standardize to class-based
23. **No related products or recommendation engine**
24. **OAuth (Apple/Facebook)** — DB columns exist but no routes/controllers