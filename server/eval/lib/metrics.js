const { covers } = require('./spanMatch');

// Per-question retrieval metrics. `ranked` is the pipeline's final ordered
// list (up to k chunks, before any abstention threshold), `gold` the question's
// evidence spans. A chunk is *relevant* if it covers at least one gold span.
//
// nDCG uses novelty-aware gain: a chunk earns gain only for the first time it
// covers a gold span that no higher-ranked chunk covered. Without that, several
// overlapping chunks covering one span would each score, and DCG could exceed
// the ideal and push nDCG above 1. With it, the ideal ranking is exactly
// "one chunk per evidence span, at the top", so nDCG is in [0, 1].
function rankingMetrics(ranked, gold, k = 5) {
  const top = ranked.slice(0, k);
  const relevant = top.map((chunk) => gold.some((g) => covers(chunk, g)));

  const seen = new Set();
  const gain = top.map((chunk) => {
    let novel = false;
    gold.forEach((g, gi) => {
      if (!seen.has(gi) && covers(chunk, g)) {
        seen.add(gi);
        novel = true;
      }
    });
    return novel ? 1 : 0;
  });

  const coveredAt = (n) => {
    const slice = top.slice(0, n);
    return gold.filter((g) => slice.some((chunk) => covers(chunk, g))).length / gold.length;
  };

  const firstRelevant = relevant.indexOf(true);
  const dcg = gain.reduce((sum, g, i) => sum + g / Math.log2(i + 2), 0);
  let idcg = 0;
  for (let i = 0; i < Math.min(gold.length, k); i += 1) idcg += 1 / Math.log2(i + 2);

  return {
    hit1: relevant[0] ? 1 : 0,
    hit3: relevant.slice(0, 3).some(Boolean) ? 1 : 0,
    hit5: relevant.some(Boolean) ? 1 : 0,
    recall3: coveredAt(3),
    recall5: coveredAt(5),
    mrr: firstRelevant === -1 ? 0 : 1 / (firstRelevant + 1),
    ndcg5: idcg ? dcg / idcg : 0,
    precision5: top.length ? relevant.filter(Boolean).length / top.length : 0,
  };
}

// Quality of what is actually handed to the model after thresholding.
function contextMetrics(context, gold) {
  const relevant = context.map((chunk) => gold.some((g) => covers(chunk, g)));
  const covered = gold.map((g) => context.some((chunk) => covers(chunk, g)));
  return {
    contextRecall: covered.filter(Boolean).length / gold.length,
    contextPrecision: context.length ? relevant.filter(Boolean).length / context.length : 0,
    contextSize: context.length,
  };
}

module.exports = { rankingMetrics, contextMetrics };
