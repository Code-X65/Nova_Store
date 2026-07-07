# Nova Store — Customer Storefront Frontend Plan (novastore.com)

> Companion to `frontend-admin-plan.md`. The storefront is a **separate app** living as a **subdomain of novastore**: customer = `novastore.com`, admin = `admin.novastore.com`. Both apps share a `packages/ui` design system and the same stack (React + Vite + TS + Tailwind). **Customer auth = JWT bearer** (admin uses session cookies + CSRF) — this difference drives a second API client instance.
>
> **Pre-condition:** apply RBAC migrations `sql/053–057` (`npm run db:migrate` + `verify-store-migration.js`) and confirm the backend endpoints below exist/behave as described (see shared backend-readiness plan B3).

## 1. Domains & Topology
| App | Prod domain | Dev (localhost) | Auth |
|---|---|---|---|
| Storefront (customer) | `novastore.com` | `novastore.localhost` (or `:5173`) | JWT bearer + guest `x-session-id` |
| Admin | `admin.novastore.com` | `admin.novastore.localhost` (or `:5174`) | Session cookie + CSRF |

- admin is a **subdomain** of novastore → in prod both sit behind `novastore.com` DNS; CORS allowed origins must include **both** `novastore.com` and `admin.novastore.com` (currently backend `CLIENT_URL` only allows one origin — see §8 gap 1).
- Dev: true localhost subdomains require editing the **hosts file** (`127.0.0.1 novastore.localhost admin.novastore.localhost`) + a tiny reverse proxy (Caddy/Nginx/mkcert), OR simply run two Vite dev servers on ports `5173` (storefront) and `5174` (admin) and use ports in dev, real subdomains in prod.

## 2. Stack & Monorepo Structure
```
nova-store-frontend/            (npm/yarn/pnpm workspaces)
  apps/
    storefront/                 # novastore  (Vite, port 5173)
    admin/                      # admin.novastore (Vite, port 5174) — see frontend-admin-plan.md
  packages/
    ui/                         # shared components: Button, Input, Modal, ProductCard, Carousel, Rating, Toast, DataTable, charts, layout primitives
    api/                        # shared fetcher + TYPES only; TWO clients: createBearerClient() (storefront) & createCookieClient() (admin)
    config/                     # env schema, constants, feature flags
  package.json
```
- Storefront reuses `packages/ui` and `packages/api` types from the admin plan — no duplicated design system.
- `packages/api` exports **two** axios factories: one attaches `Authorization: Bearer` (storefront) and one sends cookies (`withCredentials`) + `x-csrf-token` (admin).

## 3. Customer Auth & API Client Layer (JWT — NO CSRF)
- **Login** `POST /api/v1/auth/login` (rate-limited) → returns **access + refresh JWTs**. Store access token (memory + `localStorage`/secure; refresh in `httpOnly`-ish storage). Attach `Authorization: Bearer <access>` on every request.
- **Refresh**: axios 401 interceptor → `POST /api/v1/auth/refresh-token` → retry. On failure → clear session, redirect to `/login`.
- **Guest cart**: generate + persist a `x-session-id` (UUID in `localStorage`); send as header on cart/checkout calls (`optionalAuth`). On login → `POST /api/v1/cart/merge` to merge guest cart into user cart.
- **Logout** `POST /api/v1/auth/logout`.
- **No CSRF** needed (bearer requests are CSRF-exempt on the backend).
- **OAuth**: `GET /api/v1/auth/oauth/google` (+ facebook/apple) → redirect; `GET /oauth/status` to know provider state.

## 4. Storefront Shared Shell (every visitor)
- **Header**: logo, **search bar** (→ `/search?q=`), category mega-menu (`GET /categories`), **Wishlist icon** (count), **Cart icon** (live count from `GET /cart`), **Account menu** (login/register or profile/orders/logout), **NotificationBell** (logged-in users).
- **NotificationBell** (logged-in): `GET /api/v1/notifications/unread-count` (badge), `GET /notifications/`, `PUT /notifications/:id/read`, `POST /notifications/mark-all-read`, `DELETE /notifications/:id`, settings `GET/PUT /notifications/settings`.
- **Footer**: links, contact, pulled from `GET /api/v1/settings/public`.
- **Mobile**: bottom nav (home, search, wishlist, cart, account).

## 5. Page Inventory (Customer)
Each page lists **what it entails** + **endpoints**.

