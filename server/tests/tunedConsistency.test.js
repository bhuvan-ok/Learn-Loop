const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PRESETS, TUNED } = require('../src/config/ragConfig');

// The thresholds production ships must be exactly the ones the evaluation
// tuned on the dev split and scored; otherwise the published numbers describe a
// different system than the one running.
const tunedPath = path.join(__dirname, '..', 'eval', 'tuned.json');

test('production thresholds match eval/tuned.json (rerank family)', { skip: !fs.existsSync(tunedPath) }, () => {
  const tuned = JSON.parse(fs.readFileSync(tunedPath, 'utf8')).rerank;
  assert.equal(TUNED.rerankThreshold, tuned.rerank.threshold);
  assert.equal(TUNED.rerankDropBelow, tuned.rerank.dropBelow);
  assert.equal(TUNED.denseThreshold, tuned.dense.threshold);
});

test('the production default uses the tuned thresholds and the validated stages', () => {
  const advanced = PRESETS.advanced;
  assert.equal(advanced.abstain.signal, 'rerank');
  assert.equal(advanced.abstain.threshold, TUNED.rerankThreshold);
  assert.equal(advanced.abstain.dropBelow, TUNED.rerankDropBelow);
  assert.equal(advanced.abstain.fallback.threshold, TUNED.denseThreshold);
  assert.equal(advanced.rerank.enabled, true);
  // Stages that have not been validated by the evaluation stay off by default.
  assert.equal(advanced.query.multiQuery, false);
  assert.equal(advanced.query.hyde, false);
  assert.equal(advanced.indexing.llmContext, false);
});
