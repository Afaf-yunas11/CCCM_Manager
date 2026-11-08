const express = require('express');
const { signup, verifyEmail, resendVerification, login } = require('../controllers/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/login', login);

module.exports = router;

