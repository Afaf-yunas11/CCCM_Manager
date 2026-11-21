const { Request, User, Camp } = require('../models');

// ── Admin: List all requests & complaints with filters and summary counts ──
async function getAdminRequests(req, res) {
  try {
    const filter = {};
    const { type, status, category, priority, search, restricted } = req.query;

    if (type && ['request', 'complaint'].includes(type.toLowerCase())) {
      filter.type = type.toLowerCase();
    }

    if (status && ['pending', 'in_progress', 'resolved', 'rejected'].includes(status.toLowerCase())) {
      filter.status = status.toLowerCase();
    }

    if (category) {
      filter.category = category.toLowerCase();
    }

    if (priority && ['low', 'medium', 'high', 'critical'].includes(priority.toLowerCase())) {
      filter.priority = priority.toLowerCase();
    }

    if (restricted === 'true' || restricted === true) {
      filter.isRestricted = true;
    }

    if (search && search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { title: regex },
        { details: regex },
        { location: regex },
      ];
    }

    const [items, stats] = await Promise.all([
      Request.find(filter)
        .populate('userId', 'fullName email role')
        .populate('campId', 'name location')
        .populate('assignedTo', 'fullName email')
        .sort({ createdAt: -1 }),
      Request.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            requests: { $sum: { $cond: [{ $eq: ['$type', 'request'] }, 1, 0] } },
            complaints: { $sum: { $cond: [{ $eq: ['$type', 'complaint'] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            // Only count UNRESOLVED critical and high items (needs immediate action)
            critical: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$priority', 'critical'] },
                      { $in: ['$status', ['pending', 'in_progress']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            high: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$priority', 'high'] },
                      { $in: ['$status', ['pending', 'in_progress']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            unresolvedUrgent: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $in: ['$priority', ['critical', 'high']] },
                      { $in: ['$status', ['pending', 'in_progress']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            escalated: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$isEscalated', true] },
                      { $in: ['$status', ['pending', 'in_progress']] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            restricted: {
              $sum: { $cond: [{ $eq: ['$isRestricted', true] }, 1, 0] },
            },
          },
        },
      ]),
    ]);

    const summary = stats[0] || {
      total: 0,
      requests: 0,
      complaints: 0,
      pending: 0,
      in_progress: 0,
      resolved: 0,
      rejected: 0,
      critical: 0,
      high: 0,
      unresolvedUrgent: 0,
      escalated: 0,
      restricted: 0,
    };

    return res.json({ items, summary });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to retrieve requests.' });
  }
}

// ── Create a Request or Complaint (Admin or Resident/User) ───────────────────
async function createRequest(req, res) {
  try {
    const {
      title,
      type,
      category,
      details,
      priority,
      location,
      campId,
      userId,
    } = req.body;

    if (!category) {
      return res.status(400).json({ message: 'Category is required.' });
    }

    if (!details || !String(details).trim()) {
      return res.status(400).json({ message: 'Details description is required.' });
    }

    // Determine target user
    const targetUserId = (req.user.role === 'admin' && userId) ? userId : req.user._id;

    // Inferred type if not specified
    let targetType = type;
    if (!targetType) {
      targetType = ['problem', 'protection'].includes(category) ? 'complaint' : 'request';
    }

    // Default title if not provided
    const autoTitle = title && String(title).trim()
      ? String(title).trim()
      : `${targetType === 'complaint' ? 'Complaint' : 'Assistance Request'} regarding ${category}`;

    const newRequest = await Request.create({
      userId: targetUserId,
      title: autoTitle,
      type: targetType,
      category,
      details: String(details).trim(),
      priority: priority || 'medium',
      location: location || '',
      campId: campId || undefined,
      status: 'pending',
    });

    const populated = await Request.findById(newRequest._id)
      .populate('userId', 'fullName email role')
      .populate('campId', 'name location');

    return res.status(201).json({
      message: `${targetType === 'complaint' ? 'Complaint' : 'Request'} submitted successfully.`,
      request: populated,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to create request.' });
  }
}

// ── Admin: Update status, priority, or resolution note ──────────────────────
async function updateRequestStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, priority, adminNotes, resolutionDetails, rejectionReason, assignedTo } = req.body;

    const request = await Request.findById(id);
    if (!request) {
      return res.status(404).json({ message: 'Record not found.' });
    }

    if (status) {
      const lowerStatus = status.toLowerCase();
      if (!['pending', 'in_progress', 'resolved', 'rejected'].includes(lowerStatus)) {
        return res.status(400).json({ message: 'Invalid status.' });
      }
      request.status = lowerStatus;
      if (lowerStatus === 'resolved') {
        request.resolvedAt = new Date();
      }
      if (lowerStatus === 'rejected') {
        const reasonText = rejectionReason || resolutionDetails || 'Request declined based on verification criteria.';
        request.rejectionReason = reasonText;
        if (!resolutionDetails) {
          request.resolutionDetails = `Declined: ${reasonText}`;
        }
      }
    }

    if (priority && ['low', 'medium', 'high', 'critical'].includes(priority.toLowerCase())) {
      request.priority = priority.toLowerCase();
    }

    if (adminNotes !== undefined) request.adminNotes = adminNotes;
    if (resolutionDetails !== undefined) request.resolutionDetails = resolutionDetails;
    if (rejectionReason !== undefined) request.rejectionReason = rejectionReason;
    if (assignedTo !== undefined) request.assignedTo = assignedTo || null;

    await request.save();

    const populated = await Request.findById(request._id)
      .populate('userId', 'fullName email role')
      .populate('campId', 'name location')
      .populate('assignedTo', 'fullName email');

    return res.json({
      message: `Status updated to ${request.status}.`,
      request: populated,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to update request.' });
  }
}

// ── Admin: Escalate an unresolved critical complaint / request ──────────────
async function escalateRequest(req, res) {
  try {
    const { id } = req.params;
    const { escalatedTo, notes } = req.body;

    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ message: 'Record not found.' });

    request.isEscalated = true;
    request.escalatedAt = new Date();
    request.priority = 'critical';
    if (request.status === 'pending') {
      request.status = 'in_progress';
    }

    const targetDept = escalatedTo || 'NDMA Emergency Operations & Provincial Command';
    request.escalatedTo = targetDept;

    const timestamp = new Date().toLocaleString();
    const escalationLog = `[🚨 ESCALATED on ${timestamp} to ${targetDept}] ${notes || 'Escalated for immediate emergency intervention and high-level resource mobilization.'}`;
    request.adminNotes = request.adminNotes ? `${escalationLog}\n\n${request.adminNotes}` : escalationLog;

    await request.save();

    const populated = await Request.findById(request._id)
      .populate('userId', 'fullName email role')
      .populate('campId', 'name location')
      .populate('assignedTo', 'fullName email');

    return res.json({
      message: 'Incident escalated to emergency operations command.',
      request: populated,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to escalate request.' });
  }
}

// ── Admin: Delete a request ──────────────────────────────────────────────────
async function deleteRequest(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Request.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Record not found.' });
    }
    return res.json({ message: 'Record deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to delete record.' });
  }
}

// ── User / Resident: View own requests and complaints ───────────────────────
async function getUserRequests(req, res) {
  try {
    const items = await Request.find({ userId: req.user._id })
      .populate('campId', 'name location')
      .sort({ createdAt: -1 });

    return res.json(items);
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Failed to retrieve your requests.' });
  }
}

module.exports = {
  getAdminRequests,
  createRequest,
  updateRequestStatus,
  escalateRequest,
  deleteRequest,
  getUserRequests,
};
