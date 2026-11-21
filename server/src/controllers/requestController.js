const mongoose = require('mongoose');
const { Camp, Request, ShortageOffer, Notification } = require('../models');
const { sendOperationalEmail } = require('../services/email');

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
  const cleanDetails = typeof details === 'string' ? details.trim() : '';
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

module.exports = { listOpenCamps, listMyRequests, createRequest, getEmailCategory };
