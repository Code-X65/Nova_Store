const SettingModel = require('../models/setting.model');
const logger = require('../utils/logger');

const ALLOWED_GROUPS = new Set([
  'currency', 'shipping', 'store', 'email', 'system',
  'localization', 'seo', 'tax',
]);

const KNOWN_KEYS_BY_GROUP = {
  currency: ['currency.default', 'currency.symbol', 'currency.position', 'currency.decimal_places'],
  shipping: ['shipping.free_shipping_threshold', 'shipping.default_carrier', 'shipping.restrict_countries', 'shipping.allowed_countries'],
  localization: ['localization.store_timezone', 'localization.date_format'],
  seo: ['seo.meta_title', 'seo.meta_description', 'seo.robots_txt', 'seo.sitemap_enabled', 'seo.json_ld_enabled'],
  store: ['store.name', 'store.email', 'store.phone', 'store.address', 'store.logo_url', 'store.timezone'],
  email: ['email.from_name', 'email.from_address', 'email.reply_to'],
  system: ['maintenance_mode', 'maintenance_message'],
};

function validateGroupPayload(group, payload) {
  if (!ALLOWED_GROUPS.has(group)) {
    const error = new Error(`Settings group "${group}" is not allowed`);
    error.statusCode = 400;
    throw error;
  }
  const allowedKeys = KNOWN_KEYS_BY_GROUP[group] || [];
  const invalidKeys = Object.keys(payload).filter(k => allowedKeys.length > 0 && !allowedKeys.includes(k));
  if (invalidKeys.length > 0) {
    const error = new Error(`Unexpected keys for group "${group}": ${invalidKeys.join(', ')}`);
    error.statusCode = 400;
    throw error;
  }
  return payload;
}

// Optional caching
let settingsCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 mins

class SettingService {
  async getAllGrouped() {
    const settings = await SettingModel.getAll();
    return settings;
  }

  async getByGroup(group) {
    if (!ALLOWED_GROUPS.has(group)) {
      const error = new Error(`Settings group "${group}" is not allowed`);
      error.statusCode = 400;
      throw error;
    }
    const settings = await SettingModel.getAll(group);
    const result = {};
    settings.forEach(s => {
      const subKey = s.key.includes('.') ? s.key.split('.')[1] : s.key;
      let parsedValue = s.value;
      if (s.value_type === 'number') parsedValue = Number(s.value);
      else if (s.value_type === 'boolean') parsedValue = s.value === 'true';
      else if (s.value_type === 'json') {
        try { parsedValue = JSON.parse(s.value); } catch (e) { parsedValue = null; }
      }
      result[subKey] = parsedValue;
    });
    return result;
  }

  async updateByGroup(group, payload, userId, changeReason) {
    validateGroupPayload(group, payload);
    const updated = [];
    for (const [key, value] of Object.entries(payload)) {
      try {
        const fullKey = `${group}.${key}`;
        const result = await this.updateSetting(fullKey, value, userId, changeReason || `Update ${group} group`);
        updated.push(result);
      } catch (error) {
        logger.error(`Failed to update setting ${group}.${key}: ${error.message}`);
      }
    }
    return updated;
  }

  async getPublicSettingsStructured() {
    const settings = await SettingModel.getPublicSettings();
    const structured = {};

    settings.forEach(setting => {
      const { key, value, value_type, group_name } = setting;
      
      let parsedValue = value;
      if (value_type === 'number') parsedValue = Number(value);
      else if (value_type === 'boolean') parsedValue = value === 'true';
      else if (value_type === 'json') {
        try { parsedValue = JSON.parse(value); } catch(e) { parsedValue = null; }
      }

      const subKeyRaw = key.includes('.') ? key.split('.')[1] : key;
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

    if (key === 'currency.default') {
      const error = new Error('currency.default is immutable');
      error.statusCode = 400;
      throw error;
    }

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

