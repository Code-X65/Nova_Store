# Production Deployment Guide

This guide provides step-by-step instructions for deploying the Nova Store application to a production environment.

---

## 1. Production Docker Execution

The application is containerized using a multi-stage Docker build to keep the runner size minimal.

### Build the Production Image
From the **root** workspace directory, run:
```bash
docker build -t novastore-backend:latest ./Backend
```

### Run the Container
Start the container while binding your local production environment variables file:
```bash
docker run -d \
  --name novastore-api \
  --env-file ./Backend/.env \
  -p 5000:5000 \
  --restart unless-stopped \
  novastore-backend:latest
```

---

## 2. Database Schema Setup

Before launching the API, execute the database migration scripts located in `Backend/sql/` in numeric sequence (001 to 043) against your target PostgreSQL database (e.g., Supabase).

### Applying via Migration Tool / CLI
You can execute these SQL files directly using the PostgreSQL CLI (`psql`):
```bash
# Example command to run a single migration file
psql -h aws-0-eu-west-1.pooler.supabase.com -U postgres.sonmxdoomrcxbpkqghdn -d postgres -f Backend/sql/001_create_users_table.sql
```

---

## 3. Environment Configurations Reference

The API reads variables from the environment on startup. Ensure the following configurations are set:

| Group | Key | Description | Example |
|---|---|---|---|
| **App** | `PORT` | Local network binding port | `5000` |
| | `NODE_ENV` | Run environment | `production` |
| | `CLIENT_URL` | Frontend client origin address | `https://novastore.com` |
| | `SESSION_SECRET` | Secret key for signing sessions | `highly-secure-random-string` |
| **Database** | `DATABASE_URL` | PostgreSQL direct or pooled URI | `postgresql://user:pass@pooler.com/db` |
| | `SUPABASE_URL` | Supabase project endpoint | `https://sonmxdoomrcxbpkqghdn.supabase.co` |
| | `SUPABASE_SERVICE_ROLE_KEY` | Admin bypass key (RLS bypass) | `eyJhbGciOi...` |
| **Cache** | `REDIS_URL` | Redis server connection URI | `redis://localhost:6379` |
| **SMS** | `TWILIO_ACCOUNT_SID` | Twilio SID credentials | `AC...` |
| | `TWILIO_AUTH_TOKEN` | Twilio Auth Token credentials | `22...` |
| | `TWILIO_FROM_NUMBER` | Registered sender Twilio number | `+15107562824` |
| **Email** | `EMAIL_FROM` | Outbound sender address | `noreply@novastore.com` |
| | `SMTP_HOST` | SMTP server provider relay | `smtp-relay.brevo.com` |
| | `SMTP_PORT` | SMTP port | `587` |
| | `SMTP_USER` | SMTP username credential | `smtp-username` |
| | `SMTP_PASS` | SMTP password credential | `smtp-password` |
| **Payment** | `PAYSTACK_SECRET_KEY` | Paystack secret key | `sk_live_...` |

---

## 4. CI/CD GitHub Actions Pipeline

Create a file named `.github/workflows/ci-cd.yml` in the project root to configure automated testing and container uploads on code push:

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  # 1. Test Code Integration
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
          cache-dependency-path: Backend/package-lock.json

      - name: Install Dependencies
        run: |
          cd Backend
          npm ci

      - name: Run Unit Tests
        run: |
          cd Backend
          npm run test:unit

  # 2. Build & Push Production Docker Image
  build-and-push:
    needs: test
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry (GHCR)
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push Docker Image
        uses: docker/build-push-action@v5
        with:
          context: ./Backend
          file: ./Backend/Dockerfile
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/novastore-backend:latest
            ghcr.io/${{ github.repository }}/novastore-backend:${{ github.sha }}
```
