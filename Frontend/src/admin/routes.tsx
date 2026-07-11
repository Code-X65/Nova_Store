import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/admin/components/layout/AppShell';
import { RequireAuth } from '@/admin/components/guards/RequireAuth';
import { RequirePermission } from '@/admin/components/guards/RequirePermission';
import LoginPage from '@/admin/features/auth/LoginPage';

// Ã¢â€â‚¬Ã¢â€â‚¬ Page skeleton while lazy chunks load Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-nova-500 border-t-transparent animate-spin" />
    </div>
  );
}

// Ã¢â€â‚¬Ã¢â€â‚¬ Lazy-loaded feature pages Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const Dashboard     = lazy(() => import('@/admin/features/dashboard/DashboardPage'));

// Orders
const OrdersList    = lazy(() => import('@/admin/features/orders/OrdersList'));
const OrderDetail   = lazy(() => import('@/admin/features/orders/OrderDetail'));
const DispatchQueue = lazy(() => import('@/admin/features/orders/DispatchQueue'));
const Returns       = lazy(() => import('@/admin/features/orders/Returns'));

// Inventory
const StockLevels   = lazy(() => import('@/admin/features/inventory/StockLevels'));
const StockAdjust   = lazy(() => import('@/admin/features/inventory/StockAdjust'));
const LowStock      = lazy(() => import('@/admin/features/inventory/LowStock'));
const Transactions  = lazy(() => import('@/admin/features/inventory/Transactions'));
const Thresholds    = lazy(() => import('@/admin/features/inventory/Thresholds'));
const AlertsPage    = lazy(() => import('@/admin/features/inventory/Alerts'));

// Catalog
const ProductsList  = lazy(() => import('@/admin/features/catalog/ProductsList'));
const ProductForm   = lazy(() => import('@/admin/features/catalog/ProductForm'));
const Categories    = lazy(() => import('@/admin/features/catalog/Categories'));
const Brands        = lazy(() => import('@/admin/features/catalog/Brands'));

// Customers
const UsersList     = lazy(() => import('@/admin/features/customers/UsersList'));
const UserDetail    = lazy(() => import('@/admin/features/customers/UserDetail'));

// Coupons
const CouponsList   = lazy(() => import('@/admin/features/coupons/CouponsList'));
const CouponForm    = lazy(() => import('@/admin/features/coupons/CouponForm'));

// Shipping
const ShippingZones = lazy(() => import('@/admin/features/shipping/ShippingZones'));
const ShippingRates = lazy(() => import('@/admin/features/shipping/ShippingRates'));

// Reviews
const ReviewsModeration = lazy(() => import('@/admin/features/reviews/ReviewsModeration'));
const ReviewReports     = lazy(() => import('@/admin/features/reviews/ReviewReports'));

// Staff
const StaffList       = lazy(() => import('@/admin/features/staff/StaffList'));
const Invitations     = lazy(() => import('@/admin/features/staff/Invitations'));
const AcceptInvite    = lazy(() => import('@/admin/features/staff/AcceptInvite'));
const RoleManager     = lazy(() => import('@/admin/features/staff/RoleManager'));
const MyPermissions   = lazy(() => import('@/admin/features/staff/MyPermissions'));
// Sales
const SalesReports    = lazy(() => import('@/admin/features/sales/SalesReports'));
const TopProducts     = lazy(() => import('@/admin/features/sales/TopProducts'));
const OrderTracking   = lazy(() => import('@/admin/features/sales/OrderTracking'));
const DailySummary    = lazy(() => import('@/admin/features/sales/DailySummary'));

// Settings
const StoreSettings   = lazy(() => import('@/admin/features/settings/StoreSettings'));
const CurrenciesPage  = lazy(() => import('@/admin/features/settings/CurrenciesPage'));

// Audit
const AuditLogs       = lazy(() => import('@/admin/features/audit/AuditLogs'));
const SessionsPage    = lazy(() => import('@/admin/features/audit/Sessions'));
const MigrationsPage  = lazy(() => import('@/admin/features/audit/Migrations'));

// Notifications Admin
const SendBroadcast   = lazy(() => import('@/admin/features/notifications/SendBroadcast'));
const Templates       = lazy(() => import('@/admin/features/notifications/Templates'));

// Fallback pages
const NotFoundPage    = lazy(() => import('@/admin/features/errors/NotFoundPage'));
const ForbiddenPage   = lazy(() => import('@/admin/features/errors/ForbiddenPage'));

