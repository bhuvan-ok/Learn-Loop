const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// The query-transform and rerank stages call aiService. Replace it with a
// scriptable fake *before* those modules are loaded so no network is touched.
const aiPath = require.resolve('../src/services/aiService');
let nextText = '';
let nextJson = null;
let shouldThrow = false;
const fakeAi = {
  generateText: async () => {
    if (shouldThrow) throw new Error('boom');
    return nextText;
  },
  generateJSON: async () => {
    if (shouldThrow) throw new Error('boom');
    return nextJson;
  },
};
require.cache[aiPath] = { id: aiPath, filename: aiPath, loaded: true, exports: fakeAi };

const { rewriteQuery, expandQueries, hypotheticalPassage } = require('../src/services/rag/queryTransform');
const { rerankCandidates } = require('../src/services/rag/rerank');
const { CourseIndex } = require('../src/services/rag/courseIndex');
const { buildPassages } = require('../src/services/rag/pipeline');
const { getRagConfig, PRESETS, indexSignature } = require('../src/config/ragConfig');

const candidates = (n) =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, chunk: { text: `passage ${i}`, contextHeader: '' } }));

test('rewriteQuery skips the LLM when there is no history and falls back on failure', async () => {
  const trace = { llmCalls: 0 };
  assert.equal(await rewriteQuery('What is a closure?', [], trace), 'What is a closure?');
  assert.equal(trace.llmCalls, 0);

  nextText = '"What does PATCH do in a REST API?"';
  const rewritten = await rewriteQuery('What about PATCH?', [{ question: 'PUT?', answer: 'Replaces.' }], trace);
  assert.equal(rewritten, 'What does PATCH do in a REST API?');
  assert.equal(trace.llmCalls, 1);

  shouldThrow = true;
  assert.equal(await rewriteQuery('What about PATCH?', [{ question: 'PUT?', answer: 'x' }], trace), 'What about PATCH?');
  shouldThrow = false;

  nextText = '';
  assert.equal(await rewriteQuery('Original?', [{ question: 'q', answer: 'a' }], trace), 'Original?');
});

test('expandQueries dedupes, drops the original and tolerates bad output', async () => {
  const trace = { llmCalls: 0 };
  nextJson = { queries: ['alt one', 'alt one', 'orig', 'alt two', ''] };
  assert.deepEqual(await expandQueries('orig', trace), ['alt one', 'alt two']);

  nextJson = ['array form'];
  assert.deepEqual(await expandQueries('orig', trace), ['array form']);

  nextJson = { nope: true };
  assert.deepEqual(await expandQueries('orig', trace), []);
  shouldThrow = true;
  assert.deepEqual(await expandQueries('orig', trace), []);
  shouldThrow = false;
});

test('hypotheticalPassage rejects trivially short output', async () => {
  const trace = { llmCalls: 0 };
  nextText = 'ok';
  assert.equal(await hypotheticalPassage('q', trace), '');
  nextText = 'A closure is a function bundled with the environment in which it was created.';
  assert.ok((await hypotheticalPassage('q', trace)).startsWith('A closure'));
});

test('rerankCandidates maps scores back by passage number and clamps to 0-10', async () => {
  nextJson = { scores: [{ id: 1, score: 9 }, { id: 2, score: 15 }, { id: 3, score: -4 }] };
  const scores = await rerankCandidates('q', candidates(3), {}, { llmCalls: 0 });
  assert.equal(scores.get('c0'), 9);
  assert.equal(scores.get('c1'), 10);
  assert.equal(scores.get('c2'), 0);
});

test('rerankCandidates treats skipped passages as irrelevant and rejects untrustworthy output', async () => {
  nextJson = { scores: [{ id: 1, score: 8 }, { id: 2, score: 6 }, { id: 3, score: 5 }] };
  const partial = await rerankCandidates('q', candidates(5), {}, { llmCalls: 0 });
  assert.equal(partial.get('c4'), 0);

  nextJson = { scores: [{ id: 1, score: 8 }] };
  assert.equal(await rerankCandidates('q', candidates(5), {}, { llmCalls: 0 }), null, 'fewer than half scored');

  nextJson = { scores: [{ id: 99, score: 8 }, { id: 'x', score: 1 }] };
  assert.equal(await rerankCandidates('q', candidates(3), {}, { llmCalls: 0 }), null);

  nextJson = null;
  assert.equal(await rerankCandidates('q', candidates(3), {}, { llmCalls: 0 }), null);

  shouldThrow = true;
  assert.equal(await rerankCandidates('q', candidates(3), {}, { llmCalls: 0 }), null);
  shouldThrow = false;

  assert.deepEqual([...(await rerankCandidates('q', [], {}, { llmCalls: 0 })).keys()], []);
});

function fakeIndex(chunkSpecs) {
  const chunks = chunkSpecs.map((spec, i) => ({
    id: `id${i}`,
    lesson: spec.lesson,
    lessonTitle: `Lesson ${spec.lesson}`,
    chunkIndex: spec.chunkIndex,
    text: spec.text,
    overlapLen: spec.overlapLen || 0,
    source: 'content',
    sourceLabel: '',
    attachmentId: null,
    contextHeader: '',
    contextNote: '',
    page: null,
    indexVersion: 'v',
    groupKey: `${spec.lesson}:content`,
  }));
  return new CourseIndex('course', 'v', chunks);
}

