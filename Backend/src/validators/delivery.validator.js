const Joi = require('joi');

// ── Dispatch ──────────────────────────────────────────────────────────────────

const dispatchOrder = {
  body: Joi.object({
    driverName:    Joi.string().min(2).max(100).required().messages({
      'any.required': 'Driver name is required',
      'string.min':   'Driver name must be at least 2 characters'
    }),
    driverPhone:   Joi.string().max(20).optional().allow(null, ''),
    dispatchNotes: Joi.string().max(500).optional().allow(null, ''),
    deliveryWindow: Joi.string().valid('morning', 'afternoon', 'evening', 'custom').optional().allow(null, '')
  })
};

// ── Delivery milestone note (shared for simple milestone endpoints) ────────────

const deliveryMilestoneNote = {
  body: Joi.object({
    note: Joi.string().max(500).optional().allow(null, '')
  })
};

// ── Mark delivered (requires proof of delivery) ───────────────────────────────

const markDelivered = {
  body: Joi.object({
    podType:  Joi.string().valid('otp', 'signature', 'photo_reference', 'driver_confirmation').optional().allow(null),
    podValue: Joi.string().max(200).optional().allow(null, ''),
    note:     Joi.string().max(500).optional().allow(null, '')
  })
};

// ── Return request ────────────────────────────────────────────────────────────

const requestReturn = {
  body: Joi.object({
    reason:         Joi.string().min(5).max(1000).required().messages({
      'any.required': 'Return reason is required',
      'string.min':   'Please provide at least 5 characters describing the reason'
    }),
    evidenceUrls:   Joi.array().items(Joi.string().uri()).optional().default([]).messages({
      'string.uri': 'Each evidence URL must be a valid URL'
    }),
    evidenceNotes:  Joi.string().max(1000).optional().allow(null, '')
  })
};

// ── Admin return processing ───────────────────────────────────────────────────

const processReturn = {
  body: Joi.object({
    action: Joi.string()
      .valid('review', 'approve', 'reject', 'schedule_pickup', 'mark_collected', 'complete_qc', 'process_refund', 'complete')
      .required()
      .messages({
        'any.required': 'Action is required',
        'any.only':     'Invalid action. Must be one of: review, approve, reject, schedule_pickup, mark_collected, complete_qc, process_refund, complete'
      }),
    note:        Joi.string().max(1000).optional().allow(null, ''),
    refundAmount: Joi.number().positive().optional().allow(null),
    qcOutcome:   Joi.when('action', {
      is:        'complete_qc',
      then:      Joi.string().valid('sellable', 'damaged', 'quarantine', 'discard').required().messages({
        'any.required': 'qcOutcome is required when action is complete_qc',
        'any.only':     'qcOutcome must be one of: sellable, damaged, quarantine, discard'
      }),
      otherwise: Joi.string().valid('sellable', 'damaged', 'quarantine', 'discard').optional().allow(null)
    }),
    qcNotes: Joi.string().max(1000).optional().allow(null, '')
  })
};

module.exports = {
  dispatchOrder,
  deliveryMilestoneNote,
  markDelivered,
  requestReturn,
  processReturn
};
