const supabase = require('../config/supabase');
const { redisClient: redis } = require('../config/redis');
const ErrorResponse = require('../utils/errorResponse');
const { register } = require('../middlewares/metrics.middleware');

class HealthController {
  /**
   * GET /health/metrics
   * Expose Prometheus metrics
   */
  async getMetrics(req, res, next) {
    try {
      res.setHeader('Content-Type', register.contentType);
      res.send(await register.metrics());
    } catch (error) {
      next(error);
    }
  }
  /**
   * GET /health
   * Basic health check endpoint
   */
  async getHealth(req, res, next) {
    try {
      const healthStatus = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        services: {}
      };

      // Check database connectivity
      try {
        await supabase.from('users').select('id').limit(1);
        healthStatus.services.database = { status: 'UP' };
      } catch (dbError) {
        healthStatus.services.database = {
          status: 'DOWN',
          error: dbError.message
        };
        healthStatus.status = 'DEGRADED';
      }

      // Check Redis connectivity
      try {
        await redis.ping();
        healthStatus.services.redis = { status: 'UP' };
      } catch (redisError) {
        healthStatus.services.redis = {
          status: 'DOWN',
          error: redisError.message
        };
        // Redis is optional for basic functionality, so don't mark overall status as DOWN
        if (healthStatus.status === 'UP') {
          healthStatus.status = 'DEGRADED';
        }
      }

      // Determine HTTP status based on overall health
      const statusCode = healthStatus.status === 'UP' ? 200 : 503;
      res.status(statusCode).json({ success: true, data: healthStatus });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /health/detailed
   * Detailed health check with dependency information
   */
  async getDetailedHealth(req, res, next) {
    try {
      const detailedStatus = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0',
        checks: {}
      };

      // Database check
      try {
        const start = Date.now();
        await supabase.from('users').select('id').limit(1);
        const latency = Date.now() - start;
        detailedStatus.checks.database = {
          status: 'UP',
          latency: `${latency}ms`,
          version: 'PostgreSQL (Supabase)'
        };
      } catch (dbError) {
        detailedStatus.checks.database = {
          status: 'DOWN',
          error: dbError.message
        };
        detailedStatus.status = 'DOWN';
      }

      // Redis check
      try {
        const start = Date.now();
        await redis.ping();
        const latency = Date.now() - start;
        detailedStatus.checks.redis = {
          status: 'UP',
          latency: `${latency}ms`,
          version: await redis.info('redis_version')
        };
      } catch (redisError) {
        detailedStatus.checks.redis = {
          status: 'DOWN',
          error: redisError.message
        };
        // Redis failure doesn't mean the app is down
        if (detailedStatus.status === 'UP') {
          detailedStatus.status = 'DEGRADED';
        }
      }

      // Disk space check (basic)
      try {
        const os = require('os');
        const totalmem = os.totalmem();
        const freemem = os.freemem();
        const usedmem = totalmem - freemem;
        const memoryUsage = ((usedmem / totalmem) * 100).toFixed(2);
        
        detailedStatus.checks.memory = {
          status: 'UP',
          usage: `${memoryUsage}%`,
          total: `${Math.floor(totalmem / 1024 / 1024)} MB`,
          free: `${Math.floor(freemem / 1024 / 1024)} MB`
        };
        
        // Warn if memory usage is high
        if (parseFloat(memoryUsage) > 90) {
          detailedStatus.checks.memory.status = 'WARN';
          if (detailedStatus.status === 'UP') {
            detailedStatus.status = 'DEGRADED';
          }
        }
      } catch (memError) {
        detailedStatus.checks.memory = {
          status: 'UNKNOWN',
          error: memError.message
        };
      }

      // 4. Email Transport Connectivity Check
      try {
        const EmailService = require('../services/email.service');
        const start = Date.now();
        await EmailService.transporter.verify();
        const latency = Date.now() - start;
        detailedStatus.checks.email = {
          status: 'UP',
          latency: `${latency}ms`
        };
      } catch (emailError) {
        detailedStatus.checks.email = {
          status: 'DOWN',
          error: emailError.message
        };
        if (detailedStatus.status === 'UP') {
          detailedStatus.status = 'DEGRADED';
        }
      }

      // 5. SMS / Twilio Connectivity Check
      try {
        const SMSService = require('../services/sms.service');
        if (SMSService.client) {
          const start = Date.now();
          await SMSService.client.api.v2010.accounts(SMSService.accountSid).fetch();
          const latency = Date.now() - start;
          detailedStatus.checks.sms = {
            status: 'UP',
            latency: `${latency}ms`
          };
        } else {
          detailedStatus.checks.sms = {
            status: 'STUB',
            info: 'Twilio credentials not configured'
          };
        }
      } catch (smsError) {
        detailedStatus.checks.sms = {
          status: 'DOWN',
          error: smsError.message
        };
        if (detailedStatus.status === 'UP') {
          detailedStatus.status = 'DEGRADED';
        }
      }

      // 6. Payment / Paystack Connectivity Check
      try {
        const start = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const response = await fetch('https://api.paystack.co/', { signal: controller.signal });
        clearTimeout(timeoutId);
        const latency = Date.now() - start;
        detailedStatus.checks.payment = {
          status: response.ok || response.status === 200 || response.status === 401 ? 'UP' : 'DEGRADED',
          latency: `${latency}ms`
        };
      } catch (paystackError) {
        detailedStatus.checks.payment = {
          status: 'DOWN',
          error: paystackError.message
        };
        if (detailedStatus.status === 'UP') {
          detailedStatus.status = 'DEGRADED';
        }
      }

      const statusCode = 
        detailedStatus.status === 'UP' ? 200 :
        detailedStatus.status === 'DEGRADED' ? 200 : 503;
        
      res.status(statusCode).json({ success: true, data: detailedStatus });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /health/ready
   * Readiness probe - checks if service is ready to accept traffic
   */
  async getReadiness(req, res, next) {
    try {
      // Check critical dependencies for readiness
      let ready = true;
      const checks = {};

      // Database readiness
      try {
        await supabase.from('users').select('id').limit(1);
        checks.database = { status: 'READY' };
      } catch (dbError) {
        checks.database = { status: 'NOT_READY', error: dbError.message };
        ready = false;
      }

      // Redis readiness
      try {
        await redis.ping();
        checks.redis = { status: 'READY' };
      } catch (redisError) {
        checks.redis = { status: 'NOT_READY', error: redisError.message };
        ready = false;
      }

      const statusCode = ready ? 200 : 503;
      res.status(statusCode).json({
        success: true,
        data: {
          status: ready ? 'READY' : 'NOT_READY',
          timestamp: new Date().toISOString(),
          checks
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /health/live
   * Liveness probe - checks if service is alive
   */
  async getLiveness(req, res, next) {
    try {
      res.status(200).json({
        success: true,
        data: {
          status: 'ALIVE',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new HealthController();