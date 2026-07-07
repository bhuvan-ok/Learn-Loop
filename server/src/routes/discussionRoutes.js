const express = require('express');
const { listPosts, createPost, deletePost } = require('../controllers/discussionController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createPostValidators } = require('../validators/discussionValidators');

const router = express.Router({ mergeParams: true });

router.get('/', protect, listPosts);
router.post('/', protect, createPostValidators, validate, createPost);
router.delete('/:postId', protect, deletePost);

module.exports = router;
