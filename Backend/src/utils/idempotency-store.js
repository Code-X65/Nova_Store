const crypto = require('crypto');
const { redisClient } = require('../config/redis');
const supabase = require('../config/supabase');

// Tier 3 In-memory fallback map
const memoryStore = new Map();

// Periodic cleanup of expired memory keys
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memoryStore.entries()) {
    if (v.expiresAt < now) {
      memoryStore.delete(k);
    }
  }
}, 60000).unref();

/**
 * Deterministic JSON stringifier to ensure key order variations hash to the same value
 */
function deterministicStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(deterministicStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const properties = keys.map(key => `${JSON.stringify(key)}:${deterministicStringify(obj[key])}`);
  return '{' + properties.join(',') + '}';
}

/**
 * Computes SHA-256 hash of parsed request body
 */
function hashRequestBody(body) {
  const str = deterministicStringify(body);
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Check if Redis connection is active and ready
 */
function isRedisActive() {
  return redisClient && redisClient.isOpen && redisClient.isReady;
}

const idempotencyStore = {
  /**
   * Attempts to lock a key.
   * Returns:
   *  - { status: 'new' } if lock acquired.
   *  - { status: 'started', requestBodyHash } if request is currently in progress.
   *  - { status: 'completed', responseStatus, responseBody, requestBodyHash } if request completed.
   */
  async lock(key, hash, userId, path, method, ttlSeconds = 86400) {
    const redisKey = `idempotency:${key}`;

    // 1. TIER 1: Redis
    if (isRedisActive()) {
      try {
        const lockPayload = { status: 'started', requestBodyHash: hash, userId, requestPath: path, requestMethod: method };
        const setRes = await redisClient.set(redisKey, JSON.stringify(lockPayload), {
          NX: true,
          EX: ttlSeconds
        });

        if (setRes === 'OK') {
          return { status: 'new' };
        }

        const cached = await redisClient.get(redisKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Standardise output keys
          return {
            status: parsed.status,
            requestBodyHash: parsed.requestBodyHash,
            responseStatus: parsed.responseStatus,
            responseBody: parsed.responseBody
          };
        }
      } catch (err) {
        console.warn('[Idempotency] Redis lock failed, falling back to PostgreSQL:', err.message);
      }
    }

    // 2. TIER 2: PostgreSQL (Supabase)
    try {
      // Fetch key first to handle check and clean up expired rows
      const { data: existing, error: fetchError } = await supabase
        .from('idempotency_keys')
        .select('*')
        .eq('key', key)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        const isExpired = new Date(existing.expires_at) < new Date();
        if (isExpired) {
          await supabase.from('idempotency_keys').delete().eq('key', key);
        } else {
          if (existing.response_status === 0) {
            return { status: 'started', requestBodyHash: existing.request_body_hash };
          } else {
            return {
              status: 'completed',
              responseStatus: existing.response_status,
              responseBody: existing.response_body,
              requestBodyHash: existing.request_body_hash
            };
          }
        }
      }

      // Insert new lock row
      const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
      const { data: inserted, error: insertError } = await supabase
        .from('idempotency_keys')
        .insert([{
          key,
          user_id: userId || null,
          request_path: path,
          request_method: method,
          request_body_hash: hash,
          response_status: 0,
          response_body: {},
          expires_at: expiresAt
        }])
        .select();

      if (insertError) {
        if (insertError.code === '23505') {
          // Race condition unique key constraint violation
          const { data: reFetched, error: reFetchError } = await supabase
            .from('idempotency_keys')
            .select('*')
            .eq('key', key)
            .single();

          if (reFetchError) throw reFetchError;

          if (reFetched) {
            if (reFetched.response_status === 0) {
              return { status: 'started', requestBodyHash: reFetched.request_body_hash };
            } else {
              return {
                status: 'completed',
                responseStatus: reFetched.response_status,
                responseBody: reFetched.response_body,
                requestBodyHash: reFetched.request_body_hash
              };
            }
          }
        }
        throw insertError;
      }

      return { status: 'new' };
    } catch (err) {
      console.warn('[Idempotency] PostgreSQL lock failed, falling back to In-Memory store:', err.message);
    }

    // 3. TIER 3: In-Memory Map
    const memoryKey = `idempotency:${key}`;
    const memItem = memoryStore.get(memoryKey);

    if (memItem) {
      if (memItem.expiresAt < Date.now()) {
        memoryStore.delete(memoryKey);
      } else {
        if (memItem.status === 'started') {
          return { status: 'started', requestBodyHash: memItem.requestBodyHash };
        } else {
          return {
            status: 'completed',
            responseStatus: memItem.responseStatus,
            responseBody: memItem.responseBody,
            requestBodyHash: memItem.requestBodyHash
          };
        }
      }
    }

    memoryStore.set(memoryKey, {
      status: 'started',
      requestBodyHash: hash,
      expiresAt: Date.now() + ttlSeconds * 1000
    });

    return { status: 'new' };
  },

  /**
   * Resolves a lock with the completed response payload.
   */
  async resolve(key, responseStatus, responseBody, ttlSeconds = 86400) {
    const redisKey = `idempotency:${key}`;

    // 1. TIER 1: Redis
    if (isRedisActive()) {
      try {
        const payload = {
          status: 'completed',
          responseStatus,
          responseBody
        };
        await redisClient.set(redisKey, JSON.stringify(payload), {
          EX: ttlSeconds
        });
        return;
      } catch (err) {
        console.warn('[Idempotency] Redis resolve failed, falling back to PostgreSQL:', err.message);
      }
    }

    // 2. TIER 2: PostgreSQL
    try {
      const { error } = await supabase
        .from('idempotency_keys')
        .update({
          response_status: responseStatus,
          response_body: responseBody
        })
        .eq('key', key);

      if (!error) return;
      throw error;
    } catch (err) {
      console.warn('[Idempotency] PostgreSQL resolve failed, falling back to In-Memory store:', err.message);
    }

    // 3. TIER 3: In-Memory Map
    const memoryKey = `idempotency:${key}`;
    const existing = memoryStore.get(memoryKey);
    memoryStore.set(memoryKey, {
      status: 'completed',
      responseStatus,
      responseBody,
      requestBodyHash: existing ? existing.requestBodyHash : undefined,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  },

  /**
   * Releases/deletes a lock so the request can be retried.
   */
  async release(key) {
    const redisKey = `idempotency:${key}`;

    // 1. TIER 1: Redis
    if (isRedisActive()) {
      try {
        await redisClient.del(redisKey);
        return;
      } catch (err) {
        console.warn('[Idempotency] Redis release failed, falling back to PostgreSQL:', err.message);
      }
    }

    // 2. TIER 2: PostgreSQL
    try {
      const { error } = await supabase
        .from('idempotency_keys')
        .delete()
        .eq('key', key);

      if (!error) return;
      throw error;
    } catch (err) {
      console.warn('[Idempotency] PostgreSQL release failed, falling back to In-Memory store:', err.message);
    }

    // 3. TIER 3: In-Memory Map
    const memoryKey = `idempotency:${key}`;
    memoryStore.delete(memoryKey);
  },

  /**
   * Helper to clean up all keys in memory (useful for tests)
   */
  clearMemoryStore() {
    memoryStore.clear();
  }
};

module.exports = {
  idempotencyStore,
  deterministicStringify,
  hashRequestBody
};
