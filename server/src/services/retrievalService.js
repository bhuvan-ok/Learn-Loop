const mongoose = require('mongoose');
const LessonChunk = require('../models/LessonChunk');

// Retrieval layer with two interchangeable backends:
//   - "atlas": MongoDB Atlas Vector Search ($vectorSearch aggregation stage).
//     Requires an Atlas Search index named "vector_index" on the LessonChunk
//     collection's "embedding" field (numDimensions must match the embedding
//     model, e.g. 1536 for text-embedding-3-small), with "course" indexed as
//     a filter field. This is the production-grade path.
//   - "local": brute-force cosine similarity computed in application code.
//     Works against any MongoDB (including a local/free instance) with no
//     special index, so the project runs without an Atlas account.
// Which backend is used is controlled by VECTOR_SEARCH_MODE and can be
// swapped without touching any calling code.

// Chunks embedded under a different LLM_PROVIDER (and therefore a different
// embedding model/dimensionality) can't be meaningfully compared — rather than
// silently reading undefined/NaN past the shorter vector's end, treat them as
// unrelated (score 0) so a provider switch degrades gracefully instead of
// corrupting rankings.
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

async function retrieveLocal(courseId, queryEmbedding, k) {
  const chunks = await LessonChunk.find({ course: courseId })
    .populate('lesson', 'title')
    .lean();

  const scored = chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

async function retrieveAtlas(courseId, queryEmbedding, k) {
  const results = await LessonChunk.aggregate([
    {
      $vectorSearch: {
        index: 'vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: Math.max(k * 10, 100),
        limit: k,
        filter: { course: new mongoose.Types.ObjectId(courseId) },
      },
    },
    {
      $project: {
        text: 1,
        lesson: 1,
        course: 1,
        chunkIndex: 1,
        source: 1,
        sourceLabel: 1,
        attachmentId: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    },
  ]);

  const populated = await LessonChunk.populate(results, { path: 'lesson', select: 'title' });
  return populated.map((r) => ({ chunk: r, score: r.score }));
}

async function retrieveRelevantChunks(courseId, queryEmbedding, k = 5) {
  const mode = (process.env.VECTOR_SEARCH_MODE || 'local').toLowerCase();
  if (mode === 'atlas') {
    try {
      return await retrieveAtlas(courseId, queryEmbedding, k);
    } catch (err) {
      console.error('Atlas vector search failed, falling back to local cosine similarity:', err.message);
      return retrieveLocal(courseId, queryEmbedding, k);
    }
  }
  return retrieveLocal(courseId, queryEmbedding, k);
}

module.exports = { retrieveRelevantChunks, cosineSimilarity };
