const Joi = require('joi');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(5000),
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),
  DATABASE_URL: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  SESSION_SECRET: Joi.string().required(),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  CLIENT_URL: Joi.string().uri().default('http://localhost:5173'),
  EMAIL_FROM: Joi.string().email().required(),
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().required(),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),
}).unknown(true);

function validate(envData, isHotReload = false) {
  const { error, value: envVars } = envSchema.validate(envData, { abortEarly: false });

  if (error) {
    console.error('\x1b[31m%s\x1b[0m', `❌ CONFIGURATION ERROR: Invalid environment variables${isHotReload ? ' (Hot Reload aborted)' : ''}:`);
    error.details.forEach((detail) => {
      console.error('\x1b[31m%s\x1b[0m', `  - ${detail.message}`);
    });
    if (!isHotReload) {
      process.exit(1);
    }
    return null;
  }

  // Perform production-only checks for secrets
  if (envVars.NODE_ENV === 'production') {
    const checkPlaceholder = (val) => {
      if (!val) return true;
      const secrets = val.split(',');
      return secrets.some(s => s === 'CHANGE_ME_IN_PRODUCTION' || s.trim() === '');
    };

    const placeholders = [];
    if (checkPlaceholder(envVars.JWT_ACCESS_SECRET)) placeholders.push('JWT_ACCESS_SECRET');
    if (checkPlaceholder(envVars.JWT_REFRESH_SECRET)) placeholders.push('JWT_REFRESH_SECRET');
    if (checkPlaceholder(envVars.SESSION_SECRET)) placeholders.push('SESSION_SECRET');

    if (placeholders.length > 0) {
      console.error('\x1b[31m%s\x1b[0m', `❌ CONFIGURATION ERROR: Placeholder secrets detected in production${isHotReload ? ' (Hot Reload aborted)' : ''}:`);
      placeholders.forEach((name) => {
        console.error('\x1b[31m%s\x1b[0m', `  - ${name} cannot be empty or contain placeholder 'CHANGE_ME_IN_PRODUCTION'`);
      });
      if (!isHotReload) {
        process.exit(1);
      }
      return null;
    }
  }

  return envVars;
}

// Initial validation
const envVars = validate(process.env);

// Setup Hot-Reload File Watcher for .env file
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
  let debounceTimeout = null;
  fs.watch(envPath, (eventType) => {
    if (eventType === 'change') {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        console.log('🔄 .env file change detected. Triggering hot reload...');
        const parsed = dotenv.config({ override: true });
        if (parsed.error) {
          console.error('❌ Hot reload failed: Failed to read .env file', parsed.error.message);
          return;
        }
        const validated = validate(process.env, true);
        if (validated) {
          console.log('✅ Configuration hot-reloaded and Joi validated successfully.');
        }
      }, 100);
    }
  });
}

module.exports = envVars;
