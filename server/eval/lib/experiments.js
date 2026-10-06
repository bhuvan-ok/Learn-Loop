const { PRESETS, indexSignature } = require('../../src/config/ragConfig');

// The ablation ladder. Every row after "basic" adds one idea to the row above
// (see PRESETS in src/config/ragConfig.js), so the difference between adjacent
// rows is the contribution of that one change.
//   - "basic" runs the FROZEN original pipeline (eval/baseline), not the
//     production code, so it can't drift.
//   - "basic-prod" runs today's production pipeline code with the basic preset
//     on the same frozen index. It must reproduce "basic" exactly; it is a
//     regression check that the new code path hasn't changed baseline behaviour.
const EXPERIMENTS = [
  { name: 'basic', label: 'Basic RAG (frozen original)', frozen: true },
  { name: 'basic-prod', label: 'Basic via new pipeline (parity check)', preset: 'basic', variantOf: 'frozen' },
  { name: 'chunk-structured', label: '+ structure-aware chunking', preset: 'chunk-structured' },
  { name: 'chunk-header', label: '+ contextual header', preset: 'chunk-header' },
  { name: 'chunk-tasktype', label: '+ query/document task types', preset: 'chunk-tasktype' },
  { name: 'hybrid', label: '+ hybrid BM25 + dense (RRF)', preset: 'hybrid' },
  { name: 'hybrid-w50', label: '+ hybrid, BM25 weight 0.5', preset: 'hybrid-w50' },
  { name: 'hybrid-w25', label: '+ hybrid, BM25 weight 0.25', preset: 'hybrid-w25' },
  { name: 'bm25-only', label: 'Diagnostic: BM25 alone', preset: 'bm25-only' },
  { name: 'rewrite', label: '+ conversational query rewrite', preset: 'rewrite' },
  { name: 'multiquery', label: '+ multi-query expansion', preset: 'multiquery' },
  { name: 'hyde', label: '+ HyDE (gated)', preset: 'hyde' },
  { name: 'rerank', label: '+ LLM rerank + MMR (from rewrite)', preset: 'rerank' },
  { name: 'rerank-dense', label: 'Rerank on dense-only candidates (no BM25)', preset: 'rerank-dense' },
  { name: 'contextual', label: '+ LLM contextual chunk notes', preset: 'contextual' },
  { name: 'advanced', label: 'Production default (advanced)', preset: 'advanced' },
];

function configOf(exp) {
  return exp.frozen ? null : PRESETS[exp.preset];
}

// Experiments sharing an index variant reuse one index build.
function variantKey(exp) {
  if (exp.frozen || exp.variantOf === 'frozen') return 'frozen';
  return indexSignature(configOf(exp).indexing);
}

function groupByVariant(experiments) {
  const groups = new Map();
  for (const exp of experiments) {
    const key = variantKey(exp);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(exp);
  }
  return groups;
}

module.exports = { EXPERIMENTS, configOf, variantKey, groupByVariant };
