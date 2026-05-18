# Backend Plan: Product Search/Filter Engine & Inventory Management

## Overview

This plan outlines the backend API endpoints and architecture for implementing:
- **6. Product Search / Filter Engine** - Enhanced product discovery with advanced filtering and sorting
- **7. Inventory / Stock Management** - Complete inventory control with alerts and SKU management
- **8. Cart System** - Shopping cart with guest support and merge functionality
- **9. Wishlist / Favorites** - User wishlist management for saved products
- **10. Checkout System** - Cart validation, shipping/tax calculation, coupons, checkout sessions
- **11. Payment Gateway APIs** - Paystack, Flutterwave, Stripe integration with webhooks
- **12. Orders Management** - Full order lifecycle, admin management, returns, refunds

---

## 6. Product Search / Filter Engine

### Current State Analysis
The existing `products` table already supports:
- `stock_quantity`, `low_stock_threshold` columns
- `inventory_transactions` table for tracking stock changes
- Basic filtering (status, category, brand, search)
- Sorting by `created_at` only

### Required Enhancements

### API Endpoints

#### 6.1 GET `/api/v1/products`
**Purpose:** Enhanced product listing with advanced filtering capabilities

| Query Parameter | Type | Description |
|----------------|------|-------------|
| `search` | string | Keyword search in name/description (already exists) |
| `category` | string | Filter by category slug (already exists) |
| `brand` | string | Filter by brand (already exists) |
| `minPrice` | number | Filter products with price >= this value |
| `maxPrice` | number | Filter products with price <= this value |
| `minRating` | number (0-5) | Filter by minimum average rating |
| `sortBy` | string | Sort field: `newest` | `cheapest` | `popular` | `price_low` | `price_high` | `rating` |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Items per page (default: 20) |

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

---

#### 6.2 GET `/api/v1/products/featured`
**Purpose:** Retrieve featured/promoted products for homepage display

| Query Parameter | Type | Description |
|----------------|------|-------------|
| `limit` | integer | Max products to return (default: 10) |

**Response:** Array of featured products

---

#### 6.3 GET `/api/v1/products/:id/stock`
**Purpose:** Check stock availability for a specific product

**Response:**
```json
{
  "success": true,
  "data": {
    "productId": "uuid",
    "inStock": true,
    "stockQuantity": 25,
    "lowStock": false,
    "variantStock": [...optional variant stock info]
  }
}
```

---

## 7. Inventory / Stock Management

### Database Schema Updates Required
The existing schema requires a `product_reviews` table for rating functionality.

### API Endpoints

#### 7.1 POST `/api/v1/inventory/stock`
**Purpose:** Add stock to a product or variant

**Auth:** Admin only (`product:write` permission)

**Request Body:**
```json
{
  "productId": "uuid",
  "variantId": "uuid (optional)",
  "quantity": 50,
  "notes": "Restocked new shipment"
}
```

**Response:** Updated product/variant stock information

---

#### 7.2 POST `/api/v1/inventory/reduce`
**Purpose:** Reduce stock after order fulfillment or manual adjustment

**Auth:** Admin only

**Request Body:**
```json
{
  "productId": "uuid",
  "variantId": "uuid (optional)",
  "quantity": 5,
  "referenceId": "order-uuid",
  "type": "sale" | "adjustment" | "return",
  "notes": "Order #12345 fulfilled"
}
```

---

#### 7.3 GET `/api/v1/inventory/transactions`
**Purpose:** Retrieve inventory transaction history with filtering

**Auth:** Admin only

| Query Parameter | Type | Description |
|----------------|------|-------------|
| `productId` | uuid | Filter by product |
| `type` | string | Filter by type: `sale` | `restock` | `adjustment` | `return` |
| `page` | integer | Pagination |
| `limit` | integer | Items per page |

**Response:** Paginated list of inventory transactions

---

#### 7.4 GET `/api/v1/inventory/low-stock`
**Purpose:** Retrieve products below their low stock threshold

