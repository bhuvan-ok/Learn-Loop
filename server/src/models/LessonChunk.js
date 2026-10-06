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

    // Structure captured by the structure-aware chunker. All optional so chunks
    // created by the original chunker (or before these fields existed) remain
    // valid.
    headingPath: { type: [String], default: [] },
    // "Lesson > Section" breadcrumb (plus file name for attachments). Prepended
    // to the text that was embedded and to the BM25 document.
    contextHeader: { type: String, default: '' },
    // Optional LLM-written sentence situating the chunk within its lesson.
    contextNote: { type: String, default: '' },
    page: { type: Number, default: null },
    // Length of the leading text duplicated from the previous chunk (sentence
    // overlap), used to stitch neighbouring chunks without repeating text.
    overlapLen: { type: Number, default: 0 },

    // Identifies how this chunk was produced (chunker/header/task-type settings
    // + embedding model). Chunks with different versions in one course were
    // embedded differently and shouldn't be compared; the retrieval layer warns
    // when it sees a mix, and `npm run reindex` fixes it.
    indexVersion: { type: String, default: 'legacy' },
    // Groups the chunks written by one indexing run so a re-index can insert
    // the new set first and only then delete the old one.
    indexBatch: { type: String, default: '' },
  },
  { timestamps: true }
);

lessonChunkSchema.index({ course: 1 });
lessonChunkSchema.index({ lesson: 1, chunkIndex: 1 });
lessonChunkSchema.index({ lesson: 1, attachmentId: 1, chunkIndex: 1 });

module.exports = mongoose.model('LessonChunk', lessonChunkSchema);
