// src/routes/settings.js
// ============================================================
// AEKADS — Settings Routes
//
//  Method  Path                                  Controller fn        Permission required
//  ─────── ───────────────────────────────────── ──────────────────── ────────────────────
//  GET     /api/settings/org                     getOrg               settings:read
//  PATCH   /api/settings/org                     updateOrg            settings:update
//  GET     /api/settings/plans                   getPlans             (authenticated)
//  GET     /api/settings/subscription            getSubscription      (authenticated)
//  POST    /api/settings/subscribe               subscribe            settings:update
//  POST    /api/settings/subscription/cancel     cancelSubscription   settings:update
//  POST    /api/settings/subscription/renew      renewSubscription    settings:update
//  GET     /api/settings/billing-history         getBillingHistory    (authenticated)
//  GET     /api/settings/screen-licenses         getScreenLicenses    (authenticated)
//  POST    /api/settings/screen-licenses/:id/renew  renewScreenLicense  settings:update
//  POST    /api/settings/password                changePassword       (authenticated)
// ============================================================
'use strict';

const express = require('express');
const router  = express.Router();

const {
  getOrg,
  updateOrg,
  getPlans,
  getSubscription,
  subscribe,
  cancelSubscription,
  renewSubscription,
  getBillingHistory,
  getScreenLicenses,
  renewScreenLicense,
  changePassword,
} = require('../controllers/SettingsController');

const { authenticate }                        = require('../middlewares/auth');
const { requirePermission, requireOrgAccess } = require('../middlewares/rbac');

// Every settings route requires a valid JWT + active org
router.use(authenticate, requireOrgAccess);

// ── Organization ──────────────────────────────────────────────────────────────
router.get  ('/org',  requirePermission('settings', 'read'),   getOrg);
router.patch('/org',  requirePermission('settings', 'update'), updateOrg);

// ── Plans ─────────────────────────────────────────────────────────────────────
// ?screenCount=N  → returns pricing calculated for N screens
router.get('/plans', getPlans);

// ── Subscription ──────────────────────────────────────────────────────────────
router.get ('/subscription',          getSubscription);
router.post('/subscribe',             requirePermission('settings', 'update'), subscribe);
router.post('/subscription/cancel',   requirePermission('settings', 'update'), cancelSubscription);
router.post('/subscription/renew',    requirePermission('settings', 'update'), renewSubscription);

// ── Billing history ───────────────────────────────────────────────────────────
// ?page=1&limit=20
router.get('/billing-history', getBillingHistory);

// ── Screen licenses ───────────────────────────────────────────────────────────
router.get ('/screen-licenses',             getScreenLicenses);
router.post('/screen-licenses/:id/renew',   requirePermission('settings', 'update'), renewScreenLicense);

// ── Security ──────────────────────────────────────────────────────────────────
router.post('/password', changePassword);

module.exports = router;