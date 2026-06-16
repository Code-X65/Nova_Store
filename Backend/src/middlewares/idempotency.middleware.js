const { idempotencyStore, hashRequestBody } = require('../utils/idempotency-store');

const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

const idempotencyMiddleware = async (req, res, next) => {
  // Case-insensitive retrieval of the header
  const idempotencyKey = req.headers['idempotency-key'];

  // Skip if header is missing or HTTP method is not mutating (GET, HEAD, OPTIONS)
  if (!idempotencyKey || !mutatingMethods.includes(req.method)) {
    return next();
  }

  // Validate the key format
  if (
    typeof idempotencyKey !== 'string' ||
    idempotencyKey.trim().length < 10 ||
    idempotencyKey.trim().length > 256
  ) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Invalid Idempotency-Key format. Must be between 10 and 256 characters.'
      }
    });
  }

  const trimmedKey = idempotencyKey.trim();
  const bodyHash = hashRequestBody(req.body);
  const userId = req.user?.id || req.admin?.id || null;

  try {
    // Attempt to lock
    const lockResult = await idempotencyStore.lock(
      trimmedKey,
      bodyHash,
      userId,
      req.path,
      req.method,
      86400 // 24 hours TTL
    );

    if (lockResult.status === 'started') {
      // Conflict: Request is already running
      return res.status(409).json({
        success: false,
        error: {
          message: 'An identical request is currently in progress.'
        }
      });
    }

    if (lockResult.status === 'completed') {
      // Validate that the request body matches the original
      if (lockResult.requestBodyHash !== bodyHash) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Idempotency-Key mismatch: The request body does not match the original request for this key.'
          }
        });
      }

      // Replay the cached response
      res.set('Idempotency-Replay', 'true');
      return res.status(lockResult.responseStatus).json(lockResult.responseBody);
    }

    // Lock acquired successfully (status === 'new'). Override response methods to intercept.
    let saved = false;

    const saveResponse = async (status, body) => {
      if (saved) return;
      saved = true;

      if (status >= 500) {
        // Transient server error: release lock so client can retry
        try {
          await idempotencyStore.release(trimmedKey);
        } catch (err) {
          console.error('[Idempotency] Failed to release key on server error:', err.message);
        }
      } else {
        // Cache success or client error response
        try {
          await idempotencyStore.resolve(trimmedKey, status, body, 86400);
        } catch (err) {
          console.error('[Idempotency] Failed to save completed response:', err.message);
        }
      }
    };

    // Intercept client disconnects/aborts
    req.on('close', async () => {
      if (!res.headersSent && !saved) {
        try {
          await idempotencyStore.release(trimmedKey);
        } catch (err) {
          console.error('[Idempotency] Failed to release key on request close:', err.message);
        }
      }
    });

    // Override res.send
    const originalSend = res.send;
    res.send = function (body) {
      const status = res.statusCode;
      let parsedBody = body;
      if (typeof body === 'string') {
        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          // Keep as string
        }
      }
      saveResponse(status, parsedBody);
      return originalSend.apply(this, arguments);
    };

    // Override res.json (sometimes routes bypass send)
    const originalJson = res.json;
    res.json = function (obj) {
      const status = res.statusCode;
      saveResponse(status, obj);
      return originalJson.apply(this, arguments);
    };

    // Override res.end (for 204 No Content responses)
    const originalEnd = res.end;
    res.end = function () {
      const status = res.statusCode;
      saveResponse(status, {});
      return originalEnd.apply(this, arguments);
    };

    next();
  } catch (err) {
    console.error('[Idempotency] Middleware error:', err.message);
    // If idempotency check crashes, we proceed to next() to keep the API functional (fail-open)
    next();
  }
};

module.exports = idempotencyMiddleware;
