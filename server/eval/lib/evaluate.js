const { applyThreshold } = require('../../src/services/rag/thresholds');
const { rankingMetrics, contextMetrics } = require('./metrics');
const { mean, quantile } = require('./stats');

const RANKING_KEYS = ['hit1', 'hit3', 'hit5', 'recall3', 'recall5', 'mrr', 'ndcg5', 'precision5'];

// Scores one experiment's raw records against the dataset. `thresholds` is
// { dense: {threshold, dropBelow?}, rerank: {threshold, dropBelow?} }; the one
// applied to a question depends on which signal that question's retrieval used.
// Uses the production applyThreshold so offline decisions match what the live
// pipeline would have done.
function evaluate(raw, dataset, thresholds) {
  const byId = new Map(dataset.map((q) => [q.id, q]));

  return raw.records.map((rec) => {
    const q = byId.get(rec.id);
    const t = thresholds[rec.signalKind] || thresholds.dense;
    const decision = applyThreshold(rec.ranked, t);

    const row = {
      id: q.id,
      category: q.category,
      split: q.split,
      answerable: q.answerable,
      abstain: decision.abstain,
      llmCalls: rec.trace.llmCalls || 0,
      latencyMs: rec.trace.timingsMs?.total ?? null,
      failed: Boolean(rec.error),
    };

    if (q.answerable) {
      Object.assign(row, rankingMetrics(rec.ranked, q.gold));
      Object.assign(row, contextMetrics(decision.context, q.gold));
    }
    return row;
  });
}

// Aggregates scored rows (optionally filtered) into the headline numbers.
function summarize(rows, filter = () => true) {
  const subset = rows.filter(filter);
  const answerable = subset.filter((r) => r.answerable);
  const unanswerable = subset.filter((r) => !r.answerable);

  const summary = { n: subset.length, nAnswerable: answerable.length, nUnanswerable: unanswerable.length };
  for (const key of RANKING_KEYS) summary[key] = mean(answerable.map((r) => r[key]));

  const withContext = answerable.filter((r) => r.contextSize > 0);
  summary.contextRecall = mean(answerable.map((r) => r.contextRecall));
  summary.contextPrecision = mean(withContext.map((r) => r.contextPrecision));
  summary.avgContextSize = mean(answerable.map((r) => r.contextSize));

  summary.falseRefusal = answerable.length ? answerable.filter((r) => r.abstain).length / answerable.length : null;
  summary.falseAnswer = unanswerable.length ? unanswerable.filter((r) => !r.abstain).length / unanswerable.length : null;
  summary.decisionAccuracy = subset.length
    ? (answerable.filter((r) => !r.abstain).length + unanswerable.filter((r) => r.abstain).length) / subset.length
    : null;

  summary.avgLlmCalls = mean(subset.map((r) => r.llmCalls));
  const latencies = subset.map((r) => r.latencyMs).filter((v) => typeof v === 'number');
  summary.latencyP50 = latencies.length ? quantile(latencies, 0.5) : null;
  summary.latencyP95 = latencies.length ? quantile(latencies, 0.95) : null;
  summary.failures = subset.filter((r) => r.failed).length;
  return summary;
}

module.exports = { evaluate, summarize, RANKING_KEYS };
