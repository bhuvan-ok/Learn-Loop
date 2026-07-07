const Course = require('../models/Course');
const ApiError = require('./ApiError');

// Admins can manage any course; tutors can only manage courses they authored.
// Centralized here so every controller that touches course/lesson/quiz
// ownership applies the exact same rule.
function canManageCourse(course, user) {
  if (user.role === 'admin') return true;
  return course.tutor.toString() === user._id.toString();
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

module.exports = { canManageCourse, assertCanManageCourse, canDeleteDiscussionPost };
