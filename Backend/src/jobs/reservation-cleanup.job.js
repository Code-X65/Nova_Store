const supabase = require('../config/supabase');
const logger = require('../utils/logger');

async function runReservationCleanup() {
  logger.info('[Reservation Cleanup] Checking for expired stock reservations...');
  try {
    const { data, error } = await supabase.rpc('release_expired_reservations');
    if (error) throw error;
    
    const count = data || 0;
    if (count > 0) {
      logger.info(`[Reservation Cleanup] Successfully released and deleted ${count} expired inventory reservation(s).`);
    }
    return count;
  } catch (err) {
    logger.error('[Reservation Cleanup] Failed to release expired reservations:', err.message || err);
    return 0;
  }
}

module.exports = runReservationCleanup;
