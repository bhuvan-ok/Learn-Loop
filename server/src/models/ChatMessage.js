const mongoose = require('mongoose');

// Persists AI Tutor Q&A history per student/course, including which lesson
// chunks were retrieved and cited to ground each answer (for transparency
// and for measuring retrieval quality later).
const citedChunkSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    lessonTitle: String,
    chunkIndex: Number,
    text: String,
    score: Number,
    source: { type: String, enum: ['content', 'attachment'], default: 'content' },
    sourceLabel: { type: String, default: '' },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    citedChunks: { type: [citedChunkSchema], default: [] },
  },
  { timestamps: true }
);

chatMessageSchema.index({ course: 1, student: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
