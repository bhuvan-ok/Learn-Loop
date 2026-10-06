require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const courseRoutes = require('./routes/courseRoutes');
const { nestedRouter: nestedLessonRoutes, flatRouter: flatLessonRoutes } = require('./routes/lessonRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const { nestedRouter: nestedQuizRoutes, flatRouter: flatQuizRoutes } = require('./routes/quizRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const discussionRoutes = require('./routes/discussionRoutes');

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
// The AI tutor's chat endpoint streams Server-Sent Events; buffering that
// through compression breaks the event framing, so it's excluded here.
app.use(
  compression({
    filter: (req, res) =>
      req.method === 'POST' && /\/chat$/.test(req.path) ? false : compression.filter(req, res),
  })
);
if (!process.env.CLIENT_ORIGIN && process.env.NODE_ENV === 'production') {
  console.warn('CLIENT_ORIGIN is not set — CORS is falling back to "*" (any origin) in production.');
}
// Embeddings (lesson/attachment indexing + AI tutor retrieval) require
// GEMINI_API_KEY or OPENAI_API_KEY regardless of LLM_PROVIDER — Anthropic has
// no embeddings API, so ANTHROPIC_API_KEY alone (even with the default
// LLM_PROVIDER=anthropic) is not enough. Surfacing this at boot means an
// operator finds out immediately instead of only after a tutor creates a
// lesson and the AI tutor silently has nothing indexed to answer from.
if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
  console.warn(
    'Neither GEMINI_API_KEY nor OPENAI_API_KEY is set — the AI tutor will not work (embeddings for ' +
      'lesson indexing and question retrieval require one of these regardless of LLM_PROVIDER).'
  );
}
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json({ limit: '2mb' }));
app.use(mongoSanitize());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Please try again later.' },
});
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/courses/:courseId/lessons', nestedLessonRoutes);
app.use('/api/lessons', flatLessonRoutes);
app.use('/api/courses/:courseId/lessons/:lessonId/discussions', discussionRoutes);
app.use('/api/courses/:courseId/quizzes', nestedQuizRoutes);
app.use('/api/quizzes', flatQuizRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/courses/:courseId/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/certificates', certificateRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
