const Joi = require('joi');

const validate = (schema) => (req, res, next) => {
  const validSchema = {};
  const object = {};

  ['params', 'query', 'body'].forEach((key) => {
    if (schema[key]) {
      validSchema[key] = schema[key];
      object[key] = req[key];
    }
  });

  const { value, error } = Joi.compile(validSchema)
    .prefs({ errors: { label: 'key' }, abortEarly: false })
    .validate(object);

  if (error) {
    return next(error);
  }

  ['params', 'query', 'body'].forEach((key) => {
    if (value[key]) {
      try {
        req[key] = value[key];
      } catch (e) {
        // Safe fallback if the property is a read-only getter
        if (req[key] && typeof req[key] === 'object') {
          for (const k in value[key]) {
            req[key][k] = value[key][k];
          }
        }
      }
    }
  });

  return next();
};

module.exports = validate;
