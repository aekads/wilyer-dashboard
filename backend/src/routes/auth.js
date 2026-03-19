// src/routes/auth.js
const express = require('express');
const router = express.Router();
const { register, login, refreshToken, logout, pairDevice, getMe } = require('../controllers/authController');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { registerSchema, loginSchema } = require('../validations/authValidation');

router.post('/register', validate(registerSchema), register);
router.post('/login', validate(loginSchema), login);
router.post('/refresh', refreshToken);
router.post('/logout', authenticate, logout);
router.post('/device/pair', pairDevice);
router.get('/me', authenticate, getMe);

module.exports = router;
