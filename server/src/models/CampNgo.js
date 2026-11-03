const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    campId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', required: true },
    ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ngo', required: true },
    focus: { type: String, default: '' }, // e.g. Water
  },
  { timestamps: { createdAt: 'joinedAt', updatedAt: false } }
);

schema.index({ campId: 1, ngoId: 1 }, { unique: true });

module.exports = mongoose.model('CampNgo', schema);
