const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Invalid or missing token' });
    }
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({ message: 'Invalid or missing token' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.sub;
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({ message: 'Email not verified' });
    }
    if (user.accountStatus !== 'active') {
      return res.status(403).json({ message: `Account is ${user.accountStatus}` });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or missing token' });
  }
};

exports.requireRole = (...roles) => (req, res, next) =>
  req.user && roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: 'Forbidden' });

