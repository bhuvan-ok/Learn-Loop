const Lesson = require('../models/Lesson');
const Course = require('../models/Course');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { assertCanManageCourse, canManageCourse, canAccessCourseContent } = require('../utils/permissions');
const { uploadBufferToCloudinary, deleteFromCloudinary } = require('../config/upload');
const { extractPages, isExtractable } = require('../services/textExtractionService');
const {
  indexLesson,
  removeLessonIndex,
  indexAttachmentText,
  removeAttachmentIndex,
} = require('../services/lessonIndexingService');

// Same nested shape as getCourseById's `lessons` array: full content only for
// an enrolled student, the owning tutor, or an admin — everyone else (this
// route has no auth middleware, so that includes anonymous requests) only
// gets preview-safe metadata. Not currently called by the frontend (course
// detail gets its lesson list from getCourseById instead), but it's still a
// reachable API endpoint returning the same paywalled data, so it needs the
// same guard.
const listLessonsForCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId).lean();
  if (!course) throw new ApiError(404, 'Course not found');

  const isManager = Boolean(req.user) && canManageCourse(course, req.user);
  if (!course.published && !isManager) {
    throw new ApiError(404, 'Course not found');
  }

  const hasFullAccess = isManager || (await canAccessCourseContent(course, req.user));
  const lessons = await Lesson.find({ course: req.params.courseId }).sort({ order: 1 }).lean();

  const responseLessons = hasFullAccess
    ? lessons
    : lessons.map(({ _id, course: courseId, title, order }) => ({ _id, course: courseId, title, order }));

  res.json({ lessons: responseLessons });
});

// Full lesson content (text, video, attachments) — gated the same way
// askQuestion/attemptQuiz gate the AI tutor and quiz attempts: enrolled
// student, owning tutor, or admin only. Route requires `protect` so req.user
// is always populated here.
const getLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id).lean();
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  const course = await Course.findById(lesson.course).lean();
  if (!course) throw new ApiError(404, 'Lesson not found');

  const hasAccess = await canAccessCourseContent(course, req.user);
  if (!hasAccess) {
    throw new ApiError(403, 'You must be enrolled in this course to view this lesson');
  }

  res.json({ lesson });
});

const createLesson = asyncHandler(async (req, res) => {
  const { title, content, order, videoUrl } = req.body;

  await assertCanManageCourse(req.params.courseId, req.user);

  const lastLesson = await Lesson.findOne({ course: req.params.courseId }).sort({ order: -1 });
  const nextOrder = order !== undefined ? order : (lastLesson ? lastLesson.order + 1 : 0);

  const lesson = await Lesson.create({
    course: req.params.courseId,
    title,
    content,
    order: nextOrder,
    videoUrl,
  });

  const chunkCount = await indexLesson(lesson);

  res.status(201).json({ lesson, indexedChunks: chunkCount });
});

const updateLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  await assertCanManageCourse(lesson.course, req.user);

  const { title, content, order, videoUrl } = req.body;
  // The lesson title is part of each chunk's embedded context header, so a
  // rename needs a re-index just like a content edit does.
  const contentChanged =
    (content !== undefined && content !== lesson.content) ||
    (title !== undefined && title !== lesson.title);

  if (title !== undefined) lesson.title = title;
  if (content !== undefined) lesson.content = content;
  if (order !== undefined) lesson.order = order;
  if (videoUrl !== undefined) lesson.videoUrl = videoUrl;

  await lesson.save();

  let chunkCount;
  if (contentChanged) {
    chunkCount = await indexLesson(lesson);
  }

  res.json({ lesson, reindexed: contentChanged, indexedChunks: chunkCount });
});

const deleteLesson = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw new ApiError(404, 'Lesson not found');

  await assertCanManageCourse(lesson.course, req.user);

  await Promise.all(
    lesson.attachments.map((att) => deleteFromCloudinary(att.publicId, att.resourceType))
  );
  await removeLessonIndex(lesson._id);
  await lesson.deleteOne();

  res.json({ message: 'Lesson deleted' });
});

// Accepts a file upload (multer has buffered it in memory by the time this
// runs — see routes/lessonRoutes.js) and streams it to Cloudinary. PDFs and
// plain text/markdown files get their text extracted straight from that same
// buffer, chunked, and embedded so the AI tutor can answer questions grounded
// in the uploaded material, not just the lesson's own hand-typed content.
// Other file types are still stored and downloadable, just not indexed for RAG.
const uploadAttachment = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw new ApiError(404, 'Lesson not found');
  await assertCanManageCourse(lesson.course, req.user);

  if (!req.file) {
    throw new ApiError(400, 'No file was uploaded');
  }

  const result = await uploadBufferToCloudinary(req.file.buffer);

  lesson.attachments.push({
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    indexedForRag: false,
  });
  await lesson.save();

  const attachment = lesson.attachments[lesson.attachments.length - 1];
  let indexedChunks = 0;

  if (isExtractable(attachment.mimetype)) {
    try {
      const pages = await extractPages(req.file.buffer, attachment.mimetype);
      if (pages.some((page) => page.trim())) {
        indexedChunks = await indexAttachmentText(lesson, attachment, pages);
        attachment.indexedForRag = indexedChunks > 0;
        await lesson.save();
      }
    } catch (err) {
      console.warn(`Failed to extract/index attachment ${attachment._id}: ${err.message}`);
    }
  }

  res.status(201).json({ attachment, indexedChunks });
});

const deleteAttachment = asyncHandler(async (req, res) => {
  const lesson = await Lesson.findById(req.params.id);
  if (!lesson) throw new ApiError(404, 'Lesson not found');
  await assertCanManageCourse(lesson.course, req.user);

  const attachment = lesson.attachments.id(req.params.attachmentId);
  if (!attachment) throw new ApiError(404, 'Attachment not found');

  await deleteFromCloudinary(attachment.publicId, attachment.resourceType);
  await removeAttachmentIndex(attachment._id);
  await attachment.deleteOne();
  await lesson.save();

  res.json({ message: 'Attachment deleted' });
});

module.exports = {
  listLessonsForCourse,
  getLesson,
  createLesson,
  updateLesson,
  deleteLesson,
  uploadAttachment,
  deleteAttachment,
};
