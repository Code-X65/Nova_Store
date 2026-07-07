const storeModel = require('../models/store.model');

const storeContext = async (req, res, next) => {
  try {
    let store = null;

    if (req.user?.store_id) {
      store = await storeModel.findById(req.user.store_id);
    } else if (req.admin?.store_id) {
      store = await storeModel.findById(req.admin.store_id);
    } else if (req.user?.id) {
      store = await storeModel.findUserStore(req.user.id);
    } else if (req.session?.adminId) {
      store = await storeModel.findUserStore(req.session.adminId);
    }

    if (!store) {
      store = await storeModel.getDefaultStore();
    }

    req.store = store;
    next();
  } catch (error) {
    console.error('Error resolving store context:', error);
    // Fail safe to default store to avoid breaking general site usability
    try {
      req.store = await storeModel.getDefaultStore();
    } catch (fallbackError) {
      console.error('Fallback store resolution failed:', fallbackError);
    }
    next();
  }
};

module.exports = storeContext;
