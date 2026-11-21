const express = require('express');
const { signup, verifyEmail, resendVerification, login, getCurrentUser } = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', signup);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/login', login);
router.get('/me', requireAuth, getCurrentUser);

module.exports = router;

