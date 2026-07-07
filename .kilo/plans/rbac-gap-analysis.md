# Gap Analysis: RBAC Store Staff Implementation

## Executive Summary

The RBAC system has been **significantly implemented** but requires **some refinements** to fully align with the business requirements.

---

## ✅ ALREADY IMPLEMENTED (Database Layer)

### SQL Migrations
| File | Status | Description |
|------|--------|-------------|
| `sql/053_create_stores_table.sql` | ✅ Complete | Stores + store_settings tables with branding, hours, contact info |
| `sql/054_add_store_id_to_tables.sql` | ✅ Complete | store_id added to all entity tables with backfill logic |
| `sql/055_update_create_order_rpc.sql` | ✅ Complete | RPC updated for store context |
| `sql/056_add_store_id_to_rpcs.sql` | ✅ Complete | RPCs return store_id for filtering |
| `sql/057_rbac_store_staff_roles.sql` | ✅ Complete | All roles (STORE_OWNER, MANAGER, ORDER_STAFF, INVENTORY_STAFF) seeded |

### Database Changes
- ✅ Store table with branding, hours, social links, business info
- ✅ All entity tables have `store_id` column
- ✅ Default "Nova Store" created and all existing data backfilled
- ✅ Role hierarchy properly seeded

---

## ✅ ALREADY IMPLEMENTED (Backend Layer)

### Models
| File | Status | Notes |
|------|--------|-------|
| `src/models/store.model.js` | ✅ Complete | findById, findBySlug, findUserStore, getDefaultStore |
| `src/models/user.model.js` | ✅ Updated | getUserRolesAndPermissions includes store context |

### Middleware
| File | Status | Notes |
|------|--------|-------|
| `src/middlewares/require-admin.middleware.js` | ✅ Complete | ADMIN_ROLES array, hasRole helper, store_id attached |
| `src/middlewares/require-store-owner.middleware.js` | ✅ Complete | STORE_OWNER check only |
| `src/middlewares/require-manager.middleware.js` | ✅ Complete | STORE_OWNER + MANAGER access |
| `src/middlewares/require-order-staff.middleware.js` | ✅ Complete | STORE_OWNER + MANAGER + ORDER_STAFF access |
| `src/middlewares/require-inventory-staff.middleware.js` | ✅ Complete | STORE_OWNER + MANAGER + INVENTORY_STAFF access |
| `src/middlewares/store-context.middleware.js` | ✅ Complete | Resolves store context per request |
| `src/middlewares/scope-to-store.middleware.js` | ✅ Complete | Enforces store scoping |

### Services
| File | Status | Notes |
|------|--------|-------|
| `src/services/invitation.service.js` | ✅ Mostly Complete | Validates inviter is STORE_OWNER/MANAGER, scopes to store, validates role restrictions |

### Controllers
| File | Status | Notes |
|------|--------|-------|
| `src/controllers/admin/invitation.controller.js` | ✅ Mostly Complete | Uses requireManager, calls invitation service |
| `src/controllers/admin/admin-management.controller.js` | ✅ Complete | Role management with hierarchy validation |

### Routes
| File | Status | Notes |
|------|--------|-------|
| `src/routes/admin/invitation.routes.js` | ✅ Complete | Protected by requireManager |
| `src/routes/order.routes.js` | ⚠️ Partial | Uses `hasPermission` middleware but not role-specific middleware |
| `src/routes/inventory.routes.js` | ⚠️ Partial | Uses `hasPermission` middleware but not role-specific middleware |

---

## ⚠️ PARTIAL IMPLEMENTATIONS / GAPS

### Gap 1: Order Routes Don't Use Role-Specific Middleware

**Current State:**
```javascript
// order.routes.js lines 129-160
router.get('/admin/list', hasPermission('order:read'), orderController.getAllOrders);
router.get('/admin/dispatch-queue', hasPermission('order:read'), orderController.getDispatchQueue);
router.patch('/admin/:id', hasPermission('order:write'), orderController.updateOrderStatus);
```

**Issue:** Uses `hasPermission` middleware which checks for ANY role with `order:read/write/fulfill` permissions. This allows INVENTORY_STAFF access to order management routes when they should only have READ access for cross-department viewing.

**Fix Required:**
```javascript
// For write/fulfillment endpoints:
router.patch('/admin/:id', requireOrderStaff, orderController.updateOrderStatus);
router.post('/admin/:id/deliver', requireOrderStaff, orderController.deliverOrder);

// For read-only endpoints (cross-department):
router.get('/admin/list', hasPermission('order:read'), orderController.getAllOrders); // OK for read
```

### Gap 2: Inventory Routes Similar Issue

**Current State:** Uses `hasPermission` middleware

**Issue:** Same as orders - allows any role with inventory permissions to access, but we want strict role-based access.

**Fix Required:**
- `/stock`, `/reduce`, `/alerts`, `/threshold` endpoints → Use `requireInventoryStaff`
- Cross-department read endpoints → Keep `hasPermission('inventory:read')` or create read-only variant

### Gap 3: `hasRole` Helper Signature Mismatch

**Current:**
```javascript
// require-order-staff.middleware.js line 21
if (!req.admin?.hasRole('STORE_OWNER', 'MANAGER', 'ORDER_STAFF'))
```

**Issue:** `hasRole` is implemented as variadic but the middleware expects multiple arguments to work. The implementation in `require-admin.middleware.js` line 104 shows:
```javascript
hasRole: (...roleNames) => roleNames.some(r => roles.includes(r))
```

This is **correct** - the variadic spread works. No changes needed for this.

### Gap 4: Order Status Transition Validation

**Current State:** `order.service.js` has status update logic but doesn't restrict ORDER_STAFF to fulfillment-only states.

