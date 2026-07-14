const { supabaseAdmin } = require('../config/supabase');
const AuditService = require('../services/audit.service');

/**
 * ip-allowlist middleware
 *
 * Enforces admin_ip_allowlist rules for sensitive roles.
 * Bypass behavior:
 *   - If no allowlist entries exist for the request's role, allow through
 *     (fail-open for backward compat during rollout).
 *   - STORE_OWNER / SUPER_ADMIN / MANAGER are always subject to the allowlist
 *     when entries exist for their role scope (per the seeded defaults).
 *   - Denied attempts are audited (security.ip_denied) for non-repudiation.
 *
 * The middleware checks req.admin.roles (set by requireAdmin) and req.ip.
 * Active entries are cached for a short TTL to avoid a DB round-trip on every
 * admin request.
 */

const CACHE_TTL_MS = 30 * 1000;
let cache = { at: 0, entries: [] };

/**
 * Normalize an incoming IP for CIDR matching:
 *   - '::1' (IPv6 loopback) -> '127.0.0.1'
 *   - '::ffff:w.x.y.z' (IPv4-mapped IPv6) -> 'w.x.y.z'
 */
function normalizeIp(ip) {
  if (!ip) return ip;
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) {
    const v4 = ip.slice(7);
    if (v4.includes('.')) return v4;
  }
  return ip;
}

function isIpInCidr(ip, cidr) {
  if (!ip || !cidr) return false;
  if (cidr.includes('/')) {
    try {
      const [rangeStr, bitsStr] = cidr.split('/');
      const bits = Number(bitsStr);
      if (Number.isNaN(bits)) return false;
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      const ipNum = ip.split('.').map(Number).reduce((acc, o) => (acc << 8) + o, 0) >>> 0;
      const rangeNum = rangeStr.split('.').map(Number).reduce((acc, o) => (acc << 8) + o, 0) >>> 0;
      return (ipNum & mask) === (rangeNum & mask);
    } catch {
      return false;
    }
  }
  return ip === cidr;
}

async function loadActiveAllowlist() {
  const now = Date.now();
  if (now - cache.at < CACHE_TTL_MS) return cache.entries;
  try {
    const { data, error } = await supabaseAdmin
      .from('admin_ip_allowlist')
      .select('*')
      .eq('is_active', true);
    if (!error && data) {
      cache = { at: now, entries: data };
      return data;
    }
  } catch {
    /* fall through to cached/empty */
  }
  return cache.entries;
}

const ipAllowlist = async (req, res, next) => {
  try {
    const actor = req.admin;
    if (!actor) return next();

    const entries = await loadActiveAllowlist();
    if (entries.length === 0) return next();

    const clientIp = normalizeIp(req.ip || req.connection?.remoteAddress || '');

    const matchingEntries = entries.filter(entry => {
      const scope = entry.role_scope || [];
      const hasRole = actor.roles.some(r => scope.includes(r));
      if (!hasRole) return false;
      return isIpInCidr(clientIp, entry.ip_cidr);
    });

    if (matchingEntries.length > 0) {
      return next();
    }

    await AuditService.logRaw({
      action: 'security.ip_denied',
      userId: actor.id,
      ip: clientIp,
      severity: 'critical',
      actionType: 'OTHER',
      summary: `Admin access denied for IP ${clientIp} (roles: ${actor.roles.join(',')})`,
    });

    return res.status(403).json({
      success: false,
      error: 'Access denied: your IP address is not in the allowlist.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = ipAllowlist;
