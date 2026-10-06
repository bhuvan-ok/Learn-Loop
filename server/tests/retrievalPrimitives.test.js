const test = require('node:test');
const assert = require('node:assert/strict');
const { BM25Index } = require('../src/services/rag/bm25');
const { reciprocalRankFusion, mmrSelect, jaccard } = require('../src/services/rag/fusion');
const { tokenize } = require('../src/utils/tokenize');
const { applyThreshold } = require('../src/services/rag/thresholds');
const { extractCitedExcerpts, looksLikeRefusal } = require('../src/services/rag/citations');
const { parseJsonLoose } = require('../src/utils/parseJson');
const { cosineSimilarity } = require('../src/services/retrievalService');

test('tokenize lowercases, splits camelCase and punctuation, drops stopwords and stems', () => {
  assert.deepEqual(tokenize('process.nextTick'), ['process', 'next', 'tick']);
  assert.deepEqual(tokenize('The indexes and indexing'), ['index', 'index']);
  assert.ok(tokenize('HTTP 201 Created').includes('201'));
  assert.deepEqual(tokenize(''), []);
});

test('BM25 ranks the document containing the rare query term first', () => {
  const docs = [
    'closures keep variables alive',
    'the event loop drains microtasks before macrotasks',
    'express middleware calls next to continue',
  ].map(tokenize);
  const index = new BM25Index(docs);

  const hits = index.search(tokenize('microtasks'), 3);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].index, 1);
  assert.deepEqual(index.search(tokenize('nonexistentterm'), 3), []);
});

test('BM25 prefers shorter documents and repeated terms, and idf is non-negative', () => {
  const docs = [
    ['index', 'index', 'query'],
    ['index', 'a', 'b', 'c', 'd', 'e', 'f', 'g'],
    ['unrelated'],
  ];
  const bm25 = new BM25Index(docs);
  const hits = bm25.search(['index'], 3);
  assert.equal(hits[0].index, 0);
  assert.ok(bm25.idf('index') > 0);
  assert.equal(bm25.idf('missing'), 0);
});

test('RRF rewards agreement between lists and respects weights', () => {
  const fused = reciprocalRankFusion(
    [
      { ids: ['a', 'b', 'c'] },
      { ids: ['b', 'a', 'd'] },
    ],
    { k: 60 }
  );
  assert.deepEqual(fused.map((f) => f.id).slice(0, 2).sort(), ['a', 'b']);
  assert.ok(fused.find((f) => f.id === 'a').score > fused.find((f) => f.id === 'c').score);

  const weighted = reciprocalRankFusion([{ ids: ['x'], weight: 1 }, { ids: ['y'], weight: 5 }]);
  assert.equal(weighted[0].id, 'y');
});

test('RRF score of a first-place item matches 1 / (k + 1)', () => {
  const [top] = reciprocalRankFusion([{ ids: ['only'] }], { k: 60 });
  assert.ok(Math.abs(top.score - 1 / 61) < 1e-12);
});

test('MMR drops a near-duplicate in favour of a distinct item', () => {
  const set = (...w) => new Set(w);
  const items = [
    { id: 'a', relevance: 1.0, tokens: set('closure', 'variable', 'scope', 'function') },
    { id: 'dup', relevance: 0.95, tokens: set('closure', 'variable', 'scope', 'function') },
    { id: 'other', relevance: 0.7, tokens: set('promise', 'async', 'await') },
  ];
  const picked = mmrSelect(items, { k: 2, lambda: 0.5 }).map((i) => i.id);
  assert.deepEqual(picked, ['a', 'other']);
  assert.equal(jaccard(set('a', 'b'), set('b', 'c')), 1 / 3);
});

test('applyThreshold abstains below the threshold and filters weak stragglers', () => {
  const ranked = [{ signal: 8 }, { signal: 5 }, { signal: 2 }];
  const answered = applyThreshold(ranked, { threshold: 4, dropBelow: 3 });
  assert.equal(answered.abstain, false);
  assert.deepEqual(answered.context.map((r) => r.signal), [8, 5]);

  assert.equal(applyThreshold([{ signal: 3 }], { threshold: 4 }).abstain, true);
  assert.equal(applyThreshold([], { threshold: 4 }).abstain, true);
  // a chunk with no usable signal can never satisfy a threshold
  assert.equal(applyThreshold([{ signal: null }], { threshold: 0 }).abstain, true);
  // dropBelow defaults to the threshold (the original pipeline's behaviour)
  assert.deepEqual(applyThreshold([{ signal: 0.2 }, { signal: 0.1 }], { threshold: 0.15 }).context.length, 1);
});

test('citation parsing handles tags, groups, out-of-range numbers and legacy phrasing', () => {
  assert.deepEqual(extractCitedExcerpts('A [E2]. B [E1][E3].', 3), [2, 1, 3]);
  assert.deepEqual(extractCitedExcerpts('Both [E1, E2] agree.', 3), [1, 2]);
  assert.deepEqual(extractCitedExcerpts('See (Excerpt 2) and (Excerpts 1 and 3).', 3), [2, 1, 3]);
  assert.deepEqual(extractCitedExcerpts('Bogus [E9] and [E0].', 3), []);
  assert.deepEqual(extractCitedExcerpts('No tags here, array[1] is not a citation.', 3), []);
  assert.deepEqual(extractCitedExcerpts('[E1] [E1] [E1]', 3), [1]);
});

test('refusal detection', () => {
  assert.equal(looksLikeRefusal("The excerpts don't contain enough information to answer that."), true);
  assert.equal(looksLikeRefusal('A closure is a function with a lexical environment [E1].'), false);
});

test('parseJsonLoose recovers JSON from fenced or chatty model output', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonLoose('```json\n{"a":[1,2]}\n```'), { a: [1, 2] });
  assert.deepEqual(parseJsonLoose('Sure! Here you go: {"scores":[{"id":1,"score":7}]} Hope that helps.'), {
    scores: [{ id: 1, score: 7 }],
  });
  assert.deepEqual(parseJsonLoose('["x","y"]'), ['x', 'y']);
  assert.deepEqual(parseJsonLoose('{"s":"brace } inside string"}'), { s: 'brace } inside string' });
  assert.equal(parseJsonLoose('no json at all'), null);
  assert.equal(parseJsonLoose(''), null);
  assert.equal(parseJsonLoose('{"unterminated": '), null);
});

test('cosineSimilarity', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0, 'mismatched dimensions score 0 rather than NaN');
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
});
