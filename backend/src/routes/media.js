// src/routes/media.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mediaController');
const { authenticate } = require('../middlewares/auth');
const { requirePermission, requireOrgAccess } = require('../middlewares/rbac');
const { upload } = require('../config/cloudinary');

// Multer upload middleware factory (org-scoped)
const uploadMiddleware = (req, res, next) => {
  const orgId = req.user?.orgId;
  upload(orgId).single('file')(req, res, next);
};

router.use(authenticate, requireOrgAccess);

// Folder routes
router.get('/folders', requirePermission('media', 'read'), ctrl.getFolders);
router.post('/folders', requirePermission('media', 'create'), ctrl.createFolder);
router.get('/folders/:id', requirePermission('media', 'read'), ctrl.getFolder);
router.patch('/folders/:id', requirePermission('media', 'update'), ctrl.updateFolder);
router.delete('/folders/:id', requirePermission('media', 'delete'), ctrl.deleteFolder);

// File move route
router.post('/move', requirePermission('media', 'update'), ctrl.moveFiles);

// Storage stats
router.get('/storage-stats', requirePermission('media', 'read'), ctrl.getStorageStats);

// Media file routes
router.get('/', requirePermission('media', 'read'), ctrl.getMedia);
router.post('/upload', requirePermission('media', 'create'), uploadMiddleware, ctrl.uploadMedia);
router.get('/:id', requirePermission('media', 'read'), ctrl.getMediaFile);
router.patch('/:id', requirePermission('media', 'update'), ctrl.updateMedia);
router.delete('/:id', requirePermission('media', 'delete'), ctrl.deleteMedia);

module.exports = router;