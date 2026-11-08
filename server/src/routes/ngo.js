const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getActiveDisasters,
  respondToDisaster,
  getMyCommitments,
} = require('../controllers/disasterController');

const router = express.Router();

router.use(requireAuth, requireRole('ngo'));

// List active disasters (with own commitment status)
router.get('/disasters', getActiveDisasters);

// Respond to a disaster ("I will respond")
router.post('/disasters/:id/respond', respondToDisaster);

// View own commitments
router.get('/commitments', getMyCommitments);

module.exports = router;

