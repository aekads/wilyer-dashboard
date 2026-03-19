// src/validations/authValidation.js
const Joi = require('joi');

const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required()
    .messages({ 'string.pattern.base': 'Password must have uppercase, lowercase and number' }),
  firstName: Joi.string().min(1).max(100).required(),
  lastName: Joi.string().min(1).max(100).required(),
  orgName: Joi.string().min(2).max(255).required(),
  orgSlug: Joi.string().min(2).max(100).pattern(/^[a-z0-9-]+$/).required()
    .messages({ 'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens' })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  // orgSlug: Joi.string().required()
});

module.exports = { registerSchema, loginSchema };
