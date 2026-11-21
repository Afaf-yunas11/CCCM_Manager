const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const c = require('../controllers/managerController');

const router = express.Router();
router.use(requireAuth, requireRole('campManager'));

// Express 5 forwards rejected promises to the error handler in app.js.
router.get('/disasters', c.listActiveDisasters);
router.post('/calculator', c.calculator);
router.post('/site-data', c.siteData);
router.post('/assessments', c.createAssessment);
router.get('/assessments', c.listAssessments);
router.post('/camps', c.createCamp);
router.get('/camps', c.listCamps);
router.patch('/camps/:id', c.updateCamp);
router.patch('/camps/:id/offers/:offerId', c.updateCampSupportOffer);
router.get('/requests', c.listCampRequests);
router.patch('/requests/:id', c.updateRequestStatus);
router.get('/ngo-complaints', c.listNgoComplaints);
router.post('/ngo-complaints', c.createNgoComplaint);
router.patch('/ngo-complaints/:id', c.updateNgoComplaintStatus);

module.exports = router;
