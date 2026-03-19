// src/middlewares/rbac.js
// ============================================================
// AEKADS RBAC Middleware — Final Complete Version
// Changes from previous:
//  • getUserPermissions: also checks user.settings.custom_permissions
//  • requirePermission: super_admin AND admin both bypass all checks
//  • isAdmin flag added everywhere (not just isSuperAdmin)
//  • String() cast on all userId/orgId to avoid UUID type mismatch
// ============================================================
const { query }    = require('../config/database');
const { AppError } = require('./errorHandler');
const logger       = require('../utils/logger');

// ── In-memory permission cache ────────────────────────────────
const permissionCache = new Map();
const CACHE_TTL       = 5 * 60 * 1000; // 5 min

// ── ID extractors — handles all JWT field name variations ─────
const extractUserId = (user) =>
  user?.userId || user?.user_id || user?.id || user?.sub || null;

const extractOrgId = (user) =>
  user?.orgId  || user?.org_id || user?.organizationId || user?.organization_id || null;

// ─────────────────────────────────────────────────────────────
// getUserPermissions
// Returns { permissions, isSuperAdmin, isAdmin, timestamp }
// ─────────────────────────────────────────────────────────────
const getUserPermissions = async (userId, orgId) => {
  if (!userId || !orgId) {
    return { permissions: [], isSuperAdmin: false, isAdmin: false, timestamp: Date.now() };
  }

  const uid      = String(userId);
  const oid      = String(orgId);
  const cacheKey = `perms:${uid}:${oid}`;
  const cached   = permissionCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) return cached;

  try {
    // ── Step 1: Get user's roles ───────────────────────────────
    const rolesRes = await query(`
      SELECT r.slug
      FROM wilyer_user_roles ur
      JOIN wilyer_roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
    `, [uid]);

    const roleSlugs    = (rolesRes?.rows ?? []).map(r => r.slug);
    const isSuperAdmin = roleSlugs.includes('super_admin');
    const isAdmin      = roleSlugs.includes('admin');

    // ── Step 2: Role-based permissions from DB ─────────────────
    const permRes = await query(`
      SELECT DISTINCT
        p.id     AS permission_id,
        p.slug   AS slug,
        p.module AS module,
        p.action AS action,
        r.slug   AS role_slug,
        r.name   AS role_name
      FROM wilyer_user_roles ur
      JOIN wilyer_roles r
        ON r.id = ur.role_id
       AND (r.is_system = TRUE OR r.org_id = $2)
      JOIN wilyer_role_permissions rp ON rp.role_id = r.id
      JOIN wilyer_permissions p       ON p.id = rp.permission_id
      WHERE ur.user_id = $1
    `, [uid, oid]);

    let permissions = permRes?.rows ?? [];

    // ── Step 3: Merge custom_permissions from user.settings ────
    // Set by Team controller when admin manually overrides per-user permissions
    try {
      const userRes = await query(
        `SELECT settings FROM wilyer_users WHERE id = $1 AND deleted_at IS NULL`,
        [uid]
      );
      const customPerms = userRes?.rows?.[0]?.settings?.custom_permissions;

      if (Array.isArray(customPerms) && customPerms.length > 0) {
        const customRes = await query(
          `SELECT slug, module, action FROM wilyer_permissions WHERE slug = ANY($1::text[])`,
          [customPerms]
        );
        const existingSlugs = new Set(permissions.map(p => p.slug));
        (customRes?.rows ?? []).forEach(p => {
          if (!existingSlugs.has(p.slug)) permissions.push(p);
        });
      }
    } catch (settingsErr) {
      // Non-fatal — custom permissions are optional
      logger.warn('getUserPermissions: custom_permissions load failed:', settingsErr.message);
    }

    const permissionData = { permissions, isSuperAdmin, isAdmin, timestamp: Date.now() };
    permissionCache.set(cacheKey, permissionData);
    return permissionData;

  } catch (error) {
    logger.error('getUserPermissions DB error:', { userId: uid, orgId: oid, error: error.message });
    return { permissions: [], isSuperAdmin: false, isAdmin: false, timestamp: Date.now() };
  }
};

