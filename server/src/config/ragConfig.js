// Single source of truth for every tunable in the RAG pipeline. Each upgrade
// over the original dense-only pipeline is an independent flag so it can be
// switched off in production (RAG_PIPELINE=basic is the kill switch) and
// measured in isolation by the evaluation harness (server/eval), which runs
// the named presets below as a cumulative ablation.
//
// Two kinds of settings:
//   indexing.*  — decided when chunks are written. Changing them requires
//                 re-indexing (npm run reindex); chunks carry an indexVersion
//                 so a mismatch is detected rather than silently mixed.
//   everything else — applied per question at query time.

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, patch) {
  const out = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? deepMerge(base[key], value) : value;
  }
  return out;
}

// The original pipeline: fixed-size chunks, plain embeddings, dense top-5,
// fixed cosine cut-off of 0.15.
const BASIC = {
  name: 'basic',
  indexing: {
    chunker: 'basic', // 'basic' | 'structured'
    header: false, // prepend "Lesson > Section" to embedded + BM25 text
    taskTypes: false, // asymmetric query/document embedding modes
    llmContext: false, // LLM-written situating note per chunk
  },
  query: {
    rewrite: false, // history-aware standalone-question rewrite
    multiQuery: false, // paraphrase expansion
    hyde: false, // hypothetical-answer embedding, only when first pass is weak
  },
  retrieval: {
    mode: 'dense', // 'dense' | 'hybrid' (dense + BM25 fused with RRF)
    topK: 5,
    candidateK: 20, // per-list depth feeding fusion / reranking
    rrfK: 60,
    denseWeight: 1,
    bm25Weight: 1,
    multiQueryWeight: 0.7,
    hydeWeight: 0.7,
    hydeGate: 0, // run HyDE only if best first-pass dense cosine is below this
  },
  rerank: { enabled: false, candidates: 20, passageChars: 700 },
  mmr: { enabled: false, lambda: 0.75 },
  // Small-to-big: after ranking, also feed the neighbouring chunks of each hit.
  expand: { neighbors: 0, maxChars: 6000 },
  // `signal` is the score thresholds apply to: dense cosine, or the reranker's
  // 0-10 relevance score. A question is refused when the best chunk's signal is
  // below `threshold`; individual chunks below `dropBelow` are dropped from the
  // context (defaults to `threshold`). `fallback` is used if reranking fails.
  abstain: {
    signal: 'dense',
    threshold: 0.15,
    dropBelow: null,
    fallback: { threshold: 0.15 },
  },
};

const STRUCTURED_INDEXING = { chunker: 'structured', header: true, taskTypes: true };

// Values tuned on the evaluation dev split (npm run eval:tune writes
// server/eval/tuned.json; these are copied from its "rerank" entry — keep them
// in sync, a unit test checks it). The dense threshold applies to Gemini
// gemini-embedding-001 cosine scores with query/document task types and must be
// re-tuned if the embedding model changes. The reranker thresholds are on its
// 0-10 relevance scale.
const TUNED = {
  denseThreshold: 0.682,
  rerankThreshold: 5,
  rerankDropBelow: 5,
  // Not tuned: HyDE has not been evaluated yet (see eval/README.md). It is
  // anchored just above the dense abstention threshold, i.e. "the best match
  // is borderline".
  hydeGate: 0.7,
};

const PRESETS = {
  basic: BASIC,
};

function addPreset(name, parent, patch) {
  PRESETS[name] = deepMerge(PRESETS[parent], { ...patch, name });
}

// Cumulative ablation ladder (each step adds one idea to the previous one).
addPreset('chunk-structured', 'basic', { indexing: { chunker: 'structured' } });
addPreset('chunk-header', 'chunk-structured', { indexing: { header: true } });
addPreset('chunk-tasktype', 'chunk-header', { indexing: { taskTypes: true } });
addPreset('hybrid', 'chunk-tasktype', { retrieval: { mode: 'hybrid' } });
// BM25 weight sweep: equal-weight RRF lets BM25's matches on generic words
// outvote the dense list on paraphrased questions, so the lexical list gets
// less say. The weight actually used by later presets is picked on the dev split.
addPreset('hybrid-w50', 'chunk-tasktype', { retrieval: { mode: 'hybrid', bm25Weight: 0.5 } });
addPreset('hybrid-w25', 'chunk-tasktype', { retrieval: { mode: 'hybrid', bm25Weight: 0.25 } });
// Diagnostic only: lexical ranking on its own (dense list given zero weight), to
// show how strong BM25 is by itself and rule out an implementation fault.
addPreset('bm25-only', 'chunk-tasktype', { retrieval: { mode: 'hybrid', denseWeight: 0 } });
addPreset('rewrite', 'hybrid', { query: { rewrite: true } });
addPreset('multiquery', 'rewrite', { query: { multiQuery: true } });
addPreset('hyde', 'multiquery', {
  query: { hyde: true },
  retrieval: { hydeGate: TUNED.hydeGate },
});
addPreset('rerank', 'rewrite', {
  rerank: { enabled: true },
  mmr: { enabled: true },
  abstain: {
    signal: 'rerank',
    threshold: TUNED.rerankThreshold,
    dropBelow: TUNED.rerankDropBelow,
    fallback: { threshold: TUNED.denseThreshold },
  },
});
// Does hybrid candidate generation still earn its place once a reranker sits on
// top? Same as "rerank" but with dense-only candidates.
addPreset('rerank-dense', 'rerank', { retrieval: { mode: 'dense' } });
addPreset('contextual', 'rerank', { indexing: { llmContext: true } });

// What production runs by default: the stages that earned their place in the
// ablation, plus small-to-big context expansion for the generator.
addPreset('advanced', 'rerank', { expand: { neighbors: 1 } });

function getPreset(name) {
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown RAG pipeline "${name}". Available: ${Object.keys(PRESETS).join(', ')}`);
  }
  return preset;
}

// RAG_PIPELINE picks a preset (default "advanced"); RAG_CONFIG_JSON optionally
// overlays individual settings, e.g. '{"retrieval":{"topK":6}}'.
function getRagConfig(overrides) {
  const base = getPreset((process.env.RAG_PIPELINE || 'advanced').toLowerCase());
  let config = base;
  if (process.env.RAG_CONFIG_JSON) {
    try {
      config = deepMerge(config, JSON.parse(process.env.RAG_CONFIG_JSON));
    } catch (err) {
      throw new Error(`RAG_CONFIG_JSON is not valid JSON: ${err.message}`);
    }
  }
  return overrides ? deepMerge(config, overrides) : config;
}

// Compact identity of the settings that change what gets stored in the index.
function indexSignature(indexing) {
  return [
    indexing.chunker,
    `h${indexing.header ? 1 : 0}`,
    `t${indexing.taskTypes ? 1 : 0}`,
    `c${indexing.llmContext ? 1 : 0}`,
  ].join('.');
}

module.exports = { getRagConfig, getPreset, deepMerge, indexSignature, PRESETS, TUNED, STRUCTURED_INDEXING };
