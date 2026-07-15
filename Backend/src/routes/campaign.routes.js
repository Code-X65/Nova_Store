const express = require('express');
const router = express.Router();
const campaignController = require('../controllers/campaign.controller');

/**
 * @swagger
 * tags:
 *   name: Campaigns
 *   description: Public marketing campaign endpoints
 */

/**
 * @swagger
 * /campaigns/active:
 *   get:
 *     summary: List currently active campaigns
 *     tags: [Campaigns]
 *     responses:
 *       200:
 *         description: Active campaigns
 */
router.get('/active', campaignController.getActiveCampaigns);

module.exports = router;
