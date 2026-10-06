// Okapi BM25 over an in-memory corpus. Per-course corpora here are hundreds to
// a few thousand chunks, so an in-process inverted index is simpler and faster
// than a round trip to a search engine, and works against any MongoDB (the
// whole project must run on a plain local mongod). The IDF uses the
// always-non-negative Lucene/BM25+ variant so very common terms never push a
// document's score below zero.
class BM25Index {
  constructor(docsTokens, { k1 = 1.2, b = 0.75 } = {}) {
    this.k1 = k1;
    this.b = b;
    this.docCount = docsTokens.length;
    this.docLengths = docsTokens.map((tokens) => tokens.length);
    const totalLength = this.docLengths.reduce((sum, len) => sum + len, 0);
    this.avgDocLength = this.docCount ? totalLength / this.docCount : 0;

    this.postings = new Map();
    docsTokens.forEach((tokens, docIndex) => {
      const termFreq = new Map();
      for (const token of tokens) termFreq.set(token, (termFreq.get(token) || 0) + 1);
      for (const [term, tf] of termFreq) {
        if (!this.postings.has(term)) this.postings.set(term, []);
        this.postings.get(term).push([docIndex, tf]);
      }
    });
  }

  idf(term) {
    const df = this.postings.get(term)?.length || 0;
    if (!df) return 0;
    return Math.log(1 + (this.docCount - df + 0.5) / (df + 0.5));
  }

  // Returns [{ index, score }] best-first. Documents sharing no query term are
  // omitted rather than listed with a zero score.
  search(queryTokens, k = 10) {
    if (!this.docCount || !queryTokens.length) return [];

    const scores = new Map();
    for (const term of new Set(queryTokens)) {
      const postings = this.postings.get(term);
      if (!postings) continue;
      const idf = this.idf(term);
      for (const [docIndex, tf] of postings) {
        const lengthNorm = 1 - this.b + this.b * (this.docLengths[docIndex] / (this.avgDocLength || 1));
        const termScore = idf * ((tf * (this.k1 + 1)) / (tf + this.k1 * lengthNorm));
        scores.set(docIndex, (scores.get(docIndex) || 0) + termScore);
      }
    }

    return [...scores.entries()]
      .map(([index, score]) => ({ index, score }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, k);
  }
}

module.exports = { BM25Index };
