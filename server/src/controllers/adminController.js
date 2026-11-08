const { Ngo, User } = require('../models');

async function getNgos(req, res) {
  try {
    const filter = {};
    const { status } = req.query;
    if (status && ['pending', 'approved', 'rejected'].includes(status.toLowerCase())) {
      filter.approvalStatus = status.toLowerCase();
    }

    const ngos = await Ngo.find(filter)
      .populate('userId', 'fullName email role accountStatus isEmailVerified createdAt')
      .populate('approvedBy', 'fullName email')
      .sort({ createdAt: -1 });

    return res.json(ngos);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to retrieve NGOs.' });
  }
}

async function updateNgoStatus(req, res) {
  try {
    const { id } = req.params;
    const rawAction = req.body.status || req.body.action || req.body.approvalStatus;
    const action = typeof rawAction === 'string' ? rawAction.trim().toLowerCase() : '';

    if (!['approved', 'rejected', 'approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Valid status is required (approved or rejected).' });
    }

    const nextStatus = action === 'approve' || action === 'approved' ? 'approved' : 'rejected';
    const nextUserAccountStatus = nextStatus === 'approved' ? 'active' : 'rejected';

    let ngo = await Ngo.findById(id);
    if (!ngo) {
      ngo = await Ngo.findOne({ userId: id });
    }

    if (!ngo) {
      return res.status(404).json({ message: 'NGO record not found.' });
    }

    ngo.approvalStatus = nextStatus;
    ngo.approvedBy = req.user._id;
    await ngo.save();

    const user = await User.findById(ngo.userId);
    if (user) {
      user.accountStatus = nextUserAccountStatus;
      await user.save();
    }

    const populatedNgo = await Ngo.findById(ngo._id)
      .populate('userId', 'fullName email role accountStatus isEmailVerified')
      .populate('approvedBy', 'fullName email');

    return res.json({
      message: `NGO successfully ${nextStatus}.`,
      ngo: populatedNgo,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update NGO status.' });
  }
}

module.exports = { getNgos, updateNgoStatus };