// ── Cache invalidation ────────────────────────────────────────
const invalidateUserCache = (userId) => {
  if (!userId) return;
  const prefix = `perms:${String(userId)}:`;
  for (const key of permissionCache.keys()) {
    if (key.startsWith(prefix)) permissionCache.delete(key);
  }
};

const clearAllCache = () => {
  permissionCache.clear();
  logger.info('Permission cache cleared');
};

// ─────────────────────────────────────────────────────────────
// requirePermission middleware
//
// Usage:
//   requirePermission('screens', 'read')
//   requirePermission('team', 'create')
//   requirePermission(['screens:read', 'screens:update'], 'any')
// ─────────────────────────────────────────────────────────────
const requirePermission = (module, action, mode = 'all') => {
  return async (req, res, next) => {
    try {
      if (!req.user) return next(new AppError('Authentication required', 401));

      const userId = extractUserId(req.user);
      const orgId  = extractOrgId(req.user);

      if (!userId) return next(new AppError('Invalid token: userId missing', 401));
      if (!orgId)  return next(new AppError('Invalid token: orgId missing', 403));

      // Normalise on req.user for downstream controllers
      req.user.userId         = userId;
      req.user.id             = userId;
      req.user.orgId          = orgId;
      req.user.organizationId = orgId;

      const { permissions, isSuperAdmin, isAdmin } = await getUserPermissions(userId, orgId);

      // ── super_admin AND admin bypass ALL permission checks ────
      if (isSuperAdmin || isAdmin) {
        req.user.permissions  = permissions;
        req.user.isSuperAdmin = isSuperAdmin;
        req.user.isAdmin      = isAdmin;
        return next();
      }

      // ── Build required slugs ──────────────────────────────────
      let requiredPerms = [];
      if (Array.isArray(module)) {
        requiredPerms = module;
      } else if (typeof module === 'string' && action) {
        requiredPerms = [`${module}:${action}`];
      }

      // Nothing required → allow through
      if (requiredPerms.length === 0) {
        req.user.permissions  = permissions;
        req.user.isSuperAdmin = false;
        req.user.isAdmin      = false;
        return next();
      }

      // ── Check user's permission set ───────────────────────────
      const userPermSlugs = new Set(permissions.filter(p => p?.slug).map(p => p.slug));

      const hasPermission = mode === 'any'
        ? requiredPerms.some(p  => userPermSlugs.has(p))
        : requiredPerms.every(p => userPermSlugs.has(p));

      if (!hasPermission) {
        logger.warn('Permission denied', {
          userId, orgId, required: requiredPerms,
          has: [...userPermSlugs].slice(0, 10), mode,
        });
        return next(new AppError(
          `Insufficient permissions. Required: ${requiredPerms.join(', ')}`, 403
        ));
      }

      req.user.permissions  = permissions;
      req.user.isSuperAdmin = false;
      req.user.isAdmin      = false;
      return next();

    } catch (err) {
      logger.error('requirePermission error:', err.message);
      return next(err);
    }
  };
};

// ─────────────────────────────────────────────────────────────
// attachPermissions — non-blocking helper (for optional use)
// ─────────────────────────────────────────────────────────────
const attachPermissions = async (req, res, next) => {
  try {
    if (req.user) {
      const userId = extractUserId(req.user);
      const orgId  = extractOrgId(req.user);
      if (userId && orgId) {
        const { permissions, isSuperAdmin, isAdmin } = await getUserPermissions(userId, orgId);
        req.user.permissions  = permissions ?? [];
        req.user.isSuperAdmin = isSuperAdmin;
        req.user.isAdmin      = isAdmin;
        req.user.userId       = userId;
        req.user.orgId        = orgId;
      }
    }
  } catch (err) {
    logger.error('attachPermissions error:', err.message);
  }
  next();
};

