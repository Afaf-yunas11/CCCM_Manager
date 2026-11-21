const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Camp, Ngo, NgoComplaint, ShortageOffer } = require('../models');
const { createNgoComplaint } = require('../controllers/managerController');
const { listMyCampComplaints } = require('../controllers/ngoController');

test('NGO complaints default to pending and validate their service fields', async () => {
  const complaint = new NgoComplaint({
    managerId: new mongoose.Types.ObjectId(),
    campId: new mongoose.Types.ObjectId(),
    ngoId: new mongoose.Types.ObjectId(),
    category: 'food',
    subject: 'Food delivery missed',
    details: 'Food has not been delivered for two days.',
  });
  await complaint.validate();

  assert.equal(complaint.status, 'pending');
});

test('NGO complaint listing is scoped to the authenticated NGO', async () => {
  const userId = new mongoose.Types.ObjectId();
  const ngoId = new mongoose.Types.ObjectId();
  const expectedComplaints = [{ _id: new mongoose.Types.ObjectId() }];
  const originalFindOne = Ngo.findOne;
  const originalFind = NgoComplaint.find;
  let complaintFilter;
  let responseBody;

  Ngo.findOne = (filter) => {
    assert.deepEqual(filter, { userId });
    return { select: async () => ({ _id: ngoId }) };
  };
  NgoComplaint.find = (filter) => {
    complaintFilter = filter;
    return {
      populate() { return this; },
      sort() { return this; },
      limit: async () => expectedComplaints,
    };
  };

  try {
    await listMyCampComplaints(
      { user: { _id: userId } },
      { json(value) { responseBody = value; } }
    );
    assert.deepEqual(complaintFilter, { ngoId });
    assert.equal(responseBody, expectedComplaints);
  } finally {
    Ngo.findOne = originalFindOne;
    NgoComplaint.find = originalFind;
  }
});

test('manager cannot create an NGO complaint for a camp they do not manage', async () => {
  const managerId = new mongoose.Types.ObjectId();
  const campId = new mongoose.Types.ObjectId();
  const ngoId = new mongoose.Types.ObjectId();
  const originalFindOne = Camp.findOne;
  const originalExists = ShortageOffer.exists;
  let offerLookupCalled = false;
  let statusCode;
  let responseBody;

  Camp.findOne = (filter) => {
    assert.deepEqual(filter, { _id: campId, managerId, status: { $ne: 'closed' } });
    return { select: async () => null };
  };
  ShortageOffer.exists = async () => {
    offerLookupCalled = true;
    return null;
  };

  try {
    await createNgoComplaint(
      {
        user: { _id: managerId },
        body: {
          campId,
          ngoId,
          category: 'food',
          subject: 'Food delivery missed',
          details: 'Food has not been delivered for two days.',
        },
      },
      {
        status(code) { statusCode = code; return this; },
        json(value) { responseBody = value; return this; },
      }
    );
    assert.equal(statusCode, 404);
    assert.equal(responseBody.message, 'Active camp not found.');
    assert.equal(offerLookupCalled, false);
  } finally {
    Camp.findOne = originalFindOne;
    ShortageOffer.exists = originalExists;
  }
});
