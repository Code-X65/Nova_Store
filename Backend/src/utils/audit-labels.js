/**
 * audit-labels.js
 *
 * Maps raw audit `action` keys (e.g. "admin.login.success") and `action_type`
 * enums to human-readable, professional labels for the admin audit dashboard.
 * Falls back to a sensible title-cased rendering for any unmapped key.
 */

const ACTION_LABELS = {
  // ── Auth (customer) ──────────────────────────────────────────────
  'user.login.success': 'Customer logged in',
  'user.login.failed': 'Customer login failed',
  'user.logout': 'Logged out',
  'user.password.changed': 'Password changed',
  'user.password.set': 'Password set',
  'user.password.reset': 'Password reset requested',
  'user.email.verified': 'Email verified',
  'phone.otp.sent': 'Phone verification code sent',
  'phone.otp.resent': 'Phone verification code resent',
  'phone.otp.verified': 'Phone number verified',
  'user.oauth.google.login': 'Signed in with Google',
  'user.oauth.facebook.login': 'Signed in with Facebook',
  'user.oauth.apple.login': 'Signed in with Apple',
  'user.admin_login.success': 'Admin logged in',
  'user.admin_login.failed': 'Admin login failed',
  'admin.registration.blocked': 'Admin registration blocked',

  // ── Auth (admin / staff) ─────────────────────────────────────────
  'admin.login.success': 'Admin signed in',
  'admin.login.failed': 'Admin sign-in failed',
  'admin.locked': 'Admin account locked',
  'admin.unlocked': 'Admin account unlocked',
  'admin.removed': 'Admin account removed',
  'admin.register': 'Admin account created',
  'admin.session.revoked': 'Admin session revoked',
  'admin_roles_updated': 'Staff roles updated',
  'admin_access_revoked': 'Staff access revoked',
  'admin_invitation_sent': 'Staff invitation sent',
  'admin_invitation_accepted': 'Staff invitation accepted',
  'admin_invitation_revoked': 'Staff invitation revoked',
  'admin_invitation_resent': 'Staff invitation resent',

  // ── Catalog ──────────────────────────────────────────────────────
  'product.created': 'Product created',
  'product.bulk_created': 'Products created in bulk',
  'product.updated': 'Product updated',
  'product.deleted': 'Product deleted',
  'product.image.added': 'Product image added',
  'product.image.removed': 'Product image removed',
  'product.variant.added': 'Product variant added',
  'product.variant.updated': 'Product variant updated',
  'product.variant.deleted': 'Product variant deleted',
  'product.related.added': 'Related product linked',
  'product.related.removed': 'Related product unlinked',
  'category.created': 'Category created',
  'category.bulk_created': 'Categories created in bulk',
  'category.updated': 'Category updated',
  'category.deleted': 'Category deleted',
  'category.reordered': 'Categories reordered',
  'brand.created': 'Brand created',
  'brand.updated': 'Brand updated',
  'brand.deleted': 'Brand deleted',
  'attribute.created': 'Category attribute created',
  'attribute.updated': 'Category attribute updated',
  'attribute.deleted': 'Category attribute deleted',

  // ── Orders / lifecycle ───────────────────────────────────────────
  'order.placed': 'New order placed',
  'order.cancelled': 'Order cancelled',
  'order.return_requested': 'Return requested',
  'order.reordered': 'Order reordered',
  'order.status.updated': 'Order status changed',
  'order.ready_for_dispatch': 'Order marked ready for dispatch',
  'order.dispatched': 'Order dispatched',
  'order.picked_up': 'Order picked up',
  'order.out_for_delivery': 'Order out for delivery',
  'order.delivery_attempted': 'Delivery attempted',
  'order.delivered': 'Order delivered',
  'order.returned_to_store': 'Order returned to store',
  'order.payment_failed': 'Order payment failed',
  'order.picked_out_of_stock': 'Out of stock while picking',
  'order.shipped': 'Order shipped',
  'order.return.review': 'Return under review',
  'order.return.approve': 'Return approved',
  'order.return.reject': 'Return rejected',
  'order.return.schedule_pickup': 'Return pickup scheduled',
  'order.return.mark_collected': 'Return collected',
  'order.return.complete_qc': 'Return QC completed',
  'order.return.process_refund': 'Return refund processed',
  'order.return.complete': 'Return completed',

  // ── Inventory ────────────────────────────────────────────────────
  'inventory.stock_added': 'Stock added',
  'inventory.stock_reduced': 'Stock reduced',
  'inventory.stock_adjusted': 'Stock manually adjusted',
  'inventory.threshold_updated': 'Low-stock threshold updated',
  'inventory.bulk_updated': 'Stock updated in bulk',
  'inventory.low_stock': 'Low stock alert',
  'inventory.out_of_stock': 'Out of stock',
  'inventory.discrepancy': 'Stock discrepancy detected',

  // ── Payments ─────────────────────────────────────────────────────
  'payment.succeeded': 'Payment succeeded',
  'payment.failed': 'Payment failed',
  'payment.refunded': 'Payment refunded',

  // ── Catalog safety / team alerts ─────────────────────────────────
  'catalog.product.deleted': 'Product deleted (catalog alert)',
  'catalog.attribute.bulk_changed': 'Bulk catalog change (alert)',

  // ── Reviews / staff security ─────────────────────────────────────
  'review.created': 'New product review',
  'staff.permission_changed': 'Staff permissions changed',
  'staff.role_escalated': 'Staff role escalated',
  'staff.user_created': 'New staff user created',

  // ── Misc ─────────────────────────────────────────────────────────
  'coupon.applied': 'Coupon applied',
  'checkout.session_created': 'Checkout session created',
};

const ACTION_TYPE_LABELS = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  LOGIN: 'Sign-in',
  STATUS_CHANGE: 'Status change',
  OTHER: 'Action',
};

function humanizeKey(key = '') {
  return key
    .replace(/_/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function humanizeAction(action = '') {
  return ACTION_LABELS[action] || humanizeKey(action) || 'Unknown action';
}

function humanizeActionType(type) {
  return ACTION_TYPE_LABELS[type] || humanizeKey(type) || 'Action';
}

module.exports = { ACTION_LABELS, ACTION_TYPE_LABELS, humanizeAction, humanizeActionType, humanizeKey };
