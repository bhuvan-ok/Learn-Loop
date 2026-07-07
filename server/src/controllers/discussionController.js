const Course = require('../models/Course');
const Lesson = require('../models/Lesson');
const Enrollment = require('../models/Enrollment');
const DiscussionPost = require('../models/DiscussionPost');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { canManageCourse, canDeleteDiscussionPost } = require('../utils/permissions');

// Same audience as the AI tutor: the course's own tutor, any admin, or a
// student actually enrolled in the course. Returns both docs so callers
// don't have to re-fetch them.
async function assertCanAccessLesson(courseId, lessonId, user) {
  const course = await Course.findById(courseId);
  if (!course) throw new ApiError(404, 'Course not found');

  const lesson = await Lesson.findById(lessonId);
  if (!lesson || lesson.course.toString() !== courseId) {
    throw new ApiError(404, 'Lesson not found in this course');
  }

  if (user.role !== 'admin' && !canManageCourse(course, user)) {
    const enrollment = await Enrollment.findOne({ student: user._id, course: courseId });
    if (!enrollment) {
      throw new ApiError(403, 'You must be enrolled in this course to view its discussion');
    }
  }

  return { course, lesson };
}

const listPosts = asyncHandler(async (req, res) => {
  const { courseId, lessonId } = req.params;
  const { course } = await assertCanAccessLesson(courseId, lessonId, req.user);

  const posts = await DiscussionPost.find({ lesson: lessonId })
    .populate('author', 'name role')
    .sort({ createdAt: 1 })
    .lean();

  const withPermissions = posts.map((post) => ({
    ...post,
    canDelete: canDeleteDiscussionPost(post, course, req.user),
  }));

  res.json({ posts: withPermissions });
});

const createPost = asyncHandler(async (req, res) => {
  const { courseId, lessonId } = req.params;
  const { content, parentPost } = req.body;
  await assertCanAccessLesson(courseId, lessonId, req.user);

  if (parentPost) {
    const parent = await DiscussionPost.findById(parentPost);
    if (!parent || parent.lesson.toString() !== lessonId) {
      throw new ApiError(400, 'Parent post not found on this lesson');
    }
  }

  const post = await DiscussionPost.create({
    course: courseId,
    lesson: lessonId,
    author: req.user._id,
    content,
    parentPost: parentPost || null,
  });

  await post.populate('author', 'name role');

  res.status(201).json({ post: { ...post.toObject(), canDelete: true } });
});

const deletePost = asyncHandler(async (req, res) => {
  const { courseId, lessonId, postId } = req.params;
  const { course } = await assertCanAccessLesson(courseId, lessonId, req.user);

  const post = await DiscussionPost.findById(postId);
  if (!post || post.lesson.toString() !== lessonId) {
    throw new ApiError(404, 'Post not found');
  }

  if (!canDeleteDiscussionPost(post, course, req.user)) {
    throw new ApiError(403, 'You do not have permission to delete this post');
  }

  await post.deleteOne();

  res.json({ message: 'Post deleted' });
});

module.exports = { listPosts, createPost, deletePost };
