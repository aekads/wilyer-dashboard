// src/validations/teamValidation.js
const Joi = require('joi');

const accessControlSchema = Joi.object({
  fileApprovalRequired:  Joi.boolean().default(false),
  fileApprovalPermission: Joi.boolean().default(false),
  restrictedAccess:      Joi.boolean().default(false),
});

const addMemberSchema = Joi.object({
  firstName: Joi.string().trim().min(1).max(80).required()
    .messages({ 'string.empty': 'Member name is required' }),
  lastName:  Joi.string().trim().max(80).allow('').default(''),
  email:     Joi.string().email().lowercase().required()
    .messages({ 'string.email': 'Valid email is required' }),
  password:  Joi.string().min(6).required()
    .messages({ 'string.min': 'Password must be at least 6 characters' }),
  roleSlug:  Joi.string().valid('admin','manager','editor','viewer','others').default('viewer'),
  permissions: Joi.array().items(Joi.string()).optional(),
  accessControl: accessControlSchema.default({}),
});

const updateMemberSchema = Joi.object({
  firstName:   Joi.string().trim().min(1).max(80).optional(),
  lastName:    Joi.string().trim().max(80).allow('').optional(),
  isActive:    Joi.boolean().optional(),
  roleSlug:    Joi.string().valid('admin','manager','editor','viewer','others').optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
  accessControl: accessControlSchema.optional(),
});

const updatePermissionsSchema = Joi.object({
  permissions: Joi.array().items(Joi.string()).required()
    .messages({ 'any.required': 'permissions array is required' }),
});

module.exports = { addMemberSchema, updateMemberSchema, updatePermissionsSchema };
