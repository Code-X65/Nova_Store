/**
 * event-bus.js — lightweight domain event bus.
 *
 * Decouples emitters (orders, inventory, catalog, reviews, staff) from the
 * audit-logging and notification-routing side effects. Uses an in-process
 * EventEmitter for same-instance handling and Redis Pub/Sub (`nova:events`)
 * to fan out across instances. Each instance ignores its own echoed messages
 * via a per-process instance id.
 */
const { EventEmitter } = require('events');
const crypto = require('crypto');
const { redisClient } = require('../config/redis');

const CHANNEL = 'nova:events';
const INSTANCE_ID = crypto.randomUUID();

const emitter = new EventEmitter();
emitter.setMaxListeners(100);

let subscriberReady = false;
let subscriber = null;

function emit(eventKey, payload = {}) {
  const envelope = { iid: INSTANCE_ID, eventKey, payload, ts: Date.now() };
  // Defer local handlers so they run after the current HTTP response is
  // flushed — keeps audit/notification side-effects off the request path.
  setImmediate(() => {
    try {
      emitter.emit(eventKey, envelope);
    } catch (err) {
      console.error(`[EventBus] Local handler error for ${eventKey}:`, err.message);
    }
  });
  // Cross-instance fan-out.
  if (redisClient && redisClient.isOpen) {
    redisClient.publish(CHANNEL, JSON.stringify(envelope)).catch(() => {});
  }
}

function on(eventKey, handler) {
  emitter.on(eventKey, (env) => {
    try {
      handler(env.payload, env);
    } catch (err) {
      console.error(`[EventBus] Handler error for ${eventKey}:`, err.message);
    }
  });
}

async function initRealtime() {
  if (subscriberReady || !redisClient) return;
  try {
    subscriber = redisClient.duplicate();
    await subscriber.connect();
    await subscriber.subscribe(CHANNEL, (message) => {
      try {
        const env = JSON.parse(message);
        if (env.iid === INSTANCE_ID) return; // ignore our own echo
        emitter.emit(env.eventKey, env);
      } catch {
        /* malformed */
      }
    });
    subscriberReady = true;
  } catch (err) {
    console.warn('[EventBus] Redis subscriber init skipped:', err.message);
  }
}

module.exports = { emit, on, initRealtime, CHANNEL };
