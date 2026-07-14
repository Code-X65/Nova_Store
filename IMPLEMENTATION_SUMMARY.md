# Nova_Store — Admin Dashboard Implementation Summary

Status of the 8-phase blueprint (`.kilo/plans/1783921353827-glowing-moon.md`).

## Phase 1 — Catalog & Inventory Governance — COMPLETE & VERIFIED

This is the only phase with a concrete build plan, and it is fully implemented, wired, and tested.

### Schema (`Backend/sql/076_catalog_inventory_governance.sql`)
- `product_options` / `product_option_values` / `product_variant_options` — canonical variant option matrix. Includes a best-effort backfill of legacy `product_variants.option_values` JSONB.
- `warehouses` + `inventory_levels` (product/variant x warehouse) with a trigger `trg_sync_product_stock` that keeps the legacy `products.stock_quantity` aggregate in sync.
- `stock_alert_rules` (scope/product/variant/warehouse/global, channels, recipient_role).
- `import_jobs` (status, totals, error rows, `error_file_url`, `file_format`).
- RLS disabled on all new tables (backend-managed access).

### Backend services (`Backend/src/services/`)
- `catalog-variant.service.js` — build variant combinations from option matrix; `replaceVariantOptions` preserves stock on signature match; `migrateLegacyOptionValues`.
- `warehouse.service.js` — list/create/update/delete, `setLevel`, `getStockByLocation`, `transferStock` (writes `transfer_in`/`transfer_out` inventory_transactions, respects reserved stock).
- `inventory-alert.service.js` — `checkProductStock` evaluates `stock_alert_rules` and emits `inventory.stock_low`; CRUD for rules.
- `bulk-import.service.js` — Excel (`.xlsx`/`.xls`) parse, column to field mapping, per-row validation, writers for product/category/inventory/variant, reject-sheet generation. Pure helpers exported for unit testing.
- `bulk-import.worker.js` — Redis-list (`nova:import:queue`) consumer, 3s poll, resilient (swallows per-job errors).

### Routes / controllers (`Backend/src/routes/admin/`, `Backend/src/controllers/admin/`)
- `warehouse.routes.js` / `warehouse.controller.js` — GET/POST `/warehouses`, stock get/set, `/transfer`. Guarded by `requireInventoryStaff` for mutations.
- `import.routes.js` / `import.controller.js` — POST `/import` (multer, `.xlsx`/`.xls` only), GET `/import/:id`, GET `/import/:id/errors` (downloads reject sheet).
- `variant.routes.js` / `variant.controller.js` — GET/POST `/admin/products/:id/variant-options` (`product:read`/`product:write`).
- `stock-alert.routes.js` / `stock-alert.controller.js` — list/create/update/delete rules.
- All mounted in `Backend/src/app.js`; route files are untracked (new).

### Worker startup (`Backend/src/server.js`)
- Bug fixed: `startImportWorker()` was imported but never called at boot (imports would silently process synchronously on Redis failure only). Now started at boot alongside the notification worker; removed a duplicate `shutdownImportWorker()` call in graceful shutdown.

### Frontend (`Frontend/src/admin/features/`)
- `catalog/BulkImport.tsx` — entity-type select, upload, polling progress, error-sheet download.
- `catalog/VariantManager.tsx` — option matrix editor driving `replaceVariantOptions`.
- `inventory/Warehouses.tsx` + stock-by-location transfer UI.
- `inventory/AlertRules.tsx` — threshold/channel/recipient configuration.
- `PermissionGuard.tsx` + route-level `RequirePermission` guards applied across inventory/catalog.

### Post-review fixes (catalog/inventory correctness)
- `catalog-variant.service.js`: `replaceVariantOptions` now deletes the product's stale `product_variants` before rebuilding (previously left orphaned/duplicated variant rows that double-counted stock). Enriched the variant-options query with the option `name` and keyed stock preservation by `name=value` signature so existing variant stock is correctly carried over.
- `warehouse.service.js`: `transferStock` now uses `.is('col', null)` for the nullable product/variant dimension instead of `.eq(col, null)` (which PostgREST evaluates as never-true), so product-only and variant-only transfers locate the source level correctly.
- `bulk-import.service.js`: writers are now per-row fault-tolerant (a bad row is pushed to the reject sheet and the import continues) instead of throwing and re-marking every remaining valid row as rejected; parse uses `raw: true` to preserve numeric/date cell values.
- `import.controller.js`: removed a leftover debug block that wrote `controller_debug.txt` on module load; deleted `Backend/controller_debug.txt` and `Backend/scratch/`.


- New unit tests: `bulk-import.test.js`, `catalog-variant.test.js`, `inventory.service.test.js`, `audit-diff.test.js`.
- Fixed stale test drift in `inventory.service.test.js` and `order.service.test.js` (source gained `store_id`/`reason_code`/`warehouse_location`/`batch_lot` and rider fields during the working-tree lifecycle work). All 229 unit tests pass.

### Verification
- `Backend`: `npm run test:unit` -> 229 passed, 229 total.
- `Frontend`: `npm run build` -> builds successfully (vite + tsc). (Note: `npm run lint` currently errors due to an `eslint/config` ESM export mismatch in `eslint.config.js` — a tooling/environment issue, not source. Build/typecheck is the authoritative check.)

