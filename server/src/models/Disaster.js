const mongoose = require('mongoose');

const disasterSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, default: 'other' }, // flood, earthquake, etc.
    description: { type: String, default: '' },
    location: {
      city: String,
      district: String,
      province: String,
      lat: Number,
      lng: Number,
    },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    affectedPopulation: { type: Number, default: 0 },
    startDate: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'underControl', 'closed'], default: 'active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // admin
  },
  { timestamps: true }
);

module.exports = mongoose.model('Disaster', disasterSchema);
