const express = require('express');
const { requireAuth } = require('../middleware/auth');
const {
  createRequest,
  getUserRequests,
} = require('../controllers/requestController');

const router = express.Router();

router.use(requireAuth);

// Citizen / user: view own requests & complaints
router.get('/my', getUserRequests);

// Citizen / user: submit a new request or complaint
router.post('/', createRequest);

module.exports = router;
