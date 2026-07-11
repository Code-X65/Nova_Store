const storeService = require('../../services/store.service');
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
    const updates = req.body;
    const updatedProfile = await storeService.updateStoreProfile(storeId, updates);
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

    const updatedSettings = await storeService.updateStoreSettings(storeId, settings);
    res.status(200).json({ success: true, data: updatedSettings });
  } catch (error) {
    next(error);
  }
};
