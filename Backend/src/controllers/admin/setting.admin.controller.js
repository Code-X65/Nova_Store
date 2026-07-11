const SettingService = require('../../services/setting.service');
const SettingModel = require('../../models/setting.model');
const EmailService = require('../../services/email.service');

exports.getAllSettings = async (req, res, next) => {
  try {
    const { group } = req.query;
    const settings = await SettingModel.getAll(group);
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

exports.getSettingByKey = async (req, res, next) => {
  try {
    const setting = await SettingModel.getByKey(req.params.key);
    if (!setting) {
      return res.status(404).json({ success: false, message: 'Setting not found' });
    }
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

exports.updateSetting = async (req, res, next) => {
  try {
    const { value, changeReason } = req.body;
    const updated = await SettingService.updateSetting(req.params.key, value, req.user.id, changeReason);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.bulkUpdate = async (req, res, next) => {
  try {
    const updates = req.body;
    const updatesMap = {};
    if (updates && Array.isArray(updates.settings)) {
      updates.settings.forEach(s => {
        updatesMap[s.key] = s.value;
      });
    } else {
      Object.assign(updatesMap, updates);
    }
    const updated = await SettingService.bulkUpdate(updatesMap, req.user.id, 'Bulk update via API');
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.getSettingHistory = async (req, res, next) => {
  try {
    const history = await SettingModel.getHistory(req.params.key);
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
};

exports.testEmail = async (req, res, next) => {
  try {
    const { recipient } = req.body;
    await EmailService.sendRaw({
      to: recipient,
      subject: 'Test Email Configuration',
      text: 'If you receive this email, your email configuration is working correctly.'
    });
    
    res.status(200).json({ success: true, message: 'Test email sent successfully' });
  } catch (error) {
    console.error('Test email failed:', error);
    res.status(500).json({ success: false, error: 'Failed to send test email' });
  }
};