// ─────────────────────────────────────────────────────────────
// requireOrgAccess — validates org is active + attaches limits
// ─────────────────────────────────────────────────────────────
const requireOrgAccess = async (req, res, next) => {
  try {
    const orgId = extractOrgId(req.user);
    if (!orgId) return next(new AppError('Organization context missing', 403));

    const result = await query(`
      SELECT
        o.id, o.name, o.slug, o.is_active, o.settings,
        COALESCE(s.status, 'trial')    AS sub_status,
        s.current_period_end,
        COALESCE(sp.max_screens,   5)  AS max_screens,
        COALESCE(sp.max_users,    10)  AS max_users,
        COALESCE(sp.max_storage_gb,10) AS max_storage_gb,
        COALESCE(sp.features, '{}')    AS features
      FROM wilyer_organizations o
      LEFT JOIN wilyer_subscriptions s  ON s.org_id = o.id
      LEFT JOIN wilyer_subscription_plans sp ON sp.id = s.plan_id
      WHERE o.id = $1 AND o.deleted_at IS NULL
    `, [String(orgId)]);

    if (!result?.rows?.length)  return next(new AppError('Organization not found', 404));

    const org = result.rows[0];
    if (!org.is_active)         return next(new AppError('Organization account is deactivated', 403));

    req.org       = org;
    req.orgLimits = {
      maxScreens:   org.max_screens,
      maxUsers:     org.max_users,
      maxStorageGb: org.max_storage_gb,
      features:     org.features ?? {},
    };

    req.user.userId = extractUserId(req.user);
    req.user.orgId  = orgId;
    next();
  } catch (err) {
    logger.error('requireOrgAccess error:', err.message);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// requireSameOrg — prevents cross-org data leaks
// ─────────────────────────────────────────────────────────────
const requireSameOrg = (tableName, paramName = 'id') => {
  const VALID_TABLES = [
    'wilyer_screens', 'wilyer_playlists', 'wilyer_media_files',
    'wilyer_schedules', 'wilyer_users', 'wilyer_screen_groups',
    'wilyer_folders', 'wilyer_widgets',
  ];
  return async (req, res, next) => {
    try {
      const resourceId = req.params[paramName];
      const orgId      = extractOrgId(req.user);
      if (!resourceId) return next();
      if (!orgId)      return next(new AppError('Organization context required', 403));
      if (!VALID_TABLES.includes(tableName))
        return next(new AppError('Internal configuration error', 500));

      const result = await query(
        `SELECT id FROM ${tableName} WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
        [resourceId, String(orgId)]
      );
      if (!result?.rows?.length)
        return next(new AppError('Resource not found or access denied', 404));
      next();
    } catch (err) {
      logger.error('requireSameOrg error:', err.message);
      next(err);
    }
  };
};

// ─────────────────────────────────────────────────────────────
// requireFeature — subscription feature flag check
// ─────────────────────────────────────────────────────────────
const requireFeature = (featureName) => {
  return (req, res, next) => {
    if (req.user?.isSuperAdmin || req.user?.isAdmin) return next();
    const features = req.orgLimits?.features ?? {};
    if (!features[featureName])
      return next(new AppError(
        `Feature '${featureName}' is not available on your current plan.`, 403
      ));
    next();
  };
};

// ─────────────────────────────────────────────────────────────
// hasPermission — programmatic check inside controllers
// ─────────────────────────────────────────────────────────────
const hasPermission = async (userId, orgId, permissionSlug) => {
  try {
    if (!userId || !orgId || !permissionSlug) return false;
    const { permissions, isSuperAdmin, isAdmin } = await getUserPermissions(userId, orgId);
    if (isSuperAdmin || isAdmin) return true;
    return permissions.some(p => p?.slug === permissionSlug);
  } catch (err) {
    logger.error('hasPermission error:', err.message);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────
module.exports = {
  requirePermission,
  attachPermissions,
  requireOrgAccess,
  requireSameOrg,
  requireFeature,
  getUserPermissions,
  invalidateUserCache,
  clearAllCache,
  hasPermission,
};