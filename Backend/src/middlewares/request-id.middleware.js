const crypto = require('crypto');
const contextStore = require('../utils/context');

module.exports = (req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-ID', req.id);
  
  contextStore.run({ requestId: req.id }, () => {
    next();
  });
};
