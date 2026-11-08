const bcrypt = require('bcryptjs');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { User, EmailVerificationCode, Ngo } = require('../models');
const { sendVerificationCode } = require('../services/email');

const allowedSignupRoles = ['admin', 'ngo', 'campManager', 'affectedPerson'];
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const codeLifetimeMs = 10 * 60 * 1000;

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    const error = new Error('Authentication is not configured. Set JWT_SECRET.');
    error.status = 503;
    throw error;
  }

  return jwt.sign(
    { id: user.id, sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
  };
}

async function issueVerificationCode(user) {
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = await bcrypt.hash(code, 10);
  await EmailVerificationCode.findOneAndUpdate(
    { userId: user._id },
    { userId: user._id, codeHash, expiresAt: new Date(Date.now() + codeLifetimeMs), attempts: 0 },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  await sendVerificationCode(user.email, code);
  return code;
}

function isDevModeWithoutSmtp() {
  const { SMTP_HOST, SMTP_USER } = process.env;
  return !SMTP_HOST || SMTP_HOST === 'smtp.example.com' || SMTP_USER === 'your-smtp-username';
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const signup = asyncHandler(async (req, res) => {
  const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const role = req.body.role;
  const organizationName =
    typeof req.body.organizationName === 'string' ? req.body.organizationName.trim() : '';

  if (!fullName || fullName.length > 100 || !emailPattern.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Enter a valid name and email address.' });
  }
  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
  }
  if (!allowedSignupRoles.includes(role)) {
    return res.status(400).json({ error: 'Choose a valid account type.' });
  }
  if (role === 'ngo' && !organizationName) {
    return res.status(400).json({ error: 'Enter your organization name.' });
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    if (!existingUser.isEmailVerified) {
      existingUser.fullName = fullName;
      existingUser.role = role;
      existingUser.passwordHash = await bcrypt.hash(password, 12);
      await existingUser.save();
      const code = await issueVerificationCode(existingUser);
      return res.status(200).json({
        message: isDevModeWithoutSmtp()
          ? `Account exists but unverified. Dev code: ${code}`
          : 'Account exists but is unverified. A new verification code was sent to your email.',
        email,
      });
    }
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    fullName,
    email,
    passwordHash,
    role,
    accountStatus: 'pending',
    isEmailVerified: false,
  });
  if (role === 'ngo') {
    try {
      await Ngo.create({
        userId: user._id,
        organizationName,
        approvalStatus: 'pending',
      });
    } catch (error) {
      await User.deleteOne({ _id: user._id });
      throw error;
    }
  }

  let code;
  try {
    code = await issueVerificationCode(user);
  } catch (error) {
    error.accountCreated = true;
    throw error;
  }
  return res.status(201).json({
    message: isDevModeWithoutSmtp()
      ? `Dev code: ${code} (SMTP is in local dev mode)`
      : 'We sent a verification code to your email address.',
    email,
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
  if (!emailPattern.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: 'Enter a valid email address and six-digit code.' });
  }

  const user = await User.findOne({ email });
  if (!user || user.isEmailVerified) {
    return res.status(400).json({ error: 'The verification code is invalid or expired.' });
  }

  const verification = await EmailVerificationCode.findOneAndUpdate(
    { userId: user._id, expiresAt: { $gt: new Date() }, attempts: { $lt: 5 } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  );
  if (!verification || !(await bcrypt.compare(code, verification.codeHash))) {
    return res.status(400).json({ error: 'The verification code is invalid or expired.' });
  }

  user.isEmailVerified = true;
  if (user.role !== 'ngo' && user.accountStatus === 'pending') {
    user.accountStatus = 'active';
  }
  await user.save();
  await EmailVerificationCode.deleteOne({ _id: verification._id });
  return res.json({ message: 'Email verified. You can now log in.' });
});

const resendVerification = asyncHandler(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!emailPattern.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address.' });
  }

  const user = await User.findOne({ email });
  let code;
  if (user && !user.isEmailVerified) {
    code = await issueVerificationCode(user);
  }
  return res.json({
    message: isDevModeWithoutSmtp() && code
      ? `Dev code: ${code}`
      : 'If that account needs verification, a new code has been sent.',
  });
});

const login = asyncHandler(async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!emailPattern.test(email) || !password) {
    return res.status(400).json({ error: 'Enter a valid email address and password.' });
  }

  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  if (!user.isEmailVerified) {
    return res.status(403).json({
      error: 'Verify your email before logging in.',
      needsVerification: true,
      email: user.email,
    });
  }
  if (user.role === 'ngo' && user.accountStatus === 'pending') {
    return res.status(403).json({ error: 'Your account is waiting for admin approval.' });
  }
  if (['suspended', 'rejected'].includes(user.accountStatus)) {
    return res.status(403).json({ error: 'This account cannot sign in. Contact an administrator.' });
  }

  return res.json({ token: createToken(user), user: publicUser(user) });
});

module.exports = { signup, verifyEmail, resendVerification, login };

