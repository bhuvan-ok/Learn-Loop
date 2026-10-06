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
const { protect, requireRole, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createLessonValidators, updateLessonValidators } = require('../validators/lessonValidators');
const { upload } = require('../config/upload');

// Mounted twice: nested under /api/courses/:courseId/lessons for list/create,
// and standalone /api/lessons/:id for get/update/delete/attachments.
const nestedRouter = express.Router({ mergeParams: true });
// optionalAuth so the controller can tell an enrolled student/owning
// tutor/admin apart from an anonymous or non-enrolled request and gate full
// lesson content accordingly, while still allowing anonymous browsing.
nestedRouter.get('/', optionalAuth, listLessonsForCourse);
nestedRouter.post('/', protect, requireRole('tutor', 'admin'), createLessonValidators, validate, createLesson);

const flatRouter = express.Router();
// protect (not optionalAuth): this endpoint returns full lesson content and
// is only ever reached from an "Enroll to view"-gated link, so an
// unauthenticated caller is a hard 401, same as the AI tutor/quiz-attempt
// endpoints.
flatRouter.get('/:id', protect, getLesson);
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
