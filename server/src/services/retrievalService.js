const mongoose = require('mongoose');
const LessonChunk = require('../models/LessonChunk');

// Dense (vector) retrieval with two interchangeable backends:
//   - "atlas": MongoDB Atlas Vector Search ($vectorSearch aggregation stage).
//     Requires an Atlas Search index named "vector_index" on the LessonChunk
//     collection's "embedding" field (numDimensions must match the embedding
//     model — 3072 for gemini-embedding-001, 1536 for text-embedding-3-small),
//     with "course" indexed as a filter field. See server/atlas/ for index
//     definitions. Approximate nearest-neighbour, so scores/ranks can differ
//     slightly from the exact local search.
//   - "local": exact brute-force cosine similarity computed in-process by the
//     cached CourseIndex. Works against any MongoDB (including a local/free
//     instance) with no special index, so the project runs without an Atlas
//     account.
// Which backend is used is controlled by VECTOR_SEARCH_MODE and can be
// swapped without touching any calling code. Both return the same shape:
// [{ index, score }] where `index` addresses CourseIndex.chunks and `score` is
// cosine similarity.

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

async function denseAtlas(courseIndex, queryEmbedding, k) {
  const results = await LessonChunk.aggregate([
    {
      $vectorSearch: {
        index: 'vector_index',
        path: 'embedding',
        queryVector: queryEmbedding,
        numCandidates: Math.max(k * 10, 100),
        limit: k,
        filter: { course: new mongoose.Types.ObjectId(courseIndex.courseId) },
      },
    },
    { $project: { _id: 1, score: { $meta: 'vectorSearchScore' } } },
  ]);

  return results
    .map((r) => ({ index: courseIndex.indexById.get(String(r._id)), score: r.score }))
    .filter((r) => r.index !== undefined)
    // Atlas reports cosine as (1 + cos) / 2; convert back so thresholds mean
    // the same thing in both modes.
    .map((r) => ({ index: r.index, score: 2 * r.score - 1 }));
}

async function denseSearch(courseIndex, queryEmbedding, k) {
  const mode = (process.env.VECTOR_SEARCH_MODE || 'local').toLowerCase();
  if (mode === 'atlas') {
    try {
      return await denseAtlas(courseIndex, queryEmbedding, k);
    } catch (err) {
      console.error('Atlas vector search failed, falling back to local cosine similarity:', err.message);
    }
  }
  return courseIndex.denseLocal(queryEmbedding, k);
}

module.exports = { denseSearch, cosineSimilarity };
