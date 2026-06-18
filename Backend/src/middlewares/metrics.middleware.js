const client = require('prom-client');

const register = new client.Registry();

register.setDefaultLabels({
  app: 'nova-store-backend'
});

client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

register.registerMetric(httpRequestsTotal);
register.registerMetric(httpRequestDurationSeconds);

const metricsMiddleware = (req, res, next) => {
  const start = process.hrtime();

  res.on('finish', () => {
    const diff = process.hrtime(start);
    const duration = diff[0] + diff[1] / 1e9;
    
    // Determine path/route
    const route = req.route ? req.route.path : (req.baseUrl || '') + (req.path || '');

    httpRequestsTotal.inc({
      method: req.method,
      route: route || req.originalUrl,
      status: res.statusCode
    });

    httpRequestDurationSeconds.observe({
      method: req.method,
      route: route || req.originalUrl,
      status: res.statusCode
    }, duration);
  });

  next();
};

module.exports = {
  metricsMiddleware,
  register
};
