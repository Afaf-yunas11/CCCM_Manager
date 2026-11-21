const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    campId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', required: false },
    type: {
      type: String,
      enum: ['request', 'complaint'],
      default: 'request',
    },
    title: { type: String, trim: true },
    category: {
      type: String,
      enum: ['food', 'water', 'medicine', 'shelter', 'sanitation', 'problem', 'protection', 'other'],
      required: true,
    },
    details: { type: String, required: true, maxlength: 2000 },
    location: { type: String, trim: true, default: '' },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },

    // true for protection concerns: query must hide these from NGOs on the server
    isRestricted: { type: Boolean, default: false },

    // filled by the LLM / analysis; stays empty if not run
    aiUrgency: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    aiCategory: String,

    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved', 'rejected'],
      default: 'pending',
    },
    adminNotes: { type: String, default: '' },
    resolutionDetails: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

// protection complaints are always restricted
requestSchema.pre('validate', function (next) {
  if (this.category === 'protection') {
    this.isRestricted = true;
    this.type = 'complaint';
  }
  if (this.category === 'problem') {
    this.type = 'complaint';
  }
  if (typeof next === 'function') next();
});

requestSchema.index({ campId: 1, status: 1 });
requestSchema.index({ type: 1, status: 1 });
requestSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Request', requestSchema);
