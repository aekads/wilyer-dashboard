// src/routes/screens.js
const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/screenController')
const { authenticate, authenticateDevice } = require('../middlewares/auth')
const { requirePermission, requireOrgAccess } = require('../middlewares/rbac')

// ── Device routes — NO JWT (device not yet registered) ────────────
router.post('/device/generate-code', ctrl.generateDeviceCode)
router.get('/device/check-pair',     ctrl.checkPairingStatus)

// ── Device routes — device token auth ─────────────────────────────
router.post('/device/heartbeat', authenticateDevice, ctrl.heartbeat)
router.get('/device/content',    authenticateDevice, ctrl.getDeviceContent)

// ── Admin routes — JWT required ────────────────────────────────────
router.use(authenticate, requireOrgAccess)

router.get('/health', requirePermission('screens', 'read'), ctrl.getScreensHealth)

// Admin enters APK code to pair a device → creates screen record
router.post('/pair', requirePermission('screens', 'create'), ctrl.pairScreen)

// ── CRUD ───────────────────────────────────────────────────────────
router.get('/',     requirePermission('screens', 'read'),   ctrl.getScreens)
router.get('/:id',  requirePermission('screens', 'read'),   ctrl.getScreen)
router.patch('/:id', requirePermission('screens', 'update'), ctrl.updateScreen)

// Soft delete (sets deleted_at) — existing behaviour unchanged
router.delete('/:id', requirePermission('screens', 'delete'), ctrl.deleteScreen)

// Restore soft-deleted screen — NEW
router.patch('/:id/restore', requirePermission('screens', 'update'), ctrl.restoreScreen)

// Force re-push content
router.post('/:id/sync',   requirePermission('screens', 'update'), ctrl.syncScreen)

// Rotate AES encryption key
router.post('/:id/rotate-key', requirePermission('screens', 'update'), ctrl.rotateDeviceKey)

// Assign playlist — STEP 5
router.post('/:id/assign-playlist', requirePermission('screens', 'update'), ctrl.assignPlaylist)

router.post('/:id/unassign-playlist', requirePermission('screens', 'update'), ctrl.unassignPlaylist)

module.exports = router