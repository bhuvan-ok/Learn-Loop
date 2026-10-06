const stem = require('wink-porter2-stemmer');

// Tokenizer shared by BM25 indexing and querying (they must tokenize
// identically or term statistics won't line up). Lowercases, splits
// camelCase (nextTick -> next tick) and punctuation (process.nextTick, $match),
// drops common English stopwords, and Porter-stems alphabetic terms so
// "indexes"/"indexing" and "closures"/"closure" match. Numbers (status codes
// like 201) are kept verbatim — they are exactly the kind of exact-match term
// dense embeddings tend to blur.
const STOPWORDS = new Set(
  (
    'a an and are as at be but by can could do does did for from had has have how i if in into is it its ' +
    'me my no not of on or our so than that the their them then there these they this to up us was we were ' +
    'what when where which who whom why will with would you your about after again all also any been before ' +
    'being both each few more most other over same some such only own too very just should now between ' +
    'through during while out off once here those'
  ).split(' ')
);

function tokenize(text) {
  if (!text) return [];
  const spaced = String(text).replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  const raw = spaced.toLowerCase().split(/[^a-z0-9]+/);
  const tokens = [];

  for (const token of raw) {
    if (!token) continue;
    if (STOPWORDS.has(token)) continue;
    const isNumber = /^\d+$/.test(token);
    if (!isNumber && token.length < 2) continue;
    tokens.push(isNumber || token.length <= 3 ? token : stem(token));
  }
  return tokens;
}

module.exports = { tokenize, STOPWORDS };
