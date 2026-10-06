const express = require('express');
const {
  createQuiz,
  listQuizzesForCourse,
  getQuizWithAnswers,
  getQuizForStudent,
  attemptQuiz,
  getMyAttempts,
} = require('../controllers/quizController');
const { protect, requireRole, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createQuizValidators } = require('../validators/quizValidators');

const nestedRouter = express.Router({ mergeParams: true });
// optionalAuth so the controller can distinguish an enrolled/managing caller
// from an anonymous/non-enrolled one and gate full quiz content accordingly.
nestedRouter.get('/', optionalAuth, listQuizzesForCourse);
nestedRouter.post('/', protect, requireRole('tutor', 'admin'), createQuizValidators, validate, createQuiz);

const flatRouter = express.Router();
// protect (not optionalAuth): only ever reached from an "Enroll to
// take"-gated link, so an unauthenticated caller is a hard 401.
flatRouter.get('/:id', protect, getQuizForStudent);
flatRouter.get('/:id/answers', protect, requireRole('tutor', 'admin'), getQuizWithAnswers);
flatRouter.post('/:id/attempt', protect, attemptQuiz);
flatRouter.get('/:id/my-attempts', protect, getMyAttempts);

module.exports = { nestedRouter, flatRouter };
