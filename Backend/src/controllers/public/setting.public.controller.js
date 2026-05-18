const SettingService = require('../../services/setting.service');

exports.getPublicSettings = async (req, res, next) => {
  try {
    const structuredSettings = await SettingService.getPublicSettingsStructured();
    res.status(200).json({ success: true, data: structuredSettings });
  } catch (error) {
    next(error);
  }
};
