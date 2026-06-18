# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-06-16

### Added
- **RBAC fixes and Notification templates (`046_rbac_fixes_and_templates.sql`)**:
  - Added `extra_permissions` JSONB column to `users` table for custom permission overrides.
  - Added `accepted_by` UUID foreign key referencing `users(id)` to the `invitations` table.
  - Re-mapped the `admin_auth_logs.admin_id` foreign key constraint to point to `users(id)` instead of the deprecated `admins` table.
  - Seeded three email templates (`admin_invitation`, `admin_invitation_accepted`, `admin_invitation_revoked`) into the `notification_templates` database.
- **CSRF Token endpoint (`GET /api/v1/auth/csrf-token`)**: Added endpoint for state-modifying requests on admin cookie-sessions.
- **Granular permission overrides**: Extended `getUserRolesAndPermissions` to load, merge, and clean role-based permissions along with `extra_permissions`.
- **Invitation Rate Limiting**: Added `inviteLimiter` to `rate-limit.middleware.js` and wired it into invitation endpoints.
- **API Documentation**: Added complete Swagger/OpenAPI documentation to invitation, accept-invite, and admin management endpoints.
- **Test Coverage**: Added integration tests in `admin-rbac.test.js` verifying the full login flow, CSRF validations, and dynamic permission inheritance.

### Changed
- **Authentication**: Refactored `admin-auth.service.js` to look up credentials, state active check, and lockouts in the `users` table instead of the deprecated `admins` table.
- **JWT token payload**: Corrected token role encoding from hardcoded `'admin'` to the user's dynamic role (`ADMIN` or `SUPER_ADMIN`).
- **Middlewares**: Updated `auth.middleware.js` to check admin sessions against the `users` table and dynamically merge database-assigned permissions.
- **CLI scripts**: Rewrote `create-admin.js` and `reset-password.js` to target the `users` table instead of the deprecated `admins` table.

### Removed
- Deprecated `adminRegister()` function in `auth.service.js`.
- Unused `hasAllPermissions` export in `permission.middleware.js`.
- Dynamic import from `cleanup.job.js` (moved to the top level).
