const express = require('express');
const router = express.Router();
const { getAllReports } = require('../controllers/reportController');
const { auth, requireRoles } = require('../middlewares/auth');

// Protect all reports (admin only)
router.use(auth(), requireRoles('admin'));
router.get('/', getAllReports); // Single endpoint for all reports

module.exports = router;