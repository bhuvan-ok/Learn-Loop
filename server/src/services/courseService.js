const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const LessonChunk = require('../models/LessonChunk');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Enrollment = require('../models/Enrollment');
const ChatMessage = require('../models/ChatMessage');
const { deleteFromCloudinary } = require('../config/upload');

// Deletes a course and everything hanging off it — lessons, their RAG
// chunks, quizzes and attempts, enrollments, chat history, and any files
// uploaded as lesson attachments. Shared by the tutor-facing and admin
// course controllers so both delete paths stay in sync.
async function deleteCourseCascade(course) {
  const lessons = await Lesson.find({ course: course._id }).select('_id attachments');
  const quizzes = await Quiz.find({ course: course._id }).select('_id');

  const fileDeletes = lessons.flatMap((lesson) =>
    lesson.attachments.map((att) => deleteFromCloudinary(att.publicId, att.resourceType))
  );

  await Promise.all([
    ...fileDeletes,
    Lesson.deleteMany({ course: course._id }),
    LessonChunk.deleteMany({ course: course._id }),
    QuizAttempt.deleteMany({ quiz: { $in: quizzes.map((q) => q._id) } }),
    Quiz.deleteMany({ course: course._id }),
    Enrollment.deleteMany({ course: course._id }),
    ChatMessage.deleteMany({ course: course._id }),
  ]);

  await course.deleteOne();

  return { deletedLessons: lessons.length, deletedQuizzes: quizzes.length };
}

module.exports = { deleteCourseCascade };
