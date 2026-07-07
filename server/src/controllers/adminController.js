const User = require('../models/User');
const Course = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const QuizAttempt = require('../models/QuizAttempt');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// Publishing/deleting a specific course is handled by the existing
// PATCH/DELETE /api/courses/:id routes — canManageCourse() already lets
// admins bypass the tutor-ownership check, so no separate admin route is
// needed for those actions. This controller only covers what genuinely
// requires an admin-wide view: platform stats, user management, and
// listing every course regardless of author or publish state.

const getStats = asyncHandler(async (req, res) => {
  const [usersByRole, totalCourses, publishedCourses, totalEnrollments, totalQuizAttempts] =
    await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
      Course.countDocuments(),
      Course.countDocuments({ published: true }),
      Enrollment.countDocuments(),
      QuizAttempt.countDocuments(),
    ]);

  const roleCounts = { admin: 0, student: 0, tutor: 0 };
  usersByRole.forEach((r) => {
    roleCounts[r._id] = r.count;
  });

  res.json({
    users: {
      total: roleCounts.admin + roleCounts.student + roleCounts.tutor,
      ...roleCounts,
    },
    courses: { total: totalCourses, published: publishedCourses, draft: totalCourses - publishedCourses },
    totalEnrollments,
    totalQuizAttempts,
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
  res.json({ users });
});

const setUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'student', 'tutor'].includes(role)) {
    throw new ApiError(400, 'Role must be admin, student, or tutor');
  }
  if (req.params.id === req.user._id.toString()) {
    throw new ApiError(400, 'You cannot change your own role');
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new ApiError(404, 'User not found');

  if (user.role === 'admin' && role !== 'admin') {
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount <= 1) {
      throw new ApiError(400, 'Cannot remove the last remaining admin');
    }
  }

  user.role = role;
  await user.save();

  res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});

// Every course regardless of tutor or publish state — the tutor-facing
// /api/courses/mine only shows courses the caller personally authored.
const listAllCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find().populate('tutor', 'name email').sort({ createdAt: -1 }).lean();
  res.json({ courses });
});

module.exports = { getStats, listUsers, setUserRole, listAllCourses };
