// src/controllers/authController.js
// ============================================================
// AEKADS Authentication Controller
// Changes:
//   • login() — finds user by email alone (no orgSlug required)
//   • forgotPassword() — sends password reset email
//   • resetPassword() — validates token + sets new password
// All other functions unchanged
// ============================================================
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { query, transaction } = require('../config/database');
const { AppError }           = require('../middlewares/errorHandler');
const { createAuditLog }     = require('../services/auditService');
const { invalidateUserCache } = require('../middlewares/rbac');
const { sendResetEmail }      = require('../services/emailService');
const logger = require('../utils/logger');

// ── Token Helpers ─────────────────────────────────────────────

const generateAccessToken = (userId, orgId, email) => {
  return jwt.sign(
    {
      userId,
      orgId,
      email,
      // aliases for backwards compat
      id: userId,
      organizationId: orgId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

const generateRefreshToken = () => crypto.randomBytes(64).toString('hex');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// ── Controllers ───────────────────────────────────────────────

/**
 * POST /api/auth/register
 * (unchanged)
 */
const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, orgName, orgSlug } = req.body;

    await transaction(async (client) => {
      const existingOrg = await query(
        'SELECT id FROM wilyer_organizations WHERE slug = $1',
        [orgSlug]
      );
      if (existingOrg.rows[0]) {
        throw new AppError('Organization slug already taken', 409);
      }

      const orgResult = await query(
        `INSERT INTO wilyer_organizations (name, slug) VALUES ($1, $2) RETURNING id`,
        [orgName, orgSlug],
        client
      );
      const orgId = orgResult.rows[0].id;

      const planResult = await query(
        `SELECT id FROM wilyer_subscription_plans WHERE slug = 'starter' LIMIT 1`
      );
      const planId = planResult.rows[0]?.id;
      if (planId) {
        await query(`
          INSERT INTO wilyer_subscriptions (org_id, plan_id, status, trial_ends_at, current_period_end)
          VALUES ($1, $2, 'trial', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days')
        `, [orgId, planId], client);
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const userResult = await query(`
        INSERT INTO wilyer_users (org_id, email, password_hash, first_name, last_name)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, email, first_name, last_name
      `, [orgId, email.toLowerCase(), passwordHash, firstName, lastName], client);

      const user = userResult.rows[0];

      const adminRole = await query(`SELECT id FROM wilyer_roles WHERE slug = 'admin' LIMIT 1`);
      if (adminRole.rows[0]) {
        await query(
          `INSERT INTO wilyer_user_roles (user_id, role_id) VALUES ($1, $2)`,
          [user.id, adminRole.rows[0].id],
          client
        );
      }

      const accessToken       = generateAccessToken(user.id, orgId, user.email);
      const refreshToken      = generateRefreshToken();
      const refreshTokenHash  = hashToken(refreshToken);

      await query(`
        INSERT INTO wilyer_refresh_tokens (user_id, token_hash, expires_at, ip_address, device_info)
        VALUES ($1, $2, NOW() + INTERVAL '30 days', $3, $4)
      `, [user.id, refreshTokenHash, req.ip, JSON.stringify({ userAgent: req.headers['user-agent'] })], client);

      res.status(201).json({
        success: true,
        message: 'Account created successfully',
        data: {
          user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, orgId },
          accessToken,
          refreshToken,
        }
      });
    });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/login
 * ─────────────────────────────────────────────────────────────
 * NOW accepts: { email, password }
 * orgSlug is NO LONGER REQUIRED.
 *
 * Strategy:
 *   1. Find ALL active users with this email across all orgs
 *   2. If exactly 1 match — log them in directly
 *   3. If multiple matches — verify password against each, log in the
 *      first match (most recently registered wins)
 *   4. If orgSlug is still supplied (backwards compat) — use it to
 *      narrow to that specific org
 */
const login = async (req, res, next) => {
  try {
    const { email, password, orgSlug } = req.body;

    if (!email || !password) {
      throw new AppError('Email and password are required', 400);
    }

    let userResult;

    if (orgSlug) {
      // ── Backwards compat: orgSlug still provided ────────────
      const orgResult = await query(
        `SELECT id FROM wilyer_organizations
         WHERE slug = $1 AND is_active = TRUE AND deleted_at IS NULL`,
        [orgSlug]
      );
      if (!orgResult.rows[0]) throw new AppError('Invalid credentials', 401);

      userResult = await query(`
        SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name,
               u.is_active, u.is_email_verified, u.org_id
        FROM wilyer_users u
        WHERE u.email = $1
          AND u.org_id = $2
          AND u.deleted_at IS NULL
        LIMIT 1
      `, [email.toLowerCase(), orgResult.rows[0].id]);

    } else {
      // ── New flow: email only — find most recently created match ─
      userResult = await query(`
        SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name,
               u.is_active, u.is_email_verified, u.org_id
        FROM wilyer_users u
        JOIN wilyer_organizations o ON o.id = u.org_id
        WHERE u.email = $1
          AND u.deleted_at IS NULL
          AND u.is_active = TRUE
          AND o.is_active = TRUE
          AND o.deleted_at IS NULL
        ORDER BY u.created_at DESC
      `, [email.toLowerCase()]);
    }

    if (!userResult.rows.length) {
      throw new AppError('Invalid email or password', 401);
    }

    // Find first user whose password matches
    let matchedUser = null;
    for (const candidate of userResult.rows) {
      if (!candidate.is_active) continue;
      const valid = await bcrypt.compare(password, candidate.password_hash);
      if (valid) { matchedUser = candidate; break; }
    }

    if (!matchedUser) {
      throw new AppError('Invalid email or password', 401);
    }

    const { id: userId, org_id: orgId } = matchedUser;

    // Get user roles
    const rolesResult = await query(`
      SELECT r.name, r.slug FROM wilyer_user_roles ur
      JOIN wilyer_roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
    `, [userId]);

    // Generate tokens
    const accessToken      = generateAccessToken(userId, orgId, matchedUser.email);
    const refreshToken     = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);

    await query(`
      INSERT INTO wilyer_refresh_tokens (user_id, token_hash, expires_at, ip_address, device_info)
      VALUES ($1, $2, NOW() + INTERVAL '30 days', $3, $4)
    `, [userId, refreshTokenHash, req.ip, JSON.stringify({ userAgent: req.headers['user-agent'] })]);

    await query(
      `UPDATE wilyer_users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = $1`,
      [userId]
    );

    await createAuditLog({
      orgId,
      userId,
      action:     'user.login',
      entityType: 'user',
      entityId:   userId,
      ipAddress:  req.ip,
      userAgent:  req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: {
        user: {
          id:        userId,
          email:     matchedUser.email,
          firstName: matchedUser.first_name,
          lastName:  matchedUser.last_name,
          orgId,
          roles:     rolesResult.rows,
        },
        accessToken,
        refreshToken,
      }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/refresh
 * (unchanged)
 */
const refreshToken = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw new AppError('Refresh token required', 400);

    const tokenHash = hashToken(token);

    const result = await query(`
      SELECT rt.*, u.id AS user_id, u.org_id, u.email, u.is_active
      FROM wilyer_refresh_tokens rt
      JOIN wilyer_users u ON u.id = rt.user_id
      WHERE rt.token_hash = $1
        AND rt.is_revoked = FALSE
        AND rt.expires_at > NOW()
        AND u.deleted_at IS NULL
    `, [tokenHash]);

    if (!result.rows[0]) throw new AppError('Invalid or expired refresh token', 401);

    const { user_id, org_id, email, is_active } = result.rows[0];
    if (!is_active) throw new AppError('Account deactivated', 401);

    await query(
      `UPDATE wilyer_refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash]
    );

    const newAccessToken      = generateAccessToken(user_id, org_id, email);
    const newRefreshToken     = generateRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);

    await query(`
      INSERT INTO wilyer_refresh_tokens (user_id, token_hash, expires_at, ip_address)
      VALUES ($1, $2, NOW() + INTERVAL '30 days', $3)
    `, [user_id, newRefreshTokenHash, req.ip]);

    res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken }
    });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * (unchanged)
 */
const logout = async (req, res, next) => {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      const tokenHash = hashToken(token);
      await query(
        `UPDATE wilyer_refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE token_hash = $1`,
        [tokenHash]
      );
    }
    invalidateUserCache(req.user.userId);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/forgot-password
 * ─────────────────────────────────────────────────────────────
 * Accepts: { email }
 * Always returns 200 (prevents email enumeration).
 * Sends a password-reset link via the configured email provider.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) throw new AppError('Email is required', 400);

    const userResult = await query(`
      SELECT u.id, u.first_name, u.email
      FROM wilyer_users u
      JOIN wilyer_organizations o ON o.id = u.org_id
      WHERE u.email = $1
        AND u.deleted_at IS NULL
        AND u.is_active = TRUE
        AND o.is_active = TRUE
        AND o.deleted_at IS NULL
      LIMIT 1
    `, [email.toLowerCase()]);

    // Always respond 200 regardless of whether user exists
    if (!userResult.rows[0]) {
      return res.json({
        success: true,
        message: 'If an account exists, a reset email has been sent.'
      });
    }

    const user = userResult.rows[0];

    // Generate reset token (expires in 1 hour)
    const resetToken     = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = hashToken(resetToken);
    const expiresAt      = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store token (reuse password_reset_token / password_reset_expires columns)
    await query(`
      UPDATE wilyer_users
      SET password_reset_token   = $1,
          password_reset_expires = $2,
          updated_at             = NOW()
      WHERE id = $3
    `, [resetTokenHash, expiresAt, user.id]);

    // Build reset URL
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    logger.info(`Password reset requested for: ${user.email} — URL: ${resetUrl}`);

    // ── Send email ─────────────────────────────────────────────
    // If you have nodemailer / SendGrid / Resend configured, send here.
    // For now we log the URL and skip actual sending.
    try {
      if (process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY) {
        await sendResetEmail(user, resetUrl);
      } else {
        // Dev mode: log to console
        logger.info(`[DEV] Password reset URL for ${user.email}: ${resetUrl}`);
        console.log(`\n🔑 PASSWORD RESET LINK (dev):\n${resetUrl}\n`);
      }
    } catch (emailErr) {
      logger.error('Failed to send reset email:', emailErr.message);
      // Don't expose email send failure to client
    }

    res.json({
      success: true,
      message: 'If an account exists, a reset email has been sent.',
      // Only in dev mode expose the token for testing
      ...(process.env.NODE_ENV === 'development' && { devResetUrl: resetUrl }),
    });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/reset-password
 * Accepts: { token, newPassword }
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token)       throw new AppError('Reset token is required', 400);
    if (!newPassword) throw new AppError('New password is required', 400);
    if (newPassword.length < 6) throw new AppError('Password must be at least 6 characters', 400);

    const tokenHash = hashToken(token);

    const userResult = await query(`
      SELECT id, email, org_id
      FROM wilyer_users
      WHERE password_reset_token   = $1
        AND password_reset_expires > NOW()
        AND deleted_at IS NULL
        AND is_active = TRUE
    `, [tokenHash]);

    if (!userResult.rows[0]) {
      throw new AppError('Reset link is invalid or has expired', 400);
    }

    const user         = userResult.rows[0];
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await query(`
      UPDATE wilyer_users
      SET password_hash          = $1,
          password_reset_token   = NULL,
          password_reset_expires = NULL,
          updated_at             = NOW()
      WHERE id = $2
    `, [passwordHash, user.id]);

    // Revoke all existing refresh tokens for security
    await query(
      `UPDATE wilyer_refresh_tokens SET is_revoked = TRUE, revoked_at = NOW()
       WHERE user_id = $1 AND is_revoked = FALSE`,
      [user.id]
    );

    invalidateUserCache(user.id);

    await createAuditLog({
      orgId:      user.org_id,
      userId:     user.id,
      action:     'user.password_reset',
      entityType: 'user',
      entityId:   user.id,
      ipAddress:  req.ip,
    });

    logger.info(`Password reset completed for user: ${user.email}`);

    res.json({ success: true, message: 'Password updated successfully. You can now sign in.' });

  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/device/pair
 * (unchanged)
 */
const pairDevice = async (req, res, next) => {
  try {
    const { pairingCode } = req.body;

    const result = await query(`
      SELECT id, org_id, device_name, is_paired
      FROM wilyer_screens
      WHERE pairing_code = $1 AND deleted_at IS NULL
    `, [pairingCode.toUpperCase()]);

    if (!result.rows[0]) throw new AppError('Invalid pairing code', 404);

    const screen = result.rows[0];
    if (screen.is_paired) throw new AppError('Screen already paired', 409);

    const deviceToken = jwt.sign(
      { screenId: screen.id, orgId: screen.org_id },
      process.env.DEVICE_JWT_SECRET,
      { expiresIn: '365d' }
    );

    await query(`
      UPDATE wilyer_screens
      SET is_paired = TRUE, paired_at = NOW(), pairing_code = NULL, status = 'online'
      WHERE id = $1
    `, [screen.id]);

    logger.info(`Device paired: ${screen.device_name} (${screen.id})`);

    res.json({
      success: true,
      data: {
        deviceToken,
        screen: { id: screen.id, deviceName: screen.device_name, orgId: screen.org_id }
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * (unchanged)
 */
const getMe = async (req, res, next) => {
  try {
    const userId = req.user.userId || req.user.id;

    // 1. User + org + roles
    const result = await query(`
      SELECT
        u.id, u.email, u.first_name, u.last_name, u.avatar_url,
        u.is_email_verified, u.last_login_at, u.created_at,
        u.settings,
        o.id   AS org_id,   o.name AS org_name,
        o.slug AS org_slug, o.logo_url,
        COALESCE(
          json_agg(DISTINCT jsonb_build_object('name', r.name, 'slug', r.slug))
          FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS roles
      FROM wilyer_users u
      JOIN wilyer_organizations o ON o.id = u.org_id
      LEFT JOIN wilyer_user_roles ur ON ur.user_id = u.id
      LEFT JOIN wilyer_roles r ON r.id = ur.role_id
      WHERE u.id = $1
      GROUP BY u.id, o.id
    `, [userId]);

    if (!result.rows[0]) throw new AppError('User not found', 404);

    const userData = result.rows[0];
    const orgId    = userData.org_id;
    const roles    = userData.roles || [];

    // 2. Super admin / admin bypass — they have all permissions implicitly
    const isSuperAdmin = roles.some(r => r.slug === 'super_admin');
    const isAdmin      = roles.some(r => r.slug === 'admin');

    // 3. Build effective permissions from roles + custom overrides
    let permissionRows = [];
    if (!isSuperAdmin && !isAdmin) {
      const permRes = await query(`
        SELECT DISTINCT p.slug, p.module, p.action
        FROM wilyer_user_roles ur
        JOIN wilyer_roles r ON r.id = ur.role_id
          AND (r.is_system = TRUE OR r.org_id = $2)
        JOIN wilyer_role_permissions rp ON rp.role_id = r.id
        JOIN wilyer_permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = $1
      `, [userId, orgId]);
      permissionRows = permRes.rows;

      // Merge custom_permissions stored in user.settings (set by Team page)
      const customPerms = userData.settings?.custom_permissions;
      if (Array.isArray(customPerms) && customPerms.length > 0) {
        try {
          const customRes = await query(
            `SELECT slug, module, action FROM wilyer_permissions WHERE slug = ANY($1::text[])`,
            [customPerms]
          );
          const existing = new Set(permissionRows.map(p => p.slug));
          customRes.rows.forEach(p => { if (!existing.has(p.slug)) permissionRows.push(p); });
        } catch {}
      }
    }

    // 4. Return — include permissions array so frontend hasPermission() works
    const { settings: _s, ...safeUser } = userData;  // don't expose raw settings
    res.json({
      success: true,
      data: {
        ...safeUser,
        isSuperAdmin,
        isAdmin,
        permissions: permissionRows,  // [{slug, module, action}, ...]
      }
    });
  } catch (err) {
    next(err);
  }
};


module.exports = {
  register,
  login,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
  pairDevice,
  getMe,
};