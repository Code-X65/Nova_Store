const express = require('express');
const router = express.Router();
const adminQAController = require('../../controllers/admin/qa.admin.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission } = require('../../middlewares/permission.middleware');
const joi = require('joi');

const validateRequest = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({ success: false, error: error.details[0].message });
  }
  next();
};

const answerSchema = joi.object({
  answer: joi.string().min(1).max(2000).required()
});

const moderateSchema = joi.object({
  status: joi.string().valid('pending', 'approved', 'hidden').required()
});

router.use(requireAdmin);

/**
 * @swagger
 * tags:
 *   name: Admin Product Q&A
 *   description: Admin moderation of product questions
 */

/**
 * @swagger
 * /admin/qa:
 *   get:
 *     summary: List all product questions for moderation
 *     tags: [Admin Product Q&A]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, approved, hidden] }
 *     responses:
 *       200:
 *         description: List of questions
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/', hasPermission('qa:read'), adminQAController.getAllQuestions);

/**
 * @swagger
 * /admin/qa/{id}/answer:
 *   patch:
 *     summary: Answer a product question
 *     tags: [Admin Product Q&A]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answer]
 *             properties:
 *               answer: { type: string, minLength: 1, maxLength: 2000 }
 *     responses:
 *       200:
 *         description: Question answered
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch('/:id/answer', hasPermission('qa:write'), validateRequest(answerSchema), adminQAController.answerQuestion);

/**
 * @swagger
 * /admin/qa/{id}:
 *   patch:
 *     summary: Moderate (change status of) a product question
 *     tags: [Admin Product Q&A]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [pending, approved, hidden] }
 *     responses:
 *       200:
 *         description: Question moderated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.patch('/:id', hasPermission('qa:write'), validateRequest(moderateSchema), adminQAController.moderateQuestion);

/**
 * @swagger
 * /admin/qa/{id}:
 *   delete:
 *     summary: Delete a product question
 *     tags: [Admin Product Q&A]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Question deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
router.delete('/:id', hasPermission('qa:write'), adminQAController.deleteQuestion);

module.exports = router;
