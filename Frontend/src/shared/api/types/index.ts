// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript Types — Nova Store
// Used by both apps/admin (cookie auth) and apps/storefront (bearer auth)
// ─────────────────────────────────────────────────────────────────────────────

// ── Pagination ────────────────────────────────────────────────────────────────
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// ── Auth / Session ────────────────────────────────────────────────────────────
export interface AdminSession {
  id: string;
  email: string;
  name: string;
  role: 'store_owner' | 'manager' | 'order_staff' | 'inventory_staff';
  storeId: string;
  storeName: string;
}

export interface AdminPermissions {
  roles: string[];
  permissions: string[];
}

export interface SessionInfo {
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  lastActive: string;
  current: boolean;
}

// ── Product ───────────────────────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  sku?: string;
  stock: number;
  images: string[];
  categoryId: string;
  brandId?: string;
  status: 'active' | 'draft' | 'archived';
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributes: Record<string, string>;
}

// ── Category / Brand ──────────────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string;
  imageUrl?: string;
  color?: string;
  children?: Category[];
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  description?: string;
}

// ── Inventory ─────────────────────────────────────────────────────────────────
export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
  costPrice?: number;
  updatedAt: string;
}

export interface StockTransaction {
  id: string;
  productId: string;
  type: 'add' | 'reduce' | 'adjustment' | 'sale' | 'return';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  note?: string;
  performedBy: string;
  createdAt: string;
}

export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  currentStock: number;
  threshold: number;
  severity: 'low' | 'critical' | 'out_of_stock';
  createdAt: string;
}

// ── Orders ────────────────────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'ready_for_dispatch'
  | 'dispatched'
  | 'out_for_delivery'
  | 'delivery_attempted'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: number;
  total: number;
  imageUrl?: string;
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  customerId: string;
  customerName: string;
  customerEmail: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  subtotal: number;
  shippingCost: number;
  discount: number;
  total: number;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  paymentMethod?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Customers ─────────────────────────────────────────────────────────────────
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  status: 'active' | 'suspended' | 'banned';
  emailVerified: boolean;
  totalOrders: number;
  totalSpent: number;
  createdAt: string;
}

// ── Coupons ───────────────────────────────────────────────────────────────────
export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed_amount' | 'free_shipping';
  value: number;
  minOrderAmount?: number;
  maxUsage?: number;
  usageCount: number;
  startDate?: string;
  expiresAt?: string;
  active: boolean;
  createdAt: string;
}

// ── Shipping ──────────────────────────────────────────────────────────────────
export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  states?: string[];
}

export interface ShippingRate {
  id: string;
  zoneId: string;
  name: string;
  type: 'flat_rate' | 'free' | 'calculated';
  price: number;
  minWeight?: number;
  maxWeight?: number;
  estimatedDays?: string;
}

// ── Reviews ───────────────────────────────────────────────────────────────────
export interface Review {
  id: string;
  productId: string;
  productName: string;
  customerId: string;
  customerName: string;
  rating: number;
  title?: string;
  body: string;
  status: 'pending' | 'approved' | 'rejected';
  helpful: number;
  reported: boolean;
  createdAt: string;
}

// ── Staff ─────────────────────────────────────────────────────────────────────
export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  storeId: string;
  status: 'active' | 'suspended';
  lastLogin?: string;
  createdAt: string;
}

export interface Invitation {
  id: string;
  email: string;
  roleId: string;
  roleName: string;
  storeId: string;
  token: string;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
  expiresAt: string;
  createdAt: string;
}

// ── Notifications ─────────────────────────────────────────────────────────────
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  data?: Record<string, unknown>;
  createdAt: string;
}

// ── Analytics / Dashboard ─────────────────────────────────────────────────────
export interface DashboardStats {
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    trend: number; // percentage change vs previous period
  };
  orders: {
    total: number;
    pending: number;
    processing: number;
    delivered: number;
  };
  customers: {
    total: number;
    newThisMonth: number;
  };
  inventory: {
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
}

export interface RevenueDataPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface TopProduct {
  productId: string;
  productName: string;
  totalSold: number;
  revenue: number;
  imageUrl?: string;
}

// ── Settings ──────────────────────────────────────────────────────────────────
export interface StoreSetting {
  key: string;
  value: string | number | boolean | object;
  label?: string;
  category?: string;
}

// ── Audit ─────────────────────────────────────────────────────────────────────
export interface AuditLog {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  performedBy: string;
  performedByEmail: string;
  ipAddress: string;
  details?: Record<string, unknown>;
  createdAt: string;
}
