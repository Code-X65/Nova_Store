const addressModel = require('../models/address.model');

class AddressService {
  async addAddress(userId, addressData) {
    const existing = await addressModel.findByUserId(userId);
    
    // Check for duplicates (street, city, state, postal code, country)
    const isDuplicate = existing.some(addr => 
      addr.street_address.toLowerCase().trim() === addressData.street_address.toLowerCase().trim() &&
      addr.city.toLowerCase().trim() === addressData.city.toLowerCase().trim() &&
      addr.state.toLowerCase().trim() === addressData.state.toLowerCase().trim() &&
      (addr.postal_code || '').toLowerCase().trim() === (addressData.postal_code || '').toLowerCase().trim() &&
      addr.country.toLowerCase().trim() === (addressData.country || 'Nigeria').toLowerCase().trim()
    );

    if (isDuplicate) {
      const error = new Error('This address already exists in your address book.');
      error.statusCode = 400;
      throw error;
    }

    // Check address limit (max 3)
    if (existing.length >= 3) {
      const error = new Error('Address book limit reached. You can only save up to 3 addresses.');
      error.statusCode = 400;
      throw error;
    }

    if (addressData.is_default) {
      await addressModel.unsetDefaults(userId);
    }
    
    // If it's the first address, make it default
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

    // Check for duplicates against other existing addresses if fields are updated
    const existing = await addressModel.findByUserId(userId);
    
    const street = updateData.street_address !== undefined ? updateData.street_address : address.street_address;
    const city = updateData.city !== undefined ? updateData.city : address.city;
    const state = updateData.state !== undefined ? updateData.state : address.state;
    const postal = updateData.postal_code !== undefined ? updateData.postal_code : address.postal_code;
    const country = updateData.country !== undefined ? updateData.country : address.country;

    const isDuplicate = existing.some(addr => 
      addr.id !== addressId &&
      addr.street_address.toLowerCase().trim() === street.toLowerCase().trim() &&
      addr.city.toLowerCase().trim() === city.toLowerCase().trim() &&
      addr.state.toLowerCase().trim() === state.toLowerCase().trim() &&
      (addr.postal_code || '').toLowerCase().trim() === (postal || '').toLowerCase().trim() &&
      addr.country.toLowerCase().trim() === (country || 'Nigeria').toLowerCase().trim()
    );

    if (isDuplicate) {
      const error = new Error('An identical address already exists in your address book.');
      error.statusCode = 400;
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
