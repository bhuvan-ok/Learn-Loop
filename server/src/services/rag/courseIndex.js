const mongoose = require('mongoose');
const LessonChunk = require('../../models/LessonChunk');
const Lesson = require('../../models/Lesson');
const { BM25Index } = require('./bm25');
const { tokenize } = require('../../utils/tokenize');

// In-memory, per-course view of everything retrieval needs: chunk metadata and
// text, an inverted BM25 index, and (local vector mode only) the embedding
// matrix. Built lazily on the first question for a course and reused until the
// course's chunks or lessons change — validity is checked with one cheap
// aggregate per question — so a question costs one embedding call plus
// in-memory scoring instead of re-reading every chunk (and its multi-KB
// vector) from MongoDB each time.
//
// Memory is bounded two ways: an LRU over courses, and a per-course chunk cap
// that is applied deterministically (oldest chunks first) and logged loudly —
// the previous unsorted limit silently dropped an arbitrary subset.
const MAX_CACHED_COURSES = Number(process.env.RAG_INDEX_CACHE_COURSES || 20);
const MAX_CHUNKS_PER_COURSE = Number(process.env.RAG_MAX_CHUNKS_PER_COURSE || 5000);

const cache = new Map();
const warned = new Set();

function warnOnce(key, message) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

async function currentVersion(courseId) {
  const course = new mongoose.Types.ObjectId(courseId);
  const [chunkStats] = await LessonChunk.aggregate([
    { $match: { course } },
    { $group: { _id: null, count: { $sum: 1 }, updated: { $max: '$updatedAt' } } },
  ]);
  const newestLesson = await Lesson.findOne({ course }).sort({ updatedAt: -1 }).select('updatedAt').lean();
  return [
    chunkStats?.count || 0,
    chunkStats?.updated ? chunkStats.updated.getTime() : 0,
    newestLesson?.updatedAt ? newestLesson.updatedAt.getTime() : 0,
  ].join(':');
}

class CourseIndex {
  constructor(courseId, version, chunks) {
    this.courseId = String(courseId);
    this.version = version;
    this.chunks = chunks;
    this.indexById = new Map(chunks.map((chunk, i) => [chunk.id, i]));
    this.bm25ByMode = new Map();
    this.vectors = null;

    // Neighbour lookup for small-to-big expansion: chunks of one document
    // (a lesson's own text, or one attachment) in reading order.
    this.groups = new Map();
    chunks.forEach((chunk, i) => {
      const list = this.groups.get(chunk.groupKey) || [];
      list.push(i);
      this.groups.set(chunk.groupKey, list);
    });
    for (const list of this.groups.values()) {
      list.sort((a, b) => chunks[a].chunkIndex - chunks[b].chunkIndex);
    }
  }

  // BM25 over chunk text, optionally prefixed with the same context header
  // that was embedded, so lesson/section names are searchable too.
  bm25(includeHeader) {
    const key = includeHeader ? 'header' : 'plain';
    if (!this.bm25ByMode.has(key)) {
      const docs = this.chunks.map((chunk) =>
        tokenize(includeHeader ? `${chunk.contextHeader} ${chunk.contextNote} ${chunk.text}` : chunk.text)
      );
      this.bm25ByMode.set(key, {
        index: new BM25Index(docs),
        tokenSets: docs.map((tokens) => new Set(tokens)),
      });
    }
    return this.bm25ByMode.get(key);
  }

  async ensureVectors() {
    if (this.vectors) return this.vectors;

    const rows = await LessonChunk.find({ course: this.courseId }).select('embedding').lean();
    const byId = new Map(rows.map((row) => [String(row._id), row.embedding]));
    this.vectors = this.chunks.map((chunk) => {
      const raw = byId.get(chunk.id) || [];
      const vector = Float32Array.from(raw);
      let sum = 0;
      for (let i = 0; i < vector.length; i += 1) sum += vector[i] * vector[i];
      return { vector, norm: Math.sqrt(sum) };
    });
    return this.vectors;
  }

  // Exact (brute-force) cosine similarity against every chunk. Vectors from a
  // different embedding model/dimensionality can't be compared and score 0.
  async denseLocal(queryEmbedding, k) {
    const vectors = await this.ensureVectors();
    const query = Float32Array.from(queryEmbedding);
    let queryNorm = 0;
    for (let i = 0; i < query.length; i += 1) queryNorm += query[i] * query[i];
    queryNorm = Math.sqrt(queryNorm);

    const scored = vectors.map(({ vector, norm }, index) => {
      if (vector.length !== query.length || !norm || !queryNorm) return { index, score: 0 };
      let dot = 0;
      for (let i = 0; i < query.length; i += 1) dot += query[i] * vector[i];
      return { index, score: dot / (norm * queryNorm) };
    });

    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    return scored.slice(0, k);
  }

