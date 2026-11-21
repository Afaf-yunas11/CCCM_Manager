const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getNgos, updateNgoStatus } = require('../controllers/adminController');
const {
  createDisaster,
  getDisasters,
  getDisasterById,
  updateDisasterStatus,
  deleteDisaster,
} = require('../controllers/disasterController');
const {
  getAdminRequests,
  createRequest,
  updateRequestStatus,
  deleteRequest,
} = require('../controllers/requestController');
const {
  getCamps,
  createCamp,
  updateCamp,
  extendCamp,
  closeCamp,
  reopenCamp,
  deleteCamp,
} = require('../controllers/campController');

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
router.delete('/disasters/:id', deleteDisaster);

// Complaints & Requests management
router.get('/requests', getAdminRequests);
router.post('/requests', createRequest);
router.patch('/requests/:id', updateRequestStatus);
router.delete('/requests/:id', deleteRequest);

// Camp management
router.get('/camps', getCamps);
router.post('/camps', createCamp);
router.patch('/camps/:id', updateCamp);
router.post('/camps/:id/extend', extendCamp);
router.post('/camps/:id/close', closeCamp);
router.post('/camps/:id/reopen', reopenCamp);
router.delete('/camps/:id', deleteCamp);

module.exports = router;

