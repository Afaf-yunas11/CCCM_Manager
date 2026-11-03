const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    codeHash: { type: String, required: true }, // bcrypt hash of the 6-digit code
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 }, // block after 5 in your controller
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// TTL index: MongoDB deletes the document when expiresAt passes
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('EmailVerificationCode', schema);
