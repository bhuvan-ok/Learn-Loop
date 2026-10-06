// Turns a ranked list into an answer/refuse decision plus the chunks worth
// showing the model. Kept as a pure function so the evaluation harness can
// apply and sweep thresholds offline on recorded scores and get exactly the
// decisions production would make.
//
// - abstain: the best chunk's signal is below `threshold` (nothing in the course
//   is relevant enough to answer from);
// - context: chunks whose own signal is at least `dropBelow` (defaults to
//   `threshold`), so a weak straggler doesn't dilute the prompt.
function applyThreshold(ranked, { threshold, dropBelow }) {
  const signalOf = (r) => (typeof r.signal === 'number' ? r.signal : -Infinity);
  const best = ranked.length ? Math.max(...ranked.map(signalOf)) : -Infinity;
  if (!ranked.length || best < threshold) return { abstain: true, context: [] };

  const floor = dropBelow ?? threshold;
  return { abstain: false, context: ranked.filter((r) => signalOf(r) >= floor) };
}

module.exports = { applyThreshold };
