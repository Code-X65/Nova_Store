const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const requireAdmin = require('../middlewares/require-admin.middleware');
const joi = require('joi');

const validateRateSchema = (req, res, next) => {
  const schema = joi.object({
    symbol: joi.string().optional(),
    rate_to_base: joi.number().positive().required(),
    is_active: joi.boolean().optional()
  });
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  next();
};

/**
 * @swagger
 * /currencies:
 *   get:
 *     summary: Get all active currencies and exchange rates
 *     tags: [Currencies]
 *     responses:
 *       200:
 *         description: List of currencies
 */
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('currencies')
      .select('*')
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /currencies/admin/{code}:
 *   put:
 *     summary: Update currency exchange rate (Admin only)
 *     tags: [Admin Currencies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rate_to_base: { type: number }
 *               symbol: { type: string }
 *               is_active: { type: boolean }
 *     responses:
 *       200:
 *         description: Currency updated
 */
router.put('/admin/:code', requireAdmin, validateRateSchema, async (req, res, next) => {
  try {
    const { code } = req.params;
    const { rate_to_base, symbol, is_active } = req.body;

    const updateData = {
      rate_to_base,
      updated_at: new Date().toISOString()
    };
    if (symbol !== undefined) updateData.symbol = symbol;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data, error } = await supabase
      .from('currencies')
      .update(updateData)
      .eq('code', code.toUpperCase())
      .select()
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ success: false, error: `Currency ${code} not found` });
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