### 5.1 Home / Landing
- Hero, category tiles (`GET /categories`), **Featured products** (`GET /products/featured`), **Recommendations** (`GET /products/recommendations` when authed), new arrivals, promo banners.
- Telemetry: `POST /api/v1/analytics/track-view` on view.

### 5.2 Catalog / Product Listing
- Filterable/sortable grid: category, brand, **price range** (`GET /products/price-range`), attributes, search, pagination.
- List: `GET /products` (query params: category, brand, min/max, sort, page, search).
- Category page: `GET /categories/:id` + `GET /categories/:id/subcategories` + filtered products.
- Brand page: `GET /brands/:id` + filtered products.
- Search page: `GET /products/search` (+ `POST /analytics/track-search`).
- Product card → detail.

### 5.3 Product Detail
- Gallery, variants (`PUT`/`DELETE /products/:id/variants/:variantId` are admin; customer only **views** variants), **stock** (`GET /products/:id/stock`), price, add-to-cart, add-to-wishlist, description/attributes (`GET /categories/:id/attributes`), related/recommendations.
- **Reviews**: `GET /reviews/product/:productId` (list), `POST /reviews` (write, auth), `POST /reviews/:id/helpful`.
- Endpoints: `GET /products/:id` (or `/products/slug/:slug`), `POST /cart`, `POST /wishlist`, `POST /wishlist/:productId/check`.

### 5.4 Cart
- Line items, qty edit, remove, subtotal, clear.
- Endpoints: `GET /cart` (guest via `x-session-id`), `PUT /cart/items/:id`, `DELETE /cart/items/:id`, `DELETE /cart`, `POST /cart/merge` (on login).
- "Proceed to checkout" → `/checkout`.

### 5.5 Checkout (guest + logged-in)
Multi-step wizard:
1. **Identity**: guest email/phone → `POST /auth/send-phone-otp` + `POST /auth/verify-phone` (OTP), or login.
2. **Shipping address**: choose from `GET /user/addresses` or enter one-time; `POST /user/addresses` if saving.
3. **Shipping method**: `POST /checkout/shipping` (uses `POST /shipping/calculate` + `GET /shipping/zones`).
4. **Coupon**: `POST /checkout/coupon` (validates via `POST /coupons/validate`).
5. **Review & create session**: `POST /checkout/validate` then `POST /checkout/session` (returns session/payable total). `POST /checkout/session/expire` for abandoned carts.
6. **Pay**: `POST /payments/paystack/initialize` → redirect to Paystack hosted page.
- All checkout routes are `optionalAuth` (guest allowed). Stock is reserved server-side during checkout.

### 5.6 Payment Return / Confirmation
- Paystack redirects back; `GET /payments/paystack/verify/:reference` confirms; show **Thank-you** + order summary. Webhook `POST /payments/webhook/paystack` is server-side (no UI).

### 5.7 Order Confirmation & Invoice
- `GET /orders/:id`, `GET /orders/:id/invoice` (PDF download).

### 5.8 Auth Pages
- **Register**: `POST /auth/register`; phone verification `POST /auth/send-phone-otp`, `/resend-phone-otp`, `/verify-phone`.
- **Login**: `POST /auth/login`; `GET /auth/oauth/status`; OAuth buttons (Google/Facebook/Apple).
- **Forgot / Reset**: `POST /auth/forgot-password` (rate-limited), `POST /auth/reset-password`.
- **Email verification**: `GET /auth/verify-email`, `POST /auth/resend-verification`.
- **Change / Set password**: `PUT /auth/change-password` (auth), `POST /auth/set-password` (auth).
- **Logout**: `POST /auth/logout`.

