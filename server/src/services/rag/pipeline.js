const { embedBatch } = require('../aiService');
const { denseSearch } = require('../retrievalService');
const { getCourseIndex } = require('./courseIndex');
const { currentIndexVersion } = require('./indexVersion');
const { reciprocalRankFusion, mmrSelect } = require('./fusion');
const { rewriteQuery, expandQueries, hypotheticalPassage } = require('./queryTransform');
const { rerankCandidates } = require('./rerank');
const { applyThreshold } = require('./thresholds');
const { stitchChunks } = require('../../utils/structuredChunker');
const { tokenize } = require('../../utils/tokenize');
const { getRagConfig, PRESETS } = require('../../config/ragConfig');

// The retrieval pipeline. Given a question (and recent conversation) it returns
// the passages the tutor should answer from, or an "abstain" decision when the
// course doesn't cover the question. Stages, each switchable via ragConfig:
//
//   query rewrite -> paraphrase expansion -> dense + BM25 candidate lists
//   -> (HyDE when the first pass is weak) -> Reciprocal Rank Fusion
//   -> LLM rerank -> MMR diversity -> threshold decision
//   -> small-to-big neighbour expansion
//
// With the "basic" preset every optional stage is off and this reduces to the
// original behaviour: dense top-k with a fixed cosine cut-off.

function usesLocalVectors() {
  return (process.env.VECTOR_SEARCH_MODE || 'local').toLowerCase() !== 'atlas';
}

// Small-to-big: each retrieved chunk is expanded with its neighbours from the
// same document, consecutive chunks are stitched into one passage (overlap
// removed), and passages are ordered by their best-ranked member.
function buildPassages(index, context, { neighbors = 0, maxChars = 6000 } = {}) {
  const chunks = index.chunks;
  const rankOf = new Map(context.map((c, i) => [c.index, i]));

  const wantedByGroup = new Map();
  for (const candidate of context) {
    for (const n of index.neighbours(candidate.index, neighbors)) {
      const key = chunks[n].groupKey;
      if (!wantedByGroup.has(key)) wantedByGroup.set(key, new Set());
      wantedByGroup.get(key).add(n);
    }
  }

  const runs = [];
  for (const wanted of wantedByGroup.values()) {
    const sorted = [...wanted].sort((a, b) => chunks[a].chunkIndex - chunks[b].chunkIndex);
    let run = [];
    for (const idx of sorted) {
      if (run.length && chunks[idx].chunkIndex !== chunks[run[run.length - 1]].chunkIndex + 1) {
        runs.push(run);
        run = [];
      }
      run.push(idx);
    }
    if (run.length) runs.push(run);
  }

  const passages = runs.map((run) => {
    const primaryIndices = run.filter((i) => rankOf.has(i));
    const bestRank = Math.min(...primaryIndices.map((i) => rankOf.get(i)));
    const best = context[bestRank];
    const bestChunk = chunks[best.index];
    return {
      text: stitchChunks(run.map((i) => chunks[i])),
      lessonId: bestChunk.lesson,
      lessonTitle: bestChunk.lessonTitle,
      source: bestChunk.source,
      sourceLabel: bestChunk.sourceLabel,
      page: chunks[run[0]].page,
      contextHeader: bestChunk.contextHeader,
      chunkIndex: bestChunk.chunkIndex,
      primaryChunkIds: primaryIndices.map((i) => chunks[i].id),
      score: best.signal,
      rank: bestRank,
    };
  });

  passages.sort((a, b) => a.rank - b.rank);

  const kept = [];
  let total = 0;
  for (const passage of passages) {
    if (kept.length && total + passage.text.length > maxChars) break;
    kept.push(passage);
    total += passage.text.length;
  }
  return kept;
}

function emptyResult(trace, started) {
  trace.timingsMs.total = Date.now() - started;
  return { abstain: true, ranked: [], context: [], passages: [], signalKind: 'dense', trace };
}

