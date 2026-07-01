const crypto = require('crypto');
const logger = require('../utils/logger');
const userModel = require('../models/user.model');

let cachedUser = null;
let cachedPass = null;

function getCredentials() {
  const envUser = process.env.SWAGGER_USER || 'admin';
  const envPass = process.env.SWAGGER_PASSWORD;

  if (envPass) {
    return { username: envUser, password: envPass };
  }

  if (!cachedPass) {
    cachedUser = envUser;
    if (process.env.NODE_ENV === 'production') {
      cachedPass = crypto.randomBytes(16).toString('hex');
      logger.warn(`[SECURITY WARNING] SWAGGER_PASSWORD is not set in production. Generated a random password: ${cachedPass}`);
    } else {
      cachedPass = 'password';
    }
  }

  return { username: cachedUser, password: cachedPass };
}

function renderLoginForm(csrfToken, errorMsg = '', warningMsg = '', attempts = 1) {
  const now = new Date();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dateString = `${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`;

  let statusText = 'Awaiting input...';
  if (errorMsg) {
    statusText = `ERROR: ${errorMsg.toUpperCase()}`;
  } else if (warningMsg) {
    statusText = `WARNING: ${warningMsg.toUpperCase()}`;
  }

  const attemptsDisplay = Math.min(attempts, 3);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nova Store — System Access Terminal</title>
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Share Tech Mono', monospace;
      background-color: #030803;
      color: #33ff33;
      text-shadow: 0 0 5px rgba(51, 255, 51, 0.75), 0 0 10px rgba(51, 255, 51, 0.35);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      overflow: hidden;
      position: relative;
    }

    /* CRT Scanlines and mask */
    body::before {
      content: " ";
      display: block;
      position: fixed;
      top: 0; left: 0; bottom: 0; right: 0;
      background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06));
      z-index: 100;
      background-size: 100% 4px, 6px 100%;
      pointer-events: none;
    }

    body::after {
      content: " ";
      display: block;
      position: fixed;
      top: 0; left: 0; bottom: 0; right: 0;
      background: radial-gradient(circle, rgba(0, 0, 0, 0) 60%, rgba(0, 15, 0, 0.35) 100%);
      z-index: 101;
      pointer-events: none;
    }

    /* CRT rolling line animation */
    .scan-effect {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      background: linear-gradient(to bottom, rgba(51, 255, 51, 0) 0%, rgba(51, 255, 51, 0.04) 10%, rgba(51, 255, 51, 0) 11%);
      animation: scanline 8s linear infinite;
      z-index: 99;
      pointer-events: none;
    }

    @keyframes scanline {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
    }

    /* Subtle screen flicker */
    @keyframes flicker {
      0% { opacity: 0.985; }
      50% { opacity: 1; }
      100% { opacity: 0.99; }
    }

    .terminal-wrapper {
      animation: flicker 0.15s infinite;
      width: 100%;
      max-width: 600px;
      padding: 24px;
      z-index: 10;
    }

    .terminal-header {
      text-align: center;
      margin-bottom: 24px;
      line-height: 1.4;
    }

    .title-line {
      font-size: 22px;
      letter-spacing: 2px;
      font-weight: bold;
    }

    .subtitle-line {
      font-size: 16px;
      letter-spacing: 1px;
    }

    .warning-line {
      font-size: 14px;
      margin-top: 8px;
    }

    .logon-line {
      font-size: 16px;
      font-weight: bold;
    }

    .dashed-divider {
      letter-spacing: -2px;
      opacity: 0.8;
      user-select: none;
      margin: 4px 0;
    }

    .terminal-card {
      border: 2px solid #33ff33;
      box-shadow: 0 0 15px rgba(51, 255, 51, 0.35);
      background-color: rgba(0, 10, 0, 0.65);
      padding: 36px 32px;
      border-radius: 4px;
    }

    .form-group {
      display: flex;
      align-items: center;
      margin-bottom: 24px;
      font-size: 18px;
    }

    .field-label {
      width: 110px;
      white-space: nowrap;
    }

    .field-bracket {
      margin-left: 8px;
    }

    .form-group input {
      flex: 1;
      background: transparent;
      border: none;
      border-bottom: 2px dashed #33ff33;
      color: #33ff33;
      font-family: 'Share Tech Mono', monospace;
      font-size: 18px;
      outline: none;
      padding: 2px 8px;
      letter-spacing: 2px;
      text-shadow: 0 0 5px rgba(51, 255, 51, 0.75);
      caret-color: #33ff33;
    }

    .form-group input:focus {
      border-bottom: 2px solid #33ff33;
    }

    .button-row {
      display: flex;
      justify-content: space-around;
      margin-top: 30px;
    }

    .btn-terminal {
      background: transparent;
      border: none;
      color: #33ff33;
      font-family: 'Share Tech Mono', monospace;
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      padding: 4px 16px;
      text-shadow: 0 0 5px rgba(51, 255, 51, 0.75);
      transition: all 0.2s ease;
    }

    .btn-terminal:hover {
      background-color: #33ff33;
      color: #030803;
      text-shadow: none;
      box-shadow: 0 0 10px #33ff33;
    }

    .terminal-footer {
      margin-top: 24px;
    }

    .terminal-footer-line {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
    }

    .status-line {
      font-size: 14px;
      margin-top: 4px;
    }
    .error-msg, .warning-msg {
      margin-bottom: 24px;
      text-align: center;
      font-weight: bold;
      padding: 10px;
      border: 1px dashed #33ff33;
      background-color: rgba(10, 0, 0, 0.4);
      font-size: 14px;
    }
    .form-group input:disabled, .btn-terminal:disabled {
      color: rgba(51, 255, 51, 0.4);
      text-shadow: 0 0 3px rgba(51, 255, 51, 0.2);
      border-color: rgba(51, 255, 51, 0.4);
    }
  </style>