// Ã¢â€â‚¬Ã¢â€â‚¬ Route tree Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export function AppRoutes() {
  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invite/:token" element={
          <Suspense fallback={<PageLoader />}>
            <AcceptInvite />
          </Suspense>
        } />

        {/* Protected shell */}
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Dashboard Ã¢â‚¬â€ role-branching inside the component */}
          <Route path="dashboard" element={<Dashboard />} />

          {/* Orders */}
          <Route path="orders">
            <Route index element={
              <RequirePermission permission="order:read">
                <OrdersList />
              </RequirePermission>
            } />
            <Route path=":id" element={
              <RequirePermission permission="order:read">
                <OrderDetail />
              </RequirePermission>
            } />
            <Route path="dispatch" element={
              <RequirePermission permission="order:write">
                <DispatchQueue />
              </RequirePermission>
            } />
            <Route path="returns" element={
              <RequirePermission permission="order:write">
                <Returns />
              </RequirePermission>
            } />
          </Route>

          {/* Inventory */}
          <Route path="inventory">
            <Route index element={
              <RequirePermission permission="inventory:read">
                <StockLevels />
              </RequirePermission>
            } />
            <Route path="adjust" element={
              <RequirePermission permission="inventory:write">
                <StockAdjust />
              </RequirePermission>
            } />
            <Route path="low-stock" element={
              <RequirePermission permission="inventory:read">
                <LowStock />
              </RequirePermission>
            } />
            <Route path="transactions" element={
              <RequirePermission permission="inventory:read">
                <Transactions />
              </RequirePermission>
            } />
            <Route path="thresholds" element={
              <RequirePermission anyOf={['inventory:alert', 'inventory:write']}>
                <Thresholds />
              </RequirePermission>
            } />
            <Route path="alerts" element={
              <RequirePermission anyOf={['inventory:alert', 'inventory:write']}>
                <AlertsPage />
              </RequirePermission>
            } />
          </Route>

          {/* Catalog */}
          <Route path="catalog">
            <Route path="products" element={
              <RequirePermission permission="product:read">
                <ProductsList />
              </RequirePermission>
            } />
            <Route path="products/new" element={
              <RequirePermission permission="product:create">
                <ProductForm />
              </RequirePermission>
            } />
            <Route path="products/:id" element={
              <RequirePermission permission="product:write">
                <ProductForm />
              </RequirePermission>
            } />
            <Route path="categories" element={
              <RequirePermission anyOf={['category:write', 'category:read']}>
                <Categories />
              </RequirePermission>
            } />
            <Route path="brands" element={
              <RequirePermission anyOf={['brand:write', 'brand:read']}>
                <Brands />
              </RequirePermission>
            } />
          </Route>

          {/* Customers */}
          <Route path="customers">
            <Route index element={
              <RequirePermission permission="user:read">
                <UsersList />
              </RequirePermission>
            } />
            <Route path=":id" element={
              <RequirePermission permission="user:read">
                <UserDetail />
              </RequirePermission>
            } />
          </Route>

          {/* Coupons */}
          <Route path="coupons">
            <Route index element={
              <RequirePermission permission="coupon:read">
                <CouponsList />
              </RequirePermission>
            } />
            <Route path="new" element={
              <RequirePermission permission="coupon:write">
                <CouponForm />
              </RequirePermission>
            } />
            <Route path=":id" element={
              <RequirePermission permission="coupon:write">
                <CouponForm />
              </RequirePermission>
            } />
          </Route>

          {/* Shipping — GET routes now require shipping:read (split from write on backend) */}
          <Route path="shipping">
            <Route path="zones" element={
              <RequirePermission anyOf={['shipping:read', 'shipping:write']}>
                <ShippingZones />
              </RequirePermission>
            } />
            <Route path="rates" element={
              <RequirePermission anyOf={['shipping:read', 'shipping:write']}>
                <ShippingRates />
              </RequirePermission>
            } />
            <Route index element={<Navigate to="zones" replace />} />
          </Route>

          {/* Reviews — GET routes now require review:read (split from write on backend) */}
          <Route path="reviews">
            <Route index element={
              <RequirePermission anyOf={['review:read', 'review:write']}>
                <ReviewsModeration />
              </RequirePermission>
            } />
            <Route path="reports" element={
              <RequirePermission anyOf={['review:read', 'review:write']}>
                <ReviewReports />
              </RequirePermission>
            } />
          </Route>

          {/* Staff — backend guards by requireManager role, no slug on GET routes */}
          <Route path="staff">
            <Route index element={
              <RequirePermission permission="staff:read">
                <StaffList />
              </RequirePermission>
            } />
            <Route path="invitations" element={
              <RequirePermission permission="staff:read">
                <Invitations />
              </RequirePermission>
            } />
            <Route path="roles" element={
              <RequirePermission anyOf={['staff:write', 'role:manage']}>
                <RoleManager />
              </RequirePermission>
            } />
            <Route path="my-permissions" element={<MyPermissions />} />
          </Route>

          {/* Sales */}
          <Route path="sales">
            <Route index element={
              <RequirePermission permission="sales:read">
                <SalesReports />
              </RequirePermission>
            } />
            <Route path="top-products" element={
              <RequirePermission permission="sales:read">
                <TopProducts />
              </RequirePermission>
            } />
            <Route path="order-tracking" element={
              <RequirePermission permission="sales:read">
                <OrderTracking />
              </RequirePermission>
            } />
            <Route path="daily-summary" element={
              <RequirePermission permission="sales:read">
                <DailySummary />
              </RequirePermission>
            } />
          </Route>

          {/* Settings */}
          <Route path="settings">
            <Route index element={<Navigate to="/settings/general" replace />} />
            <Route path="general" element={
              <RequirePermission permission="settings:read">
                <StoreSettings />
              </RequirePermission>
            } />
            <Route path="currencies" element={
              <RequirePermission permission="settings:read">
                <CurrenciesPage />
              </RequirePermission>
            } />
          </Route>

          {/* Audit */}
          <Route path="audit">
            <Route index element={
              <RequirePermission permission="audit:read">
                <AuditLogs />
              </RequirePermission>
            } />
            <Route path="migrations" element={
              <RequirePermission permission="audit:read">
                <MigrationsPage />
              </RequirePermission>
            } />
          </Route>

          {/* Sessions (all roles) */}
          <Route path="profile/sessions" element={<SessionsPage />} />

          {/* Notifications Admin — backend has no slug guard, only requireAdmin */}
          <Route path="notifications/admin">
            <Route index element={
              <RequirePermission permission="notifications:write">
                <SendBroadcast />
              </RequirePermission>
            } />
            <Route path="templates" element={
              <RequirePermission permission="notifications:write">
                <Templates />
              </RequirePermission>
            } />
          </Route>

          {/* Error pages */}
          <Route path="403" element={<ForbiddenPage />} />
          <Route path="*"   element={<NotFoundPage />} />
        </Route>

        {/* Catch-all Ã¢â€ â€™ login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}