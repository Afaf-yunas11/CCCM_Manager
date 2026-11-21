const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  getMyAssignedCamps,
  extendCamp,
  closeCamp,
  updateCamp,
} = require('../controllers/campController');

const router = express.Router();

router.use(requireAuth, requireRole('campManager', 'admin'));

// Manager: Get my assigned camps
router.get('/my', getMyAssignedCamps);

// Manager: Extend camp duration
router.post('/:id/extend', extendCamp);

// Manager: Confirm camp closure
router.post('/:id/close', closeCamp);

// Manager: Update resource shortage levels or population
router.patch('/:id', updateCamp);

module.exports = router;
