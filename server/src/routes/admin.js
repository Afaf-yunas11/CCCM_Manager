const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getNgos, updateNgoStatus } = require('../controllers/adminController');
const {
  createDisaster,
  getDisasters,
  getDisasterById,
  updateDisasterStatus,
} = require('../controllers/disasterController');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

// NGO approvals
router.get('/ngos', getNgos);
router.patch('/ngos/:id', updateNgoStatus);

// Disaster management
router.post('/disasters', createDisaster);
router.get('/disasters', getDisasters);
router.get('/disasters/:id', getDisasterById);
router.patch('/disasters/:id', updateDisasterStatus);

module.exports = router;

