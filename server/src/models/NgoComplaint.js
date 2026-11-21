const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    campId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', required: true },
    ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ngo', required: true },
    category: {
      type: String,
      enum: ['food', 'water', 'medicine', 'shelter', 'sanitation', 'other'],
      required: true,
    },
    subject: { type: String, trim: true, required: true, maxlength: 150 },
    details: { type: String, trim: true, required: true, maxlength: 2000 },
    status: { type: String, enum: ['pending', 'in_progress', 'resolved'], default: 'pending' },
  },
  { timestamps: true }
);

schema.index({ managerId: 1, createdAt: -1 });
schema.index({ ngoId: 1, createdAt: -1 });

module.exports = mongoose.model('NgoComplaint', schema);
