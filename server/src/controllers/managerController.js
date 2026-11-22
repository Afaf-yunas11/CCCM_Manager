// server/src/controllers/managerController.js
const mongoose = require('mongoose');
const { Disaster, SiteAssessment, Camp, Request, ShortageOffer, Notification, NgoComplaint } = require('../models');
const { sanitize, escapeHtml } = require('../utils/sanitize');
const { calculateRequirements, assessSite } = require('../config/guidelines');
const { fetchSiteData } = require('../services/siteApis');
const { generateReport, formatReport } = require('../services/llmReport');
const { polygonAreaM2 } = require('../utils/geo');

const validCoords = (lat, lng) =>
  typeof lat === 'number' && typeof lng === 'number' && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
const toBool = (v) => (v === true || v === 'true' ? true : v === false || v === 'false' ? false : undefined);

// GET /api/manager/disasters : active disasters to attach an assessment to
async function listActiveDisasters(req, res) {
  const disasters = await Disaster.find({ status: 'active' }).select('title type location severity').sort({ createdAt: -1 });
  res.json(disasters);
}

// POST /api/manager/calculator { population, familySize? }
async function calculator(req, res) {
  const population = Number(req.body.population);
  const familySize = req.body.familySize ? Number(req.body.familySize) : undefined;
  if (!Number.isInteger(population) || population < 1 || population > 100000)
    return res.status(400).json({ message: 'Population must be a whole number between 1 and 100,000.' });
  if (familySize !== undefined && (!Number.isInteger(familySize) || familySize < 1 || familySize > 30))
    return res.status(400).json({ message: 'Family size must be between 1 and 30.' });
  res.json(calculateRequirements(population, familySize));
}

// POST /api/manager/site-data { lat, lng } : preview of API data for the map pin
async function siteData(req, res) {
  const { lat, lng } = req.body;
  if (!validCoords(lat, lng)) return res.status(400).json({ message: 'Valid lat and lng are required.' });
  res.json(await fetchSiteData(lat, lng));
}

// POST /api/manager/assessments { disasterId?, location:{name,lat,lng}, polygon?:[{lat,lng}], input:{...} }
async function createAssessment(req, res) {
  const { disasterId, location = {}, input = {}, polygon } = req.body;
  if (!validCoords(location.lat, location.lng)) return res.status(400).json({ message: 'Pick a location on the map first.' });

  const population = Number(input.population);
  if (!Number.isInteger(population) || population < 1) return res.status(400).json({ message: 'Population must be a whole number of at least 1.' });
  if (disasterId && !mongoose.isValidObjectId(disasterId)) return res.status(400).json({ message: 'Invalid disaster.' });

  // Optional drawn boundary. The server recomputes the area itself.
  let drawn = [];
  if (Array.isArray(polygon) && polygon.length >= 3) {
    if (polygon.length > 50 || !polygon.every((p) => validCoords(p?.lat, p?.lng))) return res.status(400).json({ message: 'Invalid site boundary.' });
    drawn = polygon.map((p) => ({ lat: p.lat, lng: p.lng }));
  }
  const drawnArea = drawn.length ? polygonAreaM2(drawn) : 0;
  const typedArea = Number(input.availableAreaM2);
  const availableAreaM2 = typedArea > 0 ? typedArea : drawnArea; // a typed value overrides the drawn one
  if (!(availableAreaM2 > 0)) return res.status(400).json({ message: 'Draw the site boundary or enter the available area (m2).' });
  const areaSource = drawnArea && Math.abs(availableAreaM2 - drawnArea) <= drawnArea * 0.01 ? 'drawn' : 'manual';

  // Fetched on the server so the client cannot fake API values.
  const apiData = await fetchSiteData(location.lat, location.lng);

  const manualSlope = input.slopePercent === '' || input.slopePercent == null ? undefined : Number(input.slopePercent);
  const cleanInput = {
    population,
    availableAreaM2,
    slopePercent: Number.isFinite(manualSlope) ? manualSlope : apiData.slopePercentEstimate, // manual wins
    allSeasonRoad: toBool(input.allSeasonRoad),       // undefined = "not sure"
    waterSourceNearby: toBool(input.waterSourceNearby),
    floodRiskManager: ['low', 'medium', 'high'].includes(input.floodRiskManager) ? input.floodRiskManager : undefined,
    landslideRisk: toBool(input.landslideRisk),
    malariaProne: toBool(input.malariaProne),
    titleClear: toBool(input.titleClear),
  };

  const assessment = assessSite({ ...cleanInput, riverDistanceM: apiData.riverDistanceM });
  const llmReport = await generateReport(cleanInput, assessment, apiData);

  const doc = await SiteAssessment.create({
    managerId: req.user._id,
    disasterId: disasterId || undefined,
    location: { name: String(location.name || '').slice(0, 200), lat: location.lat, lng: location.lng },
    polygon: drawn,
    areaSource,
    input: cleanInput,
    apiData,
    result: assessment.result,
    fails: assessment.fails,
    warns: assessment.warns,
    requirements: assessment.requirements,
    llmReport,
  });
  res.status(201).json(doc);
}

