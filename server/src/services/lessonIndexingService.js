const crypto = require('crypto');
const chunkText = require('../utils/chunkText');
const { chunkDocument, buildEmbedText } = require('../utils/structuredChunker');
const { embedBatch, generateText } = require('./aiService');
const { getRagConfig } = require('../config/ragConfig');
const { currentIndexVersion } = require('./rag/indexVersion');
const LessonChunk = require('../models/LessonChunk');

// Re-derives the retrieval index for a lesson's own written content: splits
// it into chunks, embeds them, and replaces any previously stored
// content-sourced chunks. Called whenever a lesson is created or its
// content/title is edited, so the AI tutor's knowledge stays in sync with what
// tutors actually publish.
//
// Only chunks tagged source:'content' are touched here — attachment-derived
// chunks (from uploaded files) are indexed and cleared independently via
// indexAttachmentText/removeAttachmentIndex, so editing a lesson's text
// never wipes out its uploaded file knowledge.
//
// Embedding requires an embeddings key (GEMINI_API_KEY or OPENAI_API_KEY). If
// it isn't configured, or the provider is down, lesson content should still
// save (course-building shouldn't be blocked by AI setup). Because the new
// chunks are embedded *before* anything is deleted, a failed attempt leaves
// the previous index in place instead of leaving the lesson with no knowledge
// at all; re-saving the lesson (or `npm run reindex`) retries it.

function makePieces(input, { lessonTitle, sourceLabel }, config) {
  if (config.indexing.chunker === 'structured') {
    return chunkDocument(input, { lessonTitle, sourceLabel, plainHeadings: Boolean(sourceLabel) });
  }

  const text = Array.isArray(input) ? input.join('\n\n') : input;
  return chunkText(text).map((piece, i) => ({
    text: piece,
    headingPath: [],
    contextHeader: '',
    overlapLen: 0,
    page: null,
    chunkIndex: i,
  }));
}

// Contextual Retrieval (2024): ask an LLM for one sentence that
// situates the chunk within its document, and index it alongside the chunk.
// One cheap call per chunk at index time; failures just leave the note empty.
async function situateChunks(pieces, documentText, lessonTitle) {
  const document = documentText.slice(0, 12000);
  for (const piece of pieces) {
    try {
      const note = await generateText({
        system:
          'You write search context for chunks of course material. Given a whole document and one chunk from it, ' +
          'write one short sentence that situates the chunk within the document (what topic it belongs to and what it is about) ' +
          'to improve search retrieval. Answer with only that sentence.',
        prompt: `<document title="${lessonTitle}">\n${document}\n</document>\n\n<chunk>\n${piece.text}\n</chunk>`,
        maxTokens: 120,
      });
      piece.contextNote = String(note || '').trim().replace(/\s+/g, ' ').slice(0, 300);
    } catch {
      piece.contextNote = '';
    }
  }
}

async function embedPieces(pieces, config) {
  const texts = pieces.map((piece) =>
    buildEmbedText({
      contextHeader: config.indexing.header ? piece.contextHeader : '',
      contextNote: config.indexing.llmContext ? piece.contextNote : '',
      text: piece.text,
    })
  );
  return embedBatch(texts, { taskType: config.indexing.taskTypes ? 'document' : undefined });
}

// Inserts the new chunk set first, then removes every older chunk of the same
// document, so there is never a moment where the document has no chunks.
async function replaceChunks({ lesson, source, attachment, pieces, embeddings, config }) {
  const indexBatch = crypto.randomUUID();
  const indexVersion = currentIndexVersion(config);

  const docs = pieces.map((piece, i) => ({
    lesson: lesson._id,
    course: lesson.course,
    chunkIndex: i,
    text: piece.text,
    embedding: embeddings[i],
    source,
    sourceLabel: attachment ? attachment.originalName : '',
    attachmentId: attachment ? attachment._id : null,
    headingPath: piece.headingPath || [],
    contextHeader: piece.contextHeader || '',
    contextNote: piece.contextNote || '',
    page: piece.page ?? null,
    overlapLen: piece.overlapLen || 0,
    indexVersion,
    indexBatch,
  }));

  if (docs.length) await LessonChunk.insertMany(docs);

  await LessonChunk.deleteMany({
    lesson: lesson._id,
    source,
    attachmentId: attachment ? attachment._id : null,
    indexBatch: { $ne: indexBatch },
  });
  return docs.length;
}

async function indexLesson(lesson, config = getRagConfig()) {
  const pieces = makePieces(lesson.content, { lessonTitle: lesson.title, sourceLabel: '' }, config);

  if (!pieces.length) {
    await LessonChunk.deleteMany({ lesson: lesson._id, source: 'content' });
    return 0;
  }

  let embeddings;
  try {
    if (config.indexing.llmContext) await situateChunks(pieces, lesson.content, lesson.title);
    embeddings = await embedPieces(pieces, config);
  } catch (err) {
    // console.error (not .warn) plus the actionable message from
    // aiService's getEmbeddingsProvider(): until this is fixed the AI tutor
    // answers from the lesson's previous index (or has none at all for a new
    // lesson), so it needs to be loud rather than an easy-to-miss log line —
    // see the startup check in server.js for the same warning surfaced before
    // any lesson is even saved.
    console.error(
      `AI indexing FAILED for lesson ${lesson._id} — the AI tutor will not see this version of the lesson until indexing succeeds: ${err.message}`
    );
    return 0;
  }

  return replaceChunks({ lesson, source: 'content', attachment: null, pieces, embeddings, config });
}

async function removeLessonIndex(lessonId) {
  await LessonChunk.deleteMany({ lesson: lessonId });
}

// Indexes text extracted from an uploaded attachment (PDF/txt/markdown) so
// the AI tutor can answer questions grounded in files tutors upload,
// not just hand-typed lesson content. `input` is the extracted text, or an
// array of per-page texts for paged documents (enables page citations).
async function indexAttachmentText(lesson, attachment, input, config = getRagConfig()) {
  const pieces = makePieces(
    input,
    { lessonTitle: lesson.title, sourceLabel: attachment.originalName },
    config
  );
  if (!pieces.length) return 0;

  let embeddings;
  try {
    const documentText = Array.isArray(input) ? input.join('\n\n') : input;
    if (config.indexing.llmContext) await situateChunks(pieces, documentText, attachment.originalName);
    embeddings = await embedPieces(pieces, config);
  } catch (err) {
    console.error(
      `AI indexing FAILED for attachment ${attachment._id} — it will not be searchable by the AI tutor until this is fixed: ${err.message}`
    );
    return 0;
  }

  return replaceChunks({ lesson, source: 'attachment', attachment, pieces, embeddings, config });
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