test('buildPassages expands neighbours, merges adjacent hits and orders by best rank', () => {
  const index = fakeIndex([
    { lesson: 'A', chunkIndex: 0, text: 'A0 text.' },
    { lesson: 'A', chunkIndex: 1, text: 'A1 text.' },
    { lesson: 'A', chunkIndex: 2, text: 'A2 text.' },
    { lesson: 'A', chunkIndex: 3, text: 'A3 text.' },
    { lesson: 'B', chunkIndex: 0, text: 'B0 text.' },
  ]);

  // hits: A3 (rank 0), B0 (rank 1), A1 (rank 2)
  const context = [
    { index: 3, signal: 9 },
    { index: 4, signal: 7 },
    { index: 1, signal: 5 },
  ];
  const passages = buildPassages(index, context, { neighbors: 1, maxChars: 6000 });

  // A1's window (0-2) and A3's window (2-3) overlap on chunk 2 and merge into one run 0-3.
  assert.equal(passages.length, 2);
  assert.equal(passages[0].lessonId, 'A');
  assert.equal(passages[0].rank, 0);
  assert.ok(['A0', 'A1', 'A2', 'A3'].every((t) => passages[0].text.includes(`${t} text.`)));
  assert.equal(passages[1].lessonId, 'B');
});

test('buildPassages with no expansion yields one passage per hit and honours maxChars', () => {
  const index = fakeIndex([
    { lesson: 'A', chunkIndex: 0, text: 'x'.repeat(50) },
    { lesson: 'A', chunkIndex: 5, text: 'y'.repeat(50) },
    { lesson: 'B', chunkIndex: 0, text: 'z'.repeat(50) },
  ]);
  const context = [{ index: 0, signal: 1 }, { index: 1, signal: 1 }, { index: 2, signal: 1 }];

  assert.equal(buildPassages(index, context, { neighbors: 0, maxChars: 6000 }).length, 3);
  assert.equal(buildPassages(index, context, { neighbors: 0, maxChars: 120 }).length, 2);
  // the first passage is always kept even if it alone exceeds the budget
  assert.equal(buildPassages(index, context, { neighbors: 0, maxChars: 10 }).length, 1);
});

test('presets are internally consistent and cumulative', () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    assert.equal(preset.name, name);
    assert.ok(['dense', 'hybrid'].includes(preset.retrieval.mode));
    assert.ok(preset.retrieval.topK >= 1 && preset.retrieval.candidateK >= preset.retrieval.topK);
    assert.ok(['dense', 'rerank'].includes(preset.abstain.signal));
    if (preset.abstain.signal === 'rerank') assert.ok(preset.rerank.enabled, `${name}: rerank signal needs the reranker`);
    if (preset.abstain.dropBelow != null) assert.ok(preset.abstain.dropBelow <= preset.abstain.threshold);
  }
  assert.equal(PRESETS.basic.retrieval.mode, 'dense');
  assert.equal(PRESETS.basic.abstain.threshold, 0.15, 'basic must keep the original 0.15 cut-off');
  assert.equal(PRESETS.hybrid.retrieval.mode, 'hybrid');
  assert.equal(PRESETS.hybrid.indexing.header, true, 'later presets inherit earlier upgrades');
  assert.notEqual(indexSignature(PRESETS.basic.indexing), indexSignature(PRESETS['chunk-tasktype'].indexing));
});

test('getRagConfig honours RAG_PIPELINE and RAG_CONFIG_JSON', () => {
  const saved = { p: process.env.RAG_PIPELINE, j: process.env.RAG_CONFIG_JSON };
  try {
    delete process.env.RAG_CONFIG_JSON;
    process.env.RAG_PIPELINE = 'basic';
    assert.equal(getRagConfig().name, 'basic');

    process.env.RAG_PIPELINE = 'hybrid';
    process.env.RAG_CONFIG_JSON = '{"retrieval":{"topK":7}}';
    const cfg = getRagConfig();
    assert.equal(cfg.retrieval.topK, 7);
    assert.equal(cfg.retrieval.mode, 'hybrid', 'unrelated settings survive the overlay');
    assert.equal(PRESETS.hybrid.retrieval.topK, 5, 'presets are not mutated');

    process.env.RAG_PIPELINE = 'nope';
    assert.throws(() => getRagConfig(), /Unknown RAG pipeline/);
    process.env.RAG_PIPELINE = 'basic';
    process.env.RAG_CONFIG_JSON = '{bad';
    assert.throws(() => getRagConfig(), /not valid JSON/);
  } finally {
    if (saved.p === undefined) delete process.env.RAG_PIPELINE;
    else process.env.RAG_PIPELINE = saved.p;
    if (saved.j === undefined) delete process.env.RAG_CONFIG_JSON;
    else process.env.RAG_CONFIG_JSON = saved.j;
  }
  assert.ok(path.basename(__filename));
});
