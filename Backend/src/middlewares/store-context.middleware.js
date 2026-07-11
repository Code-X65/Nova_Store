const storeModel = require('../models/store.model');

const storeContext = async (req, res, next) => {
  try {
    req.store = await storeModel.getDefaultStore();
    next();
  } catch (error) {
    console.error('Error resolving single store context:', error);
    next();
  }
};

module.exports = storeContext;
