const { body } = require('express-validator');

const createPostValidators = [
  body('content').trim().notEmpty().withMessage('Post content is required'),
  body('parentPost').optional().isMongoId().withMessage('Invalid parent post id'),
];

module.exports = { createPostValidators };
