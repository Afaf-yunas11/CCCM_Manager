/**
 * seedAdmin.js — Run once to create the initial admin account.
 * Usage: node src/scripts/seedAdmin.js
 *
 * Reads credentials from env vars (or falls back to safe defaults):
 *   ADMIN_EMAIL  — defaults to admin@cccm.local
 *   ADMIN_PASS   — defaults to Admin@1234!
 */
const path = require('path');
// .env files are in the server/ directory (two levels up from src/scripts/)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.local') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cccm.local';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Admin@1234!';
const ADMIN_NAME = process.env.ADMIN_NAME || 'CCCM Admin';

async function main() {
  await connectDB();

  const passwordHash = await bcrypt.hash(ADMIN_PASS, 12);
  const result = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    {
      fullName: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
      isEmailVerified: true,
      accountStatus: 'active',
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  console.log('✅ Admin account seeded:');
  console.log('   Email   :', ADMIN_EMAIL);
  console.log('   Password:', ADMIN_PASS);
  console.log('   ID      :', result._id.toString());
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
