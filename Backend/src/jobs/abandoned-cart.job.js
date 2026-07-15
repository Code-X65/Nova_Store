const cartRecoveryService = require('../services/cart-recovery.service');
const logger = require('../utils/logger');

/**
 * Scans for carts abandoned longer than the configured threshold and sends
 * a one-time reminder email. Runs every 30 minutes via node-cron.
 */
async function runAbandonedCartCheck() {
  logger.info('[AbandonedCart] Checking for abandoned carts…');
  try {
    const { sent, scanned } = await cartRecoveryService.sendReminders();
    logger.info(`[AbandonedCart] Done — ${sent}/${scanned ?? 0} reminder(s) sent.`);
  } catch (err) {
    logger.error('[AbandonedCart] Job failed:', err.message || err);
  }
}

module.exports = runAbandonedCartCheck;
