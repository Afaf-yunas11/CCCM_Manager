const { Disaster, DisasterCommitment, Ngo } = require('../models');

// ── Admin: Create a disaster ────────────────────────────────────────────────
async function createDisaster(req, res) {
  try {
    const { title, type, description, location, severity, affectedPopulation, startDate } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Disaster title is required.' });
    }

    const disaster = await Disaster.create({
      title: title.trim(),
      type: type || 'other',
      description: description || '',
      location: location || {},
      severity: severity || 'medium',
      affectedPopulation: affectedPopulation || 0,
      startDate: startDate || Date.now(),
      createdBy: req.user._id,
    });

    return res.status(201).json({ message: 'Disaster created.', disaster });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create disaster.' });
  }
}

// ── Admin: List all disasters ───────────────────────────────────────────────
async function getDisasters(req, res) {
  try {
    const filter = {};
    if (req.query.status && ['active', 'underControl', 'closed'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const disasters = await Disaster.find(filter)
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 });

    return res.json(disasters);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to retrieve disasters.' });
  }
}

// ── Admin: Get single disaster with all commitments ─────────────────────────
async function getDisasterById(req, res) {
  try {
    const disaster = await Disaster.findById(req.params.id)
      .populate('createdBy', 'fullName email');

    if (!disaster) return res.status(404).json({ message: 'Disaster not found.' });

    const commitments = await DisasterCommitment.find({ disasterId: disaster._id })
      .populate({
        path: 'ngoId',
        select: 'organizationName userId',
        populate: { path: 'userId', select: 'fullName email' },
      })
      .sort({ committedAt: -1 });

    return res.json({ disaster, commitments });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to retrieve disaster.' });
  }
}

// ── Admin: Update disaster status ───────────────────────────────────────────
async function updateDisasterStatus(req, res) {
  try {
    const { status } = req.body;
    if (!status || !['active', 'underControl', 'closed'].includes(status)) {
      return res.status(400).json({ message: 'Valid status is required (active, underControl, closed).' });
    }

    const disaster = await Disaster.findByIdAndUpdate(
      req.params.id,
      { status },
      { returnDocument: 'after' }
    ).populate('createdBy', 'fullName email');

    if (!disaster) return res.status(404).json({ message: 'Disaster not found.' });

    return res.json({ message: `Disaster marked as ${status}.`, disaster });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update disaster.' });
  }
}

// ── NGO: List active disasters ──────────────────────────────────────────────
async function getActiveDisasters(req, res) {
  try {
    const disasters = await Disaster.find({ status: 'active' })
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });

    // Find this NGO's existing commitments so the UI can mark them
    const ngo = await Ngo.findOne({ userId: req.user._id });
    const commitments = ngo
      ? await DisasterCommitment.find({ ngoId: ngo._id }).select('disasterId status')
      : [];

    const committedMap = {};
    commitments.forEach((c) => {
      committedMap[c.disasterId.toString()] = c.status;
    });

    const result = disasters.map((d) => ({
      ...d.toObject(),
      myCommitmentStatus: committedMap[d._id.toString()] || null,
    }));

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to retrieve disasters.' });
  }
}

// ── NGO: Commit to a disaster ("I will respond") ────────────────────────────
async function respondToDisaster(req, res) {
  try {
    const { workAreas, plannedActivities, resourcesOffered } = req.body;

    if (!workAreas || !workAreas.length) {
      return res.status(400).json({ message: 'At least one work area is required.' });
    }
    if (!plannedActivities || !plannedActivities.length) {
      return res.status(400).json({ message: 'At least one planned activity is required.' });
    }

    const disaster = await Disaster.findById(req.params.id);
    if (!disaster) return res.status(404).json({ message: 'Disaster not found.' });
    if (disaster.status !== 'active') {
      return res.status(400).json({ message: 'This disaster is no longer accepting responses.' });
    }

    const ngo = await Ngo.findOne({ userId: req.user._id });
    if (!ngo) return res.status(404).json({ message: 'NGO profile not found.' });
    if (ngo.approvalStatus !== 'approved') {
      return res.status(403).json({ message: 'Only approved NGOs can respond to disasters.' });
    }

    // Check for duplicate commitment (a withdrawn one may be re-committed)
    const existing = await DisasterCommitment.findOne({ disasterId: disaster._id, ngoId: ngo._id });
    if (existing && existing.status !== 'withdrawn') {
      return res.status(409).json({ message: 'You have already committed to this disaster.' });
    }
    if (existing) {
      Object.assign(existing, {
        workAreas,
        plannedActivities,
        resourcesOffered: resourcesOffered || [],
        status: 'committed',
      });
      await existing.save();
      return res.json({ message: 'Response submitted successfully.', commitment: existing });
    }

    const commitment = await DisasterCommitment.create({
      disasterId: disaster._id,
      ngoId: ngo._id,
      workAreas,
      plannedActivities,
      resourcesOffered: resourcesOffered || [],
    });

    return res.status(201).json({ message: 'Response submitted successfully.', commitment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'You have already committed to this disaster.' });
    }
    return res.status(500).json({ message: error.message || 'Failed to submit response.' });
  }
}

// ── NGO: View own commitments ───────────────────────────────────────────────
async function getMyCommitments(req, res) {
  try {
    const ngo = await Ngo.findOne({ userId: req.user._id });
    if (!ngo) return res.json([]);

    const commitments = await DisasterCommitment.find({ ngoId: ngo._id })
      .populate('disasterId', 'title type severity status location startDate')
      .sort({ committedAt: -1 });

    return res.json(commitments);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to retrieve commitments.' });
  }
}

module.exports = {
  createDisaster,
  getDisasters,
  getDisasterById,
  updateDisasterStatus,
  getActiveDisasters,
  respondToDisaster,
  getMyCommitments,
};
