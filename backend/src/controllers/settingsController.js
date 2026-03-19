// src/controllers/settingsController.js
// ============================================================
// AEKADS — Settings Controller  (matches settings.routes.js 1-to-1)
//
//  Route                                   Function
//  ─────────────────────────────────────── ────────────────────
//  GET    /api/settings/org                getOrg
//  PATCH  /api/settings/org                updateOrg
//  GET    /api/settings/plans              getPlans
//  GET    /api/settings/subscription       getSubscription
//  POST   /api/settings/subscribe          subscribe
//  POST   /api/settings/subscription/cancel  cancelSubscription
//  POST   /api/settings/subscription/renew   renewSubscription
//  GET    /api/settings/billing-history    getBillingHistory
//  GET    /api/settings/screen-licenses    getScreenLicenses
//  POST   /api/settings/screen-licenses/:id/renew  renewScreenLicense
//  POST   /api/settings/password           changePassword
// ============================================================
'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, transaction } = require('../config/database');
const { AppError }            = require('../middlewares/errorHandler');
const { createAuditLog }      = require('../services/auditService');
const { invalidateUserCache }  = require('../middlewares/rbac');
const logger                  = require('../utils/logger');

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

/**
 * Calculate plan cost for a given billing cycle + screen count.
 * billing_model = 'flat'       → fixed price regardless of screen count
 * billing_model = 'per_screen' → base price + (per-screen price × count)
 */
const calcCost = (plan, cycle, screens = 1) => {
  const yearly = (cycle === 'yearly');

  if (plan.billing_model === 'per_screen') {
    const base = yearly ? +(plan.base_price_yearly  || 0) : +(plan.base_price_monthly  || 0);
    const per  = yearly ? +(plan.price_per_screen_yearly || 0) : +(plan.price_per_screen_monthly || 0);
    const n    = Math.max(0, +screens);
    return { base, per, screens: n, total: +(base + per * n).toFixed(2), cycle };
  }

  // flat
  const total = yearly ? +(plan.price_yearly || 0) : +(plan.price_monthly || 0);
  return { base: total, per: 0, screens: plan.max_screens, total, cycle };
};

