// src/routes/playlists.js
const express = require('express')
const router  = express.Router()
const ctrl    = require('../controllers/playlistController')
const { authenticate }                      = require('../middlewares/auth')
const { requirePermission, requireOrgAccess } = require('../middlewares/rbac')

router.use(authenticate, requireOrgAccess)

router.get('/',     requirePermission('playlists', 'read'),   ctrl.getPlaylists)
router.post('/',    requirePermission('playlists', 'create'), ctrl.createPlaylist)
router.get('/:id',  requirePermission('playlists', 'read'),   ctrl.getPlaylist)

// ── NEW: PATCH replaces PUT for partial metadata updates (name, layouts, etc.)
router.patch('/:id', requirePermission('playlists', 'update'), ctrl.updatePlaylist)

router.put('/:id/items',    requirePermission('playlists', 'update'),  ctrl.updatePlaylistItems)
router.post('/:id/publish', ctrl.publishPlaylist)
router.get('/:id/preview',  requirePermission('playlists', 'read'),    ctrl.previewPlaylist)
router.get('/:id/versions', requirePermission('playlists', 'read'),    ctrl.getVersionHistory)
router.delete('/:id',       requirePermission('playlists', 'delete'),  ctrl.deletePlaylist)

module.exports = router