**Auth:** Admin only

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "uuid",
        "name": "Product Name",
        "sku": "SKU-001",
        "stockQuantity": 3,
        "lowStockThreshold": 10
      }
    ]
  }
}
```

---

#### 7.5 POST `/api/v1/inventory/alerts`
**Purpose:** Configure low stock alert recipients/settings

**Auth:** Admin only

**Request Body:**
```json
{
  "productId": "uuid (optional - for product-specific alerts)",
  "enabled": true,
  "threshold": 5,
  "notifyEmails": ["admin@store.com"]
}
```

---

#### 7.6 GET `/api/v1/inventory/alerts`
**Purpose:** Retrieve current alert configurations

**Auth:** Admin only

---

#### 7.7 GET `/api/v1/inventory/:id`
**Purpose:** Get detailed inventory information for a product

**Auth:** Admin only

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {...},
    "currentStock": 25,
    "lowStockThreshold": 10,
    "transactions": [...],
    "isOutOfStock": false,
    "variants": [...]
  }
}
```

---

#### 7.8 PUT `/api/v1/inventory/:id/threshold`
**Purpose:** Update low stock threshold for a product

**Auth:** Admin only

**Request Body:**
```json
{
  "lowStockThreshold": 15
}
```

---

#### 7.9 POST `/api/v1/inventory/bulk-update`
**Purpose:** Bulk update stock quantities for multiple products

**Auth:** Admin only

**Request Body:**
```json
{
  "updates": [
    { "productId": "uuid", "quantity": 100 },
    { "productId": "uuid", "quantity": 50 }
  ]
}
```

---

## Model Updates Required

### 7.10 Product Model (`src/models/product.model.js`)
Add methods:
- `updateStock(productId, quantityChange, transactionData)` - Update stock and log transaction
- `getLowStockProducts()` - Retrieve products below threshold
- `getStockByProductId(productId)` - Get detailed stock info

### 7.11 Inventory Transaction Model (`src/models/inventory-transaction.model.js`)
New file to manage:
- `create(transactionData)` - Log stock change
- `findByProductId(productId, filters)` - Get transaction history
- `getRecentTransactions(limit)` - Dashboard recent activity

### 7.12 Inventory Service (`src/services/inventory.service.js`)
New file to handle:
- `addStock(productId, quantity, userId, notes)` - Add stock to product
- `reduceStock(productId, quantity, orderId)` - Reduce after sale
- `checkLowStock()` - Check and return low stock items
- `getInventoryAlerts()` - Retrieve alert configurations

---

## Route Files to Create

| File | Purpose |
|------|---------|
| `src/routes/inventory.routes.js` | Inventory management endpoints |
| `src/controllers/inventory.controller.js` | Inventory controller |
| `src/services/inventory.service.js` | Inventory business logic |
| `src/models/inventory-transaction.model.js` | Transaction model |

---

## Integration Points

### 7.13 Order Service Integration
When an order is placed:
- Call `inventoryService.reduceStock()` for each product
- Create transaction record with type `sale`
- Check if product becomes out of stock, update status

### 7.14 Scheduled Job
- Daily cron job to check `low_stock_threshold` and send alerts
- Can be implemented via `node-cron` or external scheduler

---

## Permissions Required

| Permission | Description |
|------------|-------------|
| `product:read` | View products (public) |
| `product:create` | Create products (admin) |
| `product:write` | Update products (admin) |
| `inventory:read` | View inventory (admin) |
| `inventory:write` | Modify inventory (admin) |
| `inventory:alert` | Configure alerts (admin) |

---

## Environment Variables (if needed)

```
INVENTORY_ALERT_EMAILS=admin@store.com,manager@store.com
LOW_STOCK_CHECK_INTERVAL=86400000  # 24 hours in ms
```

---

## 8. Cart System

