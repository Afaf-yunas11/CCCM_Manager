const mongoose = require('mongoose');
const { Request, User, Camp, ShortageOffer, Notification } = require('../models');
const { sendOperationalEmail } = require('../services/email');
const { sanitize, escapeHtml } = require('../utils/sanitize');

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN endpoints (used by admin routes)
// ════════════════════════════════════════════════════════════════════════════

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

    if (adminNotes !== undefined) request.adminNotes = escapeHtml(sanitize(adminNotes));
    if (resolutionDetails !== undefined) request.resolutionDetails = escapeHtml(sanitize(resolutionDetails));
    if (rejectionReason !== undefined) request.rejectionReason = escapeHtml(sanitize(rejectionReason));
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
    const escalationLog = `[ESCALATED on ${timestamp} to ${targetDept}] ${notes || 'Escalated for immediate emergency intervention and high-level resource mobilization.'}`;
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

// ── User / Resident: View own requests and complaints (legacy route) ────────
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

// ── Legacy: Create a Request or Complaint (from old /api/requests route) ────
async function createRequestLegacy(req, res) {
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

    const targetUserId = (req.user.role === 'admin' && userId) ? userId : req.user._id;

    let targetType = type;
    if (!targetType) {
      targetType = ['problem', 'protection'].includes(category) ? 'complaint' : 'request';
    }

    const rawTitle = sanitize(title);
    const autoTitle = rawTitle
      ? escapeHtml(rawTitle)
      : `${targetType === 'complaint' ? 'Complaint' : 'Assistance Request'} regarding ${category}`;

    const newRequest = await Request.create({
      userId: targetUserId,
      title: autoTitle,
      type: targetType,
      category,
      details: escapeHtml(sanitize(details)),
      priority: priority || 'medium',
      location: escapeHtml(sanitize(location)),
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

// ════════════════════════════════════════════════════════════════════════════
//  RESIDENT endpoints (used by /api/resident routes)
// ════════════════════════════════════════════════════════════════════════════

const REQUEST_CATEGORIES = ['food', 'water', 'medicine', 'shelter', 'problem', 'protection'];
const EMAIL_CATEGORIES = ['food', 'water', 'medicine', 'shelter'];

function getEmailCategory(request) {
  if (request.isRestricted || request.category === 'protection') return null;
  return EMAIL_CATEGORIES.includes(request.category) ? request.category : null;
}

async function listOpenCamps(req, res) {
  const camps = await Camp.find({ status: { $ne: 'closed' } })
    .select('name location status')
    .sort({ createdAt: -1 });
  res.json(camps);
}

async function listMyRequests(req, res) {
  const requests = await Request.find({ userId: req.user._id })
    .populate('campId', 'name')
    .sort({ createdAt: -1 })
    .limit(100);
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

async function createRequest(req, res) {
  const { campId, category, details } = req.body;
  if (!mongoose.isValidObjectId(campId)) return res.status(400).json({ message: 'Choose a valid camp.' });
  if (!REQUEST_CATEGORIES.includes(category)) return res.status(400).json({ message: 'Choose a valid request category.' });
  const cleanDetails = escapeHtml(sanitize(details));
  if (!cleanDetails || cleanDetails.length > 2000)
    return res.status(400).json({ message: 'Describe the request in 1–2,000 characters.' });

  const camp = await Camp.findOne({ _id: campId, status: { $ne: 'closed' } });
  if (!camp) return res.status(404).json({ message: 'Active camp not found.' });

  const request = await Request.create({
    userId: req.user._id,
    campId: camp._id,
    category,
    details: cleanDetails,
    isRestricted: category === 'protection',
  });
  const notificationMessage = request.isRestricted
    ? 'Protection requests are visible to the camp manager only.'
    : 'Your request was recorded for the camp manager.';
  let notifiedNgos = [];
  let emailWarning = '';
  const emailCategory = getEmailCategory(request);

  if (emailCategory) {
    const offers = await ShortageOffer.find({
      campId: camp._id,
      resource: emailCategory,
      status: 'accepted',
    }).populate({
      path: 'ngoId',
      select: 'organizationName userId',
      populate: { path: 'userId', select: 'email' },
    });
    const recipients = new Map();
    for (const offer of offers) {
      const email = offer.ngoId?.userId?.email;
      if (email) recipients.set(String(offer.ngoId._id), { email, ngo: offer.ngoId });
    }

    if (recipients.size) {
      const targets = [...recipients.values()];
      let deliveryError;
      try {
        await sendOperationalEmail({
          to: process.env.SMTP_FROM,
          bcc: targets.map((target) => target.email),
          subject: `New ${category} request for ${camp.name}`,
          text: `A new ${category} request was submitted for ${camp.name}.\n\nDetails: ${cleanDetails}\n\nPlease coordinate with the camp manager.`,
        });
        notifiedNgos = targets.map(({ ngo }) => ngo.organizationName);
      } catch (error) {
        deliveryError = error;
      }
      try {
        await Notification.insertMany(targets.map(({ ngo }) => ({
          requestId: request._id,
          ngoId: ngo._id,
          status: deliveryError ? 'failed' : 'sent',
          ...(deliveryError ? { error: deliveryError.message } : {}),
        })));
      } catch (notificationError) {
        console.error('Failed to record provider notification status:', notificationError.message);
        emailWarning = deliveryError
          ? 'Your request was saved, but provider email failed and its delivery status could not be recorded.'
          : 'Your request and provider email were sent, but delivery status could not be recorded. Please do not resubmit.';
      }
      if (deliveryError && !emailWarning)
        emailWarning = 'Your request was saved, but provider email could not be sent. The camp manager can still review it.';
    } else {
      emailWarning = 'No accepted NGO provider is assigned for this service; the camp manager can still review your request.';
    }
  }

  res.status(201).json({ request, notifiedNgos, notificationMessage, emailWarning });
}

module.exports = {
  // Admin
  getAdminRequests,
  updateRequestStatus,
  escalateRequest,
  deleteRequest,
  getUserRequests,
  createRequestLegacy,
  // Resident
  listOpenCamps,
  listMyRequests,
  createRequest,
  getEmailCategory,
};
