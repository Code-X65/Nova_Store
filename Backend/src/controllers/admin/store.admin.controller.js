const storeService = require('../../services/store.service');
const AuditService = require('../../services/audit.service');
const { SINGLE_STORE_ID } = require('../../config/store');

exports.getStoreProfile = async (req, res, next) => {
  try {
    const storeId = SINGLE_STORE_ID;
    const profile = await storeService.getStoreProfile(storeId);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

exports.updateStoreProfile = async (req, res, next) => {
  try {
    const storeId = SINGLE_STORE_ID;
    const oldProfile = await storeService.getStoreProfile(storeId);
    const updates = req.body;
    const updatedProfile = await storeService.updateStoreProfile(storeId, updates);

    const oldValues = {
      name: oldProfile.name,
      email: oldProfile.email,
      phone: oldProfile.phone,
      is_active: oldProfile.is_active,
      is_maintenance_mode: oldProfile.is_maintenance_mode,
      currency: oldProfile.currency,
      country: oldProfile.country,
    };

    const newValues = {
      name: updatedProfile.name,
      email: updatedProfile.email,
      phone: updatedProfile.phone,
      is_active: updatedProfile.is_active,
      is_maintenance_mode: updatedProfile.is_maintenance_mode,
      currency: updatedProfile.currency,
      country: updatedProfile.country,
    };

    AuditService.log(req, 'store.updated', 'store', storeId, oldValues, newValues);
    res.status(200).json({ success: true, data: updatedProfile });
  } catch (error) {
    next(error);
  }
};

exports.updateStoreSettings = async (req, res, next) => {
  try {
    const storeId = SINGLE_STORE_ID;
    const { settings } = req.body; // Expecting { settings: [{key: 'x', value: 'y'}] }

    if (!Array.isArray(settings)) {
      return res.status(400).json({ success: false, message: 'Settings must be an array of key/value objects.' });
    }

    const oldSettings = await storeService.getStoreProfile(storeId);
    const updatedSettings = await storeService.updateStoreSettings(storeId, settings);

    const changedKeys = settings.map(s => s.key);
    const oldValues = {};
    const newValues = {};
    for (const key of changedKeys) {
      oldValues[key] = oldSettings.settings[key] !== undefined ? oldSettings.settings[key] : null;
      newValues[key] = updatedSettings[key] !== undefined ? updatedSettings[key] : null;
    }

    AuditService.log(req, 'store.settings.updated', 'store', storeId, oldValues, newValues);
    res.status(200).json({ success: true, data: updatedSettings });
  } catch (error) {
    next(error);
  }
};
