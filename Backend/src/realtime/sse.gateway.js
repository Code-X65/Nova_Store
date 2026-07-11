const redis = require('redis');
const { redisClient } = require('../config/redis');

// Connection registries. Keyed by user id for targeted delivery, plus a
// broadcast set for the management dashboard.
const userClients = new Map(); // userId -> Set<ServerResponse>
const dashboardClients = new Set(); // Set<ServerResponse>

let subscriber = null;
let subscribing = false;

const HEARTBEAT_MS = 25_000;

function send(res, event) {
  try {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch {
    // socket already closed — cleaned up by close handler
  }
}

function addUserClient(userId, res) {
  if (!userClients.has(userId)) userClients.set(userId, new Set());
  userClients.get(userId).add(res);
}

function removeUserClient(userId, res) {
  const set = userClients.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) userClients.delete(userId);
}

function deliver(channel, payload) {
  try {
    const event = JSON.parse(payload);
    if (channel === 'nova:rt:admin-dashboard') {
      for (const res of dashboardClients) send(res, event);
      return;
    }
    const m = /^nova:rt:user:(.+)$/.exec(channel);
    if (m) {
      const set = userClients.get(m[1]);
      if (set) for (const res of set) send(res, event);
    }
  } catch {
    // ignore malformed payloads
  }
}

async function ensureSubscriber() {
  if (subscriber || subscribing) return;
  subscribing = true;
  try {
    subscriber = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    subscriber.on('pmessage', (_pattern, channel, message) => deliver(channel, message));
    subscriber.on('error', () => { /* best-effort; SSE still alive */ });
    await subscriber.connect();
    await subscriber.pSubscribe('nova:rt:user:*');
    await subscriber.subscribe('nova:rt:admin-dashboard');
  } catch (err) {
    subscriber = null; // SSE connections fall back to polling
  } finally {
    subscribing = false;
  }
}

/**
 * Register an SSE connection. `req.admin` is guaranteed by the global
 * requireAdmin middleware. Super Admins / Managers also receive dashboard
 * broadcasts so the staff list stays live.
 */
function registerSse(req, res) {
  const userId = req.admin?.id;
  const isManagerOrOwner = req.admin?.hasRole('STORE_OWNER', 'MANAGER');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(': connected\n\n');

  addUserClient(userId, res);
  if (isManagerOrOwner) dashboardClients.add(res);

  const heartbeat = setInterval(() => {
    try { res.write(`: ping\n\n`); } catch { /* noop */ }
  }, HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(heartbeat);
    removeUserClient(userId, res);
    dashboardClients.delete(res);
  };
  req.on('close', cleanup);
  res.on('close', cleanup);

  ensureSubscriber();
}

/**
 * Push an event to a single connected admin user. Delivery is routed solely
 * through Redis Pub/Sub so the subscriber fan-out (which also covers this
 * instance's own connections) handles the actual write — this avoids
 * double-delivering to locally connected clients.
 *
 * @param {string} userId
 * @param {object} event  - any JSON-serializable payload
 */
function publishToUser(userId, event) {
  if (!userId) return;
  if (redisClient && redisClient.isOpen) {
    redisClient.publish(`nova:rt:user:${userId}`, JSON.stringify(event)).catch(() => {});
  }
}

/**
 * Push an event to all connected dashboard clients (managers/owners).
 */
function publishToDashboard(event) {
  if (redisClient && redisClient.isOpen) {
    redisClient.publish('nova:rt:admin-dashboard', JSON.stringify(event)).catch(() => {});
  }
}

module.exports = { registerSse, initRealtime: ensureSubscriber, publishToUser, publishToDashboard };
