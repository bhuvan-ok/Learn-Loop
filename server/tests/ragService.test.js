const test = require('node:test');
const assert = require('node:assert/strict');

// Keep the AI provider out of this test entirely. ragService binds
// streamChatCompletion when it is imported, so the fake delegates to a variable
// the tests can swap.
let currentStream = async function* () {};
const aiPath = require.resolve('../src/services/aiService');
require.cache[aiPath] = {
  id: aiPath,
  filename: aiPath,
  loaded: true,
  exports: {
    embedText: async () => [],
    embedBatch: async () => [],
    generateText: async () => '',
    generateJSON: async () => null,
    streamChatCompletion: (...args) => currentStream(...args),
    getEmbeddingModelId: () => 'test:model',
  },
};

const { buildUserPrompt, buildCitations, generateAnswer, SYSTEM_PROMPT } = require('../src/services/ragService');

const passage = (n, extra = {}) => ({
  text: `Passage ${n} text.`,
  lessonId: `lesson${n}`,
  lessonTitle: `Lesson ${n}`,
  chunkIndex: n,
  source: 'content',
  sourceLabel: '',
  contextHeader: `Lesson ${n}`,
  page: null,
  score: 8,
  ...extra,
});

test('the prompt labels excerpts E1..En and tells the model to cite them', () => {
  assert.match(SYSTEM_PROMPT, /\[E1\]/);
  const prompt = buildUserPrompt({
    question: 'What is X?',
    passages: [passage(1, { contextHeader: 'Lesson 1 > Intro > Details' }), passage(2, { source: 'attachment', sourceLabel: 'book.pdf', page: 4 })],
    history: [],
  });
  assert.match(prompt, /Excerpt E1 \(from lesson "Lesson 1", section "Intro > Details"\):\nPassage 1 text\./);
  assert.match(prompt, /Excerpt E2 \(from file "book\.pdf" attached to lesson "Lesson 2", page 4\)/);
  assert.match(prompt, /Student question: What is X\?$/);
  assert.doesNotMatch(prompt, /Earlier conversation/);
});

test('the prompt includes recent history, truncated, only as context', () => {
  const prompt = buildUserPrompt({
    question: 'And PATCH?',
    passages: [passage(1)],
    history: [{ question: 'Old question', answer: 'x'.repeat(1000) }],
  });
  assert.match(prompt, /Earlier conversation \(for context only\)/);
  assert.match(prompt, /Student: Old question/);
  assert.ok(prompt.length < 1000, 'long previous answers are cut to a short excerpt');
});

test('only the excerpts the answer tagged are recorded as sources', () => {
  const passages = [passage(1), passage(2), passage(3)];
  const citations = buildCitations('First claim [E3]. Second claim [E1].', passages, false);
  assert.deepEqual(citations.map((c) => c.excerpt), [3, 1]);
  assert.deepEqual(citations.map((c) => c.lessonTitle), ['Lesson 3', 'Lesson 1']);
  assert.ok(citations.every((c) => c.inferred === false));
});

test('an untagged answer gets the single closest passage, flagged as inferred', () => {
  const citations = buildCitations('A plain answer without tags.', [passage(1), passage(2)], false);
  assert.equal(citations.length, 1);
  assert.equal(citations[0].excerpt, 1);
  assert.equal(citations[0].inferred, true);
});

test('refusals and interrupted answers get no fallback source', () => {
  const passages = [passage(1)];
  assert.deepEqual(buildCitations("The excerpts don't contain enough information to answer that.", passages, false), []);
  assert.deepEqual(buildCitations('Partial answer', passages, true), []);
  assert.deepEqual(buildCitations('Anything', [], false), []);
});

test('stored snippets are bounded', () => {
  const citations = buildCitations('[E1]', [passage(1, { text: 'y'.repeat(5000) })], false);
  assert.equal(citations[0].text.length, 600);
});

test('generateAnswer keeps a partial answer when the stream breaks midway, and rethrows when nothing streamed', async () => {
  const tokens = [];

  currentStream = async function* () {
    yield 'Hello ';
    yield 'world';
    throw new Error('network dropped');
  };
  const partial = await generateAnswer({ question: 'q', passages: [passage(1)], onToken: (t) => tokens.push(t) });
  assert.equal(partial.interrupted, true);
  assert.match(partial.answer, /^Hello world\n\n\[The response was interrupted/);
  assert.equal(tokens[0], 'Hello ');

  currentStream = async function* () {
    throw new Error('provider down');
  };
  await assert.rejects(generateAnswer({ question: 'q', passages: [passage(1)] }), /provider down/);

  currentStream = async function* () {};
  const empty = await generateAnswer({ question: 'q', passages: [passage(1)] });
  assert.match(empty.answer, /wasn't able to generate/);
});
