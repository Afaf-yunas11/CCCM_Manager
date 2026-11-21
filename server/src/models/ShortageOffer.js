const mongoose = require('mongoose');

const schema = new mongoose.Schema(
  {
    campId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', required: true },
    ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ngo', required: true },
    resource: { type: String, enum: ['water', 'food', 'medicine', 'shelter', 'sanitation', 'other'], required: true },
    message: { type: String, default: '' },
    status: { type: String, enum: ['offered', 'accepted', 'declined'], default: 'offered' },
  },
  { timestamps: true }
);

schema.index({ campId: 1, ngoId: 1, resource: 1 }, { unique: true });

module.exports = mongoose.model('ShortageOffer', schema);
