// Small deterministic statistics helpers. With ~75 answerable questions a
// difference of a few points can be noise, so every comparison against the
// baseline is reported with a paired bootstrap confidence interval.
function mean(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

// Seeded PRNG (mulberry32) so intervals are reproducible run to run.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

// Bootstrap of the mean of one sample.
function bootstrapMean(values, { resamples = 2000, seed = 7 } = {}) {
  const random = rng(seed);
  const n = values.length;
  const means = [];
  for (let r = 0; r < resamples; r += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += values[Math.floor(random() * n)];
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  return { mean: mean(values), lo: percentile(means, 0.025), hi: percentile(means, 0.975) };
}

// Paired bootstrap: resample question indices once and compare the same
// questions under both systems. Returns the mean difference (b - a) and the
// relative change vs a, each with a 95% interval.
function pairedBootstrap(a, b, { resamples = 2000, seed = 11 } = {}) {
  const random = rng(seed);
  const n = a.length;
  const diffs = [];
  const rels = [];
  for (let r = 0; r < resamples; r += 1) {
    let sumA = 0;
    let sumB = 0;
    for (let i = 0; i < n; i += 1) {
      const idx = Math.floor(random() * n);
      sumA += a[idx];
      sumB += b[idx];
    }
    diffs.push((sumB - sumA) / n);
    if (sumA > 0) rels.push((sumB - sumA) / sumA);
  }
  diffs.sort((x, y) => x - y);
  rels.sort((x, y) => x - y);
  const meanA = mean(a);
  const meanB = mean(b);
  return {
    meanA,
    meanB,
    diff: meanB - meanA,
    diffLo: percentile(diffs, 0.025),
    diffHi: percentile(diffs, 0.975),
    rel: meanA > 0 ? (meanB - meanA) / meanA : null,
    relLo: rels.length ? percentile(rels, 0.025) : null,
    relHi: rels.length ? percentile(rels, 0.975) : null,
  };
}

function quantile(values, q) {
  const sorted = [...values].sort((x, y) => x - y);
  return percentile(sorted, q);
}

module.exports = { mean, bootstrapMean, pairedBootstrap, quantile };