// GET /api/manager/assessments (mine)
async function listAssessments(req, res) {
  const docs = await SiteAssessment.find({ managerId: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json(docs.map((doc) => {
    const assessment = doc.toObject();
    assessment.llmReport = formatReport(assessment.llmReport || '');
    return assessment;
  }));
}

// POST /api/manager/camps { assessmentId, name, capacity, disasterId?, plannedClosureDate?, facilities? }
async function createCamp(req, res) {
  const { assessmentId, name, capacity, disasterId, plannedClosureDate, facilities } = req.body;
  if (!mongoose.isValidObjectId(assessmentId)) return res.status(400).json({ message: 'A valid assessment is required.' });
  const assessment = await SiteAssessment.findOne({ _id: assessmentId, managerId: req.user._id });
  if (!assessment) return res.status(404).json({ message: 'Assessment not found.' });
  if (assessment.result === 'not_suitable' && req.body.acceptUnsuitableRisk !== true)
    return res.status(409).json({ message: 'Confirm that you understand the risks before creating a camp on a site assessed as not suitable.' });
  const cleanName = escapeHtml(sanitize(name));
  if (!cleanName) return res.status(400).json({ message: 'Camp name is required.' });
  const cap = Number(capacity);
  if (!Number.isInteger(cap) || cap < 1) return res.status(400).json({ message: 'Capacity must be a whole number of at least 1.' });
  if (await Camp.exists({ siteAssessmentId: assessment._id })) return res.status(409).json({ message: 'A camp already exists for this assessment.' });

  const camp = await Camp.create({
    name: cleanName,
    managerId: req.user._id,
    disasterId: disasterId || assessment.disasterId || undefined,
    siteAssessmentId: assessment._id,
    location: assessment.location,
    capacity: cap,
    facilities: Array.isArray(facilities) ? facilities.map(String).slice(0, 30) : [],
    plannedClosureDate: plannedClosureDate ? new Date(plannedClosureDate) : undefined,
    resources: ['water', 'food', 'medicine', 'shelter'].map((n) => ({ name: n })),
  });
  res.status(201).json(camp);
}

// GET /api/manager/camps (mine)
async function listCamps(req, res) {
  const camps = await Camp.find({ managerId: req.user._id }).sort({ createdAt: -1 });
  if (!camps.length) return res.json([]);

  const offers = await ShortageOffer.find({ campId: { $in: camps.map((camp) => camp._id) } })
    .populate('ngoId', 'organizationName')
    .sort({ createdAt: -1 });
  const offersByCamp = new Map();
  for (const offer of offers) {
    const campId = String(offer.campId);
    if (!offersByCamp.has(campId)) offersByCamp.set(campId, []);
    offersByCamp.get(campId).push({
      _id: offer._id,
      ngoId: offer.ngoId?._id ? String(offer.ngoId._id) : '',
      ngoName: offer.ngoId?.organizationName || 'NGO',
      resource: offer.resource,
      message: offer.message,
      status: offer.status,
      createdAt: offer.createdAt,
    });
  }

  res.json(camps.map((camp) => ({
    ...camp.toObject(),
    supportOffers: offersByCamp.get(String(camp._id)) || [],
  })));
}

// PATCH /api/manager/camps/:id { population?, resources?: { water:'low', ... } }
async function updateCamp(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid camp.' });
  const camp = await Camp.findOne({ _id: req.params.id, managerId: req.user._id });
  if (!camp) return res.status(404).json({ message: 'Camp not found.' });

  if (req.body.population !== undefined) {
    const pop = Number(req.body.population);
    if (!Number.isInteger(pop) || pop < 0) return res.status(400).json({ message: 'Population must be 0 or more.' });
    camp.population = pop;
  }
  for (const [name, level] of Object.entries(req.body.resources || {})) {
    if (!['sufficient', 'low', 'critical'].includes(level)) return res.status(400).json({ message: `Invalid level for ${name}.` });
    const r = camp.resources.find((x) => x.name === name);
    if (r) { r.level = level; r.updatedAt = new Date(); }
  }
  await camp.save();
  res.json(camp);
}

async function updateCampSupportOffer(req, res) {
  if (!mongoose.isValidObjectId(req.params.id) || !mongoose.isValidObjectId(req.params.offerId))
    return res.status(400).json({ message: 'Invalid camp or NGO offer.' });

  const camp = await Camp.findOne({ _id: req.params.id, managerId: req.user._id });
  if (!camp) return res.status(404).json({ message: 'Camp not found.' });
  const { status } = req.body;
  if (!['accepted', 'declined'].includes(status))
    return res.status(400).json({ message: 'Offer status must be accepted or declined.' });

  const offer = await ShortageOffer.findOne({ _id: req.params.offerId, campId: camp._id });
  if (!offer) return res.status(404).json({ message: 'NGO offer not found for this camp.' });
  offer.status = status;
  await offer.save();
  await offer.populate('ngoId', 'organizationName');
  res.json({
    _id: offer._id,
    ngoName: offer.ngoId?.organizationName || 'NGO',
    resource: offer.resource,
    message: offer.message,
    status: offer.status,
    createdAt: offer.createdAt,
  });
}

async function listCampRequests(req, res) {
  const camps = await Camp.find({ managerId: req.user._id }).select('_id');
  if (!camps.length) return res.json([]);
  const requests = await Request.find({ campId: { $in: camps.map((camp) => camp._id) } })
    .populate('campId', 'name')
    .sort({ createdAt: -1 })
    .limit(500);
  if (!requests.length) return res.json([]);

  const notifications = await Notification.find({ requestId: { $in: requests.map((request) => request._id) } })
    .populate('ngoId', 'organizationName');
  const notificationsByRequest = new Map();
  for (const notification of notifications) {
    const requestId = String(notification.requestId);
    if (!notificationsByRequest.has(requestId)) notificationsByRequest.set(requestId, []);
    notificationsByRequest.get(requestId).push({
      ngoName: notification.ngoId?.organizationName || 'NGO',
      status: notification.status,
    });
  }

  res.json(requests.map((request) => ({
    ...request.toObject(),
    emailNotifications: notificationsByRequest.get(String(request._id)) || [],
  })));
}

async function updateRequestStatus(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid request.' });
  const { status } = req.body;
  if (!['pending', 'in_progress', 'resolved'].includes(status))
    return res.status(400).json({ message: 'Status must be pending, in progress, or resolved.' });

  const request = await Request.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found.' });
  const camp = await Camp.findOne({ _id: request.campId, managerId: req.user._id }).select('_id');
  if (!camp) return res.status(404).json({ message: 'Request not found for one of your camps.' });

  request.status = status;
  await request.save();
  await request.populate('campId', 'name');
  res.json(request);
}

async function listNgoComplaints(req, res) {
  const complaints = await NgoComplaint.find({ managerId: req.user._id })
    .populate('campId', 'name')
    .populate('ngoId', 'organizationName')
    .sort({ createdAt: -1 })
    .limit(500);
  res.json(complaints);
}

async function createNgoComplaint(req, res) {
  const { campId, ngoId, category } = req.body;
  if (!mongoose.isValidObjectId(campId) || !mongoose.isValidObjectId(ngoId))
    return res.status(400).json({ message: 'Choose a valid camp and NGO.' });
  if (!['food', 'water', 'medicine', 'shelter', 'sanitation', 'other'].includes(category))
    return res.status(400).json({ message: 'Choose a valid complaint category.' });

  const subject = escapeHtml(sanitize(req.body.subject));
  const details = escapeHtml(sanitize(req.body.details));
  if (!subject || subject.length > 150)
    return res.status(400).json({ message: 'Enter a complaint subject of 1–150 characters.' });
  if (!details || details.length > 2000)
    return res.status(400).json({ message: 'Enter complaint details of 1–2,000 characters.' });

  const camp = await Camp.findOne({ _id: campId, managerId: req.user._id, status: { $ne: 'closed' } }).select('_id');
  if (!camp) return res.status(404).json({ message: 'Active camp not found.' });
  const acceptedOffer = await ShortageOffer.exists({ campId: camp._id, ngoId, status: 'accepted' });
  if (!acceptedOffer)
    return res.status(409).json({ message: 'Choose an NGO with an accepted support offer for this camp.' });

  const complaint = await NgoComplaint.create({
    managerId: req.user._id,
    campId: camp._id,
    ngoId,
    category,
    subject,
    details,
  });
  await complaint.populate([
    { path: 'campId', select: 'name' },
    { path: 'ngoId', select: 'organizationName' },
  ]);
  res.status(201).json(complaint);
}

async function updateNgoComplaintStatus(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid NGO complaint.' });
  const { status } = req.body;
  if (!['pending', 'in_progress', 'resolved'].includes(status))
    return res.status(400).json({ message: 'Status must be pending, in progress, or resolved.' });

  const complaint = await NgoComplaint.findOne({ _id: req.params.id, managerId: req.user._id });
  if (!complaint) return res.status(404).json({ message: 'NGO complaint not found.' });
  complaint.status = status;
  await complaint.save();
  await complaint.populate([
    { path: 'campId', select: 'name' },
    { path: 'ngoId', select: 'organizationName' },
  ]);
  res.json(complaint);
}

module.exports = {
  listActiveDisasters,
  calculator,
  siteData,
  createAssessment,
  listAssessments,
  createCamp,
  listCamps,
  updateCamp,
  updateCampSupportOffer,
  listCampRequests,
  updateRequestStatus,
  listNgoComplaints,
  createNgoComplaint,
  updateNgoComplaintStatus,
};
