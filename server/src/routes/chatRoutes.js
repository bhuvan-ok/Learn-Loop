const express = require('express');
const { askQuestion, getHistory } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
router.post('/', protect, askQuestion);
router.get('/', protect, getHistory);

module.exports = router;