/** Add one billing period (month or year) to a date */
const addPeriod = (date, cycle) => {
  const d = new Date(date);
  if (cycle === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else                    d.setMonth(d.getMonth() + 1);
  return d;
};

/** Generate a unique license key  e.g. LIC-ABCD-1234-EF56-7890 */
const genLicKey = () =>
  'LIC-' + crypto.randomBytes(12).toString('hex').toUpperCase().match(/.{4}/g).join('-');

// ─────────────────────────────────────────────────────────────
// GET /api/settings/org
// ─────────────────────────────────────────────────────────────
const getOrg = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const result = await query(
      `SELECT id, name, slug, logo_url, primary_color,
              contact_email, contact_phone, address, timezone,
              settings, created_at
       FROM wilyer_organizations
       WHERE id = $1 AND deleted_at IS NULL`,
      [orgId]
    );
    if (!result.rows[0]) throw new AppError('Organization not found', 404);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/settings/org
// ─────────────────────────────────────────────────────────────
const updateOrg = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { name, contactEmail, contactPhone, address, timezone, primaryColor } = req.body;

    const sets = [];
    const vals = [];
    let   idx  = 1;

    if (name         !== undefined) { sets.push(`name          = $${idx++}`); vals.push(name.trim()); }
    if (contactEmail !== undefined) { sets.push(`contact_email = $${idx++}`); vals.push(contactEmail || null); }
    if (contactPhone !== undefined) { sets.push(`contact_phone = $${idx++}`); vals.push(contactPhone || null); }
    if (address      !== undefined) { sets.push(`address       = $${idx++}`); vals.push(address      || null); }
    if (timezone     !== undefined) { sets.push(`timezone      = $${idx++}`); vals.push(timezone     || 'UTC'); }
    if (primaryColor !== undefined) { sets.push(`primary_color = $${idx++}`); vals.push(primaryColor || '#0F172A'); }

    if (sets.length === 0) return res.json({ success: true, message: 'Nothing to update' });

    sets.push(`updated_at = NOW()`);
    vals.push(orgId);

    const result = await query(
      `UPDATE wilyer_organizations SET ${sets.join(', ')}
       WHERE id = $${idx} AND deleted_at IS NULL
       RETURNING *`,
      vals
    );

    await createAuditLog({ orgId, userId, action: 'org.update', entityType: 'organization', entityId: orgId });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/settings/plans?screenCount=5
// Returns all active plans with per-screen calculated pricing
// ─────────────────────────────────────────────────────────────
const getPlans = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const screenCount = Math.max(1, parseInt(req.query.screenCount) || 1);

    // Identify the org's current plan
    const curRes = await query(
      `SELECT sp.slug, s.billing_cycle, s.screen_count, s.status
       FROM wilyer_subscriptions s
       JOIN wilyer_subscription_plans sp ON sp.id = s.plan_id
       WHERE s.org_id = $1
       ORDER BY s.created_at DESC
       LIMIT 1`,
      [orgId]
    );
    const current = curRes.rows[0];

    const plansRes = await query(
      `SELECT * FROM wilyer_subscription_plans
       WHERE is_active = TRUE
       ORDER BY display_order ASC, price_monthly ASC`
    );

    const plans = plansRes.rows.map(p => {
      const monthly = calcCost(p, 'monthly', screenCount);
      const yearly  = calcCost(p, 'yearly',  screenCount);

      // Yearly discount vs paying monthly × 12
      const yearlyDiscount = monthly.total > 0
        ? Math.max(0, Math.round((1 - yearly.total / (monthly.total * 12)) * 100))
        : 0;

      return {
        id:           p.id,
        name:         p.name,
        slug:         p.slug,
        description:  p.description,
        billingModel: p.billing_model,   // 'flat' | 'per_screen'
        isPopular:    p.is_popular,
        trialDays:    p.trial_days,
        displayOrder: p.display_order,
        // Hard limits
        maxScreens:   p.max_screens,
        maxUsers:     p.max_users,
        maxStorageGb: p.max_storage_gb,
        maxPlaylists: p.max_playlists,
        // Raw pricing columns
        priceMonthly:     +(p.price_monthly               || 0),
        priceYearly:      +(p.price_yearly                || 0),
        basePriceMonthly: +(p.base_price_monthly          || 0),
        basePriceYearly:  +(p.base_price_yearly           || 0),
        perScreenMonthly: +(p.price_per_screen_monthly    || 0),
        perScreenYearly:  +(p.price_per_screen_yearly     || 0),
        // Calculated totals for the requested screen count
        monthly,
        yearly,
        yearlyDiscount,
        // Features object — all plans include all features; limits differ
        features: p.features || {},
        // Current plan flag
        isCurrent:           current?.slug === p.slug,
        currentBillingCycle: current?.slug === p.slug ? current.billing_cycle : null,
      };
    });

    res.json({ success: true, data: plans, meta: { screenCount } });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/settings/subscription
// Full subscription + real usage stats
// ─────────────────────────────────────────────────────────────
const getSubscription = async (req, res, next) => {
  try {
    const { orgId } = req.user;

    const subRes = await query(`
      SELECT
        s.id               AS subscription_id,
        s.status,
        s.billing_cycle,
        s.screen_count,
        s.trial_ends_at,
        s.current_period_start,
        s.current_period_end,
        s.next_bill_date,
        s.auto_renew,
        s.amount_paid,
        s.cancelled_at,
        sp.id              AS plan_id,
        sp.name            AS plan_name,
        sp.slug            AS plan_slug,
        sp.billing_model,
        sp.max_screens,
        sp.max_users,
        sp.max_storage_gb,
        sp.max_playlists,
        sp.price_monthly,
        sp.price_yearly,
        sp.base_price_monthly,
        sp.base_price_yearly,
        sp.price_per_screen_monthly,
        sp.price_per_screen_yearly,
        sp.features,
        sp.description,
        sp.trial_days
      FROM wilyer_subscriptions s
      JOIN wilyer_subscription_plans sp ON sp.id = s.plan_id
      WHERE s.org_id = $1
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [orgId]);

    // Parallel usage queries
    const [screensR, usersR, playlistsR, mediaR, expiredR] = await Promise.all([
      query(`SELECT COUNT(*) FROM wilyer_screens
             WHERE org_id = $1 AND deleted_at IS NULL`, [orgId]),

      query(`SELECT COUNT(*) FROM wilyer_users
             WHERE org_id = $1 AND deleted_at IS NULL AND is_active = TRUE`, [orgId]),

      query(`SELECT COUNT(*) FROM wilyer_playlists
             WHERE org_id = $1 AND deleted_at IS NULL`, [orgId]),

      query(`SELECT COALESCE(SUM(file_size), 0)::bigint AS bytes, COUNT(*) AS files
             FROM wilyer_media_files
             WHERE org_id = $1 AND deleted_at IS NULL`, [orgId]),

      query(`SELECT COUNT(*) FROM wilyer_screens
             WHERE org_id = $1 AND deleted_at IS NULL
               AND license_expires_at IS NOT NULL
               AND license_expires_at < NOW()`, [orgId])
        .catch(() => ({ rows: [{ count: 0 }] })),
    ]);

    const sub = subRes.rows[0] || {};

    const plan = {
      id:               sub.plan_id            || null,
      name:             sub.plan_name          || 'Starter',
      slug:             sub.plan_slug          || 'starter',
      billingModel:     sub.billing_model      || 'flat',
      maxScreens:       sub.max_screens        || 5,
      maxUsers:         sub.max_users          || 3,
      maxStorageGb:     sub.max_storage_gb     || 10,
      maxPlaylists:     sub.max_playlists      || 50,
      priceMonthly:     +(sub.price_monthly               || 0),
      priceYearly:      +(sub.price_yearly                || 0),
      basePriceMonthly: +(sub.base_price_monthly          || 0),
      basePriceYearly:  +(sub.base_price_yearly           || 0),
      perScreenMonthly: +(sub.price_per_screen_monthly    || 0),
      perScreenYearly:  +(sub.price_per_screen_yearly     || 0),
      features:         sub.features || {},
      description:      sub.description || '',
    };

    const usage = {
      screensUsed:    +screensR.rows[0].count,
      usersCount:     +usersR.rows[0].count,
      playlistsCount: +playlistsR.rows[0].count,
      storageBytes:   +mediaR.rows[0].bytes,
      storageUsedGb:  +((+mediaR.rows[0].bytes / (1024 ** 3)).toFixed(3)),
      mediaFiles:     +mediaR.rows[0].files,
      expiredScreens: +expiredR.rows[0].count,
    };

    const usagePct = {
      screens:   plan.maxScreens   > 0 ? Math.min(100, Math.round(usage.screensUsed    / plan.maxScreens   * 100)) : 0,
      users:     plan.maxUsers     > 0 ? Math.min(100, Math.round(usage.usersCount     / plan.maxUsers     * 100)) : 0,
      storage:   plan.maxStorageGb > 0 ? Math.min(100, Math.round(usage.storageUsedGb / plan.maxStorageGb * 100)) : 0,
      playlists: plan.maxPlaylists > 0 ? Math.min(100, Math.round(usage.playlistsCount/ plan.maxPlaylists * 100)) : 0,
    };

    const nextBillDate  = sub.next_bill_date || sub.current_period_end || null;
    const daysUntilBill = nextBillDate
      ? Math.max(0, Math.ceil((new Date(nextBillDate) - Date.now()) / 86400000))
      : null;

    res.json({
      success: true,
      data: {
        // Subscription meta
        subscriptionId:     sub.subscription_id     || null,
        status:             sub.status              || 'trial',
        billingCycle:       sub.billing_cycle       || 'monthly',
        screenCount:        sub.screen_count        || 0,
        amountPaid:         +(sub.amount_paid       || 0),
        autoRenew:          sub.auto_renew          ?? true,
        trialEndsAt:        sub.trial_ends_at       || null,
        currentPeriodStart: sub.current_period_start || null,
        currentPeriodEnd:   sub.current_period_end   || null,
        nextBillDate,
        daysUntilBill,
        cancelledAt:        sub.cancelled_at        || null,
        // Plan details
        plan,
        // Usage
        usage,
        usagePct,
        // License summary
        licenses: {
          total:     plan.maxScreens,
          used:      usage.screensUsed,
          available: Math.max(0, plan.maxScreens - usage.screensUsed),
          expired:   usage.expiredScreens,
        },
        // Legacy flat aliases (for older components)
        plan_name:       plan.name,
        max_screens:     plan.maxScreens,
        max_users:       plan.maxUsers,
        max_storage_gb:  plan.maxStorageGb,
        max_playlists:   plan.maxPlaylists,
        screens_used:    usage.screensUsed,
        users_count:     usage.usersCount,
        storage_used_gb: usage.storageUsedGb,
        features:        plan.features,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/settings/subscribe
// Purchase or upgrade a plan
// Body: { planSlug, billingCycle, screenCount, notes? }
// ─────────────────────────────────────────────────────────────
const subscribe = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const {
      planSlug,
      billingCycle = 'monthly',
      screenCount  = 1,
      notes,
    } = req.body;

    if (!planSlug) throw new AppError('planSlug is required', 400);
    if (!['monthly', 'yearly'].includes(billingCycle))
      throw new AppError('billingCycle must be "monthly" or "yearly"', 400);

    const planRes = await query(
      `SELECT * FROM wilyer_subscription_plans WHERE slug = $1 AND is_active = TRUE`,
      [planSlug]
    );
    if (!planRes.rows[0]) throw new AppError(`Plan "${planSlug}" not found`, 404);
    const plan = planRes.rows[0];

    const count  = Math.max(1, +screenCount || 1);
    const cost   = calcCost(plan, billingCycle, count);
    const now    = new Date();
    const endsAt = addPeriod(now, billingCycle);

    let newSubId;

    await transaction(async (client) => {
      // Cancel any existing active subscriptions for this org
      await client.query(
        `UPDATE wilyer_subscriptions
         SET status = 'cancelled', cancelled_at = NOW()
         WHERE org_id = $1 AND status NOT IN ('cancelled', 'expired')`,
        [orgId]
      );

      // Create new subscription
      const subInsert = await client.query(`
        INSERT INTO wilyer_subscriptions
          (org_id, plan_id, status, billing_cycle, screen_count, amount_paid,
           current_period_start, current_period_end, next_bill_date, auto_renew, trial_ends_at)
        VALUES ($1, $2, 'active', $3, $4, $5, $6, $7, $7, TRUE, NULL)
        RETURNING id
      `, [orgId, plan.id, billingCycle, count, cost.total, now, endsAt]);

      newSubId = subInsert.rows[0].id;

      // Record payment
      await client.query(`
        INSERT INTO wilyer_subscription_payments
          (org_id, subscription_id, amount, billing_cycle, screen_count,
           plan_name, status, period_start, period_end, notes)
        VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8, $9)
      `, [orgId, newSubId, cost.total, billingCycle, count, plan.name, now, endsAt, notes || null]);

      // Issue one license record per purchased screen slot
      for (let i = 0; i < count; i++) {
        await client.query(`
          INSERT INTO wilyer_screen_licenses
            (org_id, subscription_id, license_key, status,
             starts_at, expires_at, price_paid, billing_cycle)
          VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
        `, [orgId, newSubId, genLicKey(), now, endsAt, cost.per || 0, billingCycle]);
      }
    });

    await createAuditLog({
      orgId, userId,
      action:     'subscription.purchase',
      entityType: 'subscription',
      entityId:   newSubId,
      newValues:  { planSlug, billingCycle, screenCount: count, total: cost.total },
    });

    logger.info(`[subscribe] org=${orgId} plan=${planSlug} cycle=${billingCycle} screens=${count} total=${cost.total}`);

    res.json({
      success: true,
      message: `Successfully subscribed to ${plan.name} (${billingCycle})`,
      data: {
        planName:    plan.name,
        billingCycle,
        screenCount: count,
        total:       cost.total,
        periodEnd:   endsAt,
        maxScreens:  plan.max_screens,
      },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/settings/subscription/cancel
// ─────────────────────────────────────────────────────────────
const cancelSubscription = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;
    const { reason } = req.body;

    const subRes = await query(
      `SELECT id FROM wilyer_subscriptions
       WHERE org_id = $1 AND status = 'active'
       ORDER BY created_at DESC LIMIT 1`,
      [orgId]
    );
    if (!subRes.rows[0]) throw new AppError('No active subscription found', 404);

    const subId = subRes.rows[0].id;

    await query(
      `UPDATE wilyer_subscriptions
       SET status = 'cancelled', cancelled_at = NOW(), auto_renew = FALSE
       WHERE id = $1`,
      [subId]
    );

    if (reason) {
      await query(
        `UPDATE wilyer_subscriptions
         SET settings = COALESCE(settings, '{}') || $1::jsonb
         WHERE id = $2`,
        [JSON.stringify({ cancel_reason: reason }), subId]
      );
    }

    await createAuditLog({
      orgId, userId,
      action:     'subscription.cancel',
      entityType: 'subscription',
      entityId:   subId,
      newValues:  { reason },
    });

    res.json({ success: true, message: 'Subscription cancelled. Access continues until the current period ends.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/settings/subscription/renew
// ─────────────────────────────────────────────────────────────
const renewSubscription = async (req, res, next) => {
  try {
    const { orgId, userId } = req.user;

    // Find the most recent subscription (active, expired, or cancelled)
    const subRes = await query(`
      SELECT
        s.*,
        sp.billing_model,
        sp.name            AS plan_name,
        sp.price_monthly,
        sp.price_yearly,
        sp.base_price_monthly,
        sp.base_price_yearly,
        sp.price_per_screen_monthly,
        sp.price_per_screen_yearly,
        sp.max_screens
      FROM wilyer_subscriptions s
      JOIN wilyer_subscription_plans sp ON sp.id = s.plan_id
      WHERE s.org_id = $1
        AND s.status IN ('active', 'expired', 'cancelled')
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [orgId]);

    if (!subRes.rows[0]) throw new AppError('No subscription found to renew', 404);

    const sub    = subRes.rows[0];
    const cycle  = sub.billing_cycle  || 'monthly';
    const count  = sub.screen_count   || 1;
    const cost   = calcCost(sub, cycle, count);
    const now    = new Date();
    const newEnd = addPeriod(now, cycle);

    await transaction(async (client) => {
      // Reactivate subscription
      await client.query(`
        UPDATE wilyer_subscriptions
        SET status               = 'active',
            current_period_start = $1,
            current_period_end   = $2,
            next_bill_date       = $2,
            cancelled_at         = NULL,
            amount_paid          = $3,
            updated_at           = NOW()
        WHERE id = $4
      `, [now, newEnd, cost.total, sub.id]);

      // Record renewal payment
      await client.query(`
        INSERT INTO wilyer_subscription_payments
          (org_id, subscription_id, amount, billing_cycle, screen_count,
           plan_name, status, period_start, period_end)
        VALUES ($1, $2, $3, $4, $5, $6, 'completed', $7, $8)
      `, [orgId, sub.id, cost.total, cycle, count, sub.plan_name || 'Plan', now, newEnd]);

      // Extend all screen licenses linked to this subscription
      await client.query(`
        UPDATE wilyer_screen_licenses
        SET status         = 'active',
            expires_at     = $1,
            last_renewed_at = NOW(),
            updated_at     = NOW()
        WHERE org_id = $2 AND subscription_id = $3
      `, [newEnd, orgId, sub.id]);

      // Extend expiry on all active screens in the org
      await client.query(`
        UPDATE wilyer_screens
        SET license_expires_at = $1,
            license_status     = 'active',
            updated_at         = NOW()
        WHERE org_id = $2 AND deleted_at IS NULL
      `, [newEnd, orgId]);
    });

    await createAuditLog({
      orgId, userId,
      action:     'subscription.renew',
      entityType: 'subscription',
      entityId:   sub.id,
      newValues:  { cycle, count, total: cost.total, newEnd },
    });

    res.json({
      success: true,
      message: `Subscription renewed until ${newEnd.toLocaleDateString()}`,
      data:    { newPeriodEnd: newEnd, amountCharged: cost.total },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/settings/billing-history
// ─────────────────────────────────────────────────────────────
const getBillingHistory = async (req, res, next) => {
  try {
    const { orgId } = req.user;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      query(`
        SELECT id, amount, currency, billing_cycle, screen_count,
               plan_name, status, payment_method,
               period_start, period_end, notes, created_at
        FROM wilyer_subscription_payments
        WHERE org_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [orgId, limit, offset]),

      query(`SELECT COUNT(*) FROM wilyer_subscription_payments WHERE org_id = $1`, [orgId]),
    ]);

    res.json({
      success: true,
      data:    rows.rows,
      meta:    { total: +total.rows[0].count, page, limit },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// GET /api/settings/screen-licenses
// ─────────────────────────────────────────────────────────────
const getScreenLicenses = async (req, res, next) => {
  try {
    const { orgId } = req.user;

    const result = await query(`
      SELECT
        sl.id,
        sl.license_key,
        sl.status,
        sl.starts_at,
        sl.expires_at,
        sl.last_renewed_at,
        sl.auto_renew,
        sl.price_paid,
        sl.billing_cycle,
        sl.created_at,
        sl.screen_id,
        s.device_name,
        s.location,
        s.status   AS screen_status,
        s.last_seen
      FROM wilyer_screen_licenses sl
      LEFT JOIN wilyer_screens s ON s.id = sl.screen_id
      WHERE sl.org_id = $1
      ORDER BY sl.expires_at ASC NULLS LAST
    `, [orgId]);

    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/settings/screen-licenses/:id/renew
// Body: { billingCycle? }  (defaults to the license's own cycle)
// ─────────────────────────────────────────────────────────────
const renewScreenLicense = async (req, res, next) => {
  try {
    const { id }    = req.params;
    const { orgId } = req.user;
    const { billingCycle } = req.body;

    // Fetch license + plan pricing
    const licRes = await query(`
      SELECT
        sl.*,
        sp.price_per_screen_monthly,
        sp.price_per_screen_yearly
      FROM wilyer_screen_licenses sl
      JOIN wilyer_subscriptions s     ON s.id  = sl.subscription_id
      JOIN wilyer_subscription_plans sp ON sp.id = s.plan_id
      WHERE sl.id = $1 AND sl.org_id = $2
    `, [id, orgId]);

    if (!licRes.rows[0]) throw new AppError('License not found', 404);

    const lic   = licRes.rows[0];
    const cycle = billingCycle || lic.billing_cycle || 'monthly';
    const price = cycle === 'yearly'
      ? +(lic.price_per_screen_yearly  || 0)
      : +(lic.price_per_screen_monthly || 0);

    const newExpiry = addPeriod(new Date(), cycle);

    // Update the license record
    await query(`
      UPDATE wilyer_screen_licenses
      SET status          = 'active',
          expires_at      = $1,
          last_renewed_at = NOW(),
          billing_cycle   = $2,
          price_paid      = $3,
          updated_at      = NOW()
      WHERE id = $4 AND org_id = $5
    `, [newExpiry, cycle, price, id, orgId]);

    // Also push expiry to the physical screen row
    if (lic.screen_id) {
      await query(`
        UPDATE wilyer_screens
        SET license_expires_at = $1,
            license_status     = 'active',
            updated_at         = NOW()
        WHERE id = $2
      `, [newExpiry, lic.screen_id]);
    }

    res.json({
      success: true,
      message: `License renewed until ${newExpiry.toLocaleDateString()}`,
      data:    { licenseId: id, newExpiry, amountCharged: price },
    });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// POST /api/settings/password
// Body: { currentPassword, newPassword }
// ─────────────────────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { userId, orgId } = req.user;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword)
      throw new AppError('currentPassword and newPassword are required', 400);
    if (newPassword.length < 8)
      throw new AppError('New password must be at least 8 characters', 400);

    const userRes = await query(
      `SELECT password_hash FROM wilyer_users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (!userRes.rows[0]) throw new AppError('User not found', 404);

    const valid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!valid) throw new AppError('Current password is incorrect', 401);

    const newHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await query(
      `UPDATE wilyer_users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, userId]
    );

    // Revoke all existing refresh tokens for security
    await query(
      `UPDATE wilyer_refresh_tokens
       SET is_revoked = TRUE, revoked_at = NOW()
       WHERE user_id = $1 AND is_revoked = FALSE`,
      [userId]
    );

    invalidateUserCache(userId);

    await createAuditLog({
      orgId, userId,
      action:     'user.password_change',
      entityType: 'user',
      entityId:   userId,
      ipAddress:  req.ip,
    });

    res.json({ success: true, message: 'Password updated. Please sign in again.' });
  } catch (err) { next(err); }
};

// ─────────────────────────────────────────────────────────────
// Exports — must match every ctrl.* call in settings.routes.js
// ─────────────────────────────────────────────────────────────
module.exports = {
  // Organization
  getOrg,
  updateOrg,
  // Plans
  getPlans,
  // Subscription
  getSubscription,
  subscribe,
  cancelSubscription,
  renewSubscription,
  // Billing
  getBillingHistory,
  // Screen licenses
  getScreenLicenses,
  renewScreenLicense,
  // Security
  changePassword,
};