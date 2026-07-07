const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Quiz = require('../models/Quiz');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { assertCanManageCourse } = require('../utils/permissions');
const { deleteCourseCascade } = require('../services/courseService');

// Public catalog: only published courses, with optional text search + category filter.
const listCourses = asyncHandler(async (req, res) => {
  const { search, category } = req.query;
  const filter = { published: true };
  if (category) filter.category = category;
  if (search) filter.$text = { $search: search };

  const courses = await Course.find(filter)
    .populate('tutor', 'name')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ courses });
});

// A tutor's (or admin's) own authored courses, published or not.
const listMyCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({ tutor: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ courses });
});

const getCourseById = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id).populate('tutor', 'name').lean();
  if (!course) throw new ApiError(404, 'Course not found');

  const lessons = await Lesson.find({ course: course._id }).sort({ order: 1 }).lean();
  const quizzes = await Quiz.find({ course: course._id }).select('-questions.correctOptionIndex').lean();

  res.json({ course, lessons, quizzes });
});

const createCourse = asyncHandler(async (req, res) => {
  const { title, description, category, thumbnailUrl } = req.body;

  const course = await Course.create({
    title,
    description,
    category,
    thumbnailUrl,
    tutor: req.user._id,
  });

  res.status(201).json({ course });
});

const updateCourse = asyncHandler(async (req, res) => {
  const course = await assertCanManageCourse(req.params.id, req.user);

  const { title, description, category, thumbnailUrl } = req.body;
  if (title !== undefined) course.title = title;
  if (description !== undefined) course.description = description;
  if (category !== undefined) course.category = category;
  if (thumbnailUrl !== undefined) course.thumbnailUrl = thumbnailUrl;

  await course.save();
  res.json({ course });
});

const setPublishStatus = asyncHandler(async (req, res) => {
  const course = await assertCanManageCourse(req.params.id, req.user);

  course.published = Boolean(req.body.published);
  await course.save();
  res.json({ course });
});

const deleteCourse = asyncHandler(async (req, res) => {
  const course = await assertCanManageCourse(req.params.id, req.user);

  const result = await deleteCourseCascade(course);
  res.json({ message: 'Course deleted', ...result });
});

module.exports = {
  listCourses,
  listMyCourses,
  getCourseById,
  createCourse,
  updateCourse,
  setPublishStatus,
  deleteCourse,
};
