# RBAC Implementation Plan: Store Owner & Staff Roles

## Business Context

The system will operate as a **single-store e-commerce platform** where:

- **SUPER_ADMIN = Store Owner** - The single owner of the store
- **ADMIN roles = Store Staff** - Multiple employees working in different departments

## Department-Based Staff Roles

### Role 1: ORDER_STAFF (Order Fulfillment Team)

**Responsibility**: Handle incoming orders from the frontend customer site

**Permissions**:
| Permission Key | Description | Operation |
|---------------|-------------|-----------|
| `order:read` | View orders | GET /orders, view order details |
| `order:write` | Update order status | PATCH /orders/{id} status changes |
| `order:fulfill` | Process fulfillment | Ready for dispatch, dispatch, mark delivered |
| `customer:read` | View customer info | Access customer details for order delivery |

**Dashboard Access**:

- Orders list with filters (status, date range)
- Order detail view
- Dispatch queue
- Delivery tracking
- Customer contact information

**Restrictions**:

- Cannot add/edit products
- Cannot manage inventory
- Cannot create coupons
- Cannot access store settings

---

### Role 2: INVENTORY_STAFF (Sales/Record Keepers)

**Responsibility**: Keep records of goods sold, manage inventory, sales analytics

**Permissions**:
| Permission Key | Description | Operation |
|---------------|-------------|-----------|
| `inventory:read` | View inventory | Check stock levels, transaction history |
| `inventory:write` | Adjust stock | Add/reduce stock, inventory adjustments |
| `inventory:alert` | Configure alerts | Low stock threshold settings |
| `sales:read` | View sales reports | Revenue analytics, sales charts |
| `product:read` | View products | List products for inventory tracking |
| `order:read` | View orders | For sales reconciliation |

**Dashboard Access**:

- Inventory dashboard
- Stock level alerts
- Inventory transaction history
- Sales reporting & analytics
- Product list (read-only for inventory purposes)
- Revenue charts

**Restrictions**:

- Cannot process orders for fulfillment
- Cannot mark orders as dispatched/delivered
- Cannot modify product details
- Cannot manage customers

---

### Role 3: MANAGER (Store Manager)

**Responsibility**: Oversee all store operations, full administrative access

**Permissions**:
| Permission Key | Description | Operation |
|---------------|-------------|-----------|
| `order:read`, `order:write` | Full order management | All order operations |
| `product:create`, `product:write`, `product:delete` | Full product management | CRUD products |
| `category:manage`, `brand:manage` | Taxonomy management | Categories & brands |
| `inventory:*` | Full inventory control | All inventory permissions |
| `sales:read` | Sales analytics | Financial reporting |
| `coupon:*` | Discount management | Create/edit coupons |
| `admin:access` | Admin dashboard access | Access admin panel |

**Dashboard Access**:

- All ADMIN features
- Full product catalog management
- Category & brand management
- Complete inventory controls
- All order management features
- Sales & analytics dashboard
- Coupon management

**Restrictions**:

- Cannot invite new admins (only Store Owner)
- Cannot revoke other managers (only Store Owner)

---

### Role 0: STORE_OWNER (Current SUPER_ADMIN)

**Responsibility**: Store owner - full control over the entire store

**Permissions**:
| Permission Key | Description |
|---------------|-------------|
| `*` | FULL SYSTEM ACCESS - wildcard permission |

**Dashboard Access**:

- Everything MANAGER has
- Admin invitation management
- Staff role management
- Store settings configuration
- All audit logs

---

## Permission Matrix

| Permission Category   | ORDER_STAFF | INVENTORY_STAFF | MANAGER | STORE_OWNER |
| --------------------- | ----------- | --------------- | ------- | ----------- |
| **Orders**            |
| order:read            | ✓           | ✓ (sales)       | ✓       | ✓           |
| order:write           | ✓           | ✗               | ✓       | ✓           |
| order:fulfill         | ✓           | ✗               | ✓       | ✓           |
| **Products**          |
| product:create        | ✗           | ✗               | ✓       | ✓           |
| product:read          | ✗           | ✓               | ✓       | ✓           |
| product:write         | ✗           | ✗               | ✓       | ✓           |
| product:delete        | ✗           | ✗               | ✓       | ✓           |
| **Inventory**         |
| inventory:read        | ✗           | ✓               | ✓       | ✓           |
| inventory:write       | ✗           | ✓               | ✓       | ✓           |
| inventory:alert       | ✗           | ✓               | ✓       | ✓           |
| **Categories/Brands** |
| category:manage       | ✗           | ✗               | ✓       | ✓           |
| brand:manage          | ✗           | ✗               | ✓       | ✓           |
| **Sales/Analytics**   |
| sales:read            | ✓ (cross-access) | ✓        | ✓       | ✓           |
| **Marketing**         |
| coupon:\*             | ✗           | ✗               | ✓       | ✓           |
| **Administration**    |
| admin:access          | ✓           | ✓               | ✓       | ✓           |
| admin:invite          | ✗           | ✗               | ✓ (lower staff only) | ✓           |
| role:manage           | ✗           | ✗               | ✓ (lower staff only) | ✓           |

