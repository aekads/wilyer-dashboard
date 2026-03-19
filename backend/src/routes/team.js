// src/routes/team.js
// ============================================================
// AEKADS Team Management Routes
// ============================================================
const express = require('express');
const router = express.Router();

const {
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
} = require('../controllers/teamController');

const { authenticate }                             = require('../middlewares/auth');
const { requirePermission, requireOrgAccess }      = require('../middlewares/rbac');
const validate                                     = require('../middlewares/validate');
const { addMemberSchema, updateMemberSchema, updatePermissionsSchema } = require('../validations/teamValidation');

// All team routes require authentication + org context
router.use(authenticate, requireOrgAccess);

// ── Stats ──────────────────────────────────────────────────────
router.get('/stats',
  requirePermission('team', 'read'),
  getTeamStats
);

// ── Roles & Permissions ────────────────────────────────────────
router.get('/roles',
  requirePermission('team', 'read'),
  getRoles
);

router.get('/permissions',
  requirePermission('team', 'read'),
  getRolePermissionMatrix   // ?roleSlug=manager
);

// ── Activity Logs ──────────────────────────────────────────────
router.get('/logs',
  requirePermission('team', 'read'),
  getActivityLogs
);

// ── Members CRUD ───────────────────────────────────────────────
router.get('/members',
  requirePermission('team', 'read'),
  getMembers
);

router.post('/members',
  requirePermission('team', 'create'),
  validate(addMemberSchema),
  addMember
);

router.get('/members/:id',
  requirePermission('team', 'read'),
  getMember
);

router.patch('/members/:id',
  requirePermission('team', 'update'),
  validate(updateMemberSchema),
  updateMember
);

router.patch('/members/:id/permissions',
  requirePermission('team', 'update'),
  validate(updatePermissionsSchema),
  updateMemberPermissions
);

router.delete('/members/:id',
  requirePermission('team', 'delete'),
  removeMember
);

module.exports = router;
