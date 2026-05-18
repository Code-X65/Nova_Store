const addressModel = require('../models/address.model');

class AddressService {
  async addAddress(userId, addressData) {
    if (addressData.is_default) {
      await addressModel.unsetDefaults(userId);
    }
    
    // If it's the first address, make it default
    const existing = await addressModel.findByUserId(userId);
    if (existing.length === 0) {
      addressData.is_default = true;
    }
    
    return await addressModel.create({ ...addressData, user_id: userId });
  }

  async getAddresses(userId) {
    return await addressModel.findByUserId(userId);
  }

  async getAddressById(userId, addressId) {
    const address = await addressModel.findById(addressId);
    if (!address || address.user_id !== userId) {
      const error = new Error('Address not found or unauthorized');
      error.statusCode = 404;
      throw error;
    }
    return address;
  }

  async updateAddress(userId, addressId, updateData) {
    const address = await addressModel.findById(addressId);
    if (!address || address.user_id !== userId) {
      const error = new Error('Address not found or unauthorized');
      error.statusCode = 404;
      throw error;
    }

    if (updateData.is_default) {
      await addressModel.unsetDefaults(userId);
    }

    return await addressModel.update(addressId, updateData);
  }

  async deleteAddress(userId, addressId) {
    const address = await addressModel.findById(addressId);
    if (!address || address.user_id !== userId) {
      const error = new Error('Address not found or unauthorized');
      error.statusCode = 404;
      throw error;
    }

    await addressModel.delete(addressId);
    
    // If we deleted the default, make the next one default
    if (address.is_default) {
      const remaining = await addressModel.findByUserId(userId);
      if (remaining.length > 0) {
        await addressModel.update(remaining[0].id, { is_default: true });
      }
    }

    return true;
  }

  async setAddressAsDefault(userId, addressId) {
    const address = await addressModel.findById(addressId);
    if (!address || address.user_id !== userId) {
      const error = new Error('Address not found or unauthorized');
      error.statusCode = 404;
      throw error;
    }

    await addressModel.unsetDefaults(userId);
    return await addressModel.update(addressId, { is_default: true });
  }
}

module.exports = new AddressService();
