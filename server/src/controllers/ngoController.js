const mongoose = require('mongoose');
const { Ngo, DisasterCommitment, Camp, ShortageOffer, NgoComplaint } = require('../models');

const CAMP_SUPPORT_RESOURCES = ['water', 'food', 'medicine', 'shelter', 'sanitation', 'other'];

// accepts ["a","b"] or "a, b" and returns a clean array of strings
function toArray(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(',').map((x) => x.trim()).filter(Boolean);
  return [];
}

// ── NGO: View own profile ───────────────────────────────────────────────────
async function getMyProfile(req, res) {
  try {
    const ngo = await Ngo.findOne({ userId: req.user._id });
    if (!ngo) return res.status(404).json({ message: 'NGO profile not found.' });
    return res.json(ngo);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to retrieve profile.' });
  }
}

// ── NGO: Complete / update profile (operatingAreas is used for complaint emails) ──
async function updateMyProfile(req, res) {
  try {
    const ngo = await Ngo.findOne({ userId: req.user._id });
    if (!ngo) return res.status(404).json({ message: 'NGO profile not found.' });

    const { organizationName, description, contactNumber } = req.body;
    if (organizationName !== undefined) {
      if (!String(organizationName).trim()) {
        return res.status(400).json({ message: 'Organization name cannot be empty.' });
      }
      ngo.organizationName = String(organizationName).trim();
    }
    if (description !== undefined) ngo.description = description;
    if (contactNumber !== undefined) ngo.contactNumber = contactNumber;
    if (req.body.operatingAreas !== undefined) ngo.operatingAreas = toArray(req.body.operatingAreas);
    if (req.body.services !== undefined) ngo.services = toArray(req.body.services);

    await ngo.save();
    return res.json({ message: 'Profile updated.', ngo });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: error.message || 'Failed to update profile.' });
  }
}

// ── NGO: Withdraw from a disaster ───────────────────────────────────────────
async function withdrawCommitment(req, res) {
  try {
    const ngo = await Ngo.findOne({ userId: req.user._id });
    if (!ngo) return res.status(404).json({ message: 'NGO profile not found.' });

    const commitment = await DisasterCommitment.findOneAndUpdate(
      { disasterId: req.params.id, ngoId: ngo._id },
      { status: 'withdrawn' },
      { returnDocument: 'after' }
    );
    if (!commitment) return res.status(404).json({ message: 'No commitment found for this disaster.' });

    return res.json({ message: 'You have withdrawn from this disaster.', commitment });
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid disaster id.' });
    return res.status(500).json({ message: error.message || 'Failed to withdraw.' });
  }
}

async function listCampsForSupport(req, res) {
  const ngo = await Ngo.findOne({ userId: req.user._id });
  if (!ngo) return res.status(404).json({ message: 'NGO profile not found.' });

  const camps = await Camp.find({ status: { $ne: 'closed' } })
    .select('name location status capacity population resources')
    .sort({ createdAt: -1 });
  const offers = camps.length
    ? await ShortageOffer.find({ ngoId: ngo._id, campId: { $in: camps.map((camp) => camp._id) } })
        .select('campId resource message status')
    : [];
  const offersByCamp = new Map();
  for (const offer of offers) {
    const campId = String(offer.campId);
    if (!offersByCamp.has(campId)) offersByCamp.set(campId, []);
    offersByCamp.get(campId).push({
      resource: offer.resource,
      message: offer.message,
      status: offer.status,
    });
  }

  res.json(camps.map((camp) => ({
    ...camp.toObject(),
    myOffers: offersByCamp.get(String(camp._id)) || [],
    canOffer: ngo.approvalStatus === 'approved',
  })));
}

async function offerCampSupport(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid camp.' });
  const resource = typeof req.body.resource === 'string' ? req.body.resource : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!CAMP_SUPPORT_RESOURCES.includes(resource)) return res.status(400).json({ message: 'Select a valid facility or service.' });
  if (message.length > 1000) return res.status(400).json({ message: 'Facility details must be 1,000 characters or fewer.' });

  const ngo = await Ngo.findOne({ userId: req.user._id });
  if (!ngo) return res.status(404).json({ message: 'NGO profile not found.' });
  if (ngo.approvalStatus !== 'approved') return res.status(403).json({ message: 'Only approved NGOs can offer camp support.' });

  const camp = await Camp.findOne({ _id: req.params.id, status: { $ne: 'closed' } });
  if (!camp) return res.status(404).json({ message: 'Active camp not found.' });

  const offer = await ShortageOffer.findOneAndUpdate(
    { campId: camp._id, ngoId: ngo._id, resource },
    { $set: { message, status: 'offered' } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.json(offer);
}

async function listMyCampComplaints(req, res) {
  const ngo = await Ngo.findOne({ userId: req.user._id }).select('_id');
  if (!ngo) return res.status(404).json({ message: 'NGO profile not found.' });

  const complaints = await NgoComplaint.find({ ngoId: ngo._id })
    .populate('campId', 'name location')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(complaints);
}

module.exports = {
  getMyProfile,
  updateMyProfile,
  withdrawCommitment,
  listCampsForSupport,
  offerCampSupport,
  listMyCampComplaints,
};
