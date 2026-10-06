const test = require('node:test');
const assert = require('node:assert/strict');
const { coverage, covers } = require('../eval/lib/spanMatch');
const { rankingMetrics, contextMetrics } = require('../eval/lib/metrics');
const { mean, pairedBootstrap, bootstrapMean } = require('../eval/lib/stats');
const { validateDataset, loadDataset } = require('../eval/lib/corpus');
const { evaluate, summarize } = require('../eval/lib/evaluate');

const chunk = (slug, text) => ({ sourceSlug: slug, text });
const gold = (lesson, span) => ({ lesson, span });

test('coverage ignores case, punctuation and line wraps, and needs the right source', () => {
  const span = 'The event loop drains the entire microtask queue.';
  assert.equal(coverage(span, 'the EVENT loop\ndrains the entire   microtask queue'), 1);
  assert.ok(coverage(span, 'Totally unrelated words here about databases and indexes.') < 0.2);

  assert.equal(covers(chunk('a', span), gold('a', span)), true);
  assert.equal(covers(chunk('b', span), gold('a', span)), false, 'same text from another lesson does not count');
});

test('a span split across two chunks is not covered by either alone', () => {
  const span = 'one two three four five six seven eight nine ten';
  assert.equal(covers(chunk('a', 'one two three four five six'), gold('a', span)), false);
});

test('ranking metrics for a single gold span', () => {
  const g = [gold('a', 'alpha beta gamma delta epsilon')];
  const ranked = [chunk('a', 'unrelated filler text'), chunk('a', 'alpha beta gamma delta epsilon zeta'), chunk('b', 'more filler')];
  const m = rankingMetrics(ranked, g);
  assert.equal(m.hit1, 0);
  assert.equal(m.hit3, 1);
  assert.equal(m.recall5, 1);
  assert.equal(m.mrr, 0.5);
  assert.ok(Math.abs(m.ndcg5 - 1 / Math.log2(3)) < 1e-9);
  assert.ok(Math.abs(m.precision5 - 1 / 3) < 1e-9);
});

test('nDCG never exceeds 1, even when several chunks cover the same span', () => {
  const g = [gold('a', 'alpha beta gamma delta epsilon')];
  const dup = chunk('a', 'alpha beta gamma delta epsilon');
  const m = rankingMetrics([dup, dup, dup, dup, dup], g);
  assert.equal(m.ndcg5, 1);
  assert.equal(m.precision5, 1);
});

test('multi-span questions: recall counts spans, nDCG gives one gain per span', () => {
  const g = [gold('a', 'alpha beta gamma delta epsilon'), gold('b', 'one two three four five')];
  const onlyFirst = rankingMetrics([chunk('a', 'alpha beta gamma delta epsilon')], g);
  assert.equal(onlyFirst.recall5, 0.5);
  assert.ok(onlyFirst.ndcg5 < 1);

  const both = rankingMetrics([chunk('a', 'alpha beta gamma delta epsilon'), chunk('b', 'one two three four five')], g);
  assert.equal(both.recall5, 1);
  assert.equal(both.ndcg5, 1);
});

test('empty ranking scores zero everywhere', () => {
  const m = rankingMetrics([], [gold('a', 'some gold span of words here')]);
  assert.deepEqual(m, { hit1: 0, hit3: 0, hit5: 0, recall3: 0, recall5: 0, mrr: 0, ndcg5: 0, precision5: 0 });
});

test('context metrics', () => {
  const g = [gold('a', 'alpha beta gamma delta epsilon')];
  const ctx = [chunk('a', 'alpha beta gamma delta epsilon'), chunk('b', 'noise')];
  assert.deepEqual(contextMetrics(ctx, g), { contextRecall: 1, contextPrecision: 0.5, contextSize: 2 });
  assert.deepEqual(contextMetrics([], g), { contextRecall: 0, contextPrecision: 0, contextSize: 0 });
});

test('paired bootstrap is deterministic and detects a clear improvement', () => {
  const a = Array.from({ length: 40 }, (_, i) => (i % 2 ? 1 : 0));
  const b = a.map(() => 1);
  const first = pairedBootstrap(a, b);
  const second = pairedBootstrap(a, b);
  assert.deepEqual(first, second);
  assert.equal(first.meanA, 0.5);
  assert.equal(first.meanB, 1);
  assert.ok(first.diffLo > 0, 'CI excludes zero for a consistent improvement');

  const same = pairedBootstrap(a, a);
  assert.equal(same.diff, 0);
  assert.equal(same.diffLo, 0);
  assert.equal(mean([]), 0);
  const ci = bootstrapMean([1, 1, 1, 0]);
  assert.ok(ci.lo <= ci.mean && ci.mean <= ci.hi);
});

test('the shipped dataset is consistent with the corpus', () => {
  assert.deepEqual(validateDataset(), []);
  const dataset = loadDataset();
  assert.ok(dataset.length >= 80);
  assert.ok(dataset.some((q) => q.split === 'dev') && dataset.some((q) => q.split === 'test'));
  for (const category of ['direct', 'paraphrase', 'keyword', 'multi', 'followup', 'unanswerable']) {
    assert.ok(dataset.filter((q) => q.category === category && q.split === 'test').length >= 5, `${category} has test coverage`);
  }
});

test('validateDataset catches a gold span that is not in the lesson', () => {
  const bad = [{ id: 'x', category: 'direct', question: 'q?', answerable: true, history: [], gold: [{ lesson: 'js-closures', span: 'this sentence is not in the lesson at all' }] }];
  assert.equal(validateDataset(bad).length, 1);
});

test('evaluate applies per-signal thresholds exactly like production', () => {
  const dataset = [
    { id: 'a', category: 'direct', split: 'test', answerable: true, gold: [gold('s', 'alpha beta gamma delta epsilon')], history: [] },
    { id: 'u', category: 'unanswerable', split: 'test', answerable: false, gold: [], history: [] },
  ];
  const raw = {
    records: [
      { id: 'a', signalKind: 'dense', trace: { llmCalls: 0 }, ranked: [{ sourceSlug: 's', text: 'alpha beta gamma delta epsilon', signal: 0.8 }] },
      { id: 'u', signalKind: 'dense', trace: { llmCalls: 0 }, ranked: [{ sourceSlug: 's', text: 'nothing', signal: 0.55 }] },
    ],
  };
  const loose = summarize(evaluate(raw, dataset, { dense: { threshold: 0.15 } }));
  assert.equal(loose.falseAnswer, 1);
  assert.equal(loose.falseRefusal, 0);

  const tuned = summarize(evaluate(raw, dataset, { dense: { threshold: 0.7 } }));
  assert.equal(tuned.falseAnswer, 0);
  assert.equal(tuned.falseRefusal, 0);
  assert.equal(tuned.decisionAccuracy, 1);
});