## Business-model & currency cleanups (1.1, 4) — DONE

## Phase 3 — RBAC & Profile Security — COMPLETE & VERIFIED

### Schema (`Backend/sql/078-081_*`, applied)
- `078_admin_security_2fa.sql` — `admin_security` table (TOTP secret, hashed recovery codes) + `users.two_factor_enabled` flag.
- `079_admin_ip_allowlist.sql` — `admin_ip_allowlist` (CIDR, role_scope, active) seeded with loopback + private ranges for owner/manager roles.
- `080_sessions_enhancements.sql` — `sessions` device fingerprint / UA / IP columns.
- `081_rbac_new_roles.sql` — 6 target roles (SUPER_ADMIN, CATALOG_MANAGER, LOGISTICS_COORDINATOR, CUSTOMER_SUPPORT, FINANCE_AUDITOR, MARKETING_SPECIALIST) + NGN-only permission catalog and per-role grants. STORE_OWNER kept as wildcard alias.

### Backend (services / controllers / routes / middleware)
- `two-factor.service.js` — TOTP enroll (secret + QR + recovery codes), verify, disable (password-gated), recovery-code redemption.
- `ip-allowlist.middleware.js` — enforces `admin_ip_allowlist` for sensitive roles on every admin route (fail-open when no entry matches the actor's roles); IPv6 `::1`/mapped-addr normalization; 30s cache; audits denials. (Bug fixed: was referencing an undefined `AuditService` and had dead `net` code.)
- `security.routes.js` (2FA) + `ip-allowlist.routes.js` — **newly mounted in `app.js`** (were previously unwired dead code).
- `ipAllowlistMiddleware` applied globally to `/api/v1/admin` after `requireAdmin`.
- Audit non-repudiation: `audit-log.model.verifyChain()` + `audit.service.verifyChain()` + `audit.controller.verifyChain()` + `POST/GET /admin/audit/verify` recompute the `record_hash`/`prev_record_hash` chain and report any tampering.

### Frontend (`Frontend/src/admin/`)
- `settings/SecuritySettings.tsx` — 2FA enable (QR + manual key + recovery codes), verify, disable (password), recovery-code redeem.
- `staff/IpAllowlist.tsx` — CRUD for IP allowlist ranges + role scopes.
- `audit/AuditLogs.tsx` — "Verify Integrity" panel showing chain verification result + broken-record table.
- Routes + Sidebar wired (`/settings/security`, `/staff/ip-allowlist`); gated by `settings:read` / `rbac:read`.

### Verification
- `Backend`: `npm run test:unit` -> 229 passed. All changed modules pass `node --check`.
- `Frontend`: `npm run build` -> builds successfully.
- DB: migrations `078-081` applied and recorded via `schema_migrations`.

### Known issue (pre-existing, out of scope)
- The bulk `run-migrations.js` fails on `023_catalog_audit_extensions.sql` because that migration was applied to the DB earlier but never recorded in `schema_migrations`, and the `audit_logs` append-only trigger now blocks its re-application. Phase 3 migrations were applied with a targeted idempotent script instead. The runner's self-heal only triggers when `schema_migrations` is empty; a partial-state resync would be needed to make the bulk runner usable again.
- 1.1 NGN-only: `StoreSettings.tsx` currency `<select>` (NGN/USD/EUR/GBP) replaced with a fixed read-only NGN (symbol) label; form now always submits `currency: 'NGN'`. `stores.currency` already defaults to `'NGN'`.
- 4 single-vendor: Dropped `'marketplace'` from the `stores.business_type` CHECK (`053_create_stores_table.sql`); removed the `'vendor'` example from the `roles` seed comment (`004_create_roles_tables.sql`). No `vendor*` permission keys are present.

## Remaining phases (specified, NOT yet built)
These are blueprints requiring their own migrations/services/routes/frontend and are outside the concrete Phase 1 scope:
- Phase 2 — System Settings & Config (structured config groups, shipping zones, SEO). WARNING: the multi-currency `CurrenciesPage` + `/currencies` backend routes remain and contradict 1.1; full removal is pending.
- Phase 3 — RBAC & Profile Security — DONE (see below).
- Phase 4 — Order & Lifecycle (state machine, invoicing, refunds/disputes) — partially present in tree (`order.service.js` dispatch/lifecycle + tests).
- Phase 5 — Logistics & Fulfillment (3PL, rider live-track, reverse logistics) — riders partially present.
- Phase 6 — Marketing & Promotion (discount engine, flash sales, loyalty, campaigns).
- Phase 7 — CRM & Support (segments, tickets, comms log, behavior events).
- Phase 8 — Analytics & Audit (real-time BI, forecasting, heatmaps, hash-chain verify).

## How to run Phase 1
1. Apply migrations (incl. `076_catalog_inventory_governance.sql`).
2. `cd Backend && npm run test:unit` (green).
3. `cd Frontend && npm run build` (green).
4. Start backend (`npm run dev`) — import worker auto-starts; upload an `.xlsx` workbook at Catalog -> Bulk Import.
