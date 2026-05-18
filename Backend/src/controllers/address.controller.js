const addressService = require('../services/address.service');

class AddressController {
  async getAddresses(req, res, next) {
    try {
      const addresses = await addressService.getAddresses(req.user.id);
      res.status(200).json({ success: true, data: addresses });
    } catch (error) {
      next(error);
    }
  }

  async getAddressById(req, res, next) {
    try {
      const address = await addressService.getAddressById(req.user.id, req.params.id);
      res.status(200).json({ success: true, data: address });
    } catch (error) {
      next(error);
    }
  }

  async addAddress(req, res, next) {
    try {
      const address = await addressService.addAddress(req.user.id, req.body);
      res.status(201).json({ success: true, data: address });
    } catch (error) {
      next(error);
    }
  }

  async updateAddress(req, res, next) {
    try {
      const address = await addressService.updateAddress(req.user.id, req.params.id, req.body);
      res.status(200).json({ success: true, data: address });
    } catch (error) {
      next(error);
    }
  }

  async deleteAddress(req, res, next) {
    try {
      await addressService.deleteAddress(req.user.id, req.params.id);
      res.status(200).json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async setAddressAsDefault(req, res, next) {
    try {
      const address = await addressService.setAddressAsDefault(req.user.id, req.params.id);
      res.status(200).json({ success: true, data: address });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AddressController();
