const { test } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Request = require('../models/Request');
const { getEmailCategory } = require('../controllers/requestController');

test('protection requests are restricted and never email-eligible', async () => {
  const request = new Request({
    userId: new mongoose.Types.ObjectId(),
    campId: new mongoose.Types.ObjectId(),
    category: 'protection',
    details: 'Private concern',
  });
  await request.validate();

  assert.equal(request.isRestricted, true);
  assert.equal(getEmailCategory(request), null);
});

test('only service requests can notify matching camp providers', () => {
  assert.equal(getEmailCategory({ category: 'food', isRestricted: false }), 'food');
  assert.equal(getEmailCategory({ category: 'problem', isRestricted: false }), null);
});
