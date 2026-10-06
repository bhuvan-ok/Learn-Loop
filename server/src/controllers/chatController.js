const Enrollment = require('../models/Enrollment');
const ChatMessage = require('../models/ChatMessage');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { askTutor } = require('../services/ragService');

const HISTORY_TURNS = 3;

const askQuestion = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { question } = req.body;

  if (!question || !question.trim()) {
    throw new ApiError(400, 'Question text is required');
  }

  const enrollment = await Enrollment.findOne({ student: req.user._id, course: courseId });
  if (!enrollment) {
    throw new ApiError(403, 'You must be enrolled in this course to ask the AI tutor');
  }

  // Stream the answer to the client as Server-Sent Events, token by token,
  // instead of making the student wait for the full response.
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // If the client disconnects mid-stream (tab closed, navigation away),
  // res.write() on a dead connection either throws or emits an unhandled
  // 'error' event — either of which would otherwise crash the whole process
  // rather than just failing this one request.
  //
  // The abort signal also cancels the upstream LLM request, so tokens aren't
  // generated (and billed) for a student who has already left.
  let clientGone = false;
  const abortController = new AbortController();
  res.on('close', () => {
    clientGone = true;
    if (!res.writableEnded) abortController.abort();
  });
  res.on('error', () => {
    clientGone = true;
    abortController.abort();
  });

  const send = (data) => {
    if (clientGone) return;
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      clientGone = true;
    }
  };

  try {
    // The last few turns let the tutor resolve follow-ups ("what about the
    // second one?") instead of treating every question as standalone.
    const recent = await ChatMessage.find({ course: courseId, student: req.user._id })
      .sort({ createdAt: -1 })
      .limit(HISTORY_TURNS)
      .select('question answer')
      .lean();

    const result = await askTutor({
      courseId,
      studentId: req.user._id,
      question: question.trim(),
      history: recent.reverse(),
      onToken: (token) => send({ token }),
      signal: abortController.signal,
    });
    send({ done: true, citations: result.citations, chatMessageId: result.chatMessageId });
  } catch (err) {
    // Upstream AI provider failures (bad/missing key, rate limit, outage) should
    // never leak raw provider error text to students — log it for the operator
    // and surface a clean, generic message instead.
    console.error('AI tutor request failed:', err.message);
    send({ error: 'The AI tutor is temporarily unavailable. Please try again shortly.' });
  } finally {
    if (!clientGone) res.end();
  }
});

const getHistory = asyncHandler(async (req, res) => {
  const messages = await ChatMessage.find({
    course: req.params.courseId,
    student: req.user._id,
  })
    .sort({ createdAt: 1 })
    .lean();

  res.json({ messages });
});

module.exports = { askQuestion, getHistory };
