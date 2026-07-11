/**
 * audit-context.middleware.js
 *
 * Enriches the request with `req.actor` (id, full name, role, session id) so
 * the audit service can capture *who* performed an action without each
 * controller re-deriving identity. Runs after authentication middleware.
 */
module.exports = function auditContext(req, res, next) {
  const principal = req.admin || req.user;
  if (principal) {
    const first = principal.firstName || principal.first_name || '';
    const last = principal.lastName || principal.last_name || '';
    const fullName = `${first} ${last}`.trim() || principal.email || null;
    req.actor = {
      id: principal.id,
      fullName,
      role: principal.role || (principal.roles && principal.roles[0]) || null,
      sessionId: req.sessionID || (req.session && req.session.id) || null,
    };
  } else {
    req.actor = null;
  }
  next();
};