**Issue:** ORDER_STAFF should only be able to transition through:
- `pending` → `confirmed` → `processing` → `ready_for_dispatch` → `dispatched` → `out_for_delivery` → `delivered`

**Missing:** Cannot cancel orders or process returns (should be STORE_OWNER/MANAGER only)

**Fix Required:** Add status transition validation in `order.service.js`:
```javascript
// In updateOrderStatus, validate:
if (req.admin.role === 'ORDER_STAFF') {
  const allowedTransitions = ['pending->confirmed', 'confirmed->processing', ...];
  // Reject if transition not in allowed list
}
```

### Gap 5: Admin Management Routes Use Wrong Middleware

**Current:** `admin-management.routes.js` uses `requireSuperAdmin` (deprecated)

**Issue:** Should use `requireStoreOwner` for owner-only actions, `requireManager` for manager-list

**Fix Required:** Update route middleware chain:
```javascript
router.get('/', requireManager, adminController.listAdmins);
router.get('/:id', requireManager, adminController.getAdmin);
router.patch('/:id/roles', requireManager, adminController.updateAdminRoles);
router.delete('/:id', requireStoreOwner, adminController.revokeAdminAccess);
```

---

## ❌ MISSING IMPLEMENTATIONS

### Missing 1: Sales/Analytics Routes for Inventory Staff

**Required:** Endpoint for INVENTORY_STAFF to view sales reports

**Missing:**
- `GET /api/v1/admin/sales/reports` or similar
- `GET /api/v1/admin/sales/daily-summary`
- `GET /api/v1/admin/sales/top-products`

**Current:** INVENTORY_STAFF has `sales:read` permission but no dedicated routes.

### Missing 2: Cross-Department Read Endpoints

Per Decision 5, we need dedicated routes that allow cross-department viewing:

```
GET /api/v1/admin/sales-report     - ORDER_STAFF, INVENTORY_STAFF, MANAGER, STORE_OWNER
GET /api/v1/admin/order-tracking   - Same access
```

### Missing 3: Department-Specific Dashboard Endpoints

Need:
- `GET /api/v1/admin/dashboard/order-stats` (ORDER_STAFF+)
- `GET /api/v1/admin/dashboard/inventory-stats` (INVENTORY_STAFF+)

### Missing 4: `getRoleByName` Method in Role Model

**Required:** For controllers to resolve role names to UUIDs

**Currently:** Only `findByName` exists. Need to ensure it's used correctly.

---

## 🔧 RECOMMENDED FIXES

### Fix 1: Order Routes (High Priority)
```javascript
// In src/routes/order.routes.js
const requireOrderStaff = require('../../middlewares/require-order-staff.middleware');

// Change these lines:
router.patch('/admin/:id', requireOrderStaff, orderController.updateOrderStatus);
router.post('/admin/:id/deliver', requireOrderStaff, orderController.deliverOrder);
router.post('/admin/:id/dispatch', requireOrderStaff, orderController.dispatchOrder);
// ... all fulfillment endpoints

// Keep these as-is for cross-department read:
router.get('/admin/list', hasPermission('order:read'), orderController.getAllOrders);
router.get('/admin/dispatch-queue', hasPermission('order:read'), orderController.getDispatchQueue);
```

### Fix 2: Inventory Routes (High Priority)
```javascript
// In src/routes/inventory.routes.js
const requireInventoryStaff = require('../../middlewares/require-inventory-staff.middleware');

// Change:
router.post('/stock', requireInventoryStaff, validate(stockUpdateSchema), inventoryController.addStock);
router.post('/reduce', requireInventoryStaff, validate(reduceStockSchema), inventoryController.reduceStock);
router.post('/alerts', requireInventoryStaff, inventoryController.configureAlerts);
router.put('/:id/threshold', requireInventoryStaff, inventoryController.updateThreshold);
```

### Fix 3: Order Service Status Validation (Medium Priority)
Add role-based status transition validation in `src/services/order.service.js`:
```javascript
function validateStatusTransition(currentStatus, newStatus, adminRole) {
  if (adminRole === 'ORDER_STAFF') {
    const allowed: string[] = ['confirmed', 'processing', 'ready_for_dispatch', 'dispatched', 'out_for_delivery', 'delivered'];
    if (!allowed.includes(newStatus)) {
      throw new Error('Order staff cannot perform this status transition');
    }
  }
  // ... other validations
}
```

### Fix 4: Admin Management Routes (Medium Priority)
Update `src/routes/admin/management.routes.js` to use correct middleware.

---

## 📋 TESTING GAPS

### Missing Test Scenarios
1. **ORDER_STAFF** cannot cancel orders
2. **INVENTORY_STAFF** cannot dispatch orders
3. **MANAGER** cannot invite other managers (via API test)
4. **Cross-department read access** tests
5. **Store-scoped data isolation** tests (different stores if multi-store is enabled)

---

## ✅ SUMMARY

| Category | Implementation | Status |
|----------|--------------|--------|
| Database Schema | Stores table, store_id columns, roles/permissions | ✅ 100% |
| Middleware | All role-specific middlewares | ✅ 100% |
| Models | Store model, user model updated | ✅ 100% |
| Invitation Service | Role validation, store scoping | ✅ 90% |
| Order Routes | Uses permission middleware, not role-specific | ⚠️ 60% |
| Inventory Routes | Uses permission middleware, not role-specific | ⚠️ 60% |
| Admin Management Routes | Uses deprecated middleware | ⚠️ 70% |
| Sales/Analytics Endpoints | Missing | ❌ 0% |
| Status Transition Validation | Missing in service | ❌ 0% |

**Overall Completion: ~85%**