// Rank-combination and diversity helpers used after candidate generation.

// Reciprocal Rank Fusion (Cormack et al. 2009): each ranked list contributes
// weight / (k + rank) for every item in it. Rank-based, so it can merge lists
// whose raw scores aren't comparable (cosine similarity vs BM25) without any
// score normalisation. k=60 is the standard constant from the original paper.
// `lists` is [{ ids: [id, ...] (best first), weight?: number }].
function reciprocalRankFusion(lists, { k = 60 } = {}) {
  const fused = new Map();

  for (const { ids, weight = 1 } of lists) {
    ids.forEach((id, position) => {
      fused.set(id, (fused.get(id) || 0) + weight / (k + position + 1));
    });
  }

  return [...fused.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of small) if (large.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

// Maximal Marginal Relevance (Carbonell & Goldstein 1998): greedily picks the
// item that balances relevance against similarity to what's already selected,
// so near-duplicate chunks (overlapping windows, restated definitions) don't
// fill every slot. `relevance` must already be on a comparable 0..1 scale;
// similarity is token-set Jaccard, which needs no embeddings and so also works
// when vectors live in Atlas rather than in this process.
// `items` is [{ id, relevance, tokens: Set }].
function mmrSelect(items, { k, lambda = 0.7 }) {
  const remaining = [...items];
  const selected = [];

  while (selected.length < k && remaining.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;

    remaining.forEach((item, index) => {
      const redundancy = selected.length
        ? Math.max(...selected.map((s) => jaccard(item.tokens, s.tokens)))
        : 0;
      const score = lambda * item.relevance - (1 - lambda) * redundancy;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

module.exports = { reciprocalRankFusion, mmrSelect, jaccard };
