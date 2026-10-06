const fs = require('fs');
const path = require('path');

const TUNED_PATH = path.join(__dirname, '..', 'tuned.json');

function loadTuned() {
  return fs.existsSync(TUNED_PATH) ? JSON.parse(fs.readFileSync(TUNED_PATH, 'utf8')) : {};
}

// Abstention thresholds used to score an experiment. The original pipeline
// (and its parity check) always use its fixed 0.15 cosine cut-off; every other
// experiment uses thresholds tuned on the dev split for that experiment's own
// score distribution (see eval/tune.js). Defaults apply only before tuning.
function thresholdsFor(name, tuned = loadTuned()) {
  if (name === 'basic' || name === 'basic-prod') {
    return { dense: { threshold: 0.15 }, rerank: { threshold: 0.15 } };
  }
  const t = tuned[name] || {};
  return {
    dense: t.dense || { threshold: 0.15 },
    rerank: t.rerank || { threshold: 4, dropBelow: 3 },
  };
}

module.exports = { thresholdsFor, loadTuned, TUNED_PATH };
