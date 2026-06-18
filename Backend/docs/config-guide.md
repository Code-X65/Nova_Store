# Nova Store — Backend Configuration Guide

This guide describes all environment variables used by the Nova Store backend. It highlights which parameters are strictly required for production deployment vs which parameters are optional or fallback to development stubs.

---

## 🔒 Security & Session Configurations

| Variable Name | Required in Prod? | Default/Fallback | Description |
|---|---|---|---|
| `NODE_ENV` | Yes | `development` | Deployment environment. Valid values: `development`, `production`, `test`. |
| `PORT` | No | `5000` | HTTP port the Express server binds to. |
| `SESSION_SECRET` | **YES** | *None* | Comma-separated list of session keys. Must not contain `'CHANGE_ME_IN_PRODUCTION'`. |
| `JWT_ACCESS_SECRET` | **YES** | *None* | Comma-separated list of JWT verification keys for rotation. Must not contain `'CHANGE_ME_IN_PRODUCTION'`. |
| `JWT_REFRESH_SECRET` | **YES** | *None* | Comma-separated list of JWT refresh keys. Must not contain `'CHANGE_ME_IN_PRODUCTION'`. |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Salt rounds used for user password hashing. |

---

## 🗄️ Database & Cache Connections

| Variable Name | Required in Prod? | Default/Fallback | Description |
|---|---|---|---|
| `DATABASE_URL` | **YES** | *None* | Connection string to the Supabase PostgreSQL database. |
| `SUPABASE_URL` | **YES** | *None* | Project URL for the Supabase project dashboard. |
| `SUPABASE_ANON_KEY` | **YES** | *None* | Anonymous client key for Supabase client initialization. |
| `SUPABASE_SERVICE_ROLE_KEY` | **YES** | *None* | Service role key for admin privileges and bypassing RLS in server operations. |
| `REDIS_URL` | **YES** | `redis://localhost:6379` | Connection string to Redis cache and session server. Server will fail-fast in production if unreachable. |

---

## 📧 Mail & Notification Integrations

| Variable Name | Required in Prod? | Default/Fallback | Description |
|---|---|---|---|
| `EMAIL_FROM` | **YES** | `noreply@novastore.com` | From sender email address displayed on system notifications. |
| `SMTP_HOST` | **YES** | `smtp-relay.brevo.com` | Hostname of the outgoing SMTP relay. |
| `SMTP_PORT` | **YES** | `587` | Outgoing SMTP connection port. |
| `SMTP_USER` | **YES** | *None* | Username credentials for SMTP authentication. |
| `SMTP_PASS` | **YES** | *None* | Password credentials for SMTP authentication. |

---

## 📲 SMS (Twilio) Configurations

| Variable Name | Required in Prod? | Default/Fallback | Description |
|---|---|---|---|
| `TWILIO_ACCOUNT_SID` | No | *None* | Twilio Account SID. If missing in development, system falls back to a stub logger. |
| `TWILIO_AUTH_TOKEN` | No | *None* | Twilio Auth Token credentials. |
| `TWILIO_FROM_NUMBER` | No | *None* | Verified phone number/sender name used for SMS broadcasting. |

---

## 💳 Payment Gateway Configurations

| Variable Name | Required in Prod? | Default/Fallback | Description |
|---|---|---|---|
| `PAYSTACK_SECRET_KEY` | **YES** | *None* | Paystack payment gateway secret key for checkout initialize and verification. |
| `STRIPE_SECRET_KEY` | No | *None* | Stripe secret key (future support). |
| `STRIPE_WEBHOOK_SECRET` | No | *None* | Stripe webhook signature key. |

---

## 🔄 Dynamic Secrets Rotation

The backend supports **live secrets rotation** without restarting the application process:
- A file watcher listens to changes in the `.env` configuration file.
- If `.env` is modified, the new keys are reloaded in-memory via `dotenv` and re-validated using the Joi schema.
- All JWT verification and session actions retrieve the secrets list dynamically, enabling smooth rotation.
