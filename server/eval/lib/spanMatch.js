// A retrieved chunk "covers" a gold evidence span when it comes from the right
// source and contains (nearly) all of the span's text. Matching is by text, not
// chunk ID, so gold labels stay valid whatever chunking strategy produced the
// chunks. Whitespace, case and punctuation differences (PDF line wraps,
// markdown) are ignored; coverage is the fraction of the span's word 3-grams
// found in the chunk, so a span only has to be *substantially* present.
const COVERAGE_THRESHOLD = 0.8;

function words(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9$@._-]+/g, ' ')
    .split(/\s+/)
    // keep dots inside identifiers (process.nextTick) but not sentence punctuation
    .map((word) => word.replace(/^[._-]+|[._-]+$/g, ''))
    .filter(Boolean);
}

function ngrams(tokens, n) {
  const grams = new Set();
  if (tokens.length < n) {
    if (tokens.length) grams.add(tokens.join(' '));
    return grams;
  }
  for (let i = 0; i <= tokens.length - n; i += 1) grams.add(tokens.slice(i, i + n).join(' '));
  return grams;
}

function coverage(span, chunkText) {
  const spanGrams = ngrams(words(span), 3);
  if (!spanGrams.size) return 0;
  const chunkGrams = ngrams(words(chunkText), 3);
  let found = 0;
  for (const gram of spanGrams) if (chunkGrams.has(gram)) found += 1;
  return found / spanGrams.size;
}

function covers(chunk, goldItem) {
  return chunk.sourceSlug === goldItem.lesson && coverage(goldItem.span, chunk.text) >= COVERAGE_THRESHOLD;
}

module.exports = { coverage, covers, COVERAGE_THRESHOLD };
