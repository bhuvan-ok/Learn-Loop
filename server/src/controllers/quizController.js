const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Enrollment = require('../models/Enrollment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { assertCanManageCourse } = require('../utils/permissions');

const createQuiz = asyncHandler(async (req, res) => {
  await assertCanManageCourse(req.params.courseId, req.user);

  const { title, lesson, questions } = req.body;

  const quiz = await Quiz.create({
    course: req.params.courseId,
    lesson: lesson || null,
    title,
    questions,
  });

  res.status(201).json({ quiz });
});

const listQuizzesForCourse = asyncHandler(async (req, res) => {
  const quizzes = await Quiz.find({ course: req.params.courseId })
    .select('-questions.correctOptionIndex')
    .lean();
  res.json({ quizzes });
});

// Tutor/admin-only view that includes correct answers (for editing/review).
const getQuizWithAnswers = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw new ApiError(404, 'Quiz not found');

  await assertCanManageCourse(quiz.course, req.user);

  res.json({ quiz });
});

const getQuizForStudent = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id).select('-questions.correctOptionIndex').lean();
  if (!quiz) throw new ApiError(404, 'Quiz not found');
  res.json({ quiz });
});

const attemptQuiz = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw new ApiError(404, 'Quiz not found');

  const enrollment = await Enrollment.findOne({ student: req.user._id, course: quiz.course });
  if (!enrollment) {
    throw new ApiError(400, 'You must be enrolled in this course to attempt its quizzes');
  }

  const { answers } = req.body;
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    throw new ApiError(400, `Expected ${quiz.questions.length} answers`);
  }

  let score = 0;
  const breakdown = quiz.questions.map((q, i) => {
    const correct = answers[i] === q.correctOptionIndex;
    if (correct) score += 1;
    return {
      questionText: q.questionText,
      yourAnswer: answers[i],
      correctOptionIndex: q.correctOptionIndex,
      correct,
    };
  });

  const attempt = await QuizAttempt.create({
    quiz: quiz._id,
    student: req.user._id,
    answers,
    score,
    total: quiz.questions.length,
  });

  res.status(201).json({ attempt, breakdown });
});

const getMyAttempts = asyncHandler(async (req, res) => {
  const attempts = await QuizAttempt.find({ quiz: req.params.id, student: req.user._id })
    .sort({ createdAt: -1 })
    .lean();
  res.json({ attempts });
});

module.exports = {
  createQuiz,
  listQuizzesForCourse,
  getQuizWithAnswers,
  getQuizForStudent,
  attemptQuiz,
  getMyAttempts,
};
