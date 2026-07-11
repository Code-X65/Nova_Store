const { redisClient } = require('../config/redis');

// Channel scheme:
//   nova:rt:user:<userId>          — events targeted at one admin's own sessions/devices
//   nova:rt:admin-dashboard        — broadcast to all Super-Admin/Manager dashboards
const USER_CH  = (userId) => `nova:rt:user:${userId}`;
const DASH_CH  = 'nova:rt:admin-dashboard';

let isReady = false;
redisClient.on('ready', () => { isReady = true; });
redisClient.on('end',    () => { isReady = false; });

/**
 * Publish an event to a specific admin's real-time channel.
 * Failures are swallowed (real-time is best-effort; polling is the fallback).
 * @param {string} userId
 * @param {object} event  - { type: string, ...payload }
 */
async function publishToUser(userId, event) {
  try {
    if (!isReady && !redisClient.isOpen) return;
    await redisClient.publish(USER_CH(userId), JSON.stringify({ ...event, userId, at: Date.now() }));
  } catch (err) {
    // best-effort
  }
}

/**
 * Broadcast an event to all admin dashboards watching the staff list.
 */
async function publishDashboard(event) {
  try {
    if (!isReady && !redisClient.isOpen) return;
    await redisClient.publish(DASH_CH, JSON.stringify({ ...event, at: Date.now() }));
  } catch (err) {
    // best-effort
  }
}

/**
 * Convenience: emit a change that affects both the target user and the
 * management dashboard (the common case for access-management mutations).
 */
async function emitAccessChange(targetUserId, type, extra = {}) {
  await publishToUser(targetUserId, { type, ...extra });
  await publishDashboard({ type: 'admin.list.changed', actor: extra.actor, targetUserId });
}

module.exports = { publishToUser, publishDashboard, emitAccessChange, USER_CH, DASH_CH };
