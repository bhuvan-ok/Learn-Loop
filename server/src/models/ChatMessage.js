const mongoose = require('mongoose');

// Persists AI Tutor Q&A history per student/course, including which lesson
// passages grounded each answer (for transparency and for measuring retrieval
// quality later).
const citedChunkSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    lessonTitle: String,
    chunkIndex: Number,
    text: String,
    score: Number,
    source: { type: String, enum: ['content', 'attachment'], default: 'content' },
    sourceLabel: { type: String, default: '' },
    // Excerpt number the model saw ("E1") — matches the [E1] tags in the answer.
    excerpt: Number,
    contextHeader: { type: String, default: '' },
    page: { type: Number, default: null },
    // True when the model emitted no citation tag and this passage was
    // attached as the closest related source instead.
    inferred: { type: Boolean, default: false },
  },
  { _id: false }
);

const retrievalMetaSchema = new mongoose.Schema(
  {
    pipeline: String,
    standaloneQuestion: String,
    retrievedCount: Number,
    abstained: Boolean,
    llmCalls: Number,
    latencyMs: Number,
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
    retrieval: { type: retrievalMetaSchema, default: undefined },
  },
  { timestamps: true }
);

chatMessageSchema.index({ course: 1, student: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
