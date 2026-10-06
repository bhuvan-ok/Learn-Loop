// Tunes abstention thresholds on the DEV split only and writes eval/tuned.json.
//   node eval/tune.js
//
// For each experiment's recorded scores it picks the threshold that best
// separates answerable from unanswerable dev questions (maximising Youden's J =
// TPR + TNR - 1; ties resolve to the middle of the tied range, which is the most
// robust point). For the reranker it also picks `dropBelow`, the per-chunk
// floor: the largest value that doesn't cost context recall on dev. The test
// split is never looked at here.
const fs = require('fs');
const { loadDataset } = require('./lib/corpus');
const { EXPERIMENTS } = require('./lib/experiments');
const { loadRaw } = require('./lib/runner');
const { evaluate, summarize } = require('./lib/evaluate');
const { TUNED_PATH } = require('./lib/thresholds');

const dataset = loadDataset();
const dev = dataset.filter((q) => q.split === 'dev');
const devIds = new Set(dev.map((q) => q.id));
const byId = new Map(dataset.map((q) => [q.id, q]));

function bestSignal(record) {
  const signals = record.ranked.map((r) => r.signal).filter((s) => typeof s === 'number');
  return signals.length ? Math.max(...signals) : -Infinity;
}

function sweepThreshold(items) {
  const answerable = items.filter((i) => i.answerable);
  const unanswerable = items.filter((i) => !i.answerable);
  if (!answerable.length || !unanswerable.length) return null;

  const values = [...new Set(items.map((i) => i.max).filter(Number.isFinite))].sort((a, b) => a - b);
  const candidates = [values[0] - 1e-3];
  for (let i = 0; i < values.length - 1; i += 1) candidates.push((values[i] + values[i + 1]) / 2);
  candidates.push(values[values.length - 1] + 1e-3);

  const scored = candidates.map((threshold) => {
    const tpr = answerable.filter((i) => i.max >= threshold).length / answerable.length;
    const tnr = unanswerable.filter((i) => i.max < threshold).length / unanswerable.length;
    return { threshold, tpr, tnr, j: tpr + tnr - 1 };
  });

  const bestJ = Math.max(...scored.map((s) => s.j));
  const tied = scored.filter((s) => Math.abs(s.j - bestJ) < 1e-9);
  const chosen = tied[Math.floor((tied.length - 1) / 2)];
  return { ...chosen, tiedRange: [tied[0].threshold, tied[tied.length - 1].threshold] };
}

function tuneExperiment(name, raw) {
  const devRecords = raw.records.filter((r) => devIds.has(r.id));
  const result = {};

  for (const kind of ['dense', 'rerank']) {
    const items = devRecords
      .filter((r) => r.signalKind === kind)
      .map((r) => ({ answerable: byId.get(r.id).answerable, max: bestSignal(r) }));
    if (!items.length) continue;

    const swept = sweepThreshold(items);
    if (!swept) continue;

    const round = kind === 'rerank' ? (v) => Math.round(v * 2) / 2 : (v) => Math.round(v * 1000) / 1000;
    const entry = { threshold: round(swept.threshold) };

    if (kind === 'rerank') {
      const scoreWith = (dropBelow) =>
        summarize(
          evaluate(raw, dataset, { rerank: { threshold: entry.threshold, dropBelow }, dense: { threshold: 0 } }),
          (r) => r.split === 'dev'
        );
      const baseline = scoreWith(0).contextRecall;
      let dropBelow = 0;
      for (let d = Math.floor(entry.threshold); d >= 0; d -= 1) {
        if (scoreWith(d).contextRecall >= baseline - 0.02) {
          dropBelow = d;
          break;
        }
      }
      entry.dropBelow = dropBelow;
    }

    entry.devJ = Number(swept.j.toFixed(3));
    entry.devTPR = Number(swept.tpr.toFixed(3));
    entry.devTNR = Number(swept.tnr.toFixed(3));
    result[kind] = entry;
  }
  return result;
}

const tuned = {};
const targets = [...EXPERIMENTS.filter((e) => e.name !== 'basic' && e.name !== 'basic-prod'), { name: 'basic+thr', source: 'basic' }];

for (const exp of targets) {
  const raw = loadRaw(exp.source || exp.name);
  if (!raw) continue;
  tuned[exp.name] = tuneExperiment(exp.name, raw);
}

// A rerank experiment only records dense-signal questions when the reranker
// failed; borrow its dense fallback threshold from the same-index hybrid run.
for (const name of Object.keys(tuned)) {
  if (!tuned[name].dense && tuned.rewrite?.dense) tuned[name].dense = tuned.rewrite.dense;
}

fs.writeFileSync(TUNED_PATH, `${JSON.stringify(tuned, null, 2)}\n`);
console.log(`Tuned on ${dev.length} dev questions (${dev.filter((q) => !q.answerable).length} unanswerable). Wrote ${TUNED_PATH}\n`);
for (const [name, t] of Object.entries(tuned)) {
  const parts = Object.entries(t).map(
    ([kind, e]) => `${kind}: threshold ${e.threshold}${e.dropBelow !== undefined ? `, dropBelow ${e.dropBelow}` : ''} (dev TPR ${e.devTPR}, TNR ${e.devTNR})`
  );
  console.log(`${name.padEnd(18)} ${parts.join(' | ')}`);
}
