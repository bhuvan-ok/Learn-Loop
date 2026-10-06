const test = require('node:test');
const assert = require('node:assert/strict');
const {
  chunkDocument,
  splitSentences,
  buildContextHeader,
  buildEmbedText,
  stitchChunks,
} = require('../src/utils/structuredChunker');

test('splitSentences keeps abbreviations and decimals intact', () => {
  const sentences = splitSentences(
    'Use a cache, e.g. Redis, for hot reads. Version 3.14 shipped last week. It is fast! Is it safe? Yes.'
  );
  assert.deepEqual(sentences, [
    'Use a cache, e.g. Redis, for hot reads.',
    'Version 3.14 shipped last week.',
    'It is fast!',
    'Is it safe?',
    'Yes.',
  ]);
});

test('chunks follow markdown headings and carry the heading path', () => {
  const text = '# Closures\n\nIntro here.\n\n## Private state\n\nState is hidden.\n\n### Counters\n\nA counter example.';
  const chunks = chunkDocument(text, { lessonTitle: 'Closures' });

  assert.deepEqual(
    chunks.map((c) => c.headingPath),
    [['Closures'], ['Closures', 'Private state'], ['Closures', 'Private state', 'Counters']]
  );
  // The "# Closures" heading repeats the lesson title, so it is not repeated in the header.
  assert.equal(chunks[1].contextHeader, 'Closures > Private state');
  assert.equal(chunks[2].contextHeader, 'Closures > Private state > Counters');
});

test('never packs text from two sections into one chunk', () => {
  const chunks = chunkDocument('## A\n\nalpha alpha.\n\n## B\n\nbeta beta.', { lessonTitle: 'T' });
  assert.equal(chunks.length, 2);
  assert.ok(chunks[0].text.includes('alpha') && !chunks[0].text.includes('beta'));
});

test('every chunk respects maxChars, even for one enormous sentence or token', () => {
  const longSentence = `${'word '.repeat(600)}end.`;
  const longToken = 'x'.repeat(2500);
  const chunks = chunkDocument(`${longSentence}\n\n${longToken}`, { lessonTitle: 'T', maxChars: 900 });
  assert.ok(chunks.length > 3);
  for (const chunk of chunks) assert.ok(chunk.text.length <= 900, `chunk of ${chunk.text.length} chars`);
});

test('fenced code blocks are kept whole', () => {
  const code = '```js\nfunction counter() {\n  let n = 0;\n  return () => ++n;\n}\n```';
  const chunks = chunkDocument(`Intro sentence.\n\n${code}\n\nOutro sentence.`, { lessonTitle: 'T' });
  const holder = chunks.find((c) => c.text.includes('return () => ++n'));
  assert.ok(holder.text.includes(code));
});

test('overlap is whole sentences and overlapLen marks exactly the duplicated prefix', () => {
  const sentence = 'This is one sentence of moderate length used for packing tests.';
  const text = Array.from({ length: 30 }, (_, i) => `${sentence.replace('one', `no. ${i}`)}`).join(' ');
  const chunks = chunkDocument(text, { lessonTitle: 'T', targetChars: 300, maxChars: 500, overlapChars: 140 });

  assert.ok(chunks.length > 3);
  for (let i = 1; i < chunks.length; i += 1) {
    const { overlapLen, text: body } = chunks[i];
    if (!overlapLen) continue;
    const duplicated = body.slice(0, overlapLen).trim();
    assert.ok(chunks[i - 1].text.endsWith(duplicated), `chunk ${i} overlap is not the tail of chunk ${i - 1}`);
    assert.match(duplicated, /\.$/, 'overlap should end on a sentence boundary');
  }
});

test('stitchChunks reproduces the source text without duplicating overlaps', () => {
  const text = Array.from({ length: 20 }, (_, i) => `Sentence number ${i} explains topic ${i} in some detail.`).join(' ');
  const chunks = chunkDocument(text, { lessonTitle: 'T', targetChars: 250, maxChars: 400 });
  const stitched = stitchChunks(chunks).replace(/\s+/g, ' ').trim();
  assert.equal(stitched, text);
});

test('page numbers are tracked for paged input', () => {
  const page = (label) => Array.from({ length: 30 }, (_, i) => `${label} sentence ${i} has some words in it.`).join(' ');
  const chunks = chunkDocument([page('First'), page('Second')], { lessonTitle: 'T' });
  assert.deepEqual([...new Set(chunks.map((c) => c.page))].sort(), [1, 2]);
  assert.ok(chunks.every((c) => c.text.startsWith(c.page === 1 ? 'First' : 'Second') || c.overlapLen > 0));
  assert.equal(chunkDocument('single page only', { lessonTitle: 'T' })[0].page, null);
});

test('plain-text headings (extracted PDFs) are detected only when enabled', () => {
  const pdfLike =
    'Handbook\nIntro line that is long enough to be body text and ends properly.\n1. Pagination\nBody text about paging goes here and ends.\n2. Connection pooling\nBody text about pools goes here and ends.';
  const on = chunkDocument(pdfLike, { lessonTitle: 'L', sourceLabel: 'f.pdf', plainHeadings: true });
  assert.ok(on.some((c) => c.headingPath.includes('1. Pagination')));
  assert.ok(on.some((c) => c.headingPath.includes('2. Connection pooling')));

  const off = chunkDocument(pdfLike, { lessonTitle: 'L', sourceLabel: 'f.pdf' });
  assert.equal(off.length, 1);
});

test('does not split a surrogate pair when hard-slicing a long token', () => {
  const emoji = '😀'.repeat(700);
  const chunks = chunkDocument(emoji, { lessonTitle: 'T', maxChars: 900 });
  for (const chunk of chunks) assert.doesNotMatch(chunk.text, /[\ud800-\udbff]$/);
  assert.equal(chunks.map((c) => c.text).join(''), emoji);
});

test('empty and whitespace-only input yields no chunks', () => {
  assert.deepEqual(chunkDocument('   \n\n  ', { lessonTitle: 'T' }), []);
});

test('buildContextHeader and buildEmbedText', () => {
  assert.equal(buildContextHeader({ lessonTitle: 'Lesson', sourceLabel: 'f.pdf', headingPath: ['Sec'] }), 'Lesson (f.pdf) > Sec');
  assert.equal(buildEmbedText({ contextHeader: 'H', contextNote: 'N', text: 'T' }), 'H\n\nN\n\nT');
  assert.equal(buildEmbedText({ text: 'T' }), 'T');
});
