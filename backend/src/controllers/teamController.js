// src/controllers/teamController.js
// ============================================================
// AEKADS Team Management Controller
// Members list, invite, update role, per-user permission matrix,
// access control flags, activity logs
// ============================================================
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, transaction } = require('../config/database');
const { AppError } = require('../middlewares/errorHandler');
const { invalidateUserCache, getUserPermissions } = require('../middlewares/rbac');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * All permission modules shown in the UI grid
 * Order matches the reference design exactly
 */
const PERMISSION_MODULES = [
  { key: 'screens',   label: 'Screen' },
  { key: 'playlists', label: 'Playlist' },
  { key: 'media',     label: 'Library' },
  { key: 'analytics', label: 'Reports' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'groups',    label: 'Groups' },
  { key: 'clusters',  label: 'Clusters' },
  { key: 'team',      label: 'Team' },
];

const PERMISSION_ACTIONS = ['create', 'read', 'update', 'delete'];

/**
 * Log team activity
 */
const logActivity = async (orgId, actorId, targetUserId, action, details = {}, ipAddress = null) => {
  try {
    await query(`
      INSERT INTO wilyer_team_activity_logs (org_id, actor_id, target_user_id, action, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [orgId, actorId, targetUserId, action, JSON.stringify(details), ipAddress]);
  } catch (err) {
    logger.error('Failed to log team activity:', err);
  }
};

/**
 * Get role's default permission slugs from DB
 */
const getRolePermissions = async (roleId) => {
  const res = await query(`
    SELECT p.slug FROM wilyer_role_permissions rp
    JOIN wilyer_permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = $1
  `, [roleId]);
  return new Set(res.rows.map(r => r.slug));
};

// ─────────────────────────────────────────────────────────────
// GET /api/team/members
// ─────────────────────────────────────────────────────────────
const getMembers = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { search, role, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = `u.org_id = $1 AND u.deleted_at IS NULL`;
    const params = [orgId];
    let paramCount = 1;

    if (search) {
      paramCount++;
      whereClause += ` AND (
        u.first_name ILIKE $${paramCount}
        OR u.last_name ILIKE $${paramCount}
        OR u.email ILIKE $${paramCount}
      )`;
      params.push(`%${search}%`);
    }

    if (role) {
      paramCount++;
      whereClause += ` AND EXISTS (
        SELECT 1 FROM wilyer_user_roles ur2
        JOIN wilyer_roles r2 ON r2.id = ur2.role_id
        WHERE ur2.user_id = u.id AND r2.slug = $${paramCount}
      )`;
      params.push(role);
    }

    const countRes = await query(
      `SELECT COUNT(*) FROM wilyer_users u WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].count);

    params.push(parseInt(limit), offset);
    const membersRes = await query(`
      SELECT
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.avatar_url,
        u.is_active,
        u.last_login_at,
        u.created_at,
        u.settings,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug)
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS roles
      FROM wilyer_users u
      LEFT JOIN wilyer_user_roles ur ON ur.user_id = u.id
      LEFT JOIN wilyer_roles r ON r.id = ur.role_id
      WHERE ${whereClause}
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `, params);

    res.json({
      success: true,
      data: membersRes.rows,
      meta: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/team/members/:id
// ─────────────────────────────────────────────────────────────
const getMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId = req.user.orgId;

    const memberRes = await query(`
      SELECT
        u.id, u.email, u.first_name, u.last_name, u.avatar_url,
        u.is_active, u.last_login_at, u.created_at, u.settings,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug)
          ) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS roles
      FROM wilyer_users u
      LEFT JOIN wilyer_user_roles ur ON ur.user_id = u.id
      LEFT JOIN wilyer_roles r ON r.id = ur.role_id
      WHERE u.id = $1 AND u.org_id = $2 AND u.deleted_at IS NULL
      GROUP BY u.id
    `, [id, orgId]);

    if (!memberRes.rows[0]) throw new AppError('Member not found', 404);

    // Get this member's effective permissions
    const { permissions } = await getUserPermissions(id, orgId);
    const permSlugs = new Set(permissions.map(p => p.slug));

    // Build permission matrix
    const matrix = PERMISSION_MODULES.map(mod => ({
      module: mod.key,
      label:  mod.label,
      permissions: PERMISSION_ACTIONS.reduce((acc, action) => {
        acc[action] = permSlugs.has(`${mod.key}:${action}`);
        return acc;
      }, {})
    }));

    // Access control settings (stored in user.settings)
    const settings = memberRes.rows[0].settings ?? {};
    const accessControl = {
      fileApprovalRequired: settings.file_approval_required ?? false,
      fileApprovalPermission: settings.file_approval_permission ?? false,
      restrictedAccess: settings.restricted_access ?? false,
    };

    res.json({
      success: true,
      data: {
        ...memberRes.rows[0],
        permissionMatrix: matrix,
        accessControl,
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/team/members  — Add / Invite member
// ─────────────────────────────────────────────────────────────
const addMember = async (req, res, next) => {
  try {
    const orgId   = req.user.orgId;
    const actorId = req.user.userId;

    const {
      firstName, lastName, email, password,
      roleSlug = 'viewer',
      permissions: customPermissions, // optional: override role defaults
      accessControl = {},
    } = req.body;

    if (!firstName || !email || !password) {
      throw new AppError('Name, email and password are required', 400);
    }

    // Check email not already in org
    const exists = await query(
      `SELECT id FROM wilyer_users WHERE email = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [email.toLowerCase(), orgId]
    );
    if (exists.rows[0]) throw new AppError('Email already exists in this organization', 409);

    // Check user limit
    const countRes = await query(
      `SELECT COUNT(*) FROM wilyer_users WHERE org_id = $1 AND deleted_at IS NULL AND is_active = TRUE`,
      [orgId]
    );
    const userCount = parseInt(countRes.rows[0].count);
    if (req.orgLimits && userCount >= req.orgLimits.maxUsers) {
      throw new AppError(`User limit (${req.orgLimits.maxUsers}) reached. Please upgrade your plan.`, 403);
    }

    // Get role
    const roleRes = await query(
      `SELECT id, slug FROM wilyer_roles WHERE slug = $1 AND (org_id = $2 OR is_system = TRUE)`,
      [roleSlug, orgId]
    );
    const role = roleRes.rows[0];
    if (!role) throw new AppError(`Role "${roleSlug}" not found`, 404);

    await transaction(async (client) => {
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create user
      const userRes = await query(`
        INSERT INTO wilyer_users (org_id, email, password_hash, first_name, last_name, settings)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, email, first_name, last_name, created_at
      `, [
        orgId,
        email.toLowerCase(),
        passwordHash,
        firstName,
        lastName ?? '',
        JSON.stringify({
          file_approval_required:  accessControl.fileApprovalRequired  ?? false,
          file_approval_permission: accessControl.fileApprovalPermission ?? false,
          restricted_access:        accessControl.restrictedAccess        ?? false,
        })
      ], client);

      const newUser = userRes.rows[0];

      // Assign role
      await query(`
        INSERT INTO wilyer_user_roles (user_id, role_id, assigned_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, role_id) DO NOTHING
      `, [newUser.id, role.id, actorId], client);

      // If custom permissions were passed, override role defaults
      if (customPermissions && Array.isArray(customPermissions)) {
        // customPermissions = ['screens:create', 'screens:read', ...]
        // We store these as user_overrides in settings or a separate table
        await query(`
          UPDATE wilyer_users
          SET settings = settings || $1::jsonb
          WHERE id = $2
        `, [JSON.stringify({ custom_permissions: customPermissions }), newUser.id], client);
      }

      // Log activity
      await logActivity(orgId, actorId, newUser.id, 'member.added', {
        email, roleSlug, firstName, lastName
      }, req.ip);

      // Invalidate cache
      invalidateUserCache(newUser.id);

      res.status(201).json({
        success: true,
        message: 'Member added successfully',
        data: {
          ...newUser,
          roles: [{ id: role.id, slug: role.slug }]
        }
      });
    });
  } catch (err) {
    next(err);
  }
};

const updateMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId   = req.user.orgId;
    const actorId = req.user.userId;

    const {
      firstName, lastName, isActive,
      roleSlug,
      permissions: customPermissions,
      accessControl,
    } = req.body;

    // Fetch member
    const memberRes = await query(
      `SELECT id, first_name, last_name, email, settings 
       FROM wilyer_users 
       WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [id, orgId]
    );
    if (!memberRes.rows[0]) throw new AppError('Member not found', 404);
    const member = memberRes.rows[0];

    // Build updates
    const updates = [];
    const values  = [];
    let idx = 1;

    if (firstName !== undefined) { updates.push(`first_name = $${idx++}`); values.push(firstName); }
    if (lastName  !== undefined) { updates.push(`last_name = $${idx++}`);  values.push(lastName); }
    if (isActive  !== undefined) { updates.push(`is_active = $${idx++}`);  values.push(isActive); }

    // Merge accessControl and customPermissions into one settings object
    if (accessControl !== undefined || customPermissions !== undefined) {
      const currentSettings = member.settings ?? {};

      const newSettings = { ...currentSettings };

      if (accessControl !== undefined) {
        newSettings.file_approval_required   = accessControl.fileApprovalRequired  ?? currentSettings.file_approval_required ?? false;
        newSettings.file_approval_permission = accessControl.fileApprovalPermission ?? currentSettings.file_approval_permission ?? false;
        newSettings.restricted_access        = accessControl.restrictedAccess      ?? currentSettings.restricted_access ?? false;
      }

      if (customPermissions !== undefined) {
        newSettings.custom_permissions = customPermissions;
      }

      updates.push(`settings = $${idx++}`);
      values.push(JSON.stringify(newSettings));
    }

    // Perform update if there’s anything to update
    if (updates.length > 0) {
      updates.push(`updated_at = NOW()`);
      values.push(id);
      await query(
        `UPDATE wilyer_users SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );
    }

    // Update role if requested
    if (roleSlug) {
      const roleRes = await query(
        `SELECT id FROM wilyer_roles WHERE slug = $1 AND (org_id = $2 OR is_system = TRUE)`,
        [roleSlug, orgId]
      );
      const role = roleRes.rows[0];
      if (!role) throw new AppError(`Role "${roleSlug}" not found`, 404);

      // Remove all existing roles for this user in this org
      await query(`
        DELETE FROM wilyer_user_roles
        WHERE user_id = $1
          AND role_id IN (
            SELECT id FROM wilyer_roles WHERE org_id = $2 OR is_system = TRUE
          )
      `, [id, orgId]);

      // Assign new role
      await query(`
        INSERT INTO wilyer_user_roles (user_id, role_id, assigned_by)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [id, role.id, actorId]);

      await logActivity(orgId, actorId, id, 'role.changed', {
        newRole: roleSlug, memberEmail: member.email
      }, req.ip);
    }

    invalidateUserCache(id);

    // Return updated member
    const updatedRes = await query(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.settings, u.last_login_at, u.created_at,
        COALESCE(json_agg(DISTINCT jsonb_build_object('id', r.id, 'name', r.name, 'slug', r.slug)) 
                 FILTER (WHERE r.id IS NOT NULL), '[]') AS roles
      FROM wilyer_users u
      LEFT JOIN wilyer_user_roles ur ON ur.user_id = u.id
      LEFT JOIN wilyer_roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id
    `, [id]);

    await logActivity(orgId, actorId, id, 'member.updated', { fields: Object.keys(req.body) }, req.ip);

    res.json({ success: true, data: updatedRes.rows[0] });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/team/members/:id/permissions  — Update user permission matrix
// ─────────────────────────────────────────────────────────────
const updateMemberPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId   = req.user.orgId;
    const actorId = req.user.userId;

    const { permissions } = req.body; // array of slugs: ['screens:create', ...]
    if (!Array.isArray(permissions)) throw new AppError('permissions must be an array', 400);

    // Verify member
    const memberRes = await query(
      `SELECT id, settings FROM wilyer_users WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [id, orgId]
    );
    if (!memberRes.rows[0]) throw new AppError('Member not found', 404);

    const current = memberRes.rows[0].settings ?? {};
    const newSettings = { ...current, custom_permissions: permissions };

    await query(
      `UPDATE wilyer_users SET settings = $1, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(newSettings), id]
    );

    invalidateUserCache(id);

    await logActivity(orgId, actorId, id, 'permissions.updated', {
      permissionsGranted: permissions.length
    }, req.ip);

    res.json({ success: true, message: 'Permissions updated', data: { userId: id, permissions } });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/team/members/:id
// ─────────────────────────────────────────────────────────────
const removeMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const orgId   = req.user.orgId;
    const actorId = req.user.userId;

    if (id === actorId) throw new AppError('Cannot remove yourself', 400);

    const memberRes = await query(
      `SELECT id, email, first_name, last_name FROM wilyer_users WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [id, orgId]
    );
    if (!memberRes.rows[0]) throw new AppError('Member not found', 404);

    // Soft delete
    await query(
      `UPDATE wilyer_users SET deleted_at = NOW(), is_active = FALSE WHERE id = $1`,
      [id]
    );

    invalidateUserCache(id);

    await logActivity(orgId, actorId, id, 'member.removed', {
      email: memberRes.rows[0].email
    }, req.ip);

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/team/roles  — Available roles
// ─────────────────────────────────────────────────────────────
const getRoles = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    const rolesRes = await query(`
      SELECT
        r.id, r.name, r.slug, r.description, r.is_system, r.created_at,
        COUNT(DISTINCT ur.user_id) AS member_count,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', p.id, 'slug', p.slug, 'name', p.name, 'module', p.module, 'action', p.action
            )
          ) FILTER (WHERE p.id IS NOT NULL),
          '[]'
        ) AS permissions
      FROM wilyer_roles r
      LEFT JOIN wilyer_role_permissions rp ON rp.role_id = r.id
      LEFT JOIN wilyer_permissions p ON p.id = rp.permission_id
      LEFT JOIN wilyer_user_roles ur ON ur.role_id = r.id
      WHERE (r.org_id = $1 OR r.is_system = TRUE)
        AND r.slug NOT IN ('super_admin', 'device')
      GROUP BY r.id
      ORDER BY CASE r.slug
        WHEN 'admin'   THEN 1
        WHEN 'manager' THEN 2
        WHEN 'editor'  THEN 3
        WHEN 'viewer'  THEN 4
        WHEN 'others'  THEN 5
        ELSE 6
      END
    `, [orgId]);

    res.json({ success: true, data: rolesRes.rows });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/team/permissions  — Permission matrix for a role
// ─────────────────────────────────────────────────────────────
const getRolePermissionMatrix = async (req, res, next) => {
  try {
    const { roleSlug } = req.query;
    const orgId = req.user.orgId;

    // Get all system permissions
    const permsRes = await query(`
      SELECT p.slug, p.module, p.action
      FROM wilyer_permissions p
      WHERE p.is_system = TRUE
        AND p.module IN ('screens','playlists','media','analytics','dashboard','groups','clusters','team')
      ORDER BY p.module, p.action
    `);

    let activePerms = new Set();

    if (roleSlug) {
      const roleRes = await query(
        `SELECT id FROM wilyer_roles WHERE slug = $1 AND (is_system = TRUE OR org_id = $2)`,
        [roleSlug, orgId]
      );
      if (roleRes.rows[0]) {
        activePerms = await getRolePermissions(roleRes.rows[0].id);
      }
    }

    // Build matrix
    const matrix = PERMISSION_MODULES.map(mod => ({
      module: mod.key,
      label:  mod.label,
      permissions: PERMISSION_ACTIONS.reduce((acc, action) => {
        acc[action] = activePerms.has(`${mod.key}:${action}`);
        return acc;
      }, {})
    }));

    res.json({ success: true, data: matrix });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/team/logs  — Activity logs
// ─────────────────────────────────────────────────────────────
const getActivityLogs = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    const [logsRes, countRes] = await Promise.all([
      query(`
        SELECT
          l.id, l.action, l.details, l.ip_address, l.created_at,
          actor.first_name AS actor_first, actor.last_name AS actor_last, actor.email AS actor_email,
          target.first_name AS target_first, target.last_name AS target_last, target.email AS target_email
        FROM wilyer_team_activity_logs l
        LEFT JOIN wilyer_users actor  ON actor.id = l.actor_id
        LEFT JOIN wilyer_users target ON target.id = l.target_user_id
        WHERE l.org_id = $1
        ORDER BY l.created_at DESC
        LIMIT $2 OFFSET $3
      `, [orgId, parseInt(limit), offset]),
      query(`SELECT COUNT(*) FROM wilyer_team_activity_logs WHERE org_id = $1`, [orgId]),
    ]);

    res.json({
      success: true,
      data: logsRes.rows,
      meta: {
        total: parseInt(countRes.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/team/stats
// ─────────────────────────────────────────────────────────────
const getTeamStats = async (req, res, next) => {
  try {
    const orgId = req.user.orgId;

    const res2 = await query(`
      SELECT
        COUNT(*)                                                   AS total,
        COUNT(*) FILTER (WHERE u.is_active = TRUE)                AS active,
        COUNT(*) FILTER (WHERE u.last_login_at > NOW() - INTERVAL '7 days') AS active_this_week
      FROM wilyer_users u
      WHERE u.org_id = $1 AND u.deleted_at IS NULL
    `, [orgId]);

    const byRoleRes = await query(`
      SELECT r.slug, r.name, COUNT(ur.user_id) AS count
      FROM wilyer_roles r
      LEFT JOIN wilyer_user_roles ur ON ur.role_id = r.id
      LEFT JOIN wilyer_users u ON u.id = ur.user_id AND u.org_id = $1 AND u.deleted_at IS NULL
      WHERE r.slug NOT IN ('super_admin', 'device')
      GROUP BY r.id
      ORDER BY count DESC
    `, [orgId]);

    res.json({
      success: true,
      data: {
        ...res2.rows[0],
        byRole: byRoleRes.rows,
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMembers,
  getMember,
  addMember,
  updateMember,
  updateMemberPermissions,
  removeMember,
  getRoles,
  getRolePermissionMatrix,
  getActivityLogs,
  getTeamStats,
};