</head>
<body>
  <div class="scan-effect"></div>
  <div class="terminal-wrapper">
    <div class="terminal-header">
      <div class="title-line">OLD COMPUTER INTERFACE LOGIN</div>
      <div class="dashed-divider">--------------------------------------------------------</div>
      <div class="subtitle-line">&gt;&gt;&gt; SYSTEM ACCESS TERMINAL v1.0 &lt;&lt;&lt;</div>
      <div class="dashed-divider">--------------------------------------------------------</div>
      <div class="warning-line">Unauthorized Access Strictly Prohibited</div>
      <div class="logon-line">LOGON REQUIRED</div>
    </div>

    <form action="/api-docs/login" method="POST" id="loginForm">
      <input type="hidden" name="_csrf" value="${csrfToken}">
      
      <div class="terminal-card">
        ${errorMsg ? `<div class="error-msg">*** ERROR: ${errorMsg} ***</div>` : ''}
        ${warningMsg ? `<div class="warning-msg">*** WARNING: ${warningMsg} ***</div>` : ''}

        <div class="form-group">
          <span class="field-label">USER_ID: [</span>
          <input type="text" id="username" name="username" required autocomplete="username" autofocus>
          <span class="field-bracket">]</span>
        </div>
        
        <div class="form-group">
          <span class="field-label">PASSKEY: [</span>
          <input type="password" id="password" name="password" required autocomplete="current-password">
          <span class="field-bracket">]</span>
        </div>
        
        <div class="button-row">
          <button type="submit" class="btn-terminal">&lt; [SUBMIT] &gt;</button>
          <button type="button" class="btn-terminal" onclick="document.getElementById('loginForm').reset()">&lt; [CLEAR] &gt;</button>
        </div>
      </div>
    </form>

    <div class="terminal-footer">
      <div class="dashed-divider">--------------------------------------------------------</div>
      <div class="terminal-footer-line">
        <span>Attempt: ${attemptsDisplay}/3</span>
        <span>Date: ${dateString}</span>
      </div>
      <div class="status-line">Status: ${statusText}</div>
      <div class="dashed-divider">--------------------------------------------------------</div>
    </div>
  </div>

  <script>
    document.getElementById('loginForm').addEventListener('submit', function() {
      const submitBtn = document.querySelector('.btn-terminal[type="submit"]');
      const clearBtn = document.querySelector('.btn-terminal[type="button"]');
      const usernameInput = document.getElementById('username');
      const passwordInput = document.getElementById('password');
      const statusLine = document.querySelector('.status-line');

      // Disable inputs and buttons
      submitBtn.disabled = true;
      clearBtn.disabled = true;
      usernameInput.disabled = true;
      passwordInput.disabled = true;

      // Update button text and style
      submitBtn.innerText = '< [PROCESSING...] >';
      submitBtn.style.opacity = '0.7';
      submitBtn.style.cursor = 'not-allowed';

      // Start loading animation in status line
      const chars = ['/', '-', '\\\\', '|'];
      let idx = 0;
      statusLine.innerHTML = 'Status: CONNECTING TO SECURE DATABASE... ' + chars[0];

      setInterval(function() {
        idx = (idx + 1) % chars.length;
        statusLine.innerHTML = 'Status: CONNECTING TO SECURE DATABASE... ' + chars[idx];
      }, 200);
    });
  </script>
