/**
 * @deprecated Use require-store-owner.middleware.js instead.
 *
 * This file is kept as a backward-compatibility shim so that any routes
 * that still import requireSuperAdmin continue to work during the
 * SUPER_ADMIN → STORE_OWNER migration.
 *
 * All new routes should import:
 *   const requireStoreOwner = require('./require-store-owner.middleware');
 */
const requireStoreOwner = require('./require-store-owner.middleware');

module.exports = requireStoreOwner;
