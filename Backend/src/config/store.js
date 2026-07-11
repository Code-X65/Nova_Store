/**
 * Single-Store Configuration
 * The system is locked to a single store context.
 */

// If you have a fixed UUID in production, you can set it in .env
// Otherwise, the system will fall back to querying the store by this slug.
const SINGLE_STORE_ID = process.env.SINGLE_STORE_ID || '11111111-1111-1111-1111-111111111111';
const SINGLE_STORE_SLUG = 'nova-store';

module.exports = {
  SINGLE_STORE_ID,
  SINGLE_STORE_SLUG
};
