const mongoose = require('mongoose');

// Stores lesson content split into retrieval-sized chunks, each with its own
// embedding vector, so the AI tutor can ground answers in specific passages.
const lessonChunkSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    source: { type: String, enum: ['content', 'attachment'], default: 'content' },
    sourceLabel: { type: String, default: '' },
    attachmentId: { type: mongoose.Schema.Types.ObjectId, default: null },
  },
  { timestamps: true }
);

lessonChunkSchema.index({ course: 1 });
lessonChunkSchema.index({ lesson: 1, chunkIndex: 1 });

module.exports = mongoose.model('LessonChunk', lessonChunkSchema);
