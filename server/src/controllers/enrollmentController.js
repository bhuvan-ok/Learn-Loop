const mongoose = require('mongoose');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Certificate = require('../models/Certificate');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

const enrollInCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course || !course.published) {
    throw new ApiError(404, 'Course not found');
  }

  const existing = await Enrollment.findOne({ student: req.user._id, course: course._id });
  if (existing) {
    return res.status(200).json({ enrollment: existing, alreadyEnrolled: true });
  }

  // Two concurrent enroll requests (double-click, two tabs) can both pass the
  // `!existing` check above and both attempt to create — the unique
  // (student, course) index then rejects the second with a duplicate-key
  // error, which is really just "already enrolled" and should be handled
  // the same way as the check above, not surfaced as a 500.
  let enrollment;
  try {
    enrollment = await Enrollment.create({
      student: req.user._id,
      course: course._id,
      completedLessons: [],
      progressPercent: 0,
    });
  } catch (err) {
    if (err.code === 11000) {
      enrollment = await Enrollment.findOne({ student: req.user._id, course: course._id });
      return res.status(200).json({ enrollment, alreadyEnrolled: true });
    }
    throw err;
  }

  res.status(201).json({ enrollment, alreadyEnrolled: false });
});

const getMyEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ student: req.user._id })
    .populate('course', 'title description category thumbnailUrl')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ enrollments });
});

const getEnrollmentForCourse = asyncHandler(async (req, res) => {
  const enrollment = await Enrollment.findOne({
    student: req.user._id,
    course: req.params.courseId,
  }).lean();

  if (!enrollment) {
    return res.json({ enrollment: null });
  }
  res.json({ enrollment });
});

const completeLesson = asyncHandler(async (req, res) => {
  const { courseId, lessonId } = req.params;

  const lesson = await Lesson.findById(lessonId);
  if (!lesson || lesson.course.toString() !== courseId) {
    throw new ApiError(404, 'Lesson not found in this course');
  }

  const existing = await Enrollment.findOne({ student: req.user._id, course: courseId });
  if (!existing) {
    throw new ApiError(400, 'You are not enrolled in this course');
  }

  const totalLessons = await Lesson.countDocuments({ course: courseId });

  // A plain load -> mutate completedLessons -> save() round-trip is vulnerable
  // to a lost update: two lessons completed concurrently (two tabs, a fast
  // double-click) can both read the same array, each push their own lesson,
  // and whichever save() lands second silently overwrites the first's
  // completion. Doing the add-and-recompute as a single atomic aggregation-
  // pipeline update means MongoDB serializes the two operations itself, so
  // neither can lose the other's write.
  const enrollment = await Enrollment.findOneAndUpdate(
    { student: req.user._id, course: courseId },
    [
      {
        $set: {
          completedLessons: {
            $setUnion: ['$completedLessons', [new mongoose.Types.ObjectId(lessonId)]],
          },
        },
      },
      {
        $set: {
          progressPercent: totalLessons
            ? { $round: [{ $multiply: [{ $divide: [{ $size: '$completedLessons' }, totalLessons] }, 100] }, 0] }
            : 0,
        },
      },
    ],
    { new: true }
  );

  if (enrollment.progressPercent === 100) {
    // upsert here has the same TOCTOU shape as enrollInCourse above — two
    // lessons finishing concurrently could both try to create the first
    // Certificate for this (student, course) pair. The unique index makes
    // the loser's insert throw a duplicate-key error, which just means the
    // certificate already exists (the outcome we wanted anyway).
    try {
      await Certificate.findOneAndUpdate(
        { student: req.user._id, course: courseId },
        {},
        { upsert: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      if (err.code !== 11000) throw err;
    }
  }

  res.json({ enrollment });
});

module.exports = {
  enrollInCourse,
  getMyEnrollments,
  getEnrollmentForCourse,
  completeLesson,
};
