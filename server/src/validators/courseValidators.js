const { body } = require('express-validator');

const createCourseValidators = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').optional().trim(),
  body('thumbnailUrl').optional().trim(),
];

const updateCourseValidators = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('category').optional().trim(),
  body('thumbnailUrl').optional().trim(),
];

module.exports = { createCourseValidators, updateCourseValidators };