</body>
</html>
  `;
}

/**
 * Session-based UI Authentication middleware for Swagger API Docs
 */
async function swaggerAuth(req, res, next) {
  const cleanPath = req.path.replace(/\/$/, '');

  // 1. Initialize CSRF token in session if not present (mirroring csrf.middleware.js)
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  const csrfToken = req.session ? req.session.csrfToken : '';

  // 2. Handle Login endpoints
  if (cleanPath === '/login') {
    if (req.method === 'GET') {
      let warningMsg = '';
      if (req.query.reason === 'inactive') {
        warningMsg = 'Session expired due to inactivity.';
      } else if (req.query.reason === 'expired') {
        warningMsg = 'Maximum session duration reached.';
      } else if (req.query.reason === 'csrf') {
        warningMsg = 'Invalid security token (CSRF).';
      }
      const attempts = req.session ? (req.session.swaggerAttempts || 0) + 1 : 1;
      return res.send(renderLoginForm(csrfToken, '', warningMsg, attempts));
    }

    if (req.method === 'POST') {
      // CSRF validation
      if (req.session) {
        const clientToken = req.body._csrf;
        const sessionToken = req.session.csrfToken;
        if (!clientToken || clientToken !== sessionToken) {
          const attempts = req.session ? (req.session.swaggerAttempts || 0) + 1 : 1;
          return res.status(403).send(renderLoginForm(csrfToken, 'Invalid CSRF token', '', attempts));
        }
      }

      const { username, password } = req.body;
      let isAuthorized = false;
      let user = null;

      try {
        // A. Database Admin check — race against a 3-second timeout so an
        //    unreachable DB doesn't block the env-credential fallback (B).
        const DB_TIMEOUT_MS = 3000;
        const dbTimeout = new Promise((_, reject) => {
          const t = setTimeout(() => reject(new Error('DB_TIMEOUT')), DB_TIMEOUT_MS);
          t.unref(); // don't keep the event loop alive (avoids Jest force-exit warning)
        });

        try {
          user = await Promise.race([userModel.findByEmail(username), dbTimeout]);
        } catch (dbErr) {
          if (dbErr.message === 'DB_TIMEOUT') {
            logger.warn('Swagger login: database lookup timed out, falling back to env credentials');
            user = null; // skip DB path, fall through to env check below
          } else {
            throw dbErr; // real DB error — re-throw so outer catch handles it
          }
        }
        if (user && user.password_hash) {
          // Verify lockout status
          if (user.is_locked) {
            const now = new Date();
            if (user.lock_until && new Date(user.lock_until) > now) {
              return res.status(403).send(renderLoginForm(csrfToken, 'This account is temporarily locked', '', 3));
            } else {
              // Unlock account if lock period has expired
              await userModel.resetFailedAttempts(user);
              user = await userModel.findById(user.id); // re-fetch fresh state
            }
          }

          const isMatch = await userModel.comparePassword(password, user.password_hash);
          isAuthorized = isMatch && user.is_active && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN');
        }

        // B. Fallback to Env file credentials
        if (!isAuthorized) {
          const expected = getCredentials();
          if (username === expected.username && password === expected.password) {
            isAuthorized = true;
          }
        }

        if (isAuthorized) {
          if (user) {
            await userModel.resetFailedAttempts(user, req.ip);
          }
          if (req.session) {
            delete req.session.swaggerAttempts;
          }
          req.session.swaggerAuth = true;
          req.session.swaggerAuthLoginTime = Date.now();
          req.session.swaggerAuthLastActivity = Date.now();
          return res.redirect('/api-docs/');
        } else {
          let attempts = 1;
          if (req.session) {
            req.session.swaggerAttempts = (req.session.swaggerAttempts || 0) + 1;
            attempts = req.session.swaggerAttempts + 1;
          }

          // If a database admin failed to log in, increment failed attempts
          if (user && (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN')) {
            await userModel.incrementAdminFailedAttempts(user);
            const updatedUser = await userModel.findById(user.id);
            if (updatedUser && updatedUser.is_locked) {
              if (req.session) {
                req.session.swaggerAttempts = 3;
              }
              return res.status(401).send(renderLoginForm(csrfToken, 'Too many failed login attempts. This account has been locked for 60 minutes.', '', 3));
            }
          }
          return res.status(401).send(renderLoginForm(csrfToken, 'Invalid username or password', '', attempts));
        }
      } catch (err) {
        logger.error('Error during Swagger login verification', err);
        const attempts = req.session ? (req.session.swaggerAttempts || 0) + 1 : 1;
        return res.status(500).send(renderLoginForm(csrfToken, 'Authentication error occurred.', '', attempts));
      }
    }
  }

  // 3. For all other routes, enforce session check and timeouts
  if (req.session && req.session.swaggerAuth === true) {
    const now = Date.now();
    const idleTimeout = parseInt(process.env.SWAGGER_IDLE_TIMEOUT) || 15 * 60 * 1000; // 15 mins
    const hardTimeout = parseInt(process.env.SWAGGER_HARD_TIMEOUT) || 2 * 60 * 60 * 1000; // 2 hours

    if (now - req.session.swaggerAuthLoginTime > hardTimeout) {
      delete req.session.swaggerAuth;
      delete req.session.swaggerAuthLoginTime;
      delete req.session.swaggerAuthLastActivity;
      return res.redirect('/api-docs/login?reason=expired');
    }

    if (now - req.session.swaggerAuthLastActivity > idleTimeout) {
      delete req.session.swaggerAuth;
      delete req.session.swaggerAuthLoginTime;
      delete req.session.swaggerAuthLastActivity;
      return res.redirect('/api-docs/login?reason=inactive');
    }

    // Touch activity timestamp
    req.session.swaggerAuthLastActivity = now;
    return next();
  }

  // Redirect to login if unauthenticated
  return res.redirect('/api-docs/login');
}

swaggerAuth._resetCache = () => {
  cachedUser = null;
  cachedPass = null;
};

module.exports = swaggerAuth;
