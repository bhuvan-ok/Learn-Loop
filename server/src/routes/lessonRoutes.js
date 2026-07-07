const express = require('express');
const {
  listLessonsForCourse,
  getLesson,
  createLesson,
  updateLesson,
  deleteLesson,
  uploadAttachment,
  deleteAttachment,
} = require('../controllers/lessonController');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createLessonValidators, updateLessonValidators } = require('../validators/lessonValidators');
const { upload } = require('../config/upload');

// Mounted twice: nested under /api/courses/:courseId/lessons for list/create,
// and standalone /api/lessons/:id for get/update/delete/attachments.
const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.get('/', listLessonsForCourse);
nestedRouter.post('/', protect, requireRole('tutor', 'admin'), createLessonValidators, validate, createLesson);

const flatRouter = express.Router();
flatRouter.get('/:id', getLesson);
flatRouter.put('/:id', protect, requireRole('tutor', 'admin'), updateLessonValidators, validate, updateLesson);
flatRouter.delete('/:id', protect, requireRole('tutor', 'admin'), deleteLesson);
flatRouter.post(
  '/:id/attachments',
  protect,
  requireRole('tutor', 'admin'),
  upload.single('file'),
  uploadAttachment
);
flatRouter.delete(
  '/:id/attachments/:attachmentId',
  protect,
  requireRole('tutor', 'admin'),
  deleteAttachment
);

module.exports = { nestedRouter, flatRouter };
