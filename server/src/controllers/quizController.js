const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { assertCanManageCourse, canManageCourse, canAccessCourseContent } = require('../utils/permissions');

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

// Same idea as listLessonsForCourse: not currently linked from the frontend
// (course detail gets quizzes from getCourseById instead), but still a live,
// unauthenticated-by-default API endpoint, so it gets the same preview gate —
// full question text/options only for enrolled students, owning tutor, or
// admin; everyone else just learns the quiz exists.
const listQuizzesForCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId).lean();
  if (!course) throw new ApiError(404, 'Course not found');

  const isManager = Boolean(req.user) && canManageCourse(course, req.user);
  if (!course.published && !isManager) {
    throw new ApiError(404, 'Course not found');
  }

  const hasFullAccess = isManager || (await canAccessCourseContent(course, req.user));
  const quizzes = await Quiz.find({ course: req.params.courseId })
    .select('-questions.correctOptionIndex')
    .lean();

  const responseQuizzes = hasFullAccess
    ? quizzes
    : quizzes.map(({ _id, course: courseId, lesson, title, questions }) => ({
        _id,
        course: courseId,
        lesson,
        title,
        questionCount: questions.length,
      }));

  res.json({ quizzes: responseQuizzes });
});

// Tutor/admin-only view that includes correct answers (for editing/review).
const getQuizWithAnswers = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id);
  if (!quiz) throw new ApiError(404, 'Quiz not found');

  await assertCanManageCourse(quiz.course, req.user);

  res.json({ quiz });
});

// Full quiz (questions + options, minus correctOptionIndex) — gated the same
// way askQuestion/attemptQuiz gate the AI tutor and quiz attempts: enrolled
// student, owning tutor, or admin only. Route requires `protect` so req.user
// is always populated here.
const getQuizForStudent = asyncHandler(async (req, res) => {
  const quiz = await Quiz.findById(req.params.id).select('-questions.correctOptionIndex').lean();
  if (!quiz) throw new ApiError(404, 'Quiz not found');

  const course = await Course.findById(quiz.course).lean();
  if (!course) throw new ApiError(404, 'Quiz not found');

  const hasAccess = await canAccessCourseContent(course, req.user);
  if (!hasAccess) {
    throw new ApiError(403, 'You must be enrolled in this course to view this quiz');
  }

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
