const mongoose = require('mongoose');

const siteAssessmentSchema = new mongoose.Schema(
  {
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    disasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Disaster' }, // optional
    location: { name: String, lat: Number, lng: Number },
    polygon: [{ _id: false, lat: Number, lng: Number }], // drawn site boundary (optional)
    areaSource: { type: String, enum: ['drawn', 'manual'] },

    // fields the camp manager fills in (names match guidelines.js assessSite input)
    input: {
      population: { type: Number, required: true },
      availableAreaM2: { type: Number, required: true },
      slopePercent: Number,
      allSeasonRoad: Boolean,
      waterSourceNearby: Boolean,
      floodRiskManager: { type: String, enum: ['low', 'medium', 'high'] }, // undefined = not confirmed
      landslideRisk: Boolean, // undefined = not confirmed
      malariaProne: Boolean, // undefined = not confirmed
      titleClear: Boolean,
    },

    // from map APIs: ALL values are indicative only
    apiData: {
      riverDistanceM: Number,
      elevationM: Number,
      nearestHospitalKm: Number,
      floodDischarge: Number,
      slopePercentEstimate: Number,
      waterPointsCount: Number,
      nearestWaterPointM: Number,
      roadDistanceM: Number,
      mainRoadDistanceM: Number,
      notes: [String], // e.g. which API failed
      fetchedAt: Date,
    },

    result: { type: String, enum: ['suitable', 'needs_review', 'not_suitable'], required: true },
    fails: [String], // messages with NDMA page refs
    warns: [String],
    requirements: mongoose.Schema.Types.Mixed, // output of calculateRequirements()
    llmReport: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SiteAssessment', siteAssessmentSchema);
