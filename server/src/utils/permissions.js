const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const ApiError = require('./ApiError');

// Admins can manage any course; tutors can only manage courses they authored.
// Centralized here so every controller that touches course/lesson/quiz
// ownership applies the exact same rule.
// `course.tutor` may be a plain ObjectId (unpopulated fetch) or a populated
// { _id, name } object (e.g. courseController's `.populate('tutor', 'name')`)
// — handle both so callers don't have to remember to strip populate first.
function canManageCourse(course, user) {
  if (user.role === 'admin') return true;
  const tutorId = course.tutor && course.tutor._id ? course.tutor._id : course.tutor;
  return tutorId.toString() === user._id.toString();
}

// Shared by every controller that needs "fetch the course, then confirm this
// user may manage it" — avoids re-implementing the same 404/403 check per file.
async function assertCanManageCourse(courseId, user) {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found');
  if (!canManageCourse(course, user)) {
    throw new ApiError(403, 'You do not have permission to manage this course');
  }
  return course;
}

// A discussion post can be removed by whoever manages the course (moderation)
// or by the student/tutor who wrote it.
function canDeleteDiscussionPost(post, course, user) {
  return canManageCourse(course, user) || post.author.toString() === user._id.toString();
}

// Whether this user may see a course's full paywalled content — lesson text,
// quiz questions, attachments — rather than just enroll-to-preview metadata.
// True for the course's manager (owning tutor or any admin) or a student
// enrolled in it; false for anonymous/unauthenticated requesters. Centralized
// here so getCourseById, getLesson, and getQuizForStudent all enforce the
// exact same rule the way askQuestion/attemptQuiz already enforce enrollment.
async function canAccessCourseContent(course, user) {
  if (!user) return false;
  if (canManageCourse(course, user)) return true;
  const enrollment = await Enrollment.findOne({ student: user._id, course: course._id });
  return Boolean(enrollment);
}

module.exports = {
  canManageCourse,
  assertCanManageCourse,
  canDeleteDiscussionPost,
  canAccessCourseContent,
};
