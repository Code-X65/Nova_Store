# Security Audit & Penetration Testing Manual

This document outlines the security architecture, threat mitigations, and penetration testing guidelines for the Nova Store backend.

---

## 1. Security Architecture & Threat Mitigations

The Nova Store backend implements multiple defense-in-depth mechanisms to protect the application from standard security vulnerabilities, specifically focusing on the OWASP Top 10.

### 1.1 Cross-Site Scripting (XSS) Mitigation
*   **Helmet & CSP Nonce**: Helmet middleware is configured globally. For inline scripts, a dynamic cryptographic nonce (`crypto.randomBytes(16).toString('base64')`) is generated on every request and injected into the CSP headers (`scriptSrc`). Only scripts containing the matching `nonce` attribute are executed by the browser.
*   **Input Sanitization**: Incoming request bodies, query parameters, and route parameters are parsed and sanitized using custom validation schemas (Joi) to reject invalid/malicious payloads.
*   **Cookie Security**: Session cookies (`connect.sid`) are marked with `HttpOnly` (preventing JavaScript extraction), `Secure` (enforcing HTTPS transmission), and `SameSite=Strict` (restricting cross-site transmission).

### 1.2 SQL Injection (SQLi) Mitigation
*   **Parameterized Queries via Supabase / PostgREST**: The application interacts with PostgreSQL via the Supabase client. The client maps JavaScript requests into parameterized SQL queries by default. Raw string concatenations inside queries are strictly prohibited.
*   **RPC and View Bounds**: Database RPCs (like `create_order_with_items`) parameterize input variables automatically, ensuring execution context bounds cannot be escaped.

### 1.3 Cross-Site Request Forgery (CSRF) Defenses
*   **Session-Bound CSRF Token Validation**: State-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated via session cookies are intercepted by the `csrf.middleware.js` validator.
*   **Verification Header**: The client must retrieve the active CSRF token via `GET /api/v1/auth/csrf-token` and include it in the `x-csrf-token` header of state-modifying requests.
*   **Exemption for Bearer JWTs**: Requests containing a valid Bearer JWT inside the `Authorization` header are exempted from CSRF verification because browsers do not automatically attach auth headers (unlike cookies), eliminating the CSRF threat vector.

### 1.4 Broken Object Level Authorization (BOLA/IDOR) Defenses
*   **Ownership Middleware**: Endpoints referencing user-specific resources (e.g. `/user/addresses/:id`) use the `authorizeResource` middleware. This middleware verifies that the resource (`addresses.user_id`) matches the authenticated user (`req.user.id`).
*   **Secure Identifiers**: Primary keys use UUIDv4 identifiers, preventing attacker enumeration/sequential guessing of resources.

### 1.5 Credentials & Token Rotation
*   **Zero-Downtime Secret Rotation**: Both Express Session and JWT authentication support comma-separated lists of secrets (`SESSION_SECRET` and `JWT_ACCESS_SECRET`). The application sequentially attempts validation against all active keys, allowing seamless key rotation without logging out active users.
*   **Dynamic Payment Keys**: Payment credentials (Paystack secret key) are resolved dynamically from database-backed `settings` configurations (with `.env` fallbacks) to allow instant gateway credential updates without restarting the application services.

---

## 2. Penetration Testing Manual

To verify the effectiveness of the security mitigations, perform the following penetration tests:

### 2.1 XSS & CSP Audit
1.  **Objective**: Verify that inline scripts without the CSP nonce are blocked.
2.  **Steps**:
    *   Inject an inline script tag into any page served by the backend: `<script>alert('XSS')</script>`.
    *   Verify in the browser console that the browser blocks execution with a CSP violation warning.
    *   Assert that the HTTP response header `Content-Security-Policy` contains the dynamic nonce matching `res.locals.nonce` for authorized inline scripts.
3.  **Command Validation**:
    ```bash
    curl -I http://localhost:5000/api/v1/health
    # Look for the Content-Security-Policy header and assert script-src contains 'nonce-...'
    ```

### 2.2 SQL Injection Test
1.  **Objective**: Attempt SQL injection in catalog filtering or search query parameters.
2.  **Steps**:
    *   Send a GET request to `/api/v1/products?search=test' OR '1'='1`.
    *   Assert that the response returns either empty results or matches literally `test' OR '1'='1`, and does not bypass the search logic to return the entire catalog.
3.  **Command Validation**:
    ```bash
    curl "http://localhost:5000/api/v1/products?search=test%27%20OR%20%271%27%3D%271"
    ```

### 2.3 CSRF Bypassing Audit
1.  **Objective**: Verify that cookie-authenticated state-modifying endpoints fail if the `x-csrf-token` header is missing or incorrect.
2.  **Steps**:
    *   Authenticate via session cookies.
    *   Send a `POST` request to `/api/v1/user/addresses` without the `x-csrf-token` header.
    *   Verify the response returns `403 Forbidden` with a message containing `CSRF token validation failed`.
    *   Perform the same request *with* the correct `x-csrf-token` and assert it succeeds.
3.  **Command Validation**:
    ```bash
    # Unsafe request missing CSRF header
    curl -X POST http://localhost:5000/api/v1/user/addresses \
         -H "Cookie: connect.sid=your_session_cookie_here" \
         -H "Content-Type: application/json" \
         -d '{"title": "Home", "receiver_name": "Test", "phone_number": "12345", "street_address": "Main St", "city": "Lagos", "state": "Lagos", "postal_code": "10001"}'
    ```

### 2.4 BOLA / IDOR Verification
1.  **Objective**: Test if User A can read or modify User B's address.
2.  **Steps**:
    *   Create address `Addr_B_UUID` under User B's profile.
    *   Authenticate as User A.
    *   Send a GET or DELETE request to `/api/v1/user/addresses/Addr_B_UUID`.
    *   Verify the response returns `403 Forbidden` or `404 Not Found` (instead of `200 OK`).
3.  **Command Validation**:
    ```bash
    curl -H "Authorization: Bearer <User_A_Token>" http://localhost:5000/api/v1/user/addresses/<User_B_Address_UUID>
    ```

### 2.5 Dynamic Vulnerability Scan
Execute security dependency scanning via NPM:
```bash
# Scan npm dependencies for known CVE vulnerabilities
npm audit

# Run dependency updates if critical/high vulnerabilities are found
npm audit fix
```
