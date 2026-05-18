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

  Object.assign(req, value);
  return next();
};

module.exports = validate;
