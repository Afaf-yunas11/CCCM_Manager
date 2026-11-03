const mongoose = require('mongoose');
const schema = new mongoose.Schema(
  {
    disasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disaster', required: true },
    ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ngo', required: true },
    workAreas: [String],
    plannedActivities: [String],
    resourcesOffered: [{ type: { type: String }, quantity: Number }],
    status: {
      type: String,
      enum: ['committed', 'active', 'withdrawn', 'completed'],
      default: 'committed',
    },
  },
  { timestamps: { createdAt: 'committedAt', updatedAt: 'updatedAt' } }
);

// one NGO cannot commit twice to the same disaster
schema.index({ disasterId: 1, ngoId: 1 }, { unique: true });

module.exports = mongoose.model('DisasterCommitment', schema);