### Database Schema Required
```sql
CREATE TABLE IF NOT EXISTS carts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT, -- For guest carts
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### API Endpoints

#### 8.1 POST `/api/v1/cart`
**Purpose:** Add item to cart

**Auth:** Optional (authenticated or session-based)

**Request Body:**
```json
{
  "productId": "uuid",
  "variantId": "uuid (optional)",
  "quantity": 1
}
```

**Response:** Updated cart object

---

#### 8.2 GET `/api/v1/cart`
**Purpose:** Get user's cart (authenticated) or session cart (guest)

**Auth:** Optional

**Response:**
```json
{
  "success": true,
  "data": {
    "cart": {
      "id": "uuid",
      "items": [
        {
          "id": "uuid",
          "product": {...},
          "variant": {...},
          "quantity": 2,
          "unitPrice": 29.99,
          "total": 59.98
        }
      ],
      "subtotal": 59.98,
      "itemCount": 2
    }
  }
}
```

---

#### 8.3 PUT `/api/v1/cart/items/:id`
**Purpose:** Update cart item quantity

**Auth:** Optional

**Request Body:**
```json
{
  "quantity": 3
}
```

---

#### 8.4 DELETE `/api/v1/cart/items/:id`
**Purpose:** Remove item from cart

**Auth:** Optional

---

#### 8.5 DELETE `/api/v1/cart`
**Purpose:** Clear entire cart

**Auth:** Optional

---

#### 8.6 POST `/api/v1/cart/merge`
**Purpose:** Merge guest cart with user cart after login

**Auth:** Authenticated

**Request Body:**
```json
{
  "sessionId": "guest-session-id"
}
```

---

## Model Files to Create

| File | Purpose |
|------|---------|
| `src/models/cart.model.js` | Cart CRUD operations |
| `src/models/cart-item.model.js` | Cart item management |
| `src/services/cart.service.js` | Cart business logic |
| `src/controllers/cart.controller.js` | Cart controller |
| `src/routes/cart.routes.js` | Cart routes |

---

## 9. Wishlist / Favorites

### Database Schema Required
```sql
CREATE TABLE IF NOT EXISTS wishlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wishlist_id, product_id)
);
```

### API Endpoints

#### 9.1 GET `/api/v1/wishlist`
**Purpose:** Get user's wishlist

**Auth:** Authenticated

**Response:** List of wishlisted products with product details

---

#### 9.2 POST `/api/v1/wishlist`
**Purpose:** Add product to wishlist

**Auth:** Authenticated

**Request Body:**
```json
{
  "productId": "uuid"
}
```

---

#### 9.3 DELETE `/api/v1/wishlist/:productId`
**Purpose:** Remove product from wishlist

**Auth:** Authenticated

---

#### 9.4 GET `/api/v1/wishlist/:productId/check`
**Purpose:** Check if product is in user's wishlist

**Auth:** Authenticated

**Response:**
```json
{
  "success": true,
  "data": {
    "inWishlist": true
  }
}
```

---

## Model Files to Create

| File | Purpose |
|------|---------|
| `src/models/wishlist.model.js` | Wishlist CRUD operations |
| `src/services/wishlist.service.js` | Wishlist business logic |
| `src/controllers/wishlist.controller.js` | Wishlist controller |
| `src/routes/wishlist.routes.js` | Wishlist routes |

---

## Integration Points

### 8.15 Cart → Order Integration
When creating an order:
- Validate cart items still in stock
- Calculate totals
- Lock prices at order creation time

### 8.16 Authentication Integration
- On login, check for session cart and offer merge
- Clear session cart after successful merge

---

## 10. Checkout System

### Database Schema Required
```sql
CREATE TABLE IF NOT EXISTS coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  type TEXT CHECK (type IN ('percentage', 'fixed')) NOT NULL,
  value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2),
  max_discount DECIMAL(10,2),
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  usage_limit INT,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  coupon_id UUID NOT NULL REFERENCES coupons(id),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### API Endpoints

#### 10.1 POST `/api/v1/checkout/validate`
**Purpose:** Validate cart before checkout

**Auth:** Optional

**Request Body:**
```json
{
  "cartId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "issues": [],
    "items": [...],
    "subtotal": 100,
    "estimatedShipping": 10,
    "estimatedTax": 8
  }
}
```

---

#### 10.2 POST `/api/v1/checkout/shipping`
**Purpose:** Calculate shipping cost based on address and cart

**Request Body:**
```json
{
  "cartId": "uuid",
  "address": {
    "country": "US",
    "state": "CA",
    "zipCode": "90210"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shippingOptions": [
      {
        "id": "standard",
        "name": "Standard Shipping",
        "price": 5.99,
        "estimatedDays": "5-7"
      },
      {
        "id": "express",
        "name": "Express Shipping",
        "price": 12.99,
        "estimatedDays": "1-2"
      }
    ]
  }
}
```

---

#### 10.3 POST `/api/v1/checkout/tax`
**Purpose:** Calculate tax based on address

**Request Body:**
```json
{
  "cartId": "uuid",
  "address": {
    "country": "US",
    "state": "CA",
    "zipCode": "90210"
  }
}
```

**Response:** Tax amount and breakdown

---

#### 10.4 POST `/api/v1/checkout/coupon`
**Purpose:** Apply coupon to cart

**Auth:** Optional

**Request Body:**
```json
{
  "cartId": "uuid",
  "code": "SAVE20"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "coupon": {...},
    "discount": 20,
    "newTotal": 80
  }
}
```

---

