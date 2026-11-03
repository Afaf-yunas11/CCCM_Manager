const mongoose = require('mongoose');

const campSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    disasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disaster' },
    siteAssessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SiteAssessment' },
    location: { name: String, lat: Number, lng: Number },
    capacity: { type: Number, required: true },
    population: { type: Number, default: 0 },
    facilities: [String],

    // shortage levels shown to all NGOs
    resources: [
      {
        name: { type: String, enum: ['water', 'food', 'medicine', 'shelter'], required: true },
        level: { type: String, enum: ['sufficient', 'low', 'critical'], default: 'sufficient' },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    plannedClosureDate: { type: Date },
    // camps never close automatically: closureDue is only a flag for the manager
    status: { type: String, enum: ['active', 'closureDue', 'extended', 'closed'], default: 'active' },
    closedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Camp', campSchema);
