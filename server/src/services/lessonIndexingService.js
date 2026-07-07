const chunkText = require('../utils/chunkText');
const { embedBatch } = require('./aiService');
const LessonChunk = require('../models/LessonChunk');

// Re-derives the retrieval index for a lesson's own written content: splits
// it into chunks, embeds them, and replaces any previously stored
// content-sourced chunks. Called whenever a lesson is created or its
// content is edited, so the AI tutor's knowledge stays in sync with what
// tutors actually publish.
//
// Only chunks tagged source:'content' are touched here — attachment-derived
// chunks (from uploaded files) are indexed and cleared independently via
// indexAttachmentText/removeAttachmentIndex, so editing a lesson's text
// never wipes out its uploaded file knowledge.
//
// Embedding requires OPENAI_API_KEY. If it isn't configured yet, lesson
// content should still save (course-building shouldn't be blocked by AI
// setup) — the tutor just won't have this lesson's material to draw on
// until indexing is retried after the key is added.
async function indexLesson(lesson) {
  await LessonChunk.deleteMany({ lesson: lesson._id, source: 'content' });

  const pieces = chunkText(lesson.content);

  let embeddings;
  try {
    embeddings = await embedBatch(pieces);
  } catch (err) {
    console.warn(`Skipping AI indexing for lesson ${lesson._id}: ${err.message}`);
    return 0;
  }

  const docs = pieces.map((text, i) => ({
    lesson: lesson._id,
    course: lesson.course,
    chunkIndex: i,
    text,
    embedding: embeddings[i],
    source: 'content',
  }));

  if (docs.length) {
    await LessonChunk.insertMany(docs);
  }
  return docs.length;
}

async function removeLessonIndex(lessonId) {
  await LessonChunk.deleteMany({ lesson: lessonId });
}

// Indexes text extracted from an uploaded attachment (PDF/txt/markdown) so
// the AI tutor can answer questions grounded in files tutors upload,
// not just hand-typed lesson content.
async function indexAttachmentText(lesson, attachment, text) {
  const pieces = chunkText(text);
  if (!pieces.length) return 0;

  let embeddings;
  try {
    embeddings = await embedBatch(pieces);
  } catch (err) {
    console.warn(`Skipping AI indexing for attachment ${attachment._id}: ${err.message}`);
    return 0;
  }

  const docs = pieces.map((chunkTextValue, i) => ({
    lesson: lesson._id,
    course: lesson.course,
    chunkIndex: i,
    text: chunkTextValue,
    embedding: embeddings[i],
    source: 'attachment',
    sourceLabel: attachment.originalName,
    attachmentId: attachment._id,
  }));

  await LessonChunk.insertMany(docs);
  return docs.length;
}

async function removeAttachmentIndex(attachmentId) {
  await LessonChunk.deleteMany({ attachmentId });
}

module.exports = {
  indexLesson,
  removeLessonIndex,
  indexAttachmentText,
  removeAttachmentIndex,
};
