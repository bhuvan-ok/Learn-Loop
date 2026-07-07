const express = require('express');
const {
  enrollInCourse,
  getMyEnrollments,
  getEnrollmentForCourse,
  completeLesson,
} = require('../controllers/enrollmentController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/me', protect, getMyEnrollments);
router.get('/course/:courseId', protect, getEnrollmentForCourse);
router.post('/course/:courseId', protect, enrollInCourse);
router.post('/course/:courseId/lessons/:lessonId/complete', protect, completeLesson);

module.exports = router;
