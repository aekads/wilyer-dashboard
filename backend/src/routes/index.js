// src/routes/index.js
const express = require('express');
const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/screens', require('./screens'));
router.use('/media', require('./media'));
router.use('/playlists', require('./playlists'));
router.use('/Widgets', require('./Widget'))
// router.use('/schedules', require('./schedules'));
// router.use('/analytics', require('./analytics'));
// router.use('/users', require('./users'));
router.use('/settings', require('./Settings'));     
router.use('/team', require('./team'))

module.exports = router;
  