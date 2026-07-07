const express = require('express');
const {
  createQuiz,
  listQuizzesForCourse,
  getQuizWithAnswers,
  getQuizForStudent,
  attemptQuiz,
  getMyAttempts,
} = require('../controllers/quizController');
const { protect, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createQuizValidators } = require('../validators/quizValidators');

const nestedRouter = express.Router({ mergeParams: true });
nestedRouter.get('/', listQuizzesForCourse);
nestedRouter.post('/', protect, requireRole('tutor', 'admin'), createQuizValidators, validate, createQuiz);

const flatRouter = express.Router();
flatRouter.get('/:id', getQuizForStudent);
flatRouter.get('/:id/answers', protect, requireRole('tutor', 'admin'), getQuizWithAnswers);
flatRouter.post('/:id/attempt', protect, attemptQuiz);
flatRouter.get('/:id/my-attempts', protect, getMyAttempts);

module.exports = { nestedRouter, flatRouter };
