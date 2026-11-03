const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    campId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', required: true },
    category: {
      type: String,
      enum: ['food', 'water', 'medicine', 'shelter', 'problem', 'protection'],
      required: true,
    },
    details: { type: String, required: true, maxlength: 2000 },

    // true for protection concerns: query must hide these from NGOs on the server
    isRestricted: { type: Boolean, default: false },

    // filled by the LLM; stay empty if the LLM call fails
    aiUrgency: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    aiCategory: String,

    status: { type: String, enum: ['pending', 'in_progress', 'resolved'], default: 'pending' },
  },
  { timestamps: true }
);

// protection complaints are always restricted
requestSchema.pre('validate', function (next) {
  if (this.category === 'protection') this.isRestricted = true;
  next();
});

requestSchema.index({ campId: 1, status: 1 });

module.exports = mongoose.model('Request', requestSchema);
