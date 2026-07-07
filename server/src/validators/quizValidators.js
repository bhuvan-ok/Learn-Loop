const { body } = require('express-validator');

const createQuizValidators = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('questions').isArray({ min: 1 }).withMessage('At least one question is required'),
  body('questions.*.questionText').trim().notEmpty().withMessage('Each question needs text'),
  body('questions.*.options')
    .isArray({ min: 2 })
    .withMessage('Each question needs at least 2 options'),
  body('questions.*.correctOptionIndex')
    .isInt({ min: 0 })
    .withMessage('correctOptionIndex must be a non-negative integer')
    .custom((value, { req, path }) => {
      const match = path.match(/questions[.[](\d+)/);
      const index = Number(match[1]);
      const question = req.body.questions[index];
      if (!Array.isArray(question.options) || value >= question.options.length) {
        throw new Error('correctOptionIndex must point to a valid option');
      }
      return true;
    }),
];

module.exports = { createQuizValidators };
