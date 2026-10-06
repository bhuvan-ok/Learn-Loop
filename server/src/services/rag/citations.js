// Excerpts are shown to the model as [E1], [E2], ... and it is told to tag the
// claims they support. This reads those tags back out of the finished answer so
// only passages the answer actually relied on are saved and shown as sources
// (previously every retrieved chunk was recorded as "cited" whether or not the
// model used it).
function extractCitedExcerpts(answer, maxExcerpt) {
  const groups = String(answer || '').match(/\[\s*E\s*\d[^\]]*\]|\(\s*excerpts?\s*\d[^)]*\)/gi) || [];
  const seen = new Set();
  const ordered = [];

  for (const group of groups) {
    for (const match of group.matchAll(/\d+/g)) {
      const n = Number(match[0]);
      if (n >= 1 && n <= maxExcerpt && !seen.has(n)) {
        seen.add(n);
        ordered.push(n);
      }
    }
  }
  return ordered;
}

// Heuristic for "the model said the course doesn't cover this", in which case
// attaching a fallback source would be misleading.
const REFUSAL_PATTERN = new RegExp(
  [
    'not (?:covered|mentioned|enough)',
    "(?:does|do)(?: not|n'?t) (?:cover|contain|mention|include|have enough)",
    "couldn'?t find",
    'no information',
    "(?:cannot|can'?t) (?:answer|find)",
  ].join('|'),
  'i'
);

function looksLikeRefusal(answer) {
  return REFUSAL_PATTERN.test(String(answer || ''));
}

module.exports = { extractCitedExcerpts, looksLikeRefusal };
