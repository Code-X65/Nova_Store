const express = require('express');
const router = express.Router();
const riderController = require('../../controllers/admin/rider.controller');
const requireAdmin = require('../../middlewares/require-admin.middleware');
const { hasPermission, hasAnyPermission } = require('../../middlewares/permission.middleware');
const validate = require('../../middlewares/validate.middleware');
const riderValidator = require('../../validators/rider.validator');

/**
 * @swagger
 * tags:
 *   name: Riders
 *   description: Rider enrollment and assignment management
 */

router.use(requireAdmin);

/**
 * @swagger
 * /admin/riders:
 *   get:
 *     summary: List all enrolled riders
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated rider list
 */
router.get('/', hasAnyPermission('rider:read', '*'), riderController.listRiders);

/**
 * @swagger
 * /admin/riders/active:
 *   get:
 *     summary: Get all active riders (for assignment dropdowns)
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active rider list
 */
router.get('/active', hasAnyPermission('rider:read', 'rider:assign', '*'), riderController.getActiveRiders);

/**
 * @swagger
 * /admin/riders/pending:
 *   get:
 *     summary: Get all riders pending approval
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Pending riders list
 */
router.get('/pending', hasAnyPermission('rider:approve', '*'), riderController.getPendingRiders);

/**
 * @swagger
 * /admin/riders:
 *   post:
 *     summary: Enroll a new rider
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [first_name, last_name, phone, photo_frontal, photo_left_profile, photo_right_profile]
 *             properties:
 *               first_name: { type: string }
 *               last_name: { type: string }
 *               phone: { type: string }
 *               email: { type: string }
 *               address_jsonb: { type: object }
 *               id_type: { type: string, enum: [none, national_id, drivers_license, passport, other] }
 *               id_number: { type: string }
 *               vehicle_type: { type: string, enum: [none, motorcycle, bicycle, car, van, other] }
 *               vehicle_registration: { type: string }
 *               is_active: { type: boolean }
 *               photo_frontal: { type: string }
 *               photo_left_profile: { type: string }
 *               photo_right_profile: { type: string }
 *               phone_secondary: { type: string }
 *               id_doc_url: { type: string }
 *               vehicle_doc_url: { type: string }
 *               country: { type: string }
 *               state: { type: string }
 *               city: { type: string }
 *               street_address: { type: string }
 *     responses:
 *       201:
 *         description: Rider enrolled
 */
router.post('/', hasPermission('rider:write'), validate(riderValidator.createRider), riderController.createRider);

/**
 * @swagger
 * /admin/riders/{id}:
 *   get:
 *     summary: Get rider details
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rider details
 *       404:
 *         description: Rider not found
 */
router.get('/:id', hasAnyPermission('rider:read', '*'), riderController.getRider);

router.patch('/:id', hasPermission('rider:write'), validate(riderValidator.updateRider), riderController.updateRider);

router.delete('/:id', hasPermission('rider:write'), riderController.deleteRider);

/**
 * @swagger
 * /admin/riders/{id}/approve:
 *   post:
 *     summary: Approve a pending rider
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rider approved
 */
router.post('/:id/approve', hasPermission('rider:approve'), validate(riderValidator.approveRider), riderController.approveRider);

/**
 * @swagger
 * /admin/riders/{id}/reject:
 *   post:
 *     summary: Reject a pending rider
 *     tags: [Riders]
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
 *             properties:
 *               rejection_reason: { type: string }
 *     responses:
 *       200:
 *         description: Rider rejected
 */
router.post('/:id/reject', hasPermission('rider:approve'), validate(riderValidator.rejectRider), riderController.rejectRider);

/**
 * @swagger
 * /admin/riders/{id}/suspend:
 *   post:
 *     summary: Suspend a rider
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rider suspended
 */
router.post('/:id/suspend', hasPermission('rider:suspend'), riderController.suspendRider);

/**
 * @swagger
 * /admin/riders/{id}/reactivate:
 *   post:
 *     summary: Reactivate a suspended rider
 *     tags: [Riders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Rider reactivated
 */
router.post('/:id/reactivate', hasPermission('rider:suspend'), riderController.reactivateRider);

router.get('/:riderId/guarantors', hasAnyPermission('rider:read', '*'), riderController.listGuarantors);
router.post('/:riderId/guarantors', hasPermission('rider:write'), validate(riderValidator.createGuarantor), riderController.createGuarantor);
router.patch('/:riderId/guarantors/:guarantorId', hasPermission('rider:write'), validate(riderValidator.updateGuarantor), riderController.updateGuarantor);
router.delete('/:riderId/guarantors/:guarantorId', hasPermission('rider:write'), riderController.deleteGuarantor);

module.exports = router;
