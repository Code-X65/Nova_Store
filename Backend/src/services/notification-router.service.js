/**
 * notification-router.service.js
 *
 * The Role-Based Routing Engine. Maps domain events (emitted on the event
 * bus) to admin TEAMS (RBAC roles) and delivers an in-app notification to
 * every staff member holding a matching role. Also writes the corresponding
 * enriched audit entry.
 *
 * Teams are existing RBAC roles (no new table):
 *   Sales Team      → ORDER_STAFF (+ MANAGER)
 *   Warehouse Team  → INVENTORY_STAFF (+ MANAGER)
 *   Owners          → STORE_OWNER
 */
const { supabaseAdmin } = require('../config/supabase');
const NotificationModel = require('../models/notification.model');
const AuditService = require('./audit.service');
const eventBus = require('../realtime/event-bus');
const sseGateway = require('../realtime/sse.gateway');
const logger = require('../utils/logger');

/**
 * Resolve distinct active staff users that hold any of the given roles.
 * @returns {Promise<Array<{userId:string, role:string}>>}
 */
async function resolveTeamRecipients(roles) {
  if (!roles || roles.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('user_id, roles:role_id(name)')
    .in('roles.name', roles);

  if (error || !data || data.length === 0) return [];

  const unique = new Map();
  for (const row of data) {
    const roleName = row.roles && row.roles.name;
    if (roleName && !unique.has(row.user_id)) {
      unique.set(row.user_id, roleName);
    }
  }

  const userIds = [...unique.keys()];
  if (userIds.length === 0) return [];

  // Only notify active staff.
  const { data: activeUsers } = await supabaseAdmin
    .from('users')
    .select('id')
    .in('id', userIds)
    .eq('is_active', true);

  const activeSet = new Set((activeUsers || []).map((u) => u.id));
  return [...unique.entries()]
    .filter(([userId]) => activeSet.has(userId))
    .map(([userId, role]) => ({ userId, role }));
}

async function getRule(eventKey) {
  const { data } = await supabaseAdmin
    .from('notification_routing_rules')
    .select('*')
    .eq('event_key', eventKey)
    .eq('is_active', true)
    .maybeSingle();
  return data || null;
}

/**
 * Create the in-app notification record and push it over SSE to the recipient.
 */
async function deliverOne({ userId, role, type, title, message, data = {}, severity = 'info' }) {
  try {
    const notif = await NotificationModel.create({
      user_id: userId,
      type,
      title,
      message,
      data,
      channel: ['inapp'],
      status: 'sent',
      sent_at: new Date().toISOString(),
      severity,
      recipient_role: role || null,
    });
    sseGateway.publishToUser(userId, { type: 'notification', notification: notif });
    return notif;
  } catch (err) {
    logger.error(`[NotifyRouter] Failed to deliver to ${userId}:`, err.message);
    return null;
  }
}

/**
 * Full handling of a domain event: enrich audit + route to team(s).
 *
 * Canonical payload:
 *   { actor:{id,fullName,role,sessionId}, resourceType, resourceId,
 *     actionType, oldValues, newValues, title, message, data, severity, deepLink }
 */
async function route(eventKey, payload = {}) {
  // 1. Enriched audit entry.
  try {
    await AuditService.logRaw(eventKey, payload.resourceType || 'system', payload.resourceId || null, {
      actor: payload.actor || null,
      severity: payload.severity || 'info',
      actionType: payload.actionType || 'OTHER',
      oldValues: payload.oldValues || null,
      newValues: payload.newValues || null,
    });
  } catch (err) {
    logger.error(`[NotifyRouter] Audit failed for ${eventKey}:`, err.message);
  }

  // 2. Resolve routing rule.
  const rule = await getRule(eventKey).catch(() => null);
  if (!rule) return; // no team configured for this event

  const recipients = await resolveTeamRecipients(rule.recipient_roles).catch(() => []);

  const title = payload.title || humanizeEvent(eventKey);
  const message = payload.message || '';
  const data = payload.data || {};
  const severity = payload.severity || rule.severity || 'info';

  for (const { userId, role } of recipients) {
    await deliverOne({
      userId,
      role,
      type: eventKey,
      title,
      message,
      data: { ...data, deepLink: payload.deepLink || data.deepLink || null },
      severity,
    });
  }
}

function humanizeEvent(eventKey) {
  return eventKey
    .split('.')
    .pop()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const HANDLED_EVENTS = [
  'order.placed',
  'order.payment_failed',
  'order.picked_out_of_stock',
  'order.shipped',
  'inventory.low_stock',
  'inventory.out_of_stock',
  'inventory.discrepancy',
  'catalog.product.deleted',
  'catalog.attribute.bulk_changed',
  'review.created',
  'staff.permission_changed',
  'staff.role_escalated',
  'staff.user_created',
];

let handlersRegistered = false;

function initHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;
  for (const eventKey of HANDLED_EVENTS) {
    eventBus.on(eventKey, (payload) => route(eventKey, payload));
  }
  logger.info(`[NotifyRouter] Registered handlers for ${HANDLED_EVENTS.length} domain events.`);
}

module.exports = {
  route,
  initHandlers,
  resolveTeamRecipients,
  getRule,
  emit: eventBus.emit, // convenience re-export
};
