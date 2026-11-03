// Run from the server/ folder:  node src/scripts/testModels.js
// Uses a unique test DB name and leaves it in MongoDB for inspection.
require('dotenv').config();
const assert = require('assert');
const mongoose = require('mongoose');
const M = require('../models');

let passed = 0;
async function test(name, fn) {
  try { await fn(); console.log('  PASS', name); passed++; }
  catch (e) { console.log('  FAIL', name, '->', e.message); process.exitCode = 1; }
}

(async () => {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing. Add it to server/.env before running this script.');
  }

  // Add a unique test DB name to the URI path, leaving the hostname intact.
  const testUri = new URL(process.env.MONGO_URI);
  const configuredDbName = decodeURIComponent(testUri.pathname.replace(/^\/+/, '').split('/')[0] || 'cccm_manager');
  const testDbName = `${configuredDbName}_test_${Date.now()}`;
  testUri.pathname = `/${encodeURIComponent(testDbName)}`;
  const uri = testUri.toString();

  await mongoose.connect(uri);
  console.log('Connected to', mongoose.connection.name);
  await Promise.all(Object.values(M).map((m) => m.syncIndexes())); // build unique + TTL indexes

  const mk = (role, email) => M.User.create({ fullName: 'T ' + role, email, passwordHash: 'x', role });

  await test('creates a user with defaults', async () => {
    const u = await mk('campManager', 'mgr@test.com');
    assert.strictEqual(u.accountStatus, 'pending');
    assert.strictEqual(u.isEmailVerified, false);
  });

  await test('passwordHash hidden by default', async () => {
    const u = await M.User.findOne({ email: 'mgr@test.com' });
    assert.strictEqual(u.passwordHash, undefined);
    const withPw = await M.User.findOne({ email: 'mgr@test.com' }).select('+passwordHash');
    assert.strictEqual(withPw.passwordHash, 'x');
  });

  await test('duplicate email rejected', async () => {
    await assert.rejects(mk('ngo', 'mgr@test.com'), (e) => e.code === 11000);
  });

  await test('invalid role rejected', async () => {
    await assert.rejects(mk('superhero', 'bad@test.com'), (e) => e.name === 'ValidationError');
  });

  const admin = await mk('admin', 'admin@test.com');
  const ngoUser = await mk('ngo', 'ngo@test.com');
  const aff = await mk('affectedPerson', 'aff@test.com');
  const mgr = await M.User.findOne({ email: 'mgr@test.com' });

  const ngo = await M.Ngo.create({ userId: ngoUser._id, organizationName: 'Test NGO', services: ['water'] });
  const disaster = await M.Disaster.create({ title: 'Flood X', createdBy: admin._id });

  await test('NGO defaults to pending approval', async () => {
    assert.strictEqual(ngo.approvalStatus, 'pending');
  });

  await test('NGO cannot commit twice to same disaster', async () => {
    await M.DisasterCommitment.create({ disasterId: disaster._id, ngoId: ngo._id });
    await assert.rejects(
      M.DisasterCommitment.create({ disasterId: disaster._id, ngoId: ngo._id }),
      (e) => e.code === 11000
    );
  });

  const camp = await M.Camp.create({
    name: 'Camp Alpha', managerId: mgr._id, disasterId: disaster._id, capacity: 1500,
    resources: [{ name: 'water' }, { name: 'food', level: 'low' }],
    plannedClosureDate: new Date('2027-02-12'),
  });

  await test('camp resource default + closure not automatic', async () => {
    assert.strictEqual(camp.resources[0].level, 'sufficient');
    assert.strictEqual(camp.status, 'active');
  });

  await test('site assessment saves result and requires population', async () => {
    const ok = await M.SiteAssessment.create({
      managerId: mgr._id,
      input: { population: 1000, availableAreaM2: 60000 },
      result: 'suitable',
    });
    assert.ok(ok._id);
    await assert.rejects(
      M.SiteAssessment.create({ managerId: mgr._id, input: {}, result: 'suitable' }),
      (e) => e.name === 'ValidationError'
    );
  });

  await test('protection request is forced restricted', async () => {
    const r = await M.Request.create({ userId: aff._id, campId: camp._id, category: 'protection', details: 'test' });
    assert.strictEqual(r.isRestricted, true);
  });

  await test('NGO-style query hides restricted requests', async () => {
    await M.Request.create({ userId: aff._id, campId: camp._id, category: 'food', details: 'need food' });
    const visible = await M.Request.find({ campId: camp._id, isRestricted: false });
    assert.strictEqual(visible.length, 1);
    assert.strictEqual(visible[0].category, 'food');
  });

  await test('populate works across collections', async () => {
    const r = await M.Request.findOne({ category: 'food' }).populate('campId', 'name');
    assert.strictEqual(r.campId.name, 'Camp Alpha');
  });

  await test('TTL index exists on emailVerificationCodes', async () => {
    const idx = await M.EmailVerificationCode.collection.indexes();
    assert.ok(idx.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0));
  });

  console.log(`\n${passed} tests passed`);
  await mongoose.disconnect();
})();
