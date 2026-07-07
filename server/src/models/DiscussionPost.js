const mongoose = require('mongoose');

const discussionPostSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    parentPost: { type: mongoose.Schema.Types.ObjectId, ref: 'DiscussionPost', default: null },
  },
  { timestamps: true }
);

discussionPostSchema.index({ lesson: 1, createdAt: 1 });
discussionPostSchema.index({ course: 1 });

module.exports = mongoose.model('DiscussionPost', discussionPostSchema);
