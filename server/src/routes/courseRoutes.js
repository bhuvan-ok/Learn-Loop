const express = require('express');
const {
  listCourses,
  listMyCourses,
  getCourseById,
  createCourse,
  updateCourse,
  setPublishStatus,
  deleteCourse,
} = require('../controllers/courseController');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createCourseValidators, updateCourseValidators } = require('../validators/courseValidators');

const router = express.Router();

router.get('/', listCourses);
router.get('/mine', protect, requireRole('tutor', 'admin'), listMyCourses);
router.get('/:id', getCourseById);
router.post('/', protect, requireRole('tutor', 'admin'), createCourseValidators, validate, createCourse);
router.put('/:id', protect, requireRole('tutor', 'admin'), updateCourseValidators, validate, updateCourse);
router.patch('/:id/publish', protect, requireRole('tutor', 'admin'), setPublishStatus);
router.delete('/:id', protect, requireRole('tutor', 'admin'), deleteCourse);

module.exports = router;
