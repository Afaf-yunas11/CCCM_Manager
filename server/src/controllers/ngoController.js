const { Ngo, DisasterCommitment } = require('../models');

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

module.exports = { getMyProfile, updateMyProfile, withdrawCommitment };
