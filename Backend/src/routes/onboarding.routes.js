const express = require('express');
const onboardingController = require('../controllers/onboarding.controller');
const { protect } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const Joi = require('joi');

const router = express.Router();

router.use(protect);

/**
 * @swagger
 * tags:
 *   name: Onboarding
 *   description: User onboarding questionnaire
 */

const answerSchema = {
  body: Joi.object({
    questionKey: Joi.string().required(),
    answer: Joi.any().required()
  })
};

/**
 * @swagger
 * /onboarding/status:
 *   get:
 *     summary: Check if the logged-in user needs to complete onboarding
 *     tags: [Onboarding]
 *     responses:
 *       200:
 *         description: Onboarding status retrieved
 */
router.get('/status', onboardingController.getStatus);

/**
 * @swagger
 * /onboarding/questions:
 *   get:
 *     summary: Fetch all onboarding questions
 *     tags: [Onboarding]
 *     parameters:
 *       - in: query
 *         name: step
 *         schema: { type: integer }
 *       - in: query
 *         name: include_dependencies
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: List of questions
 */
router.get('/questions', onboardingController.getQuestions);

/**
 * @swagger
 * /onboarding/start:
 *   post:
 *     summary: Mark onboarding as started
 *     tags: [Onboarding]
 *     responses:
 *       200:
 *         description: Onboarding started
 *       409:
 *         description: Already completed or skipped
 */
router.post('/start', onboardingController.start);

/**
 * @swagger
 * /onboarding/answer:
 *   post:
 *     summary: Save or update a user's answer
 *     tags: [Onboarding]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [questionKey, answer]
 *             properties:
 *               questionKey: { type: string }
 *               answer: { type: object }
 *     responses:
 *       200:
 *         description: Answer saved
 */
router.post('/answer', validate(answerSchema), onboardingController.submitAnswer);

/**
 * @swagger
 * /onboarding/complete:
 *   post:
 *     summary: Mark onboarding as completed
 *     tags: [Onboarding]
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
 */
router.post('/complete', onboardingController.complete);

/**
 * @swagger
 * /onboarding/skip:
 *   post:
 *     summary: Allow user to skip onboarding entirely
 *     tags: [Onboarding]
 *     responses:
 *       200:
 *         description: Onboarding skipped
 */
router.post('/skip', onboardingController.skip);

/**
 * @swagger
 * /onboarding/summary:
 *   get:
 *     summary: Get a summary of user's onboarding progress
 *     tags: [Onboarding]
 *     responses:
 *       200:
 *         description: Summary retrieved
 */
router.get('/summary', onboardingController.getSummary);

module.exports = router;
