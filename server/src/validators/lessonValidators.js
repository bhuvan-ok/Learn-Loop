const { body } = require('express-validator');

const createLessonValidators = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('content').trim().notEmpty().withMessage('Content is required'),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
  body('videoUrl').optional().trim(),
];

const updateLessonValidators = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('content').optional().trim().notEmpty().withMessage('Content cannot be empty'),
  body('order').optional().isInt({ min: 0 }).withMessage('Order must be a non-negative integer'),
  body('videoUrl').optional().trim(),
];

module.exports = { createLessonValidators, updateLessonValidators };
