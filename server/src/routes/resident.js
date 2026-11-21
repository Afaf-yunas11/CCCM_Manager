const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { listOpenCamps, listMyRequests, createRequest } = require('../controllers/requestController');

const router = express.Router();
router.use(requireAuth, requireRole('affectedPerson'));

router.get('/camps', listOpenCamps);
router.get('/requests', listMyRequests);
router.post('/requests', createRequest);

module.exports = router;
