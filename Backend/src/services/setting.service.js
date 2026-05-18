const SettingModel = require('../models/setting.model');
const logger = require('../utils/logger');

// Optional caching
let settingsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 mins

class SettingService {
  async getAllGrouped() {
    const settings = await SettingModel.getAll();
    return settings;
  }

  async getPublicSettingsStructured() {
    const settings = await SettingModel.getPublicSettings();
    const structured = {};

    settings.forEach(setting => {
      const { key, value, value_type, group_name } = setting;
      
      // Parse value based on type
      let parsedValue = value;
      if (value_type === 'number') parsedValue = Number(value);
      else if (value_type === 'boolean') parsedValue = value === 'true';
      else if (value_type === 'json') {
        try { parsedValue = JSON.parse(value); } catch(e) { parsedValue = null; }
      }

      // Convert key 'currency.default' -> 'default' -> 'default' (camelCase if needed)
      const subKeyRaw = key.includes('.') ? key.split('.')[1] : key;
      // Simple camelCase conversion (e.g. default_rate -> defaultRate)
      const subKey = subKeyRaw.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

      if (!structured[group_name]) {
        structured[group_name] = {};
      }
      structured[group_name][subKey] = parsedValue;
    });

    return structured;
  }

  async updateSetting(key, value, userId, changeReason) {
    const setting = await SettingModel.getByKey(key);
    if (!setting) {
      const error = new Error('Setting not found');
      error.statusCode = 404;
      throw error;
    }

    // Validate type
    if (setting.value_type === 'number' && typeof value !== 'number') {
      const error = new Error(`Setting ${key} expects a number`);
      error.statusCode = 400;
      throw error;
    }
    if (setting.value_type === 'boolean' && typeof value !== 'boolean') {
      const error = new Error(`Setting ${key} expects a boolean`);
      error.statusCode = 400;
      throw error;
    }
    
    let stringValue = String(value);
    if (setting.value_type === 'json') {
      if (typeof value === 'object') {
        stringValue = JSON.stringify(value);
      } else {
        try {
          JSON.parse(value);
          stringValue = value;
        } catch(e) {
          const error = new Error(`Setting ${key} expects valid JSON`);
          error.statusCode = 400;
          throw error;
        }
      }
    }

    const updated = await SettingModel.update(key, stringValue, userId, changeReason);
    this.invalidateCache();
    return updated;
  }

  async bulkUpdate(updatesMap, userId, changeReason) {
    const updatedSettings = [];
    for (const [key, value] of Object.entries(updatesMap)) {
      try {
        const updated = await this.updateSetting(key, value, userId, changeReason);
        updatedSettings.push(updated);
      } catch (error) {
        logger.error(`Failed to update setting ${key}: ${error.message}`);
      }
    }
    return updatedSettings;
  }

  invalidateCache() {
    settingsCache = null;
    cacheTimestamp = 0;
  }
}

module.exports = new SettingService();
