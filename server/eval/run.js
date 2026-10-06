// Runs retrieval experiments against the evaluation corpus.
//
//   node eval/run.js                      run every experiment that has no results yet
//   node eval/run.js --exp basic,hybrid   run specific experiments
//   node eval/run.js --force              re-run even if raw results exist
//
// Runs in an isolated local database ("lms_eval", never MONGO_URI). Embeddings
// and LLM outputs are cached on disk (eval/.cache) so reruns are fast and
// exactly reproducible; delete that folder for a from-scratch run.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

process.env.AI_CACHE_DIR = process.env.AI_CACHE_DIR || path.join(__dirname, '.cache', 'ai');
// The LLM-driven stages (rewrite, multi-query, HyDE, rerank, context notes) make
// one short call each. On the Gemini free tier the main chat model allows only
// ~20 requests/day, so the evaluation uses a cheap "lite" model for these
// utility calls (the same GEMINI_UTILITY_MODEL setting production supports) and
// paces them under its ~15 requests/minute limit. Override either via env.
process.env.GEMINI_UTILITY_MODEL = process.env.GEMINI_UTILITY_MODEL || 'gemini-3.1-flash-lite';
process.env.AI_MIN_INTERVAL_MS = process.env.AI_MIN_INTERVAL_MS || '4300';

const mongoose = require('mongoose');
const { connectEvalDb } = require('./lib/db');
const { loadDataset, validateDataset } = require('./lib/corpus');
const { EXPERIMENTS, configOf, groupByVariant } = require('./lib/experiments');
const { buildIndexVariant } = require('./lib/indexer');
const { runExperiment, loadRaw } = require('./lib/runner');

function parseArgs(argv) {
  const args = { exp: null, force: false, concurrency: Number(process.env.EVAL_CONCURRENCY || 2) };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--exp') args.exp = argv[++i].split(',');
    else if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--concurrency') args.concurrency = Number(argv[++i]);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const log = (msg) => console.log(msg);

  const problems = validateDataset();
  if (problems.length) {
    console.error('Dataset is invalid; run `npm run eval:validate`.');
    process.exit(1);
  }

  const dataset = loadDataset();
  let experiments = EXPERIMENTS;
  if (args.exp) {
    const unknown = args.exp.filter((n) => !EXPERIMENTS.some((e) => e.name === n));
    if (unknown.length) throw new Error(`Unknown experiment(s): ${unknown.join(', ')}`);
    experiments = EXPERIMENTS.filter((e) => args.exp.includes(e.name));
  }
  if (!args.force) experiments = experiments.filter((e) => !loadRaw(e.name));
  if (!experiments.length) {
    log('Nothing to run (use --force to re-run).');
    return;
  }

  await connectEvalDb();
  log(`Evaluation database: ${mongoose.connection.host}/${mongoose.connection.name}`);

  const invalid = [];
  for (const [key, group] of groupByVariant(experiments)) {
    const first = group[0];
    log(`\n== Index variant "${key}" ==`);
    const variant = await buildIndexVariant({ frozen: key === 'frozen', config: configOf(first) });
    log(`indexed ${variant.chunkCount} chunks in ${variant.indexSeconds.toFixed(1)}s`);

    for (const exp of group) {
      log(`-- ${exp.name}: ${exp.label}`);
      const started = Date.now();
      const raw = await runExperiment({ exp, variant, dataset, concurrency: args.concurrency, log });
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      if (raw.invalid) {
        invalid.push(exp.name);
        log(`   NOT SAVED after ${secs}s: ${raw.questionErrors} question error(s), ${raw.llmFailures} LLM stage fallback(s).`);
        log('   (re-run to retry; completed calls are cached)');
      } else {
        log(`   done in ${secs}s (${raw.records.reduce((n, r) => n + r.trace.llmCalls, 0)} LLM calls)`);
      }
    }
  }

  await mongoose.disconnect();
  if (invalid.length) {
    console.error(`
Incomplete experiments (not saved): ${invalid.join(', ')}`);
    process.exitCode = 1;
  }
}

main().catch(async (err) => {
  console.error('Evaluation failed:', err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
