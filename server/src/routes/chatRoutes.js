const express = require('express');
const rateLimit = require('express-rate-limit');
const { askQuestion, getHistory } = require('../controllers/chatController');
const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// The shared global apiLimiter (300 req/15min per IP, see server.js) is far
// too loose for this one endpoint specifically: each call makes a real,
// billed embeddings + LLM completion request. Keyed by authenticated user
// (this route always runs after `protect`, so req.user is set) rather than
// IP, since students on the same campus/office network would otherwise share
// one IP-based quota. Falls back to express-rate-limit's IPv6-safe helper
// only as a defensive measure — protect guarantees req.user is populated
// before this middleware runs.
const askQuestionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'You have sent too many questions to the AI tutor. Please try again later.' },
  keyGenerator: (req) => (req.user ? `user:${req.user._id}` : rateLimit.ipKeyGenerator(req.ip)),
});

router.post('/', protect, askQuestionLimiter, askQuestion);
router.get('/', protect, getHistory);

module.exports = router;
