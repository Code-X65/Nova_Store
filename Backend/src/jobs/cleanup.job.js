const { SessionModel } = require('../models/session.model');
const TokenModel = require('../models/token.model');
const supabase = require('../config/supabase');
const logger = require('../utils/logger');

/**
 * Daily garbage-collection job.
 *
 * Runs at 02:00 UTC via node-cron.
 *
 * Deletes:
 *  - Expired, still-active sessions          (sessions.expires_at < now AND revoked = false)
 *  - Expired, unused verification tokens     (verification_tokens)
 *  - Expired, unused password-reset tokens   (password_resets)
 *  - Inventory reservations still held after expiry that never produced an order
 */
async function runCleanup() {
  logger.info('[Cleanup] Starting daily maintenance job…');
  let total = 0;

  // 1. Expired sessions
  try {
    const { data: sessions, error: sesErr } = await supabase
      .from('sessions')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .eq('revoked', false);
    if (sesErr) throw sesErr;
    const count = Array.isArray(sessions) ? sessions.length : 0;
    total += count;
    logger.info(`[Cleanup] Deleted ${count} expired session(s).`);
  } catch (err) {
    logger.error('[Cleanup] Failed to delete expired sessions:', err.message || err);
  }

  // 2. Expired/unused verification tokens
  try {
    const { data: vt, error: vtErr } = await supabase
      .from('verification_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .eq('used', false);
    if (vtErr) throw vtErr;
    const count = Array.isArray(vt) ? vt.length : 0;
    total += count;
    logger.info(`[Cleanup] Deleted ${count} expired verification token(s).`);
  } catch (err) {
    logger.error('[Cleanup] Failed to delete expired verification tokens:', err.message || err);
  }

  // 3. Expired/unused password-reset tokens
  try {
    const { data: prt, error: prtErr } = await supabase
      .from('password_resets')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .eq('used', false);
    if (prtErr) throw prtErr;
    const count = Array.isArray(prt) ? prt.length : 0;
    total += count;
    logger.info(`[Cleanup] Deleted ${count} expired password-reset token(s).`);
  } catch (err) {
    logger.error('[Cleanup] Failed to delete expired password-reset tokens:', err.message || err);
  }

  // 4. Expired inventory reservations with no attached order
  try {
    const { data: res, error: resErr } = await supabase
      .from('inventory_reservations')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .is('order_id', null);
    if (resErr) throw resErr;
    const count = Array.isArray(res) ? res.length : 0;
    total += count;
    logger.info(`[Cleanup] Deleted ${count} expired inventory reservation(s).`);
  } catch (err) {
    logger.error('[Cleanup] Failed to delete expired inventory reservations:', err.message || err);
  }

  logger.info(`[Cleanup] Daily maintenance done — ${total} rows removed in total.`);
}

module.exports = runCleanup;