---

## Database Changes Required

### New Roles (to be seeded)

```sql
INSERT INTO roles (name, display_name, description, is_system) VALUES
('order_staff', 'Order Staff', 'Handles order fulfillment and customer delivery', true),
('inventory_staff', 'Inventory Staff', 'Manages inventory and sales records', true),
('manager', 'Store Manager', 'Full store operations oversight', true),
('store_owner', 'Store Owner', 'Owner of the store with full access', true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;
```

### New Permissions (to be added)

```sql
INSERT INTO permissions (key, name, description, category) VALUES
('order:fulfill', 'Fulfill Orders', 'Process order fulfillment and dispatch', 'orders'),
('sales:read', 'View Sales Reports', 'Access sales analytics and revenue data', 'analytics'),
('category:manage', 'Manage Categories', 'Create and update product categories', 'products'),
('brand:manage', 'Manage Brands', 'Create and update product brands', 'products'),
ON CONFLICT (key) DO NOTHING;
```

### Role-Permission Assignments

```sql
-- ORDER_STAFF permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'order_staff'
AND p.key IN ('order:read', 'order:write', 'order:fulfill', 'admin:access');

-- INVENTORY_STAFF permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'inventory_staff'
AND p.key IN ('inventory:read', 'inventory:write', 'inventory:alert', 'sales:read', 'product:read', 'order:read');

-- MANAGER permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'manager'
AND p.key IN ('order:read', 'order:write', 'product:create', 'product:write', 'product:delete',
              'category:manage', 'brand:manage', 'inventory:read', 'inventory:write', 'inventory:alert',
              'sales:read', 'admin:access');
```

---

## Invitation System Updates

### Role Selection in Admin Invitation

When STORE_OWNER invites staff:

```
POST /api/v1/admin/invitations
{
  "email": "john@store.com",
  "roleId": "<ROLE_UUID>",  // Must be one of: order_staff, inventory_staff, manager
  "storeId": "<STORE_UUID>"  // Auto-filled from inviter's store
}
```

### Store Context in Invitation Acceptance

When invited admin accepts:

- They are auto-assigned to the store that sent the invitation
- Their role is set based on the invitation role
- They get immediate access to their department dashboard

---

## Middleware Updates Required

### 1. Update `require-admin.middleware.js`

- Add `department` field to `req.admin`
- Include allowed permissions based on role
- Store-specific enforcement (already partially implemented)

### 2. Create `require-order-staff.middleware.js`

```javascript
const requireOrderStaff = (req, res, next) => {
  if (!req.admin)
    return res.status(401).json({ error: "Authentication required" });
  if (!["STORE_OWNER", "MANAGER", "ORDER_STAFF"].includes(req.admin.role)) {
    return res.status(403).json({ error: "Order staff access required" });
  }
  next();
};
```

### 3. Create `require-inventory-staff.middleware.js`

```javascript
const requireInventoryStaff = (req, res, next) => {
  if (!req.admin)
    return res.status(401).json({ error: "Authentication required" });
  if (!["STORE_OWNER", "MANAGER", "INVENTORY_STAFF"].includes(req.admin.role)) {
    return res.status(403).json({ error: "Inventory staff access required" });
  }
  next();
};
```

### 4. Create `require-manager.middleware.js`

```javascript
const requireManager = (req, res, next) => {
  if (!req.admin)
    return res.status(401).json({ error: "Authentication required" });
  if (req.admin.role === "STORE_OWNER") return next(); // Owner has all access
  if (req.admin.role !== "MANAGER") {
    return res.status(403).json({ error: "Manager access required" });
  }
  next();
};
```

---

## Route Organization by Department

### Order-Fulfillment Routes (`/api/v1/admin/orders-*`)

```
GET    /api/v1/admin/orders           - ORDER_STAFF+
GET    /api/v1/admin/orders/{id}      - ORDER_STAFF+
PATCH  /api/v1/admin/orders/{id}      - ORDER_STAFF+ (status updates)
POST   /admin/dispatch-queue          - ORDER_STAFF+
POST   /admin/{id}/dispatch         - ORDER_STAFF+
POST   /admin/{id}/deliver            - ORDER_STAFF+
```

### Inventory/Record Routes (`/api/v1/admin/inventory-*`)

