# API Versioning Strategy

This document outlines the API versioning strategy and policies for Nova Store backend, detailing how version increments, breaking changes, and deprecations are managed.

## 1. Versioning Protocol

Nova Store uses **URL path versioning** for all public API endpoints:
```
https://api.novastore.com/api/v1/...
```
This is the most reliable, transparent, and developer-friendly approach to REST API versioning.

---

## 2. Defining Breaking vs. Non-Breaking Changes

Maintaining backward compatibility is critical to prevent breaking downstream clients (Web frontend, mobile apps).

### Non-Breaking Changes (v1 Minor / Patch updates)
- Adding new optional request query parameters or request body fields.
- Adding new fields to response JSON payloads.
- Deprecating old endpoints (while keeping them fully functional).
- Enhancing performance, internal bug fixes, or optimizing queries.

### Breaking Changes (Requires a new version, e.g., `/v2/`)
- Renaming existing request fields or query parameters.
- Removing fields from request bodies or response payloads.
- Changing data types of existing fields (e.g., changing an ID from an Integer to a UUID).
- Changing HTTP status codes returned under standard success/error paths.
- Changing URL routing patterns or HTTP methods for existing operations.

---

## 3. Deprecation and Sunset Policy

When an API feature is superseded, we follow a structured deprecation process before removal:

1. **Deprecation Notice**: Mark the endpoint as deprecated in the OpenAPI/Swagger specification.
2. **Deprecation Headers**: Include standard HTTP headers on all responses from the deprecated endpoint:
   - `Deprecation: true`
   - `Sunset: Date` (the date of absolute removal, minimum 6 months from deprecation)
3. **Analytics Tracking**: Log warnings internally whenever a client accesses a deprecated route to identify legacy consumers.

---

## 4. Implementation Guidelines

- **Separate Routes per Version**: Keep v1 and v2 route handlers in separate directories (e.g., `src/routes/v1/...`).
- **Shared Controllers & Services**: Reuse underlying business logic in services where possible. If input payloads diverge, write adaptation layers in the version-specific controller before dispatching to the services.
