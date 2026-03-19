// src/middlewares/validate.js
const { AppError } = require('./errorHandler');

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const message = error.details.map(d => d.message).join('; ');
    return next(new AppError(message, 400));
  }
  next();
};

module.exports = validate;
