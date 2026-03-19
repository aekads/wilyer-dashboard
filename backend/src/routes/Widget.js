// src/routes/widgets.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/Widgetcontroller');
const { authenticate }                          = require('../middlewares/auth');
const { requirePermission, requireOrgAccess }   = require('../middlewares/rbac');
const { authenticateDevice }                    = require('../middlewares/auth');

// ── Device / player route (no JWT) ───────────────────────────
// APK calls this to get widget config for rendering
router.get('/:id/render', authenticateDevice, ctrl.renderWidget);

// ── All admin routes require JWT ─────────────────────────────
router.use(authenticate, requireOrgAccess);

// Static / metadata (must come BEFORE :id routes)
router.get('/types',           ctrl.getWidgetTypes);
router.get('/stats',           requirePermission('media', 'read'),   ctrl.getWidgetStats);
router.get('/defaults/:type',  requirePermission('media', 'read'),   ctrl.getWidgetDefaults);

// CRUD
router.get('/',                requirePermission('media', 'read'),   ctrl.getWidgets);
router.post('/',               requirePermission('media', 'create'), ctrl.createWidget);

router.get('/:id',             requirePermission('media', 'read'),   ctrl.getWidget);
router.patch('/:id',           requirePermission('media', 'update'), ctrl.updateWidget);
router.delete('/:id',          requirePermission('media', 'delete'), ctrl.deleteWidget);
router.post('/:id/duplicate',  requirePermission('media', 'create'), ctrl.duplicateWidget);
router.post('/:id/approve',    requirePermission('media', 'update'), ctrl.approveWidget);

module.exports = router;                                                                  