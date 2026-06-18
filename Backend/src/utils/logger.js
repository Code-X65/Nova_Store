const winston = require('winston');
const contextStore = require('./context');

const addRequestId = winston.format((info) => {
  const store = contextStore.getStore();
  if (store && store.requestId) {
    info.requestId = store.requestId;
  }
  return info;
});

const transports = [
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production'
      ? winston.format.combine(
          addRequestId(),
          winston.format.timestamp(),
          winston.format.json()
        )
      : winston.format.combine(
          addRequestId(),
          winston.format.colorize(),
          winston.format.simple()
        )
  })
];

// Add file logging if configured or not in production
if (process.env.LOG_TO_FILES === 'true' || process.env.NODE_ENV !== 'production') {
  transports.push(new winston.transports.File({ filename: 'logs/error.log', level: 'error' }));
  transports.push(new winston.transports.File({ filename: 'logs/combined.log' }));
}

// Add optional secure Datadog direct HTTP log streaming
if (process.env.DATADOG_API_KEY) {
  const ddSite = process.env.DATADOG_SITE || 'datadoghq.com';
  transports.push(new winston.transports.Http({
    host: `http-intake.logs.${ddSite}`,
    path: `/api/v2/logs?dd-api-key=${process.env.DATADOG_API_KEY}&ddsource=nodejs&service=nova-store-backend`,
    ssl: true,
    format: winston.format.combine(
      addRequestId(),
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
}

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  defaultMeta: { service: 'nova-store-backend' },
  format: winston.format.combine(
    addRequestId(),
    winston.format.json()
  ),
  transports
});

module.exports = logger;