async function retrieve({ courseId, question, history = [], config = getRagConfig() }) {
  const started = Date.now();
  const trace = {
    pipeline: config.name,
    llmCalls: 0,
    llmFailures: 0,
    standaloneQuestion: question,
    paraphrases: [],
    hyde: false,
    rerankFailed: false,
    timingsMs: {},
  };
  const index = await getCourseIndex(courseId, { expectedIndexVersion: currentIndexVersion(config) });
  if (!index.chunks.length) return emptyResult(trace, started);

  // Courses indexed before the upgrade (all chunks "legacy") were chunked and
  // embedded the original way. Querying them with the new embedding mode and
  // thresholds tuned for the new index would silently degrade answers, so such
  // a course keeps being served by the basic pipeline until `npm run reindex`.
  if (config.indexing.chunker !== 'basic' && index.chunks.every((c) => c.indexVersion === 'legacy')) {
    config = PRESETS.basic;
    trace.pipeline = 'basic (course not re-indexed yet)';
  }

  const r = config.retrieval;
  const taskType = config.indexing.taskTypes ? 'query' : undefined;
  const hybrid = r.mode === 'hybrid';

  // 1. Query understanding
  let tick = Date.now();
  let standalone = question;
  if (config.query.rewrite && history.length) {
    standalone = await rewriteQuery(question, history, trace);
  }
  trace.standaloneQuestion = standalone;

  const variants = [{ text: standalone, original: true, weight: 1 }];
  if (config.query.multiQuery) {
    trace.paraphrases = await expandQueries(standalone, trace);
    for (const text of trace.paraphrases) variants.push({ text, original: false, weight: r.multiQueryWeight });
  }
  trace.timingsMs.queryTransform = Date.now() - tick;

  // 2. Candidate generation: dense (+ BM25) list per query variant
  tick = Date.now();
  const embeddings = await embedBatch(variants.map((v) => v.text), { taskType });
  // Fusion and reranking need a deeper candidate pool than the final top-k.
  const denseDepth = hybrid || config.rerank.enabled ? r.candidateK : r.topK;
  const bm25 = hybrid ? index.bm25(config.indexing.header) : null;

  const denseResults = await Promise.all(variants.map((v, i) => denseSearch(index, embeddings[i], denseDepth)));

  const lists = [];
  const denseScore = new Map();
  const bm25Score = new Map();

  variants.forEach((variant, i) => {
    lists.push({ ids: denseResults[i].map((d) => d.index), weight: r.denseWeight * variant.weight });
    if (variant.original) denseResults[i].forEach((d) => denseScore.set(d.index, d.score));

    if (hybrid) {
      const hits = bm25.index.search(tokenize(variant.text), r.candidateK);
      lists.push({ ids: hits.map((h) => h.index), weight: r.bm25Weight * variant.weight });
      if (variant.original) hits.forEach((h) => bm25Score.set(h.index, h.score));
    }
  });

  // HyDE: only when the best first-pass dense match is weak.
  const topDense = Math.max(-1, ...denseScore.values());
  if (config.query.hyde && r.hydeGate > 0 && topDense < r.hydeGate) {
    const passage = await hypotheticalPassage(standalone, trace);
    if (passage) {
      const [hydeEmbedding] = await embedBatch([passage], {
        taskType: config.indexing.taskTypes ? 'document' : undefined,
      });
      const hydeDense = await denseSearch(index, hydeEmbedding, r.candidateK);
      lists.push({ ids: hydeDense.map((d) => d.index), weight: r.hydeWeight });
      trace.hyde = true;
    }
  }
  trace.timingsMs.retrieve = Date.now() - tick;

  // 3. Fusion
  const poolSize = Math.max(config.rerank.candidates, r.topK * 2);
  const fused = reciprocalRankFusion(lists, { k: r.rrfK }).slice(0, poolSize);

  const missingDense = fused.map((f) => f.id).filter((i) => !denseScore.has(i));
  if (missingDense.length && usesLocalVectors()) {
    const extra = await index.denseScores(embeddings[0], missingDense);
    extra.forEach((score, i) => denseScore.set(i, score));
  }

  let candidates = fused.map(({ id: chunkIndex, score }) => ({
    id: index.chunks[chunkIndex].id,
    index: chunkIndex,
    chunk: index.chunks[chunkIndex],
    scores: {
      rrf: score,
      dense: denseScore.has(chunkIndex) ? denseScore.get(chunkIndex) : null,
      bm25: bm25Score.get(chunkIndex) ?? 0,
      rerank: null,
    },
  }));

  // 4. Rerank
  tick = Date.now();
  let rerankOk = false;
  if (config.rerank.enabled) {
    const pool = candidates.slice(0, config.rerank.candidates);
    const scores = await rerankCandidates(standalone, pool, { passageChars: config.rerank.passageChars }, trace);
    if (scores) {
      pool.forEach((c) => {
        c.scores.rerank = scores.get(c.id);
      });
      candidates = [...pool].sort((a, b) => b.scores.rerank - a.scores.rerank || b.scores.rrf - a.scores.rrf);
      rerankOk = true;
    } else {
      trace.rerankFailed = true;
    }
  }
  trace.timingsMs.rerank = Date.now() - tick;

  // 5. Diversity + final cut
  let selected = candidates.slice(0, r.topK);
  if (config.mmr.enabled) {
    const pool = candidates.slice(0, Math.max(r.topK * 2, r.topK));
    const maxRrf = pool[0]?.scores.rrf || 1;
    const tokenSets = (bm25 || index.bm25(config.indexing.header)).tokenSets;
    selected = mmrSelect(
      pool.map((c) => ({
        c,
        relevance: rerankOk ? c.scores.rerank / 10 : c.scores.rrf / maxRrf,
        tokens: tokenSets[c.index],
      })),
      { k: r.topK, lambda: config.mmr.lambda }
    ).map((item) => item.c);
  }

  // 6. Decision
  const useRerankSignal = config.abstain.signal === 'rerank' && rerankOk;
  const ranked = selected.map((c) => ({
    ...c,
    signal: useRerankSignal ? c.scores.rerank : c.scores.dense,
  }));

  let thresholds = { threshold: config.abstain.threshold, dropBelow: config.abstain.dropBelow };
  if (config.abstain.signal === 'rerank' && !rerankOk) {
    const fallback = config.abstain.fallback || {};
    thresholds = { threshold: fallback.threshold ?? 0, dropBelow: fallback.dropBelow ?? null };
  }
  const decision = applyThreshold(ranked, thresholds);

  const passages = decision.abstain ? [] : buildPassages(index, decision.context, config.expand);
  trace.timingsMs.total = Date.now() - started;

  return {
    abstain: decision.abstain,
    ranked,
    context: decision.context,
    passages,
    signalKind: useRerankSignal ? 'rerank' : 'dense',
    trace,
  };
}

module.exports = { retrieve, buildPassages };