#### 10.5 POST `/api/v1/checkout/session`
**Purpose:** Create checkout session for payment processing

**Auth:** Authenticated or session

**Request Body:**
```json
{
  "cartId": "uuid",
  "shippingOption": "standard",
  "address": {...},
  "couponCode": "SAVE20 (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "checkoutSession": {
      "id": "uuid",
      "orderId": "uuid",
      "total": 85,
      "breakdown": {...},
      "expiresAt": "timestamp"
    }
  }
}
```

---

## Model Files to Create

| File | Purpose |
|------|---------|
| `src/models/coupon.model.js` | Coupon management |
| `src/models/order.model.js` | Order CRUD operations |
| `src/services/checkout.service.js` | Checkout business logic |
| `src/controllers/checkout.controller.js` | Checkout controller |
| `src/routes/checkout.routes.js` | Checkout routes |

---

## 11. Payment Gateway APIs

### Environment Variables Required
```
PAYSTACK_SECRET_KEY=sk_test_xxx
PAYSTACK_PUBLIC_KEY=pk_test_xxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxx
FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### API Endpoints

#### 11.1 POST `/api/v1/payments/paystack/initialize`
**Purpose:** Initialize Paystack payment

**Auth:** Authenticated

**Request Body:**
```json
{
  "email": "customer@email.com",
  "amount": 5000, -- in kobo (NGN 50.00)
  "checkoutSession": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authorizationUrl": "https://paystack.com/pay/...",
    "reference": "txref_xxx"
  }
}
```

---

#### 11.2 GET `/api/v1/payments/paystack/verify/:reference`
**Purpose:** Verify Paystack payment status

**Response:** Payment status and order update

---

#### 11.3 POST `/api/v1/payments/flutterwave/initialize`
**Purpose:** Initialize Flutterwave payment

**Request Body:**
```json
{
  "tx_ref": "unique_transaction_ref",
  "amount": 50,
  "currency": "USD",
  "customer": {
    "email": "customer@email.com",
    "name": "John Doe"
  },
  "checkoutSession": "uuid"
}
```

---

#### 11.4 POST `/api/v1/payments/stripe/checkout`
**Purpose:** Create Stripe Checkout Session

**Request Body:**
```json
{
  "checkoutSession": "uuid",
  "successUrl": "https://store.com/success",
  "cancelUrl": "https://store.com/cancel"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_xxx",
    "url": "https://checkout.stripe.com/pay/cs_test_xxx"
  }
}
```

---

#### 11.5 POST `/api/v1/payments/webhook/:provider`
**Purpose:** Handle payment webhooks for all providers

**Providers:** `paystack`, `flutterwave`, `stripe`

**Response:** Update order status based on webhook

---

#### 11.6 GET `/api/v1/payments/status/:orderId`
**Purpose:** Get payment status for an order

**Auth:** Authenticated (order owner or admin)

---

## Model Files to Create

| File | Purpose |
|------|---------|
| `src/models/payment.model.js` | Payment record management |
| `src/models/order.model.js` | Order management (shared with checkout) |
| `src/services/payment.service.js` | Payment processing logic |
| `src/controllers/payment.controller.js` | Payment controller |
| `src/routes/payment.routes.js` | Payment routes |

---

## Integration Points

### 10.1 Checkout → Cart Integration
- Validate cart items exist and prices haven't changed
- Calculate final totals including shipping and taxes

### 10.2 Checkout → Payment Integration
- Create order record before redirecting to payment
- Store checkout session reference

### 11.18 Payment → Order Integration
- On successful payment webhook:
  - Update order status to `paid`
  - Reduce inventory stock
  - Clear cart
  - Send confirmation email

### 11.19 Webhook Security
- Verify webhook signatures for each provider
- Use raw body parser for Stripe
- Validate Paystack and Flutterwave signatures

---

## 12. Orders Management

### Database Schema Required
```sql
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  order_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially_refunded', 'refunded', 'failed')),
  
  -- Financials
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- Shipping Address
  shipping_address JSONB NOT NULL,
  billing_address JSONB,
  
  -- Tracking
  tracking_number TEXT,
  carrier TEXT,
  
  -- Cancellation/Return
  cancellation_reason TEXT,
  return_reason TEXT,
  return_status TEXT CHECK (return_status IN ('requested', 'approved', 'rejected', 'completed')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  paid_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  product_name TEXT NOT NULL,
  variant_name TEXT,
  sku TEXT,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  note TEXT,
  changed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### API Endpoints

#### 12.1 POST `/api/v1/orders`
**Purpose:** Create order from checkout session

**Auth:** Authenticated

**Request Body:**
```json
{
  "checkoutSessionId": "uuid"
}
```

**Response:** Created order with order number

---

#### 12.2 GET `/api/v1/orders`
**Purpose:** Get user's orders (paginated)

**Auth:** Authenticated

| Query Parameter | Type | Description |
|----------------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `status` | string | Filter by status |

**Response:** Paginated list of orders

---

#### 12.3 GET `/api/v1/orders/:id`
**Purpose:** Get single order details

**Auth:** Authenticated (owner or admin)

**Response:** Full order details with items

---

#### 12.4 POST `/api/v1/orders/:id/cancel`
**Purpose:** Cancel an order (allowed within time window)

**Auth:** Authenticated (owner)

**Request Body:**
```json
{
  "reason": "Changed my mind"
}
```

---

#### 12.5 POST `/api/v1/orders/:id/return`
**Purpose:** Request return for order

**Auth:** Authenticated (owner)

**Request Body:**
```json
{
  "reason": "Product defective",
  "items": ["orderItemId1"]
}
```

---

#### 12.6 POST `/api/v1/orders/:id/reorder`
**Purpose:** Reorder same items from previous order

**Auth:** Authenticated (owner)

**Response:** New cart with same items

---

### Admin Endpoints

#### 12.7 GET `/api/v1/admin/orders`
**Purpose:** Get all orders with filtering

**Auth:** Admin only

| Query Parameter | Type | Description |
|----------------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `status` | string | Filter by status |
| `userId` | uuid | Filter by user |
| `dateFrom` | date | Start date |
| `dateTo` | date | End date |

---

#### 12.8 PATCH `/api/v1/admin/orders/:id`
**Purpose:** Update order status

**Auth:** Admin only

**Request Body:**
```json
{
  "status": "shipped",
  "trackingNumber": "123456789",
  "carrier": "UPS",
  "note": "Shipped via UPS Ground"
}
```

---

#### 12.9 POST `/api/v1/admin/orders/:id/refund`
**Purpose:** Process refund for order

**Auth:** Admin only

**Request Body:**
```json
{
  "amount": 50, -- partial or full refund
  "reason": "Customer returned item"
}
```

---

## Model Files to Create

| File | Purpose |
|------|---------|
| `src/models/order.model.js` | Order CRUD operations (shared with checkout) |
| `src/models/order-item.model.js` | Order item management |
| `src/models/order-status-history.model.js` | Status history tracking |
| `src/services/order.service.js` | Order business logic |
| `src/controllers/order.controller.js` | Order controller |
| `src/routes/order.routes.js` | Order routes |
| `src/routes/admin/order.routes.js` | Admin order routes |

---

## Integration Points

### 12.10 Order → Payment Integration
- Create order in `pending` status during checkout
- Update to `paid` on successful payment webhook
- Handle refunds through payment providers

### 12.11 Order → Inventory Integration
- Reduce stock on order creation
- Restore stock on cancellation (if not shipped)
- Handle return stock adjustments

### 12.12 Order → Notification Integration
- Send order confirmation email
- Send shipping notification with tracking
- Send delivery confirmation

### 12.13 Order Status Transitions
```
pending → confirmed → processing → shipped → delivered
   ↓         ↓            ↓           ↓
cancelled  cancelled    cancelled   cancelled → returned
```

---

## 13. Shipping & Delivery

### Database Schema Required
```sql
CREATE TABLE IF NOT EXISTS shipping_zones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  countries TEXT[] NOT NULL,
  states TEXT[], -- NULL means all states in country
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipping_rates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  zone_id UUID NOT NULL REFERENCES shipping_zones(id),
  name TEXT NOT NULL, -- e.g., "Standard", "Express"
  min_weight DECIMAL(8,2) DEFAULT 0,
  max_weight DECIMAL(8,2),
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  rate DECIMAL(10,2) NOT NULL,
  estimated_days_min INT,
  estimated_days_max INT,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS delivery_states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL, -- e.g., "Order Placed", "Processing"
  sort_order INT NOT NULL,
  is_delivered BOOLEAN DEFAULT FALSE,
  is_cancelled BOOLEAN DEFAULT FALSE
);
```

### API Endpoints

#### 13.1 GET `/api/v1/shipping/zones`
**Purpose:** Get available shipping zones

**Response:** List of shipping zones with countries/states

---

#### 13.2 POST `/api/v1/shipping/calculate`
**Purpose:** Calculate shipping cost for cart/address

**Request Body:**
```json
{
  "cartId": "uuid",
  "address": {
    "country": "US",
    "state": "CA",
    "zipCode": "90210"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "options": [
      {
        "id": "standard",
        "name": "Standard (3-5 days)",
        "price": 5.99
      },
      {
        "id": "express",
        "name": "Express (1-2 days)",
        "price": 12.99
      }
    ]
  }
}
```

---

#### 13.3 POST `/api/v1/admin/shipping/zones`
**Purpose:** Create shipping zone

**Auth:** Admin only

---

#### 13.4 PUT `/api/v1/admin/shipping/zones/:id`
**Purpose:** Update shipping zone

**Auth:** Admin only

---

#### 13.5 DELETE `/api/v1/admin/shipping/zones/:id`
**Purpose:** Delete shipping zone

**Auth:** Admin only

---

### Order Shipping Endpoints

#### 13.6 POST `/api/v1/admin/orders/:id/ship`
**Purpose:** Mark order as shipped and assign tracking

**Auth:** Admin only

**Request Body:**
```json
{
  "trackingNumber": "123456789",
  "carrier": "UPS",
  "note": "Shipped via UPS Ground"
}
```

---

#### 13.7 POST `/api/v1/admin/orders/:id/deliver`
**Purpose:** Mark order as delivered

**Auth:** Admin only

---

#### 13.8 GET `/api/v1/admin/shipping/rates`
**Purpose:** Get all shipping rates with zone info

**Auth:** Admin only

---

## Model Files to Create

| File | Purpose |
|------|---------|
| `src/models/shipping-zone.model.js` | Shipping zones management |
| `src/models/shipping-rate.model.js` | Shipping rates calculation |
| `src/models/delivery-state.model.js` | Delivery state tracking |
| `src/services/shipping.service.js` | Shipping calculation logic |
| `src/controllers/shipping.controller.js` | Shipping controller |
| `src/routes/shipping.routes.js` | Shipping routes |
| `src/routes/admin/shipping.routes.js` | Admin shipping routes |

---

## 14. Reviews & Ratings

### Database Schema Required
```sql
CREATE TABLE IF NOT EXISTS product_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id), -- Verified purchase
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT NOT NULL,
  is_verified_purchase BOOLEAN DEFAULT FALSE,
  helpful_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, user_id) -- One review per user per product
);

CREATE TABLE IF NOT EXISTS review_helpfulness (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES product_reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);
```

### API Endpoints

#### 14.1 GET `/api/v1/products/:productId/reviews`
**Purpose:** Get product reviews

| Query Parameter | Type | Description |
|----------------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `rating` | integer | Filter by star rating |
| `sortBy` | string | `newest` | `helpful` | `highest` | `lowest` |

**Response:**
```json
{
  "success": true,
  "data": {
    "reviews": [...],
    "averageRating": 4.5,
    "ratingDistribution": {
      "5": 45,
      "4": 30,
      "3": 12,
      "2": 5,
      "1": 3
    },
    "pagination": {...}
  }
}
```

---

#### 14.2 POST `/api/v1/reviews`
**Purpose:** Add review to product

**Auth:** Authenticated

**Request Body:**
```json
{
  "productId": "uuid",
  "orderId": "uuid (optional, for verification)",
  "rating": 5,
  "title": "Great product!",
  "comment": "This exceeded my expectations."
}
```

---

#### 14.3 PUT `/api/v1/reviews/:id`
**Purpose:** Edit own review

**Auth:** Authenticated (owner)

---

#### 14.4 DELETE `/api/v1/reviews/:id`
**Purpose:** Delete own review

**Auth:** Authenticated (owner)

---

#### 14.5 POST `/api/v1/reviews/:id/helpful`
**Purpose:** Mark review as helpful

**Auth:** Authenticated

**Request Body:**
```json
{
  "isHelpful": true
}
```

---

## Model Files to Create

| File | Purpose |
|------|---------|
| `src/models/product-review.model.js` | Review CRUD operations |
| `src/models/review-helpfulness.model.js` | Review helpfulness tracking |
| `src/services/review.service.js` | Review business logic |
| `src/controllers/review.controller.js` | Review controller |
| `src/routes/review.routes.js` | Review routes |