const CartRecoveryService = require('../../services/cart-recovery.service');
const AuditService = require('../../services/audit.service');

exports.getAbandonedCarts = async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await CartRecoveryService.getAbandonedCartsAdmin({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await CartRecoveryService.getSettings();
    res.status(200).json({ success: true, data: { settings } });
  } catch (error) {
    next(error);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    const settings = await CartRecoveryService.updateSettings(req.body);
    AuditService.log(req, 'cart_recovery.settings_updated', 'settings', null, null, req.body);
    res.status(200).json({ success: true, data: { settings } });
  } catch (error) {
    next(error);
  }
};

exports.triggerNow = async (req, res, next) => {
  try {
    const result = await CartRecoveryService.sendReminders();
    AuditService.log(req, 'cart_recovery.manual_trigger', 'settings', null, null, result);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
