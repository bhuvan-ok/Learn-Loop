const express = require('express');
const { getMyCertificateForCourse } = require('../controllers/certificateController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/course/:courseId', protect, getMyCertificateForCourse);

module.exports = router;