```
GET    /api/v1/admin/inventory        - INVENTORY_STAFF+
GET    /api/v1/admin/inventory/alerts - INVENTORY_STAFF+
POST   /api/v1/admin/inventory/adjust - INVENTORY_STAFF+
GET    /api/v1/admin/sales            - INVENTORY_STAFF+
GET    /api/v1/admin/reports/sales    - INVENTORY_STAFF+
```

### Manager Routes (`/api/v1/admin/catalog-*`)

```
GET    /api/v1/admin/products         - MANAGER+
POST   /api/v1/admin/products         - MANAGER+ (STORE_OWNER)
PUT    /api/v1/admin/products/{id}    - MANAGER+
GET    /api/v1/admin/categories       - MANAGER+
POST   /api/v1/admin/categories       - MANAGER+
```

### Owner-Only Routes

```
POST   /api/v1/admin/invitations      - STORE_OWNER only
GET    /api/v1/admin/invitations      - STORE_OWNER, MANAGER
PATCH  /api/v1/admin/{id}/roles       - STORE_OWNER, MANAGER (lower staff only)
DELETE /api/v1/admin/{id}             - STORE_OWNER only
```

### Cross-Department Access Routes
```
GET    /api/v1/admin/sales-report     - ORDER_STAFF, INVENTORY_STAFF, MANAGER, STORE_OWNER
GET    /api/v1/admin/order-tracking    - ORDER_STAFF, INVENTORY_STAFF, MANAGER, STORE_OWNER
```

---

## Dashboard Views by Role

### Order Staff Dashboard

- **Orders Overview**: Incoming orders needing fulfillment
- **Dispatch Queue**: Orders ready to dispatch
- **Out for Delivery**: Track deliveries in progress
- **Delivery History**: Completed deliveries
- **Customer Quick View**: Contact details for delivery

### Inventory Staff Dashboard

- **Inventory Levels**: Current stock across products
- **Low Stock Alerts**: Items needing reorder
- **Stock Adjustments**: Add/remove inventory
- **Sales Reports**: Daily/weekly/monthly sales
- **Transaction History**: Inventory movement log
- **Top Selling Products**: Best performers

### Manager Dashboard

- **All of the above plus**:
- **Product Catalog**: Full product management
- **Categories/Brands**: Taxonomy management
- **Order Management**: Full order control
- **Coupon Management**: Discount codes
- **Analytics Overview**: Combined dashboard

### Store Owner Dashboard

- **All features above plus**:
- **Staff Management**: Invite/remove staff
- **Role Management**: Update staff permissions
- **Store Settings**: Configure store details
- **Audit Logs**: Full system activity
- **Financial Reports**: Complete revenue data

---

## Migration Steps

### Phase 1: Database Schema

1. Add new roles to `roles` table
2. Add new permissions to `permissions` table
3. Create `role_permissions` entries
4. Update existing SUPER_ADMIN to STORE_OWNER role

### Phase 2: Code Updates

1. Update invitation service to include store_id
2. Create department-specific middleware
3. Update route handlers to check permissions
4. Add department selection to invitation UI

### Phase 3: Testing

1. Test each role can only access their routes
2. Verify STORE_OWNER has all access
3. Test invitation flow assigns correct roles
4. Validate dashboard access restrictions

---

## Finalized Implementation Decisions

### Decision 1: Replace ADMIN Role with MANAGER
- Remove the generic `ADMIN` role
- All existing ADMIN users will be migrated to `MANAGER` role
- MANAGER can invite ORDER_STAFF and INVENTORY_STAFF only

### Decision 2: Order Staff - Limited Fulfillment Only
- ORDER_STAFF can only update orders through fulfillment pipeline:
  - `pending` → `confirmed` → `processing` → `ready_for_dispatch` → `dispatched` → `out_for_delivery` → `delivered`
- Cannot cancel orders (STORE_OWNER/MANAGER only)
- Cannot refund orders (STORE_OWNER/MANAGER only)  
- Cannot process returns (STORE_OWNER/MANAGER only)

### Decision 3: Inventory Staff - Full Inventory Operations
- INVENTORY_STAFF CAN:
  - View all inventory data including cost_price
  - Adjust stock quantities (add/reduce)
  - Export inventory reports
  - Record stock intake (new goods received)
  - View inventory transaction history
- MANAGER has same inventory permissions plus product management

### Decision 4: Manager - Invite Lower Staff Only
- MANAGER can invite ORDER_STAFF and INVENTORY_STAFF
- MANAGER cannot invite other MANAGERS
- MANAGER cannot invite STORE_OWNER
- MANAGER can update ORDER_STAFF and INVENTORY_STAFF permissions

### Decision 5: Cross-Department Read Access
- ORDER_STAFF CAN view INVENTORY_STAFF sales reports
- INVENTORY_STAFF CAN view ORDER_STAFF dispatch/delivered data
- Enables coordination between departments
