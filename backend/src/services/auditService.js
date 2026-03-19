// src/services/auditService.js
const { query } = require('../config/database');
const logger = require('../utils/logger');

const createAuditLog = async ({ orgId, userId, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent }) => {
  try {
    await query(`
      INSERT INTO wilyer_audit_logs (org_id, user_id, action, entity_type, entity_id, old_values, new_values, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [orgId, userId, action, entityType, entityId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress, userAgent]);
  } catch (err) {
    logger.error('Failed to create audit log', { error: err.message, action });
  }
};

module.exports = { createAuditLog };
