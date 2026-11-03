const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false }, // hidden by default
    role: {
      type: String,
      enum: ['admin', 'ngo', 'campManager', 'affectedPerson'],
      required: true,
    },
    isEmailVerified: { type: Boolean, default: false },
    // ngo starts 'pending' until admin approves; others become 'active' after email verification
    accountStatus: {
      type: String,
      enum: ['pending', 'active', 'suspended', 'rejected'],
      default: 'pending',
    },
  },
  { timestamps: true } // adds createdAt, updatedAt
);

module.exports = mongoose.model('User', userSchema);
