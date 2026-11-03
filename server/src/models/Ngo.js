const mongoose = require('mongoose');

const ngoSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    organizationName: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    contactNumber: { type: String, default: '' },
    operatingAreas: [{ type: String, trim: true }], // used to match complaint emails
    services: [{ type: String, enum: ['food', 'water', 'medicine', 'shelter', 'sanitation', 'other'] }],
    approvalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // admin
  },
  { timestamps: true }
);

module.exports = mongoose.model('Ngo', ngoSchema);
