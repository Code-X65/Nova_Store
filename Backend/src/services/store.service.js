const storeModel = require('../models/store.model');

class StoreService {
  /**
   * Fetch the full store profile including settings
   * @param {string} storeId
   */
  async getStoreProfile(storeId) {
    if (!storeId) {
      throw new Error('Store ID is required to fetch profile');
    }

    const store = await storeModel.findById(storeId);
    if (!store) {
      throw new Error('Store not found');
    }

    const settingsRecords = await storeModel.getSettings(storeId);
    // Convert array of {key, value} to an object map for easier consumption
    const settings = {};
    for (const record of settingsRecords) {
      settings[record.key] = record.value;
    }

    return {
      ...store,
      settings
    };
  }

  /**
   * Update the core store profile (name, contact, etc.)
   * @param {string} storeId
   * @param {Object} updates
   */
  async updateStoreProfile(storeId, updates) {
    if (!storeId) {
      throw new Error('Store ID is required to update profile');
    }

    // Optional: add validation here (e.g. joi schema)
    // We only want to allow updating safe fields
    const allowedFields = [
      'name', 'tagline', 'description', 'email', 'phone', 'whatsapp', 'website_url',
      'address', 'logo_url', 'banner_url', 'favicon_url', 'primary_color', 'secondary_color',
      'social_links', 'business_registration_number', 'tax_id', 'business_type',
      'business_hours', 'timezone', 'currency', 'country', 'language',
      'is_active', 'is_maintenance_mode', 'accepts_guest_orders',
      'return_window_days', 'return_policy_text'
    ];

    const safeUpdates = {};
    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        safeUpdates[key] = updates[key];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return storeModel.findById(storeId); // Nothing to update
    }

    return await storeModel.update(storeId, safeUpdates);
  }

  /**
   * Update or insert multiple settings
   * @param {string} storeId
   * @param {Array<{key: string, value: any}>} settings
   */
  async updateStoreSettings(storeId, settings) {
    if (!storeId) {
      throw new Error('Store ID is required to update settings');
    }
    
    await storeModel.upsertSettings(storeId, settings);
    
    // Return the new fully merged settings object
    const settingsRecords = await storeModel.getSettings(storeId);
    const updatedSettings = {};
    for (const record of settingsRecords) {
      updatedSettings[record.key] = record.value;
    }
    return updatedSettings;
  }
}

module.exports = new StoreService();
