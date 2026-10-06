// Frozen snapshot of the original RAG pipeline (initial commit). See README.md.
const LessonChunk = require('../../src/models/LessonChunk');
const { embedText, embedBatch } = require('../../src/services/aiService');
const chunkText = require('./chunkText');

const MIN_RELEVANCE_SCORE = 0.15;
const TOP_K = 5;

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Original lesson indexing: chunk, embed (no task type), insert.
async function indexLessonBaseline(lesson) {
  await LessonChunk.deleteMany({ lesson: lesson._id, source: 'content' });
  const pieces = chunkText(lesson.content);
  const embeddings = await embedBatch(pieces);
  const docs = pieces.map((text, i) => ({
    lesson: lesson._id,
    course: lesson.course,
    chunkIndex: i,
    text,
    embedding: embeddings[i],
    source: 'content',
  }));
  if (docs.length) await LessonChunk.insertMany(docs);
  return docs.length;
}

async function indexAttachmentBaseline(lesson, attachment, text) {
  const pieces = chunkText(text);
  if (!pieces.length) return 0;
  const embeddings = await embedBatch(pieces);
  const docs = pieces.map((piece, i) => ({
    lesson: lesson._id,
    course: lesson.course,
    chunkIndex: i,
    text: piece,
    embedding: embeddings[i],
    source: 'attachment',
    sourceLabel: attachment.originalName,
    attachmentId: attachment._id,
  }));
  await LessonChunk.insertMany(docs);
  return docs.length;
}

// Original retrieval: embed the question as-is, score every chunk of the course
// by cosine similarity, take the top 5. `signal` is the cosine score; the
// original pipeline refused only when no chunk reached MIN_RELEVANCE_SCORE.
async function retrieveBaseline({ courseId, question }) {
  const started = Date.now();
  const queryEmbedding = await embedText(question);
  const chunks = await LessonChunk.find({ course: courseId }).lean();

  const ranked = chunks
    .map((chunk) => ({ chunk, score: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map(({ chunk, score }) => ({
      id: String(chunk._id),
      chunk: {
        id: String(chunk._id),
        lesson: String(chunk.lesson),
        attachmentId: chunk.attachmentId ? String(chunk.attachmentId) : null,
        text: chunk.text,
      },
      scores: { dense: score },
      signal: score,
    }));

  const context = ranked.filter((r) => r.signal >= MIN_RELEVANCE_SCORE);
  return {
    abstain: context.length === 0,
    ranked,
    context,
    signalKind: 'dense',
    trace: { pipeline: 'basic', llmCalls: 0, standaloneQuestion: question, timingsMs: { total: Date.now() - started } },
  };
}

module.exports = { indexLessonBaseline, indexAttachmentBaseline, retrieveBaseline, MIN_RELEVANCE_SCORE };
