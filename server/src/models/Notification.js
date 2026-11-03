const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Request', required: true },
    ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ngo', required: true },
    status: { type: String, enum: ['sent', 'failed'], required: true },
    error: String,
  },
  { timestamps: { createdAt: 'sentAt', updatedAt: false } }
);

module.exports = mongoose.model('Notification', schema);