### 5.9 Account Dashboard (protected — `protect`)
- **Overview**.
- **Profile**: `GET /user/profile`, `PATCH /user/profile`, avatar `POST /user/avatar`, `DELETE /user/avatar`.
- **Email change**: `POST /user/email/request`, `POST /user/email/verify`.
- **Addresses**: `GET/POST /user/addresses`, `GET/PUT/DELETE /user/addresses/:id`, `PATCH /user/addresses/:id/default`.
- **Orders**: `GET /orders`, `GET /orders/:id`, `GET /orders/:id/invoice`, `POST /orders/:id/cancel`, `POST /orders/:id/reorder`. (Guest who later registers: `POST /orders/claim-guest-orders`.)
- **Returns**: `POST /orders/:id/return-request`, `POST /orders/:id/return-evidence` (multipart → Supabase), track status on order detail.
- **Wishlist**: `GET /wishlist`, `DELETE /wishlist/:productId`, `POST /wishlist/:productId/check`, `POST /wishlist/move-to-cart`, `POST /wishlist/move-all-to-cart`.
- **My Reviews**: write/see reviews (see §8 gap 2 — needs a `GET /reviews/me` endpoint).
- **Reported reviews**: `GET /reviews/reports/me`, `POST /reviews/reports`.
- **Notifications**: bell + `GET/PUT /notifications/settings`.
- **Onboarding**: first-login flow — `GET /onboarding/status`, `/onboarding/questions`, `POST /onboarding/answer`, `/onboarding/complete`, `/onboarding/skip`, `GET /onboarding/summary`.
- **GDPR**: `GET /user/gdpr/export`, `DELETE /user/gdpr/forget`, `DELETE /user/account`.

### 5.10 Wishlist (standalone page)
- `GET /wishlist`, remove, move-to-cart, move-all-to-cart.

### 5.11 Track / Claim Guest Order
- `POST /orders/claim-guest-orders` (after registering) to attach prior guest orders.

### 5.12 Static / Info (light backend)
- About / Contact / FAQ content from `GET /settings/public`; currencies `GET /currencies`.

## 6. Visitor → Logged-in Capability Matrix
| Capability | Guest | Logged-in Customer |
|---|---|---|
| Browse products/categories/brands | ✓ | ✓ |
| Search, recommendations, featured | ✓ | ✓ (+ personalized) |
| Add to cart (guest session) | ✓ | ✓ |
| Checkout & Pay (guest) | ✓ | ✓ |
| Write review / helpful | – | ✓ |
| Wishlist, addresses, order history | – | ✓ |
| Returns, notifications, onboarding, GDPR | – | ✓ |
| NotificationBell | – | ✓ |

## 7. Build Phases (Storefront)
1. **Monorepo + shared `packages/ui` + `packages/api`** (bearer client, types). Storefront scaffold, routing, Header/Footer/NotificationBell shell, auth (login/register/OTP/oauth/forgot), JWT+refresh interceptor, guest `x-session-id` cart.
2. **Browse**: Home (featured/recommendations), Catalog (filters/price-range), Category/Brand pages, Search, Product Detail (gallery/variants/stock/reviews).
3. **Cart + Checkout + Pay**: cart merge, multi-step checkout (address, shipping calc, coupon), Paystack initialize/verify, confirmation + invoice.
4. **Account**: profile/avatar, addresses, orders (list/detail/invoice/cancel/reorder), returns + evidence upload, wishlist, my-reviews, notifications settings, onboarding, GDPR.
5. **Polish**: mobile nav, telemetry tracking, SEO meta, static pages, error/empty states.

## 8. Backend Gaps / Actions for Storefront
1. **CORS multi-origin** (must fix): backend `CLIENT_URL` allows only one origin. Extend to an allowlist including `novastore.com`, `admin.novastore.com`, and localhost dev origins, or derive from `req.headers.origin` with a safe allowlist. (Affects both apps.)
2. **"My Reviews" endpoint missing**: customer "My Reviews" page needs a `GET /api/v1/reviews/me` (reviews authored by current user). Currently only `GET /reviews/product/:productId` and `GET /reviews/reports/me` exist. Add the endpoint (or document a workaround) before building that page.
3. **Guest order claim**: confirm `POST /orders/claim-guest-orders` identifies the guest correctly (e.g., via `x-session-id` or email) so the Track/Claim flow works.
4. **Payment confirmation email** not sent after successful Paystack payment (known backend TODO) — affects post-purchase communication.
5. **Refresh-token storage**: backend issues JWT refresh; decide secure client storage (avoid plain `localStorage` if possible) — coordinated with admin plan's auth note.

## 9. Notes
- Public reads (`GET /products`, `/categories`, `/brands`, `/settings/public`, `/currencies`, `/shipping/zones`) need **no auth** — used directly by storefront.
- File uploads (avatar, return-evidence) use `multipart/form-data` to `POST /user/avatar` and `POST /orders/:id/return-evidence`.
- Telemetry (`track-search`, `track-view`) is fire-and-forget; safe to call on interactions.
- Storefront and admin share `packages/ui` and `packages/api` types to keep one design language across both subdomains.
