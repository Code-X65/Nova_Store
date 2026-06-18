const express = require('express');
const fs = require('fs');
const path = require('path');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { supabaseAdmin } = require('../../config/supabase');

const router = express.Router();

// Enforce admin permission for all endpoints
router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Database
 *   description: Database and migrations administrative tooling
 */

/**
 * @swagger
 * /admin/migrations/status:
 *   get:
 *     summary: Get status of all database migrations (applied vs pending)
 *     tags: [Admin Database]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Migrations status retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/status', async (req, res, next) => {
  try {
    const sqlDir = path.join(__dirname, '../../../sql');
    let allMigrations = [];
    if (fs.existsSync(sqlDir)) {
      allMigrations = fs.readdirSync(sqlDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    }

    const { data, error } = await supabaseAdmin
      .from('schema_migrations')
      .select('migration_name, applied_at')
      .order('applied_at', { ascending: true });

    if (error) {
      // Handle the case where schema_migrations table doesn't exist yet
      if (error.code === 'P0001' || error.message.includes('relation "schema_migrations" does not exist')) {
        return res.status(200).json({
          success: true,
          data: {
            migrations: allMigrations.map(file => ({
              name: file,
              applied: false,
              appliedAt: null
            })),
            totalCount: allMigrations.length,
            appliedCount: 0,
            pendingCount: allMigrations.length
          }
        });
      }
      throw error;
    }

    const appliedSet = new Set((data || []).map(m => m.migration_name));
    const statusList = allMigrations.map(file => ({
      name: file,
      applied: appliedSet.has(file),
      appliedAt: data?.find(m => m.migration_name === file)?.applied_at || null
    }));

    res.status(200).json({
      success: true,
      data: {
        migrations: statusList,
        totalCount: allMigrations.length,
        appliedCount: appliedSet.size,
        pendingCount: allMigrations.length - appliedSet.size
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