  // Cosine score of specific chunks (used to attach a dense score to
  // candidates that were found by BM25 only).
  async denseScores(queryEmbedding, indices) {
    const vectors = await this.ensureVectors();
    const query = Float32Array.from(queryEmbedding);
    let queryNorm = 0;
    for (let i = 0; i < query.length; i += 1) queryNorm += query[i] * query[i];
    queryNorm = Math.sqrt(queryNorm);

    return new Map(
      indices.map((index) => {
        const { vector, norm } = vectors[index];
        if (vector.length !== query.length || !norm || !queryNorm) return [index, 0];
        let dot = 0;
        for (let i = 0; i < query.length; i += 1) dot += query[i] * vector[i];
        return [index, dot / (norm * queryNorm)];
      })
    );
  }

  // Consecutive chunks of the same document around `index` (+/- `radius`).
  neighbours(index, radius) {
    const chunk = this.chunks[index];
    const list = this.groups.get(chunk.groupKey);
    const position = list.indexOf(index);
    return list.slice(Math.max(0, position - radius), position + radius + 1);
  }
}

async function loadChunks(courseId) {
  const [rows, lessons] = await Promise.all([
    LessonChunk.find({ course: courseId })
      .select('-embedding')
      .sort({ _id: 1 })
      .limit(MAX_CHUNKS_PER_COURSE + 1)
      .lean(),
    Lesson.find({ course: courseId }).select('title').lean(),
  ]);

  if (rows.length > MAX_CHUNKS_PER_COURSE) {
    rows.length = MAX_CHUNKS_PER_COURSE;
    warnOnce(
      `cap:${courseId}`,
      `Course ${courseId} has more than ${MAX_CHUNKS_PER_COURSE} chunks; only the oldest ${MAX_CHUNKS_PER_COURSE} are searchable in ` +
        'local mode. Raise RAG_MAX_CHUNKS_PER_COURSE or use VECTOR_SEARCH_MODE=atlas.'
    );
  }

  const titles = new Map(lessons.map((lesson) => [String(lesson._id), lesson.title]));

  return rows.map((row) => ({
    id: String(row._id),
    lesson: String(row.lesson),
    lessonTitle: titles.get(String(row.lesson)) || 'Unknown lesson',
    chunkIndex: row.chunkIndex,
    text: row.text,
    source: row.source || 'content',
    sourceLabel: row.sourceLabel || '',
    attachmentId: row.attachmentId ? String(row.attachmentId) : null,
    headingPath: row.headingPath || [],
    contextHeader: row.contextHeader || '',
    contextNote: row.contextNote || '',
    page: row.page ?? null,
    overlapLen: row.overlapLen || 0,
    indexVersion: row.indexVersion || 'legacy',
    groupKey: `${row.lesson}:${row.attachmentId || 'content'}`,
  }));
}

async function getCourseIndex(courseId, { expectedIndexVersion } = {}) {
  const key = String(courseId);
  const version = await currentVersion(key);

  let entry = cache.get(key);
  if (!entry || entry.version !== version) {
    entry = new CourseIndex(key, version, await loadChunks(key));
    cache.delete(key);
    cache.set(key, entry);
    while (cache.size > MAX_CACHED_COURSES) cache.delete(cache.keys().next().value);
  } else {
    // refresh LRU position
    cache.delete(key);
    cache.set(key, entry);
  }

  if (expectedIndexVersion) {
    // Chunks written before index versions existed are tagged "legacy"; they
    // were produced by the original chunker and embeddings, which is exactly
    // what the "basic" indexing settings mean.
    const canonical = (v) =>
      v === 'legacy' && expectedIndexVersion.startsWith('basic.h0.t0.c0|') ? expectedIndexVersion : v;
    const versions = new Set(entry.chunks.map((c) => canonical(c.indexVersion)));
    if (versions.size > 1 || (versions.size === 1 && !versions.has(expectedIndexVersion))) {
      warnOnce(
        `ver:${key}:${[...versions].sort().join(',')}:${expectedIndexVersion}`,
        `Course ${key} has chunks indexed with ${[...versions].join(', ')} but the active pipeline expects ` +
          `${expectedIndexVersion}. A course whose chunks are all "legacy" is served by the basic pipeline meanwhile; a ` +
          'mixed or otherwise mismatched index degrades retrieval quality. Run "npm run reindex" to fix it.'
      );
    }
  }

  return entry;
}

function clearCourseIndexCache() {
  cache.clear();
}

module.exports = { getCourseIndex, clearCourseIndexCache, CourseIndex };
