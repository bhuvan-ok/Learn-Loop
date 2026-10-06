// Measures real retrieval latency and LLM-call cost of the baseline vs the
// production default. The main evaluation reads cached LLM/embedding responses,
// so its timings are meaningless; this script builds the indexes with the cache
// on (to avoid re-embedding the corpus), then DISABLES the cache and times each
// question end to end against the live providers, sequentially.
//   node eval/latency.js [--n 20]
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
process.env.AI_CACHE_DIR = path.join(__dirname, '.cache', 'ai');

const mongoose = require('mongoose');
const { connectEvalDb } = require('./lib/db');
const { loadDataset } = require('./lib/corpus');
const { EXPERIMENTS, configOf } = require('./lib/experiments');
const { buildIndexVariant } = require('./lib/indexer');
const { retrieveBaseline } = require('./baseline/pipeline');
const { retrieve } = require('../src/services/rag/pipeline');
const { quantile, mean } = require('./lib/stats');

async function timeAll(label, questions, fn) {
  const times = [];
  const calls = [];
  for (const q of questions) {
    const started = Date.now();
    const result = await fn(q);
    times.push(Date.now() - started);
    calls.push(result.trace.llmCalls || 0);
  }
  return { label, n: times.length, p50: quantile(times, 0.5), p95: quantile(times, 0.95), mean: mean(times), llmCalls: mean(calls) };
}

async function main() {
  const n = process.argv.includes('--n') ? Number(process.argv[process.argv.indexOf('--n') + 1]) : 20;
  // A spread across categories, test split only, deterministic.
  const questions = loadDataset().filter((q) => q.split === 'test').filter((_, i) => i % 2 === 0).slice(0, n);

  await connectEvalDb();
  const advancedExp = EXPERIMENTS.find((e) => e.name === 'advanced');
  const config = configOf(advancedExp);

  const frozen = await buildIndexVariant({ frozen: true, config: null });
  delete process.env.AI_CACHE_DIR;
  const basic = await timeAll('basic', questions, (q) => retrieveBaseline({ courseId: frozen.courseId, question: q.question }));

  process.env.AI_CACHE_DIR = path.join(__dirname, '.cache', 'ai');
  const adv = await buildIndexVariant({ frozen: false, config });
  delete process.env.AI_CACHE_DIR;

  // One warm-up so the first question doesn't pay for building the in-memory course index.
  await retrieve({ courseId: adv.courseId, question: 'warm up', history: [], config });
  const advanced = await timeAll('advanced', questions, (q) => retrieve({ courseId: adv.courseId, question: q.question, history: q.history, config }));

  const rows = [basic, advanced];
  console.table(rows.map((r) => ({ pipeline: r.label, questions: r.n, 'p50 ms': Math.round(r.p50), 'p95 ms': Math.round(r.p95), 'mean ms': Math.round(r.mean), 'LLM calls/q': r.llmCalls.toFixed(2) })));

  fs.mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, 'results', 'latency.json'), JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Latency benchmark failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
