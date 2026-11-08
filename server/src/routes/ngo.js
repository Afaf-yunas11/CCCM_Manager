const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getActiveDisasters,
  respondToDisaster,
  getMyCommitments,
} = require('../controllers/disasterController');
const {
  getMyProfile,
  updateMyProfile,
  withdrawCommitment,
} = require('../controllers/ngoController');

const router = express.Router();

router.use(requireAuth, requireRole('ngo'));

// Own profile
router.get('/profile', getMyProfile);
router.put('/profile', updateMyProfile);

// List active disasters (with own commitment status)
router.get('/disasters', getActiveDisasters);

// Respond to a disaster ("I will respond")
router.post('/disasters/:id/respond', respondToDisaster);

// Withdraw from a disaster
router.patch('/disasters/:id/withdraw', withdrawCommitment);

// View own commitments
router.get('/commitments', getMyCommitments);

module.exports = router;
